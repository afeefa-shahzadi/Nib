# Mycelium Studio Intelligence & Gating Plan

## Overview
This plan details the implementation of Phases 10.5, 12.5, 13, 14, and 16 of the Mycelium Creator Operating System. The goal is to introduce an active Archive Retrieval Assistant in the authoring studio, enforce premium content gating with inline SEO-friendly teasers, establish block-scoped Debate Mode discussion rooms, implement reader telemetry analytics, and verify system stability via E2E Playwright testing.

## Project Type
**WEB** (Next.js 16 App Router, React 19, Drizzle ORM, Supabase Auth)

## Success Criteria
1. **Archive Retrieval**: Creators can search and instantly cite prior blocks from their archive while drafting in the Tiptap editor.
2. **Premium Gating**: Unsubscribed readers attempting to access premium branches or expert modes see an elegant inline teaser overlay with a Stripe conversion CTA.
3. **Debate Mode**: Readers can engage in block-scoped discussions attached directly to specific claims or discussion anchors.
4. **Telemetry & Analytics**: Creators can view actionable metrics on reader mode switching, read depth, and archive reuse scores.
5. **E2E Verification**: All core creator and reader journeys pass automated Playwright test suites.

## Tech Stack & Rationale
*   **Next.js 16 App Router**: Server Actions for secure, direct database mutations and Server Components for optimized data fetching.
*   **Drizzle ORM & PostgreSQL**: High-performance relational queries, full-text search (`ilike` / `tsvector`), and robust schema definitions.
*   **Tiptap Rich Text**: Extensible headless editor supporting custom semantic marks (`claim`, `evidence`, `citation`).
*   **Stripe & Supabase**: Integrated identity, workspace namespacing, and secure payment checkout sessions.

## File Structure
```plaintext
o:/Projects/mycelium-next/
├── app/
│   ├── (studio)/studio/
│   │   ├── drafts/[id]/page.tsx       # Modified: Add Retrieval Assistant UI
│   │   └── analytics/page.tsx         # New: Telemetry & Analytics Dashboard
│   └── (public)/[username]/[slug]/page.tsx # Modified: Add Gating & Debate UI
├── components/
│   ├── editor/
│   │   └── retrieval-assistant.tsx    # New: Archive search side-panel
│   ├── premium-teaser-overlay.tsx     # New: Paywall CTA & blurred preview
│   └── debate-panel.tsx               # New: Block-scoped discussion drawer
├── lib/
│   └── actions/
│       ├── retrieval.ts               # New: Archive search & full-text matching
│       ├── discussion.ts              # New: Block comments & debate mutations
│       └── analytics.ts               # New: Telemetry tracking & metrics aggregation
└── tests/
    └── e2e/
        └── studio-flows.spec.ts       # New: Playwright E2E test suite
```

## Task Breakdown

### Task 1: Retrieval Assistant API & DB Query (Phase 10.5)
*   **Agent**: `backend-specialist` | **Skill**: `database-design`
*   **Input**: `contentObjectId`, `query` string.
*   **Output**: `lib/actions/retrieval.ts` implementing `searchArchiveBlocks` using Drizzle `ilike` and Postgres text matching against `blocks` and `contentObjects`.
*   **Verification**: Execute `searchArchiveBlocks` with sample text and verify matching block objects are returned.

### Task 2: Editor Retrieval Assistant UI (Phase 10.5)
*   **Agent**: `frontend-specialist` | **Skill**: `frontend-design`
*   **Input**: `lib/actions/retrieval.ts`, `app/(studio)/studio/drafts/[id]/page.tsx`.
*   **Output**: `components/editor/retrieval-assistant.tsx` side-panel allowing creators to search their archive and insert block citations directly into the Tiptap canvas.
*   **Verification**: Open draft editor, toggle retrieval panel, execute search, click "Insert Citation", verify Tiptap editor content updates.

### Task 3: Premium Route Gating & Teaser Overlay (Phase 12.5)
*   **Agent**: `security-auditor` + `frontend-specialist` | **Skill**: `api-patterns`
*   **Input**: `app/(public)/[username]/[slug]/page.tsx`, `lib/actions/stripe.ts`.
*   **Output**: `components/premium-teaser-overlay.tsx` and server-side gating check in public page route. Renders inline teaser with Stripe checkout CTA for unauthorized users on premium branches/expert modes.
*   **Verification**: Access premium branch URL without active session -> verify teaser overlay renders correctly with checkout button.

### Task 4: Structured Debate Mode & Discussion Rooms (Phase 13)
*   **Agent**: `backend-specialist` + `frontend-specialist` | **Skill**: `database-design`
*   **Input**: `lib/db/schema.ts`, `app/(public)/[username]/[slug]/page.tsx`.
*   **Output**: `lib/actions/discussion.ts` (`createComment`, `getBlockComments`) and `components/debate-panel.tsx` drawer UI for block-scoped discussions.
*   **Verification**: Click discussion anchor on public page -> verify debate drawer opens and loads block-specific comments.

### Task 5: Telemetry & Analytics Dashboard (Phase 14)
*   **Agent**: `backend-specialist` + `frontend-specialist` | **Skill**: `performance-profiling`
*   **Input**: `lib/db/schema.ts`, `app/(studio)/studio/analytics/page.tsx`.
*   **Output**: `lib/actions/analytics.ts` (`trackModeSwitch`, `getCreatorMetrics`) and Studio Analytics Dashboard UI rendering mode engagement charts and archive reuse scores.
*   **Verification**: Navigate to `/studio/analytics` -> verify metrics grid and engagement charts render successfully.

### Task 6: E2E Playwright Test Suite (Phase 16)
*   **Agent**: `test-engineer` | **Skill**: `webapp-testing`
*   **Input**: Core user flows (drafting, publishing, branching, checkout).
*   **Output**: `tests/e2e/studio-flows.spec.ts` covering end-to-end journeys.
*   **Verification**: Execute `npx playwright test` -> verify all specs pass.

## ✅ Phase X: Final Verification Checklist
- [ ] Security Scan (`security_scan.py`)
- [ ] Lint & Type Check (`npm run lint`, `npx tsc --noEmit`)
- [ ] UX Audit (`ux_audit.py`)
- [ ] Build Verification (`npm run build`)
- [ ] Playwright E2E Tests (`playwright_runner.py`)
