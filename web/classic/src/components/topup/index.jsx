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

import React, { useEffect, useState, useContext, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  renderQuota,
  copy,
  getQuotaPerUnit,
} from '../../helpers';
import { Modal, Toast } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';

import RechargeCard from './RechargeCard';
import InvitationCard from './InvitationCard';
import TransferModal from './modals/TransferModal';
import PaymentConfirmModal from './modals/PaymentConfirmModal';
import TopupHistoryModal from './modals/TopupHistoryModal';
import {
  formatPaymentAmount,
  normalizeTopupInputUnit,
} from './payment-display';

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseDiscountMap = (value) => {
  if (!value) return {};

  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return {};
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  return Object.entries(parsed).reduce((result, [key, item]) => {
    const numericKey = Number(key);
    const numericValue = Number(item);
    if (
      Number.isFinite(numericKey) &&
      numericKey > 0 &&
      Number.isFinite(numericValue) &&
      numericValue > 0
    ) {
      result[numericKey] = numericValue;
    }
    return result;
  }, {});
};

// Reject non-navigable schemes (e.g. javascript:, data:) and relative URLs.
// Only http / https are allowed for backend-provided redirect targets.
// Mirrors isSafeHttpCheckoutUrl in the default frontend's
// features/wallet/hooks/use-waffo-pancake-payment.ts.
function isSafeHttpCheckoutUrl(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return false;
  }
  try {
    const u = new URL(trimmed);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const TopUp = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);

  const [redemptionCode, setRedemptionCode] = useState('');
  const [amount, setAmount] = useState(null);
  const [minTopUp, setMinTopUp] = useState(statusState?.status?.min_topup || 1);
  const [topUpCount, setTopUpCount] = useState(
    statusState?.status?.min_topup || 1,
  );
  const [topUpLink, setTopUpLink] = useState('');
  const [enableOnlineTopUp, setEnableOnlineTopUp] = useState(
    statusState?.status?.enable_online_topup || false,
  );
  const [enableStripeTopUp, setEnableStripeTopUp] = useState(
    statusState?.status?.enable_stripe_topup || false,
  );
  const [statusLoading, setStatusLoading] = useState(true);

  // Creem 相关状态
  const [creemProducts, setCreemProducts] = useState([]);
  const [enableCreemTopUp, setEnableCreemTopUp] = useState(false);
  const [creemOpen, setCreemOpen] = useState(false);
  const [selectedCreemProduct, setSelectedCreemProduct] = useState(null);

  // Waffo 相关状态
  const [enableWaffoTopUp, setEnableWaffoTopUp] = useState(false);
  const [waffoPayMethods, setWaffoPayMethods] = useState([]);
  const [waffoMinTopUp, setWaffoMinTopUp] = useState(1);
  const [enableWaffoPancakeTopUp, setEnableWaffoPancakeTopUp] = useState(false);
  const [waffoPancakeMinTopUp, setWaffoPancakeMinTopUp] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [payWay, setPayWay] = useState('');
  const [amountLoading, setAmountLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [payMethods, setPayMethods] = useState([]);

  const affFetchedRef = useRef(false);

  // 邀请相关状态
  const [affLink, setAffLink] = useState('');
  const [openTransfer, setOpenTransfer] = useState(false);
  const [transferAmount, setTransferAmount] = useState(0);

  // 账单Modal状态
  const [openHistory, setOpenHistory] = useState(false);

  // 订阅相关
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [billingPreference, setBillingPreference] =
    useState('subscription_first');
  const [activeSubscriptions, setActiveSubscriptions] = useState([]);
  const [allSubscriptions, setAllSubscriptions] = useState([]);

  // 预设充值额度选项
  const [presetAmounts, setPresetAmounts] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);

  // 充值配置信息
  const [topupInfo, setTopupInfo] = useState({
    amount_options: [],
    discount: {},
    topup_input_unit: normalizeTopupInputUnit(
      statusState?.status?.quota_display_type,
    ),
    waffo_currency: 'USD',
    enable_redemption: true,
    payment_compliance_confirmed: true,
  });

  const normalizedWaffoPayMethods = enableWaffoTopUp
    ? waffoPayMethods.length > 0
      ? waffoPayMethods.map((method, index) => ({
          ...method,
          id: `waffo:${index}`,
          type: `waffo:${index}`,
          currency: topupInfo.waffo_currency || 'USD',
          min_topup: waffoMinTopUp,
          color: method.color || 'rgba(var(--semi-primary-5), 1)',
        }))
      : [
          {
            id: 'waffo:default',
            name: 'Waffo (Global Payment)',
            type: 'waffo:default',
            currency: topupInfo.waffo_currency || 'USD',
            min_topup: waffoMinTopUp,
            color: 'rgba(var(--semi-primary-5), 1)',
          },
        ]
    : [];

  const confirmPayMethods = [...payMethods, ...normalizedWaffoPayMethods];

  const getPayMethodConfig = (payment) =>
    confirmPayMethods.find((method) => method.type === payment);

  const getPaymentMinTopUp = (payment) => {
    const configuredMinTopUp = Number(getPayMethodConfig(payment)?.min_topup);
    return Number.isFinite(configuredMinTopUp) && configuredMinTopUp > 0
      ? configuredMinTopUp
      : minTopUp;
  };

  const requestAmountByPayment = async (payment, value) => {
    if (payment === 'stripe') {
      return getStripeAmount(value);
    }
    if (payment === 'waffo_pancake') {
      return getWaffoPancakeAmount(value);
    }
    if (typeof payment === 'string' && payment.startsWith('waffo:')) {
      return getWaffoAmount(value);
    }
    return getAmount(value);
  };

  const topUp = async () => {
    if (redemptionCode === '') {
      showInfo(t('请输入兑换码！'));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await API.post('/api/user/topup', {
        key: redemptionCode,
      });
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(t('兑换成功！'));
        Modal.success({
          title: t('兑换成功！'),
          content: t('成功兑换额度：') + renderQuota(data),
          centered: true,
        });
        if (userState.user) {
          const updatedUser = {
            ...userState.user,
            quota: userState.user.quota + data,
          };
          userDispatch({ type: 'login', payload: updatedUser });
        }
        setRedemptionCode('');
      } else {
        showError(message);
      }
    } catch (err) {
      showError(t('请求失败'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTopUpLink = () => {
    if (!topUpLink) {
      showError(t('超级管理员未设置充值链接！'));
      return;
    }
    window.open(topUpLink, '_blank');
  };

  const preTopUp = async (payment) => {
    if (payment === 'stripe') {
      if (!enableStripeTopUp) {
        showError(t('管理员未开启Stripe充值！'));
        return;
      }
    } else if (payment === 'waffo_pancake') {
      if (!enableWaffoPancakeTopUp) {
        showError(t('管理员未开启 Waffo Pancake 充值！'));
        return;
      }
    } else if (payment.startsWith('waffo:')) {
      if (!enableWaffoTopUp) {
        showError(t('管理员未开启 Waffo 充值！'));
        return;
      }
    } else {
      if (!enableOnlineTopUp) {
        showError(t('管理员未开启在线充值！'));
        return;
      }
    }

    setPayWay(payment);
    setAmount(null);
    setPaymentLoading(true);
    try {
      const selectedMinTopUp = getPaymentMinTopUp(payment);
      if (topUpCount < selectedMinTopUp) {
        showError(t('充值数量不能小于') + selectedMinTopUp);
        return;
      }

      const quotedAmount = await requestAmountByPayment(payment);
      if (quotedAmount === null) {
        showError(t('获取金额失败'));
        return;
      }
      setOpen(true);
    } catch (error) {
      showError(t('获取金额失败'));
    } finally {
      setPaymentLoading(false);
    }
  };

  const onlineTopUp = async () => {
    if (payWay === 'waffo_pancake') {
      setConfirmLoading(true);
      try {
        await waffoPancakeTopUp();
      } finally {
        setOpen(false);
        setConfirmLoading(false);
      }
      return;
    }

    if (payWay.startsWith('waffo:')) {
      const payMethodIndex = Number(payWay.split(':')[1]);
      setConfirmLoading(true);
      try {
        await waffoTopUp(Number.isFinite(payMethodIndex) ? payMethodIndex : 0);
      } finally {
        setOpen(false);
        setConfirmLoading(false);
      }
      return;
    }

    if (amount === null) {
      const quotedAmount = await requestAmountByPayment(payWay);
      if (quotedAmount === null) {
        showError(t('获取金额失败'));
        return;
      }
    }

    const selectedMinTopUp = getPaymentMinTopUp(payWay);
    if (topUpCount < selectedMinTopUp) {
      showError(t('充值数量不能小于') + selectedMinTopUp);
      return;
    }
    setConfirmLoading(true);
    try {
      let res;
      if (payWay === 'stripe') {
        // Stripe 支付请求
        res = await API.post('/api/user/stripe/pay', {
          amount: parseInt(topUpCount),
          payment_method: 'stripe',
        });
      } else {
        // 普通支付请求
        res = await API.post('/api/user/pay', {
          amount: parseInt(topUpCount),
          payment_method: payWay,
        });
      }

      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          if (payWay === 'stripe') {
            // Stripe 支付回调处理
            window.open(data.pay_link, '_blank');
          } else {
            // 普通支付表单提交
            let params = data;
            let url = res.data.url;
            let form = document.createElement('form');
            form.action = url;
            form.method = 'POST';
            let isSafari =
              navigator.userAgent.indexOf('Safari') > -1 &&
              navigator.userAgent.indexOf('Chrome') < 1;
            if (!isSafari) {
              form.target = '_blank';
            }
            for (let key in params) {
              let input = document.createElement('input');
              input.type = 'hidden';
              input.name = key;
              input.value = params[key];
              form.appendChild(input);
            }
            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
          }
        } else {
          const errorMsg =
            typeof data === 'string' ? data : message || t('支付失败');
          showError(errorMsg);
        }
      } else {
        showError(res);
      }
    } catch (err) {
      showError(t('支付请求失败'));
    } finally {
      setOpen(false);
      setConfirmLoading(false);
    }
  };

  const creemPreTopUp = async (product) => {
    if (!enableCreemTopUp) {
      showError(t('管理员未开启 Creem 充值！'));
      return;
    }
    setSelectedCreemProduct(product);
    setCreemOpen(true);
  };

  const onlineCreemTopUp = async () => {
    if (!selectedCreemProduct) {
      showError(t('请选择产品'));
      return;
    }
    // Validate product has required fields
    if (!selectedCreemProduct.productId) {
      showError(t('产品配置错误，请联系管理员'));
      return;
    }
    setConfirmLoading(true);
    try {
      const res = await API.post('/api/user/creem/pay', {
        product_id: selectedCreemProduct.productId,
        payment_method: 'creem',
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          processCreemCallback(data);
        } else {
          const errorMsg =
            typeof data === 'string' ? data : message || t('支付失败');
          showError(errorMsg);
        }
      } else {
        showError(res);
      }
    } catch (err) {
      showError(t('支付请求失败'));
    } finally {
      setCreemOpen(false);
      setConfirmLoading(false);
    }
  };

  const waffoTopUp = async (payMethodIndex) => {
    try {
      if (topUpCount < waffoMinTopUp) {
        showError(t('充值数量不能小于') + waffoMinTopUp);
        return;
      }
      setPaymentLoading(true);
      const requestBody = {
        amount: parseInt(topUpCount),
      };
      if (payMethodIndex != null) {
        requestBody.pay_method_index = payMethodIndex;
      }
      const res = await API.post('/api/user/waffo/pay', requestBody);
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success' && data?.payment_url) {
          window.open(data.payment_url, '_blank');
        } else {
          showError(data || t('支付请求失败'));
        }
      } else {
        showError(res);
      }
    } catch (e) {
      showError(t('支付请求失败'));
    } finally {
      setPaymentLoading(false);
    }
  };

  const getWaffoAmount = async (value) => {
    if (value === undefined) {
      value = topUpCount;
    }
    setAmountLoading(true);
    try {
      const res = await API.post('/api/user/waffo/amount', {
        amount: parseInt(value),
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          const quotedAmount = parseFloat(data);
          if (Number.isFinite(quotedAmount) && quotedAmount > 0) {
            setAmount(quotedAmount);
            return quotedAmount;
          }
          setAmount(null);
          return null;
        } else {
          setAmount(null);
          Toast.error({ content: '错误：' + data, id: 'getAmount' });
        }
      } else {
        showError(res);
      }
    } catch (err) {
      // amount fetch failed silently
    } finally {
      setAmountLoading(false);
    }
    return null;
  };

  const waffoPancakeTopUp = async () => {
    const minTopUpValue = Number(waffoPancakeMinTopUp || 1);
    if (topUpCount < minTopUpValue) {
      showError(t('充值数量不能小于') + minTopUpValue);
      return;
    }

    setPaymentLoading(true);
    try {
      const res = await API.post('/api/user/waffo-pancake/pay', {
        amount: parseInt(topUpCount),
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          const checkoutUrl = data?.checkout_url || '';
          if (checkoutUrl && isSafeHttpCheckoutUrl(checkoutUrl)) {
            // In-tab redirect (not window.open) — popup blocker fires after
            // the await loses user-gesture context.
            window.location.href = checkoutUrl;
          } else if (checkoutUrl) {
            showError(t('支付跳转地址不安全'));
          } else {
            showError(t('支付请求失败'));
          }
        } else {
          const errorMsg =
            typeof data === 'string' ? data : message || t('支付请求失败');
          showError(errorMsg);
        }
      } else {
        showError(res);
      }
    } catch (e) {
      showError(t('支付请求失败'));
    } finally {
      setPaymentLoading(false);
    }
  };

  const getWaffoPancakeAmount = async (value) => {
    if (value === undefined) {
      value = topUpCount;
    }
    setAmountLoading(true);
    try {
      const res = await API.post('/api/user/waffo-pancake/amount', {
        amount: parseInt(value),
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          const quotedAmount = parseFloat(data);
          if (Number.isFinite(quotedAmount) && quotedAmount > 0) {
            setAmount(quotedAmount);
            return quotedAmount;
          }
          setAmount(null);
          return null;
        } else {
          setAmount(null);
          Toast.error({ content: '错误：' + data, id: 'getAmount' });
        }
      } else {
        showError(res);
      }
    } catch (err) {
      // amount fetch failed silently
    } finally {
      setAmountLoading(false);
    }
    return null;
  };

  const processCreemCallback = (data) => {
    // 与 Stripe 保持一致的实现方式
    window.open(data.checkout_url, '_blank');
  };

  const getUserQuota = async () => {
    let res = await API.get(`/api/user/self`);
    const { success, message, data } = res.data;
    if (success) {
      userDispatch({ type: 'login', payload: data });
    } else {
      showError(message);
    }
  };

  const getSubscriptionPlans = async () => {
    setSubscriptionLoading(true);
    try {
      const res = await API.get('/api/subscription/plans');
      if (res.data?.success) {
        setSubscriptionPlans(res.data.data || []);
      }
    } catch (e) {
      setSubscriptionPlans([]);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const getSubscriptionSelf = async () => {
    try {
      const res = await API.get('/api/subscription/self');
      if (res.data?.success) {
        setBillingPreference(
          res.data.data?.billing_preference || 'subscription_first',
        );
        // Active subscriptions
        const activeSubs = res.data.data?.subscriptions || [];
        setActiveSubscriptions(activeSubs);
        // All subscriptions (including expired)
        const allSubs = res.data.data?.all_subscriptions || [];
        setAllSubscriptions(allSubs);
      }
    } catch (e) {
      // ignore
    }
  };

  const updateBillingPreference = async (pref) => {
    const previousPref = billingPreference;
    setBillingPreference(pref);
    try {
      const res = await API.put('/api/subscription/self/preference', {
        billing_preference: pref,
      });
      if (res.data?.success) {
        showSuccess(t('更新成功'));
        const normalizedPref =
          res.data?.data?.billing_preference || pref || previousPref;
        setBillingPreference(normalizedPref);
      } else {
        showError(res.data?.message || t('更新失败'));
        setBillingPreference(previousPref);
      }
    } catch (e) {
      showError(t('请求失败'));
      setBillingPreference(previousPref);
    }
  };

  // 获取充值配置信息
  const getTopupInfo = async () => {
    try {
      const res = await API.get('/api/user/topup/info');
      const { data, success } = res.data;
      if (success) {
        const amountOptions = parseJsonArray(data.amount_options)
          .map(Number)
          .filter((value) => Number.isFinite(value) && value > 0);
        const discounts = parseDiscountMap(data.discount);
        const stripeMinTopUp = Number(data.stripe_min_topup);

        const normalizedPayMethods = parseJsonArray(data.pay_methods)
          .filter(
            (method) =>
              method &&
              typeof method === 'object' &&
              method.name &&
              method.type &&
              method.type !== 'waffo',
          )
          .map((method, index) => {
            const rawMinTopUp = Number(method.min_topup);
            const methodMinTopUp =
              method.type === 'stripe' &&
              (!Number.isFinite(rawMinTopUp) || rawMinTopUp <= 0) &&
              Number.isFinite(stripeMinTopUp) &&
              stripeMinTopUp > 0
                ? stripeMinTopUp
                : Number.isFinite(rawMinTopUp) && rawMinTopUp > 0
                  ? rawMinTopUp
                  : 0;

            let color = method.color;
            if (!color) {
              if (method.type === 'alipay') {
                color = 'rgba(var(--semi-blue-5), 1)';
              } else if (method.type === 'wxpay') {
                color = 'rgba(var(--semi-green-5), 1)';
              } else if (method.type === 'stripe') {
                color = 'rgba(var(--semi-purple-5), 1)';
              } else {
                color = 'rgba(var(--semi-primary-5), 1)';
              }
            }

            return {
              ...method,
              id: method.id || `${method.type}:${index}`,
              min_topup: methodMinTopUp,
              currency:
                typeof method.currency === 'string' && method.currency
                  ? method.currency
                  : method.type === 'waffo_pancake'
                    ? 'USD'
                    : 'CNY',
              color,
            };
          });
        const normalizedWaffoMethods = parseJsonArray(
          data.waffo_pay_methods,
        ).filter(
          (method) => method && typeof method === 'object' && method.name,
        );
        const onlineTopUpEnabled = Boolean(data.enable_online_topup);
        const stripeTopUpEnabled = Boolean(data.enable_stripe_topup);
        const creemTopUpEnabled = Boolean(data.enable_creem_topup);
        const waffoTopUpEnabled = Boolean(data.enable_waffo_topup);
        const waffoPancakeTopUpEnabled = Boolean(
          data.enable_waffo_pancake_topup,
        );
        const normalizedWaffoMinTopUp =
          Number(data.waffo_min_topup) > 0 ? Number(data.waffo_min_topup) : 1;
        const normalizedWaffoPancakeMinTopUp =
          Number(data.waffo_pancake_min_topup) > 0
            ? Number(data.waffo_pancake_min_topup)
            : 1;
        const minimumCandidates = [
          ...normalizedPayMethods.map((method) => Number(method.min_topup)),
          waffoTopUpEnabled ? normalizedWaffoMinTopUp : null,
          waffoPancakeTopUpEnabled ? normalizedWaffoPancakeMinTopUp : null,
        ].filter((value) => Number.isFinite(value) && value > 0);
        const minTopUpValue =
          minimumCandidates.length > 0 ? Math.min(...minimumCandidates) : 1;

        setPayMethods(normalizedPayMethods);
        setEnableOnlineTopUp(onlineTopUpEnabled);
        setEnableStripeTopUp(stripeTopUpEnabled);
        setEnableCreemTopUp(creemTopUpEnabled);
        setEnableWaffoTopUp(waffoTopUpEnabled);
        setWaffoPayMethods(normalizedWaffoMethods);
        setWaffoMinTopUp(normalizedWaffoMinTopUp);
        setEnableWaffoPancakeTopUp(waffoPancakeTopUpEnabled);
        setWaffoPancakeMinTopUp(normalizedWaffoPancakeMinTopUp);
        setMinTopUp(minTopUpValue);
        setTopUpCount(minTopUpValue);
        setTopUpLink(data.topup_link || '');
        setTopupInfo({
          amount_options: amountOptions,
          discount: discounts,
          topup_input_unit: normalizeTopupInputUnit(data.topup_input_unit),
          waffo_currency:
            typeof data.waffo_currency === 'string' && data.waffo_currency
              ? data.waffo_currency
              : 'USD',
          enable_redemption: data.enable_redemption !== false,
          payment_compliance_confirmed:
            data.payment_compliance_confirmed !== false,
          payment_compliance_terms_version:
            data.payment_compliance_terms_version || '',
        });
        setCreemProducts(parseJsonArray(data.creem_products));
        setPresetAmounts(
          amountOptions.length > 0
            ? amountOptions.map((value) => ({
                value,
                discount: discounts[value] || 1,
              }))
            : generatePresetAmounts(minTopUpValue),
        );
        setSelectedPreset(null);
        setAmount(null);
      } else {
        showError(data || t('获取充值配置失败'));
      }
    } catch (error) {
      showError(t('获取充值配置异常'));
    }
  };

  // 获取邀请链接
  const getAffLink = async () => {
    const res = await API.get('/api/user/aff');
    const { success, message, data } = res.data;
    if (success) {
      let link = `${window.location.origin}/register?aff=${data}`;
      setAffLink(link);
    } else {
      showError(message);
    }
  };

  // 划转邀请额度
  const transfer = async () => {
    if (transferAmount < getQuotaPerUnit()) {
      showError(t('划转金额最低为') + ' ' + renderQuota(getQuotaPerUnit()));
      return;
    }
    const res = await API.post(`/api/user/aff_transfer`, {
      quota: transferAmount,
    });
    const { success, message } = res.data;
    if (success) {
      showSuccess(message);
      setOpenTransfer(false);
      getUserQuota().then();
    } else {
      showError(message);
    }
  };

  // 复制邀请链接
  const handleAffLinkClick = async () => {
    await copy(affLink);
    showSuccess(t('邀请链接已复制到剪切板'));
  };

  // URL 参数自动打开账单弹窗（支付回跳时触发）
  useEffect(() => {
    if (searchParams.get('show_history') === 'true') {
      setOpenHistory(true);
      searchParams.delete('show_history');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  useEffect(() => {
    // 始终获取最新用户数据，确保余额等统计信息准确
    getUserQuota().then();
    setTransferAmount(getQuotaPerUnit());
  }, []);

  useEffect(() => {
    if (affFetchedRef.current) return;
    affFetchedRef.current = true;
    getAffLink().then();
  }, []);

  // 在 statusState 可用时获取充值信息
  useEffect(() => {
    getTopupInfo().then();
    getSubscriptionPlans().then();
    getSubscriptionSelf().then();
  }, []);

  useEffect(() => {
    if (statusState?.status) {
      setStatusLoading(false);
    }
  }, [statusState?.status]);

  const renderAmount = () => {
    if (amount === null) return '-';
    return formatPaymentAmount(amount, getPayMethodConfig(payWay)?.currency);
  };

  const getAmount = async (value) => {
    if (value === undefined) {
      value = topUpCount;
    }
    setAmountLoading(true);
    try {
      const res = await API.post('/api/user/amount', {
        amount: parseFloat(value),
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          const quotedAmount = parseFloat(data);
          if (Number.isFinite(quotedAmount) && quotedAmount > 0) {
            setAmount(quotedAmount);
            return quotedAmount;
          }
          setAmount(null);
          return null;
        } else {
          setAmount(null);
          Toast.error({ content: '错误：' + data, id: 'getAmount' });
        }
      } else {
        showError(res);
      }
    } catch (err) {
      // amount fetch failed silently
    } finally {
      setAmountLoading(false);
    }
    return null;
  };

  const getStripeAmount = async (value) => {
    if (value === undefined) {
      value = topUpCount;
    }
    setAmountLoading(true);
    try {
      const res = await API.post('/api/user/stripe/amount', {
        amount: parseFloat(value),
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          const quotedAmount = parseFloat(data);
          if (Number.isFinite(quotedAmount) && quotedAmount > 0) {
            setAmount(quotedAmount);
            return quotedAmount;
          }
          setAmount(null);
          return null;
        } else {
          setAmount(null);
          Toast.error({ content: '错误：' + data, id: 'getAmount' });
        }
      } else {
        showError(res);
      }
    } catch (err) {
      // amount fetch failed silently
    } finally {
      setAmountLoading(false);
    }
    return null;
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const handleTransferCancel = () => {
    setOpenTransfer(false);
  };

  const handleOpenHistory = () => {
    setOpenHistory(true);
  };

  const handleHistoryCancel = () => {
    setOpenHistory(false);
  };

  const handleCreemCancel = () => {
    setCreemOpen(false);
    setSelectedCreemProduct(null);
  };

  const handleTopupAmountChange = async (value) => {
    setAmount(null);
    const normalizedValue = Number(value);
    if (
      !payWay ||
      !Number.isFinite(normalizedValue) ||
      normalizedValue < getPaymentMinTopUp(payWay)
    ) {
      return;
    }

    await requestAmountByPayment(payWay, normalizedValue);
  };

  // 选择预设充值额度
  const selectPresetAmount = async (preset) => {
    const normalizedValue = Number(preset.value);
    if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
      return;
    }

    setTopUpCount(normalizedValue);
    setSelectedPreset(normalizedValue);
    setAmount(null);
    if (payWay && normalizedValue >= getPaymentMinTopUp(payWay)) {
      await requestAmountByPayment(payWay, normalizedValue);
    }
  };

  // 根据最小充值金额生成预设充值额度选项
  const generatePresetAmounts = (minAmount) => {
    const multipliers = [1, 5, 10, 30, 50, 100, 300, 500];
    return multipliers.map((multiplier) => ({
      value: minAmount * multiplier,
    }));
  };

  return (
    <div className='w-full max-w-7xl mx-auto relative min-h-screen lg:min-h-0 mt-[60px] px-2'>
      {/* 划转模态框 */}
      <TransferModal
        t={t}
        openTransfer={openTransfer}
        transfer={transfer}
        handleTransferCancel={handleTransferCancel}
        userState={userState}
        renderQuota={renderQuota}
        getQuotaPerUnit={getQuotaPerUnit}
        transferAmount={transferAmount}
        setTransferAmount={setTransferAmount}
      />

      {/* 充值确认模态框 */}
      <PaymentConfirmModal
        t={t}
        open={open}
        onlineTopUp={onlineTopUp}
        handleCancel={handleCancel}
        confirmLoading={confirmLoading}
        topUpCount={topUpCount}
        amountLoading={amountLoading}
        payWay={payWay}
        payMethods={confirmPayMethods}
        amountNumber={amount}
        topupInputUnit={topupInfo.topup_input_unit}
        discountRate={
          payWay === 'stripe' ? 1 : topupInfo?.discount?.[topUpCount] || 1
        }
      />

      {/* 充值账单模态框 */}
      <TopupHistoryModal
        visible={openHistory}
        onCancel={handleHistoryCancel}
        t={t}
      />

      {/* Creem 充值确认模态框 */}
      <Modal
        title={t('确定要充值 $')}
        visible={creemOpen}
        onOk={onlineCreemTopUp}
        onCancel={handleCreemCancel}
        maskClosable={false}
        size='small'
        centered
        confirmLoading={confirmLoading}
      >
        {selectedCreemProduct && (
          <>
            <p>
              {t('产品名称')}：{selectedCreemProduct.name}
            </p>
            <p>
              {t('价格')}：{selectedCreemProduct.currency === 'EUR' ? '€' : '$'}
              {selectedCreemProduct.price}
            </p>
            <p>
              {t('充值额度')}：{selectedCreemProduct.quota}
            </p>
            <p>{t('是否确认充值？')}</p>
          </>
        )}
      </Modal>

      {/* 主布局区域 */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <RechargeCard
          t={t}
          enableOnlineTopUp={enableOnlineTopUp}
          enableStripeTopUp={enableStripeTopUp}
          enableCreemTopUp={enableCreemTopUp}
          creemProducts={creemProducts}
          creemPreTopUp={creemPreTopUp}
          enableWaffoTopUp={enableWaffoTopUp}
          enableWaffoPancakeTopUp={enableWaffoPancakeTopUp}
          presetAmounts={presetAmounts}
          selectedPreset={selectedPreset}
          selectPresetAmount={selectPresetAmount}
          topUpCount={topUpCount}
          minTopUp={minTopUp}
          setTopUpCount={setTopUpCount}
          onTopupAmountChange={handleTopupAmountChange}
          setSelectedPreset={setSelectedPreset}
          renderAmount={renderAmount}
          amountLoading={amountLoading}
          payMethods={confirmPayMethods}
          preTopUp={preTopUp}
          paymentLoading={paymentLoading}
          payWay={payWay}
          redemptionCode={redemptionCode}
          setRedemptionCode={setRedemptionCode}
          topUp={topUp}
          isSubmitting={isSubmitting}
          topUpLink={topUpLink}
          openTopUpLink={openTopUpLink}
          userState={userState}
          renderQuota={renderQuota}
          statusLoading={statusLoading}
          topupInfo={topupInfo}
          onOpenHistory={handleOpenHistory}
          subscriptionLoading={subscriptionLoading}
          subscriptionPlans={subscriptionPlans}
          billingPreference={billingPreference}
          onChangeBillingPreference={updateBillingPreference}
          activeSubscriptions={activeSubscriptions}
          allSubscriptions={allSubscriptions}
          reloadSubscriptionSelf={getSubscriptionSelf}
          enableRedemption={topupInfo.enable_redemption !== false}
        />
        <InvitationCard
          t={t}
          userState={userState}
          renderQuota={renderQuota}
          setOpenTransfer={setOpenTransfer}
          affLink={affLink}
          handleAffLinkClick={handleAffLinkClick}
          complianceConfirmed={topupInfo.payment_compliance_confirmed !== false}
        />
      </div>
    </div>
  );
};

export default TopUp;
