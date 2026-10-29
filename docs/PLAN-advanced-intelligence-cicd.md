# Mycelium Advanced Intelligence & CI/CD Hardening Plan

## Overview
This plan details the implementation of Phase 15 (Advanced Intelligence & Graph Synthesis) and Phase 16+ (Production Infrastructure & CI/CD Hardening) of the Mycelium Creator Operating System. The goal is to introduce automated Knowledge Graph ranking, AI-powered bundle recommendations, Tiptap teaching adaptation helpers, automated insight summaries, mock Stripe webhook fulfillment, and automated E2E test database seeding.

## Project Type
**WEB** (Next.js 16 App Router, React 19, Drizzle ORM, Supabase Auth)

## Success Criteria
1. **Graph Ranking & Auto-Linking**: Creators can view graph centrality scores and receive automated semantic auto-linking suggestions between related claims and evidence across different drafts.
2. **AI Bundle Recommendations**: Creators receive optimal bundle curation recommendations based on tag clustering and reader telemetry engagement metrics.
3. **Teaching Adaptation Helpers**: Creators can generate pedagogical analogies, callout definitions, and scaffolding questions directly within the Tiptap drafting canvas.
4. **Insight Summaries**: Readers in Skim Mode receive automated executive summaries and key takeaway bullet points synthesized from multi-branch arguments.
5. **Stripe Webhooks & Fulfillment**: Secure webhook endpoint correctly handles checkout completion, invoice failure grace periods, and chargeback disputes, supported by a mock dispatch utility for local testing.
6. **E2E Test Seeding**: Automated Drizzle seed script populates mock database state to ensure Playwright E2E tests run seamlessly in CI/CD pipelines.

## Tech Stack & Rationale
*   **Next.js 16 App Router**: Server Actions for secure database mutations and Server Components for optimized data fetching.
*   **Drizzle ORM & PostgreSQL**: High-performance relational queries, full-text search (`tsvector` / `pg_trgm`), and robust schema definitions.
*   **Tiptap Rich Text**: Extensible headless editor supporting custom semantic marks.
*   **Stripe & Supabase**: Integrated identity, workspace namespacing, and secure payment webhook fulfillment.

## File Structure
```plaintext
o:/Projects/mycelium-next/
├── app/
│   ├── (studio)/studio/
│   │   ├── graph/page.tsx             # Modified: Add centrality & auto-linking UI
│   │   ├── bundles/page.tsx           # Modified: Add AI bundle recommendations UI
│   │   └── drafts/[id]/page.tsx       # Modified: Add Teaching Adaptation Helper UI
│   ├── api/webhooks/stripe/route.ts   # New: Stripe webhook fulfillment endpoint
│   └── (public)/[username]/[slug]/page.tsx # Modified: Add Skim Mode summaries
├── components/
│   └── public-reader-shell.tsx        # Modified: Add Skim Mode summaries UI
├── lib/
│   ├── actions/
│   │   └── synthesis.ts               # New: Graph ranking, bundle AI, teaching helpers
│   └── db/
│       └── seed.ts                    # New: Automated Drizzle database seed script
└── package.json                       # Modified: Add npm run seed script
```

## Task Breakdown

### Task 1: Database Seeding & Mock Data Infrastructure (Phase 16+)
*   **Agent**: `backend-specialist` | **Skill**: `database-design`
*   **Input**: `lib/db/schema.ts`.
*   **Output**: `lib/db/seed.ts` populating mock profiles, workspaces, tiers, objects, blocks, and comments. Add `seed` script to `package.json`.
*   **Verification**: Execute `npm run seed` and verify database tables are populated correctly.

### Task 2: Advanced Intelligence Server Actions (Phase 15)
*   **Agent**: `backend-specialist` | **Skill**: `api-patterns`
*   **Input**: `lib/db/schema.ts`.
*   **Output**: `lib/actions/synthesis.ts` implementing `calculateGraphCentrality`, `suggestAutoLinks`, `recommendBundles`, `generateTeachAdaptation`, and `generateInsightSummary` using Postgres FTS/BM25.
*   **Verification**: Call server actions with sample data and verify correct rankings, recommendations, and summaries are returned.

### Task 3: Stripe Webhook & Fulfillment Endpoint (Phase 16+)
*   **Agent**: `security-auditor` + `backend-specialist` | **Skill**: `api-patterns`
*   **Input**: `lib/db/schema.ts`, Stripe event payloads.
*   **Output**: `app/api/webhooks/stripe/route.ts` handling `checkout.session.completed`, `invoice.payment_failed`, and `chargeback.dispute.created`. Includes mock dispatch utility.
*   **Verification**: Trigger mock webhook events and verify database subscription and bundle access records update accordingly.

### Task 4: Frontend Studio & Reader UI Integration (Phase 15)
*   **Agent**: `frontend-specialist` | **Skill**: `frontend-design`
*   **Input**: `lib/actions/synthesis.ts`, studio/reader page components.
*   **Output**: Updated Knowledge Graph, Bundles, Draft Editor, and Public Reader Shell components rendering AI features and summaries.
*   **Verification**: Navigate to respective studio/reader pages and verify AI UI components function and display correctly.

### Task 5: Final Verification & E2E Validation (Phase 16+)
*   **Agent**: `test-engineer` | **Skill**: `webapp-testing`
*   **Input**: Seeding script, build pipeline, Playwright tests.
*   **Output**: Verified production build and passing E2E test suite.
*   **Verification**: Execute `npm run build` and `npx playwright test` to verify 100% success.
