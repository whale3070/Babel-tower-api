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
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getSelf } from '@/lib/api'
import { useSystemConfig } from '@/hooks/use-system-config'
import { SectionPageLayout } from '@/components/layout'
import { AffiliateRewardsCard } from './components/affiliate-rewards-card'
import { BillingHistoryDialog } from './components/dialogs/billing-history-dialog'
import { CreemConfirmDialog } from './components/dialogs/creem-confirm-dialog'
import { PaymentConfirmDialog } from './components/dialogs/payment-confirm-dialog'
import { TransferDialog } from './components/dialogs/transfer-dialog'
import { RechargeFormCard } from './components/recharge-form-card'
import { SubscriptionPlansCard } from './components/subscription-plans-card'
import { WalletStatsCard } from './components/wallet-stats-card'
import { DEFAULT_DISCOUNT_RATE } from './constants'
import {
  useTopupInfo,
  usePayment,
  useAffiliate,
  useRedemption,
  useCreemPayment,
  useWaffoPayment,
  useWaffoPancakePayment,
} from './hooks'
import {
  getAvailablePaymentMethods,
  getMinTopupAmount,
  getPaymentMethodKey,
  getPaymentMethodMinTopup,
  isStripePayment,
  isWaffoPayment,
  isWaffoPancakePayment,
} from './lib'
import type {
  UserWalletData,
  PaymentMethod,
  PresetAmount,
  CreemProduct,
  TopupInputUnit,
} from './types'

interface WalletProps {
  initialShowHistory?: boolean
}

