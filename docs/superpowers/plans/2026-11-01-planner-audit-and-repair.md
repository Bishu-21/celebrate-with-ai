# Event Planning Assistant Audit and Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This document is a proposed plan, not authorization to implement it.

**Goal:** Make Marigold a trustworthy GenAI assistant for weddings, birthdays, and community events, with usable budgets, timelines, vendor checklists, and personalized ideas.

**Architecture:** Retain Next.js, React, TypeScript, Zod, and server-side Gemini. Keep model output advisory; deterministic domain functions validate money, dates, relationships, and state transitions. Introduce a small command layer so all screens update one consistent, versioned plan.

**Tech Stack:** Existing Next.js App Router, React, Tailwind, Zod, Google GenAI SDK, Vitest, Testing Library; add browser testing only for critical journeys.

**Spec:** The challenge quoted by the user and the proposed product requirements in this document. Local `explainer.md`, `gen-ai.md`, and `video-criteria.md` provide context, not independently verified competition rules.

**Audit date:** 2026-11-01. Scope: source review and local checks. No production code changed. No live Gemini calls or browser usability audit performed. Existing source files were untracked at audit time; preserve them and any concurrent user changes.

## Assessment

This is a useful foundation, not a throwaway project. Domain calculations are separated from UI, Gemini runs on the server, schemas bound many inputs, and tests cover several real behaviors. The poor-quality patterns are unsupported claims, incomplete workflows, and missing invariants behind polished screens. Repair those before adding visual polish or more AI buttons.

### Verification baseline

| Check | Observed result |
| --- | --- |
| `npm.cmd test` | 12 files, 21 tests passed |
| `npm.cmd run typecheck` | Failed: vendor comparison route accesses nonexistent `mustHaves`, `occasion`, and `city` fields |
| `npm.cmd run lint` | Exit 0 with one warning: unused `scheduleTasks` import in the timeline route |
| `npm.cmd run build` | Restricted run failed fetching Google Fonts. Network-enabled retry compiled successfully, then failed type checking on the same three vendor request fields |
| Live AI / browser journeys | Not run; no claim of verified model availability or end-to-end readiness |

Use `npm.cmd` on this Windows machine: PowerShell blocks the `npm.ps1` entry point. Do not weaken execution policy.

## Evidence-based findings

Severity: P0 = release blocker or direct data loss; P1 = core correctness or challenge gap; P2 = reliability, usability, or deployment hardening. Findings below are source-confirmed unless explicitly described as a risk.

