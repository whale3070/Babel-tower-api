package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/shopspring/decimal"
)

var (
	ErrInvoiceNotAvailable = errors.New("invoice is not available for this top-up")
	ErrInvoiceNoPermission = errors.New("no permission to access this invoice")
	ErrInvoiceNotFound     = errors.New("top-up record not found")
)

type InvoiceParty struct {
	Name                       string `json:"name"`
	Company                    string `json:"company"`
	Email                      string `json:"email"`
	Address                    string `json:"address"`
	BusinessRegistrationNumber string `json:"business_registration_number"`
}

type InvoiceLineItem struct {
	Description string `json:"description"`
	Quantity    int    `json:"quantity"`
	UnitAmount  string `json:"unit_amount"`
	Total       string `json:"total"`
	Currency    string `json:"currency"`
}

type InvoicePaymentDetails struct {
	PaymentProvider           string `json:"payment_provider"`
	PaymentMethod             string `json:"payment_method"`
	OrderNumber               string `json:"order_number"`
	USDTNetwork               string `json:"usdt_network"`
	ReceivingWalletAddress    string `json:"receiving_wallet_address"`
	BlockchainTransactionHash string `json:"blockchain_transaction_hash"`
	PaymentCompletionTime     string `json:"payment_completion_time"`
	PaymentCompletionUnix     int64  `json:"payment_completion_unix"`
}

type InvoiceTotals struct {
	Subtotal   string `json:"subtotal"`
	TaxLabel   string `json:"tax_label"`
	TaxValue   string `json:"tax_value"`
	Total      string `json:"total"`
	AmountPaid string `json:"amount_paid"`
	BalanceDue string `json:"balance_due"`
	Currency   string `json:"currency"`
}

type TopUpInvoiceData struct {
	InvoiceNumber         string                `json:"invoice_number"`
	IssueDate             string                `json:"issue_date"`
	IssueDateUnix         int64                 `json:"issue_date_unix"`
	SourceType            string                `json:"source_type"`
	SourceID              int                   `json:"source_id"`
	Seller                InvoiceParty          `json:"seller"`
	Buyer                 InvoiceParty          `json:"buyer"`
	RechargeAmount        string                `json:"recharge_amount"`
	RechargeCurrency      string                `json:"recharge_currency"`
	FiatReferenceCurrency string                `json:"fiat_reference_currency"`
	CreditedAmount        int64                 `json:"credited_amount"`
	Payment               InvoicePaymentDetails `json:"payment"`
	LineItems             []InvoiceLineItem     `json:"line_items"`
	Totals                InvoiceTotals         `json:"totals"`
	Notes                 string                `json:"notes"`
	FooterText            string                `json:"footer_text"`
}

var hongKongTimeZone = time.FixedZone("HKT", 8*60*60)

func GetTopUpInvoice(userID int, topUpID int, allowAnyOwner bool) (*TopUpInvoiceData, error) {
	if topUpID <= 0 {
		return nil, ErrInvoiceNotFound
	}

	topUp := model.GetTopUpById(topUpID)
	if topUp == nil {
		return nil, ErrInvoiceNotFound
	}
	if !allowAnyOwner && topUp.UserId != userID {
		return nil, ErrInvoiceNotFound
	}
	if topUp.Status != common.TopUpStatusSuccess {
		return nil, ErrInvoiceNotAvailable
	}

	invoiceSetting := operation_setting.GetInvoiceSetting()
	if invoiceSetting == nil || !invoiceSetting.Enabled || !topUpInvoiceEligible(topUp, invoiceSetting) {
		return nil, ErrInvoiceNotAvailable
	}

	user, err := model.GetUserById(topUp.UserId, false)
	if err != nil {
		return nil, err
	}

	return buildTopUpInvoice(topUp, user, invoiceSetting), nil
}

func buildTopUpInvoice(topUp *model.TopUp, user *model.User, invoiceSetting *operation_setting.InvoiceSetting) *TopUpInvoiceData {
	currency := firstNonEmpty(invoiceSetting.Currency, "USDT")
	paymentAmount := topUp.Money
	if topUp.PaymentAmount > 0 {
		paymentAmount = topUp.PaymentAmount
	}
	rechargeAmount := formatInvoiceAmount(paymentAmount)
	issueTimestamp := firstPositiveInt64(topUp.CompleteTime, topUp.CreateTime)
	taxLabel := firstNonEmpty(invoiceSetting.TaxLabel, "N/A")
	taxValue := firstNonEmpty(invoiceSetting.TaxValue, "N/A")

	lineItem := InvoiceLineItem{
		Description: firstNonEmpty(invoiceSetting.LineItemDescription, "USDT wallet top-up"),
		Quantity:    1,
		UnitAmount:  rechargeAmount,
		Total:       rechargeAmount,
		Currency:    currency,
	}

	return &TopUpInvoiceData{
		InvoiceNumber:         buildTopUpInvoiceNumber(topUp, invoiceSetting),
		IssueDate:             formatInvoiceDate(issueTimestamp),
		IssueDateUnix:         issueTimestamp,
		SourceType:            "top_up",
		SourceID:              topUp.Id,
		Seller:                buildSellerParty(invoiceSetting),
		Buyer:                 buildBuyerParty(user),
		RechargeAmount:        rechargeAmount,
		RechargeCurrency:      currency,
		FiatReferenceCurrency: strings.TrimSpace(invoiceSetting.FiatReferenceCurrency),
		CreditedAmount:        topUp.Amount,
		Payment: InvoicePaymentDetails{
			PaymentProvider:           topUp.PaymentProvider,
			PaymentMethod:             topUp.PaymentMethod,
			OrderNumber:               topUp.TradeNo,
			USDTNetwork:               firstNonEmpty(inferUSDTNetwork(topUp.PaymentMethod), invoiceSetting.DefaultUSDTNetwork),
			ReceivingWalletAddress:    strings.TrimSpace(invoiceSetting.ReceivingWalletAddress),
			BlockchainTransactionHash: "",
			PaymentCompletionTime:     formatInvoiceDateTime(topUp.CompleteTime),
			PaymentCompletionUnix:     topUp.CompleteTime,
		},
		LineItems: []InvoiceLineItem{lineItem},
		Totals: InvoiceTotals{
			Subtotal:   rechargeAmount,
			TaxLabel:   taxLabel,
			TaxValue:   taxValue,
			Total:      rechargeAmount,
			AmountPaid: rechargeAmount,
			BalanceDue: "0",
			Currency:   currency,
		},
		Notes:      strings.TrimSpace(invoiceSetting.Notes),
		FooterText: strings.TrimSpace(invoiceSetting.FooterText),
	}
}

