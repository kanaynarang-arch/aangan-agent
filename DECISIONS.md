# Decisions

Where the brief was unclear or two sources disagreed, this is what I picked and why.
Each is a one-line change in `src/lib/rules.ts` unless noted.

## Product rules

1. **Lead-time conflict (6 weeks vs 8 to 10 weeks).** `services.md` says execution cannot begin on a project needing to be ready in under 6 weeks; `qualified.md` says 8 to 10. 6 weeks is the hard minimum (a clear fail). A completion deadline 6 to under 10 weeks away is amber (tight, a designer decides).
2. **The amber band applies to completion deadlines only.** T15 (possession in about six weeks, wants to start design now) is expected green. Its date is when the site becomes available, not a deadline to finish, so only the 6-week minimum applies to start and possession dates. T02 ("move in November, start design from October") is treated the same way.
3. **Timelines are measured from the call date**, not today's date, so the September fixtures behave as they did on the day (T06 "by December" is about 13 weeks, so green).
4. **No deadline stated means timeline met.** T11, T13 and T14 never give a deadline and are expected green. The live agent always asks, so this mostly matters for offline cases. The handoff note records "timeline not stated" as uncertain.
5. **Commercial under 500 sq ft is out of scope** (from T18). Over about 3,000 sq ft is out with a 10% tolerance. Residential has no size limit (T12, a 5,500 sq ft villa, is green). Restaurants, hotels, retail and gyms are out.
6. **"Budget clearly too low" threshold.** The rubric's own example is "1 to 1.5 lakh for a full flat". I treat a volunteered total at or below 1.5 lakh for any design-plus-execution scope as clearly too low (`BUDGET_CLEARLY_TOO_LOW_LAKH`). It is only applied when the caller volunteers a figure. The scorer can never fail a lead on budget if nothing was said (enforced in code, with a test).
7. **Decision-maker failed alone is amber**, not red, because the tier rules make red require a failed criterion 1 to 3, a low budget, or two failures. "Someone else decides and the caller is only checking" (T14) is *unclear*, so green with the uncertainty written into the handoff note.
8. **The model proposes, code decides.** Gemini returns criteria statuses and its own tier. `decide()` in `src/lib/scoring/decide.ts` re-applies the hard rules (area list, commercial size, lead time, budget) and derives the final tier. If the two disagree, the model's tier is kept as `ai_tier` and the override is shown under "Why this tier".
9. **One AI call per call.** Extraction (structured fields) and scoring come from a single Gemini request with a strict JSON schema. Half the tokens of two calls, and the scorer sees the same extraction it is judging.
10. **Dropped calls never reach the model.** No transcript, under 45 seconds, or fewer than 12 words from the caller. Logged, with a Telegram alert carrying the number.
11. **Escalations skip scoring.** The model only classifies the call type; a current client with a complaint becomes `escalate` and an urgent Telegram alert.
12. **Red leads are logged in the verify queue and never go to HubSpot.** A designer can approve (runs the green handoff) or drop.

## Pricing

13. **The agent never quotes a number**, which overrides the brief's line about quoting standard per-square-foot pricing. The only allowed reply is the exact sentence in `RULES.PRICING_ANSWER`. No figure from the internal pricing guide is in the repo, the database or the Vani prompt. `tests/rules.test.ts` fails if the prompt, greeting or any agent line in a fixture contains a rupee amount, a lakh figure or a per-sq-ft rate.

## Integrations

14. **Handoffs go to Telegram, not email.** Designers see it on their phones in seconds, it is a group (one note reaches everyone, anyone can reply in thread), and an unread email is how enquiries were being lost.
15. **Cal.com needs an attendee email** but callers are never asked for one. Bookings use a clearly synthetic address (`lead-<digits>@leads.aangan-studio.example`) with the caller's phone number as the contact. If the preferred slot is taken or missing, the nearest open slot is booked; if nothing works the Telegram note says "NOT booked: please schedule manually".
16. **HubSpot service key instead of a private app.** HubSpot has retired legacy private apps in this account; a service key is the replacement and works as a bearer token. Scopes are limited to contacts and deals, read and write.
17. **Cal.com API key set to never expire**, so the unattended agent does not silently stop booking. Rotate it in Cal.com settings if you prefer.
18. **Only real phone calls touch the outside world.** `calls.source` is `live` or `test`. A Vani call counts as live only if its call id starts with `inbound` (a real phone call). Web (WebRTC) test calls and every fixture are `test`: stored, scored and shown on the dashboard, but HubSpot, Telegram and Cal.com receive nothing; the `actions` table records what would have been sent. Set `TREAT_WEB_CALLS_AS_LIVE=true` to run one end to end. `LIVE_INTEGRATIONS=false` also keeps even live calls in dry-run.
19. **The webhook acts on `call_postprocessing` only.** That is the Vani event carrying the transcript, recording link and duration. Other events are acknowledged and ignored. The call is stored first, the response goes out at once, and scoring runs after the response (`after()`), with a retry-safe `vani_call_id` unique key.
20. **Signed webhook.** Requests carry an HMAC-SHA256 of the body in a header and are rejected if it does not match `VANI_WEBHOOK_SECRET`.

## Cost and data

21. **Voice cost is computed from the real call duration** at `VOICE_RATE_INR_PER_MIN` (default 5.5). Offline fixtures spend no Vani minutes, so their voice cost is 0; AI cost is the real token cost.
22. **Gemini model: `gemini-3.1-flash-lite`**, USD 0.25 per million input tokens and 1.50 per million output. The 2.5 models are closed to new accounts, and `gemini-3.5-flash-lite` costs more (0.30 and 2.50). About 1,300 input and 550 output tokens per call, roughly 10 paise. USD to rupee rate is a config value.
23. **"Answered within 5 minutes"** is measured from call start to the agent answering. The agent picks up immediately, so processed calls with any duration count as answered; a missed call (T08) does not.
24. **No login on the dashboard**, as specified. Anyone with the URL can see calls and press Approve or Drop. Fine for a case study; add auth before real callers' data goes in.
25. **Pricing guide read, not copied.** I read `pricing.md` as instructed, to make sure the agent could never leak it, and used nothing from it.
26. **Test fixtures are my own short paraphrases**, with invented names and phone numbers. The real transcripts, enquiries PDF and pricing guide are not in the repo.

## Tooling

27. **GitHub CLI** was downloaded from its official release to a temp folder to push the repo, authorised with a one-time device code for the `kanaynarang-arch` account.
