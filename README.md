# Nib Platform Engineering

**CONFIDENTIAL AND PROPRIETARY**
*This repository contains the core application source code, architectural documentation, and operational directives for the Nib Publishing Platform. Unauthorized access, distribution, or replication is strictly prohibited.*

---

## 1. Executive Summary

Nib is an enterprise-grade, full-stack Content Operating System engineered to revolutionize structured knowledge publishing. By decoupling semantic meaning from flat presentation, Nib allows creators to compose highly-structured, atomic content blocks. These blocks are dynamically synthesized in real-time, delivering multi-modal reading experiences tailored to distinct cognitive requirements (e.g., Skim, Standard, Expert, Teach, Debate).

This repository houses the entire monolithic Next.js application, incorporating advanced real-time co-authoring synchronization, Mistral AI-driven editorial intelligence, robust RBAC mechanisms via Supabase, and a scalable Razorpay-backed monetization infrastructure.

---

## 2. System Architecture

The Nib platform employs a modern, serverless-first architectural topology optimized for high availability, sub-second latency, and deterministic deployment rollouts.

### 2.1 Core Subsystems
- **Edge Routing & Proxy Layer:** Next.js Middleware (`proxy.ts`) manages custom domain resolution, vanity URL routing, and authentication handshakes at the edge.
- **Application Layer:** Next.js 16 (App Router) monolithic structure, utilizing Server Components for optimal LCP and Server Actions for secure, form-driven mutations.
- **Data Persistence & Realtime Transport:** PostgreSQL (via Supabase), enforcing strict Row Level Security (RLS). Realtime presence and CRDT-based block synchronization are handled via Supabase Realtime Channels.
- **AI Orchestration Pipeline:** Vercel AI SDK acts as a universal adapter interfacing with Mistral AI. Operations are isolated and throttled via Redis-backed sliding-window rate limiters.
- **Payment Gateway:** Razorpay manages recurring membership subscriptions, piece-level boosts, and ledger-based tip payouts.

### 2.2 Component Hierarchy
```text
mycelium-next/
├── actions/          # Zero-API Server Actions (Strictly typed mutations)
├── app/              # Declarative App Router topography
│   ├── (auth)/       # Identity & Access Management (IAM)
│   ├── (main)/       # Reader-facing consumption surfaces
│   ├── (marketing)/  # SEO-optimized public landing assets
│   ├── api/          # Webhooks (Razorpay) & Cron Jobs
│   └── studio/       # Protected Creator Operating System
├── components/       # Shadcn-compliant, modular UI primitives
├── lib/              # Core business logic, schemas, and API adapters
└── supabase/         # DDL, Migrations, and RLS Policy definitions
```

---

## 3. Engineering Standards & Conventions

All engineering personnel must adhere to the following strict guidelines when committing to this repository. Pull Requests failing automated CI checks will be categorically rejected.

### 3.1 TypeScript Strictness
- `any` types are strictly prohibited. Downcasting must use `unknown` accompanied by Zod runtime validation boundaries.
- All database interactions must utilize the generated database schema types (`Database` from `@/lib/supabase/types`).

### 3.2 State Management & Hooks
- Component local state must be minimized. Prefer URL search parameters (`nuqs`) for shareable state.
- React Server Components (RSC) are the default. `use client` directives must be pushed to the leaves of the component tree.
- Effects (`useEffect`) must not be used for data fetching or synchronous state derivation. Use React Compiler-compatible memoization.

### 3.3 Security & RLS
- The `createAdminClient` bypasses Row Level Security. Its usage is heavily audited and restricted to Webhooks, Cron Jobs, and specific isolated server actions. All user-driven server actions MUST use `createClient`.
- Secrets must never be exposed. Any environment variable lacking the `NEXT_PUBLIC_` prefix is strictly server-bound.

---

## 4. Local Development Environment

### 4.1 Prerequisites
- Node.js `v20.x.x` (LTS)
- Package Manager: `pnpm` `v9.x.x`
- Postgres Client (`psql`)
- Supabase CLI

### 4.2 Initialization
1. **Clone & Install:**
   ```bash
   git clone <internal-repo-url>
   cd mycelium-next
   pnpm install --frozen-lockfile
   ```

2. **Environment Configuration:**
   Request access to the `Development` environment variables from the DevOps portal. Save them as `.env.local`.
   ```bash
   cp .env.example .env.local
   ```

3. **Database Migration:**
   Ensure your local Supabase instance or cloud staging database is synchronized.
   ```bash
   supabase db reset
   ```

4. **Launch Application:**
   ```bash
   pnpm dev
   ```

---

## 5. Deployment & CI/CD Topology

Nib employs a Trunk-Based Development methodology. 

### 5.1 Continuous Integration (CI)
Every pull request targeting `main` triggers a GitHub Actions pipeline performing:
1. **Static Analysis:** `pnpm lint` and `pnpm typecheck`
2. **Security Audit:** CodeQL and Dependency Vulnerability Scanning
3. **End-to-End Testing:** Playwright suites across Chromium, Firefox, and WebKit

### 5.2 Continuous Deployment (CD)
- Merges to `main` trigger a Vercel Production deployment.
- Database migrations (`supabase/migrations`) are automatically applied during the deployment lifecycle via the Supabase GitHub Integration.

---

## 6. Operational Guidelines & Telemetry

- **Error Tracking:** Handled via Sentry. All unhandled exceptions trigger PagerDuty alerts for the on-call engineer.
- **Performance Budget:** Core Web Vitals (LCP, FID, CLS) are continuously monitored. Any PR degrading LCP beyond 2.5s on desktop will fail CI.
- **Rate Limiting:** AI endpoints enforce a `10 req / 60s` policy to mitigate API abuse and control infrastructural OPEX.

---

*Nib Engineering Documentation*
