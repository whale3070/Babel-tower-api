package service

import (
	"bytes"
	"fmt"
	"math"
	"sort"
	"strings"
)

const (
	invoicePDFWidth  = 595.0
	invoicePDFHeight = 842.0
	invoicePDFMargin = 50.0

	invoicePDFLineItemHeaderHeight     = 24.0
	invoicePDFLineItemHeaderGap        = 8.0
	invoicePDFLineItemMinRowHeight     = 36.0
	invoicePDFLineItemDescriptionWidth = 276.0
	invoicePDFLineItemTextTopPadding   = 16.0
	invoicePDFLineItemLineHeight       = 11.0
)

type invoicePDFPage struct {
	content bytes.Buffer
}

type invoicePDFRenderer struct {
	pages []*invoicePDFPage
	page  *invoicePDFPage
	y     float64
}

func RenderTopUpInvoicePDF(invoice *TopUpInvoiceData) ([]byte, error) {
	if invoice == nil {
		return nil, ErrInvoiceNotFound
	}

	renderer := newInvoicePDFRenderer()
	renderer.render(invoice)
	return renderer.build()
}

func newInvoicePDFRenderer() *invoicePDFRenderer {
	renderer := &invoicePDFRenderer{}
	renderer.addPage()
	return renderer
}

func (r *invoicePDFRenderer) addPage() {
	page := &invoicePDFPage{}
	r.pages = append(r.pages, page)
	r.page = page
	r.y = invoicePDFHeight - invoicePDFMargin
}

func (r *invoicePDFRenderer) ensure(height float64) bool {
	if r.y-height < invoicePDFMargin {
		r.addPage()
		return true
	}
	return false
}

func (r *invoicePDFRenderer) render(invoice *TopUpInvoiceData) {
	r.text(invoicePDFMargin, r.y, 34, "F2", "Invoice")
	r.text(invoicePDFMargin, r.y-24, 10, "F1", "USDT top-up invoice")
	r.metaBlock(invoicePDFWidth-240, r.y, []invoicePDFKV{
		{"Invoice number", invoice.InvoiceNumber},
		{"Issue date", invoice.IssueDate},
		{"Order number", invoice.Payment.OrderNumber},
	})
	r.y -= 58
	r.line(invoicePDFMargin, r.y, invoicePDFWidth-invoicePDFMargin, r.y)
	r.y -= 24

	r.twoColumnBlock("Seller", []invoicePDFKV{
		{"Name", invoice.Seller.Name},
		{"Address", invoice.Seller.Address},
		{"Email", invoice.Seller.Email},
		{"Hong Kong BR No.", invoice.Seller.BusinessRegistrationNumber},
	}, "Bill to", []invoicePDFKV{
		{"Name", invoice.Buyer.Name},
		{"Company", invoice.Buyer.Company},
		{"Address", invoice.Buyer.Address},
		{"Email", invoice.Buyer.Email},
	})

	r.amountAndPayment(invoice)
	r.usdtDetails(invoice)
	r.lineItems(invoice)
	r.totals(invoice)

	if invoice.Notes != "" || invoice.FooterText != "" {
		r.sectionTitle("Notes")
		if invoice.Notes != "" {
			r.paragraph(invoicePDFMargin, invoicePDFWidth-invoicePDFMargin*2, 9, invoice.Notes)
		}
		if invoice.FooterText != "" {
			r.paragraph(invoicePDFMargin, invoicePDFWidth-invoicePDFMargin*2, 9, invoice.FooterText)
		}
	}
}

type invoicePDFKV struct {
	label string
	value string
}

func (r *invoicePDFRenderer) metaBlock(x float64, y float64, rows []invoicePDFKV) {
	for i, row := range rows {
		lineY := y - float64(i*16)
		r.text(x, lineY, 8, "F1", row.label)
		r.text(x+96, lineY, 8, "F2", nonEmpty(row.value))
	}
}

