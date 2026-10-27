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

Use the sun/moon button in the header to switch themes. Appearance follows your device preference until you make a selection, which is saved locally and shared across tabs. The theme is applied before the first paint to avoid a light flash on dark-mode visits.

The interface starts with single-column phone layouts and expands for tablets and desktops. Job filters collapse on phones, form controls use readable text and large tap targets, and workspace navigation scrolls independently. Registration includes account-type cards and a password visibility control. Employer cards retain the selected business while navigating; applicant details expand on demand, and final application statuses are read-only.

## Supabase setup

### Business pins and opportunity map

Apply `20261023144902_business_opportunity_map.sql` after the earlier migrations. In **Business workspace → Business profile**, owners can click the map, drag their pin, enter latitude/longitude, or request their current location, then choose **Save business location**. A business profile must exist first. Only active members can save/remove its pin. With `20261026155238_preserve_business_verification_on_edit.sql`, edits to business details also preserve the administrator's verification decision and leave published jobs open. Newly created businesses still require initial verification.

The public **Map** at `/maps` (also linked from home and job search) shows published, unexpired jobs from verified businesses with saved pins. One marker groups a business's opportunities, with job links and directions in the adjacent list. Moving the map or searching changes the area results; pages contain at most 100 opportunities. Unpinned businesses still appear in normal job discovery. Coordinates are owner-provided business locations, not verified GPS measurements. No applicant location is collected. Browser geolocation is requested only when an owner clicks the location button and is not saved until they choose Save.

Leaflet 1.9.4 is bundled locally. The default basemap uses OpenStreetMap's standard HTTPS tiles with visible attribution, browser caching, and no bulk/offline downloads. No paid map API key is required. Standard tiles are a shared, best-effort service; use a suitable provider for larger deployments and follow the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/). Optional `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_ATTRIBUTION` configure another provider; keep its required attribution. Map controls and the jobs list remain usable if imagery fails to load.

### Friends and messages

Apply all migrations in timestamp order, including `20261025170009_message_requests.sql`, to enable friend requests, private messaging, and message requests. Use **Add friend** on a public profile, then accept or decline requests on **Friends**. Friends and people with accepted message requests can exchange text messages (up to 4,000 characters); a conversation refreshes every 10 seconds while visible. The account menu and all role workspaces include Friends and Messages.

Non-friends can open a public profile and choose **Message** to send one introductory message. Recipients review it in **Messages → Message requests** and can accept or decline. Acceptance enables replies without creating a friendship; declined requests cannot be resent. Apply `supabase/migrations/20261025170009_message_requests.sql` to the hosted database before deploying this feature. The migration keeps existing friendships and message history.

Apply `supabase/migrations/20261025174244_user_blocks.sql` to enable **Block** on profiles, friend cards, and conversations. Blocking prevents messages and friend requests in both directions, revokes existing contact consent, and preserves conversation history. **Friends → Blocked people** lists only your own blocks and provides **Unblock**, including for profiles that later become private. Each person controls their own block; unblocking does not restore friendships or message consent.

Apply `supabase/migrations/20261025175317_hide_blocker_profiles.sql` so blocked accounts cannot find the blocker in people search or open the blocker's public profile by URL. This rule is checked in the database before search counting and pagination, and unblocking restores visibility. Public profiles remain accessible to signed-out visitors because no blocked account can be identified without a session.

Either person can unfriend; new messages then require separately accepted messaging consent. Only participants can read a conversation, including after unfriending; application administrators have no message-read policy. Suspended accounts cannot use these features. There are daily limits of 20 friend requests, 20 new message requests, and 500 messages, plus a 24-hour cooldown before re-requesting friendship after a decline/removal. Message retries use a stable client ID to avoid duplicate sends. Connections paginate in batches of 50, and message history in batches of 30. Messages are stored in the project database; end-to-end encryption, attachments, push notifications, blocking, and read receipts are not implemented.

Apply `20261023140050_unread_conversations.sql` after the friends/messages migration for conversation cards with message previews and unread counts. Numbered badges in workspace navigation and the account menu show unread incoming messages, incoming pending friend requests, and unread notifications; zero counts are hidden and large counts display as `99+`. Counts refresh every 10 seconds while the tab is visible, on focus, and after friend/read actions. Opening a conversation marks messages through the latest displayed message as read only when the bottom of the thread is visible in the active tab. Viewing older history does not clear newer unread messages. Read positions are private to each account and never shown to the other participant. Run the migration before using the counters on your hosted project.

### Project configuration

Application deadlines are optional. Apply `20261023141934_optional_job_deadline.sql` to allow a blank deadline when creating or editing a job. Published jobs without a deadline stay discoverable and accept applications until the business closes them (or loses verification). Supplied dates still expire after that date. Clearing an existing deadline saves `null`; the listing preview and job details display **No deadline**.

Job descriptions are required but have no 30-character minimum. Apply `20261023142607_short_job_descriptions.sql` to accept short descriptions in the database. Empty or whitespace-only descriptions are rejected; the maximum remains 15,000 characters. Business-profile descriptions retain their existing requirements.

