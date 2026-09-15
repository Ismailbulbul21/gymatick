import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { UserPlus, UsersRound } from 'lucide-react'
import { listCustomers, saveCustomer, setCustomerStatus } from '@/lib/api'
import { queryClient, queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Avatar, Button, Card, EmptyState, ErrorState, PageHeader, StatusBadge } from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/ui/table'
import { FilterBar, SearchInput } from '@/components/ui/filters'
import { Modal } from '@/components/ui/overlay'
import { Field, Input, Textarea } from '@/components/ui/form'
import { toast } from '@/components/ui/toast'
import type { Customer } from '@/types/db'

export default function CustomersPage() {
  const business = useBusiness()
  const { can } = useSession()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const list = useQuery({
    queryKey: queryKeys.customerList(business.business_id, { search }),
    queryFn: () => listCustomers(business.business_id, search, 100),
    placeholderData: (previous) => previous,
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) => setCustomerStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer updated')
    },
    onError: (error) => toast.error(error),
  })

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer',
      priority: 1,
      mobile: 'title',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.full_name} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink-900">{row.full_name}</p>
            <p className="num truncate text-xs text-ink-500">{row.phone ?? '—'}</p>
          </div>
        </div>
      ),
    },
    { key: 'code', header: 'Member code', priority: 2, mobile: 'meta', cell: (row) => <span className="num">{row.member_code ?? '—'}</span> },
    { key: 'email', header: 'Email', priority: 3, mobile: 'hide', cell: (row) => row.email ?? '—' },
    { key: 'status', header: 'Status', priority: 2, mobile: 'meta', cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      priority: 1,
      mobile: 'hide',
      cell: (row) =>
        can('customers.manage') ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setEditing(row)}>Edit</Button>
            {can('customers.deactivate') ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => statusMutation.mutate({ id: row.id, status: row.status === 'active' ? 'inactive' : 'active' })}
              >
                {row.status === 'active' ? 'Deactivate' : 'Reactivate'}
              </Button>
            ) : null}
          </div>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Macaamiisha · Members and people who pay the gym"
        actions={can('customers.manage') ? <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setAddOpen(true)}>Add customer</Button> : null}
      />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone or member code…" />
      </FilterBar>

      <Card className="overflow-hidden">
        {list.isError ? (
          <ErrorState message="Could not load customers" onRetry={() => void list.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            rows={list.data ?? []}
            keyOf={(row) => row.id}
            loading={list.isLoading && !list.data}
            caption="Customers"
            empty={
              <EmptyState
                icon={<UsersRound className="size-6" />}
                title="No customers yet"
                description="Customers are added as you record income or create invoices — or add them here."
                actions={can('customers.manage') ? <Button variant="primary" onClick={() => setAddOpen(true)}>Add customer</Button> : undefined}
              />
            }
          />
        )}
      </Card>

      <CustomerModal open={addOpen || Boolean(editing)} customer={editing} onClose={() => { setAddOpen(false); setEditing(null) }} />
    </>
  )
}

function CustomerModal({ open, customer, onClose }: { open: boolean; customer: Customer | null; onClose: () => void }) {
  const business = useBusiness()
  const [fullName, setFullName] = useState(customer?.full_name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [memberCode, setMemberCode] = useState(customer?.member_code ?? '')
  const [notes, setNotes] = useState(customer?.notes ?? '')

  const mutation = useMutation({
    mutationFn: () =>
      saveCustomer(
        business.business_id,
        {
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          member_code: memberCode.trim(),
          notes: notes.trim(),
        },
        customer?.id,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success(customer ? 'Customer updated' : 'Customer added')
      onClose()
    },
    onError: (error) => toast.error(error),
  })

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={customer ? 'Edit customer' : 'Add customer'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={() => {
              if (!fullName.trim()) return toast.info('Enter the customer name')
              mutation.mutate()
            }}
          >
            {customer ? 'Save changes' : 'Add customer'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Full name"><Input value={fullName} onChange={(event) => setFullName(event.target.value)} autoFocus /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" optional><Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" /></Field>
          <Field label="Member code" optional><Input value={memberCode} onChange={(event) => setMemberCode(event.target.value)} placeholder="GYM-0001" /></Field>
        </div>
        <Field label="Email" optional><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        <Field label="Notes" optional><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
      </div>
    </Modal>
  )
}
