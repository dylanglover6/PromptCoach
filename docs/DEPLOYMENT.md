# Going Live — Deployment Checklist

For the custom domain, launch order relative to the other two `dylanglover.com`
projects, and the hard gate on sharing the URL, `docs/unified-deployment-plan.md` is
the source of truth — this doc covers the PromptCoach-specific runbook underneath it.

Current status (2026-07-17): steps 1-5 of `promptcoach-mvp-spec-v2.md` are built
(scaffold, Rate my prompt, Learn, Practice mode, GitHub auth wiring). Step 6 (Cosmos DB)
is intentionally out of scope. Step 7 (rate limiting / cost controls) is now built —
input-length cap, per-IP rate limiting, and a daily spend ceiling, all backed by Azure
Table Storage (Azurite locally). See the checklist below for what's left before going
fully public.

## Before deploying: rate limiting (done — provision Storage before going live)

`/api/rate`, `/api/practice/rate`, and `/api/rate/revise` now reject oversized prompts,
enforce a per-IP hourly request cap, and stop calling Anthropic once a daily spend
ceiling is hit (fails open on Table Storage errors so an infra hiccup doesn't take the
feature down). At minimum, before sharing the live link with anyone:

- [x] Add the input-length cap (`MAX_PROMPT_LENGTH`, default 4000 characters — 413 if
      exceeded)
- [x] Finish per-IP rate limiting (`RATE_LIMIT_PER_IP_PER_HOUR`, default 20/hour — 429
      if exceeded) and the daily spend ceiling (`DAILY_SPEND_CEILING_USD`, default $5 —
      503 if exceeded), both Azure Table Storage-backed (`api/src/lib/costControls.js`,
      `api/src/lib/tableStorage.js`)
- [ ] Provision the real Azure Storage Account (see step 1 below) and set
      `TABLES_CONNECTION_STRING` in Application Settings before the URL is anything but
      private/unlisted — without it, rate limiting silently fails open (see step 2)
- [ ] Set a billing alert directly in the Anthropic Console as a backstop regardless

## 1. Provision Azure resources

1. **Azure Static Web App** — Azure Portal → Create a resource → Static Web App.
   - Deployment source: **GitHub**, authorize and pick `dylanglover6/PromptCoach`, `main`.
   - Build presets: Custom.
     - App location: `/frontend`
     - Api location: `/api`
     - Output location: `dist`
   - This provisions the resource **and** commits a GitHub Actions workflow
     (`.github/workflows/azure-static-web-apps-*.yml`) to the repo automatically, wiring
     up the deployment token as a GitHub secret — no manual CI setup needed.
2. **Azure Storage Account** (required for rate limiting to be enforced live) —
   Standard performance, Locally-redundant storage (LRS) is enough and stays in the
   free-tier range for this traffic volume. Used only for the `UsageCounters` table
   (rate-limit counters + daily spend total) — no other data lives here.

## 2. Configure Application Settings

Azure Portal → your Static Web App → **Configuration** → Application settings. These
mirror `api/local.settings.json` locally but must be set here for the deployed
Functions app — `local.settings.json` is gitignored and never deploys:

| Setting | Value | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | your real key | Never commit this. Rotate immediately if it's ever exposed. |
| `RATER_MODEL` | *(optional)* | Defaults to `claude-haiku-4-5` if unset. |
| `TABLES_CONNECTION_STRING` | Storage Account connection string | Required for rate limiting to be enforced live — without it the app still runs, but `costControls.js` fails open on every request (see below). Local dev uses `UseDevelopmentStorage=true` (Azurite) instead. |
| `RATE_LIMIT_PER_IP_PER_HOUR` | *(optional)* | Defaults to `20` if unset. |
| `DAILY_SPEND_CEILING_USD` | *(optional)* | Defaults to `5` if unset. |
| `MAX_PROMPT_LENGTH` | *(optional)* | Defaults to `4000` if unset. |

`COSMOS_DB_CONNECTION_STRING` in `local.settings.json.example` is a leftover from the
original spec and isn't needed — Cosmos DB is out of scope (see project memory).

## 3. CORS is already locked down

`frontend/public/staticwebapp.config.json` has a `globalHeaders` block restricting
`Access-Control-Allow-Origin` to `https://promptcoach.dylanglover.com` — the domain
is fixed by `docs/unified-deployment-plan.md`, so this no longer needs a post-deploy
placeholder edit. This doesn't affect the app's own frontend calling its own API
(same-origin calls never trigger CORS checks); it only stops other sites from
embedding your endpoint. If the domain ever changes, update this value and redeploy.

## 4. GitHub auth provider

No app registration required — Static Web Apps' built-in GitHub provider works
automatically in production, unlike local dev where the SWA CLI emulator fakes the whole
login flow with a local form. **First live smoke test**: visit
`https://<your-app>.azurestaticapps.net/.auth/login/github` and confirm it takes you
through a real GitHub OAuth consent screen, not a fake picker.

## 5. Custom domain

`promptcoach.dylanglover.com`, per `docs/unified-deployment-plan.md`'s DNS table.
Azure Portal → your Static Web App → Custom domains → Add; the registrar gets a
CNAME record pointing `promptcoach` at the app's `*.azurestaticapps.net` hostname
(plus a TXT validation record if Azure prompts for one). The CORS origin (step 3)
is already set to this domain, so no follow-up edit needed once it's live.

## 6. Post-deploy smoke test checklist

- [ ] Rate my prompt: submit a prompt, confirm a real rating comes back
- [ ] Learn page loads with all 7 lessons
- [ ] Practice mode: task list loads, submitting a prompt against a task grades it
- [ ] Log in with a real GitHub account, confirm the nav bar reflects it; log out
- [ ] Rate limiting actually triggers after the configured request count
- [ ] A normal, light-usage session never falsely hits the daily spend ceiling
- [ ] Check the browser console for errors on each page

## 7. Ongoing

- Anthropic usage/billing has no in-app dashboard — monitor spend directly at
  [console.anthropic.com](https://console.anthropic.com).
- `RUBRIC_VERSION` in `api/src/lib/rating.js` should be bumped on any future rubric
  change, so live ratings stay traceable to the exact rubric that produced them.
