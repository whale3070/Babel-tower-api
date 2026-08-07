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
import { ExternalLink, Gift, Loader2, Receipt, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  formatPaymentAmount,
  formatTopupCreditAmount,
  getDiscountLabel,
  getPaymentIcon,
  getPaymentMethodKey,
  getPaymentMethodMinTopup,
  getTopupInputUnit,
  isStripePayment,
} from '../lib'
import type {
  CreemProduct,
  PaymentMethod,
  PresetAmount,
  TopupInputUnit,
  TopupInfo,
} from '../types'
import { CreemProductsSection } from './creem-products-section'

interface RechargeFormCardProps {
  topupInfo: TopupInfo | null
  presetAmounts: PresetAmount[]
  selectedPreset: number | null
  onSelectPreset: (preset: PresetAmount) => void
  topupAmount: number
  onTopupAmountChange: (amount: number) => void
  paymentAmount: number | null
  calculating: boolean
  quoteError: boolean
  paymentMethods: PaymentMethod[]
  selectedPaymentMethod: PaymentMethod | undefined
  onPaymentMethodSelect: (method: PaymentMethod) => void
  onContinue: () => void
  redemptionCode: string
  onRedemptionCodeChange: (code: string) => void
  onRedeem: () => void
  redeeming: boolean
  topupInputUnit: TopupInputUnit
  topupLink?: string
  loading?: boolean
  onOpenBilling?: () => void
  creemProducts?: CreemProduct[]
  enableCreemTopup?: boolean
  onCreemProductSelect?: (product: CreemProduct) => void
}

