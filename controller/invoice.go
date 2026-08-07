package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

const maxInvoicePDFFilenameLength = 128

func GetTopUpInvoice(c *gin.Context) {
	topUpID, err := strconv.Atoi(c.Param("id"))
	if err != nil || topUpID <= 0 {
		common.ApiErrorMsg(c, "invalid top-up id")
		return
	}

	userID := c.GetInt("id")
	allowAnyOwner := c.GetInt("role") >= common.RoleAdminUser
	invoice, err := service.GetTopUpInvoice(userID, topUpID, allowAnyOwner)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, invoice)
}

func DownloadTopUpInvoicePDF(c *gin.Context) {
	topUpID, err := strconv.Atoi(c.Param("id"))
	if err != nil || topUpID <= 0 {
		common.ApiErrorMsg(c, "invalid top-up id")
		return
	}

	userID := c.GetInt("id")
	allowAnyOwner := c.GetInt("role") >= common.RoleAdminUser
	invoice, err := service.GetTopUpInvoice(userID, topUpID, allowAnyOwner)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	writeTopUpInvoicePDF(c, invoice)
}

func writeTopUpInvoicePDF(c *gin.Context, invoice *service.TopUpInvoiceData) {
	pdfBytes, err := service.RenderTopUpInvoicePDF(invoice)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	filename := sanitizeInvoicePDFFilename(invoice.InvoiceNumber)
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.pdf"`, filename))
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

func sanitizeInvoicePDFFilename(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "invoice"
	}

	var b strings.Builder
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z':
			b.WriteRune(r)
		case r >= 'A' && r <= 'Z':
			b.WriteRune(r)
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '-' || r == '_':
			b.WriteRune(r)
		default:
			b.WriteRune('_')
		}
	}
	filename := strings.Trim(b.String(), "_")
	if filename == "" {
		return "invoice"
	}
	if len(filename) > maxInvoicePDFFilenameLength {
		filename = strings.TrimRight(filename[:maxInvoicePDFFilenameLength], "-_")
		if filename == "" {
			return "invoice"
		}
	}
	return filename
}
