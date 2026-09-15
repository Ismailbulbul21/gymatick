import type { ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './primitives'

const overlayClass =
  'fixed inset-0 z-40 bg-ink-950/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in'

/** Centered dialog for confirmations and short forms. */
export function Modal({ open, onOpenChange, title, description, icon, children, footer, size = 'md' }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const widths = { sm: 'max-w-[420px]', md: 'max-w-[540px]', lg: 'max-w-[720px]' }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl',
            widths[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div className="flex min-w-0 gap-3">
              {icon}
              <div className="min-w-0">
                <Dialog.Title className="text-lg font-semibold text-ink-900">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-1 text-sm text-ink-500">{description}</Dialog.Description>
                ) : null}
              </div>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X className="size-[18px]" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2 px-6 py-4">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Side drawer on desktop, bottom sheet on phones — used for recording money. */
export function Drawer({ open, onOpenChange, title, description, icon, children, footer }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex flex-col border-line bg-surface shadow-2xl',
            'inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl border-t',
            'sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-[460px] sm:rounded-none sm:rounded-l-2xl sm:border-l sm:border-t-0',
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="flex min-w-0 items-start gap-3">
              {icon}
              <div className="min-w-0">
                <Dialog.Title className="text-lg font-semibold text-ink-900">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-0.5 text-sm text-ink-500">{description}</Dialog.Description>
                ) : null}
              </div>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X className="size-[18px]" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer ? <div className="border-t border-line bg-surface-2 px-5 py-4">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Confirmation for anything irreversible: lists the consequences in plain words. */
export function ConfirmDialog({
  open, onOpenChange, title, description, icon, consequences, confirmLabel, cancelLabel = 'Cancel',
  onConfirm, loading, destructive, children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  consequences?: ReactNode[]
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  loading?: boolean
  destructive?: boolean
  children?: ReactNode
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      icon={icon}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={loading}>{cancelLabel}</Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {children}
        {consequences?.length ? (
          <ul className="flex flex-col gap-2 text-sm text-ink-600">
            {consequences.map((item, index) => (
              <li key={index} className="flex gap-2">
                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ink-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Modal>
  )
}
