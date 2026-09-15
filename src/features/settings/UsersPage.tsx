import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Copy, ShieldCheck, UserPlus, UserRound, X } from 'lucide-react'
import { listMembers, listPermissionCatalog, updateMember } from '@/lib/api'
import { adminCreateMember, adminResetPassword, adminSetMemberStatus } from '@/lib/admin'
import { queryClient, queryKeys } from '@/lib/query-client'
import { ROLE_LABEL, ROLE_SUMMARY } from '@/lib/roles'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Forbidden } from '@/app/guards'
import { Avatar, Badge, Button, Callout, Card, CardHeader, Segmented, Skeleton, StatusBadge } from '@/components/ui/primitives'
import { ConfirmDialog, Modal } from '@/components/ui/overlay'
import { Field, Input } from '@/components/ui/form'
import { toast } from '@/components/ui/toast'
import { formatBusinessDateTime } from '@/lib/dates'
import type { MemberRole, MemberRow, PermissionRow } from '@/types/db'
import { tr } from '@/i18n'

type Member = MemberRow & { profiles: { full_name: string; phone: string | null } | null }

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: 'staff', label: ROLE_LABEL.staff },
  { value: 'owner', label: ROLE_LABEL.owner },
]

export default function UsersPage() {
  const business = useBusiness()
  const { can, context, timezone } = useSession()
  const [editing, setEditing] = useState<Member | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [tempPassword, setTempPassword] = useState<{ name: string; email: string; password: string } | null>(null)
  const [deactivating, setDeactivating] = useState<Member | null>(null)

  const members = useQuery({
    queryKey: queryKeys.members(business.business_id),
    queryFn: () => listMembers(business.business_id),
  })
  const permissions = useQuery({
    queryKey: queryKeys.permissionsCatalog,
    queryFn: listPermissionCatalog,
  })

  const statusMutation = useMutation({
    mutationFn: ({ memberId, status }: { memberId: string; status: 'active' | 'inactive' }) =>
      adminSetMemberStatus(memberId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members'] })
      setDeactivating(null)
      toast.success(tr("Access updated"))
    },
    onError: (error) => toast.error(error),
  })

  const resetMutation = useMutation({
    mutationFn: (member: Member) => adminResetPassword(member.id),
    onSuccess: (result, member) => {
      setTempPassword({ name: member.profiles?.full_name ?? 'User', email: '', password: result.temporary_password })
    },
    onError: (error) => toast.error(error),
  })

  if (!can('users.manage')) return <Forbidden what={tr("users and roles")} />

  return (
    <>
      <Card>
        <CardHeader
          title={tr("Users & roles")}
          description={tr("Everyone who signs in is an Admin or a Shaqaale")}
          action={<Button size="sm" icon={<UserPlus className="size-4" />} onClick={() => setAddOpen(true)}>{tr("Add user")}</Button>}
        />
        <div className="p-5 pt-4">
          {members.isError ? (
            <Callout tone="danger">{tr("The list of users could not load. Check the connection and reload the page.")}</Callout>
          ) : (
            <ul className="divide-y divide-line">
              {members.isLoading
                ? Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="my-2 h-12" />)
                : (members.data ?? []).map((member) => {
                    const isSelf = member.user_id === context?.user.id
                    const name = member.profiles?.full_name ?? 'User'
                    return (
                      <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
                        <Avatar name={name} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink-900">
                            {name}
                            {isSelf ? <span className="ml-2 text-xs font-medium text-ink-500">{tr("(you)")}</span> : null}
                          </p>
                          <p className="text-xs text-ink-500">
                            {member.title ? `${member.title} · ` : ''}{tr("last signed in")}{' '}
                            {member.last_sign_in_at ? formatBusinessDateTime(member.last_sign_in_at, timezone) : tr("never")}
                          </p>
                        </div>
                        <Badge
                          tone={member.role === 'owner' ? 'info' : 'neutral'}
                          icon={member.role === 'owner' ? <ShieldCheck className="size-3.5" /> : <UserRound className="size-3.5" />}
                        >
                          {tr(ROLE_LABEL[member.role])}
                        </Badge>
                        <StatusBadge status={member.status} />
                        <div className="flex gap-2">
                          <Button size="sm" disabled={isSelf} onClick={() => setEditing(member)}>{tr("Change role")}</Button>
                          <Button size="sm" variant="ghost" disabled={isSelf} onClick={() => resetMutation.mutate(member)}>
                            {tr("Reset password")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isSelf}
                            onClick={() =>
                              member.status === 'active'
                                ? setDeactivating(member)
                                : statusMutation.mutate({ memberId: member.id, status: 'active' })
                            }
                          >
                            {member.status === 'active' ? tr("Deactivate") : tr("Reactivate")}
                          </Button>
                        </div>
                      </li>
                    )
                  })}
            </ul>
          )}
          <Callout tone="info" className="mt-4" icon={<ShieldCheck className="size-[18px] text-brand-600" />}>
            {tr("The database checks the role on every action, so a change applies straight away — even if the person is already signed in.")}
          </Callout>
        </div>
      </Card>

      <RoleModal key={editing?.id ?? 'closed'} member={editing} permissions={permissions.data ?? []} onClose={() => setEditing(null)} />

      <AddUserModal
        open={addOpen}
        permissions={permissions.data ?? []}
        onClose={() => setAddOpen(false)}
        onCreated={(result) => {
          setAddOpen(false)
          setTempPassword({ name: result.full_name, email: result.email, password: result.temporary_password })
        }}
      />

      <Modal
        open={Boolean(tempPassword)}
        onOpenChange={(open) => !open && setTempPassword(null)}
        title={tr("Temporary password")}
        description={tr("Share it privately. It is shown once and must be changed at first sign-in.")}
        footer={<Button variant="primary" onClick={() => setTempPassword(null)}>{tr("Done")}</Button>}
      >
        {tempPassword ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-600">
              {tempPassword.name}
              {tempPassword.email ? ` · ${tempPassword.email}` : ''}
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-4">
              <code className="num flex-1 text-lg font-bold tracking-wide text-ink-900">{tempPassword.password}</code>
              <Button
                icon={<Copy className="size-4" />}
                onClick={() => {
                  void navigator.clipboard.writeText(tempPassword.password)
                  toast.success(tr("Copied"))
                }}
              >
                {tr("Copy")}
              </Button>
            </div>
            <Callout tone="warning">{tr("This password will not be shown again. Send it to the person privately.")}</Callout>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivating)}
        onOpenChange={(open) => !open && setDeactivating(null)}
        destructive
        title={tr("Deactivate {0}?", { 0: deactivating?.profiles?.full_name ?? 'this user' })}
        confirmLabel={tr("Deactivate")}
        loading={statusMutation.isPending}
        onConfirm={() => deactivating && statusMutation.mutate({ memberId: deactivating.id, status: 'inactive' })}
        consequences={[
          tr("They are signed out and cannot sign in again."),
          tr("Everything they recorded stays in the records with their name."),
          tr("You can reactivate them at any time."),
        ]}
      />
    </>
  )
}

