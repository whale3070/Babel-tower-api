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
import { useEffect, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { getTopupInvoice, getTopupInvoicePdf, isApiSuccess } from '../../api'
import type { TopupInvoice } from '../../types'
import { InvoiceTemplate } from '../invoice/invoice-template'

interface InvoiceDialogProps {
  open: boolean
  topupId: number | null
  onOpenChange: (open: boolean) => void
}

export function InvoiceDialog({
  open,
  topupId,
  onOpenChange,
}: InvoiceDialogProps) {
  const { t } = useTranslation()
  const [downloading, setDownloading] = useState(false)

  const invoiceQuery = useQuery<TopupInvoice, Error>({
    enabled: open && !!topupId,
    queryKey: ['topup-invoice', topupId],
    queryFn: async () => {
      if (!topupId) {
        throw new Error('No invoice data available')
      }
      const response = await getTopupInvoice(topupId)
      if (isApiSuccess(response) && response.data) {
        return response.data
      }
      throw new Error(response.message || 'Failed to load invoice')
    },
    retry: false,
  })

  const invoice = open ? (invoiceQuery.data ?? null) : null
  const loading = invoiceQuery.isFetching && !invoice
  const error =
    invoiceQuery.error instanceof Error ? invoiceQuery.error.message : ''

  useEffect(() => {
    if (open && invoiceQuery.isError && error) {
      toast.error(error)
    }
  }, [error, invoiceQuery.isError, open])

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = async () => {
    if (!invoice || !topupId) return
    setDownloading(true)
    try {
      const blob = await getTopupInvoicePdf(topupId)
      if (blob.type.includes('application/json')) {
        const payload = JSON.parse(await blob.text()) as { message?: string }
        throw new Error(payload.message || t('Failed to download invoice'))
      }
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const safeNumber = invoice.invoice_number.replace(/[^a-z0-9_-]+/gi, '_')
      anchor.href = url
      anchor.download = `${safeNumber || 'invoice'}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      toast.success(t('Invoice downloaded'))
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to download invoice:', err)
      const message =
        err instanceof Error ? err.message : t('Failed to download invoice')
      toast.error(message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[calc(100dvh-2rem)] flex-col max-sm:h-dvh max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:p-4 sm:max-w-5xl'>
        <style>
          {`
            @media print {
              body * {
                visibility: hidden;
              }
              #topup-invoice-print,
              #topup-invoice-print * {
                visibility: visible;
              }
              #topup-invoice-print {
                border: 0 !important;
                box-shadow: none !important;
                left: 0;
                max-width: none !important;
                position: absolute;
                top: 0;
                width: 100% !important;
              }
            }
          `}
        </style>
        <DialogHeader>
          <DialogTitle>{t('Invoice')}</DialogTitle>
          <DialogDescription>
            {t('View, print, or download this completed top-up invoice')}
          </DialogDescription>
        </DialogHeader>

        <div
          className='flex items-center justify-end gap-2'
          data-invoice-dialog-actions
        >
          <Button
            variant='outline'
            size='sm'
            onClick={handlePrint}
            disabled={!invoice || loading}
          >
            <Printer className='h-4 w-4' />
            {t('Print')}
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={handleDownload}
            disabled={!invoice || loading || downloading}
          >
            <Download className='h-4 w-4' />
            {downloading ? t('Downloading...') : t('Download PDF')}
          </Button>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto pr-1'>
          {loading ? (
            <div className='space-y-4 rounded-md border p-5 sm:p-8'>
              <Skeleton className='h-10 w-48' />
              <Skeleton className='h-24 w-full' />
              <Skeleton className='h-36 w-full' />
              <Skeleton className='h-40 w-full' />
            </div>
          ) : invoice ? (
            <InvoiceTemplate invoice={invoice} />
          ) : (
            <div className='text-muted-foreground flex min-h-72 items-center justify-center rounded-md border text-center text-sm'>
              {error || t('No invoice data available')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
