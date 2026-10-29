# Orpheus Resonance Protocol

**Make uncertainty visible. Make decisions inspectable.**

[![CI](https://github.com/topherchris420/orpheus-resonance-protocol/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/topherchris420/orpheus-resonance-protocol/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-3fbfa8.svg)](LICENSE)

Orpheus is an open-source, browser-based simulation and research workbench from **Vers3Dynamics**. Clear the access terminal, enter a fictional command room, weigh graded intelligence, commit a decision, and verify its consequences. Then open the research tools to examine a deeper question:

> When should an assistant advise, when should it explain, and when should it say the evidence is insufficient?

The command room makes decisions tangible. The research workbench makes their assumptions, evidence, and computation open to inspection.

**[Open Orpheus](https://parsonscorporation.vercel.app/)** · [Choose an experience](#choose-an-experience) · [Run locally](#run-locally) · [Research dossier](docs/RESEARCH_DOSSIER.md)

**Current scope:** an interactive prototype with a reproducible research core. Scenarios and physiological-looking telemetry are simulated. The built-in research assistant is deterministic; no language model or API key is required. Reported experiments use scripted agents, and no human-subject results have been established.

## Choose an experience

Orpheus has two independent experiences. The homepage opens the original command room; the research tools are available at their own routes and are not linked from that room.

| Start here | What you can do | How to open it |
| --- | --- | --- |
| **Command room** | Clear the access terminal, read the tactical map and SITREP, brief decisions on graded evidence, commit courses, and verify the session from its seed. | `/` → activation phrase |
| **Guided evidence explorer** | Follow a five-minute scenario with visible evidence, assistant explanations, and explicit abstention. | `/explore/orientation` |
| **Research workbench** | Inspect the study protocol, run simulated participants, examine calibration, and verify result packages. | `/research` |
| **Participant runner** | Walk through consent, practice, four counterbalanced blocks, and questionnaires. | `/study` |
| **Replay** | Verify and step through records exported from the command room or the research explorer. | `/replay` |
| **Method** | Inspect the evidence ladder and what remains unestablished. | `/method` |

Use these paths on the hosted app or append them to your local development URL. The included `vercel.json` serves these deep links on Vercel; other hosts need a single-page-app fallback (see [deployment](#signals-privacy-and-deployment)).

### Your first command-room session

1. **Clear the access terminal.** The boot sequence types itself out (Enter skips it). Type the activation phrase: `1912` by default, or type `HELP` if you do not have it. Power-on self-tests then check the hash function, the seeded generator and the simulation engine before the room opens.
2. **Read the room.** The tactical map, operator vitals, squad cohesion and the SITREP feed run on one seeded world. Every report carries a date-time group, a message precedence and an Admiralty grade.
3. **Decide on evidence.** Open **Decisions**. Each decision point shows its intel basis, graded A1–F6, and the uncertainty-aware analyst's assessment in ICD 203 terms, or its reason for withholding one. **Commit course**, then **Confirm commit**: the course is recorded in the hash-chained log.
4. **Advance deliberately.** **Advance phase** reveals later decision points and, from phase 2, the red-team simulation. **Auto advance** moves phases every 30 seconds.
5. **Review and verify.** **After-action** compares what each course assumed with what was actually true. **Download session record**, or **Verify in replay**: the record re-executes from its seed and must match every checkpoint.
6. **Work from the console.** Press `` ` `` (backtick) for the operator console: `help`, `status`, `sitrep`, `brief 1`, `commit 1 3`, `verify`, `seal`, `egress`, `selftest`.

Open `/?seed=7F3A-91C2` (any seed) to rebuild the same world exactly, for a second operator or a rerun. Reduced-motion preferences print the terminal at once and stop the interface's breathing and overlays.

### Your first research session

Open `/explore/orientation` and follow the guided scenario. Inspect which reports the evidence panel accepts, which it excludes, and why. Compare assistance conditions, make a decision, then use **After-action** to inspect the outcome. **Save record** exports the inputs needed for verification in `/replay`.

For batch experiments, open `/research`: inspect **Protocol**, run **Simulate**, examine **Results** and **Calibration**, then use **Reproduce** to verify a package or regenerate a simulated batch.

## What makes Orpheus worth exploring

- **Decisions leave a trace.** Every command in the room is validated by the engine and appended to a SHA-256 hash chain. One course per decision point; repeated or conflicting commitments are rejected; effects are bounded and authored.
- **Intelligence reads like intelligence.** Reports carry Zulu date-time groups, FLASH/IMMEDIATE/PRIORITY/ROUTINE precedence and Admiralty grades. Credibility is computed from corroboration by independent origins, never assigned by hand. Analyst assessments use ICD 203 estimative language and state confidence separately.
- **The terminal checks itself.** Power-on self-tests run FIPS 180-4 known-answer vectors, a differential test against the browser's WebCrypto, a hash-chain tamper probe and a scripted engine run that must reproduce a pinned state hash. An EMCON monitor shows every request that left, or tried to leave, the page.
- **Evidence can be challenged.** The research engine checks source reliability records, freshness, integrity, repeated origins, and changing assumptions. Excluded reports remain visible with reasons.
- **Abstention is an explicit result.** In the uncertainty-aware condition, insufficient evidence, unresolved conflict, or model misfit can prevent a conclusion. A displayed probability must pass calibration and domain checks.
- **Assistant statements cannot become evidence.** The research pipeline separates reports from assistant output. Proposals pass verification rules; unsupported output can be repaired or rejected, with a deterministic fallback.
- **Research records can be checked.** Seeded scenarios, command logs, state checkpoints, and versioned manifests support replay. Research packages carry the inputs and definitions needed to inspect their results.
- **Sensory feedback stays optional.** With explicit consent, microphone audio energy can modulate visuals and generated tones locally. The core experience works without it.

## One engine, two experiences

The command room and the research tools now run on the same deterministic engine, so a command-room session is as checkable as a research session.

| Property | Command room at `/` | Research explorer and workbench |
| --- | --- | --- |
| World generation | Seeded Building 47 mission (`?seed=` reproduces it) | Seeded scenarios, including the guided orientation |
| Decisions | Admiralty-graded evidence and the uncertainty-aware analyst (condition D) | Four assistance conditions, declared ground truth, and explicit scoring |
| Session record | `orpheus.session.v2`: seed, versions, manifest identity, hash-chained command log, state checkpoints | The same format, plus research packages |
| Replay | Exact: the `verify` console command and `/replay` re-execute the record and compare every checkpoint | Exact, with the same checks |
| Integrity | Hash chain and checkpoint hashes; they detect alteration, they do not authenticate the author | The same |
| Persistence | Refresh starts a new session; export a record to keep it; display preferences may persist | Export records to keep them; an in-progress participant study can resume from session storage in the same tab |

Command-room objective percentages are scenario bookkeeping, not validated performance scores, and its vitals belong to a fictional operator. Records from builds before the shared engine (`orpheus.simulation-session.v1`) can still be read in `/replay` but not replayed. Replay establishes that a computation can be reproduced; it does not establish that the simulation describes the real world.

## The research question

The workbench compares four assistance conditions under controlled information problems:

| Condition | What the participant receives |
| --- | --- |
| **A · Human only** | Evidence without assistant advice |
| **B · Conventional** | An assistant conclusion |
| **C · Explainable** | A conclusion with cited evidence and alternatives |
| **D · Uncertainty-aware** | Evidence checks, unknowns, a probability when permitted, and the ability to abstain |

The task family includes eleven information conditions: clean, conflicting, missing, stale, corrupted, echoed, shifted assumptions, misleading confidence, overload, contradictory assistant output, and overconfident assistant output. A versioned study protocol defines counterbalancing, sequential advice, scoring, hypotheses, and analysis before participant data collection.

### Evidence available today

The repository includes a committed **20,000-trial calibration run** and results from **seven scripted participant policies**. Calibration, guardrails, replay, and analysis can be inspected in code and regenerated locally.

These are simulation results. The task generator and uncertainty-aware assistant share a declared source model, so some advantages follow from that construction. The assistant is not better in every condition. Benefits for human decision-making, physiological regulation, and real-world operations remain unestablished. The participant runner has not been piloted with people.

| Read next | What it contains |
| --- | --- |
| [Research dossier](docs/RESEARCH_DOSSIER.md) | Research question, protocol, results, limitations, and next-stage experiments |
| [Baseline results](docs/results/baseline-agents.md) | Scripted-policy comparisons, intervals, failure cases, and reproducibility identifiers |
| [Calibration record](src/assistant/calibration.record.json) | Committed evaluation configuration and measurements |
| [Architecture](docs/ARCHITECTURE.md) | Evidence rules, assistant verification, deterministic core, and record formats |
| [Implementation audit](docs/AUDIT.md) | Engineering findings and implementation history |

## Run locally

Use **Node.js 24** and **npm**, matching the repository's CI environment.

```bash
git clone https://github.com/topherchris420/orpheus-resonance-protocol.git
cd orpheus-resonance-protocol
npm ci
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`. The app runs with built-in defaults. To customize them, copy [`.env.example`](.env.example) to `.env` and restart the dev server. No backend service or model credentials are required for the included experiences.

<details>
<summary><strong>Configuration reference</strong></summary>

These variables configure the app and the original command room. `VITE_` values are embedded in the client bundle; they must not contain secrets.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_APP_NAME` | `Orpheus` | App display name |
| `VITE_SUPPORT_EMAIL` | `support@example.com` | Contact in fatal-error fallback states |
| `VITE_REQUIRE_ACCESS_GATE` | `true` | Show the access terminal before the command room |
| `VITE_ENABLE_AUDIO_BIOFEEDBACK` | `true` | Make the command room's consent-gated audio-energy feature available |
| `VITE_MAX_INTEL_FEED_ITEMS` | `10` | Intel-feed history retained in memory |
| `VITE_MAX_ACCESS_ATTEMPTS` | `5` | Terminal attempts before its cooldown |
| `VITE_ACCESS_LOCKOUT_MS` | `30000` | Terminal cooldown in milliseconds |
| `VITE_ACCESS_PASSPHRASE` | `1912` | Public demo phrase; provides no authentication |
| `VITE_ACCESS_HINT` | `true` | Typing `HELP` at the terminal prints the phrase |

</details>

### Reproduce the committed research results

After installing dependencies:

```bash
npm run evaluate
npm run baselines
git diff --exit-code -- src/assistant/calibration.record.json docs/results
```

The final command should report no differences in an unchanged checkout. It checks that the generated calibration record and baseline results match the committed artifacts. CI runs this comparison alongside its software checks.

### Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite locally |
| `npm run build` / `npm run build:dev` | Build with production / development mode flags |
| `npm run preview` | Preview the built app locally |
| `npm run lint` / `npm run typecheck` | Check lint rules and TypeScript |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` / `npm run test:coverage` | Watch tests / collect coverage |
| `npm run test:e2e` | Run Playwright browser and accessibility checks |
| `npm run evaluate` / `npm run baselines` | Regenerate calibration / scripted-agent results |

Install Chromium once with `npx playwright install chromium` before running browser tests. For a code contribution, run lint, typecheck, unit tests, build, and end-to-end tests; regenerate results when changing the research core. The [CI workflow](.github/workflows/ci.yml) defines the full checks.

## Architecture at a glance

Built with **React 18, TypeScript, Vite, Tailwind CSS, Radix UI, Recharts, and Three.js**. Simulation and research calculations run in the browser; result-generation scripts reuse the research modules in Node.

| Area | Responsibility |
| --- | --- |
| [`src/components/PegasusSimulation.tsx`](src/components/PegasusSimulation.tsx), [`src/components/room`](src/components/room), [`src/command-room`](src/command-room) | The command room: terminal-styled panels bound to the engine, and the view model they share with the console |
| [`src/console`](src/console), [`src/tradecraft`](src/tradecraft), [`src/integrity`](src/integrity) | Operator console; date-time groups, precedence, Admiralty and ICD 203; self-tests, EMCON monitor, chain seal |
| [`src/engine`](src/engine) | Seeded randomness, simulated clock, command logs, mission transitions, and replay |
| [`src/evidence`](src/evidence) and [`src/assistant`](src/assistant) | Evidence assessment, calibration gating, proposals, verification, and fallback |
| [`src/scenarios`](src/scenarios) and [`src/experiment`](src/experiment) | Scenario manifests, controlled trials, study protocol, scoring, statistics, and packages |
| [`src/sensing`](src/sensing), `src/state`, `src/workers` | Microphone lifecycle, research session state, and background calculations |
| [`src/pages`](src/pages) and [`src/components/instruments`](src/components/instruments) | Research routes and their separate instrument components |
| [`e2e`](e2e), [`scripts`](scripts), [`docs`](docs) | Browser verification, reproducibility scripts, and research documentation |

An [OpenAI-compatible model adapter](src/assistant/providers/externalModel.ts) exists but is **not connected to the interface or part of the evaluated conditions**. It has only been tested with simulated responses. Connecting a real model requires recording displayed outputs for replay and updating the connection policy; see the architecture document.

## Signals, privacy, and deployment

- **Measured:** optional microphone audio energy, analyzed locally after explicit consent. Raw microphone samples are neither recorded nor transmitted.
- **Simulated:** threats, reports, pulse, respiration, HRV, stress, cohesion, and other physiological-looking displays. Microphone energy does not measure or infer these states. Orpheus is not a medical, biometric, or operational decision system.
- **Audio controls:** generated tones start at zero gain and have an output cap. Stopping the microphone stops the audio layer; choose a comfortable device volume before enabling it.
- **Local records:** preferences use local storage; an in-progress participant study uses session storage. Download a record or research package to keep it. Exports exclude raw microphone samples and the activation phrase.
- **Access control:** the terminal and its public phrase are theatrical. A protected deployment needs server-enforced identity and authorization.
- **No egress:** the production Content-Security-Policy ([`securityPolicy.ts`](src/config/securityPolicy.ts)) lets the page load and contact only its own origin. The EMCON monitor (`egress` in the console) shows anything that left or was blocked.
- **Hosting:** [`vercel.json`](vercel.json) serves the app as a single-page app (direct research links work), sends the same policy as a header with `frame-ancestors 'none'`, and adds `nosniff`, `no-referrer`, a microphone-only permissions policy and a same-origin opener policy. On other hosts, configure non-asset routes to return `index.html` and send equivalent headers. The Vite dev server uses localhost by default; expose it with `--host 0.0.0.0` only for intentional device testing.

<details>
<summary><strong>Troubleshooting</strong></summary>

- **Port occupied:** run `npm run dev -- --port 5174`.
- **Configuration unchanged:** restart Vite after editing `.env`.
- **Microphone unavailable:** check browser permissions and, for the command room, `VITE_ENABLE_AUDIO_BIOFEEDBACK`. The simulation remains usable without audio.
- **A research route returns 404:** on Vercel, check that `vercel.json` was deployed; elsewhere, configure the host's single-page-app fallback or open the route through the local Vite server.
- **Replay rejected:** check the reported engine version or manifest mismatch. Records made before the shared engine (`orpheus.simulation-session.v1`) can be read but not replayed.
- **A self-test fails:** the browser computes something differently from the reference; records it makes may not verify elsewhere. Run `selftest` in the console and report the failing line.

</details>

## Contribute

Useful contributions include new controlled scenarios, clearer evidence explanations, accessibility improvements, independent reproduction of results, and tests of where the declared model fails. Open an [issue](https://github.com/topherchris420/orpheus-resonance-protocol/issues) with a reproducible example or a specific research question.

When changing the research core, keep assumptions explicit, preserve signal provenance, and update the relevant tests and generated artifacts. Human studies and real-model evaluations are next-stage work described in the research dossier; they should be reported separately from scripted-agent results.

## License and authorship

Created by **Christopher Woodyard / Vers3Dynamics**. Released under the [MIT License](LICENSE).

Orpheus is not affiliated with, endorsed by, or funded by DARPA or any government agency.

*Build the instrument. Expose the assumptions. Leave the question open.*