func (r *invoicePDFRenderer) twoColumnBlock(leftTitle string, leftRows []invoicePDFKV, rightTitle string, rightRows []invoicePDFKV) {
	colWidth := (invoicePDFWidth - invoicePDFMargin*2 - 30) / 2
	leftRowsHeight := measureKVRowsHeight(colWidth, 8, leftRows)
	rightRowsHeight := measureKVRowsHeight(colWidth, 8, rightRows)
	r.ensure(48 + math.Max(leftRowsHeight, rightRowsHeight))
	startY := r.y

	r.text(invoicePDFMargin, startY, 13, "F2", leftTitle)
	r.text(invoicePDFMargin+colWidth+30, startY, 13, "F2", rightTitle)

	r.kvRows(invoicePDFMargin, startY-20, colWidth, leftRows)
	leftEndY := r.y
	r.kvRows(invoicePDFMargin+colWidth+30, startY-20, colWidth, rightRows)
	rightEndY := r.y
	r.y = math.Min(leftEndY, rightEndY) - 8
	r.line(invoicePDFMargin, r.y, invoicePDFWidth-invoicePDFMargin, r.y)
	r.y -= 24
}

func (r *invoicePDFRenderer) amountAndPayment(invoice *TopUpInvoiceData) {
	detailsRows := []invoicePDFKV{
		{"Payment method", invoice.Payment.PaymentMethod},
		{"Provider", invoice.Payment.PaymentProvider},
		{"Credited amount", fmt.Sprintf("%d", invoice.CreditedAmount)},
	}
	detailsWidth := invoicePDFWidth - (invoicePDFMargin + 250) - invoicePDFMargin
	r.ensure(math.Max(110, measureKVRowsHeight(detailsWidth, 8, detailsRows)+24))
	startY := r.y
	r.fillRect(invoicePDFMargin, startY-68, 210, 68, 0.94)
	r.text(invoicePDFMargin+14, startY-22, 8, "F2", "Amount paid")
	r.text(invoicePDFMargin+14, startY-48, 20, "F2", formatInvoicePDFMoney(invoice.Totals.AmountPaid, invoice.Totals.Currency))
	if invoice.FiatReferenceCurrency != "" {
		r.text(invoicePDFMargin+14, startY-62, 8, "F1", "Fiat reference: "+invoice.FiatReferenceCurrency)
	}

	x := invoicePDFMargin + 250
	r.kvRows(x, startY-4, detailsWidth, detailsRows)
	r.y = math.Min(r.y, startY-92)
	r.line(invoicePDFMargin, r.y, invoicePDFWidth-invoicePDFMargin, r.y)
	r.y -= 24
}

func (r *invoicePDFRenderer) usdtDetails(invoice *TopUpInvoiceData) {
	r.sectionTitle("USDT payment details")
	r.kvRows(invoicePDFMargin, r.y, invoicePDFWidth-invoicePDFMargin*2, []invoicePDFKV{
		{"Network", invoice.Payment.USDTNetwork},
		{"Payment completion time", invoice.Payment.PaymentCompletionTime},
		{"Receiving wallet", invoice.Payment.ReceivingWalletAddress},
		{"Blockchain transaction hash", invoice.Payment.BlockchainTransactionHash},
	})
	r.y -= 12
	r.line(invoicePDFMargin, r.y, invoicePDFWidth-invoicePDFMargin, r.y)
	r.y -= 24
}

func (r *invoicePDFRenderer) lineItems(invoice *TopUpInvoiceData) {
	r.sectionTitle("Line items")

	x := invoicePDFMargin
	width := invoicePDFWidth - invoicePDFMargin*2

	r.lineItemsHeader(x, width)
	for index, item := range invoice.LineItems {
		descriptionLines := wrapPDFText(item.Description, invoicePDFLineItemDescriptionWidth, 8)
		rowHeight := measureLineItemRowHeight(descriptionLines)
		if r.ensure(rowHeight) {
			r.lineItemsHeader(x, width)
		}

		rowTop := r.y
		rowBottom := rowTop - rowHeight
		if index%2 == 1 {
			r.fillRect(x, rowBottom, width, rowHeight, 0.97)
		}

		textY := rowTop - invoicePDFLineItemTextTopPadding
		for lineIndex, line := range descriptionLines {
			r.text(x+8, textY-float64(lineIndex)*invoicePDFLineItemLineHeight, 8, "F1", line)
		}
		r.text(x+300, textY, 8, "F1", fmt.Sprintf("%d", item.Quantity))
		r.text(x+360, textY, 8, "F1", formatInvoicePDFMoney(item.UnitAmount, item.Currency))
		r.text(x+450, textY, 8, "F1", formatInvoicePDFMoney(item.Total, item.Currency))

		r.y = rowBottom
		r.line(x, r.y, x+width, r.y)
	}
	r.y -= 10
}

