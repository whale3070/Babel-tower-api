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
  PAYMENT_TYPES,
  DEFAULT_PRESET_MULTIPLIERS,
  DEFAULT_PAYMENT_TYPE,
  DEFAULT_MIN_TOPUP,
} from '../constants'
import type { PaymentMethod, PresetAmount, TopupInfo } from '../types'

// ============================================================================
// Payment Processing Functions
// ============================================================================

/**
 * Check if browser is Safari
 */
function isSafariBrowser(): boolean {
  return (
    navigator.userAgent.indexOf('Safari') > -1 &&
    navigator.userAgent.indexOf('Chrome') < 1
  )
}

/**
 * Submit payment form (for non-Stripe payments)
 */
export function submitPaymentForm(
  url: string,
  params: Record<string, unknown>
): void {
  const form = document.createElement('form')
  form.action = url
  form.method = 'POST'

  // Don't open in new tab for Safari
  if (!isSafariBrowser()) {
    form.target = '_blank'
  }

  // Add form parameters
  Object.entries(params).forEach(([key, value]) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = key
    input.value = String(value)
    form.appendChild(input)
  })

  document.body.appendChild(form)
  form.submit()
  document.body.removeChild(form)
}

/**
 * Check if payment method is Stripe
 */
export function isStripePayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.STRIPE
}

/**
 * Check if payment method is Waffo
 */
export function isWaffoPayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.WAFFO
}

/**
 * Check if payment method is Waffo Pancake
 *
 * Pancake is a metered-style payment that goes through a dedicated checkout
 * URL flow rather than the generic epay form submission, so it must be
 * special-cased in payment dispatch logic.
 */
export function isWaffoPancakePayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.WAFFO_PANCAKE
}

/**
 * Get default payment type from topup info
 */
export function getDefaultPaymentType(topupInfo: TopupInfo | null): string {
  return getAvailablePaymentMethods(topupInfo)[0]?.type || DEFAULT_PAYMENT_TYPE
}

/**
 * Return one stable key per selectable payment option.
 */
export function getPaymentMethodKey(method: PaymentMethod): string {
  return method.id || `${method.type}:${method.waffo_index ?? 'default'}`
}

/**
 * Merge standard gateways and Waffo's provider-specific methods into the
 * single list rendered by the wallet.
 */
export function getAvailablePaymentMethods(
  topupInfo: TopupInfo | null
): PaymentMethod[] {
  if (!topupInfo) return []

  const methods = [...(topupInfo.pay_methods || [])]

  if (topupInfo.enable_waffo_topup) {
    const waffoMethods = topupInfo.waffo_pay_methods || []
    if (waffoMethods.length > 0) {
      methods.push(
        ...waffoMethods.map((method, index) => ({
          id: `${PAYMENT_TYPES.WAFFO}:${index}`,
          name: method.name,
          type: PAYMENT_TYPES.WAFFO,
          icon: method.icon,
          currency: topupInfo.waffo_currency || 'USD',
          min_topup: topupInfo.waffo_min_topup,
          waffo_index: index,
        }))
      )
    } else {
      methods.push({
        id: `${PAYMENT_TYPES.WAFFO}:default`,
        name: 'Waffo (Global Payment)',
        type: PAYMENT_TYPES.WAFFO,
        currency: topupInfo.waffo_currency || 'USD',
        min_topup: topupInfo.waffo_min_topup,
      })
    }
  }

  const seen = new Set<string>()
  return methods.filter((method) => {
    const key = getPaymentMethodKey(method)
    if (!method.name || !method.type || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Get the server-provided minimum for a specific payment method.
 */
export function getPaymentMethodMinTopup(
  topupInfo: TopupInfo | null,
  method: PaymentMethod | undefined
): number {
  if (!topupInfo || !method) return DEFAULT_MIN_TOPUP
  if (method.min_topup && method.min_topup > 0) return method.min_topup

  switch (method.type) {
    case PAYMENT_TYPES.STRIPE:
      return topupInfo.stripe_min_topup || DEFAULT_MIN_TOPUP
    case PAYMENT_TYPES.WAFFO:
      return topupInfo.waffo_min_topup || DEFAULT_MIN_TOPUP
    case PAYMENT_TYPES.WAFFO_PANCAKE:
      return topupInfo.waffo_pancake_min_topup || DEFAULT_MIN_TOPUP
    default:
      return topupInfo.min_topup || DEFAULT_MIN_TOPUP
  }
}

/**
 * Get minimum topup amount from topup info
 */
export function getMinTopupAmount(topupInfo: TopupInfo | null): number {
  const minimums = getAvailablePaymentMethods(topupInfo)
    .map((method) => getPaymentMethodMinTopup(topupInfo, method))
    .filter((minimum) => Number.isFinite(minimum) && minimum > 0)

  return minimums.length > 0 ? Math.min(...minimums) : DEFAULT_MIN_TOPUP
}

/**
 * Generate preset amounts based on minimum topup
 */
export function generatePresetAmounts(minAmount: number): PresetAmount[] {
  return DEFAULT_PRESET_MULTIPLIERS.map((multiplier) => ({
    value: minAmount * multiplier,
  }))
}

/**
 * Merge custom preset amounts with discounts
 */
export function mergePresetAmounts(
  amountOptions: number[],
  discounts: Record<number, number>
): PresetAmount[] {
  if (!amountOptions || amountOptions.length === 0) {
    return []
  }

  return amountOptions.map((amount) => ({
    value: amount,
    discount: discounts[amount] || 1.0,
  }))
}
