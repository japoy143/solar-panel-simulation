# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Stack notes

- Next.js 16 App Router, React 19, TypeScript strict, npm. Path alias `@/*` → repo root.
- `next.config.ts` enables `cacheComponents` and `partialPrefetching` — check `node_modules/next/dist/docs/` for how these change data fetching/caching before writing server components or using `fetch`/dynamic APIs.
- Tailwind v4 is loaded through a Turbopack CSS loader rule in `next.config.ts` (`@tailwindcss/turbopack`), **not** PostCSS. Don't add a `postcss.config` or `tailwind.config`; the design system (colors, fonts, `eyebrow` subheading utility) lives in `app/globals.css`. Use semantic tokens (`primary`, `primary-strong`, `foreground`, `muted-foreground`…), never raw hex. Green text on white must use `text-primary-strong` (`primary` fails contrast at small sizes).
- 3D layout rendering uses three.js / react-three-fiber. R3F `<Canvas>` and anything using its hooks must be in `"use client"` components.
- Simulator (`/simulator`): state is a persisted zustand store in `lib/simulator/store.ts` (call `useSimulator.persist.rehydrate()` after mount — it uses `skipHydration`). Buildings, geometry (snap/clamp/collision), and summary are pure functions in `lib/simulator/`; 3D components live in `components/simulator/` and are loaded via `next/dynamic` with `ssr: false` from `simulator-loader.tsx` — don't import `simulator.tsx` from server code.

## Checks

No test framework yet. Before calling a change done, run `npx tsc --noEmit`, `npm run lint`, and `npm run build` (or `/verify`).

## Git

Use Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