Navbar people search suggests up to six public jobseeker profiles after typing two characters, matching names, headlines, or skills. Select a person to open their profile, use the arrow keys and Enter, or choose **See all results** to open `/people?q=...`. The dropdown supports touch, Escape, and outside-click dismissal. Apply `supabase/migrations/20261023101354_people_search.sql` after the public-profiles migration, then apply `20261023132944_people_search_exclude_self.sql` to exclude the signed-in user's own account from results and pagination counts. Private and suspended profiles do not appear; results never include CV paths, email, or account permissions.

1. Create a project and copy its URL and **publishable** API key into `.env.local`. Set `NEXT_PUBLIC_SITE_URL` to the actual application origin. Permanent admin account deletion additionally uses a server-only `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`). Never prefix that secret with `NEXT_PUBLIC_`.
2. Install the Supabase CLI and inspect `supabase --help`. With Docker, start a fresh local development stack using `supabase start`, then apply the baseline with `supabase db reset` (this resets local data). For hosted projects, link with `supabase link --project-ref YOUR_REF`, review, and apply using `supabase db push`. The baseline SQL can alternatively be applied once through the trusted SQL editor on a fresh project.
3. The migrations create tables, indexes, grants, RLS, triggers, RPCs, and Storage buckets: private `cvs` (PDF, 5 MB) and public `avatars` (JPEG/PNG, 5 MB). Logos and avatars are intentionally public. CVs use immutable owner-prefixed UUID paths and 60-second signed URLs. Apply every migration, including `20261022191840_public_profiles.sql`, after the baseline.
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

Apply `supabase/migrations/20261025205746_people_default_directory.sql` to browse public profiles at `/people` without a keyword. The directory filters as you type with a 300 ms debounce; clearing the input restores the default list immediately. Results are paginated in groups of 12 and retain the same role, visibility, suspension, self-exclusion, and blocking rules.

Apply `supabase/migrations/20261025203311_public_business_owner_profiles.sql` for public professional profiles belonging to either jobseekers or business owners. Profiles remain private until their owner enables visibility. Business owners can manage their professional details, photo, and visibility in **Business dashboard → Business profile**. The homepage community avatars link to real public accounts; people search and direct profile links honor suspension and blocking rules.

Business profiles display the optional uploaded logo and up to six optional background photos. Multiple photos rotate every five seconds with previous/next and pause controls; reduced-motion preferences stop automatic rotation. Owners manage these in **Business dashboard → Business profile**. Apply `supabase/migrations/20261025194720_business_profile_images.sql` first. JPEG and PNG uploads use the existing public `avatars` bucket, up to 5 MB per photo. Removing a background photo detaches it from that business without deleting a potentially shared Storage object.

Admin **User management** supports permanent deletion of other accounts after typing `DELETE`. The signed-in admin cannot delete their own account; the server and database preparation also enforce this. Apply `supabase/migrations/20261025180134_admin_user_deletion.sql`, set the server-only `SUPABASE_SECRET_KEY` in `.env.local` or your hosting environment, and restart the server. The action disables the target first, removes their files through the Storage API, and deletes their Auth account; profile-owned records cascade while authored audit/review records retain anonymous references. Jobs belonging to businesses with no remaining active member are closed. If cleanup fails, the account stays disabled and the admin can retry deletion.

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

On Windows, an installed Microsoft Edge can run the browser checks by setting `PLAYWRIGHT_CHANNEL=msedge`; otherwise install the Playwright Chromium browser. The responsive review covers 320px phones through desktop widths. Authenticated workspace journeys still require the staging accounts described below.

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
- Education, experience, and skills are editable text in v1. Jobseekers can opt in to a public, link-shareable professional profile; their email, CV, applications, saved jobs, and notifications remain private. Friend requests and text messaging are supported; structured profile entries and a social feed remain future work. Recommended jobs are recent listings, not personalized rankings.
- Membership supports multiple users in the schema; invitations and membership administration require a trusted operator. Dashboard navigation defaults to the first owned business; use its business selector to switch.
- No automated identity-document verification, malware scanning, hiring email integration, realtime subscriptions, old-CV cleanup, or automated account deletion. MIME/signature checks do not prove a document is harmless.
- Admin/business tables use bounded provider results rather than large-dataset pagination. Public job discovery uses database-side filters, sorting, and eight-record pagination. Search uses case-insensitive keyword matching; a full-text index is included for future ranking.
- Analytics use counts and application-status totals; historical charts are not implemented. Legal pages are labeled drafts, and contact email addresses are placeholders. Samples claim no endorsements or verified businesses.
- The installed Next ESLint dependency chain reports a high-severity `braces` development-tool advisory. Its suggested fix is an incompatible Next 14 downgrade, which was not applied. Recheck upstream before launch; audit production packages separately using `npm audit --omit=dev`.

Implementation references: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) and [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
