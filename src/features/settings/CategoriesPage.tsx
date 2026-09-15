import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Lock, Plus } from 'lucide-react'
import { listCategories, saveCategory, setCategoryStatus } from '@/lib/api'
import { queryClient, queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Forbidden } from '@/app/guards'
import { Button, Card, CardHeader, Dot, Segmented, Skeleton, StatusBadge } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/overlay'
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/form'
import { toast } from '@/components/ui/toast'
import { CATEGORY_COLORS, categoryColor } from '@/lib/utils'
import type { Category, CategoryKind } from '@/types/db'

export default function CategoriesPage() {
  const business = useBusiness()
  const { can } = useSession()
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [editing, setEditing] = useState<Category | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const list = useQuery({
    queryKey: queryKeys.categories(business.business_id),
    queryFn: () => listCategories(business.business_id),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) => setCategoryStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category updated')
    },
    onError: (error) => toast.error(error),
  })

  if (!can('settings.manage')) return <Forbidden what="categories" />

  const rows = (list.data ?? []).filter((category) => category.kind === kind)

  return (
    <>
      <Card>
        <CardHeader
          title="Categories"
          description="Used when recording income and expenses"
          action={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>Add category</Button>}
        />
        <div className="p-5 pt-4">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: 'Income' },
            ]}
          />
          <ul className="mt-4 divide-y divide-line">
            {list.isLoading
              ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="my-2 h-10" />)
              : rows.map((category) => (
                  <li key={category.id} className="flex items-center gap-3 py-3">
                    <Dot color={categoryColor(category.color)} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                        {category.name}
                        {category.is_system ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600">
                            <Lock className="size-3" /> System
                          </span>
                        ) : null}
                      </p>
                      {category.description ? <p className="truncate text-xs text-ink-500">{category.description}</p> : null}
                      {category.is_system ? <p className="text-xs text-ink-500">Used automatically by salary payments</p> : null}
                    </div>
                    <StatusBadge status={category.status} />
                    <Switch
                      label={`${category.name} active`}
                      checked={category.status === 'active'}
                      onChange={(checked) => {
                        if (category.is_system) {
                          toast.info('System categories cannot be deactivated')
                          return
                        }
                        statusMutation.mutate({ id: category.id, status: checked ? 'active' : 'inactive' })
                      }}
                    />
                    <Button size="sm" disabled={category.is_system} onClick={() => setEditing(category)}>Edit</Button>
                  </li>
                ))}
          </ul>
        </div>
      </Card>

      <CategoryModal
        open={addOpen || Boolean(editing)}
        category={editing}
        kind={kind}
        onClose={() => {
          setAddOpen(false)
          setEditing(null)
        }}
      />
    </>
  )
}

function CategoryModal({ open, category, kind, onClose }: {
  open: boolean
  category: Category | null
  kind: CategoryKind
  onClose: () => void
}) {
  const business = useBusiness()
  const [name, setName] = useState(category?.name ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [color, setColor] = useState(category?.color ?? 'blue')

  const mutation = useMutation({
    mutationFn: () =>
      saveCategory(
        business.business_id,
        { kind: category?.kind ?? kind, name: name.trim(), description: description.trim(), color },
        category?.id,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success(category ? 'Category updated' : 'Category added')
      onClose()
    },
    onError: (error) => toast.error(error),
  })

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={category ? 'Edit category' : `Add ${kind} category`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={() => {
              if (!name.trim()) return toast.info('Enter a category name')
              mutation.mutate()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Name"><Input value={name} onChange={(event) => setName(event.target.value)} autoFocus /></Field>
        <Field label="Colour">
          <Select value={color} onChange={(event) => setColor(event.target.value)}>
            {Object.keys(CATEGORY_COLORS).map((key) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </Select>
        </Field>
        <Field label="Description" optional><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
      </div>
    </Modal>
  )
}
