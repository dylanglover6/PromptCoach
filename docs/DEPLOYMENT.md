# Going Live — Deployment Checklist

Current status (2026-07-17): steps 1-5 of `promptcoach-mvp-spec-v2.md` are built
(scaffold, Rate my prompt, Learn, Practice mode, GitHub auth wiring). Step 6 (Cosmos DB)
is intentionally out of scope. Step 7 (rate limiting / cost controls) is **planned but
not yet implemented** — see the note below before making this public.

## Before deploying: finish rate limiting first (strongly recommended)

Right now `/api/rate`, `/api/practice/rate`, and `/api/rate/revise` call the real
Anthropic API with no request cap, no per-IP rate limit, and no daily spend ceiling.
Deploying to a public URL before that lands means unbounded cost exposure on your own
API key the moment anyone (or any bot) finds the URL. At minimum, before sharing the
live link with anyone:

- [ ] Add the input-length cap (cheapest protection, no new infrastructure — reject
      prompts over ~4000 characters before calling the API at all)
- [ ] Ideally: finish per-IP rate limiting and the daily spend ceiling (Azure Table
      Storage-backed; full design already scoped) before the URL is anything but
      private/unlisted
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
2. **Azure Storage Account** (only once rate limiting is implemented) — Standard
   performance, Locally-redundant storage (LRS) is enough and stays in the free-tier
   range for this traffic volume. Used only for the `UsageCounters` table (rate-limit
   counters + daily spend total) — no other data lives here.

## 2. Configure Application Settings

Azure Portal → your Static Web App → **Configuration** → Application settings. These
mirror `api/local.settings.json` locally but must be set here for the deployed
Functions app — `local.settings.json` is gitignored and never deploys:

| Setting | Value | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | your real key | Never commit this. Rotate immediately if it's ever exposed. |
| `RATER_MODEL` | *(optional)* | Defaults to `claude-haiku-4-5` if unset. |
| `TABLES_CONNECTION_STRING` | Storage Account connection string | Only once rate limiting is implemented; local dev uses `UseDevelopmentStorage=true` (Azurite) instead. |

`COSMOS_DB_CONNECTION_STRING` in `local.settings.json.example` is a leftover from the
original spec and isn't needed — Cosmos DB is out of scope (see project memory).

## 3. Fix the CORS placeholder

`frontend/public/staticwebapp.config.json` will need a `globalHeaders` block restricting
`Access-Control-Allow-Origin` to your real deployed domain once rate limiting is
implemented. You won't know the exact `*.azurestaticapps.net` domain (or your custom
domain, if you add one) until after the first deploy — update it and redeploy once you
do. This doesn't affect the app's own frontend calling its own API (same-origin calls
never trigger CORS checks); it only stops other sites from embedding your endpoint.

## 4. GitHub auth provider

No app registration required — Static Web Apps' built-in GitHub provider works
automatically in production, unlike local dev where the SWA CLI emulator fakes the whole
login flow with a local form. **First live smoke test**: visit
`https://<your-app>.azurestaticapps.net/.auth/login/github` and confirm it takes you
through a real GitHub OAuth consent screen, not a fake picker.

## 5. Custom domain (optional)

Azure Portal → your Static Web App → Custom domains → Add. Requires a CNAME (or ALIAS/
A record for an apex domain) at your DNS provider pointing at the app's default
hostname. Update the CORS origin (step 3) to match once this is live.

## 6. Post-deploy smoke test checklist

- [ ] Rate my prompt: submit a prompt, confirm a real rating comes back
- [ ] Learn page loads with all 7 lessons
- [ ] Practice mode: task list loads, submitting a prompt against a task grades it
- [ ] Log in with a real GitHub account, confirm the nav bar reflects it; log out
- [ ] Rate limiting actually triggers after the configured request count (once built)
- [ ] A normal, light-usage session never falsely hits the daily spend ceiling
- [ ] Check the browser console for errors on each page

## 7. Ongoing

- Anthropic usage/billing has no in-app dashboard — monitor spend directly at
  [console.anthropic.com](https://console.anthropic.com).
- `RUBRIC_VERSION` in `api/src/lib/rating.js` should be bumped on any future rubric
  change, so live ratings stay traceable to the exact rubric that produced them.
