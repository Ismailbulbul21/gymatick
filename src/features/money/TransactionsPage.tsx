import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, HandCoins } from 'lucide-react'
import { getDashboard } from '@/lib/api'
import { queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Button, Card, Skeleton } from '@/components/ui/primitives'
import { TransactionsScreen } from './TransactionsScreen'
import { OwnerMovementDialog, TransferDialog } from './MoneyMovementDialogs'
import { formatBusinessDate } from '@/lib/dates'
import { formatMoney, money } from '@/lib/money'

const METHOD_COLORS = ['var(--color-method-1)', 'var(--color-method-2)', 'var(--color-method-3)', 'var(--color-method-4)', 'var(--color-method-5)']

export default function TransactionsPage() {
  const business = useBusiness()
  const { currency, can } = useSession()
  const [transferOpen, setTransferOpen] = useState(false)
  const [ownerOpen, setOwnerOpen] = useState(false)

  const summary = useQuery({
    queryKey: queryKeys.dashboard(business.business_id),
    queryFn: () => getDashboard(business.business_id),
    enabled: can('dashboard.financials'),
  })
  const balance = summary.data?.balance

  const balanceCard = can('dashboard.financials') ? (
    <Card className="flex flex-wrap items-stretch gap-y-4 p-4">
      <div className="min-w-[220px] px-2">
        <p className="text-xs font-semibold text-ink-600">Current balance</p>
        {summary.isLoading ? (
          <Skeleton className="mt-1 h-7 w-32" />
        ) : (
          <p className="num text-[22px] font-bold text-ink-900">
            {formatMoney(money(balance?.total ?? 0, currency.decimals), currency)}
          </p>
        )}
        <p className="text-xs text-ink-500">
          {balance?.checkpoint_date
            ? `Counted ${formatBusinessDate(balance.checkpoint_date, 'd MMM')} + movements since`
            : 'From the opening balances'}
        </p>
      </div>
      {(balance?.by_method ?? []).map((method, index) => (
        <div key={method.payment_method_id} className="min-w-[130px] border-l border-line px-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-600">
            <span className="size-2 rounded-sm" style={{ background: METHOD_COLORS[index % METHOD_COLORS.length] }} aria-hidden />
            {method.name}
          </p>
          <p className="num text-lg font-bold text-ink-900">{formatMoney(money(method.balance, currency.decimals), currency)}</p>
        </div>
      ))}
    </Card>
  ) : null

  return (
    <>
      <TransactionsScreen
        mode="all"
        summary={balanceCard}
        extraActions={
          <>
            {can('money.owner_movements') ? (
              <Button icon={<HandCoins className="size-4" />} onClick={() => setOwnerOpen(true)}>Owner money</Button>
            ) : null}
            {can('money.transfer') ? (
              <Button icon={<ArrowLeftRight className="size-4" />} onClick={() => setTransferOpen(true)}>Transfer</Button>
            ) : null}
          </>
        }
      />

      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
      <OwnerMovementDialog open={ownerOpen} onOpenChange={setOwnerOpen} />
    </>
  )
}
