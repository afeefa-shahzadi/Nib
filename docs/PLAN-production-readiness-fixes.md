# Plan: Production Readiness Fixes

This document tracks the tasks required to bring Mycelium to a production-ready status.

## Overview
We are fixing core monetization logic, adding auth session middleware, solving linter compiler blockages, optimizing archive searches, and resolving analytics funnel data tracking.

## Tech Stack
- Next.js 16
- Supabase SSR Auth
- Drizzle ORM (Postgres)
- Tailwind CSS 4

## Success Criteria
- Linter passes fully without warnings.
- Telemetry funnel displays actual database numbers instead of hardcoded zeros.
- Users can visit `/studio` only when logged in, handled by Next.js middleware at the edge.
- Creators receive ad impression payouts from public readers.

---

## Task Breakdown

### Phase 1: Authentication & Cleanup
- [ ] **Task 1: Consolidate Supabase Clients**
  - **Agent**: `devops-engineer`
  - **Files**: 
    - [lib/client.ts](file:///o:/Projects/mycelium-next/lib/client.ts)
    - [lib/server.ts](file:///o:/Projects/mycelium-next/lib/server.ts)
  - **Description**: Re-export Supabase clients from `lib/supabase/*` to eliminate duplicate logic.
  - **Verify**: Code compiles and dev server launches.
- [ ] **Task 2: Delete Stray Webhook Directory**
  - **Agent**: `devops-engineer`
  - **Files**:
    - [app/api/webhook/stripe/](file:///o:/Projects/mycelium-next/app/api/webhook/stripe/)
  - **Description**: Remove empty directory to keep the repository clean.
- [ ] **Task 3: Add Edge Auth Middleware**
  - **Agent**: `devops-engineer`
  - **Files**:
    - [middleware.ts](file:///o:/Projects/mycelium-next/middleware.ts) [NEW]
  - **Description**: Implement a Supabase SSR cookie-refresh and route-redirection middleware.
  - **Verify**: Unauthorized access to `/studio` redirects to `/login`.

### Phase 2: Monetization & Ad Logic Fixes
- [ ] **Task 4: Dual Ad Impressions Server Action**
  - **Agent**: `backend-specialist`
  - **Files**:
    - [lib/actions/profile.ts](file:///o:/Projects/mycelium-next/lib/actions/profile.ts)
  - **Description**: Add `getCreatorAdSettings(username)` action. Update `recordAdImpression(creatorId, viewerId)` to credit both the creator and the logged-in reader, support anonymous views, and prevent creators from gaming their own posts.
- [ ] **Task 5: Dual Ad Rendering UI**
  - **Agent**: `frontend-specialist`
  - **Files**:
    - [components/ad-display-client.tsx](file:///o:/Projects/mycelium-next/components/ad-display-client.tsx)
  - **Description**: Update component to parse pathname. Fetch creator settings on public pages, and call `recordAdImpression(creatorId, viewerId)` with the creator's ID and current viewer's ID (if authenticated).
  - **Verify**: Logged-in view on other creator's post credits both the creator and the reader. Self-view doesn't.

### Phase 3: UI & Retrieval Optimizations
- [ ] **Task 6: Clean Theme Toggle Linter Warnings**
  - **Agent**: `frontend-specialist`
  - **Files**:
    - [components/theme-toggle.tsx](file:///o:/Projects/mycelium-next/components/theme-toggle.tsx)
  - **Description**: Add linter exclusions to prevent build failures.
  - **Verify**: `pnpm run lint` passes without errors in this file.
- [ ] **Task 7: Optimize Archive Retrieval Query**
  - **Agent**: `backend-specialist`
  - **Files**:
    - [lib/actions/retrieval.ts](file:///o:/Projects/mycelium-next/lib/actions/retrieval.ts)
  - **Description**: Perform block joins and tag filtering entirely inside SQL via Drizzle instead of processing in-memory.
  - **Verify**: Blocks search returns correct records in real-time.

### Phase 4: Telemetry & Funnel Tracking
- [ ] **Task 8: Implement Real Conversion Funnel Tracking**
  - **Agent**: `backend-specialist`
  - **Files**:
    - [lib/actions/telemetry.ts](file:///o:/Projects/mycelium-next/lib/actions/telemetry.ts)
    - [components/premium-teaser-overlay.tsx](file:///o:/Projects/mycelium-next/components/premium-teaser-overlay.tsx)
  - **Description**: Add `trackTeaserClick` action. Update overlay to trigger click tracking. Modify `getCreatorTelemetry` to count actual `subscriptions`, `bundlePurchases`, and `teaser_click` telemetry events.
  - **Verify**: Analytics dashboard funnel displays actual numbers.

---

## Phase X: Verification
- [ ] Run checklist scan.
- [ ] Build project.
- [ ] All tests pass.
