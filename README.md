# Orpheus

Browser-based tactical simulation with generated mission events, squad state, visual pacing controls, and an optional microphone-reactive audio layer. The interface is an interactive fiction and systems-design prototype.

**What is real:** When explicitly enabled for the current visit, the browser reads microphone audio energy locally and uses it to vary a visual glow and generated tones. **What is generated:** Threats, intel, pulse, respiration, HRV, stress, cohesion, and recommendations. Audio energy cannot establish those physiological values. This app is not a medical, biometric, or operational decision system.

## A command room where every choice leaves a trace

Orpheus puts you inside a changing fictional situation. Read the map, weigh competing courses of action, and see how your choices change modeled pressure, cohesion, and objective progress. Then open the after-action review: each committed choice has a phase, a timestamp, and an explicit set of consequences.

### Try a complete session

1. Choose **Enter simulation** to open the focused workspace with a situation map, current objectives, and latest reports. The theatrical terminal is optional; no account, API key, or microphone is required.
2. Open **Decisions**. Inspect the tradeoffs, choose **Review course**, then **Confirm choice** to commit one course for an event. **Keep comparing** closes the confirmation without changing the record. Its alternatives close for this visit, even if you switch views.
3. Use **Advance phase** to reveal later events and unlock the red-team controls. Phases stay under your control by default; **Auto advance** optionally advances every 30 seconds.
4. Switch back to **Situation map** whenever you want. Opening decisions no longer replaces the map permanently.
5. Open **After-action** to review your decisions and objective progress. **Download session JSON** or **Save record** preserves the record before you refresh.

6. Use **New session** to start over without reloading the page. The confirmation offers a download before clearing your decisions and stopping audio.
7. Open the **full control room** for generated vitals, charts, pacing controls, and the touch surface. **Guide** is always available. Ambient effects start off; reduced-motion preferences suppress interface movement and overlays.

### What makes the loop work

- **One authoritative decision ledger.** The model accepts only available event/outcome pairs, resolves effects from its own catalog, and rejects repeated or conflicting commitments. Pending events replenish the shortlist.
- **Inspectable consequences.** Choices apply deterministic, bounded changes to simulated pressure, stress, cohesion, and objectives. Displayed authored weights are metadata, not calibrated success probabilities; no probability draw is performed.
- **Reviewable sessions.** Exports include the decision ledger, objective snapshot, up to 120 recent events, and 48 chart samples with source labels. No raw microphone data or activation phrase is included.
- **Optional sensory layer.** Explicit per-visit microphone consent enables local audio-energy response. Generated tones start at zero gain, have a fixed output cap, and stop with the microphone control.
- **A guided, responsive workspace.** Contextual next steps lead from the first decision through the complete catalog. The focused view keeps the map, readable choices, objectives, and reports together; the optional full control room exposes deeper tools. Layout changes do not alter the cohesion model.
- **Deliberate session controls.** Confirm a course before recording it, export at any time, and restart with an explicit confirmation. Microphone permission is requested again for each new session. Display preferences persist locally; dismissed alerts belong only to the current session.

### Boundaries of the model

The tactical world and telemetry use random generators; a full session is **not deterministically replayable**. Only the catalog decision transition is deterministic for a given state and choice. The review remains live while the world advances. Objective percentages are authored scenario bookkeeping, not validated measures of success or operator performance. Refresh starts a fresh decision session; preferences may persist locally. Exports are snapshots, not authenticated audit logs.

## Research tools (off the main path)

Alongside the command room, the repository contains research tools for one question: can an AI
assistant improve decisions under uncertainty by knowing when to advise, when to explain, and when to
decline? They are not linked from the main experience; open them directly:

| Address | What it is |
| --- | --- |
| `/explore/orientation` | A guided five-minute scenario with an evidence panel and an assistant that concludes, explains or declines. |
| `/research` | An experiment workbench: preregistered protocol, simulated participants, results with intervals, calibration, package verification. |
| `/study` | A participant runner for the protocol (consent, practice, four counterbalanced blocks, questionnaires). |
| `/replay` | Verifies and steps through session records from the explorer. |
| `/method` | What has and has not been established. |

