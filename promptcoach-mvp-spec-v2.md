# PromptCoach — MVP Spec (v2)

Changes from v1: task bank is now served from the backend API (not
hardcoded in the frontend); authentication via Azure Static Web Apps'
built-in identity providers is now IN v1 scope, alongside a no-login
guest mode; Cosmos DB moves from optional to in-scope (required for
logged-in users' progress).

## What this is
A web app that helps users write better AI prompts. Two features:
1. **Rate my prompt** — user pastes a prompt, agent asks a clarifying
   question if intent is unclear (max 1 round), then returns a rating +
   rewritten version.
2. **Learn & Practice** — short lessons on prompt-writing fundamentals,
   plus practice tasks where the user is given a scenario, writes a
   prompt to solve it, and gets rated against that specific task.

## Tech stack
- Frontend: React (Vite), deployed via Azure Static Web Apps (SWA)
- Backend: Azure Functions (Node.js), managed via SWA's linked
  Functions app
- Auth: SWA built-in authentication (start with GitHub provider; the
  login routes like `/.auth/login/github` and the client-principal
  header in Functions come free with SWA — no auth library needed)
- AI: Anthropic API (Claude), called server-side only — key lives in
  Azure Application Settings, never client-side
- Storage: Azure Cosmos DB (free tier) for attempts + progress of
  logged-in users; localStorage for guest users

## Identity model: `profileId` with guest mode
Every piece of persisted data (attempts, progress) is keyed by an
opaque `profileId` string. Two sources:

- **Guest (no login):** random UUID generated client-side on first
  visit, stored in localStorage. Guest progress lives in localStorage
  only (no server persistence) — cleared storage means lost history,
  and that's acceptable for guests.
- **Logged in:** `profileId` comes from the SWA client principal's
  userId (read server-side from the `x-ms-client-principal` header in
  Functions — never trust a client-supplied profileId for logged-in
  writes). Progress persists in Cosmos DB and follows the user across
  devices.

**Merge on first login:** when a user with local guest history logs in
for the first time, prompt them once ("bring your practice history into
your account?"); if yes, POST the local attempts to a merge endpoint,
then clear the local copy.

Rules:
- API routes treat `profileId` as opaque everywhere.
- Server-side, derive identity from the auth header when present;
  guest-mode API calls (the rater still works for guests) don't write
  server-side progress at all.
- Never gate the core "Rate my prompt" feature behind login — login
  exists only for persistent, cross-device progress.

## Feature 1: Rate my prompt

### Flow
```
User submits prompt
  → agent evaluates: is intent clear enough to rate?
  → if NOT clear:
        agent returns a clarifying question + 2-4 multiple choice
        options + free-text fallback
        user responds
        (only one clarifying round allowed — after this, always rate)
  → if intent still has ZERO context after the clarifying round:
        do not provide a rating — explain why and ask user to add
        more detail
  → otherwise:
        return rating + rewritten prompt
```

### Rating rubric (5 dimensions, each scored, plus overall)
- Clarity — is the ask unambiguous?
- Context — does it give necessary background?
- Examples — does it include few-shot examples where useful?
- Structure — is it organized (sections, headings, minimal necessary
  structure)?
- Success criteria — does it define what a good output looks like?

### Rating display rules
- Show BOTH a numeric score (e.g. "7/10") AND a plain-language verdict
  (e.g. "Solid — missing examples")
- **Score floor: never go below 3/10**, even for very weak prompts
- **If zero context is present, do not generate a rating at all** —
  return the clarifying question path instead, every time

### Structured output
Use Claude's tool-use / forced JSON output (not free-text parsing) so
the frontend can reliably render poll buttons vs. rating cards. Example
shape:
```json
{
  "action": "ask_clarifying_question" | "provide_rating" | "insufficient_context",
  "clarifying_question": {
    "question": "string",
    "options": ["string", "string", "string"],
    "allow_free_text": true
  },
  "rating": {
    "overall": 7,
    "verdict": "Solid — missing examples",
    "dimensions": {
      "clarity": { "score": 8, "note": "..." },
      "context": { "score": 5, "note": "..." },
      "examples": { "score": 4, "note": "..." },
      "structure": { "score": 7, "note": "..." },
      "success_criteria": { "score": 6, "note": "..." }
    }
  },
  "rewritten_prompt": "string"
}
```

## Feature 2: Learn & Practice

### Learn section
Short lessons, one per rubric dimension (clarity, context, examples,
structure, success criteria). Each lesson: a bad/good prompt pair + 2-3
sentences why. Keep skimmable — no long-form essays. Lessons are
static frontend content in v1 (they change rarely; no backend needed).

### Practice mode (task bank — SERVED FROM BACKEND)
User is shown a task, writes a prompt to solve it, agent rates it
against that specific task's criteria (no clarifying-question branch —
task is already known, so this always returns a rating).

**Task bank architecture:**
- Frontend fetches the task list from `GET /api/tasks` — never
  hardcode tasks in the frontend.
- v1 data source: a `tasks.json` file inside the api folder. (Adding a
  task in v1 = commit + redeploy. That's fine for now.)
- Later: swap the endpoint's data source to a Cosmos DB container so
  new tasks can be added without any deploy. The API contract must not
  change when this swap happens.
- **Grading criteria stay server-side only.** `GET /api/tasks` returns
  each task's id, title, category, and scenario text — NOT the "what
  to check for" criteria. Criteria are injected into the grading call
  server-side. If criteria ship to the client, users can see exactly
  what the grader checks and game their scores.

**Task shape (server-side; `criteria` never sent to client):**
```json
{
  "id": "task_04_summarization",
  "category": "summarization",
  "title": "Executive summary",
  "scenario": "Write a prompt to summarize a technical article for a non-technical executive audience.",
  "criteria": [
    "target audience named",
    "length or format constraint given",
    "priorities specified (conclusions vs. methodology)"
  ],
  "sequence": 4,
  "isCapstone": false
}
```

**Starter task bank (10 tasks):**
1. Data extraction (structured JSON output)
2. Creative writing (tone control)
3. Code generation (functional spec, edge cases)
4. Summarization (audience + length)
5. Classification (category consistency)
6. Instructional/how-to (step structure)
7. Comparative analysis (avoiding bias)
8. Agentic/multi-step task (citations, success criteria)
9. Constrained rewriting (tone/format transformation)
10. Ambiguous/underspecified "trap" task — tests whether the user adds
    their own clarifying constraints. Mark `isCapstone: true` and
    sequence it LAST — it's a meta-awareness test, not a regular task.

## Progress tracking
Store per `profileId`:
- Individual attempts (task/prompt attempted, full rating received,
  timestamp)
- Rolled-up summary document (denormalized, updated on each new
  attempt rather than recalculated on every read): total attempts,
  average score, average score per task category

Storage split:
- Guests: attempts + rollup kept in localStorage only.
- Logged-in: attempts + rollup in Cosmos DB (free tier), one
  container, documents typed by a `type` field ("attempt" /
  "progress"), partitioned by `profileId`.

Keep Practice-mode scores on the SAME 10-point scale as the main rater
(same 3/10 floor) so a user can watch scores improve across both
features.

## Rate limiting (public-facing demo — budget matters)
- Hard cap: 1 clarifying round + 1 final rating per submission
  (enforced server-side, not just client-side)
- Per-profileId or per-IP request limit (e.g. 10 sessions/hour)
- Track cumulative token usage server-side; hard-stop with a friendly
  message if a daily spend threshold is exceeded
- Use prompt caching (`cache_control: ephemeral`) on the rubric system
  prompt since it's identical across every call

## Model choice
Default to a smaller/cheaper model (Haiku-tier) for the intent-check
and practice-mode rating steps, since these are closer to
classification than deep reasoning. Only escalate to a larger model if
quality testing shows it's needed for the rewritten-prompt step
specifically.

## API surface (summary)
- `POST /api/rate` — main rater (guest-accessible; body: prompt text +
  optional clarification answer + conversation state)
- `GET /api/tasks` — task list, criteria stripped
- `POST /api/practice/rate` — practice-mode grading (body: taskId +
  user's prompt; criteria looked up server-side)
- `GET /api/progress` — logged-in user's rollup (identity from auth
  header)
- `POST /api/progress/merge` — one-time guest-history merge on first
  login
- `/.auth/login/github`, `/.auth/logout`, `/.auth/me` — provided by
  SWA automatically; frontend uses `/.auth/me` to detect login state

## What to build first (suggested order)
1. Repo scaffold (frontend + api folders, SWA config, staticwebapp
   routes incl. auth routes)
2. Rate my prompt — end to end, including the clarifying-question flow
   (works for guests; no DB dependency)
3. Learn section (static content)
4. Task bank endpoint (`tasks.json`-backed) + Practice mode
5. Auth wiring: login/logout UI state via `/.auth/me`, identity read
   server-side in Functions
6. Cosmos DB: attempts + progress for logged-in users; guest
   localStorage path; merge-on-first-login endpoint
7. Rate limiting + prompt caching pass
