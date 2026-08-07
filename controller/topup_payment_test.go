package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func TestNormalizeTopupValuesRespectDisplayType(t *testing.T) {
	generalSetting := operation_setting.GetGeneralSetting()
	originalDisplayType := generalSetting.QuotaDisplayType
	t.Cleanup(func() {
		generalSetting.QuotaDisplayType = originalDisplayType
	})

	generalSetting.QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	require.Equal(t, int64(10), normalizeTopupMinimum(10))
	require.Equal(t, int64(10), normalizeStripeTopupAmount(10))

	generalSetting.QuotaDisplayType = operation_setting.QuotaDisplayTypeTokens
	tokenAmount := int64(10 * common.QuotaPerUnit)
	require.Equal(t, tokenAmount, normalizeTopupMinimum(10))
	require.Equal(t, int64(10), normalizeStripeTopupAmount(tokenAmount))
}

func TestStripeQuoteMatchesCheckoutQuantity(t *testing.T) {
	generalSetting := operation_setting.GetGeneralSetting()
	originalDisplayType := generalSetting.QuotaDisplayType
	originalUnitPrice := setting.StripeUnitPrice
	t.Cleanup(func() {
		generalSetting.QuotaDisplayType = originalDisplayType
		setting.StripeUnitPrice = originalUnitPrice
	})

	setting.StripeUnitPrice = 2.5
	generalSetting.QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	require.InDelta(t, 25, getStripePayMoney(10, "vip"), 0.000001)

	generalSetting.QuotaDisplayType = operation_setting.QuotaDisplayTypeCNY
	require.InDelta(t, 10, getStripePayMoney(10, "vip"), 0.000001)

	generalSetting.QuotaDisplayType = operation_setting.QuotaDisplayTypeTokens
	require.InDelta(
		t,
		25,
		getStripePayMoney(int64(10*common.QuotaPerUnit), "vip"),
		0.000001,
	)
	require.InDelta(
		t,
		25,
		getStripePayMoney(int64(10*common.QuotaPerUnit)+1, "vip"),
		0.000001,
	)
}

func TestGetTopupCreditedQuotaRespectsDisplayType(t *testing.T) {
	generalSetting := operation_setting.GetGeneralSetting()
	originalDisplayType := generalSetting.QuotaDisplayType
	t.Cleanup(func() {
		generalSetting.QuotaDisplayType = originalDisplayType
	})

	generalSetting.QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	require.Equal(t, operation_setting.QuotaDisplayTypeUSD, getTopupInputUnit())
	require.Equal(t, int64(10*common.QuotaPerUnit), getTopupCreditedQuota(10))

	generalSetting.QuotaDisplayType = operation_setting.QuotaDisplayTypeCNY
	require.Equal(t, operation_setting.QuotaDisplayTypeCNY, getTopupInputUnit())
	require.Equal(t, int64(10*common.QuotaPerUnit), getTopupCreditedQuota(10))

	generalSetting.QuotaDisplayType = operation_setting.QuotaDisplayTypeCustom
	require.Equal(t, operation_setting.QuotaDisplayTypeCustom, getTopupInputUnit())
	require.Equal(t, int64(10*common.QuotaPerUnit), getTopupCreditedQuota(10))

	generalSetting.QuotaDisplayType = operation_setting.QuotaDisplayTypeTokens
	require.Equal(t, operation_setting.QuotaDisplayTypeTokens, getTopupInputUnit())
	require.Equal(
		t,
		int64(10*common.QuotaPerUnit)+1,
		getTopupCreditedQuota(int64(10*common.QuotaPerUnit)+1),
	)
}

func TestStripeCNYCheckoutUsesExactQuotedAmount(t *testing.T) {
	generalSetting := operation_setting.GetGeneralSetting()
	originalDisplayType := generalSetting.QuotaDisplayType
	t.Cleanup(func() {
		generalSetting.QuotaDisplayType = originalDisplayType
	})

	generalSetting.QuotaDisplayType = operation_setting.QuotaDisplayTypeCNY
	lineItem, err := getStripeCheckoutLineItem(10, 10)
	require.NoError(t, err)
	require.Nil(t, lineItem.Price)
	require.NotNil(t, lineItem.PriceData)
	require.Equal(t, "cny", *lineItem.PriceData.Currency)
	require.Equal(t, int64(1000), *lineItem.PriceData.UnitAmount)
	require.Equal(t, int64(1), *lineItem.Quantity)
}

func TestCNYTopupAmountIsOneToOne(t *testing.T) {
	generalSetting := operation_setting.GetGeneralSetting()
	originalDisplayType := generalSetting.QuotaDisplayType
	originalPrice := operation_setting.Price
	originalDiscounts := operation_setting.GetPaymentSetting().AmountDiscount
	originalTopupGroupRatio := common.TopupGroupRatio2JSONString()
	t.Cleanup(func() {
		generalSetting.QuotaDisplayType = originalDisplayType
		operation_setting.Price = originalPrice
		operation_setting.GetPaymentSetting().AmountDiscount = originalDiscounts
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(originalTopupGroupRatio))
	})

	generalSetting.QuotaDisplayType = operation_setting.QuotaDisplayTypeCNY
	operation_setting.Price = 7.3
	operation_setting.GetPaymentSetting().AmountDiscount = map[int]float64{}
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"default":1}`))

	require.InDelta(t, 10, getPayMoney(10, "default"), 0.000001)
	require.Equal(t, int64(10*common.QuotaPerUnit), getTopupCreditedQuota(10))
}