| ID | Priority | Evidence and consequence | Required outcome |
| --- | --- | --- | --- |
| F01 | P0 | `src/app/api/vendors/compare/route.ts` reads fields absent from `vendorCompareRequestSchema`; TypeScript confirms three TS2339 errors. `PlannerApp.tsx` also omits those fields. | One shared comparison contract from form to model prompt; typecheck passes. |
| F02 | P0 | Demo `useEffect` in `PlannerApp.tsx` saves `SAMPLE_PLAN` whenever stored ID differs. Visiting the wedding demo can replace the user's current event. | Demo is isolated and read-only until explicitly copied. |
| F03 | P1 | `BudgetBoard.tsx` Confirm merely flips `isEstimated`; `PlannerApp.tsx` does not collect a vendor or amount. Local budget rows are also labelled AI estimates. | Confirm an entered quote with provenance; label local versus AI estimates accurately. |
| F04 | P1 | `planFromDraft` in `merge-draft.ts` assigns the same `budgetBreakdown` to every generated trade-off. | Alternatives have distinct, validated allocations and visible consequences, or are omitted. |
| F05 | P1 | `applyTimelineDraft` rebuilds the task list from model output. Missing existing IDs disappear; invented IDs enter. Revision route itself preserves IDs, but the separate timeline route does not. | Rescheduling preserves the existing task set and completed work. |
| F06 | P1 | `parseConstraintChange` recognizes a narrow set of regex phrases. “Add 50 guests”, absolute dates, and “budget is now 10 lakh” do not express usable changes. `revisePlan` reports unchanged fields and silently clamps some invalid values. | Parse into a validated proposed change; clarify unsupported or ambiguous requests before mutation. |
| F07 | P1 | `revisePlan` auto-applies the first cut scenario and spends unused budget on the top category. `proposeTradeoffs` can use a remainder adjustment without enforcing nonnegative final lines; partial priorities omit reduction candidates. | Show proposals before applying; enforce nonnegative amounts, locked commitments, and honest infeasibility. |
| F08 | P1 | Schemas accept date-shaped strings without calendar validation; duplicate categories, IDs, and priorities are not consistently rejected. `addDays` normalizes impossible dates. | Validate semantics as well as JSON shape at every boundary. |
| F09 | P1 | `loadPlan` casts parsed JSON to `EventPlan`; storage reads/writes can throw. There is no cross-tab storage subscription or migration envelope. | Corrupt, old, unavailable, or quota-exhausted storage cannot crash or silently lose a plan. |
| F10 | P1 | Checklist and timeline completion are separate booleans. AI checklist links are assigned by array index. Guest headcount updates do not refresh vendor briefs; revision only refreshes catering coverage, leaving budget caps stale. | One command updates linked tasks, summaries, caps, and derived views consistently. |
| F11 | P1 | `VendorBoard` collects quotes in transient state; comparisons overwrite `plan.quotes`, questions/rows are not restored, category changes leave old results visible. Model commentary returned by the route is ignored by the client. | Persist category-specific quotes and useful AI commentary keyed by stable quote IDs. |
| F12 | P1 | There is no dedicated ideas model or screen. The fallback uses the same task library for all occasions; city, occasion, and notes barely affect local planning. | Personalized, actionable ideas and materially different occasion templates. |
| F13 | P1 | README promises local fallback when the key is absent or output invalid, but generation and other routes return 502. | Implement explicit local mode and accurate degraded-state copy, without disguising it as AI. |
| F14 | P1 | Async responses replace a captured whole plan; other boards remain editable while a request runs. | A late AI response cannot erase newer guest edits, task completion, or a different event. |
| F15 | P2 | `generateJson` truncates serialized prompts at 12,000 characters, potentially breaking JSON. No explicit application timeout/output budget is configured. Revision uses `Promise.all`, so one failed advisory call fails the whole request. | Build bounded structured context; use deadlines and preserve independently successful results. |
| F16 | P2 | `readBody` buffers the full body before checking JavaScript string length. Rate limits use an unbounded process-local map and trust the first forwarded IP. | Byte limits before full buffering; documented trusted proxy rules and bounded/distributed limits appropriate to deployment. |
| F17 | P2 | Twenty-one tests do not exercise route contracts, storage recovery, AI merges, or complete user journeys. Palette tests do not establish full-page accessibility. | Regressions target the actual failure paths; browser checks establish usable keyboard/mobile journeys. |
| F18 | P2 | Intake and sample dates are hardcoded; Google Fonts require network during build. README contains claims stronger than implemented behavior. | Relative defaults, reproducible builds, and documentation matching verified behavior. |

## Proposed product requirements

These are recommended implementation decisions, not preferences already approved by the user.

1. The primary journey is intake → review draft → choose next actions → track progress → revise with a before/after preview.
2. A plan contains editable estimates, entered vendor quotes, planned versus committed totals, tasks, vendor requirements, checklist items, and personalized ideas. Do not add payments, accounts, or vendor booking for this repair.
3. A generated idea states why it fits, rough cost range in INR, effort, required vendors/tasks, and relevant constraints. Users can save or dismiss it; adding cost/tasks requires explicit action.
4. Wedding templates address ceremonies and family logistics; birthdays address age-appropriate activities and preferences; community events address volunteers, access, waste, and permission checks where relevant. Ask for relevant missing details rather than assuming them.
5. Confirmed costs survive revisions. If commitments exceed the budget, show the deficit and negotiable choices instead of inventing cheaper confirmed prices.
6. Planning headcount and confirmed attendance remain separate. Preserve zero RSVP counts; never use truthiness to replace zero with the original guest count. Make which headcount drives catering explicit.
7. Dependencies block premature work. Detect invalid graphs and impossible lead times; do not silently remove real user dependencies to make a schedule look feasible.
8. Local mode remains useful and visibly local. AI generation and local generation use the same domain validation and editing flows.

