/*
Copyright (C) 2023-2026 QuantumNous

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
import {
  formatLocalCurrencyAmount,
  formatQuotaWithCurrency,
} from '@/lib/currency'
import { DEFAULT_DISCOUNT_RATE } from '../constants'
import type { TopupInputUnit } from '../types'

// ============================================================================
// Wallet-specific Formatting Functions
// ============================================================================

/**
 * Format Creem price with currency symbol (USD/EUR)
 */
export function formatCreemPrice(
  price: number,
  currency: 'USD' | 'EUR'
): string {
  const symbol = currency === 'EUR' ? '€' : '$'
  return `${symbol}${price.toFixed(2)}`
}

/**
 * Format large quota numbers with K/M suffix
 */
export function formatQuotaShort(quota: number): string {
  if (quota >= 1000000) {
    return `${(quota / 1000000).toFixed(1)}M`
  }
  if (quota >= 1000) {
    return `${(quota / 1000).toFixed(1)}K`
  }
  return quota.toString()
}

/**
 * Format currency amount that is already in local currency.
 * This is used for payment amounts that have been calculated via priceRatio.
 */
export function formatPaymentAmount(
  amount: number | string,
  currency?: string
): string {
  const numeric =
    typeof amount === 'number' ? amount : Number.parseFloat(String(amount))
  if (!Number.isFinite(numeric)) return '-'

  const normalizedCurrency = currency?.trim().toUpperCase()
  if (normalizedCurrency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: normalizedCurrency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: Math.abs(numeric) >= 1 ? 2 : 4,
      }).format(numeric)
    } catch {
      // Fall through for gateway-specific currency strings that are not ISO.
    }
  }

  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(numeric) >= 1 ? 2 : 4,
  }).format(numeric)
  return normalizedCurrency ? `${formatted} ${normalizedCurrency}` : formatted
}

/**
 * Format the amount of wallet credit represented by a top-up request.
 * The amount uses the backend-declared input unit. CNY is a 1:1 wallet
 * denomination, so ¥10 is formatted directly without exchange conversion.
 */
export function formatTopupCreditAmount(
  amount: number,
  inputUnit: TopupInputUnit
): string {
  const options = {
    digitsLarge: 2,
    digitsSmall: 2,
    abbreviate: false,
  }

  if (inputUnit === 'TOKENS') {
    return formatQuotaWithCurrency(amount, options)
  }
  if (inputUnit === 'CNY') {
    return formatPaymentAmount(amount, 'CNY')
  }
  if (inputUnit === 'CUSTOM') {
    return formatLocalCurrencyAmount(amount, options)
  }
  return formatPaymentAmount(amount, 'USD')
}

export function getTopupInputUnit(inputUnit: TopupInputUnit): string {
  if (inputUnit === 'TOKENS') return 'Tokens'
  if (inputUnit === 'CUSTOM') return 'Custom Currency'
  return inputUnit
}

/**
 * Get discount label for display (e.g., "20% OFF")
 */
export function getDiscountLabel(discount: number): string {
  if (discount >= DEFAULT_DISCOUNT_RATE) {
    return ''
  }
  const off = Math.round((1 - discount) * 100)
  return `${off}% OFF`
}
