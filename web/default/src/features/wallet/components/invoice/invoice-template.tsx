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
import { useTranslation } from 'react-i18next'
import type { TopupInvoice } from '../../types'

interface InvoiceTemplateProps {
  invoice: TopupInvoice
}

function isPresent(value?: string | number | null): boolean {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

export function InvoiceTemplate({ invoice }: InvoiceTemplateProps) {
  const { t } = useTranslation()
  const fallback = (value?: string | number | null) =>
    isPresent(value) ? String(value) : t('N/A')
  const amount = (value?: string | number | null, currency?: string) =>
    `${fallback(value)} ${fallback(currency || invoice.recharge_currency)}`

  return (
    <article
      id='topup-invoice-print'
      className='bg-background text-foreground mx-auto w-full max-w-[860px] rounded-md border p-5 text-sm shadow-sm sm:p-8'
    >
      <header className='flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h1 className='text-4xl font-semibold tracking-normal'>
            {t('Invoice')}
          </h1>
          <p className='text-muted-foreground mt-2 text-sm'>
            {t('USDT top-up invoice')}
          </p>
        </div>
        <dl className='grid gap-2 text-sm sm:min-w-72'>
          <div className='flex justify-between gap-4'>
            <dt className='text-muted-foreground'>{t('Invoice number')}</dt>
            <dd className='font-mono font-medium'>
              {fallback(invoice.invoice_number)}
            </dd>
          </div>
          <div className='flex justify-between gap-4'>
            <dt className='text-muted-foreground'>{t('Issue date')}</dt>
            <dd className='font-medium'>{fallback(invoice.issue_date)}</dd>
          </div>
          <div className='flex justify-between gap-4'>
            <dt className='text-muted-foreground'>{t('Order number')}</dt>
            <dd className='font-mono font-medium'>
              {fallback(invoice.payment.order_number)}
            </dd>
          </div>
        </dl>
      </header>

      <section className='grid gap-5 border-b py-6 sm:grid-cols-2'>
        <div className='space-y-2'>
          <h2 className='text-base font-semibold'>{t('Seller')}</h2>
          <div className='space-y-1 text-sm'>
            <p className='font-medium'>{fallback(invoice.seller.name)}</p>
            <p>{fallback(invoice.seller.address)}</p>
            <p>{fallback(invoice.seller.email)}</p>
            <p>
              <span className='text-muted-foreground'>
                {t('Hong Kong BR No.')}:
              </span>{' '}
              {fallback(invoice.seller.business_registration_number)}
            </p>
          </div>
        </div>
        <div className='space-y-2'>
          <h2 className='text-base font-semibold'>{t('Bill to')}</h2>
          <div className='space-y-1 text-sm'>
            <p className='font-medium'>{fallback(invoice.buyer.name)}</p>
            <p>{fallback(invoice.buyer.company)}</p>
            <p>{fallback(invoice.buyer.address)}</p>
            <p>{fallback(invoice.buyer.email)}</p>
          </div>
        </div>
      </section>

      <section className='grid gap-5 border-b py-6 sm:grid-cols-2'>
        <div className='rounded-md border p-4'>
          <p className='text-muted-foreground text-xs font-medium uppercase'>
            {t('Amount paid')}
          </p>
          <p className='mt-2 text-2xl font-semibold'>
            {amount(invoice.totals.amount_paid, invoice.totals.currency)}
          </p>
          {isPresent(invoice.fiat_reference_currency) && (
            <p className='text-muted-foreground mt-1 text-xs'>
              {t('Fiat reference')}: {invoice.fiat_reference_currency}
            </p>
          )}
        </div>
        <dl className='grid gap-2 text-sm'>
          <div className='flex justify-between gap-4'>
            <dt className='text-muted-foreground'>{t('Payment Method')}</dt>
            <dd className='font-medium'>
              {fallback(invoice.payment.payment_method)}
            </dd>
          </div>
          <div className='flex justify-between gap-4'>
            <dt className='text-muted-foreground'>{t('Provider')}</dt>
            <dd className='font-medium'>
              {fallback(invoice.payment.payment_provider)}
            </dd>
          </div>
          <div className='flex justify-between gap-4'>
            <dt className='text-muted-foreground'>{t('Credited amount')}</dt>
            <dd className='font-medium'>{fallback(invoice.credited_amount)}</dd>
          </div>
        </dl>
      </section>

      <section className='space-y-3 border-b py-6'>
        <h2 className='text-base font-semibold'>{t('USDT payment details')}</h2>
        <dl className='grid gap-3 text-sm sm:grid-cols-2'>
          <div>
            <dt className='text-muted-foreground'>{t('Network')}</dt>
            <dd className='font-medium'>
              {fallback(invoice.payment.usdt_network)}
            </dd>
          </div>
          <div>
            <dt className='text-muted-foreground'>
              {t('Payment completion time')}
            </dt>
            <dd className='font-medium'>
              {fallback(invoice.payment.payment_completion_time)}
            </dd>
          </div>
          <div className='sm:col-span-2'>
            <dt className='text-muted-foreground'>{t('Receiving wallet')}</dt>
            <dd className='break-all font-mono text-xs'>
              {fallback(invoice.payment.receiving_wallet_address)}
            </dd>
          </div>
          <div className='sm:col-span-2'>
            <dt className='text-muted-foreground'>
              {t('Blockchain transaction hash')}
            </dt>
            <dd className='break-all font-mono text-xs'>
              {fallback(invoice.payment.blockchain_transaction_hash)}
            </dd>
          </div>
        </dl>
      </section>

      <section className='space-y-3 py-6'>
        <h2 className='text-base font-semibold'>{t('Line items')}</h2>
        <div className='overflow-x-auto rounded-md border'>
          <table className='w-full min-w-[560px] border-collapse text-left text-sm'>
            <thead className='bg-muted/50'>
              <tr>
                <th className='px-3 py-2 font-medium'>{t('Description')}</th>
                <th className='px-3 py-2 text-right font-medium'>
                  {t('Qty')}
                </th>
                <th className='px-3 py-2 text-right font-medium'>
                  {t('Unit amount')}
                </th>
                <th className='px-3 py-2 text-right font-medium'>
                  {t('Line total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item, index) => (
                <tr
                  key={`${item.description}-${index}`}
                  className={index % 2 === 1 ? 'bg-muted/30 border-t' : 'border-t'}
                >
                  <td className='max-w-[320px] break-words px-3 py-4 leading-relaxed align-top'>
                    {fallback(item.description)}
                  </td>
                  <td className='px-3 py-4 text-right align-top'>
                    {fallback(item.quantity)}
                  </td>
                  <td className='px-3 py-4 text-right align-top'>
                    {amount(item.unit_amount, item.currency)}
                  </td>
                  <td className='px-3 py-4 text-right align-top font-medium'>
                    {amount(item.total, item.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className='flex flex-col gap-5 border-t pt-6 sm:flex-row sm:items-start sm:justify-between'>
        <div className='text-muted-foreground max-w-md space-y-2 text-sm'>
          {isPresent(invoice.notes) && (
            <p>
              <span className='text-foreground font-medium'>{t('Notes')}:</span>{' '}
              {invoice.notes}
            </p>
          )}
          {isPresent(invoice.footer_text) && <p>{invoice.footer_text}</p>}
        </div>
        <dl className='grid min-w-72 gap-2 text-sm'>
          <div className='flex justify-between gap-4'>
            <dt className='text-muted-foreground'>{t('Subtotal')}</dt>
            <dd>{amount(invoice.totals.subtotal, invoice.totals.currency)}</dd>
          </div>
          <div className='flex justify-between gap-4'>
            <dt className='text-muted-foreground'>{t('Tax')}</dt>
            <dd>
              {fallback(invoice.totals.tax_label)}:{' '}
              {fallback(invoice.totals.tax_value)}
            </dd>
          </div>
          <div className='flex justify-between gap-4 text-base font-semibold'>
            <dt>{t('Total')}</dt>
            <dd>{amount(invoice.totals.total, invoice.totals.currency)}</dd>
          </div>
          <div className='flex justify-between gap-4'>
            <dt className='text-muted-foreground'>{t('Amount paid')}</dt>
            <dd>
              {amount(invoice.totals.amount_paid, invoice.totals.currency)}
            </dd>
          </div>
          <div className='flex justify-between gap-4'>
            <dt className='text-muted-foreground'>{t('Balance due')}</dt>
            <dd>
              {amount(invoice.totals.balance_due, invoice.totals.currency)}
            </dd>
          </div>
        </dl>
      </section>
    </article>
  )
}