func (r *invoicePDFRenderer) lineItemsHeader(x float64, width float64) {
	r.ensure(invoicePDFLineItemHeaderHeight + invoicePDFLineItemHeaderGap)
	r.fillRect(x, r.y-invoicePDFLineItemHeaderHeight, width, invoicePDFLineItemHeaderHeight, 0.94)
	r.text(x+8, r.y-15, 8, "F2", "Description")
	r.text(x+300, r.y-15, 8, "F2", "Qty")
	r.text(x+360, r.y-15, 8, "F2", "Unit amount")
	r.text(x+450, r.y-15, 8, "F2", "Line total")
	r.y -= invoicePDFLineItemHeaderHeight
	r.line(x, r.y, x+width, r.y)
	r.y -= invoicePDFLineItemHeaderGap
}

func measureLineItemRowHeight(descriptionLines []string) float64 {
	lineCount := len(descriptionLines)
	if lineCount == 0 {
		lineCount = 1
	}
	height := float64(lineCount)*invoicePDFLineItemLineHeight + 24
	return math.Max(invoicePDFLineItemMinRowHeight, height)
}

func (r *invoicePDFRenderer) totals(invoice *TopUpInvoiceData) {
	x := invoicePDFWidth - invoicePDFMargin - 220
	rows := []invoicePDFKV{
		{"Subtotal", formatInvoicePDFMoney(invoice.Totals.Subtotal, invoice.Totals.Currency)},
		{"Tax", nonEmpty(invoice.Totals.TaxLabel) + ": " + nonEmpty(invoice.Totals.TaxValue)},
		{"Total", formatInvoicePDFMoney(invoice.Totals.Total, invoice.Totals.Currency)},
		{"Amount paid", formatInvoicePDFMoney(invoice.Totals.AmountPaid, invoice.Totals.Currency)},
		{"Balance due", formatInvoicePDFMoney(invoice.Totals.BalanceDue, invoice.Totals.Currency)},
	}
	r.ensure(measureKVRowsHeight(220, 8, rows))
	r.kvRows(x, r.y, 220, rows)
	r.y -= 12
}

func (r *invoicePDFRenderer) sectionTitle(title string) {
	r.ensure(28)
	r.text(invoicePDFMargin, r.y, 13, "F2", title)
	r.y -= 20
}

func (r *invoicePDFRenderer) kvRows(x float64, y float64, width float64, rows []invoicePDFKV) float64 {
	cursorY := y
	labelWidth := 120.0
	valueWidth := width - labelWidth
	if valueWidth < 80 {
		valueWidth = 80
	}

	totalHeight := 0.0
	for _, row := range rows {
		lines := wrapPDFText(nonEmpty(row.value), valueWidth, 8)
		rowHeight := float64(len(lines))*12 + 4
		if cursorY-rowHeight < invoicePDFMargin {
			r.addPage()
			cursorY = r.y
		}
		r.text(x, cursorY, 8, "F1", row.label)
		for i, line := range lines {
			r.text(x+labelWidth, cursorY-float64(i*11), 8, "F2", line)
		}
		cursorY -= rowHeight
		totalHeight += rowHeight
		r.y = cursorY
	}
	return totalHeight
}

func measureKVRowsHeight(width float64, fontSize float64, rows []invoicePDFKV) float64 {
	labelWidth := 120.0
	valueWidth := width - labelWidth
	if valueWidth < 80 {
		valueWidth = 80
	}

	height := 0.0
	for _, row := range rows {
		lines := wrapPDFText(nonEmpty(row.value), valueWidth, fontSize)
		height += float64(len(lines))*12 + 4
	}
	return height
}

func (r *invoicePDFRenderer) paragraph(x float64, width float64, size float64, text string) {
	for _, line := range wrapPDFText(text, width, size) {
		r.ensure(size + 8)
		r.text(x, r.y, size, "F1", line)
		r.y -= size + 5
	}
}

func (r *invoicePDFRenderer) text(x float64, y float64, size float64, font string, text string) {
	fmt.Fprintf(&r.page.content, "BT /%s %.1f Tf %.1f %.1f Td (%s) Tj ET\n", font, size, x, y, escapePDFString(text))
}

func (r *invoicePDFRenderer) line(x1 float64, y1 float64, x2 float64, y2 float64) {
	fmt.Fprintf(&r.page.content, "0.75 w %.1f %.1f m %.1f %.1f l S\n", x1, y1, x2, y2)
}

