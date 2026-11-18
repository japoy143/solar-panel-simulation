---
name: verify
description: Verify the project still type-checks, lints, and builds. Use after making code changes and before declaring work done or committing.
---

Run these from the repo root, in order, and stop at the first failure to fix it:

1. `npx tsc --noEmit` — type check (strict mode).
2. `npm run lint` — ESLint 9 flat config (next core-web-vitals + typescript).
3. `npm run build` — production build; catches Server/Client Component boundary errors (e.g. R3F code missing `"use client"`) and `cacheComponents` violations that tsc and lint miss.

For each failure, read the error, fix the root cause (don't add `// @ts-ignore` or eslint-disable comments unless the user agrees), and re-run that step.

Finish with a short report: each step pass/fail, and what you fixed.
