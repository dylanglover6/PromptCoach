# PromptCoach

A web app that rates and improves AI prompts. Paste a prompt, get a scored
breakdown across five weighted dimensions plus structure/example modifiers, a
rewritten version, and (optionally) practice tasks graded against a specific
scenario.

## Features

- **Rate my prompt** — paste a prompt, the rater asks one clarifying question
  if intent is unclear, then returns a 100-point rubric score, per-dimension
  feedback, and a rewritten version you can iterate on with follow-up
  feedback.
- **Learn** — short lessons on prompt-writing fundamentals (goal clarity,
  context, constraints, output spec, success criteria, structure, examples).
- **Practice** — a bank of scenario-based tasks; write a prompt to solve the
  scenario and get it graded against that task's specific criteria.
- Optional GitHub login (Azure Static Web Apps built-in auth) — the app is
  fully usable without an account; login doesn't unlock extra features yet.

## Stack

- **Frontend**: React 19 + Vite, deployed as an Azure Static Web App
- **Backend**: Azure Functions (Node.js), served through the same Static Web
  App
- **AI**: Anthropic Claude API, called server-side only
- **Storage**: Azure Table Storage, used only for per-IP rate-limit counters
  and a daily spend ceiling (no user data is persisted server-side)

## Running locally

Requires Node (see `.nvmrc`) and an Anthropic API key.

```bash
npm install --prefix frontend
npm install --prefix api

cp api/local.settings.json.example api/local.settings.json
# then set ANTHROPIC_API_KEY in api/local.settings.json

npm install
npm run dev
```

`npm run dev` runs the Static Web Apps CLI, which proxies the Vite dev server
and the Functions API behind one local origin. The API uses Azurite
(in-memory Table Storage emulator) for rate limiting locally — no real Azure
resources are needed to develop.

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full checklist
(provisioning, Application Settings, custom domain, smoke tests).
