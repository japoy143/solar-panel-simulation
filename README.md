This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Backend setup (Supabase)

Products, bookings, product photos and the admin login live in [Supabase](https://supabase.com).
Customers browse as guests; only the single admin account can open `/admin`.

1. **Create a project** at supabase.com (the free tier is fine).
2. **Add keys:** copy `.env.example` to `.env.local` and fill in the values from
   *Project Settings → API*. Restart `npm run dev` afterwards.
3. **Create the tables:** open *SQL Editor*, paste `supabase/migrations/0001_init.sql`, and run it.
   This creates `products` and `bookings`, the security rules, the `product-images` bucket,
   and the six starter products.
4. **Turn off sign-ups:** *Authentication → Sign In / Providers → Email*: disable
   "Allow new users to sign up". The admin is the only account.
5. **Create the admin:** *Authentication → Users → Add user* (email + password, auto-confirm). Then
   run this in the SQL Editor with that email:

   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
   where email = 'you@example.com';
   ```
6. Sign in at `/admin/login`.
7. **More products (optional):** run `supabase/migrations/0002_more_products.sql` the same way to add
   extra panels, hybrid inverters and batteries (and battery output ratings used by the simulator's
   backup-power estimates).
8. **Clients & messages:** run `supabase/migrations/0003_clients_messages.sql`. It adds `clients`
   (one per email address, created automatically for every new booking and backfilled from existing
   ones), the `messages` conversation log, and the notification fields. Then add the
   **service role key** (*Project Settings → API → `service_role`/secret key*) to `.env.local` as
   `SUPABASE_SERVICE_ROLE_KEY`. It bypasses Row Level Security, so keep it server-side only: it's
   used solely to record the automatic booking emails and by the Resend webhook.

### Booking emails (Resend)

1. Create an account at [resend.com](https://resend.com) → **API Keys** → create a key.
2. Add to `.env.local`: `RESEND_API_KEY`, `ADMIN_EMAIL` (where new-booking alerts go) and
   `NEXT_PUBLIC_SITE_URL`. Restart the dev server.
3. **Testing:** keep `EMAIL_FROM=Solar Layout <onboarding@resend.dev>`. Resend only delivers this test
   sender's mail to your own Resend account email, so book with that address to see both emails.
4. **Going live:** in Resend → **Domains**, add your domain and the DNS records it shows, then set
   `EMAIL_FROM` to an address on it (e.g. `Solar Layout <bookings@yourdomain.com>`).

Without `RESEND_API_KEY`, bookings still save; the emails are skipped and logged.

### Client conversations (two-way email)

Each client has a conversation at `/admin/clients/[id]`. Emails you send there, the automatic
booking emails, and the client's replies all appear in one thread. The bell in the admin sidebar
shows unread replies, unopened bookings and failed emails.

Sending works as soon as `RESEND_API_KEY` is set. For **replies to come back into the thread**:

1. Resend → **Domains**: add a receiving (sub)domain, e.g. `inbound.yourdomain.com`, enable
   receiving and add the MX record it shows. Set `INBOUND_DOMAIN=inbound.yourdomain.com`.
   Client emails then use `reply+<clientId>@inbound.yourdomain.com` as Reply-To, so each reply
   lands in the right thread.
2. Resend → **Webhooks**: add `https://<your-site>/api/webhooks/resend` with the events
   `email.received`, `email.delivered`, `email.bounced`, `email.failed` and `email.suppressed`.
   Copy its signing secret into `RESEND_WEBHOOK_SECRET`. Requests without a valid signature are
   rejected.
3. Local testing: expose the dev server with a tunnel (e.g. `ngrok http 3000`) and use that URL for
   the webhook.

Until receiving is set up, replies go to `ADMIN_EMAIL` as before. Replies from addresses that
don't belong to a client are ignored (and logged), so spam doesn't create clients.

How access is enforced:
- `proxy.ts` redirects non-admins away from `/admin`.
- Every admin page and Server Action calls `requireAdmin()` (`lib/auth.ts`).
- Row Level Security in the database is the last line: guests can only read active products and
  create bookings; only the admin role can change products, read bookings, or upload photos.
  Clients and messages are admin-only too; a database trigger links each new booking to its client.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Under *Settings → Environment Variables*, add:

   | Variable | Required | Value |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Supabase publishable key |
   | `NEXT_PUBLIC_SITE_URL` | Once you have a custom domain | e.g. `https://www.example.com` (no trailing slash) |
   | `SUPABASE_SERVICE_ROLE_KEY` | For client threads + webhook | Server-only; never prefix with `NEXT_PUBLIC_` |
   | `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL` | For booking emails | See *Booking emails* above |
   | `INBOUND_DOMAIN`, `RESEND_WEBHOOK_SECRET` | For two-way email | See *Client conversations* above |
   | `LOG_LEVEL` | No | Defaults to `info` in production |

   `NEXT_PUBLIC_SITE_URL` drives canonical URLs, `sitemap.xml`, `robots.txt`, social images, and
   links in emails.
   Until it's set, the site uses Vercel's production URL. Redeploy after changing any of these;
   they're read at build time.

### SEO after deploying

SEO settings live in `lib/site.ts` (name, description, keywords) and each page's `metadata`.
Generated routes: `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/opengraph-image`, `/icon`.

- Submit `https://<your-domain>/sitemap.xml` in [Google Search Console](https://search.google.com/search-console) (and Bing Webmaster Tools).
- Check structured data on `/`, `/products`, and `/booking` with the [Rich Results Test](https://search.google.com/test/rich-results).
- Check the social preview with any Open Graph previewer.
