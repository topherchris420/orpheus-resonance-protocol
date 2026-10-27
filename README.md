# Orpheus

**A research instrument for one question: can an AI system improve human decisions under uncertainty by
knowing when to advise, when to explain, and when to refuse to make a recommendation?**

Orpheus puts you in a fictional situation with reports that may be conflicting, stale, relayed,
corrupted or missing, next to an assistant that concludes, explains — or declines when the evidence
cannot support a conclusion. Every session is seeded and recorded so it can be replayed exactly, and the
same engine runs controlled human–AI teaming experiments whose results can be regenerated bit for bit.

> Intelligence earns authority through evidence, not confidence.

Everything runs in the browser. No account, no AI service, no server, no special hardware.

## Five minutes with Orpheus

| Where | What you do |
| --- | --- |
| **Explorer · guided scenario** (`/explore/orientation`) | A five-minute tutorial that teaches by doing: check where evidence comes from, decide when sources agree, watch the assistant decline when two equally reliable reports disagree, read the data-quality notes on a corrupted and stale alarm, then open the after-action review — what you chose, what was true, what was known, and what the other assistants would have said. |
| **Explorer · full mission** (`/explore/building-47`) | The original Building 47 mission — phases, red-team simulation, squad cohesion, decision confirmation and consequences — now with evidence, ground truth and replay. The control room keeps the v1 instruments, honestly labeled. |
| **Research workbench** (`/research`) | Read the preregistered protocol; design an experiment (scenarios, assistance conditions, evidence quality and missing data, policies, seed); run it with scripted participants; compare conditions with intervals; inspect individual errors; export a research package; verify and reproduce any package; re-run the calibration evaluation; read every modeling assumption. |
| **Study runner** (`/study`) | Run the protocol with people: consent, practice, four counterbalanced blocks with sequential advice, questionnaires, withdrawal at any time, crash-safe resume, and a downloadable participant package. |
| **Replay** (`/replay`) | Load a session record, verify it against its state hashes, and step backward and forward through every decision and event. |
| **Method** (`/method`) | What has and has not been established (the evidence ladder), what every signal is, how the assistant reasons, and the limitations. |

## How it works

Each decision has three layers on screen:

- **Situation** — what is happening in the fictional world (map, contacts, reports, simulated vitals).
- **Evidence** — every item labeled *observed*, *reported*, *derived*, *assumed*, *missing* or *AI
  statement*, with its source grade, age and data-quality problems (failed integrity checks, relayed
  copies, stale readings, changed sources).
- **Decision** — courses of action that state what they rely on, with previews of their modeled effects,
  confirmed before they are recorded.

The assistant runs in one of four conditions: **A** none, **B** conventional (a suggestion), **C**
explainable (suggestion with evidence and alternatives), **D** uncertainty-aware (evidence, alternatives,
what is unknown, a probability only when its method has been evaluated, a bounded verification step, and
an explicit **insufficient evidence** state when it cannot conclude). Its reasoning can be inspected step
by step. A deterministic verifier checks every proposal; assistant output can never become evidence,
and the assistant can never take an action.

## What is established — and what is not

| Claim | Status |
| --- | --- |
| Sessions and experiments replay and regenerate exactly | **Reproduced** in Node and Chromium; CI regenerates the committed results and fails on any difference. |
| The uncertainty-aware probabilities are calibrated | **Observed in simulation**: expected calibration error 0.0056 over 20,000 decisions sampled from the declared source model (face-value baseline: 0.0923). Unknown on real sources. |
| Abstention prevents wrong conclusions for a policy that follows the assistant | **Observed in simulation**: 0.04 wrong conclusions per trial with D vs 0.43 with B (scripted agents). Partly true by construction, and not on every information condition. |
| Guardrails catch faulty model output | **Observed in simulation**: 200 of 200 simulated faulty proposals rejected. Never tested with a real language model. |
| Uncertainty-aware assistance improves *human* decisions | **Not established.** The protocol is preregistered and the runner is tested; **no human data has been collected.** |
| Ambient sensory feedback helps | **Not established.** Available as a study factor; no benefit assumed. |

Details, numbers and caveats: [`docs/RESEARCH_DOSSIER.md`](docs/RESEARCH_DOSSIER.md) and
[`docs/results/baseline-agents.md`](docs/results/baseline-agents.md).

## What is real, simulated and inferred

