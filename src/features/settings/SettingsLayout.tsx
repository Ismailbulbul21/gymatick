import { NavLink, Outlet } from 'react-router'
import { Banknote, Building2, CircleUser, Tags, Users } from 'lucide-react'
import { useSession } from '@/app/providers/SessionProvider'
import { PageHeader } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

export default function SettingsLayout() {
  const { can } = useSession()
  const sections = [
    { to: '/settings/business', label: 'Business profile', icon: <Building2 className="size-4" />, allowed: can('settings.manage') },
    { to: '/settings/preferences', label: 'Financial preferences', icon: <Banknote className="size-4" />, allowed: can('settings.manage') },
    { to: '/settings/categories', label: 'Categories', icon: <Tags className="size-4" />, allowed: can('settings.manage') },
    { to: '/settings/payment-methods', label: 'Payment methods', icon: <Banknote className="size-4" />, allowed: can('settings.manage') },
    { to: '/settings/users', label: 'Users & roles', icon: <Users className="size-4" />, allowed: can('users.manage') },
    { to: '/settings/profile', label: 'My profile', icon: <CircleUser className="size-4" />, allowed: true },
  ].filter((section) => section.allowed)

  return (
    <>
      <PageHeader title="Settings" subtitle="Dejinta · How GYMATICK works for this gym" />
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Settings sections">
          {sections.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              className={({ isActive }) =>
                cn(
                  'flex h-10 shrink-0 items-center gap-2.5 rounded-[10px] px-3 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-50 font-semibold text-brand-600' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
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
