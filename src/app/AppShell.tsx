import { LanguageSwitch } from '@/components/ui/LanguageSwitch'
import { FEATURES } from '@/lib/features'
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavLink, Outlet, ScrollRestoration, useLocation, useNavigate, useNavigation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { DropdownMenu } from 'radix-ui'
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BadgeDollarSign, CalendarDays, Calculator, ChartColumn,
  CircleUser, LayoutDashboard, LogOut, Menu, Moon, Plus, ReceiptText, Settings, Sun, Users, UsersRound, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBusiness, useSession } from './providers/SessionProvider'
import { useTheme } from './providers/ThemeProvider'
import { GymatickLogo, GymatickMark } from '@/components/brand/Logo'
import { Avatar, Badge, Button } from '@/components/ui/primitives'
import { RecordMoneyDrawer } from '@/features/money/RecordMoneyDrawer'
import { getDashboard, listCategories, listPaymentMethods, recordSignIn } from '@/lib/api'
import { preloadScreens } from './screens'
import { useIdleSignOut } from './useIdleSignOut'
import { queryClient, queryKeys } from '@/lib/query-client'
import { formatBusinessDate } from '@/lib/dates'
import { tr } from '@/i18n'

interface QuickActions {
  addIncome: () => void
  addExpense: () => void
}
const QuickActionsCtx = createContext<QuickActions | null>(null)
export function useQuickActions(): QuickActions {
  const ctx = use(QuickActionsCtx)
  if (!ctx) throw new Error('useQuickActions must be used inside the app shell')
  return ctx
}

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  permission?: string
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="size-[18px]" /> }] },
  {
    label: 'Money',
    items: [
      { to: '/income', label: 'Income', icon: <ArrowDownLeft className="size-[18px]" />, permission: 'income.view' },
      { to: '/expenses', label: 'Expenses', icon: <ArrowUpRight className="size-[18px]" />, permission: 'expenses.view' },
      { to: '/transactions', label: 'Transactions', icon: <ArrowLeftRight className="size-[18px]" />, permission: 'transactions.view_all' },
      { to: '/xisaab-xir', label: 'Xisaab Xir', icon: <Calculator className="size-[18px]" />, permission: 'closings.view' },
    ],
  },
  {
    label: 'Billing',
    items: [
      { to: '/invoices', label: 'Invoices', icon: <ReceiptText className="size-[18px]" />, permission: 'invoices.view' },
      ...(FEATURES.customers
        ? [{ to: '/customers', label: 'Customers', icon: <UsersRound className="size-[18px]" />, permission: 'customers.view' }]
        : []),
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/employees', label: 'Employees', icon: <Users className="size-[18px]" />, permission: 'employees.view' },
      { to: '/salaries', label: 'Salaries', icon: <BadgeDollarSign className="size-[18px]" />, permission: 'salaries.view' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/reports', label: 'Reports', icon: <ChartColumn className="size-[18px]" />, permission: 'reports.view' },
      { to: '/activity', label: 'Activity log', icon: <Activity className="size-[18px]" />, permission: 'audit.view' },
    ],
  },
  { label: 'System', items: [{ to: '/settings', label: 'Settings', icon: <Settings className="size-[18px]" /> }] },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useSession()
  return (
    <nav className="flex flex-col gap-3.5" aria-label={tr("Main")}>
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => !item.permission || can(item.permission))
        if (!items.length) return null
        return (
          <div key={group.label} className="flex flex-col gap-0.5">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-white/45">{tr(group.label)}</p>
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={({ isActive, isPending }) =>
                  cn(
                    'flex h-9 items-center gap-3 rounded-[10px] px-3 text-sm font-medium text-white/75 transition-colors',
                    isActive || isPending ? 'bg-brand-600 font-semibold text-white shadow-[0_6px_16px_-8px_rgba(36,73,220,0.9)]' : 'hover:bg-white/[0.07] hover:text-white',
                  )
                }
              >
                {item.icon}
                {tr(item.label)}
              </NavLink>
            ))}
          </div>
        )
      })}
    </nav>
  )
}

