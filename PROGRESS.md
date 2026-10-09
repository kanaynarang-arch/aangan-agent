# Progress

- [x] Case files read (brief, services, rubric, pricing guide, 20 phone enquiries)
- [x] Scaffold: Next.js 16 + TypeScript in `aangan-agent/`, own git repo, `.env` ignored before first commit
- [x] Gemini model checked: `gemini-3.1-flash-lite` (cheapest stable model open to new accounts)
- [x] `rules` config, Vani prompt, scoring prompt + strict JSON schema, deterministic tier logic
- [x] Neon database + migration
- [x] Webhook (signed), pipeline, HubSpot / Telegram / Cal.com clients behind `LIVE_INTEGRATIONS`
- [x] Dashboard: designer view, call detail, verify queue, pipeline view with cost
- [x] Offline harness: T01-T20 (+ T17a) pass and are stored as `source='test'`
- [x] Telegram bot and designers' group
- [x] HubSpot service key, Cal.com API key and "Design Consultation" event type
- [x] GitHub repo (public) and push
- [x] Vercel project, env vars, deploy, no-login dashboard, signed webhook test (bad signature 401, good 200, duplicate ignored, non-final ignored)
- [x] Vani agent created via API, webhook registered, connectivity test accepted
- [x] README, components map, DECISIONS
- [ ] One live Vani web test call (budget: about 10 minutes of the 100 rupee balance)
- [ ] First live HubSpot / Cal.com / Telegram write (only happens on a real call, or a web call with `TREAT_WEB_CALLS_AS_LIVE=true`)