- **Measured:** only microphone audio energy, and only after explicit consent in the current visit. It is
  processed locally, never stored or sent, and never described as breathing, heart rate, HRV, stress or
  workload.
- **Simulated:** the world, the reports, the squad, and the fictional operator's pulse, HRV, respiration,
  stress and cohesion. None of it measures you.
- **Inferred:** nothing. Orpheus has no validated model that estimates anything about a person.

## Quick start

Requires Node.js 24 (as in CI).

```bash
npm ci
npm run dev          # http://localhost:5173
```

Optional: `cp .env.example .env` to change the settings below.

## Reproduce the results

```bash
npm run evaluate     # calibration record → src/assistant/calibration.record.json
npm run baselines    # scripted-participant experiments → docs/results/
git diff --exit-code -- src/assistant/calibration.record.json docs/results   # empty = reproduced
```

In the browser, Research → Calibration and Research → Simulate (default settings) reproduce the same
numbers and package hash; Research → Reproduce verifies any research package by replay.

## Tests

```bash
npm run lint         # ESLint, including determinism rules for the engine
npm run typecheck    # strict TypeScript for the app, configs and end-to-end tests
npm test             # unit tests (Vitest)
npm run test:e2e     # end-to-end, accessibility (axe) and microphone tests (Playwright, Chromium)
npm run build
```

The end-to-end suite builds and serves the production bundle itself. It needs a Chromium for Playwright
(`npx playwright install chromium`).

## Project structure

```text
src/
  engine/          seeded RNG, canonical JSON, SHA-256, hash-chained log, versions
  engine/mission/  event-sourced mission engine, replay verification, records, condition comparison
  evidence/        Evidence & Uncertainty Engine, calibration and its evaluation
  assistant/       output schemas, deterministic provider, guardrails, optional external-model adapter
  scenarios/       versioned mission manifests and the research task family
  experiment/      protocol, counterbalancing, study runner logic, scoring, statistics, agents, packages
  sensing/         signal registry and the consent-gated microphone sensor
  state/           store bridge, research jobs (Web Worker), study progress
  components/      Explorer, evidence, research, study and shared UI
  pages/           routes
docs/              architecture, research dossier, audit, generated results
e2e/               Playwright tests
scripts/           result generators
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the design and
[`docs/AUDIT.md`](docs/AUDIT.md) for the audit of the original prototype.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_APP_NAME` | `Orpheus` | Display name. |
| `VITE_SUPPORT_EMAIL` | `support@example.com` | Contact shown in the fatal-error screen. |
| `VITE_REQUIRE_ACCESS_GATE` | `true` | Shows the optional theatrical terminal on the landing page. It is fiction, not access control. |
| `VITE_ENABLE_AUDIO_BIOFEEDBACK` | `true` | Allows the optional local microphone response. |
| `VITE_MAX_ACCESS_ATTEMPTS` | `5` | Terminal attempts before a cool-down. |
| `VITE_ACCESS_LOCKOUT_MS` | `30000` | Cool-down length in milliseconds. |
| `VITE_ACCESS_PASSPHRASE` | `1912` | Public demo phrase shown next to the terminal; never put a secret here. |

`VITE_MAX_INTEL_FEED_ITEMS` is no longer read: the feed length is part of the deterministic engine, so
that two deployments cannot replay the same session differently.

## Privacy and boundaries

- No accounts, analytics or telemetry. A Content-Security-Policy restricts connections to the app's own
  origin. Records and research packages leave the browser only when you download them, and contain no
  audio, names, contact details, free text or device identifiers.
- Orpheus is a simulation and research environment. It does not target, control weapons or any real
  system, make autonomous decisions, or give operational advice. Its recommendations are limited to
  analysis and verification steps inside the fiction.
- Simulated values are never presented as measurements, and the assistant never shows a confidence value
  its method has not earned.

## Documentation

- [`docs/RESEARCH_DOSSIER.md`](docs/RESEARCH_DOSSIER.md) — problem, hypotheses, baselines, protocol,
  evaluation criteria, reproducibility, results and limitations, organized around the Heilmeier Catechism.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical architecture.
- [`docs/AUDIT.md`](docs/AUDIT.md) — audit of the v1 prototype and the implementation matrix.
- [`docs/results/`](docs/results) — generated results (do not edit by hand).

## License and affiliation

MIT (see [`LICENSE`](LICENSE)). Orpheus is a Vers3Dynamics project. It is not affiliated with, endorsed
by, or funded by DARPA or any government agency.
