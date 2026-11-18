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

### Booking emails (Resend)

1. Create an account at [resend.com](https://resend.com) → **API Keys** → create a key.
2. Add to `.env.local`: `RESEND_API_KEY`, `ADMIN_EMAIL` (where new-booking alerts go) and
   `NEXT_PUBLIC_SITE_URL`. Restart the dev server.
3. **Testing:** keep `EMAIL_FROM=Solar Layout <onboarding@resend.dev>`. Resend only delivers this test
   sender's mail to your own Resend account email, so book with that address to see both emails.
4. **Going live:** in Resend → **Domains**, add your domain and the DNS records it shows, then set
   `EMAIL_FROM` to an address on it (e.g. `Solar Layout <bookings@yourdomain.com>`).

Without `RESEND_API_KEY`, bookings still save; the emails are skipped and logged.

How access is enforced:
- `proxy.ts` redirects non-admins away from `/admin`.
- Every admin page and Server Action calls `requireAdmin()` (`lib/auth.ts`).
- Row Level Security in the database is the last line: guests can only read active products and
  create bookings; only the admin role can change products, read bookings, or upload photos.

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

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
