import { GymatickMark } from '@/components/brand/Logo'
import { formatBusinessDate } from '@/lib/dates'
import { formatMoney, money, type Currency } from '@/lib/money'
import type { InvoiceItem, InvoiceRow, TransactionRow } from '@/types/db'
import { tr } from '@/i18n'

/** The printable invoice. Used on screen and by the print route. */
export function InvoiceDocument({ invoice, items, payments, business, currency, footer, compact }: {
  invoice: InvoiceRow
  items: InvoiceItem[]
  payments: TransactionRow[]
  business: { name: string; address?: string | null; phone?: string | null; email?: string | null }
  currency: Currency
  footer?: string | null
  compact?: boolean
}) {
  const total = money(invoice.total, currency.decimals)
  const paid = money(invoice.amount_paid, currency.decimals)
  const balance = total - paid
  const stamp = invoice.status === 'paid' ? 'PAID' : invoice.status === 'cancelled' ? 'CANCELLED' : invoice.status === 'partially_paid' ? 'PART PAID' : null

  return (
    <div className={`relative bg-white text-ink-900 ${compact ? 'w-[302px] p-4 text-[11px]' : 'p-10'}`}>
      {stamp ? (
        <span
          className={`pointer-events-none absolute right-8 top-16 rotate-[-14deg] rounded-lg border-4 px-4 py-1 text-2xl font-extrabold tracking-widest ${
            invoice.status === 'paid' ? 'border-income-600 text-income-700' : invoice.status === 'cancelled' ? 'border-ink-300 text-ink-400' : 'border-brand-600 text-brand-600'
          } ${compact ? 'hidden' : ''}`}
        >
          {stamp}
        </span>
      ) : null}

      <div className={`flex items-start justify-between gap-6 ${compact ? 'flex-col items-center text-center' : ''}`}>
        <div className={`flex items-center gap-3 ${compact ? 'flex-col gap-1' : ''}`}>
          <GymatickMark size={compact ? 32 : 44} />
          <div>
            <p className={`font-extrabold tracking-tight ${compact ? 'text-base' : 'text-xl'}`}>{business.name}</p>
            {business.address ? <p className="text-ink-500">{business.address}</p> : null}
            {business.phone || business.email ? (
              <p className="text-ink-500">{[business.phone, business.email].filter(Boolean).join(' · ')}</p>
            ) : null}
          </div>
        </div>
        <div className={compact ? 'text-center' : 'text-right'}>
          <p className={`font-bold uppercase tracking-[0.12em] ${compact ? 'text-sm' : 'text-lg'}`}>
            {compact ? tr("Receipt · Rasiid") : tr("Invoice · Qaansheeg")}
          </p>
          <p className="num font-semibold">{invoice.invoice_number}</p>
          <p className="text-ink-500">{tr("Issued")}{' '}{formatBusinessDate(invoice.issue_date)}</p>
          {invoice.due_date ? <p className="text-ink-500">{tr("Due")}{' '}{formatBusinessDate(invoice.due_date)}</p> : null}
        </div>
      </div>

      <div className={`mt-6 ${compact ? 'border-t border-dashed border-ink-300 pt-3' : 'flex justify-between gap-8 border-t border-line pt-6'}`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{tr("Bill to")}</p>
          <p className="font-semibold">{invoice.bill_to_name ?? invoice.customer_display_name ?? tr("Walk-in customer")}</p>
          {invoice.bill_to_phone ? <p className="num text-ink-500">{invoice.bill_to_phone}</p> : null}
        </div>
        {!compact ? (
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{tr("Category")}</p>
            <p className="font-semibold">{invoice.category_name ?? '—'}</p>
          </div>
        ) : null}
      </div>

      <table className={`mt-5 w-full border-collapse ${compact ? 'text-[11px]' : ''}`}>
        <thead>
          <tr className="border-b border-ink-300 text-left text-xs uppercase tracking-wide text-ink-500">
            <th className="py-2">{tr("Description")}</th>
            <th className="py-2 text-right">{tr("Qty")}</th>
            {!compact ? <th className="py-2 text-right">{tr("Unit price")}</th> : null}
            <th className="py-2 text-right">{tr("Total")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-line">
              <td className="py-2 pr-3">{item.description}</td>
              <td className="num py-2 text-right">{Number(item.quantity)}</td>
              {!compact ? <td className="num py-2 text-right">{formatMoney(money(item.unit_price, currency.decimals), currency)}</td> : null}
              <td className="num py-2 text-right font-semibold">{formatMoney(money(item.line_total, currency.decimals), currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={`mt-4 ${compact ? '' : 'flex justify-end'}`}>
        <dl className={`flex flex-col gap-1.5 ${compact ? 'w-full' : 'w-72'}`}>
          <div className="flex justify-between"><dt className="text-ink-500">{tr("Subtotal")}</dt><dd className="num">{formatMoney(money(invoice.subtotal, currency.decimals), currency)}</dd></div>
          {money(invoice.discount_amount, currency.decimals) > 0 ? (
            <div className="flex justify-between"><dt className="text-ink-500">{tr("Discount")}</dt><dd className="num">−{formatMoney(money(invoice.discount_amount, currency.decimals), currency)}</dd></div>
          ) : null}
          <div className="flex justify-between border-t border-ink-300 pt-1.5 text-base font-bold"><dt>{tr("Total")}</dt><dd className="num">{formatMoney(total, currency)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-500">{tr("Paid")}</dt><dd className="num">{formatMoney(paid, currency)}</dd></div>
          <div className="flex justify-between font-semibold"><dt>{tr("Balance due")}</dt><dd className="num">{formatMoney(balance, currency)}</dd></div>
        </dl>
      </div>

      {payments.length ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{tr("Payments received")}</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {payments.map((payment) => (
              <li key={payment.id} className={`flex justify-between ${payment.status === 'voided' ? 'text-ink-400 line-through' : ''}`}>
                <span>
                  {formatBusinessDate(payment.business_date)} · {payment.payment_method_name} · {payment.reference_label}
                </span>
                <span className="num">
                  {payment.kind === 'refund' ? '−' : ''}
                  {formatMoney(money(payment.amount, currency.decimals), currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {invoice.notes ? <p className="mt-5 text-ink-600">{invoice.notes}</p> : null}
      <p className={`mt-6 border-t border-line pt-3 text-center text-xs text-ink-500 ${compact ? '' : 'text-left'}`}>
        {footer ?? tr("Thank you — mahadsanid!")}
      </p>
      <p className="mt-1 text-center text-[10px] text-ink-400">{tr("Generated by GYMATICK")}</p>
    </div>
  )
}