export function RechargeFormCard({
  topupInfo,
  presetAmounts,
  selectedPreset,
  onSelectPreset,
  topupAmount,
  onTopupAmountChange,
  paymentAmount,
  calculating,
  quoteError,
  paymentMethods,
  selectedPaymentMethod,
  onPaymentMethodSelect,
  onContinue,
  redemptionCode,
  onRedemptionCodeChange,
  onRedeem,
  redeeming,
  topupInputUnit,
  topupLink,
  loading,
  onOpenBilling,
  creemProducts,
  enableCreemTopup,
  onCreemProductSelect,
}: RechargeFormCardProps) {
  const { t } = useTranslation()

  const handleAmountChange = (value: string) => {
    const numericValue = Number(value)
    onTopupAmountChange(
      Number.isFinite(numericValue) && numericValue >= 0
        ? Math.floor(numericValue)
        : 0
    )
  }

  const hasConfigurableTopup = paymentMethods.length > 0
  const hasAnyTopup = hasConfigurableTopup || enableCreemTopup
  const redemptionEnabled = topupInfo?.enable_redemption !== false
  const selectedPaymentKey = selectedPaymentMethod
    ? getPaymentMethodKey(selectedPaymentMethod)
    : ''
  const selectedMinimum = getPaymentMethodMinTopup(
    topupInfo,
    selectedPaymentMethod
  )
  const amountBelowMinimum = topupAmount < selectedMinimum
  const creditAmount = formatTopupCreditAmount(topupAmount, topupInputUnit)
  const inputUnit = getTopupInputUnit(topupInputUnit)

  if (loading) {
    return (
      <Card className='gap-0 overflow-hidden py-0'>
        <CardHeader className='border-b p-3 !pb-3 sm:p-5 sm:!pb-5'>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
        </CardHeader>
        <CardContent className='flex flex-col gap-4 p-3 sm:gap-6 sm:p-5'>
          <div className='flex flex-col gap-3'>
            <Skeleton className='h-3 w-16' />
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className='h-[72px] rounded-lg' />
              ))}
            </div>
          </div>
          <Skeleton className='h-10 w-full' />
          <div className='grid grid-cols-2 gap-3 lg:grid-cols-3'>
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className='h-10 rounded-lg' />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <TitledCard
      title={t('Add Funds')}
      description={t('Choose an amount and payment method')}
      icon={<WalletCards />}
      action={
        onOpenBilling ? (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={onOpenBilling}
            className='w-full sm:w-auto'
          >
            <Receipt data-icon='inline-start' />
            {t('Order History')}
          </Button>
        ) : null
      }
      contentClassName='flex flex-col gap-4 sm:gap-6'
    >
      {hasConfigurableTopup && (
        <FieldGroup>
          {presetAmounts.length > 0 && (
            <FieldSet>
              <FieldLegend variant='label'>{t('Credit amount')}</FieldLegend>
              <div className='grid grid-cols-2 gap-1.5 sm:gap-3 md:grid-cols-4'>
                {presetAmounts.map((preset) => {
                  const discount =
                    preset.discount || topupInfo?.discount?.[preset.value] || 1
                  const hasDiscount =
                    !isStripePayment(selectedPaymentMethod?.type || '') &&
                    discount > 0 &&
                    discount < 1

                  return (
                    <Button
                      key={preset.value}
                      type='button'
                      variant={
                        selectedPreset === preset.value
                          ? 'secondary'
                          : 'outline'
                      }
                      className='flex min-h-16 flex-col items-start rounded-lg px-3 py-2.5 text-left whitespace-normal sm:min-h-[72px] sm:p-4'
                      onClick={() => onSelectPreset(preset)}
                    >
                      <span className='flex w-full items-center justify-between gap-2'>
                        <span className='text-base font-semibold sm:text-lg'>
                          {formatTopupCreditAmount(
                            preset.value,
                            topupInputUnit
                          )}
                        </span>
                        {hasDiscount && (
                          <Badge variant='secondary'>
                            {getDiscountLabel(discount)}
                          </Badge>
                        )}
                      </span>
                      <span className='text-muted-foreground text-xs'>
                        {t('Amount you receive')}
                      </span>
                    </Button>
                  )
                })}
              </div>
            </FieldSet>
          )}

          <Field data-invalid={amountBelowMinimum || undefined}>
            <FieldLabel htmlFor='topup-amount'>{t('Custom Amount')}</FieldLabel>
            <InputGroup className='h-10'>
              <InputGroupInput
                id='topup-amount'
                type='number'
                inputMode='numeric'
                step={1}
                min={selectedMinimum}
                value={topupAmount || ''}
                onChange={(event) => handleAmountChange(event.target.value)}
                aria-invalid={amountBelowMinimum || undefined}
              />
              <InputGroupAddon align='inline-end'>
                <InputGroupText>{t(inputUnit)}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>
              {t('Minimum for {{method}}: {{amount}}', {
                method: selectedPaymentMethod?.name || t('Payment Method'),
                amount: formatTopupCreditAmount(
                  selectedMinimum,
                  topupInputUnit
                ),
              })}
            </FieldDescription>
          </Field>

          <FieldSet>
            <FieldLegend variant='label'>{t('Payment Method')}</FieldLegend>
            <ToggleGroup
              value={selectedPaymentKey ? [selectedPaymentKey] : []}
              onValueChange={(values) => {
                const method = paymentMethods.find(
                  (item) => getPaymentMethodKey(item) === values[0]
                )
                if (method) onPaymentMethodSelect(method)
              }}
              variant='outline'
              spacing={2}
              className='grid w-full grid-cols-2 gap-1.5 sm:gap-3 lg:grid-cols-3'
              aria-label={t('Select a payment method')}
            >
              {paymentMethods.map((method) => {
                const minimum = getPaymentMethodMinTopup(topupInfo, method)
                const disabled = topupAmount < minimum
                const key = getPaymentMethodKey(method)

                return (
                  <ToggleGroupItem
                    key={key}
                    value={key}
                    disabled={disabled}
                    title={
                      disabled
                        ? t('Minimum topup amount: {{amount}}', {
                            amount: formatTopupCreditAmount(
                              minimum,
                              topupInputUnit
                            ),
                          })
                        : undefined
                    }
                    className='h-10 min-w-0 justify-start rounded-lg px-3'
                  >
                    {getPaymentIcon(
                      method.type,
                      undefined,
                      method.icon,
                      method.name
                    )}
                    <span className='truncate'>{method.name}</span>
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
          </FieldSet>

          <Alert>
            <AlertTitle>{t('Payment summary')}</AlertTitle>
            <AlertDescription className='flex flex-col gap-2'>
              <span className='flex items-center justify-between gap-4'>
                <span>{t('Amount you receive')}</span>
                <span className='text-foreground font-semibold'>
                  {creditAmount}
                </span>
              </span>
              <span className='flex items-center justify-between gap-4'>
                <span>{t('Actual payment')}</span>
                {calculating ||
                (!quoteError &&
                  paymentAmount === null &&
                  !!selectedPaymentMethod &&
                  !amountBelowMinimum) ? (
                  <Skeleton className='h-5 w-20' />
                ) : (
                  <span className='text-foreground font-semibold'>
                    {paymentAmount === null
                      ? t('Payment amount unavailable')
                      : formatPaymentAmount(
                          paymentAmount,
                          selectedPaymentMethod?.currency
                        )}
                  </span>
                )}
              </span>
              <span className='text-xs'>
                {t('Calculated by the server for {{method}}', {
                  method: selectedPaymentMethod?.name || t('Payment Method'),
                })}
              </span>
            </AlertDescription>
          </Alert>

          <Button
            type='button'
            onClick={onContinue}
            disabled={
              !selectedPaymentMethod ||
              amountBelowMinimum ||
              calculating ||
              paymentAmount === null
            }
            className='w-full'
          >
            {calculating && (
              <Loader2 data-icon='inline-start' className='animate-spin' />
            )}
            {t('Continue to payment')}
          </Button>
        </FieldGroup>
      )}

      {!hasAnyTopup && (
        <Alert>
          <AlertDescription>
            {t(
              'Online topup is not enabled. Please use redemption code or contact administrator.'
            )}
          </AlertDescription>
        </Alert>
      )}

      {enableCreemTopup &&
        Array.isArray(creemProducts) &&
        creemProducts.length > 0 &&
        onCreemProductSelect && (
          <>
            <Separator />
            <FieldSet>
              <FieldLegend variant='label'>{t('Creem Payment')}</FieldLegend>
              <CreemProductsSection
                products={creemProducts}
                onProductSelect={onCreemProductSelect}
              />
            </FieldSet>
          </>
        )}

      <Separator />
      {redemptionEnabled ? (
        <Field>
          <FieldLabel htmlFor='redemption-code'>
            <Gift />
            {t('Have a Code?')}
          </FieldLabel>
          <InputGroup className='h-10'>
            <InputGroupInput
              id='redemption-code'
              value={redemptionCode}
              onChange={(event) => onRedemptionCodeChange(event.target.value)}
              placeholder={t('Enter your redemption code')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && redemptionCode && !redeeming) {
                  onRedeem()
                }
              }}
            />
            <InputGroupAddon align='inline-end'>
              <Button
                type='button'
                size='sm'
                variant='ghost'
                onClick={onRedeem}
                disabled={!redemptionCode || redeeming}
              >
                {redeeming && (
                  <Loader2 data-icon='inline-start' className='animate-spin' />
                )}
                {t('Redeem')}
              </Button>
            </InputGroupAddon>
          </InputGroup>
          {topupLink && (
            <FieldDescription>
              {t('Need a redemption code?')}{' '}
              <a href={topupLink} target='_blank' rel='noopener noreferrer'>
                {t('Get one here')}
                <ExternalLink className='ml-1 inline size-3' />
              </a>
            </FieldDescription>
          )}
        </Field>
      ) : (
        <Alert>
          <AlertDescription>
            {t(
              'Redemption codes are disabled until the administrator confirms compliance terms.'
            )}
          </AlertDescription>
        </Alert>
      )}
    </TitledCard>
  )
}