## Approaches considered

| Approach | Trade-off | Recommendation |
| --- | --- | --- |
| Patch the current components only | Fastest initial fixes, but duplicated mutations continue to cause drift | Use only for the immediate compile blocker |
| Incrementally repair with shared contracts and a command layer | Preserves working UI and domain code while containing correctness changes | Recommended |
| Rewrite with accounts, database, agent framework, and marketplace | Large migration and operating scope without resolving the current invariants | Defer |

## Global constraints

- Retain INR integer arithmetic; never accept negative, fractional, nonfinite, or unsafe integer monetary values.
- Retain server-only provider credentials. Never print `.env.local` or send guest names/emails to Gemini when aggregate constraints suffice.
- Validate input, persisted state, provider output, and final merged state with shared contracts.
- Every accepted budget has exactly one line per category; every dependency/checklist reference resolves to a unique existing task.
- Keep stable IDs and completed work across revisions. Only explicit deletion removes user data.
- Use event-local calendar dates with an explicit event timezone; avoid deriving local “today” from UTC slicing.
- AI suggestions never fabricate vendor availability, verified prices, permission approval, or factual local requirements.
- No product implementation, dependency installation, deployment, or submission is part of this documentation-only task.

## Review focus

- AI omits a completed task: preserve it and reject or ignore the incompatible update (Task 5).
- Confirmed spending already exceeds the new budget: preserve commitments and report infeasibility (Task 4).
- User edits during an AI request: reject a stale result or merge only compatible advisory fields (Task 3).
- Persisted JSON is valid JSON but not a valid plan: recover without rendering unsafe state (Task 2).
- A request is understandable but ambiguous: ask a targeted clarification and leave state untouched (Task 6).

## Implementation sequence

Each task starts with a regression test that fails for the current defect, implements the smallest coherent repair, runs its focused checks, and ends with a reviewable commit. Proposed file names below are new unless they already exist.

### Task 1: Restore the vendor request contract and establish baseline gates

**Files:** Modify `src/lib/schemas.ts`, `src/app/api/vendors/compare/route.ts`, `src/components/planner/PlannerApp.tsx`; create `tests/api/vendors-compare.test.ts`.

**Interface:** `VendorCompareRequest = { quotes: VendorQuote[]; headcount: number; capInr: number; category: Category; mustHaves: string; occasion: Occasion; city: string }`, derived from the shared Zod schema.

- [ ] Test that the client-shaped request reaches the mocked provider with city, occasion, and must-haves; missing context returns 400 and never calls Gemini.
- [ ] Align schema, client body, and handler. Reject quotes from a different category. Use stable quote IDs in model output rather than joining on vendor name.
- [ ] Run `npm.cmd test -- tests/api/vendors-compare.test.ts` and `npm.cmd run typecheck`; require exit 0.
- [ ] Record baseline lint/build results, resolving the unused timeline import as part of the relevant task. Commit only the intended files.

### Task 2: Protect saved plans and separate demo state

**Files:** Modify `src/lib/storage.ts`, `src/components/planner/PlannerApp.tsx`; create `tests/storage.test.ts`, `tests/demo-isolation.test.tsx`.

**Interface:** `StoredPlan = { schemaVersion: 2; revision: number; plan: EventPlan }`; `loadStoredPlan(): StorageResult`; `persistStoredPlan(value: StoredPlan): StorageResult`; `StorageResult` is a discriminated union carrying valid data or a recoverable error code. Define the exact union in `storage.ts` and consume it consistently.

- [ ] Test that opening the demo leaves a saved event byte-for-byte unchanged; reset and sample-copy are explicit actions.
- [ ] Test malformed JSON, invalid shape, old v1 migration, unavailable storage, write quota failure, and cross-tab updates.
- [ ] Validate before exposing snapshots; only report a durable save after `setItem` succeeds. Offer recovery/export rather than deleting unreadable data automatically.
- [ ] Add read-only sample state and explicit “Use this example” copy with a new ID; retain unsaved edits on persistence failure.
- [ ] Run the two focused test files and existing intake tests; commit.