func (r *invoicePDFRenderer) fillRect(x float64, y float64, width float64, height float64, gray float64) {
	fmt.Fprintf(&r.page.content, "%.2f g %.1f %.1f %.1f %.1f re f 0 g\n", gray, x, y, width, height)
}

func (r *invoicePDFRenderer) build() ([]byte, error) {
	var out bytes.Buffer
	out.WriteString("%PDF-1.4\n")

	objects := map[int]string{
		1: "<< /Type /Catalog /Pages 2 0 R >>",
		4: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		5: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
	}

	pageRefs := make([]string, 0, len(r.pages))
	nextObjectID := 6
	for i, page := range r.pages {
		pageObjectID := nextObjectID
		contentObjectID := nextObjectID + 1
		nextObjectID += 2

		pageRefs = append(pageRefs, fmt.Sprintf("%d 0 R", pageObjectID))
		objects[pageObjectID] = fmt.Sprintf("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.0f %.0f] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents %d 0 R >>", invoicePDFWidth, invoicePDFHeight, contentObjectID)
		stream := page.content.String()
		if i > 0 {
			stream = "BT /F1 8 Tf 50 30 Td (continued) Tj ET\n" + stream
		}
		objects[contentObjectID] = fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(stream), stream)
	}
	objects[2] = fmt.Sprintf("<< /Type /Pages /Kids [%s] /Count %d >>", strings.Join(pageRefs, " "), len(r.pages))

	keys := make([]int, 0, len(objects))
	for key := range objects {
		keys = append(keys, key)
	}
	sort.Ints(keys)

	offsets := map[int]int{}
	for _, key := range keys {
		offsets[key] = out.Len()
		fmt.Fprintf(&out, "%d 0 obj\n%s\nendobj\n", key, objects[key])
	}

	xrefOffset := out.Len()
	size := keys[len(keys)-1] + 1
	fmt.Fprintf(&out, "xref\n0 %d\n", size)
	out.WriteString("0000000000 65535 f \n")
	for i := 1; i < size; i++ {
		offset, ok := offsets[i]
		if !ok {
			out.WriteString("0000000000 00000 f \n")
			continue
		}
		fmt.Fprintf(&out, "%010d 00000 n \n", offset)
	}
	fmt.Fprintf(&out, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", size, xrefOffset)
	return out.Bytes(), nil
}

func wrapPDFText(text string, width float64, fontSize float64) []string {
	text = pdfASCII(nonEmpty(text))
	maxChars := int(width / (fontSize * 0.52))
	if maxChars < 12 {
		maxChars = 12
	}
	var lines []string
	for _, paragraph := range strings.Split(text, "\n") {
		words := strings.Fields(paragraph)
		if len(words) == 0 {
			lines = append(lines, "")
			continue
		}
		line := ""
		for _, word := range words {
			if len(word) > maxChars {
				if line != "" {
					lines = append(lines, line)
					line = ""
				}
				for len(word) > maxChars {
					lines = append(lines, word[:maxChars])
					word = word[maxChars:]
				}
			}
			if line == "" {
				line = word
				continue
			}
			if len(line)+1+len(word) > maxChars {
				lines = append(lines, line)
				line = word
			} else {
				line += " " + word
			}
		}
		if line != "" {
			lines = append(lines, line)
		}
	}
	return lines
}

func escapePDFString(text string) string {
	text = pdfASCII(nonEmpty(text))
	text = strings.ReplaceAll(text, "\\", "\\\\")
	text = strings.ReplaceAll(text, "(", "\\(")
	text = strings.ReplaceAll(text, ")", "\\)")
	text = strings.ReplaceAll(text, "\r", " ")
	text = strings.ReplaceAll(text, "\n", " ")
	return text
}

func pdfASCII(text string) string {
	var b strings.Builder
	for _, r := range text {
		switch {
		case r == '\n' || r == '\r' || r == '\t':
			b.WriteRune(r)
		case r >= 32 && r <= 126:
			b.WriteRune(r)
		default:
			b.WriteRune('?')
		}
	}
	return b.String()
}

func nonEmpty(value string) string {
	if strings.TrimSpace(value) == "" {
		return "N/A"
	}
	return strings.TrimSpace(value)
}

func formatInvoicePDFMoney(amount string, currency string) string {
	return nonEmpty(amount) + " " + nonEmpty(currency)
}
