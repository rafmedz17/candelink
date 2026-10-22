# CANDELINK

Where Candelaria Connects. A local professional networking and job marketplace for Candelaria, Quezon.

## Local setup

Requires Node.js 22+ and npm. This application lives in the `candelink/` subdirectory of the workspace.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Without Supabase configuration, public pages display **explicitly fictional sample content**. Authentication, saving, uploads, and private dashboards explain the missing configuration and never simulate a successful database write. Once configured, public pages use the database and never silently substitute samples on database errors.

## Supabase setup

1. Create a project and copy its URL and **publishable** API key into `.env.local`. Set `NEXT_PUBLIC_SITE_URL` to the actual application origin. No service-role key is used by the application.
2. Install the Supabase CLI and inspect `supabase --help`. With Docker, start a fresh local development stack using `supabase start`, then apply the baseline with `supabase db reset` (this resets local data). For hosted projects, link with `supabase link --project-ref YOUR_REF`, review, and apply using `supabase db push`. The baseline SQL can alternatively be applied once through the trusted SQL editor on a fresh project.
3. The migration creates tables, indexes, grants, RLS, triggers, RPCs, and Storage buckets: private `cvs` (PDF, 5 MB) and public `avatars` (JPEG/PNG, 5 MB). Logos and avatars are intentionally public. CVs use immutable owner-prefixed UUID paths and 60-second signed URLs.
4. Configure Auth Site URL and allowed redirects for `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/callback?next=/reset-password`, and their production equivalents. Keep email confirmations enabled. Verify confirmation and recovery email templates with the code-exchange callback flow.
5. Configure production SMTP. Without SMTP, provider development email limits apply. Hiring updates use persistent in-app notifications; transactional hiring email is not integrated.
6. Configure Auth rate limits, CAPTCHA, password protections, and email quotas. SQL provides persistent daily limits for applications (30), business creation (3), job inserts (20), verification requests (5), and reports (10) per authenticated account.
7. Seed data is fictional, pending, and in draft; it creates no fake verified companies. Register real staging users to test role journeys. Owners can create profiles, request verification, and draft listings before administrator approval. Editing verified business details returns the business to pending and closes published jobs for re-review.

### Assigning an administrator

Register and confirm the intended user. A trusted operator can run the following in the project's SQL editor, substituting a real Auth UUID:

```sql
update public.profiles set role = 'admin'
where id = 'REPLACE_WITH_AUTH_USER_UUID'::uuid;
```

Never expose this operation publicly. Registration can only select jobseeker or business owner. User-editable metadata cannot assign admin; client UPDATE privileges exclude profile `role` and `suspended`. Protected pages validate the user with `getUser()` and read trusted database role data. RLS and scoped RPCs independently enforce operations. Moderation writes its audit record in the same transaction.

## Structure and stack

```text
app/                    App Router pages, server actions, auth callback
  [auth]/               Login, registration, recovery, legal documents
  jobs/                 Public search, details, applications
  businesses/           Public directory and business profiles
  dashboard/            Jobseeker profile, applications, saved jobs, updates
  business/dashboard/   Business details, verification, jobs, applicants
  admin/                Protected moderation and audit workspace
components/             Shared layouts, cards, forms, file controls
  ui/button.tsx         shadcn-style Radix Slot/CVA button primitive
lib/                    SSR client, authorization, Zod, data access
proxy.ts                Session refresh and private cache headers
supabase/migrations/    Reproducible baseline SQL
supabase/seed.sql       Fictional pending business and draft job
tests/database.test.mjs PostgreSQL authorization/integrity tests
tests/e2e/              Desktop/mobile browser journeys
scripts/                Local preview inspection helper
```

