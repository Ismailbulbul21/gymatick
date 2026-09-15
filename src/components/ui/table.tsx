import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, Skeleton } from './primitives'
import { tr } from '@/i18n'

export interface Column<T> {
  key: string
  header: ReactNode
  align?: 'left' | 'right'
  /** 1 = always visible; 2 = hidden on small screens; 3 = hidden below large screens. */
  priority?: 1 | 2 | 3
  width?: string
  cell: (row: T) => ReactNode
  /** Shown in the mobile card under the title. */
  mobile?: 'title' | 'value' | 'meta' | 'hide'
}

export function DataTable<T>({ columns, rows, keyOf, onRowClick, loading, empty, rowClassName, caption }: {
  columns: Column<T>[]
  rows: T[]
  keyOf: (row: T) => string
  onRowClick?: (row: T) => void
  loading?: boolean
  empty?: ReactNode
  rowClassName?: (row: T) => string | undefined
  caption?: string
}) {
  const priorityClass = (priority: 1 | 2 | 3 = 1) =>
    priority === 1 ? '' : priority === 2 ? 'hidden md:table-cell' : 'hidden lg:table-cell'

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (!rows.length) return <>{empty}</>

  const title = columns.find((c) => c.mobile === 'title') ?? columns[0]!
  const value = columns.find((c) => c.mobile === 'value')
  const meta = columns.filter((c) => c.mobile === 'meta')

  return (
    <>
      {/* Desktop and tablet: a real table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={cn(
                    'h-10 whitespace-nowrap border-b border-line bg-surface-2 px-4 text-xs font-semibold text-ink-500',
                    column.align === 'right' ? 'text-right' : 'text-left',
                    priorityClass(column.priority),
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={keyOf(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-line last:border-b-0',
                  onRowClick && 'cursor-pointer hover:bg-ink-50',
                  rowClassName?.(row),
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'h-14 px-4 text-[13.5px] text-ink-600',
                      column.align === 'right' ? 'text-right' : 'text-left',
                      priorityClass(column.priority),
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: cards, never a shrunken table */}
      <ul className="flex flex-col divide-y divide-line sm:hidden">
        {rows.map((row) => (
          <li key={keyOf(row)}>
            <button
              type="button"
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn('flex w-full flex-col gap-1 px-4 py-3 text-left', rowClassName?.(row))}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 text-sm font-semibold text-ink-900">{title.cell(row)}</div>
                {value ? <div className="shrink-0 text-sm">{value.cell(row)}</div> : null}
              </div>
              {meta.length ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                  {meta.map((column) => (
                    <span key={column.key}>{column.cell(row)}</span>
                  ))}
                </div>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, label = 'entries' }: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  label?: string
}) {
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min((page + 1) * pageSize, total)
  const lastPage = Math.max(Math.ceil(total / pageSize) - 1, 0)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-sm text-ink-500">
        {tr("Showing")}{' '}<span className="num font-semibold text-ink-900">{from}–{to}</span>{' '}{tr("of")}{' '}
        <span className="num font-semibold text-ink-900">{total}</span> {label}
      </p>
      <div className="flex items-center gap-2">
        {onPageSizeChange ? (
          <select
            aria-label={tr("Rows per page")}
            className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-xs font-semibold text-ink-700"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {[25, 50, 100].map((size) => (
              <option key={size} value={size}>{size}{' '}{tr("/ page")}</option>
            ))}
          </select>
        ) : null}
        <Button size="icon" aria-label={tr("Previous page")} disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="num text-sm font-semibold text-ink-700">{page + 1} / {lastPage + 1}</span>
        <Button size="icon" aria-label={tr("Next page")} disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
