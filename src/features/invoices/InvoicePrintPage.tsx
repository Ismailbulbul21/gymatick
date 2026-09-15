import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { getInvoice } from '@/lib/api'
import { queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Button, ErrorState, Skeleton } from '@/components/ui/primitives'
import { InvoiceDocument } from './InvoiceDocument'

/** Print-only route: A4 invoice, or an 80 mm receipt with ?format=receipt */
export default function InvoicePrintPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const [params] = useSearchParams()
  const business = useBusiness()
  const { currency } = useSession()
  const receipt = params.get('format') === 'receipt'

  const query = useQuery({
    queryKey: queryKeys.invoice(invoiceId ?? ''),
    queryFn: () => getInvoice(invoiceId!),
    enabled: Boolean(invoiceId),
  })

  useEffect(() => {
    document.title = query.data?.invoice ? `${query.data.invoice.invoice_number} · GYMATICK` : 'Invoice · GYMATICK'
  }, [query.data])

  if (query.isLoading) return <div className="p-10"><Skeleton className="h-[600px]" /></div>
  if (query.isError || !query.data?.invoice) return <ErrorState message="Could not load this invoice" onRetry={() => void query.refetch()} />

  return (
    <div className="min-h-svh bg-ink-100 py-8 print:bg-white print:py-0">
      <style>{`@page { size: ${receipt ? '80mm auto' : 'A4'}; margin: ${receipt ? '4mm' : '14mm'}; }`}</style>
      <div className={`mx-auto bg-white shadow-lg print:shadow-none ${receipt ? 'w-[302px]' : 'w-[794px] max-w-full'}`}>
        <InvoiceDocument
          invoice={query.data.invoice}
          items={query.data.items}
          payments={query.data.payments}
          business={{
            name: business.business_name,
          }}
          currency={currency}
          footer={business.settings.invoice_footer}
          compact={receipt}
        />
      </div>
      <div className="no-print mx-auto mt-6 flex w-[794px] max-w-full justify-center gap-2">
        <Button variant="primary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
          Print {receipt ? 'receipt' : 'invoice'}
        </Button>
        <Button onClick={() => window.close()}>Close</Button>
      </div>
    </div>
  )
}
