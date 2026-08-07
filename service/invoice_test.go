package service

import (
	"bytes"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupInvoiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	oldDB := model.DB
	oldLOGDB := model.LOG_DB
	oldUsingSQLite := common.UsingSQLite
	oldUsingMySQL := common.UsingMySQL
	oldUsingPostgreSQL := common.UsingPostgreSQL
	oldRedisEnabled := common.RedisEnabled

	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.NewReplacer("/", "_", " ", "_").Replace(t.Name()))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)

	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.TopUp{}))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
		model.DB = oldDB
		model.LOG_DB = oldLOGDB
		common.UsingSQLite = oldUsingSQLite
		common.UsingMySQL = oldUsingMySQL
		common.UsingPostgreSQL = oldUsingPostgreSQL
		common.RedisEnabled = oldRedisEnabled
	})

	return db
}

func setInvoiceSettingForTest(t *testing.T, next operation_setting.InvoiceSetting) {
	t.Helper()

	invoiceSetting := operation_setting.GetInvoiceSetting()
	original := *invoiceSetting
	*invoiceSetting = next
	t.Cleanup(func() {
		*invoiceSetting = original
	})
}

func invoiceSettingFixture() operation_setting.InvoiceSetting {
	return operation_setting.InvoiceSetting{
		Enabled:                    true,
		InvoiceNumberPrefix:        "INV-USDT",
		EligiblePaymentMethods:     []string{"usdt-trc20", "usdt_erc20"},
		EligiblePaymentProviders:   []string{"manual-usdt"},
		EligiblePaymentKeywords:    []string{"usdt", "trc20", "erc20", "bep20"},
		SellerName:                 "Seller Co",
		SellerBusinessRegistration: "BR123456",
		SellerAddress:              "Central, Hong Kong",
		SellerEmail:                "billing@example.com",
		Currency:                   "USDT",
		FiatReferenceCurrency:      "USD",
		DefaultUSDTNetwork:         "TRC20",
		ReceivingWalletAddress:     "TA123456789",
		LineItemDescription:        "USDT wallet top-up",
		TaxLabel:                   "Tax exempt",
		TaxValue:                   "0%",
		Notes:                      "Paid in full",
		FooterText:                 "Thank you",
	}
}

func TestBuildTopUpInvoiceNumberIsStable(t *testing.T) {
	topUp := &model.TopUp{
		Id:      42,
		UserId:  7,
		TradeNo: "USR7NO123456",
	}
	invoiceSetting := &operation_setting.InvoiceSetting{
		InvoiceNumberPrefix: "INV-USDT",
	}

	first := buildTopUpInvoiceNumber(topUp, invoiceSetting)
	second := buildTopUpInvoiceNumber(topUp, invoiceSetting)

	if first != second {
		t.Fatalf("expected stable invoice number, got %q and %q", first, second)
	}
	if !strings.HasPrefix(first, "INV-USDT-000042-") {
		t.Fatalf("unexpected invoice number prefix: %s", first)
	}
}

func TestTopUpInvoiceEligibleUsesConfiguredUSDTFields(t *testing.T) {
	invoiceSetting := &operation_setting.InvoiceSetting{
		EligiblePaymentMethods:   []string{"usdt-trc20"},
		EligiblePaymentProviders: []string{"manual-usdt"},
		EligiblePaymentKeywords:  []string{"usdt", "trc20"},
	}

	if !topUpInvoiceEligible(&model.TopUp{PaymentMethod: "USDT-TRC20"}, invoiceSetting) {
		t.Fatal("expected configured USDT payment method to be invoice eligible")
	}
	if !topUpInvoiceEligible(&model.TopUp{PaymentProvider: "manual-usdt"}, invoiceSetting) {
		t.Fatal("expected configured USDT payment provider to be invoice eligible")
	}
	if !topUpInvoiceEligible(&model.TopUp{PaymentMethod: "crypto-usdt-mainnet"}, invoiceSetting) {
		t.Fatal("expected tokenized USDT keyword to be invoice eligible")
	}
	if topUpInvoiceEligible(&model.TopUp{PaymentMethod: "notusdt"}, invoiceSetting) {
		t.Fatal("expected embedded substring without token boundary to be ineligible")
	}
	if topUpInvoiceEligible(&model.TopUp{PaymentMethod: "stripe", PaymentProvider: "stripe"}, invoiceSetting) {
		t.Fatal("expected unrelated payment method to be ineligible")
	}
	if topUpInvoiceEligible(nil, invoiceSetting) {
		t.Fatal("expected nil top-up to be ineligible")
	}
	if topUpInvoiceEligible(&model.TopUp{PaymentMethod: "usdt-trc20"}, nil) {
		t.Fatal("expected nil setting to be ineligible")
	}
}