function ClosingCard() {
  const business = useBusiness()
  const { can } = useSession()
  const navigate = useNavigate()
  const dashboard = useQuery({
    queryKey: queryKeys.dashboard(business.business_id),
    queryFn: () => getDashboard(business.business_id),
  })
  const status = (dashboard.data as { closing_status?: { is_closed: boolean; closed_at: string | null; difference_total: number | null; is_balanced: boolean | null } } | undefined)?.closing_status
  const closed = status?.is_closed

  return (
    <div className="mt-auto flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/[0.06] p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white/45">
        {tr("Today ·")}{' '}{formatBusinessDate(business.business_date, 'd MMM')}
      </p>
      {closed ? (
        <>
          <p className="text-sm font-semibold text-white">{tr("Closed")}</p>
          {status?.is_balanced === false ? (
            <p className="num text-xs font-semibold text-expense-400">{tr("Difference")}{' '}{Number(status.difference_total ?? 0).toFixed(2)}</p>
          ) : (
            <p className="text-xs text-white/60">{tr("Balanced")}</p>
          )}
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="size-2 rounded-full bg-brand-400 ring-4 ring-brand-400/20" aria-hidden />
            {tr("Open · not closed yet")}
          </p>
          {can('closings.perform') ? (
            <Button variant="primary" size="sm" className="w-full" icon={<Calculator className="size-4" />} onClick={() => navigate('/xisaab-xir')}>
              {tr("Close day")}
            </Button>
          ) : (
            <p className="text-xs text-white/60">{tr("The manager closes the day with Xisaab Xir.")}</p>
          )}
        </>
      )}
    </div>
  )
}

