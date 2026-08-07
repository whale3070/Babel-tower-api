package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type InvoiceSetting struct {
	Enabled                    bool     `json:"enabled"`
	InvoiceNumberPrefix        string   `json:"invoice_number_prefix"`
	EligiblePaymentMethods     []string `json:"eligible_payment_methods"`
	EligiblePaymentProviders   []string `json:"eligible_payment_providers"`
	EligiblePaymentKeywords    []string `json:"eligible_payment_keywords"`
	SellerName                 string   `json:"seller_name"`
	SellerBusinessRegistration string   `json:"seller_business_registration"`
	SellerAddress              string   `json:"seller_address"`
	SellerEmail                string   `json:"seller_email"`
	Currency                   string   `json:"currency"`
	FiatReferenceCurrency      string   `json:"fiat_reference_currency"`
	DefaultUSDTNetwork         string   `json:"default_usdt_network"`
	ReceivingWalletAddress     string   `json:"receiving_wallet_address"`
	LineItemDescription        string   `json:"line_item_description"`
	TaxLabel                   string   `json:"tax_label"`
	TaxValue                   string   `json:"tax_value"`
	Notes                      string   `json:"notes"`
	FooterText                 string   `json:"footer_text"`
}

var invoiceSetting = InvoiceSetting{
	Enabled:             true,
	InvoiceNumberPrefix: "INV-USDT",
	EligiblePaymentMethods: []string{
		"usdt",
		"usdt-trc20",
		"usdt_trc20",
		"trc20-usdt",
		"trc20_usdt",
		"usdt-erc20",
		"usdt_erc20",
		"erc20-usdt",
		"erc20_usdt",
		"usdt-bep20",
		"usdt_bep20",
		"bep20-usdt",
		"bep20_usdt",
		"trc20",
		"erc20",
		"bep20",
	},
	EligiblePaymentProviders: []string{},
	EligiblePaymentKeywords:  []string{"usdt", "trc20", "erc20", "bep20"},
	Currency:                 "USDT",
	LineItemDescription:      "USDT wallet top-up",
	TaxLabel:                 "N/A",
	TaxValue:                 "N/A",
}

func init() {
	config.GlobalConfig.Register("invoice_setting", &invoiceSetting)
}

func GetInvoiceSetting() *InvoiceSetting {
	return &invoiceSetting
}
