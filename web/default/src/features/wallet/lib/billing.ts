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
import { formatCurrencyFromUSD, formatQuotaWithCurrency } from '@/lib/currency'
import { formatTimestampToDate } from '@/lib/format'
import type { StatusBadgeProps } from '@/components/status-badge'
import type { TopupRecord, TopupStatus } from '../types'

// ============================================================================
// Billing Utility Functions
// ============================================================================

interface StatusConfig {
  variant: StatusBadgeProps['variant']
  label: string
}

/**
 * Status badge configuration
 */
export const STATUS_CONFIG: Record<TopupStatus, StatusConfig> = {
  success: {
    variant: 'success',
    label: 'Success',
  },
  pending: {
    variant: 'warning',
    label: 'Pending',
  },
  expired: {
    variant: 'danger',
    label: 'Expired',
  },
  failed: {
    variant: 'danger',
    label: 'Failed',
  },
  canceled: {
    variant: 'neutral',
    label: 'Canceled',
  },
  cancelled: {
    variant: 'neutral',
    label: 'Canceled',
  },
}

/**
 * Get status badge configuration
 */
export function getStatusConfig(status: TopupStatus): StatusConfig {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending
}

/**
 * Payment method display names
 */
export const PAYMENT_METHOD_NAMES: Record<string, string> = {
  stripe: 'Stripe',
  alipay: 'Alipay',
  wxpay: 'WeChat Pay',
  waffo: 'Waffo',
  waffo_pancake: 'Waffo Pancake',
  usdt: 'USDT',
}

/**
 * Get payment method display name
 */
export function getPaymentMethodName(
  method: string,
  t?: (key: string) => string
): string {
  const name = PAYMENT_METHOD_NAMES[method] || method
  return t ? t(name) : name
}

/**
 * Format timestamp to readable date string
 */
export function formatTimestamp(timestamp: number): string {
  return formatTimestampToDate(timestamp)
}

/**
 * New orders persist an explicit payment snapshot. Legacy non-Stripe orders
 * used `money` for the same value; legacy Stripe orders used it for credited
 * quota and therefore cannot be presented as an actual payment safely.
 */
export function getActualPaymentAmount(record: TopupRecord): number | null {
  if (
    typeof record.payment_amount === 'number' &&
    Number.isFinite(record.payment_amount) &&
    record.payment_amount > 0
  ) {
    return record.payment_amount
  }

  if (
    record.payment_provider === 'stripe' ||
    record.payment_method === 'stripe'
  ) {
    return null
  }

  return Number.isFinite(record.money) && record.money > 0 ? record.money : null
}

export function formatTopupRecordCredit(record: TopupRecord): string {
  const options = {
    digitsLarge: 2,
    digitsSmall: 2,
    abbreviate: false,
  }

  if (
    typeof record.credited_quota === 'number' &&
    Number.isFinite(record.credited_quota) &&
    record.credited_quota > 0
  ) {
    return formatQuotaWithCurrency(record.credited_quota, options)
  }

  if (
    record.payment_provider === 'creem' ||
    record.payment_method === 'creem'
  ) {
    return formatQuotaWithCurrency(record.amount, options)
  }

  if (
    record.payment_provider === 'stripe' ||
    record.payment_method === 'stripe'
  ) {
    return formatCurrencyFromUSD(record.money, options)
  }

  return formatCurrencyFromUSD(record.amount, options)
}