Next.js App Router, TypeScript, Tailwind v4, Lucide, React Hook Form, Zod, Supabase Auth/Postgres/Storage, and a local shadcn-style Radix/CVA button. Geist is self-hosted through `@fontsource/geist`; builds do not fetch Google Fonts. Unsplash presentation photos and Pravatar decorative sample avatars are bundled in `public/images` and optimized with `next/image`; there are no third-party image requests at runtime. Source URLs are recorded in `public/images/SOURCES.md`. Replace presentation assets with licensed production branding as appropriate.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Database tests apply the real migration to embedded PostgreSQL (PGlite), supplying minimal `auth` and `storage` schemas, then change SQL roles and authenticated IDs to test actual grants, RLS, constraints, triggers, and RPCs. They cover spoofed admin registration, forbidden privilege changes, private/public reads, unverified publishing, cross-business isolation, CV access, duplicate applications, notes, notifications, withdrawals, bookmarks, suspension, and audit immutability. This does **not** replace integration testing with Supabase Auth, PostgREST, or Storage services.

Browser tests run in **unconfigured sample mode**; do not point them at a live database. They cover search, filters, details, honest bookmark/auth feedback, empty states, admin setup privacy, and viewport overflow. Run `npm run build` first. Tests start the production build at `http://localhost:3100` and leave the normal development server on port 3000 alone. `npm run format` formats application source.

Before deployment, verify these against a staging project:

- Register and confirm a seeker, two owners, and an admin; test login, logout, recovery, and expired links.
- Create both businesses, request verification, approve one, and confirm only it can publish.
- Apply with a PDF; confirm duplicate denial, status changes, notifications, and eligible withdrawal.
- Confirm unrelated users cannot access applications, private profile data, hiring notes, or CVs through direct API calls.
- Confirm upload size/type limits, CV URL expiry, and public image access.
- Confirm every admin operation denies non-admins, suspension blocks account operations, and audit entries persist.
- Run Supabase security advisors against the actual deployed database.

## Vercel deployment checklist

- [ ] Apply reviewed migrations to staging; perform live integration checks, then migrate production.
- [ ] Enable backups, review retention/deletion procedures, configure Auth/SMTP/CAPTCHA limits.
- [ ] Import the GitHub repository into Vercel; set root directory to this application directory and select Next.js with Node.js 22+.
- [ ] Configure the three variables in `.env.example`; use the production origin for `NEXT_PUBLIC_SITE_URL`.
- [ ] Add production Auth callback URLs, then deploy with `npm run build`.
- [ ] Assign the first admin through trusted SQL and test each role using separate accounts.
- [ ] Replace example contact details and complete a legal/privacy review with the platform operator.
- [ ] Verify mobile/keyboard behavior, image availability, error monitoring, and signed CV expiry.
- [ ] Commit source and lockfile to GitHub. Real `.env` files are ignored; `.env.example` is tracked.

## Known limitations

- No hosted Supabase project, GitHub remote, or Vercel deployment has been configured by this implementation. Live Auth, email, PostgREST joins, and Storage require the staging checks above. Docker was unavailable, so the full local Supabase stack was not exercised.
- Education, experience, and skills are editable text in v1. Structured entries, public professional profiles, networking connections, and a social feed remain future work. Recommended jobs are recent listings, not personalized rankings.
- Membership supports multiple users in the schema; invitations and membership administration require a trusted operator. Dashboard navigation defaults to the first owned business; use its business selector to switch.
- No automated identity-document verification, malware scanning, hiring email integration, realtime subscriptions, old-CV cleanup, or automated account deletion. MIME/signature checks do not prove a document is harmless.
- Admin/business tables use bounded provider results rather than large-dataset pagination. Public job discovery uses database-side filters, sorting, and eight-record pagination. Search uses case-insensitive keyword matching; a full-text index is included for future ranking.
- Analytics use counts and application-status totals; historical charts are not implemented. Legal pages are labeled drafts, and contact email addresses are placeholders. Samples claim no endorsements or verified businesses.
- The installed Next ESLint dependency chain reports a high-severity `braces` development-tool advisory. Its suggested fix is an incompatible Next 14 downgrade, which was not applied. Recheck upstream before launch; audit production packages separately using `npm audit --omit=dev`.

Implementation references: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) and [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