func buildTopUpInvoiceNumber(topUp *model.TopUp, invoiceSetting *operation_setting.InvoiceSetting) string {
	prefix := firstNonEmpty(invoiceSetting.InvoiceNumberPrefix, "INV-USDT")
	basis := fmt.Sprintf("%d:%d:%s", topUp.Id, topUp.UserId, topUp.TradeNo)
	suffix := strings.ToUpper(common.Sha1([]byte(basis))[:8])
	return fmt.Sprintf("%s-%06d-%s", strings.TrimSpace(prefix), topUp.Id, suffix)
}

func buildSellerParty(invoiceSetting *operation_setting.InvoiceSetting) InvoiceParty {
	return InvoiceParty{
		Name:                       strings.TrimSpace(invoiceSetting.SellerName),
		Company:                    strings.TrimSpace(invoiceSetting.SellerName),
		Email:                      strings.TrimSpace(invoiceSetting.SellerEmail),
		Address:                    strings.TrimSpace(invoiceSetting.SellerAddress),
		BusinessRegistrationNumber: strings.TrimSpace(invoiceSetting.SellerBusinessRegistration),
	}
}

func buildBuyerParty(user *model.User) InvoiceParty {
	return InvoiceParty{
		Name:    firstNonEmpty(user.DisplayName, user.Username, fmt.Sprintf("User #%d", user.Id)),
		Company: "",
		Email:   strings.TrimSpace(user.Email),
		Address: "",
	}
}

func topUpInvoiceEligible(topUp *model.TopUp, invoiceSetting *operation_setting.InvoiceSetting) bool {
	if topUp == nil || invoiceSetting == nil {
		return false
	}

	method := normalizeInvoiceIdentifier(topUp.PaymentMethod)
	provider := normalizeInvoiceIdentifier(topUp.PaymentProvider)

	if containsInvoiceIdentifier(invoiceSetting.EligiblePaymentMethods, method) {
		return true
	}
	if containsInvoiceIdentifier(invoiceSetting.EligiblePaymentProviders, provider) {
		return true
	}

	for _, keyword := range invoiceSetting.EligiblePaymentKeywords {
		keyword = normalizeInvoiceIdentifier(keyword)
		if invoiceIdentifierHasKeyword(method, keyword) || invoiceIdentifierHasKeyword(provider, keyword) {
			return true
		}
	}

	return false
}

func containsInvoiceIdentifier(values []string, needle string) bool {
	if needle == "" {
		return false
	}
	for _, value := range values {
		if normalizeInvoiceIdentifier(value) == needle {
			return true
		}
	}
	return false
}

func normalizeInvoiceIdentifier(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func invoiceIdentifierHasKeyword(value string, keyword string) bool {
	value = normalizeInvoiceIdentifier(value)
	keyword = normalizeInvoiceIdentifier(keyword)
	if value == "" || keyword == "" {
		return false
	}
	if value == keyword {
		return true
	}
	for _, token := range strings.FieldsFunc(value, func(r rune) bool {
		return !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'))
	}) {
		if token == keyword {
			return true
		}
	}
	return false
}

func inferUSDTNetwork(paymentMethod string) string {
	method := normalizeInvoiceIdentifier(paymentMethod)
	switch {
	case strings.Contains(method, "trc20"):
		return "TRC20"
	case strings.Contains(method, "erc20"):
		return "ERC20"
	case strings.Contains(method, "bep20"):
		return "BEP20"
	default:
		return ""
	}
}

func formatInvoiceAmount(value float64) string {
	return decimal.NewFromFloat(value).Round(8).String()
}

func formatInvoiceDate(timestamp int64) string {
	if timestamp <= 0 {
		return ""
	}
	return time.Unix(timestamp, 0).In(hongKongTimeZone).Format("2006-01-02")
}

func formatInvoiceDateTime(timestamp int64) string {
	if timestamp <= 0 {
		return ""
	}
	return time.Unix(timestamp, 0).In(hongKongTimeZone).Format(time.RFC3339)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func firstPositiveInt64(values ...int64) int64 {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}
