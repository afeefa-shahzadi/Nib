# Mycelium 100% Implementation Plan

## Overview
This plan details the full 100% implementation of the remaining simulated and mock mechanics within the Mycelium Creator Operating System. Specifically, it replaces simulated AI synthesis with live Mistral LLM derivations via the Vercel AI SDK, implements automated Text-to-Speech (TTS) audio generation using the Web Speech API for the audio branch type, and hardens the Stripe webhook fulfillment endpoint with a hybrid secret validation strategy.

## Project Type
**WEB** (Next.js 16 App Router, React 19, Drizzle ORM, Supabase Auth)

## Success Criteria
1. **Live AI Synthesis**: `generateTeachAdaptation` and `generateInsightSummary` in `synthesis.ts` utilize `@ai-sdk/mistral` and `ai` (`generateText`, `generateObject`) to return live, structured pedagogical scaffolding and skim summaries.
2. **Audio Branch TTS**: Readers viewing an `audio` branch or clicking "Listen to Audio Branch" in the reader shell experience automated client-side speech synthesis via the Web Speech API (`window.speechSynthesis`).
3. **Hybrid Stripe Webhooks**: `app/api/webhooks/stripe/route.ts` validates `STRIPE_WEBHOOK_SECRET` in production environments while gracefully allowing the local mock dispatch utility during development.
4. **E2E & Build Integrity**: `pnpm build` completes successfully with 0 Turbopack/TypeScript errors, and all core flows pass Playwright E2E validation.

## Tech Stack & Rationale
*   **Vercel AI SDK (`ai`, `@ai-sdk/mistral`)**: Industry-standard AI integration providing robust structured object generation (`generateObject`) and streaming text capabilities.
*   **Web Speech API (`window.speechSynthesis`)**: Native browser speech synthesis providing zero-cost, zero-latency audio playback without requiring cloud storage provisioning or external third-party API dependencies.
*   **Stripe Webhooks**: Hybrid secret validation ensuring enterprise-grade production security while maintaining frictionless local developer experience.

## File Structure
```plaintext
o:/Projects/mycelium-next/
├── app/
│   ├── api/webhooks/stripe/route.ts   # Modified: Add hybrid secret validation
│   └── (public)/[username]/[slug]/page.tsx # Modified: Add audio branch TTS trigger
├── components/
│   ├── public-reader-shell.tsx        # Modified: Add TTS audio player controls
│   └── mode-renderer.tsx              # Modified: Support audio branch playback
├── lib/
│   └── actions/
│       └── synthesis.ts               # Modified: Implement Vercel AI SDK & Mistral
└── package.json                       # Modified: Add ai and @ai-sdk/mistral
```

## Task Breakdown

### Task 1: Package Dependencies & Env Configuration
*   **Agent**: `backend-specialist` | **Skill**: `nodejs-best-practices`
*   **Input**: `package.json`, `.env.local`.
*   **Output**: Install `ai` and `@ai-sdk/mistral`. Ensure `MISTRAL_API_KEY` is documented in environment examples.
*   **INPUT→OUTPUT→VERIFY**: Verify `package.json` contains `ai` and `@ai-sdk/mistral`. Run `pnpm install` to verify clean resolution.

### Task 2: Live Mistral AI Synthesis Integration
*   **Agent**: `backend-specialist` | **Skill**: `api-patterns`
*   **Input**: `lib/actions/synthesis.ts`.
*   **Output**: Refactor `generateTeachAdaptation` and `generateInsightSummary` to import `mistral` from `@ai-sdk/mistral` and call `generateObject` / `generateText`.
*   **INPUT→OUTPUT→VERIFY**: Call refactored server actions with sample block text; verify valid, dynamically generated AI structures are returned.

### Task 3: Client-Side Web Speech API TTS Integration
*   **Agent**: `frontend-specialist` | **Skill**: `frontend-design`
*   **Input**: `components/public-reader-shell.tsx`, `components/mode-renderer.tsx`.
*   **Output**: Add interactive TTS playback controls ("Play Audio Branch", "Pause", "Stop") utilizing `window.speechSynthesis.speak()`.
*   **INPUT→OUTPUT→VERIFY**: Open public reader page, click "Play Audio Branch", verify active browser speech synthesis audio plays correctly.

### Task 4: Hybrid Stripe Webhook Hardening
*   **Agent**: `security-auditor` + `backend-specialist` | **Skill**: `api-patterns`
*   **Input**: `app/api/webhooks/stripe/route.ts`.
*   **Output**: Implement conditional verification logic checking `process.env.NODE_ENV === 'production'`. In production, enforce `stripe.webhooks.constructEvent`. In development, allow mock dispatch payload parsing.
*   **INPUT→OUTPUT→VERIFY**: Trigger webhook endpoint in development mode; verify mock dispatch succeeds. Inspect production code branch to ensure strict secret enforcement.

### Task 5: Final Verification & E2E Validation
*   **Agent**: `test-engineer` | **Skill**: `webapp-testing`
*   **Input**: `tests/e2e/studio-flows.spec.ts`, build pipeline.
*   **Output**: Verified production build and passing E2E test suite.
*   **INPUT→OUTPUT→VERIFY**: Execute `pnpm build` and `npx playwright test` to verify 100% success.

## ✅ Phase X: Final Verification Checklist
- [ ] Security Scan (`security_scan.py`)
- [ ] Lint & Type Check (`pnpm lint`, `npx tsc --noEmit`)
- [ ] UX Audit (`ux_audit.py`)
- [ ] Build Verification (`pnpm build`)
- [ ] Playwright E2E Tests (`playwright_runner.py`)
