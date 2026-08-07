/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const numeric =
    typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(numeric) ? numeric : null;
};

export const resolveTopupCreditedQuota = (
  amount,
  quotaDisplayType,
  quotaPerUnit,
) => {
  const numericAmount = toFiniteNumber(amount);
  if (numericAmount === null) return null;

  return quotaDisplayType === 'TOKENS'
    ? numericAmount
    : numericAmount * quotaPerUnit;
};

export const formatPaymentAmount = (amount, currency) => {
  const numericAmount = toFiniteNumber(amount);
  if (numericAmount === null) return '-';

  const normalizedCurrency = currency?.trim().toUpperCase();
  if (normalizedCurrency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: normalizedCurrency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: Math.abs(numericAmount) >= 1 ? 2 : 4,
      }).format(numericAmount);
    } catch {
      // Fall through for gateway-specific, non-ISO currency strings.
    }
  }

  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(numericAmount) >= 1 ? 2 : 4,
  }).format(numericAmount);

  return normalizedCurrency ? `${formatted} ${normalizedCurrency}` : formatted;
};

export const normalizeTopupInputUnit = (inputUnit) => {
  const normalized = inputUnit?.trim().toUpperCase();
  return ['USD', 'CNY', 'TOKENS', 'CUSTOM'].includes(normalized)
    ? normalized
    : 'USD';
};

// Top-up amount endpoints accept the configured display unit. CNY is
// intentionally denominated 1:1, so 10 means ¥10 without exchange conversion.
export const formatTopupInputAmount = (amount, inputUnit) => {
  const numericAmount = toFiniteNumber(amount);
  if (numericAmount === null) return '-';

  const normalizedUnit = normalizeTopupInputUnit(inputUnit);
  if (normalizedUnit === 'TOKENS') {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 0,
    }).format(numericAmount);
  }

  return formatPaymentAmount(
    numericAmount,
    normalizedUnit === 'CUSTOM' ? undefined : normalizedUnit,
  );
};

export const getActualPaymentAmount = (record) => {
  const paymentAmount = toFiniteNumber(record?.payment_amount);
  if (paymentAmount !== null && paymentAmount > 0) {
    return paymentAmount;
  }

  if (
    record?.payment_provider === 'stripe' ||
    record?.payment_method === 'stripe'
  ) {
    return null;
  }

  const legacyAmount = toFiniteNumber(record?.money);
  return legacyAmount !== null && legacyAmount > 0 ? legacyAmount : null;
};

export const resolveTopupRecordCreditedQuota = (record, quotaPerUnit) => {
  const creditedQuota = toFiniteNumber(record?.credited_quota);
  if (creditedQuota !== null && creditedQuota > 0) {
    return creditedQuota;
  }

  if (
    record?.payment_provider === 'creem' ||
    record?.payment_method === 'creem'
  ) {
    return toFiniteNumber(record?.amount);
  }

  const legacyUsdAmount =
    record?.payment_provider === 'stripe' || record?.payment_method === 'stripe'
      ? toFiniteNumber(record?.money)
      : toFiniteNumber(record?.amount);

  return legacyUsdAmount === null ? null : legacyUsdAmount * quotaPerUnit;
};
