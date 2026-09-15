import { NavLink, Outlet } from 'react-router'
import { Banknote, Building2, CircleUser, Tags, Users } from 'lucide-react'
import { useSession } from '@/app/providers/SessionProvider'
import { PageHeader } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { tr } from '@/i18n'

export default function SettingsLayout() {
  const { can } = useSession()
  const sections = [
    { to: '/settings/business', label: tr("Business profile"), icon: <Building2 className="size-4" />, allowed: can('settings.manage') },
    { to: '/settings/preferences', label: tr("Financial preferences"), icon: <Banknote className="size-4" />, allowed: can('settings.manage') },
    { to: '/settings/categories', label: tr("Categories"), icon: <Tags className="size-4" />, allowed: can('settings.manage') },
    { to: '/settings/payment-methods', label: tr("Payment methods"), icon: <Banknote className="size-4" />, allowed: can('settings.manage') },
    { to: '/settings/users', label: tr("Users & roles"), icon: <Users className="size-4" />, allowed: can('users.manage') },
    { to: '/settings/profile', label: tr("My profile"), icon: <CircleUser className="size-4" />, allowed: true },
  ].filter((section) => section.allowed)

  return (
    <>
      <PageHeader title={tr("Settings")} subtitle={tr("Dejinta · How GYMATICK works for this gym")} />
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label={tr("Settings sections")}>
          {sections.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              className={({ isActive, isPending }) =>
                cn(
                  'flex h-10 shrink-0 items-center gap-2.5 rounded-[10px] px-3 text-sm font-medium transition-colors',
                  isActive || isPending ? 'bg-brand-50 font-semibold text-brand-600' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                )
              }
            >
              {section.icon}
              {section.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex min-w-0 flex-col gap-4">
          <Outlet />
        </div>
      </div>
    </>
  )
}