### Task 3: Centralize state transitions and prevent stale writes

**Files:** Create `src/domain/commands.ts`, `src/hooks/usePlanner.ts`, `tests/commands.test.ts`, `tests/planner-concurrency.test.tsx`; modify `PlannerApp.tsx` and storage integration.

**Interface:** `applyPlanCommand(plan: EventPlan, command: PlanCommand, today: string): EventPlan`. Define command variants for guest updates, task/checklist changes, quote selection, budget scenario application, and accepted revision. AI proposals carry `{ planId, baseRevision }`.

- [ ] Test task/checklist synchronization by explicit task IDs, vendor-cap refresh after budget edits, and coverage refresh after headcount edits.
- [ ] Reject invalid guest party sizes and oversized notes at local mutation time, rather than waiting for the next API request to fail.
- [ ] Test that revision N responses cannot overwrite revision N+1, a reset, or another plan. Cancel or discard incompatible responses and offer regeneration.
- [ ] Replace inline whole-plan mutation branches with commands. Keep one derivation path for caps, headcount, scenarios, and completion.
- [ ] Run command/concurrency tests and existing guest/checklist tests; commit.

### Task 4: Make budgets and vendor commitments honest

**Files:** Modify `src/domain/types.ts`, `src/domain/budget.ts`, `src/domain/merge-draft.ts`, `src/lib/schemas.ts`, `BudgetBoard.tsx`, `VendorBoard.tsx`; create `tests/budget-invariants.test.ts`, `tests/quote-selection.test.tsx`.

**Interfaces:** Replace ambiguous confirmation with quote provenance and `selectedQuoteId`; extend `BudgetLine` with `origin: 'local' | 'gemini' | 'quote' | 'manual'`. `proposeBudgetScenarios(plan: EventPlan): BudgetScenarioResult`, where result distinguishes feasible alternatives from unmet budget and its reasons.

- [ ] Test nonnegative integer allocations, category uniqueness/completeness, partial priority lists, tiny budgets, extreme cuts, and unchanged confirmed quotes.
- [ ] Test that confirmed commitments above the cap return infeasible with the correct deficit; no remainder adjustment creates a negative line.
- [ ] Replace one-click estimate confirmation with entered/selected quote amount, vendor, and source. Persist quotes per category and display included scope plus AI commentary separately from facts.
- [ ] Generate genuinely distinct scenarios; show per-category deltas and trade-offs. Require user selection; keep unused budget visible as unallocated/contingency instead of automatically spending it.
- [ ] Check the host's actual first priority rather than trusting the model's `protectedPriority` field. Validate every proposed scenario before display and again before application.
- [ ] Run focused tests plus existing budget/vendor tests; commit.

### Task 5: Preserve tasks and validate timeline feasibility

**Files:** Modify `src/domain/timeline.ts`, `src/domain/merge-draft.ts`, `src/domain/money.ts`, `src/lib/schemas.ts`, `src/app/api/plan/timeline/route.ts`, `TimelineBoard.tsx`; create `tests/timeline-merge.test.ts`, `tests/date-validation.test.ts`.

**Interfaces:** `validateTaskGraph(tasks: TimelineTask[]): GraphValidationResult`; `mergeTimelineNotes(plan: EventPlan, notes: Array<{ id: string; note: string }>): EventPlan`; schedule results include explicit feasibility warnings.

- [ ] Test missing/unknown/duplicate model IDs, duplicate local task IDs, dangling dependencies, self-dependencies, and cycles. Completed tasks must survive unchanged.
- [ ] Test impossible calendar dates, leap dates, event-local midnight, and schedules whose lead time starts before today.
- [ ] Treat model rescheduling output as notes keyed by existing IDs. Change dependencies/durations only through a separately validated user-approved proposal.
- [ ] Replace silent cycle breaking with actionable validation. Block incomplete prerequisites consistently; retain the distinction between user status and derived blockage.
- [ ] Add an event-date control and delay handling with explicit effects on dependents; synchronize checklist state through Task 3.
- [ ] Run timeline/date tests and typecheck; commit.

### Task 6: Make revisions understandable, reversible, and truthful

