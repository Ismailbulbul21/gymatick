import type { MemberRole } from '@/types/db'

/** The gym uses two roles: owners are shown as Admin, staff as Shaqaale. */
export const ROLE_LABEL: Record<MemberRole, string> = { owner: 'Admin', staff: 'Shaqaale' }

export const ROLE_SUMMARY: Record<MemberRole, string> = {
  owner: 'Can do everything: record and correct money, void entries, reopen closed days, manage employees, settings and users.',
  staff: 'Records all daily money work — income, expenses, invoices, salaries and Xisaab Xir. Cannot void, cancel, deactivate or reopen anything.',
}
