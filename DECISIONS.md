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
18. **Only live calls touch the outside world.** `calls.source` is `live` or `test`. A Vani call is live if its call id starts with `inbound` (a real phone call), or if `TREAT_WEB_CALLS_AS_LIVE=true` and it is a web (WebRTC) call. Web calls are otherwise `test`, and every fixture is always `test`: stored, scored and shown on the dashboard, but HubSpot, Telegram and Cal.com receive nothing; the `actions` table records what would have been sent. The flag is on in the deployment so one web call can run end to end, because phone numbers are not assigned in testing. `LIVE_INTEGRATIONS=false` keeps even live calls in dry-run.
19. **The webhook acts on `call_postprocessing` only.** That is the Vani event carrying the transcript, recording link and duration. Other events are acknowledged and ignored. The call is stored first, the response goes out at once, and scoring runs after the response (`after()`), with a retry-safe `vani_call_id` unique key.
20. **Signed webhook.** Requests carry an HMAC-SHA256 of the body in a header and are rejected if it does not match `VANI_WEBHOOK_SECRET`.

## Cost and data

21. **Voice cost is computed from the real call duration** at `VOICE_RATE_INR_PER_MIN` (default 5.6; the Vani dashboard shows an estimate of about 5.60 per minute for this agent, the brief said 5 to 5.50). Offline fixtures spend no Vani minutes, so their voice cost is 0; AI cost is the real token cost.
22. **Gemini model: `gemini-3.1-flash-lite`**, USD 0.25 per million input tokens and 1.50 per million output. The 2.5 models are closed to new accounts, and `gemini-3.5-flash-lite` costs more (0.30 and 2.50). About 1,300 input and 550 output tokens per call, roughly 10 paise. USD to rupee rate is a config value.
23. **"Answered within 5 minutes"** is measured from call start to the agent answering. The agent picks up immediately, so processed calls with any duration count as answered; a missed call (T08) does not.
24. **No login on the dashboard**, as specified. Anyone with the URL can see calls and press Approve or Drop. Fine for a case study; add auth before real callers' data goes in.
25. **Pricing guide read, not copied.** I read `pricing.md` as instructed, to make sure the agent could never leak it, and used nothing from it.
26. **Test fixtures are my own short paraphrases**, with invented names and phone numbers. The real transcripts, enquiries PDF and pricing guide are not in the repo.

## Tooling

27. **GitHub CLI** was downloaded from its official release to a temp folder to push the repo, authorised with a one-time device code for the `kanaynarang-arch` account.

## Vani

28. **Agent created through Vani's API** (`scripts/setup-vani.ts`): create-agent, then persona and experience updates. Webhook registration is dashboard-only. Default voice kept; language is English with auto-detect so Hindi works.
29. **Vani balance** was 100 rupees prepaid when I started. At about 5.60 a minute that is roughly 17 minutes in total; live test calls are limited to about 10 minutes (around 56 rupees) and the agent is capped at 6 minutes per call.
30. **Live vs test for Vani calls.** A phone call is live because its call id starts with `inbound`. Web calls get a different id, so they are test data unless `TREAT_WEB_CALLS_AS_LIVE=true`, which is on in the deployment for the end-to-end check. Fixture rows and the Chat-mode replay stay `test` either way.
31. **Secrets.** Nothing secret is in the repo. The deployed app holds the keys it needs as sensitive Vercel variables; the Vani API key (6 hour expiry) and the GitHub token (30 days) were only used for setup.
32. **First test run used Vani's Chat mode**, because an automated browser cannot speak into a microphone. The session cost 1.30 rupees and followed the script (one question at a time, exact pricing sentence, no budget question), but Vani does not send `call_postprocessing` or keep a transcript for chat sessions. I replayed that exact conversation through the signed webhook as `chat-replay-room-2ea1366a` (test data, voice cost set to the 1.30 Vani billed). The first Audio call is still needed to prove Vani's own webhook delivery.
33. **Booking stays after the call.** The brief allowed booking either on the call or after it. After keeps calls short (each minute is about 5.6 rupees) and means a calendar failure can never break a live call, so the webhook books the slot from the captured day and time. The agent therefore promises only that the designer will confirm the slot with the caller, and the prompt forbids saying it is secured, naming a tool, or promising a start date, price or design outcome. The required pricing sentence is unchanged, including its "I can book that for you right now" ending.

## Polish round

34. **Pipeline shows what the system generates, not only what it costs.** Two new tiles: leads handed to designers (green calls) and cost per lead handed over. The cost uses the total run cost of every call, including amber, red and dropped ones, divided by green leads, because the whole system is paid for whichever way a call ends. It shows "-" when there are none.
35. **The case's baseline is a muted reference line**, not a metric: about 48% of enquiries had no reply within 48 hours and about a third arrived outside 10am to 7pm. It sits under the page subtitle so the numbers below have something to be compared with.
36. **Pipeline defaults to live calls once one exists**, otherwise all calls, because the founder's numbers should be about real enquiries. The All, Live and Test chips stay, the active one is filled and ticked, and a note says when the figures include test data.
37. **Handoff and review notes carry a "Why green/amber/red" line** built from the rubric reasons already stored on the call: at most three, about 160 characters, rule-check overrides only if nothing else exists. A lead a designer approves from the verify queue keeps its original tier in the label, so the note says why it was amber or red.
38. **Upset callers.** The voice agent stays calm, apologises once, never argues or promises an outcome, takes name and number, and says a senior person will call back. It is prompt-only: tier logic and the existing-client escalation are untouched, and the pricing sentence is unchanged.
39. **Lint now passes.** The `any` types in scripts, the Vani parser, the Cal.com client and the queries were replaced with real types. One justified exception remains where third-party JSON is read, with a comment saying why.
40. **Designer view search and tier filter.** Search matches name, phone or location (phone matches on digits too, wildcards are escaped). The Live, Test and list choices survive every search, filter and link, and an empty result says "No calls match" with a Clear filters link.
41. **Call detail leads with a summary card** (tier, why, handoff summary, booking status, flags, anything uncertain), then extracted fields and the rubric, then what was sent, cost, transcript and recording. "Copy handoff note" copies the exact Telegram text for that call. Integration results use plain words: contact and deal created, note posted, consultation booked, not sent (test call), not sent (integrations are off), or failed with the reason.
42. **Review actions always say what happened.** Approve and Drop show a confirmation or an error, disable while working, and a lead someone else already decided says so instead of failing silently. The feedback stays on screen after the page refreshes. Tested on throwaway test rows, which were deleted.
43. **Accessibility.** Every text and background pair passes WCAG AA (4.5:1) in light and dark. Two fixes: the light-mode amber badge (was 4.3) and the dark-mode primary button, which had white text on light green. Tier badges carry a shape as well as a colour and always show their label.
44. **Phone widths.** Below 760px the call list becomes cards and two-column sections stack. Chrome would not shrink below about 735px, so I checked a 388px-wide frame on every page type with an overflow test: none scrolled sideways.
45. **Loading, error and not-found pages, a favicon, page titles and a type and spacing scale** so every page looks like part of one product. Dates are IST in 12-hour time, rupees use Indian grouping, and the Pipeline view still contains no transcripts or raw call text.
46. **The rubric lists its five criteria in rubric order** (1 to 5). Postgres returns stored JSON keys in its own order, which showed 4, 3, 1, 2, 5 on the live page.
47. **Not done on purpose.** No login (still as briefed, so anyone with the link can press Approve or Drop). No new pages, services or schema changes. The qualification rules, tier logic and the pricing sentence are untouched.