**Files:** Modify `src/domain/revision.ts`, `src/lib/gemini.ts`, `src/lib/schemas.ts`, `src/app/api/plan/revise/route.ts`, `RevisionComposer.tsx`; create `tests/revision-interpretation.test.ts`, `tests/api/revise.test.ts`.

**Interface:** `RevisionProposal = { planId: string; baseRevision: number; patch: ValidatedConstraintPatch; changes: ChangeSummary[]; questions: string[] }`; parse outcomes distinguish understood changes, ambiguity, and unsupported instructions. Absolute values and deltas are mutually exclusive per field.

- [ ] Test “add 50 guests”, “budget is now 10 lakh”, percentage changes, absolute dates, no-op/unrelated instructions, contradictory amounts, and out-of-range results.
- [ ] Keep exact deterministic parsing for supported numeric forms; use schema-constrained AI interpretation for broader requests, and clarify when confidence/meaning is insufficient. Never silently convert unknown requests into successful revisions.
- [ ] Preview only actual changes, including infeasible commitments and task risks. Apply through Task 3 after acceptance; provide one-step undo using the previous validated snapshot.
- [ ] Test the challenge case: 120 → 170 guests, INR 1,500,000 → 1,300,000, 2026-12-20 → 2026-12-06; preserve plan/task IDs, quotes, guests, and completed work. Do not force a falsely feasible total.
- [ ] Make numerical revision available if advisory AI fails, with an accurate warning. Test partial provider failures and stale acceptance.
- [ ] Run revision tests plus route tests; commit.

### Task 7: Deliver personalized ideas and occasion-specific planning

**Files:** Create `src/domain/occasion-templates.ts`, `src/domain/ideas.ts`, `src/components/planner/IdeasBoard.tsx`, `src/app/api/plan/ideas/route.ts`, `tests/ideas.test.ts`, `tests/occasion-templates.test.ts`; modify types, schemas, Gemini service, local plan, intake, and shell navigation.

**Interface:** `PersonalizedIdea = { id: string; title: string; description: string; fitReason: string; costRangeInr: { min: number; max: number }; effort: 'low' | 'medium' | 'high'; constraints: string[]; status: 'suggested' | 'saved' | 'dismissed'; source: 'local' | 'gemini' }`. `generateIdeas(brief: EventBrief): Promise<PersonalizedIdea[]>` consumes only necessary event constraints.

- [ ] Add optional occasion-specific details: birthday age group/interests, wedding traditions/ceremonies, community audience/volunteer capacity; include dietary/access/weather preferences without forcing irrelevant questions.
- [ ] Test distinct wedding, birthday, and community templates. A low-budget birthday must not inherit a full wedding vendor list.
- [ ] Test ideas against vegetarian/Jain meals, step-free access, indoor backup, age suitability, and stated budget limits. Reject inconsistent cost ranges and duplicate IDs.
- [ ] Show why each idea fits; support save/dismiss and explicit “Add to plan” with cost/task impact preview. An idea suggestion alone never changes the budget.
- [ ] Link vendor requirements/questions to the chosen idea and task rather than arbitrary array positions. Provide honest local templates when AI is unavailable.
- [ ] Run ideas/template tests and a manual journey for each occasion; commit.

### Task 8: Bound AI operations and API abuse

**Files:** Modify `src/lib/gemini.ts`, `src/lib/http.ts`, `src/lib/rate-limit.ts`, all API handlers; create `src/lib/ai-context.ts`, `tests/api/http.test.ts`, `tests/ai-failures.test.ts`, `tests/rate-limit.test.ts`.

**Interfaces:** `buildAiContext(plan: EventPlan, operation: AiOperation): AiContext`; typed API errors use `{ code, message, retryable }` with no raw provider secrets.