function UserMenu() {
  const { context, signOut, membership } = useSession()
  const { choice, setChoice } = useTheme()
  const navigate = useNavigate()
  const name = context?.user.full_name ?? 'User'

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left hover:bg-white/10">
          <Avatar name={name} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{name}</span>
            <span className="block truncate text-xs text-white/55">
              {membership?.role === 'owner' ? tr("Admin") : membership?.title ?? tr("Shaqaale")}
            </span>
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="z-50 w-56 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg"
        >
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 outline-none hover:bg-ink-50"
            onSelect={() => navigate('/settings/profile')}
          >
            <CircleUser className="size-4" />{' '}{tr("My profile")}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Label className="px-3 py-1 text-xs font-semibold text-ink-500">{tr("Theme")}</DropdownMenu.Label>
          {(['system', 'light', 'dark'] as const).map((option) => (
            <DropdownMenu.Item
              key={option}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-ink-50',
                choice === option ? 'font-semibold text-brand-600' : 'text-ink-700',
              )}
              onSelect={() => setChoice(option)}
            >
              {option === 'dark' ? <Moon className="size-4" /> : option === 'light' ? <Sun className="size-4" /> : <Settings className="size-4" />}
              <span>{tr(option.charAt(0).toUpperCase() + option.slice(1))}</span>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-expense-600 outline-none hover:bg-expense-50"
            onSelect={() => void signOut()}
          >
            <LogOut className="size-4" />{' '}{tr("Sign out")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function NewMenu({ onIncome, onExpense }: { onIncome: () => void; onExpense: () => void }) {
  const { can } = useSession()
  const navigate = useNavigate()
  const actions = [
    can('income.create') && { label: tr("Add income"), icon: <ArrowDownLeft className="size-4" />, run: onIncome },
    can('expenses.create') && { label: tr("Add expense"), icon: <ArrowUpRight className="size-4" />, run: onExpense },
    can('invoices.create') && { label: tr("New invoice"), icon: <ReceiptText className="size-4" />, run: () => navigate('/invoices/new') },
    can('salaries.pay') && { label: tr("Pay salary"), icon: <BadgeDollarSign className="size-4" />, run: () => navigate('/salaries') },
    can('closings.perform') && { label: tr("Xisaab Xir"), icon: <Calculator className="size-4" />, run: () => navigate('/xisaab-xir') },
  ].filter(Boolean) as { label: string; icon: ReactNode; run: () => void }[]

  if (!actions.length) return null

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="primary" size="sm" icon={<Plus className="size-4" />}>{tr("New")}</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-52 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg">
          {actions.map((action) => (
            <DropdownMenu.Item
              key={action.label}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 outline-none hover:bg-ink-50"
              onSelect={action.run}
            >
              {action.icon}
              {action.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function AppShell() {
  const business = useBusiness()
  const location = useLocation()
  const [mobileNav, setMobileNav] = useState(false)
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)

  useEffect(() => setMobileNav(false), [location.pathname])

  // Keeps "last signed in" current on Users & roles; the database audits a sign-in at most every 30 minutes.
  useEffect(() => {
    recordSignIn(business.business_id).catch(() => undefined)
  }, [business.business_id])

  useIdleSignOut(business.settings.idle_timeout_minutes)
  const navigation = useNavigation()

  // Screens, and the lists every form needs, load in the background so opening a feature is instant.
  useEffect(() => preloadScreens(), [])
  useEffect(() => {
    const id = business.business_id
    void queryClient.prefetchQuery({ queryKey: queryKeys.categories(id), queryFn: () => listCategories(id) })
    void queryClient.prefetchQuery({ queryKey: queryKeys.paymentMethods(id), queryFn: () => listPaymentMethods(id) })
  }, [business.business_id])

  const quickActions = useMemo<QuickActions>(
    () => ({ addIncome: () => setIncomeOpen(true), addExpense: () => setExpenseOpen(true) }),
    [],
  )

  return (
    <QuickActionsCtx value={quickActions}>
      <div className="flex min-h-svh bg-canvas">
        <ScrollRestoration />
        {navigation.state === 'loading' ? (
          <div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-brand-600/15" role="progressbar" aria-label={tr("Opening page")}>
            <div className="h-full w-1/3 bg-brand-600 motion-safe:animate-[route-progress_900ms_ease-in-out_infinite]" />
          </div>
        ) : null}
        {/* Sidebar (desktop) */}
        <aside className="hidden w-[264px] shrink-0 flex-col gap-4 bg-sidebar px-3.5 pb-4 pt-5 lg:flex">
          <div className="px-2">
            <GymatickLogo />
          </div>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{business.business_name}</p>
              <p className="truncate text-xs text-white/55">{tr("Main branch")}{business.is_demo ? tr(" · demo data") : ''}</p>
            </div>
          </div>
          <NavLinks />
          <ClosingCard />
          <div className="border-t border-white/10 pt-2">
            <UserMenu />
          </div>
        </aside>

        {/* Mobile navigation drawer */}
        {mobileNav ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" aria-label={tr("Close menu")} className="absolute inset-0 bg-ink-950/50" onClick={() => setMobileNav(false)} />
            <div className="absolute inset-y-0 left-0 flex w-[280px] flex-col gap-4 overflow-y-auto bg-sidebar px-3.5 pb-4 pt-5">
              <div className="flex items-center justify-between px-2">
                <GymatickLogo />
                <Button variant="ghost" size="icon" aria-label={tr("Close menu")} onClick={() => setMobileNav(false)} className="text-white">
                  <X className="size-5" />
                </Button>
              </div>
              <NavLinks onNavigate={() => setMobileNav(false)} />
              <div className="mt-auto border-t border-white/10 pt-2">
                <UserMenu />
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 lg:px-8">
            <Button variant="ghost" size="icon" aria-label={tr("Open menu")} className="lg:hidden" onClick={() => setMobileNav(true)}>
              <Menu className="size-5" />
            </Button>
            <span className="lg:hidden">
              <GymatickMark size={28} />
            </span>
            <span className="hidden items-center gap-2 rounded-[10px] border border-line px-3 py-1.5 text-[13px] font-semibold text-ink-900 sm:flex">
              <CalendarDays className="size-4 text-ink-500" aria-hidden />
              {formatBusinessDate(business.business_date, 'EEE, d MMM yyyy')}
            </span>
            <span className="hidden text-xs text-ink-500 md:inline">{business.settings.timezone}</span>
            <div className="flex-1" />
            {business.is_demo ? <Badge tone="warning">{tr("Demo data")}</Badge> : null}
            <LanguageSwitch />
            <NewMenu onIncome={() => setIncomeOpen(true)} onExpense={() => setExpenseOpen(true)} />
          </header>

          <main className="flex-1 px-4 pb-24 pt-6 lg:px-8 lg:pb-10">
            <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
              <Outlet />
            </div>
          </main>
        </div>

        <RecordMoneyDrawer mode="income" open={incomeOpen} onOpenChange={setIncomeOpen} />
        <RecordMoneyDrawer mode="expense" open={expenseOpen} onOpenChange={setExpenseOpen} />
      </div>
    </QuickActionsCtx>
  )
}
