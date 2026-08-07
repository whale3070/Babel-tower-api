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
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_DISCOUNT_RATE } from '../../constants'
import {
  formatPaymentAmount,
  formatTopupCreditAmount,
  getPaymentIcon,
} from '../../lib'
import type { PaymentMethod, TopupInputUnit } from '../../types'

interface PaymentConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  topupAmount: number
  paymentAmount: number | null
  paymentMethod: PaymentMethod | undefined
  calculating: boolean
  processing: boolean
  discountRate?: number
  topupInputUnit: TopupInputUnit
}

export function PaymentConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  topupAmount,
  paymentAmount,
  paymentMethod,
  calculating,
  processing,
  discountRate = DEFAULT_DISCOUNT_RATE,
  topupInputUnit,
}: PaymentConfirmDialogProps) {
  const { t } = useTranslation()
  const hasDiscount =
    discountRate > 0 &&
    discountRate < 1 &&
    paymentAmount !== null &&
    paymentAmount > 0
  const originalAmount =
    hasDiscount && paymentAmount !== null ? paymentAmount / discountRate : 0
  const discountAmount =
    hasDiscount && paymentAmount !== null ? originalAmount - paymentAmount : 0

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Confirm Payment')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('Review your payment details')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className='flex flex-col gap-3 py-3 sm:gap-4 sm:py-4'>
          <div className='flex items-center justify-between gap-4'>
            <span className='text-muted-foreground text-sm'>
              {t('Amount you receive')}
            </span>
            <span className='text-lg font-semibold'>
              {formatTopupCreditAmount(topupAmount, topupInputUnit)}
            </span>
          </div>

          <div className='flex items-center justify-between gap-4'>
            <span className='text-muted-foreground text-sm'>
              {t('Actual payment')}
            </span>
            {calculating ? (
              <Skeleton className='h-6 w-24' />
            ) : paymentAmount === null ? (
              <span className='text-destructive text-sm font-medium'>
                {t('Payment amount unavailable')}
              </span>
            ) : (
              <div className='flex items-baseline gap-2'>
                <span className='text-2xl font-semibold'>
                  {formatPaymentAmount(paymentAmount, paymentMethod?.currency)}
                </span>
                {hasDiscount && (
                  <span className='text-muted-foreground text-sm line-through'>
                    {formatPaymentAmount(
                      originalAmount,
                      paymentMethod?.currency
                    )}
                  </span>
                )}
              </div>
            )}
          </div>

          {hasDiscount && !calculating && (
            <div className='flex items-center justify-between text-sm'>
              <span className='text-muted-foreground'>{t('You save')}</span>
              <span className='font-semibold'>
                {formatPaymentAmount(discountAmount, paymentMethod?.currency)}
              </span>
            </div>
          )}

          <Separator />
          <div className='flex items-center justify-between gap-4'>
            <span className='text-muted-foreground text-sm'>
              {t('Payment Method')}
            </span>
            <div className='flex min-w-0 items-center gap-2'>
              {getPaymentIcon(
                paymentMethod?.type,
                undefined,
                paymentMethod?.icon,
                paymentMethod?.name
              )}
              <span className='truncate font-medium'>
                {paymentMethod?.name || '-'}
              </span>
            </div>
          </div>
        </div>

        <AlertDialogFooter className='grid grid-cols-2 gap-2 sm:flex'>
          <AlertDialogCancel disabled={processing}>
            {t('Cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={processing || calculating || paymentAmount === null}
          >
            {processing && (
              <Loader2 data-icon='inline-start' className='animate-spin' />
            )}
            {t('Confirm Payment')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
