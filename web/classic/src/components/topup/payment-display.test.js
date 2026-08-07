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

import { describe, expect, test } from 'bun:test';
import {
  formatPaymentAmount,
  formatTopupInputAmount,
  getActualPaymentAmount,
  resolveTopupCreditedQuota,
  resolveTopupRecordCreditedQuota,
} from './payment-display-utils';

describe('Classic top-up payment display', () => {
  test('treats CNY top-up input as a 1:1 wallet denomination', () => {
    expect(resolveTopupCreditedQuota(10, 'USD', 500000)).toBe(5000000);
    expect(resolveTopupCreditedQuota(10, 'CNY', 500000)).toBe(5000000);
  });

  test('keeps token-mode input as raw token quota', () => {
    expect(resolveTopupCreditedQuota(500000, 'TOKENS', 500000)).toBe(500000);
  });

  test('shows the backend input amount without exchange-rate multiplication', () => {
    expect(formatTopupInputAmount(10, 'USD')).toBe(
      formatPaymentAmount(10, 'USD'),
    );
    expect(formatTopupInputAmount(10, 'CNY')).toBe(
      formatPaymentAmount(10, 'CNY'),
    );
    expect(formatTopupInputAmount(500000, 'TOKENS')).toBe('500,000');
  });

  test('uses the server payment snapshot for new orders', () => {
    expect(
      getActualPaymentAmount({
        payment_amount: 69.5,
        payment_currency: 'CNY',
        money: 10,
      }),
    ).toBe(69.5);
  });

  test('does not render a missing quote as a zero payment', () => {
    expect(formatPaymentAmount(null, 'CNY')).toBe('-');
  });

  test('does not present legacy Stripe money as actual payment', () => {
    expect(
      getActualPaymentAmount({ payment_method: 'stripe', money: 10 }),
    ).toBeNull();
  });

  test('uses exact credited quota and safe provider-specific fallbacks', () => {
    expect(
      resolveTopupRecordCreditedQuota(
        { credited_quota: 7500000, amount: 1 },
        500000,
      ),
    ).toBe(7500000);
    expect(
      resolveTopupRecordCreditedQuota(
        { payment_method: 'creem', amount: 7500000 },
        500000,
      ),
    ).toBe(7500000);
    expect(
      resolveTopupRecordCreditedQuota(
        { payment_method: 'stripe', money: 15 },
        500000,
      ),
    ).toBe(7500000);
  });
});