func TestGetTopUpInvoiceAuthorizesAndBuildsCompletedUSDTInvoice(t *testing.T) {
	db := setupInvoiceTestDB(t)
	setInvoiceSettingForTest(t, invoiceSettingFixture())

	user := &model.User{
		Id:          7,
		Username:    "alice",
		DisplayName: "Alice Buyer",
		Password:    "password123",
		Email:       "alice@example.com",
	}
	require.NoError(t, db.Create(user).Error)

	completeTime := time.Date(2026, 7, 5, 4, 30, 0, 0, time.UTC).Unix()
	topUp := &model.TopUp{
		Id:              42,
		UserId:          user.Id,
		Amount:          123456,
		Money:           12.345678901,
		TradeNo:         "USR7NO123456",
		PaymentMethod:   "USDT-TRC20",
		PaymentProvider: model.PaymentProviderEpay,
		CreateTime:      completeTime - 3600,
		CompleteTime:    completeTime,
		Status:          common.TopUpStatusSuccess,
	}
	require.NoError(t, db.Create(topUp).Error)

	invoice, err := GetTopUpInvoice(user.Id, topUp.Id, false)
	require.NoError(t, err)
	require.NotNil(t, invoice)
	require.Equal(t, topUp.Id, invoice.SourceID)
	require.Equal(t, "top_up", invoice.SourceType)
	require.Equal(t, "INV-USDT-000042-", invoice.InvoiceNumber[:16])
	require.Equal(t, "2026-07-05", invoice.IssueDate)
	require.Equal(t, completeTime, invoice.IssueDateUnix)
	require.Equal(t, "Seller Co", invoice.Seller.Name)
	require.Equal(t, "Seller Co", invoice.Seller.Company)
	require.Equal(t, "BR123456", invoice.Seller.BusinessRegistrationNumber)
	require.Equal(t, "Alice Buyer", invoice.Buyer.Name)
	require.Equal(t, "alice@example.com", invoice.Buyer.Email)
	require.Equal(t, "12.3456789", invoice.RechargeAmount)
	require.Equal(t, int64(123456), invoice.CreditedAmount)
	require.Equal(t, "TRC20", invoice.Payment.USDTNetwork)
	require.Equal(t, "2026-07-05T12:30:00+08:00", invoice.Payment.PaymentCompletionTime)
	require.Equal(t, "TA123456789", invoice.Payment.ReceivingWalletAddress)
	require.Equal(t, "Tax exempt", invoice.Totals.TaxLabel)
	require.Equal(t, "0%", invoice.Totals.TaxValue)
	require.Equal(t, "0", invoice.Totals.BalanceDue)

	_, err = GetTopUpInvoice(99, topUp.Id, false)
	require.ErrorIs(t, err, ErrInvoiceNotFound)
	require.False(t, errors.Is(err, ErrInvoiceNoPermission))

	adminInvoice, err := GetTopUpInvoice(99, topUp.Id, true)
	require.NoError(t, err)
	require.Equal(t, invoice.InvoiceNumber, adminInvoice.InvoiceNumber)
}

