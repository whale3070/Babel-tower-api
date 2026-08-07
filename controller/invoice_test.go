package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupControllerInvoiceTestDB(t *testing.T) *gorm.DB {
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

func setControllerInvoiceSettingForTest(t *testing.T) {
	t.Helper()

	invoiceSetting := operation_setting.GetInvoiceSetting()
	original := *invoiceSetting
	*invoiceSetting = operation_setting.InvoiceSetting{
		Enabled:                 true,
		InvoiceNumberPrefix:     "INV-USDT",
		EligiblePaymentMethods:  []string{"usdt-trc20"},
		EligiblePaymentKeywords: []string{"usdt", "trc20"},
		SellerName:              "Seller Co",
		SellerEmail:             "billing@example.com",
		Currency:                "USDT",
		DefaultUSDTNetwork:      "TRC20",
		ReceivingWalletAddress:  "TA123456789",
		LineItemDescription:     "USDT wallet top-up",
		TaxLabel:                "N/A",
		TaxValue:                "N/A",
	}
	t.Cleanup(func() {
		*invoiceSetting = original
	})
}

func newInvoiceControllerContext(method string, path string, topUpID string, userID int, role int) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(method, path, nil)
	c.Params = gin.Params{{Key: "id", Value: topUpID}}
	c.Set("id", userID)
	c.Set("role", role)
	return c, recorder
}

func insertControllerInvoiceFixture(t *testing.T, db *gorm.DB) *model.TopUp {
	t.Helper()

	user := &model.User{
		Id:          7,
		Username:    "alice",
		DisplayName: "Alice Buyer",
		Password:    "password123",
		Email:       "alice@example.com",
	}
	require.NoError(t, db.Create(user).Error)

	topUp := &model.TopUp{
		Id:              42,
		UserId:          user.Id,
		Amount:          100,
		Money:           10,
		TradeNo:         "USR7NO123456",
		PaymentMethod:   "usdt-trc20",
		PaymentProvider: model.PaymentProviderEpay,
		CreateTime:      100,
		CompleteTime:    200,
		Status:          common.TopUpStatusSuccess,
	}
	require.NoError(t, db.Create(topUp).Error)
	return topUp
}

func TestGetTopUpInvoiceController(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupControllerInvoiceTestDB(t)
	setControllerInvoiceSettingForTest(t)
	topUp := insertControllerInvoiceFixture(t, db)

	c, recorder := newInvoiceControllerContext(http.MethodGet, "/api/user/topup/42/invoice", fmt.Sprintf("%d", topUp.Id), 7, common.RoleCommonUser)
	GetTopUpInvoice(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":true`)
	require.Contains(t, recorder.Body.String(), `"invoice_number":"INV-USDT-000042-`)

	c, recorder = newInvoiceControllerContext(http.MethodGet, "/api/user/topup/bad/invoice", "bad", 7, common.RoleCommonUser)
	GetTopUpInvoice(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.Contains(t, recorder.Body.String(), "invalid top-up id")

	c, recorder = newInvoiceControllerContext(http.MethodGet, "/api/user/topup/42/invoice", fmt.Sprintf("%d", topUp.Id), 99, common.RoleCommonUser)
	GetTopUpInvoice(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.Contains(t, recorder.Body.String(), "top-up record not found")
}

func TestDownloadTopUpInvoicePDFController(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupControllerInvoiceTestDB(t)
	setControllerInvoiceSettingForTest(t)
	topUp := insertControllerInvoiceFixture(t, db)

	c, recorder := newInvoiceControllerContext(http.MethodGet, "/api/user/topup/42/invoice.pdf", fmt.Sprintf("%d", topUp.Id), 7, common.RoleCommonUser)
	DownloadTopUpInvoicePDF(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "application/pdf", recorder.Header().Get("Content-Type"))
	require.Contains(t, recorder.Header().Get("Content-Disposition"), `attachment; filename="INV-USDT-000042-`)
	require.True(t, bytes.HasPrefix(recorder.Body.Bytes(), []byte("%PDF-1.4")))

	c, recorder = newInvoiceControllerContext(http.MethodGet, "/api/user/topup/bad/invoice.pdf", "bad", 7, common.RoleCommonUser)
	DownloadTopUpInvoicePDF(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.Contains(t, recorder.Body.String(), "invalid top-up id")

	c, recorder = newInvoiceControllerContext(http.MethodGet, "/api/user/topup/42/invoice.pdf", fmt.Sprintf("%d", topUp.Id), 99, common.RoleCommonUser)
	DownloadTopUpInvoicePDF(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.Contains(t, recorder.Body.String(), "top-up record not found")
}

func TestWriteTopUpInvoicePDFRejectsNilInvoice(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, recorder := newInvoiceControllerContext(http.MethodGet, "/api/user/topup/42/invoice.pdf", "42", 7, common.RoleCommonUser)

	writeTopUpInvoicePDF(c, nil)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.Contains(t, recorder.Body.String(), "top-up record not found")
}

func TestSanitizeInvoicePDFFilename(t *testing.T) {
	require.Equal(t, "invoice", sanitizeInvoicePDFFilename(""))
	require.Equal(t, "invoice", sanitizeInvoicePDFFilename("::::"))
	require.Equal(t, "INV-USDT_000042_bad_name", sanitizeInvoicePDFFilename(" INV-USDT/000042 bad:name "))

	longName := sanitizeInvoicePDFFilename(strings.Repeat("A", maxInvoicePDFFilenameLength+50))
	require.Len(t, longName, maxInvoicePDFFilenameLength)

	trimmedName := sanitizeInvoicePDFFilename(strings.Repeat("A", maxInvoicePDFFilenameLength-1) + "__unsafe")
	require.LessOrEqual(t, len(trimmedName), maxInvoicePDFFilenameLength)
	require.False(t, strings.HasSuffix(trimmedName, "_"))

	require.Equal(t, "invoice", sanitizeInvoicePDFFilename(strings.Repeat("-", maxInvoicePDFFilenameLength+5)+"A"))
}