/** What the chosen role allows, read from the database's permission list. */
function RoleSummary({ role, permissions }: { role: MemberRole; permissions: PermissionRow[] }) {
  if (role === 'owner') {
    return (
      <Callout tone="info" icon={<ShieldCheck className="size-[18px] text-brand-600" />}>
        {tr(ROLE_SUMMARY.owner)}
      </Callout>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-600">{tr(ROLE_SUMMARY.staff)}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <CapabilityList title={tr("Can")} allowed items={permissions.filter((permission) => permission.staff_allowed)} />
        <CapabilityList title={tr("Cannot")} allowed={false} items={permissions.filter((permission) => !permission.staff_allowed)} />
      </div>
    </div>
  )
}

function CapabilityList({ title, allowed, items }: { title: string; allowed: boolean; items: PermissionRow[] }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-2 text-sm text-ink-900">
            {allowed ? (
              <Check className="mt-0.5 size-4 shrink-0 text-income-700" aria-hidden />
            ) : (
              <X className="mt-0.5 size-4 shrink-0 text-expense-600" aria-hidden />
            )}
            {tr(item.label)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function RoleModal({ member, permissions, onClose }: { member: Member | null; permissions: PermissionRow[]; onClose: () => void }) {
  const [role, setRole] = useState<MemberRole>(member?.role ?? 'staff')
  const [title, setTitle] = useState(member?.title ?? '')
  const name = member?.profiles?.full_name ?? 'this user'

  const mutation = useMutation({
    mutationFn: () => updateMember(member!.id, { role, title: title.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members'] })
      toast.success(tr("{0} is now {1}", { 0: name, 1: tr(ROLE_LABEL[role]) }))
      onClose()
    },
    onError: (error) => toast.error(error),
  })

  return (
    <Modal
      open={Boolean(member)}
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={tr("Role for {0}", { 0: name })}
      footer={
        <>
          <Button onClick={onClose}>{tr("Cancel")}</Button>
          <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>{tr("Save role")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("Role")}>
            <Segmented value={role} onChange={setRole} options={ROLE_OPTIONS.map((option) => ({ ...option, label: tr(option.label) }))} />
          </Field>
          <Field label={tr("Title")} optional>
            <Input id="role-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={tr("e.g. Front desk")} />
          </Field>
        </div>
        <RoleSummary role={role} permissions={permissions} />
      </div>
    </Modal>
  )
}

function AddUserModal({ open, permissions, onClose, onCreated }: {
  open: boolean
  permissions: PermissionRow[]
  onClose: () => void
  onCreated: (result: { full_name: string; email: string; temporary_password: string }) => void
}) {
  const business = useBusiness()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('staff')
  const [title, setTitle] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      adminCreateMember({
        businessId: business.business_id,
        fullName: fullName.trim(),
        email: email.trim(),
        role,
        title: title.trim() || null,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['members'] })
      toast.success(tr("{0} can now sign in as {1}", { 0: fullName.trim(), 1: tr(ROLE_LABEL[role]) }))
      onCreated({ full_name: fullName.trim(), email: email.trim(), temporary_password: result.temporary_password })
      setFullName('')
      setEmail('')
      setTitle('')
      setRole('staff')
    },
    onError: (error) => toast.error(error),
  })

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      size="lg"
      title={tr("Add a user")}
      description={tr("They sign in with a temporary password and choose their own straight away.")}
      footer={
        <>
          <Button onClick={onClose}>{tr("Cancel")}</Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={() => {
              if (!fullName.trim() || !email.trim()) return toast.info(tr("Enter the name and email"))
              mutation.mutate()
            }}
          >
            {tr("Create user")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("Full name")}>
            <Input id="new-user-name" value={fullName} onChange={(event) => setFullName(event.target.value)} autoFocus />
          </Field>
          <Field label={tr("Email")}>
            <Input id="new-user-email" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("Role")}>
            <Segmented value={role} onChange={setRole} options={ROLE_OPTIONS.map((option) => ({ ...option, label: tr(option.label) }))} />
          </Field>
          <Field label={tr("Title")} optional>
            <Input id="new-user-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={tr("e.g. Front desk")} />
          </Field>
        </div>
        <RoleSummary role={role} permissions={permissions} />
      </div>
    </Modal>
  )
}