export function Wallet(props: WalletProps) {
  const { t } = useTranslation()
  const [user, setUser] = useState<UserWalletData | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [topupAmount, setTopupAmount] = useState<number | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>()
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [billingDialogOpen, setBillingDialogOpen] = useState(false)
  const [redemptionCode, setRedemptionCode] = useState('')
  const [creemDialogOpen, setCreemDialogOpen] = useState(false)
  const [selectedCreemProduct, setSelectedCreemProduct] =
    useState<CreemProduct | null>(null)
  const [showSubscriptionPanel, setShowSubscriptionPanel] = useState(true)

  const { currency } = useSystemConfig()
  const { topupInfo, presetAmounts, loading: topupLoading } = useTopupInfo()
  const topupInputUnit: TopupInputUnit =
    topupInfo?.topup_input_unit || currency?.quotaDisplayType || 'USD'
  const paymentMethods = useMemo(
    () => getAvailablePaymentMethods(topupInfo),
    [topupInfo]
  )
  const activePaymentMethod = useMemo(() => {
    if (paymentMethods.length === 0) return undefined
    if (!selectedPaymentMethod) return paymentMethods[0]

    const selectedKey = getPaymentMethodKey(selectedPaymentMethod)
    return (
      paymentMethods.find(
        (method) => getPaymentMethodKey(method) === selectedKey
      ) || paymentMethods[0]
    )
  }, [paymentMethods, selectedPaymentMethod])
  const activeTopupAmount =
    topupAmount ?? (topupInfo ? getMinTopupAmount(topupInfo) : 0)
  const {
    amount: paymentAmount,
    calculating,
    quoteError,
    processing,
    calculatePaymentAmount,
    processPayment,
    resetPaymentAmount,
  } = usePayment()
  const {
    affiliateLink,
    loading: affiliateLoading,
    transferQuota,
    transferring,
  } = useAffiliate()
  const { redeeming, redeemCode } = useRedemption()
  const { processing: creemProcessing, processCreemPayment } = useCreemPayment()
  const { processing: waffoProcessing, processWaffoPayment } = useWaffoPayment()
  const { processing: pancakeProcessing, processWaffoPancakePayment } =
    useWaffoPancakePayment()

  // Fetch and refresh user data
  const fetchUser = useCallback(async () => {
    try {
      setUserLoading(true)
      const response = await getSelf()
      if (response.success && response.data) {
        setUser(response.data as UserWalletData)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch user data:', error)
    } finally {
      setUserLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(fetchUser, 0)
    return () => window.clearTimeout(timer)
  }, [fetchUser])

  useEffect(() => {
    if (!props.initialShowHistory) return

    window.history.replaceState({}, '', window.location.pathname)
    const timer = window.setTimeout(() => setBillingDialogOpen(true), 0)
    return () => window.clearTimeout(timer)
  }, [props.initialShowHistory])

  // Keep the visible quote tied to the latest amount and gateway. The hook
  // ignores stale responses if the user changes either before a request ends.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!activePaymentMethod) {
        resetPaymentAmount()
        return
      }

      const minimum = getPaymentMethodMinTopup(topupInfo, activePaymentMethod)
      if (!Number.isFinite(activeTopupAmount) || activeTopupAmount < minimum) {
        resetPaymentAmount()
        return
      }

      calculatePaymentAmount(
        Math.floor(activeTopupAmount),
        activePaymentMethod.type
      )
    }, 250)

    return () => window.clearTimeout(timer)
  }, [
    activeTopupAmount,
    topupInfo,
    activePaymentMethod,
    calculatePaymentAmount,
    resetPaymentAmount,
  ])

  // Handle preset selection
  const handleSelectPreset = (preset: PresetAmount) => {
    resetPaymentAmount()
    setTopupAmount(preset.value)
    setSelectedPreset(preset.value)
  }

  // Handle topup amount change
  const handleTopupAmountChange = (amount: number) => {
    resetPaymentAmount()
    setTopupAmount(amount)
    setSelectedPreset(null)
  }

  // Handle payment method selection
  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    resetPaymentAmount()
    setSelectedPaymentMethod(method)
  }

  const handlePaymentContinue = async () => {
    if (!activePaymentMethod) return

    const minimum = getPaymentMethodMinTopup(topupInfo, activePaymentMethod)
    if (activeTopupAmount < minimum) {
      toast.error(t('Minimum topup amount: {{amount}}', { amount: minimum }))
      return
    }

    const quotedAmount = await calculatePaymentAmount(
      Math.floor(activeTopupAmount),
      activePaymentMethod.type
    )
    if (quotedAmount === null) {
      toast.error(t('Unable to calculate payment amount. Please try again.'))
      return
    }

    setConfirmDialogOpen(true)
  }

  // Handle payment confirmation
  const handlePaymentConfirm = async () => {
    if (!activePaymentMethod) return

    const isWaffo = isWaffoPayment(activePaymentMethod.type)
    const isPancake = isWaffoPancakePayment(activePaymentMethod.type)
    const success = isWaffo
      ? await processWaffoPayment(
          activeTopupAmount,
          activePaymentMethod.waffo_index
        )
      : isPancake
        ? await processWaffoPancakePayment(activeTopupAmount)
        : await processPayment(activeTopupAmount, activePaymentMethod.type)

    if (success) {
      setConfirmDialogOpen(false)
      await fetchUser()
    }
  }

  // Handle redemption
  const handleRedeem = async () => {
    if (!redemptionCode) return

    const success = await redeemCode(redemptionCode)
    if (success) {
      setRedemptionCode('')
      await fetchUser()
    }
  }

  // Handle transfer
  const handleTransfer = async (amount: number) => {
    const success = await transferQuota(amount)
    if (success) {
      await fetchUser()
    }
    return success
  }

  // Handle Creem product selection
  const handleCreemProductSelect = (product: CreemProduct) => {
    setSelectedCreemProduct(product)
    setCreemDialogOpen(true)
  }

  // Handle Creem payment confirmation
  const handleCreemConfirm = async () => {
    if (!selectedCreemProduct) return

    const success = await processCreemPayment(selectedCreemProduct.productId)
    if (success) {
      setCreemDialogOpen(false)
      setSelectedCreemProduct(null)
      await fetchUser()
    }
  }

  // Get discount rate for current topup amount
  const getDiscountRate = useCallback(() => {
    if (isStripePayment(activePaymentMethod?.type || '')) {
      return DEFAULT_DISCOUNT_RATE
    }
    return topupInfo?.discount?.[activeTopupAmount] || DEFAULT_DISCOUNT_RATE
  }, [topupInfo, activeTopupAmount, activePaymentMethod])

  const handleSubscriptionAvailabilityChange = useCallback(
    (available: boolean) => {
      setShowSubscriptionPanel(available)
    },
    []
  )

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Wallet')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
            <WalletStatsCard user={user} loading={userLoading} />

            <div
              className={
                showSubscriptionPanel
                  ? 'grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] xl:items-start'
                  : 'grid gap-4'
              }
            >
              <div id='wallet-add-funds' className='scroll-mt-4'>
                <RechargeFormCard
                  topupInfo={topupInfo}
                  presetAmounts={presetAmounts}
                  selectedPreset={selectedPreset}
                  onSelectPreset={handleSelectPreset}
                  topupAmount={activeTopupAmount}
                  onTopupAmountChange={handleTopupAmountChange}
                  paymentAmount={paymentAmount}
                  calculating={calculating}
                  quoteError={quoteError}
                  paymentMethods={paymentMethods}
                  selectedPaymentMethod={activePaymentMethod}
                  onPaymentMethodSelect={handlePaymentMethodSelect}
                  onContinue={handlePaymentContinue}
                  redemptionCode={redemptionCode}
                  onRedemptionCodeChange={setRedemptionCode}
                  onRedeem={handleRedeem}
                  redeeming={redeeming}
                  topupLink={topupInfo?.topup_link}
                  loading={topupLoading}
                  topupInputUnit={topupInputUnit}
                  onOpenBilling={() => setBillingDialogOpen(true)}
                  creemProducts={topupInfo?.creem_products}
                  enableCreemTopup={topupInfo?.enable_creem_topup}
                  onCreemProductSelect={handleCreemProductSelect}
                />
              </div>

              <SubscriptionPlansCard
                topupInfo={topupInfo}
                onAvailabilityChange={handleSubscriptionAvailabilityChange}
                userQuota={user?.quota}
                onPurchaseSuccess={fetchUser}
              />
            </div>

            <AffiliateRewardsCard
              user={user}
              affiliateLink={affiliateLink}
              onTransfer={() => setTransferDialogOpen(true)}
              complianceConfirmed={
                topupInfo?.payment_compliance_confirmed !== false
              }
              loading={affiliateLoading}
            />
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <PaymentConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handlePaymentConfirm}
        topupAmount={activeTopupAmount}
        paymentAmount={paymentAmount}
        paymentMethod={activePaymentMethod}
        calculating={calculating}
        processing={processing || pancakeProcessing || waffoProcessing}
        discountRate={getDiscountRate()}
        topupInputUnit={topupInputUnit}
      />

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onConfirm={handleTransfer}
        availableQuota={user?.aff_quota ?? 0}
        transferring={transferring}
      />

      <BillingHistoryDialog
        open={billingDialogOpen}
        onOpenChange={setBillingDialogOpen}
      />

      <CreemConfirmDialog
        open={creemDialogOpen}
        onOpenChange={setCreemDialogOpen}
        onConfirm={handleCreemConfirm}
        product={selectedCreemProduct}
        processing={creemProcessing}
      />
    </>
  )
}