func TestGetTopUpInvoiceRejectsUnavailableRecords(t *testing.T) {
	db := setupInvoiceTestDB(t)
	setInvoiceSettingForTest(t, invoiceSettingFixture())

	user := &model.User{
		Id:       12,
		Username: "bob",
		Password: "password123",
		Email:    "bob@example.com",
	}
	require.NoError(t, db.Create(user).Error)

	successTopUp := &model.TopUp{
		Id:              101,
		UserId:          user.Id,
		Amount:          100,
		Money:           10,
		TradeNo:         "USR12NOSUCCESS",
		PaymentMethod:   "usdt-trc20",
		PaymentProvider: model.PaymentProviderEpay,
		CreateTime:      100,
		CompleteTime:    200,
		Status:          common.TopUpStatusSuccess,
	}
	pendingTopUp := &model.TopUp{
		Id:              102,
		UserId:          user.Id,
		Amount:          100,
		Money:           10,
		TradeNo:         "USR12NOPENDING",
		PaymentMethod:   "usdt-trc20",
		PaymentProvider: model.PaymentProviderEpay,
		CreateTime:      100,
		Status:          common.TopUpStatusPending,
	}
	ineligibleTopUp := &model.TopUp{
		Id:              103,
		UserId:          user.Id,
		Amount:          100,
		Money:           10,
		TradeNo:         "USR12NOSTRIPE",
		PaymentMethod:   model.PaymentMethodStripe,
		PaymentProvider: model.PaymentProviderStripe,
		CreateTime:      100,
		CompleteTime:    200,
		Status:          common.TopUpStatusSuccess,
	}
	require.NoError(t, db.Create(successTopUp).Error)
	require.NoError(t, db.Create(pendingTopUp).Error)
	require.NoError(t, db.Create(ineligibleTopUp).Error)

	_, err := GetTopUpInvoice(user.Id, 0, false)
	require.ErrorIs(t, err, ErrInvoiceNotFound)

	_, err = GetTopUpInvoice(user.Id, 9999, false)
	require.ErrorIs(t, err, ErrInvoiceNotFound)

	_, err = GetTopUpInvoice(user.Id, pendingTopUp.Id, false)
	require.ErrorIs(t, err, ErrInvoiceNotAvailable)

	_, err = GetTopUpInvoice(user.Id, ineligibleTopUp.Id, false)
	require.ErrorIs(t, err, ErrInvoiceNotAvailable)

	missingUserTopUp := &model.TopUp{
		Id:              104,
		UserId:          999,
		Amount:          100,
		Money:           10,
		TradeNo:         "USR999NOUSER",
		PaymentMethod:   "usdt-trc20",
		PaymentProvider: model.PaymentProviderEpay,
		CreateTime:      100,
		CompleteTime:    200,
		Status:          common.TopUpStatusSuccess,
	}
	require.NoError(t, db.Create(missingUserTopUp).Error)
	_, err = GetTopUpInvoice(user.Id, missingUserTopUp.Id, true)
	require.Error(t, err)

	invoiceSetting := operation_setting.GetInvoiceSetting()
	invoiceSetting.Enabled = false
	_, err = GetTopUpInvoice(user.Id, successTopUp.Id, false)
	require.ErrorIs(t, err, ErrInvoiceNotAvailable)
}

func TestBuildTopUpInvoiceUsesFallbacks(t *testing.T) {
	topUp := &model.TopUp{
		Id:              77,
		UserId:          88,
		Amount:          50,
		Money:           19.5,
		TradeNo:         "MANUAL77",
		PaymentMethod:   "manual",
		PaymentProvider: "manual-usdt",
		CreateTime:      time.Date(2026, 1, 2, 16, 0, 0, 0, time.UTC).Unix(),
		Status:          common.TopUpStatusSuccess,
	}
	user := &model.User{Id: 88}
	invoiceSetting := &operation_setting.InvoiceSetting{
		Enabled:                true,
		InvoiceNumberPrefix:    "  ",
		Currency:               "  ",
		DefaultUSDTNetwork:     "ERC20",
		LineItemDescription:    "  ",
		TaxLabel:               "  ",
		TaxValue:               "  ",
		ReceivingWalletAddress: "  wallet-with-spaces  ",
		Notes:                  "  note  ",
		FooterText:             "  footer  ",
	}

	invoice := buildTopUpInvoice(topUp, user, invoiceSetting)
	require.Equal(t, "INV-USDT-000077-", invoice.InvoiceNumber[:16])
	require.Equal(t, "2026-01-03", invoice.IssueDate)
	require.Equal(t, "User #88", invoice.Buyer.Name)
	require.Equal(t, "USDT", invoice.RechargeCurrency)
	require.Equal(t, "USDT wallet top-up", invoice.LineItems[0].Description)
	require.Equal(t, "ERC20", invoice.Payment.USDTNetwork)
	require.Equal(t, "wallet-with-spaces", invoice.Payment.ReceivingWalletAddress)
	require.Equal(t, "N/A", invoice.Totals.TaxLabel)
	require.Equal(t, "N/A", invoice.Totals.TaxValue)
	require.Equal(t, "note", invoice.Notes)
	require.Equal(t, "footer", invoice.FooterText)
	require.Empty(t, invoice.Payment.PaymentCompletionTime)
}