They run on a separate, deterministic engine (`src/engine`, `src/evidence`, `src/assistant`,
`src/scenarios`, `src/experiment`) and use their own copies of the instruments
(`src/components/instruments`) and their own palette, which applies only while they are open. They do
not change the command room. No human-subject data has been collected; results so far come from
scripted agents in simulation. Details: [`docs/RESEARCH_DOSSIER.md`](docs/RESEARCH_DOSSIER.md) and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Project structure 

```text
src/
  components/      Reusable UI and domain modules (sim widgets, status panels)
  config/          App-level runtime configuration parsing
  data/            Static/mock realistic data sets + tests
  hooks/           Custom interaction and state hooks
  pages/           Route-level views
  lib/             Shared utilities

  engine/ evidence/ assistant/ scenarios/ experiment/ sensing/ state/ workers/ content/
                   Research tools (see above)
  components/{instruments,explorer,research,study,evidence,charts,common}/
                   Research tool interface
e2e/               Browser tests (Playwright)
scripts/           Result generators for the research tools
docs/              Audit, architecture, research dossier, generated results
```

## Prerequisites

- **Node.js 24** (matches CI)
- **npm** (ships with Node)

## Quick start

1. Install dependencies:
   ```bash
   npm ci
   ```
2. Create a local environment file:
   ```bash
   cp .env.example .env
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open the local URL printed by Vite (usually `http://localhost:5173`).

## Environment variables

Use `.env.example` as the baseline.

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_APP_NAME` | `Orpheus` | Display name shown in the UI. |
| `VITE_SUPPORT_EMAIL` | `support@example.com` | Contact shown in fatal-error fallback states. |
| `VITE_REQUIRE_ACCESS_GATE` | `true` | Enables/disables the theatrical activation screen. |
| `VITE_ENABLE_AUDIO_BIOFEEDBACK` | `true` | Enables local microphone audio-energy analysis. |
| `VITE_MAX_INTEL_FEED_ITEMS` | `10` | Max intel-feed history retained in UI memory. |
| `VITE_MAX_ACCESS_ATTEMPTS` | `5` | Allowed gate attempts before lockout. |
| `VITE_ACCESS_LOCKOUT_MS` | `30000` | Lockout duration in milliseconds. |
| `VITE_ACCESS_PASSPHRASE` | `1912` | Public demo phrase embedded in client JavaScript; never put a secret here. |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local development server. |
| `npm run build` | Create production bundle. |
| `npm run build:dev` | Build using development mode flags. |
| `npm run preview` | Preview production build locally. |
| `npm run lint` | Run ESLint across the project. |
| `npm run typecheck` | Run TypeScript without emitting build output. |
| `npm run test` | Run the Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run test:coverage` | Run tests with coverage output. |
| `npm run test:e2e` | Run the browser tests (Playwright; needs `npx playwright install chromium` once). |
| `npm run evaluate` | Regenerate the research tools' calibration record. |
| `npm run baselines` | Regenerate the research tools' simulated-participant results in `docs/results`. |

## Recommended local validation sequence

Run these before opening a PR:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

## Production and security notes

- The activation screen provides no access control. For a protected deployment, enforce identity, authorization, and audit logging on a server.
- Microphone permission is requested per visit and audio samples are analyzed in browser memory. The app does not record or transmit the microphone stream. Browser permission and local preferences are under the visitor's control.
- A low-frequency audio FFT envelope is an audio proxy, not breath or pulse sensing. All physiological-looking dashboard numbers come from simulation generators. Do not use them to assess a person.
- The **Export** button downloads a JSON snapshot of this visit's decisions, objectives, recent simulated events, and metrics. The schema includes explicit provenance for each signal family; it is a demo record, not a verified audit log.
- Tones are generated by local Web Audio oscillators. Gain starts at zero and is capped, but visitors should set a comfortable device volume before enabling audio.
- The Vite dev server binds to localhost by default. Use `npm run dev -- --host 0.0.0.0` only when intentionally testing on another device.

## Troubleshooting

- **Port already in use**: run `npm run dev -- --port 5174` to use an alternate port.
- **Environment changes not reflected**: stop/restart the Vite dev server after editing `.env`.
- **Microphone access unavailable**: check browser permissions and `VITE_ENABLE_AUDIO_BIOFEEDBACK=true`; manual simulation remains available.

## License

MIT (see [`LICENSE`](LICENSE)). Orpheus is a Vers3Dynamics project. It is not affiliated with, endorsed by,
or funded by DARPA or any government agency.
