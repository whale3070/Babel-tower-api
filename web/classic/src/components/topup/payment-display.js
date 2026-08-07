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

import {
  getCurrencyConfig,
  getQuotaPerUnit,
  renderQuota,
} from '../../helpers/render';
import {
  formatPaymentAmount,
  formatTopupInputAmount,
  getActualPaymentAmount,
  normalizeTopupInputUnit,
  resolveTopupCreditedQuota,
  resolveTopupRecordCreditedQuota,
} from './payment-display-utils';

export {
  formatPaymentAmount,
  formatTopupInputAmount,
  getActualPaymentAmount,
  normalizeTopupInputUnit,
  resolveTopupCreditedQuota,
  resolveTopupRecordCreditedQuota,
};

const resolveInputUnit = (inputUnit) =>
  normalizeTopupInputUnit(inputUnit || getCurrencyConfig().type);

export const formatTopupCreditAmount = (amount, inputUnit) => {
  const unit = resolveInputUnit(inputUnit);
  if (unit === 'CUSTOM') {
    return `${getCurrencyConfig().symbol}${formatTopupInputAmount(amount, unit)}`;
  }
  return formatTopupInputAmount(amount, unit);
};

export const getTopupInputUnit = (inputUnit) => {
  const unit = resolveInputUnit(inputUnit);
  if (unit === 'TOKENS') return 'Tokens';
  if (unit === 'CUSTOM') return getCurrencyConfig().symbol;
  return unit;
};

export const formatTopupRecordCredit = (record) => {
  const creditedQuota = resolveTopupRecordCreditedQuota(
    record,
    getQuotaPerUnit(),
  );

  return creditedQuota === null ? '-' : renderQuota(creditedQuota, 2);
};