- [ ] Replace character slicing of serialized JSON with purpose-specific bounded objects; omit guest PII and irrelevant quote/task fields. Oversized valid inputs must yield valid structured context or an explicit size error.
- [ ] Set an application deadline of 20 seconds and at most one retry for transient failures, with the retry inside that deadline. Configure provider output limits per operation; record non-sensitive latency/source/failure metrics.
- [ ] Add actual byte-counted request limits of 120,000 bytes with early Content-Length rejection plus streaming enforcement for missing/misleading headers. Test Unicode and chunked oversized bodies.
- [ ] Document the deployment proxy trust boundary; bound/expire limiter keys. Use shared rate limiting and a provider spend ceiling for multi-instance public deployment; test Retry-After and provider-not-called-on-rejection.
- [ ] Preserve deterministic comparison/scheduling results when AI commentary fails. Distinguish unconfigured local mode from exhausted quota and malformed output.
- [ ] Mock provider calls to test timeout, 429, invalid JSON, semantically invalid output, attempted instruction injection in notes, and safe error messages; commit.

### Task 9: Verify real journeys, accessibility, and release evidence

**Files:** Create `tests/e2e/planner.spec.ts`, browser-runner configuration, `.github/workflows/ci.yml`, `docs/demo-walkthrough.md`; modify `package.json`, `README.md`, privacy copy, intake defaults, and `src/app/layout.tsx` as needed.

- [ ] Add critical browser journeys: fresh intake, generated draft, quote entry/selection, task completion, accepted revision, reload, local mode, and demo isolation. Mock AI for repeatable CI; keep real-provider smoke checks opt-in.
- [ ] Check all three occasions at 375px and desktop widths; keyboard completion, meaningful labels, error focus, dialog restoration, reduced motion, and rendered contrast. Fix observed failures rather than adding ARIA indiscriminately.
- [ ] Remove hardcoded intake dates. Use licensed local font files or a system-font stack if network-independent builds are required; document the decision.
- [ ] CI runs clean dependency installation, tests, lint, typecheck, production build, and critical browser tests. Record exact final output and tool versions; no green claims based only on unit tests.
- [ ] Rewrite README claims to match behavior, including offline mode, estimate sources, persistence limits, AI boundaries, and actual verified model configuration. Do not repeat speculative claims about evaluator keyword scanning or guaranteed scores.
- [ ] Prepare a walkthrough under four minutes using `video-criteria.md` as supplied guidance: enter real inputs, show ideas, compare two quotes, complete a task, run the multi-constraint revision, and demonstrate one recoverable error. Deployment and external submission remain separate authorized actions.
- [ ] Run all gates once after final changes, fix failures, and commit reviewable changes.

## Dependency order and stopping points

Execute Task 1 first, then Tasks 2–6 in order. Task 7 builds on stable commands and schemas. Complete Task 8 before a public deployment; finish Task 9 before declaring release readiness. Deliver each working increment without undertaking a rewrite.

If time is limited, the first milestone is a compiling app with safe storage/demo behavior and honest budgets (Tasks 1–4). The second is trustworthy timelines/revision (Tasks 5–6). The third closes the explicit ideas/occasion gap (Task 7). None of these partial milestones alone establishes full challenge completion.

## Release acceptance checklist

- [ ] Weddings, birthdays, and community events each produce an appropriate editable plan and personalized ideas.
- [ ] Budget estimates have correct provenance; confirmed quotes are user-entered and preserved.
- [ ] Budget alternatives differ, remain nonnegative, and expose infeasibility instead of hiding it.
- [ ] Task dependencies and completed work survive updates; checklist references are explicit and consistent.
- [ ] The multi-constraint revision updates the existing event with preview/accept/undo and no silent no-op.
- [ ] Quotes, requirements, and useful AI commentary survive reload and category changes.
- [ ] Demo navigation and delayed requests cannot overwrite newer user work.
- [ ] Corrupt storage, invalid dates, quota failures, and missing AI configuration have recoverable outcomes.
- [ ] Tests, lint, typecheck, build, and browser journeys pass with recorded evidence.
- [ ] Documentation and walkthrough describe demonstrated behavior, with no promised score or fabricated capability.

## Explicit limitations and decisions for implementation review

The audit does not certify security, legal compliance, WCAG conformance, model availability, vendor prices, or competition rules. No dependency vulnerability review or live provider evaluation was performed. Confirm the intended hosting topology before choosing a distributed limiter, and verify the configured model's structured-output/thinking options against official provider documentation when implementing AI changes. Keep the existing stack unless a demonstrated requirement rules it out.