func TestInvoiceFormattingHelpers(t *testing.T) {
	require.Equal(t, "BEP20", inferUSDTNetwork("USDT-BEP20"))
	require.Equal(t, "ERC20", inferUSDTNetwork("erc20_usdt"))
	require.Empty(t, inferUSDTNetwork("bank-transfer"))
	require.Equal(t, "1.23456789", formatInvoiceAmount(1.234567891))
	require.Empty(t, formatInvoiceDate(0))
	require.Empty(t, formatInvoiceDateTime(-1))
	require.Equal(t, int64(9), firstPositiveInt64(0, -1, 9))
	require.Zero(t, firstPositiveInt64(0, -1))
	require.Empty(t, firstNonEmpty("", " \t "))
	require.False(t, invoiceIdentifierHasKeyword("", "usdt"))
	require.False(t, invoiceIdentifierHasKeyword("usdt", ""))
	require.True(t, invoiceIdentifierHasKeyword("usdt", "usdt"))
}

func TestRenderTopUpInvoicePDF(t *testing.T) {
	invoice := &TopUpInvoiceData{
		InvoiceNumber:    "INV-USDT-000042-ABCDEF12",
		IssueDate:        "2026-07-05",
		RechargeCurrency: "USDT",
		Seller:           InvoiceParty{Name: "Seller Co", Email: "billing@example.com"},
		Buyer:            InvoiceParty{Name: "Customer", Email: "customer@example.com"},
		CreditedAmount:   100,
		Payment: InvoicePaymentDetails{
			PaymentProvider:           "epay",
			PaymentMethod:             "usdt-trc20",
			OrderNumber:               "USR7NO123456",
			USDTNetwork:               "TRC20",
			ReceivingWalletAddress:    "TA123456789",
			BlockchainTransactionHash: "0xabc",
			PaymentCompletionTime:     "2026-07-05T12:00:00+08:00",
		},
		LineItems: []InvoiceLineItem{
			{Description: "USDT wallet top-up", Quantity: 1, UnitAmount: "10", Total: "10", Currency: "USDT"},
			{Description: "USDT wallet top-up with extended line item copy for spacing and wrapping", Quantity: 2, UnitAmount: "15", Total: "30", Currency: "USDT"},
		},
		Totals: InvoiceTotals{
			Subtotal:   "10",
			TaxLabel:   "N/A",
			TaxValue:   "N/A",
			Total:      "10",
			AmountPaid: "10",
			BalanceDue: "0",
			Currency:   "USDT",
		},
	}

	pdfBytes, err := RenderTopUpInvoicePDF(invoice)
	if err != nil {
		t.Fatalf("RenderTopUpInvoicePDF returned error: %v", err)
	}
	if !bytes.HasPrefix(pdfBytes, []byte("%PDF-1.4")) {
		t.Fatalf("expected PDF header, got %q", string(pdfBytes[:8]))
	}
	if !bytes.Contains(pdfBytes, []byte(invoice.InvoiceNumber)) {
		t.Fatalf("expected PDF to contain invoice number")
	}
	if !bytes.Contains(pdfBytes, []byte("0.97 g")) {
		t.Fatalf("expected PDF to contain alternating gray line-item row background")
	}
	if !bytes.Contains(pdfBytes, []byte("USDT wallet top-up with extended")) {
		t.Fatalf("expected PDF to contain wrapped line-item description text")
	}
}

func TestRenderTopUpInvoicePDFRejectsNilInvoice(t *testing.T) {
	pdfBytes, err := RenderTopUpInvoicePDF(nil)
	require.ErrorIs(t, err, ErrInvoiceNotFound)
	require.Nil(t, pdfBytes)
}

