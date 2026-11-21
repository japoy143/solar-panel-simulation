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

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Under *Settings → Environment Variables*, add:

   | Variable | Required | Value |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Supabase publishable key |
   | `NEXT_PUBLIC_SITE_URL` | Once you have a custom domain | e.g. `https://www.example.com` (no trailing slash) |

   `NEXT_PUBLIC_SITE_URL` drives canonical URLs, `sitemap.xml`, `robots.txt`, and social images.
   Until it's set, the site uses Vercel's production URL. Redeploy after changing any of these;
   they're read at build time.

### SEO after deploying

SEO settings live in `lib/site.ts` (name, description, keywords) and each page's `metadata`.
Generated routes: `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/opengraph-image`, `/icon`.

- Submit `https://<your-domain>/sitemap.xml` in [Google Search Console](https://search.google.com/search-console) (and Bing Webmaster Tools).
- Check structured data on `/`, `/products`, and `/booking` with the [Rich Results Test](https://search.google.com/test/rich-results).
- Check the social preview with any Open Graph previewer.
