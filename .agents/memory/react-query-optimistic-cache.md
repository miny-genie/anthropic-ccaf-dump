---
name: React Query optimistic cache clobbering
description: Why the attempt query needs a scoped high staleTime — background refetches overwrite optimistic setQueryData writes, and a GLOBAL staleTime regresses other pages.
---

# Optimistic cache writes get clobbered by default refetch

The exam-practice frontend drives its TanStack Query caches **entirely through optimistic
`setQueryData`** (the attempt cache in `pages/exam.tsx`). The Orval-generated mutation hooks do
**no** query invalidation, so a mutation's UI effect is whatever the component writes into the
cache by hand.

**The bug it caused:** in practice mode, re-clicking the selected option clears the answer
optimistically (`selectedOption: null`, feedback hidden) and `POST /answer` fires — but a racing
background refetch of `GET /attempts/:id` returned the not-yet-cleared server state and the
feedback reappeared and *stuck*. curl can't catch this; only an e2e/browser test surfaced it.

**What actually fixes it — and what does NOT:**
- `refetchOnWindowFocus: false` ALONE is **not enough**. Disabling focus refetch did not stop the
  clobber — other triggers (visibilitychange/reconnect/observer remount under the test harness)
  still refetched with the default `staleTime: 0`.
- The decisive lever is a **high `staleTime`** on the optimistic-owned query, which makes any
  refetch serve the cache instead of hitting the network. Apply `staleTime: Infinity` **scoped to
  `useGetAttempt`** (the query owned by optimistic writes).
- Do **NOT** set `staleTime` globally on the QueryClient. Because nothing invalidates, a global
  staleTime makes dashboard / notebook / history reuse stale cache for the whole window after
  mutations (e.g. stale "Practice Progress" on return). Keep other queries at default
  on-mount freshness.
- Keeping `refetchOnWindowFocus: false` globally is fine as harmless defense-in-depth, but it is
  not the fix.

**How to apply:** Keep the optimistic-write + cache-seed pattern. Protect each optimistic-owned
query with its own high `staleTime`; never reach for a global staleTime to fix a clobber. Fresh
server state still loads on hard reload (empty cache). If you ever add mutation invalidation,
re-evaluate.
