import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { listAudit, listMembers } from '@/lib/api'
import { queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/primitives'
import { DateRangeFilter, FilterBar, FilterSelect } from '@/components/ui/filters'
import { Modal } from '@/components/ui/overlay'
import { formatBusinessDate, formatBusinessDateTime, presetRange, type DatePreset } from '@/lib/dates'
import type { AuditRow } from '@/types/db'

const MODULES = ['all', 'income', 'expenses', 'transactions', 'invoices', 'salaries', 'employees', 'closings', 'customers', 'settings', 'users', 'reports', 'auth']

export default function ActivityPage() {
  const business = useBusiness()
  const { timezone } = useSession()
  const [preset, setPreset] = useState<DatePreset>('last_7')
  const [range, setRange] = useState(() => presetRange('last_7', business.business_date, business.settings.week_starts_on))
  const [module, setModule] = useState('all')
  const [actorId, setActorId] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<AuditRow | null>(null)

  const list = useQuery({
    queryKey: queryKeys.audit(business.business_id, { ...range, module, actorId, page }),
    queryFn: () => listAudit(business.business_id, { ...range, module, actorId: actorId || undefined, page, pageSize: 50 }),
    placeholderData: (previous) => previous,
  })
  const members = useQuery({
    queryKey: queryKeys.members(business.business_id),
    queryFn: () => listMembers(business.business_id),
  })

  const nameOf = (id: string | null) =>
    members.data?.find((member) => member.user_id === id)?.profiles?.full_name ?? (id ? 'A user' : 'System')

  const rows = list.data?.rows ?? []
  const days = rows.reduce<Record<string, AuditRow[]>>((groups, row) => {
    const day = row.created_at.slice(0, 10)
    ;(groups[day] ??= []).push(row)
    return groups
  }, {})

  return (
    <>
      <PageHeader title="Activity log" subtitle="Diiwaanka Hawlaha · Who did what, and when" />

      <FilterBar>
        <DateRangeFilter
          value={range}
          preset={preset}
          businessToday={business.business_date}
          weekStartsOn={business.settings.week_starts_on}
          onChange={(next, nextPreset) => { setRange(next); setPreset(nextPreset); setPage(0) }}
        />
        <FilterSelect
          label="Module"
          value={module}
          onChange={(value) => { setModule(value); setPage(0) }}
          options={MODULES.map((item) => ({ value: item, label: item === 'all' ? 'All' : item }))}
        />
        <FilterSelect
          label="User"
          value={actorId}
          onChange={(value) => { setActorId(value); setPage(0) }}
          options={[
            { value: '', label: 'Anyone' },
            ...(members.data ?? []).map((member) => ({ value: member.user_id, label: member.profiles?.full_name ?? 'User' })),
          ]}
        />
      </FilterBar>

      <Card className="overflow-hidden">
        {list.isError ? (
          <ErrorState message="Could not load the activity log" onRetry={() => void list.refetch()} />
        ) : list.isLoading && !list.data ? (
          <div className="flex flex-col gap-2 p-4">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-12" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Activity className="size-6" />} title="Nothing recorded in this period" description="Choose a wider date range to see earlier activity." />
        ) : (
          <div className="flex flex-col">
            {Object.entries(days).map(([day, entries]) => (
              <section key={day}>
                <h2 className="border-b border-line bg-surface-2 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {formatBusinessDate(day, 'EEEE, d MMM yyyy')}
                </h2>
                <ul className="divide-y divide-line">
                  {entries.map((entry) => (
                    <li key={entry.id}>
                      <button type="button" onClick={() => setSelected(entry)} className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-ink-50">
                        <span className="num w-12 shrink-0 pt-0.5 text-xs text-ink-500">{formatBusinessDateTime(entry.created_at, timezone).slice(-5)}</span>
                        <Avatar name={nameOf(entry.actor_id)} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-ink-900">
                            <span className="font-semibold">{nameOf(entry.actor_id)}</span> · {entry.summary}
                          </span>
                          <span className="text-xs text-ink-500">{entry.action}</span>
                        </span>
                        <Badge tone="neutral">{entry.module}</Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        {(list.data?.count ?? 0) > 50 ? (
          <div className="flex items-center justify-between border-t border-line px-5 py-3">
            <span className="text-sm text-ink-500">
              Showing {rows.length} of {list.data?.count} entries
            </span>
            <div className="flex gap-2">
              <Button size="sm" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Newer</Button>
              <Button size="sm" disabled={(page + 1) * 50 >= (list.data?.count ?? 0)} onClick={() => setPage((current) => current + 1)}>Older</Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Modal
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        title="Activity details"
        description={selected ? `${selected.action} · ${formatBusinessDateTime(selected.created_at, timezone)}` : undefined}
      >
        {selected ? (
          <div className="flex flex-col gap-4 text-sm">
            <p className="text-ink-900">{selected.summary}</p>
            <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-y-2">
              <dt className="text-ink-500">Person</dt><dd className="font-medium">{nameOf(selected.actor_id)}</dd>
              <dt className="text-ink-500">Module</dt><dd className="capitalize">{selected.module}</dd>
              <dt className="text-ink-500">Record</dt><dd className="num text-xs">{selected.entity_type} {selected.entity_id ?? ''}</dd>
            </dl>
            {selected.changes ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Changes</p>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-500">
                      <th className="py-1">Field</th><th className="py-1">Before</th><th className="py-1">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(selected.changes).map(([field, change]) => (
                      <tr key={field} className="border-t border-line">
                        <td className="py-1.5 pr-3 font-medium text-ink-900">{field.replace(/_/g, ' ')}</td>
                        <td className="py-1.5 pr-3 text-ink-500">{String(change?.from ?? '—')}</td>
                        <td className="py-1.5 text-ink-900">{String(change?.to ?? '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {selected.metadata && Object.keys(selected.metadata).length ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Extra information</p>
                <ul className="flex flex-col gap-1 text-ink-700">
                  {Object.entries(selected.metadata).map(([field, value]) => (
                    <li key={field}>
                      <span className="text-ink-500">{field.replace(/_/g, ' ')}: </span>
                      {String(value)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  )
}
