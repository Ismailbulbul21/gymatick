# GYMATICK — Gym Financial Management & Administration

Financial command center for the GYMATICK gym: income, expenses, invoices, salaries, daily closing (**Xisaab Xir**), reports, and a full audit trail.

> The full specification is in [GYMATICK_IMPLEMENTATION_PROMPT.md](GYMATICK_IMPLEMENTATION_PROMPT.md).

## What is built

| Area | Screens |
| --- | --- |
| Sign-in | Login, forgot / reset password, forced change of temporary passwords, sign-out after inactivity |
| Setup | First-run onboarding: gym profile → payment methods → opening balances |
| Money | Dashboard, Income, Expenses, Transactions ledger (edit, void, refund, transfer, owner deposit / withdrawal) |
| Xisaab Xir | Daily closing per payment method, closing history, closing detail with later corrections, owner reopen |
| Billing | Invoices (paid now, unpaid, or linked to a payment already recorded), print view |
| People | Employees with salary history; monthly salaries with payments, advances, adjustments and arrears |
| Insights | Reports with CSV export, activity (audit) log |
| Settings | Business profile, financial preferences, categories, payment methods, users & roles, my profile |

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 19 + TypeScript, React Compiler, Vite 8 |
| Styling | Tailwind CSS 4 (design tokens in `src/index.css`, light and dark themes) |
| Data | Supabase (Postgres 17, Auth, Row Level Security, Edge Functions) |
| Server state | TanStack Query 5 |
| Routing | React Router 7 (every screen lazy-loaded) |
| Forms | Controlled React state with shared money/date validators (`src/lib/money.ts`, `src/components/ui/form.tsx`) |
| Charts / icons | Recharts 3 / Lucide |
| Tests | Vitest 5 (money, finance and key-safety unit tests) |

## Supabase project

- Name: `gymatick` · Ref: `phzweuqzlyqhrjsxecob` · Region: `eu-central-1` (Frankfurt)
- API URL: `https://phzweuqzlyqhrjsxecob.supabase.co`
- Plan: Free. Upgrade to **Pro** before real financial data goes in (free projects pause after 7 days of inactivity and have no automatic backups).
- Schema: 20 migrations in `supabase/migrations/`, all applied to this project.
- Edge Function: `admin-users` (create users with a temporary password, reset passwords, deactivate / reactivate).

The live **GYMATICK** gym starts empty and goes through setup when its owner first signs in. The earlier development gyms are kept in the database as `GYMATICK (demo archive)` and `Other Gym (demo archive)`: nothing was deleted, no active account opens them, and their three test sign-ins are blocked (`auth.users.banned_until`).

A user guide for gym staff — daily routine, every screen, fixing mistakes, roles — is published as the *GYMATICK Handbook*.

## Getting started

Requires Node.js 22.19 or newer.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill `.env.local` with the project URL and the **publishable** key (Supabase → Project Settings → API Keys), then:

```bash
npm run dev
```

The app opens at http://localhost:5173.

## Setting up a new environment

1. Link the project and apply the migrations:

   ```bash
   npx supabase link --project-ref <project-ref>
   ```

   ```bash
   npx supabase db push
   ```

2. Deploy the Edge Function and allow your site's address to call it (defaults to `http://localhost:5173`):

   ```bash
   npx supabase functions deploy admin-users
   ```

   ```bash
   npx supabase secrets set ALLOWED_ORIGINS=https://your-gymatick-domain
   ```

3. Create the owner in Supabase → Authentication → Users (**Add user**, auto-confirm), then create the gym in the SQL editor:

   ```sql
   select private.bootstrap_business('<owner user id>', 'GYMATICK', 'USD', 'Africa/Mogadishu');
   ```

4. Sign in as the owner. Onboarding asks for the payment methods and opening balances; after that, add staff from **Settings → Users & roles**.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server (explains what to do if port 5173 is already in use) |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript only |
| `npm run lint` | Oxlint |
| `npm test` | Unit tests (Vitest) |
| `npm run db:types` | Regenerate `src/types/database.types.ts` (run `npx supabase login` first) |

## How the data is protected

- Every table has Row Level Security. Screens read through security-invoker views, so a person only sees their own gym.
- Every change goes through a database function that checks the person's permission first (`private.assert_permission`). The Supabase advisor warning *"Signed-In Users Can Execute SECURITY DEFINER Function"* is expected for these functions.
- Money is never deleted: corrections are voids with a reason. Closed days are locked; only an owner can reopen them.
- There are two roles. **Admin** (`owner`) has every permission. **Shaqaale** (`staff`) gets exactly the permissions marked `staff_allowed` in `public.permissions`: all daily recording (income, expenses, refunds, transfers, invoices and their payments, salary payments, Xisaab Xir, reports) but nothing that removes or reverses records. Voiding, cancelling invoices, deactivating, reopening closed days, owner money, employees, settings and users stay with the Admin.
- The `admin_*` database functions can only be called by the `admin-users` Edge Function (service role), which verifies the caller's sign-in and origin.
- The audit log is append-only.
- Only browser-safe values go in `VITE_*` variables; the app refuses to start if a secret or service-role key is placed there. `.env*` files are git-ignored (except `.env.example`).

## Deploying to Vercel

1. In the Vercel project, open Settings → Environment Variables and add, for Production and Preview:
   - `VITE_SUPABASE_URL` = `https://phzweuqzlyqhrjsxecob.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = the publishable key from `.env.local` (it is designed to be public; never add a secret or service-role key)
2. Redeploy. Vite reads these at build time, so a deployment made before they existed keeps showing "GYMATICK could not start".
3. In Supabase → Authentication → URL Configuration, set the Site URL to the Vercel address and add `https://<your-domain>/**` to the redirect URLs, so password-reset emails open the live site.
4. The `admin-users` Edge Function accepts calls from `https://gymatick.vercel.app` and localhost. For another domain, set the `ALLOWED_ORIGINS` secret.

`vercel.json` sends every path to `index.html`, so refreshing a page such as `/dashboard` works.

## Before real money goes in

- Upgrade the Supabase project to Pro (daily backups, no pausing).
- Turn on leaked-password protection (Authentication → Sign In / Providers → Email).
- Set the Auth **Site URL** and redirect URLs, and the `ALLOWED_ORIGINS` secret, to the production address.
- Remove the development test accounts and sample data, or start from a fresh project.

## Known limitations

- One branch per gym in the interface (the schema already has branches).
- The interface switches between English and Somali (EN / SO at the top of the screen). The Somali text is in `src/i18n/so.ts`, keyed by the English — have a native speaker review it; any text missing there shows in English. Category and payment method names are data and show as they were typed.
- Customers are switched off for this gym (`FEATURES.customers` in `src/lib/features.ts`). The tables and database functions are kept, so the feature can be turned back on without losing anything.
- Oxlint reports `set-state-in-effect` warnings in a few forms; behaviour is correct, but they are candidates for refactoring.

## Folder layout

```
src/
  app/            Router, app shell, route guards, session and theme providers
  components/     UI kit: primitives, forms, tables, overlays, filters, charts, brand
  features/       One folder per area (money, closings, invoices, salaries, settings, …)
  lib/            Supabase client, API calls, admin calls, money/date helpers, error messages
  types/          Domain types that mirror the database
supabase/
  config.toml     Local Supabase CLI configuration
  migrations/     SQL migrations (source of truth for the schema)
  functions/      Edge Functions (admin-users)
design/prototypes Early design exploration (not part of the app build)
```