func TestRenderTopUpInvoicePDFEscapesTextAndPaginates(t *testing.T) {
	invoice := &TopUpInvoiceData{
		InvoiceNumber:         "INV-(escape)-000001",
		IssueDate:             "2026-07-05",
		RechargeCurrency:      "USDT",
		FiatReferenceCurrency: "USD",
		Seller: InvoiceParty{
			Name:                       "Seller (HK) \\ Limited",
			Email:                      "billing@example.com",
			Address:                    strings.Repeat("Long seller address ", 20),
			BusinessRegistrationNumber: "BR123",
		},
		Buyer: InvoiceParty{
			Name:    "Customer",
			Company: "Customer Co",
			Address: "Address",
			Email:   "customer@example.com",
		},
		CreditedAmount: 100,
		Payment: InvoicePaymentDetails{
			PaymentProvider:           "epay",
			PaymentMethod:             "usdt-trc20",
			OrderNumber:               "USR7NO123456",
			USDTNetwork:               "TRC20",
			ReceivingWalletAddress:    strings.Repeat("TA123456789", 20),
			BlockchainTransactionHash: "0xabc",
			PaymentCompletionTime:     "2026-07-05T12:00:00+08:00",
		},
		Totals: InvoiceTotals{
			Subtotal:   "10",
			TaxLabel:   "N/A",
			TaxValue:   "N/A",
			Total:      "10",
			AmountPaid: "10",
			BalanceDue: "0",
			Currency:   "USDT",
		},
		Notes:      strings.Repeat("This note should continue onto another page. ", 120),
		FooterText: "Footer with parens (ok) and slash \\ ok",
	}
	for i := 0; i < 45; i++ {
		invoice.LineItems = append(invoice.LineItems, InvoiceLineItem{
			Description: fmt.Sprintf("USDT wallet top-up line %02d", i),
			Quantity:    1,
			UnitAmount:  "10",
			Total:       "10",
			Currency:    "USDT",
		})
	}

	pdfBytes, err := RenderTopUpInvoicePDF(invoice)
	require.NoError(t, err)
	require.Contains(t, string(pdfBytes), `INV-\(escape\)-000001`)
	require.Contains(t, string(pdfBytes), `Seller \(HK\) \\ Limited`)
	require.Contains(t, string(pdfBytes), "continued")
}

func TestInvoicePDFTextHelpers(t *testing.T) {
	require.Equal(t, `a\(b\)\\c ??`, escapePDFString("a(b)\\c\n中文"))
	require.Equal(t, "abc\n\t?", pdfASCII("abc\n\té"))
	require.Equal(t, "N/A", nonEmpty(" \t "))
	require.Equal(t, "N/A USDT", formatInvoicePDFMoney("", "USDT"))

	lines := wrapPDFText("supercalifragilistic words", 40, 8)
	require.Greater(t, len(lines), 1)
	for _, line := range lines {
		require.NotEmpty(t, line)
	}

	lines = wrapPDFText("first\n\nsecond", 120, 8)
	require.Contains(t, lines, "")

	lines = wrapPDFText("small supercalifragilisticexpialidocious tiny words", 48, 8)
	require.Greater(t, len(lines), 3)

	height := measureKVRowsHeight(140, 8, []invoicePDFKV{{"Label", "one two three four five"}})
	require.Greater(t, height, 0.0)

	singleLineItemHeight := measureLineItemRowHeight([]string{"single"})
	multiLineItemHeight := measureLineItemRowHeight([]string{"line 1", "line 2", "line 3"})
	emptyLineItemHeight := measureLineItemRowHeight(nil)
	require.Equal(t, invoicePDFLineItemMinRowHeight, emptyLineItemHeight)
	require.GreaterOrEqual(t, singleLineItemHeight, invoicePDFLineItemMinRowHeight)
	require.Greater(t, multiLineItemHeight, singleLineItemHeight)

	renderer := newInvoicePDFRenderer()
	renderer.y = invoicePDFMargin + 5
	height = renderer.kvRows(invoicePDFMargin, renderer.y, 140, []invoicePDFKV{{"Label", "value"}})
	require.Greater(t, height, 0.0)
	require.Len(t, renderer.pages, 2)
	require.Less(t, renderer.y, invoicePDFHeight-invoicePDFMargin)
}
