# Phase 0 — System audit

Audit of `main` at `7f90d94` ("Make Orpheus approachable with a guided workspace and deliberate session
controls"), performed before any changes in this branch. Every claim below was checked against the source.
Line references point to the audited revision.

Baseline toolchain on that revision: `npm run lint`, `npm run typecheck`, `npm test` (21 tests in 8 files)
and `npm run build` all passed. A strict-mode TypeScript probe (`strict: true`) produced only 7 errors in
3 files, so the whole application could be moved to strict typing.

## 1. Architecture as found

```text
index.html (CSP meta) → main.tsx → AppErrorBoundary → App (QueryClient, Tooltip, Router "/")
  → pages/Index → AccessTerminal (welcome + optional theatrical terminal)
               → PegasusSimulation (700-line component; owns world, UI and timers)
                    ├─ hooks: usePhaseProgression, useRedTeamSimulation, useMissionScenario,
                    │         useInteractionState, useAudioAnalysis, useBreathPulseModulation,
                    │         useMetricsHistory, useOperatorBaseline, usePersistentState
                    ├─ data:  realisticData (module-level singleton generator), decisionScenarios
                    ├─ lib:   missionSession (decision ledger), sessionRecord (export),
                    │         sessionGuidance, missionUx (alerts/telemetry text)
                    └─ ~20 panels (map canvas, decisions, vitals, intel, cohesion, metrics, …)
```

All world generation happens inside React effects using `Math.random()` and `Date.now()`
(88 call sites outside tests and `components/ui`). There is no seed, no simulation clock, and no
command log, so a session cannot be reproduced.

## 2. Feature inventory

### Implemented and working

| Feature | Where | Notes |
| --- | --- | --- |
| Welcome page, "Enter simulation", optional theatrical terminal (demo phrase, attempt lockout) | `AccessTerminal.tsx` | Copy already states the terminal is fiction, not access control. |
| Focused workspace: guidance banner, map/decisions, objectives, reports, last choice | `PegasusSimulation.tsx:566-588` | |
| Full control room (desktop grid + mobile tabs) | `PegasusSimulation.tsx:589-687` | |
| Authoritative decision ledger: catalog-resolved effects, duplicate/conflicting commits rejected, shortlist replenishment | `lib/missionSession.ts` | Strongest part of the codebase; tested. |
| Course confirmation ("Review course" → "Confirm choice" / "Keep comparing") | `DecisionMatrixSimulator.tsx` | Focus is restored after the dialog. |
| Phase progression 1–4, manual advance, optional 30 s auto advance | `usePhaseProgression.ts` | |
| Red-team simulation (phase ≥ 2): intensity random walk, deception lines, injected contact and report | `useRedTeamSimulation.ts`, `PegasusSimulation.tsx:256-264` | |
| Squad cohesion model, independent of whether its panel is mounted | `lib/sessionGuidance.ts:39` | |
| Generated world: intel feed, moving tracks, squad movement, route, vitals | `data/realisticData.ts` | |
| After-action review dialog | `SessionReview.tsx` | |
| Session export `orpheus.simulation-session.v1` with provenance labels; no microphone samples | `lib/sessionRecord.ts` | Export only; no import. |
| New session with confirmation and download offer | `SessionControls.tsx` | Remounts the simulation via a React key. |
| Local microphone energy, consent dialog, binaural tones with zero start gain and 0.2 cap | `useAudioAnalysis.ts`, `BiofeedbackConsentDialog.tsx` | Permission requested every visit. |
| Breath/pulse visual pacing via CSS variables, presets | `useBreathPulseModulation.ts`, `BreathPulseControls.tsx` | |
| Ambient overlays (off by default), reduced-motion CSS | `VisualOverlays.tsx`, `index.css:148` | |
| Lazy-loaded 3D view (three.js) | `NeuroEmSimulator.tsx` | |
| Metrics history, sparklines, baseline reference window (localStorage) | `useMetricsHistory.ts`, `OperatorMetricsDashboard.tsx`, `useOperatorBaseline.ts` | Baseline is honestly labeled as a simulation baseline. |
| Derived alerts, dismissible per session | `lib/missionUx.ts`, `MissionAlertQueue.tsx` | |
| Error boundary, env-driven config with clamping, CSP meta tag | `AppErrorBoundary.tsx`, `config/appConfig.ts`, `index.html` | |

### Unfinished or non-functional

| Item | Evidence |
| --- | --- |
| Temporal archive coordinates never change | `handleTemporalShift` (`useInteractionState.ts:32`) is never called; artifacts unlock by phase only. |
| Interaction events are captured but never read | `useInteractionState.interactionEvents`. |
| `cohesionScore` / `setCohesionScore` in `useInteractionState` | Never used (cohesion is computed elsewhere). |
| `accessLevel` state in `pages/Index.tsx` | Written, passed down, never read. |
| "Harmonic mode" toggle | Only changes text (`TouchInterface.tsx:116-133`). |
| `ElectrokineticModelingLayer.tsx`, `CollapsiblePanel.tsx` | Never imported or rendered. |
| `@tanstack/react-query` | Provider configured, no queries exist. |
| Deterministic replay | Explicitly unsupported (README "Boundaries of the model"). |
| Decision accuracy | Decision points have no evidence model, hypotheses or ground truth, so no choice can be scored. |

### Simulated capabilities (generated, not measured)

Threats, tracks, squad state, intel, pulse, HRV, respiration, stress, cohesion, "intel accuracy",
objectives and recommendations. The only measured signal is low-frequency microphone audio energy.

## 3. Architectural limitations

1. **Nondeterministic world.** Six timers (`setInterval`, 2.5–45 s) mutate state with `Math.random()`.
   Vitals depend on wall-clock time (`Math.sin(Date.now() / 30000)`, `realisticData.ts:248`).
   `squadVitals` calls `Math.random()` during render (`PegasusSimulation.tsx:250`).
2. **Module-level singleton generator leaks across sessions.** `dataGenerator` keeps `intelHistory` and ID
   counters at module scope (`realisticData.ts:57-60, 259`). "New session" remounts the component, but
   `useState(() => dataGenerator.getIntelFeed())` then starts with the previous session's reports.
3. **God component.** `PegasusSimulation` owns about 30 state values, 6 timers and all handlers, mixing world
   simulation, UI state and side effects. World transitions are not testable without React.
4. **No ground truth.** Courses of action carry authored effects but nothing defines what was actually true,
   so the system cannot measure accuracy, false positives, overreliance or calibration.
5. **Export is a one-way snapshot.** No seed, command log, scenario version or hash; records cannot be
   imported, compared or replayed.
6. **Event IDs from `Date.now()`.** `createEventId` (`PegasusSimulation.tsx:53`) can collide within a
   millisecond; `appendOperatorEvent` deduplicates by ID and would silently drop the later event.

## 4. Duplicate state

| Duplicate | Locations | Consequence |
| --- | --- | --- |
| Intel history | `RealisticDataGenerator.intelHistory` and `PegasusSimulation.intelFeed` | Two sources of truth; the module copy survives restarts. |
| Phase | `usePhaseProgression.acclimatizationLevel` and `Index.accessLevel` | `accessLevel` is dead state. |
| "Pulse" of the operator | Vitals generator (HRV/resp/stress) and `squadPositions[0].vitals.heartRate` (command strip) | Two unrelated generated sources shown as one person's vitals. |
| Cohesion | Computed in `PegasusSimulation` and again in `SquadCohesionIndex`; unused third copy in `useInteractionState` | Consistent today, fragile. |
| `bioResonanceFrequency` | Written by the audio loop (5–11 Hz beat), vitals buttons (4–40 Hz "marker"), touch slider (20–20 000 Hz) | One variable, three incompatible meanings; the 3D view clamps it to 1–40 Hz. |

## 5. Misleading terminology and unsupported claims

| Text | Location | Problem |
| --- | --- | --- |
| "SACRED FREQUENCIES", "Love — 528Hz · DNA Repair", "Awakening — 963Hz · Crown Chakra", "Transformation — 741Hz · Cleansing" | `TouchInterface.tsx:21-27, 90` | Medical/biological claims with no basis. |
| "Consciousness synchronization enabled", "You are now part of the resonance network" | `TouchInterface.tsx:129, 142` | Presented as system state. |
| "Neuro-EM Simulator", "Predicted Cognitive Effects" (e.g. "Enhanced problem-solving", "Auditory hallucination", "Memory recall interference") | `NeuroEmSimulator.tsx:20-46, 216` | Framed as predictions of stimulation effects on brain regions; no model exists. |
| "Voice pattern matches historical Orpheus signature" | `TemporalArchive.tsx:90` | Triggered by microphone loudness; implies voice identification. |
| "Run bio-resonance down-regulation — Stress drops over 90 seconds" | `decisionScenarios.ts:181-193` | Therapeutic effect stated as fact inside the fiction, unlabeled. |
| "Shift support frequency toward calm" | `missionUx.ts:148` | Implies a frequency can calm a person. |
| `healingTone` | `useAudioAnalysis.ts` | Therapeutic naming for a carrier oscillator. |
| "Intel Accuracy" | `OperatorMetricsDashboard.tsx:25`, formula at `PegasusSimulation.tsx:317` | A hand-written formula, not an accuracy. |
| "Operator Stress", "Cognitive Load Management: Operator stress index is trending above the sustainable band" | metrics dashboard, `decisionScenarios.ts:161` | Reads as the visitor's own stress; it is a generated character value. |
| "Authored weight 62%" next to every course | `DecisionMatrixSimulator.tsx:129`; field named `probability` | Percentages look like success probabilities. |
| "Jefimenko field equations", "thrust zones", kV controls | `ElectrokineticModelingLayer.tsx` (unrendered) | Pseudo-physics. |

The README, consent dialog and command strip were already careful ("Simulated · mic audio only"); the problems
above are the places that contradicted them.

## 6. Accessibility gaps

- `TouchInterface` responds to mouse events only; no keyboard or touch path.
- Radix slider thumbs have no accessible name (`components/ui/slider.tsx` forwards no label to the thumb).
- Map tracks are all triangles distinguished only by color (`TacticalDataDisplay.tsx:71-85`).
- Charts and canvases (`OperatorMetricsDashboard`, `SquadCohesionIndex`) have no tabular alternative;
  the cohesion canvas has no label at all.
- Much control-room text is 9–10 px.
- `VisualOverlays` requests `animation: 'static 0.16s infinite'` (6.25 Hz). The keyframes are undefined, so it
  is a no-op today, but defining them would violate WCAG 2.3.1 (three flashes per second).
- `NotFound` uses a light theme unrelated to the application.
- Critical alerts are not announced to assistive technology.

## 7. Performance bottlenecks

- `useAudioAnalysis` calls `setAnalysisState` every 50 ms, re-rendering the whole 700-line tree at 20 Hz while
  the microphone is on.
- `SquadCohesionIndex` runs `requestAnimationFrame` continuously and calls `Math.random()` per frame to draw
  links (flicker and constant CPU).
- Every timer tick re-renders `PegasusSimulation` and all unmemoized children.
- The three.js chunk (596 kB) is lazy-loaded; acceptable.

## 8. Tests and CI

- 21 unit tests (Vitest, `node` environment): ledger rules, record shape, guidance, alert derivation,
  generator bounds, tone gain cap, build policy, one copy check.
- No component tests, no end-to-end tests, no accessibility tests, no replay tests, no coverage threshold.
- CI (`.github/workflows/ci.yml`): one job on Node 24 — lint, typecheck, test, build. Action versions are
  enforced by `buildPolicy.test.ts`.

## 9. Implementation matrix

| Area | Decision | Rationale |
| --- | --- | --- |
| Decision ledger rules (catalog-resolved effects, one course per event, duplicate rejection) | **Preserve** | Correct and tested; re-hosted inside the deterministic engine with the same tests. |
| Building 47 mission, its five decision points, phases, objectives, red team, squad cohesion | **Preserve + improve** | Same content and effects; each event gains an evidence set, declared hypotheses and seeded ground truth. |
| Course confirmation dialog, after-action review, new-session flow, session export | **Preserve + improve** | Confirmation gains a decision preview; review gains "what was true / known / uncertain"; export becomes a replayable, hash-verified record; v1 records import read-only. |
| Microphone energy, consent dialog, tone cap, breath/pulse pacing, reduced motion | **Preserve + improve** | Refactored behind a sensor interface with explicit consent, quality flags and immediate disconnect; no longer re-renders the app at 20 Hz. |
| Theatrical terminal | **Preserve** | Stays optional and labeled as fiction. |
| 3D view, temporal archive, touch surface | **Preserve + relabel** | Kept as fictional instruments; pseudo-scientific claims removed; touch surface gains keyboard and pointer input. |
| `realisticData` singleton, timers, `Math.random`/`Date.now` world generation | **Replace** | Seeded engine systems on a controlled tick clock; no module state. |
| `PegasusSimulation` state ownership | **Replace** | An external store owns engine state; panels subscribe to slices. |
| "Intel accuracy", "Operator stress", authored-weight percentages | **Replace** | Honest names; weights shown only as labeled metadata in research views. |
| `ElectrokineticModelingLayer`, `CollapsiblePanel`, unused interaction state | **Remove** | Unreachable; the first contains unlabeled pseudo-physics. |
| Seeded RNG, simulation clock, versioned manifests, command log, snapshots, state hashes, replay verification | **Introduce** | Phase 4. |
| Evidence & Uncertainty Engine, insufficient-evidence state, calibration evaluation | **Introduce** | Phase 3. |
| Assistant layer with schema validation, guardrails, abstention, deterministic default | **Introduce** | Phase 2. |
| Human–AI teaming protocol (conditions A–D), counterbalancing, scoring, statistics | **Introduce** | Phase 5. |
| Robustness laboratory (eight perturbation families) | **Introduce** | Phase 6, built on the existing red-team concept. |
| Explorer Mode (guided tutorial, previews, outcome summary, replay, comparison) and Research Mode / workbench | **Introduce** | Phases 1 and 9; both run the same engine. |
| Strict TypeScript, runtime validation, component/E2E/accessibility tests | **Introduce** | Phase 11. |

## 10. Outcome of the implementation matrix

Status after the 2.0.0 rework. "Done" means implemented and covered by automated tests; anything less is
stated.

| Area | Outcome |
| --- | --- |
| Decision ledger rules | Done. Re-hosted in the mission reducer (`engine/mission/reducer.ts`); the v1 tests were ported. |
| Building 47 mission, phases, objectives, red team, squad cohesion | Done. Same decisions and effects; each event now has evidence, hypotheses and seeded ground truth; red-team reports are injected into open decisions. |
| Confirmation, after-action review, new session, export | Done. Decision preview in the confirmation; review shows what was chosen, true, known and uncertain, and how B–D would have advised; exports are replayable hash-chained records; v1 records import read-only. |
| Microphone, consent, tone cap, pacing, reduced motion | Done. Consent token required by the sensor; every track stops on stop and on leaving (tested in a browser with a synthetic microphone); React updates throttled to 4 Hz. |
| Theatrical terminal | Done. Optional, on the landing page, labeled as fiction. |
| 3D view, temporal archive, touch surface | Done. Pseudo-scientific claims removed; touch surface works with keyboard and pointer. |
| `realisticData` singleton and timer-driven world | Done. Replaced by seeded world systems on the tick clock; generator-bound tests ported. |
| `PegasusSimulation` state ownership | Done. An external store owns engine state; the component was removed with the other replaced modules. |
| Misleading names and percentages | Done. Honest labels; authored weights are metadata only. |
| Unreachable modules | Done. Removed. |
| Seeded RNG, clock, manifests, log, snapshots, hashes, replay | Done. Replay verified in Node and Chromium; other browsers untested. |
| Evidence & Uncertainty Engine | Done. Calibration evaluated on the declared domain only. |
| Assistant layer | Done for the deterministic provider. The external-model adapter is implemented and tested against simulated responses but not connected to the interface. |
| Human–AI teaming protocol and runner | Done. No human data collected. |
| Robustness laboratory | Done, with eleven information conditions (including assistant faults) rather than eight. |
| Explorer Mode and Research workbench | Done. The workbench configures scenarios, assistance conditions and evidence mixes, and reproduces packages. |
| Strict TypeScript, runtime validation, tests | Done. Unit, end-to-end and automated accessibility tests; no manual assistive-technology testing yet. |

## 11. Update: the original interface is the main experience again

At the owner's request, the original command room (the interface audited in §1–§8) is restored
unchanged at `/`. The rows above that say "removed" or "replaced" describe the research tools, which
now live off the main path (`/explore`, `/research`, `/study`, `/replay`, `/method`) with their own copies
of the instruments. The audit findings in §5–§7 (unsupported labels, accessibility gaps, re-render
costs) therefore apply to the main experience again and are candidates for improvement in its own
style. A pixel comparison against the original build (frozen randomness and clock, desktop and phone
widths) found no difference other than a feed timestamp that also varies between two runs of the
original build.

## 12. Update: the command room draws for less

At the owner's request ("smoother and lighter", every label kept as it is), the command room now does
less work for the same picture.

- **Breathing and pulse animation** (not listed in §7). It wrote eight CSS custom properties onto the page
  root on every frame, so the browser recomputed the styles of the whole page about 60 times a second,
  even with ambient effects off. The values now go only to the elements that use them: the breathing
  ring, the ambient overlay and, with ambient effects on, the workspace grid's own transform and filter
  (`useBreathPulseModulation.ts`).
- **Microphone** (§7). The audio analysis re-rendered the whole command room 20 times a second. The live
  level now goes straight to the breathing animation, and the command room re-renders only while the
  level is above the temporal archive's threshold, the one place that reads it (`useAudioAnalysis.ts`).
- **Not changed.** The squad cohesion graph still draws every frame: skipping it while scrolled out of
  view saved about 3%, within measurement noise, and could show one stale frame as it comes into view.
  Ambient effects stay costly by design; blurring and scaling the whole workspace every frame is the effect.

CPU time per second of use, in milliseconds (headless Chromium with software rendering, 1440×900, median
of three 10-second windows). The main thread is where page work competes with input; all processes adds
compositing and rasterization.

| Situation | Main thread, original | Main thread, now | All processes, original | All processes, now |
| --- | ---: | ---: | ---: | ---: |
| Focused workspace | 200 | 21 | 274 | 64 |
| Full control room | 459 | 137 | 547 | 208 |
| Full control room, microphone on | 541 | 142 | 710 | 287 |
| Full control room, ambient effects on | 160 | 52 | 1,372 | 1,254 |

How "looks the same" was checked:

- **Pixels.** With randomness and the clock frozen, 16 of the 19 screens that repeat exactly between runs
  of the original are identical in the new build: welcome, focused workspace and its views, after 30
  seconds and the full control room at desktop and phone widths, and the phone-width screens with ambient
  effects. The other three are desktop screens with ambient effects later in a run (see below).
- **Ambient effects.** In 12 sampled frames, every element the animation touches computes the same
  transform, filter, opacity and shadow as under the original mechanism. Switched on from the same
  state in both builds, the effect differs from the original by no more than the original differs from
  itself between runs (at most 4 of 255 levels, in the blur).
- **Simulated events.** Later in a run, the cohesion graph and other generated content can come out
  differently, because the original's events depend on timing: when a simulation timer fires between two
  animation frames, whether the page re-renders before the next frame changes the order in which random
  numbers are drawn. The original build changes on the same screens when it merely runs at half speed.
  With timing held fixed, both builds draw the same 9,854 random numbers in the same order.
- **Tests.** End-to-end tests check that the breathing animation reaches only the elements that show it
  and that the microphone still drives the command room.

## 13. Update: the terminal look returns, on the deterministic engine

The owner asked for the look the site had before the October redesign, "a very cool terminal/matrix
look", with the engineering behind it raised to a standard an intelligence agency would respect.

**What the history shows.** From June 2025 to September 2026 the site was a terminal: a green-on-black
access terminal typing "CLASSIFIED SYSTEM ACCESS" line by line, then a dense twelve-column command grid.
Commit `0bc2e28` (23 October 2026) replaced the terminal with a sans-serif landing page ("Every choice
leaves a trace"), rounded cards and a scrolling "full control room". §11 restored the state *after*
that commit, so the redesign stayed. This update restores the access terminal's copy as of June 2026
(`454b712`, after the owner removed its disclaimer) and the command grid as of September 2026 (`7dd523a`),
with the in-world panel wording of June. Builds of eleven historical revisions were screenshotted to fix
the target.

**Defects in the original terminal UI, now fixed without changing the look.**

| Defect | Cause | Fix |
| --- | --- | --- |
| White buttons in a black terminal (EXECUTE, mode toolbar, presets) | shadcn primitives used the light default theme | The terminal palette is now the default theme; the research palette stays scoped to `o-theme` |
| Panels drawn over their neighbors (vitals over alerts, toolbar over resonance control) | Grid cells without `min-h-0`, panels without their own scrolling | Every cell is bounded and scrolls internally; an end-to-end test checks for overlaps at three desktop sizes |
| All text slightly blurred | The whole grid carried a 0.4–1.1 px blur every frame | The grid keeps its breathing scale and lift; the blur is gone |
| SITREP vanished at phase 2 | The temporal archive replaced the feed in the same slot | The slot has tabs, and the feed counts what arrived while hidden |
| Temporal archive stuck at "Timeline 0, Moment 0.000" | Its coordinates were never updated | They follow committed decisions and the phase window |
| Tactile pad ignored touch screens | Mouse events only | Pointer events, plus Enter/Space from the keyboard |
| Squad links flickered at random every frame | `Math.random()` in a 60 fps loop | Drawn from the squad's map positions when data change |
| No way in without being told the phrase | The phrase appeared nowhere | `HELP` prints it (configurable) |
| Small text below WCAG contrast; scrolling panels unreachable by keyboard | 40–55 % opacity text; no focusable scroll regions | Text at 75 % or more; scroll regions focusable; axe reports no violations on the terminal, the room, its dialogs and the console |

**Engineering.** The room now runs on the research tools' deterministic engine (Building 47, seeded,
hash-chained, replayable), and the random generators it used (`data/realisticData.ts`,
`data/decisionScenarios.ts`, `hooks/useMissionScenario.ts`, `usePhaseProgression`, `useRedTeamSimulation`,
`useInteractionState`, `useMetricsHistory`, `lib/missionSession`, `lib/sessionRecord`,
`lib/sessionGuidance`, `SessionControls`) are removed. New: power-on self-tests, Admiralty-graded evidence
and SITREP, ICD 203 assessments with separate confidence, date-time groups and precedence, the operator
console, an EMCON monitor, the chain seal in the timeline and status line, an after-action review that
compares each course's assumption with ground truth, and `?seed=` worlds. Details in
`docs/ARCHITECTURE.md` §8.

**Delivery.** Production served every deep link (`/research`, `/replay`, …) as a 404, sent no security
headers, and preloaded three.js (about 740 kB) on every visit because React had been bundled into the 3D
chunk. `vercel.json` now serves the single-page app, sends one strict Content-Security-Policy (shared with
the page through `config/securityPolicy.ts`) and hardening headers, and the 3D code loads only when the
NeuroSim view opens. The unused React Query provider and duplicate toast system were removed. Initial
JavaScript: 1.20 MB before (with three.js preloaded), 0.60 MB now.

CPU time per second of use, in milliseconds, measured as in §12 (headless Chromium with software
rendering, 1440×900, median of three 10-second windows), against the September terminal build:

| Situation | Main thread, September | Main thread, now | All processes, September | All processes, now |
| --- | ---: | ---: | ---: | ---: |
| Command room, situation map | 130 | 68 | 1,283 | 692 |
| Command room, decisions | 135 | 71 | 1,270 | 694 |
| Command room, microphone on | 150 | 75 | 1,324 | 756 |

Most of the remaining all-process time is software compositing of the two full-screen effects the
original look depends on, the breathing grid and the ambient overlay (without both: about 140 ms). The
breathing loop now updates 30 times a second, and the per-panel backdrop blur, which blurred only the
solid background behind the panels, is gone; with GPU compositing these effects are cheap. Reduced
motion turns both off.
