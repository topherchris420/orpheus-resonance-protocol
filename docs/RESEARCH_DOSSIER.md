# Orpheus research dossier

**Advise, explain, or abstain: can an AI system improve human decisions under uncertainty by knowing when
to advise, when to explain, and when to refuse to make a recommendation?**

| | |
| --- | --- |
| Software | Orpheus 2.0.0 · engine 2.0.0 · task family 1.0.0 |
| Protocol | `orpheus-hat@1.0.0`, SHA-256 `c9ba6e81e02d458b79e7284f0db60455cc1e8e2af1a3db5f6e427bcfc1fffabc` |
| Status | Instrument built and tested. Simulation experiments run. **No human-subject data collected.** |
| Affiliation | Vers3Dynamics. Orpheus is not affiliated with, endorsed by, or funded by DARPA or any government agency. The Heilmeier Catechism is used here only as a discipline for stating the problem. |

All scenarios are fictional. Nothing in this dossier is evidence about real operations, real sensors or
real people. Results from scripted agents describe those scripts inside this simulation.

---

## Summary

Decision-support systems usually answer every question. When the evidence is conflicting, stale, relayed
or corrupted, an answer delivered with the usual fluency invites reliance that the evidence does not
justify. Orpheus is a reproducible research instrument for testing a specific alternative: an assistant
that **concludes only when admissible evidence reaches a payoff-derived threshold, explains what it set
aside and why, shows a probability only when its method has been evaluated, and otherwise says plainly
that the evidence is insufficient**.

What exists today:

- a deterministic, replayable simulation and a research task family with eleven controlled information
  conditions and declared ground truth;
- an evidence engine whose probabilities are calibrated on its declared domain (expected calibration
  error 0.0056 over 20,000 sampled decisions, versus 0.0923 for a face-value baseline);
- an assistant layer in which a deterministic verifier checks every proposal, and assistant output can
  never become evidence;
- a preregistered within-subjects protocol (conditions A–D, Williams square, sequential advice), a
  participant runner, scoring, statistics and verifiable research packages;
- results from seven scripted baseline policies, which show the pipeline works end to end and bound what
  the conditions can achieve. Those results are partly true **by construction** (§15.2).

What does not exist yet: any data from people. The central question is therefore open.

---

## Part I — The Heilmeier Catechism

### 1. What problem is Orpheus investigating?

People who make decisions from reports — analysts, dispatchers, clinicians, operators — increasingly do
so with an AI assistant at their side. The assistant's errors matter less than the human's response to
them: people over-rely on confident suggestions and under-use correct ones. The problem Orpheus
investigates is whether an assistant that **recognizes when its own evidence is unreliable, and declines
to conclude**, helps people avoid mistakes without making them abandon correct conclusions.

Stated as a measurable question: on decisions with conflicting, missing, stale, corrupted or
adversarially framed information, does an uncertainty-aware, abstaining assistant (condition D) yield
higher decision utility and fewer wrong conclusions than a conventional assistant (B), an explaining
assistant (C), or no assistant (A)?

### 2. What are the limitations of current approaches?

- **Assistants that always answer.** Conventional advisory systems produce a recommendation for every
  case. Work on automation use and misuse (Parasuraman & Riley, 1997; Lee & See, 2004) shows that people
  calibrate reliance poorly when automation does not signal its own limits.
- **Explanations do not reliably reduce over-reliance.** In controlled studies, explanations increased
  acceptance of AI recommendations whether or not they were correct (Bansal et al., 2021). Showing model
  confidence helped trust calibration but not decision accuracy in some settings (Zhang, Liao &
  Bellamy, 2020).
- **Confidence is often miscalibrated.** Modern classifiers are frequently overconfident (Guo et al.,
  2017); a probability shown to a person is only useful if it means what it says.
- **Selective prediction and learning to defer are studied mostly for the model alone.** Reject options
  (Chow, 1970), selective classification (Geifman & El-Yaniv, 2017) and learning to defer (Madras,
  Pitassi & Zemel, 2018; Mozannar & Sontag, 2020) optimize when a model should abstain or hand over.
  Whether a person *uses* an abstention well — verifies rather than guesses — is a separate, behavioral
  question.
- **Reliance is often measured coarsely.** Agreement rates conflate appropriate and inappropriate
  reliance; measures that separate them (e.g. relative AI reliance and relative self-reliance; Schemmer
  et al., 2023) need a sequential design in which the person answers before seeing advice (Sniezek &
  Buckley, 1995).
- **Studies are hard to reproduce.** Many human–AI experiments use stimuli, models and analysis code that
  cannot be regenerated exactly, so effects cannot be re-derived or extended.

### 3. What is new in Orpheus?

None of the individual techniques is new. The contribution is an **integrated, reproducible testbed** in
which they can be compared under controlled conditions:

1. **Abstention grounded in declared evidence rules.** The assistant's refusal is a computed state with a
   stated reason (no admissible evidence, unresolved conflict, model misfit, insufficient confidence),
   derived from admissibility rules (integrity, staleness, independence of origins, source record,
   assumption changes) and a threshold that follows from the decision's payoffs.
2. **Probabilities gated by evaluation.** A probability is displayed only if its method has a committed
   calibration record for the running engine version, meets an error limit, and the decision lies inside
   the evaluated domain; otherwise the assistant says why no probability is shown.
3. **"The model proposes, the verifier disposes."** Every assistant proposal — deterministic or from an
   external model — passes schema and epistemic guardrails; violations are rejected or repaired; assistant
   statements are structurally excluded from the evidence.
4. **A robustness laboratory with ground truth.** Eleven information conditions, including assistant
   faults (contradictory explanations, unsupported confidence), each generated from seeds and scored
   against declared truth.
5. **Exact reproducibility of the whole experiment.** Sessions are hash-chained command logs; research
   packages carry materials, every trial, model outputs, metric definitions and replay logs; a package can
   be verified by replay and simulated batches regenerated to the identical content hash — in Node and in
   the browser.
6. **Honest provenance throughout.** Every displayed value is labeled observed, reported, derived, assumed,
   missing or AI statement; every signal is labeled measured, simulated or inferred (none is inferred).

### 4. Who could benefit?

- **Human–AI interaction and human-factors researchers**, who need an open, reproducible paradigm for
  studying reliance on abstaining assistants.
- **Designers of decision-support tools** in safety-critical domains (emergency coordination, clinical
  alerting, intelligence-analysis training), who need evidence on whether abstention and uncertainty
  displays help or merely add load. Orpheus uses fictional scenarios; transfer to any domain would need
  its own validation.
- **Educators**, who can use the guided scenario to teach evidence evaluation: relays are not
  confirmation, stale reports may be wrong, and a confident tone is not evidence.
- **AI evaluation practitioners**, who can reuse the guardrail and calibration-gating pattern.

### 5. What are the principal technical risks?

| Risk | Why it matters | Current mitigation | Residual |
| --- | --- | --- | --- |
| Advantage by construction | The task generator and condition D share the declared source model, so an assistant that implements that model is optimal on honest trials. | Adversarial conditions violate the model on purpose; results are labeled; the scientific question is about *people's* use of abstention. | High for agent results; irrelevant only for the human question. |
| Construct and ecological validity | Short fictional trials with a stylized payoff may not reflect real decisions. | Four narrative forms of identical structures; explicit payoff; comprehension checks. | High. Needs field-adjacent replication. |
| Calibration outside the evaluated domain | Real sources do not follow the declared model. | Probabilities withheld outside the domain; misfit test; record tied to engine version. | Calibration on real sources unknown. |
| Learning and carryover effects | Within-subjects designs confound condition with order. | Williams square balancing first-order carryover; materials rotate with conditions; practice block. | Higher-order carryover not balanced. |
| Sample size and power | The planned 24 participants may be too few for small effects. | Planned pilot of 8 and simulation-based power analysis using the batch engine. | Unknown until pilot data exist. |
| Demand characteristics | Participants may guess which assistant is "supposed" to help. | Neutral "Assistant" label in studies; descriptive block introductions. | Not eliminated. |
| Timing precision | Browser timing varies by device. | Latencies recorded per stage; time is a secondary measure. | Moderate. |
| Language-model assistants | The adapter has never run against a real model. | Same guardrails; deterministic fallback. | Untested; not part of any condition. |
| Cross-engine determinism | Replay must match in every browser. | Integer and basic arithmetic only; lint rules; Node ↔ Chromium hash check. | Firefox and Safari untested. |

### 6. What resources would further research require?

Estimates, not commitments:

- **People.** One researcher for study coordination and analysis; one engineer part-time for maintenance
  and the language-model condition; access to an ethics review board.
- **Participants.** A pilot of 8 and a main study of 24 (protocol plan), to be revised by power analysis;
  roughly 40 minutes each with standard compensation.
- **Infrastructure.** None beyond static hosting; Orpheus has no server component. A language-model
  condition would add model hosting or API costs and a local-recording path for replay.
- **Independent replication.** A second laboratory running the same protocol hash and materials.

### 7. What timeline is realistic?

| Stage | Duration (estimate) | Output |
| --- | --- | --- |
| Ethics review and pilot (n = 8) | 1–2 months | Feasibility, timing, comprehension; power analysis |
| Main study (n ≈ 24, revised by power analysis) | 2–3 months | Confirmatory tests of H1–H3 |
| Analysis and report | 1–2 months | Preregistered results, packages released |
| Language-model condition (record-for-replay, CSP, evaluation) | 3–4 months | Calibration and guardrail evaluation on real model outputs |
| Independent replication | 6 months or more | External validation stage of the evidence ladder |

### 8. Which measurable experiments determine success or failure?

The protocol fixes, before any participant is run:

- **Primary test (H1).** Mean per-participant utility under D exceeds B: paired difference, percentile
  bootstrap over participants (10,000 seeded resamples), Holm–Bonferroni across H1–H3 at α = 0.05. The
  criterion is met only if the adjusted p < 0.05 **and** the 95% interval excludes zero in the predicted
  direction.
- **H2.** Wrong conclusions are less frequent under D than under B.
- **H3.** On degraded information (conflict, missing, stale, corrupted), utility under D exceeds C.

**Success** for the central claim requires H1 and H2. **Failure** is any of: H1 not met; H1 met only
because participants verify everything (coverage collapse, visible in the conclusion rate); or D's
advantage disappearing on degraded trials (H3), which would mean abstention adds nothing that explanation
does not. Two mechanism checks decide *why*: abstention acceptance (do people verify when D declines?) and
over-reliance on D's wrong conclusions (does a calibrated assistant still mislead?). Secondary hypotheses
(H4–H6) and the exploratory sensory-feedback factor (H7) are reported with unadjusted intervals and cannot
rescue a failed primary test.

---

## Part II — Research specification

### 9. Technical architecture

See [`ARCHITECTURE.md`](ARCHITECTURE.md). In brief: a deterministic core (seeded RNG, canonical JSON,
SHA-256, hash-chained logs) under an evidence engine, an assistant layer with guardrails, versioned
scenario manifests, an event-sourced mission engine and an experiment framework; a browser shell renders
it, runs heavy jobs in a Web Worker and never owns truth.

### 10. Hypotheses (preregistered in `src/experiment/protocol.ts`)

| Id | Statement | Metric | Comparison | Family |
| --- | --- | --- | --- | --- |
| H1 | Decision utility is higher with the uncertainty-aware assistant than with the conventional assistant. | utility | D > B | confirmatory |
| H2 | Wrong conclusions are less frequent with D than with B. | wrong-conclusion rate | D < B | confirmatory |
| H3 | On conflicting, missing, stale or corrupted information, utility is higher with D than with the explainable assistant. | utility (degraded subset) | D > C | confirmatory |
| H4 | Decision utility is higher with D than without an assistant. | utility | D > A | secondary |
| H5 | Explanations change over-reliance on wrong suggestions; no direction predicted. | over-reliance | C ≠ B | secondary |
| H6 | Participants' confidence is better calibrated with D than with A. | Brier score | D < A | secondary |
| H7 | Ambient sensory feedback changes utility, comprehension or comfort; no direction predicted. | utility, comprehension, comfort | between-subjects | exploratory |

### 11. Baseline methods

**Assistant baselines** (same evidence, same guardrails): B concludes on the face-value analysis without
explanation; C adds cited evidence and alternatives; D is the uncertainty-aware assistant. The face-value
method (`naive-bayes-v1`) applies Bayes' rule to every claim with its grade's accuracy, never abstains, and
has no integrity, freshness, independence or assumption checks.

**Scripted participants** (no AI service; `src/experiment/agents.ts`):

| Policy | Behavior |
| --- | --- |
| Oracle | Knows the truth; upper bound of 1 per trial. |
| Careful analyst | Applies the declared rules and Bayes' rule itself, concludes only at 0.80, ignores the assistant. |
| Face-value analyst | Weighs every claim at face value and always concludes; ignores the assistant. |
| Majority vote | Counts claims regardless of source, verifies on ties; ignores the assistant. |
| Always follows | Majority vote first, then adopts whatever the assistant says, including "verify". |
| Always verifies | Never concludes; utility exactly 0. |
| Synthetic participant | A planning model, not data: follows conclusions 70% of the time, abstentions 60%, notices flagged data problems 50%. |

### 12. Experimental protocol

- **Design.** Within subjects, four blocks (A, B, C, D). Block order follows a 4×4 Williams square; trial
  sets and narrative forms rotate with the square, so every condition meets every trial set and form.
  Two unscored practice trials (no assistant) precede the blocks.
- **Materials.** Twelve trials per block: two clean trials and one of each of the ten other information
  conditions; ground truth balanced 6/6 within blocks; materials fixed by the protocol seed.
- **Procedure.** Researcher setup (participant number → square row; random code; optional sensory
  factor) → participant information and consent → practice → blocks. On assisted trials the participant
  answers and states confidence, then sees the assistant's output and gives a final answer and confidence
  (sequential advice). After each block: NASA-TLX (raw), four comprehension items, one comfort item.
  Participants may stop at any time; partial records are marked withdrawn.
- **Payoff.** +1 correct conclusion, −4 wrong conclusion, 0 "verify first"; concluding pays only at 80%.
- **Data.** Decisions, confidence, response times, evidence opened, assistant outputs, questionnaires.
  No names, contact details, free text, audio or device identifiers.
- **Analysis.** As in §8; Wilson intervals for pooled proportions; practice never analyzed; sessions with
  fewer than half the scored trials answered are excluded and reported; no other exclusions.
- **Planned sample.** 24 (six complete squares), revised after a pilot of 8.

The runner is at `/study`; participant packages are combined, after replay verification, in Research →
Human study. Sessions recorded under other settings (demonstrations, custom designs) are never combined
with protocol sessions.

### 13. Evaluation criteria

All definitions are in `src/experiment/protocol.ts` and are embedded in every research package.

| Metric | Definition |
| --- | --- |
| Decision utility | Mean payoff per trial (+1 / −4 / 0). |
| Accuracy of conclusions | Correct conclusions ÷ conclusions. |
| Conclusion rate | Share of trials concluded rather than verified. |
| Wrong conclusions | Wrong conclusions ÷ trials. |
| False alarms / misses | Wrong alarm conclusions ÷ benign trials; wrong benign conclusions ÷ alarm trials. |
| Agreement with the declared analysis | Matches the declared-model analysis (conclude its leading interpretation at ≥ 0.80, else verify). |
| Missed critical information | Conclusions the declared analysis does not support, on trials with a data-quality problem. |
| Time to decision | Median ms from onset to final response. |
| Changes of decision | Final differs from initial, on assisted trials. |
| Over-reliance | Adopting a wrong AI conclusion. |
| Appropriate acceptance / rejection | Adopting a correct AI conclusion / not adopting a wrong one. |
| RAIR / RSR | Switching to a correct AI after a wrong initial answer / keeping a correct initial answer against a wrong AI. |
| Abstention acceptance | Answering "verify" when the assistant declined. |
| Confidence calibration | Brier score and overconfidence of stated confidence over conclusions. |
| Workload, comprehension, comfort | NASA-TLX raw mean; share of comprehension items correct; comfort 1–7. |

### 14. Reproducibility instructions

```bash
npm ci
npm run evaluate     # regenerates src/assistant/calibration.record.json
npm run baselines    # regenerates docs/results/baseline-agents.{md,summary.json}
git diff --exit-code -- src/assistant/calibration.record.json docs/results   # must be empty
npm test             # unit tests
npm run test:e2e     # end-to-end, accessibility and microphone tests (Chromium)
```

Expected identifiers: calibration ECE `0.0056` (seed `orpheus-calibration-2026`, 20,000 trials); baseline
package hashes begin `a95a4fc0c6986eef` (protocol materials, seed `workbench-1`) and `031f2e7172918600`
(resampled materials, seed `workbench-resampled-1`); the workbench default package hash is
`8a0a273a67f813445acfe584d8691467d370f053dfa639673a3408dc006df64f`. CI runs the regeneration check on
every pull request.

In the browser: Research → Calibration re-runs the evaluation and reports whether it matches the
committed record; Research → Simulate with default settings reproduces the default package hash; Research
→ Reproduce verifies any package by replay and regenerates simulated batches; Replay verifies and steps
through Explorer session records. **Exact replay establishes that the software reproduces a computation.
It is not scientific validation of the simulation or of any conclusion.**

---

## Part III — Results and limitations

### 15. Results to date

#### 15.1 Calibration of the evidence engine (simulation; `npm run evaluate`)

20,000 decisions sampled from the declared model (two interpretations, equal priors, 1–6 reports graded
A–E, ages up to 1.5× the freshness window, 12% corrupted in transit, 15% relayed):

| Method | ECE | Brier | Share concluded at ≥ 0.80 | Accuracy when concluding |
| --- | --- | --- | --- | --- |
| `aware-bayes-v1` (uncertainty-aware) | 0.0056 | 0.1115 | 63.7% | 94.4% |
| `naive-bayes-v1` (face value) | 0.0923 | 0.1667 | — | — |

Because the sampler follows the declared model, this shows the computation is implemented correctly; it
says nothing about real sources. The record is regenerated in CI and re-run in the browser by an
end-to-end test.

#### 15.2 Scripted baseline participants (simulation; `npm run baselines`)

Resampled materials, 100 simulated participants per policy, seed `workbench-resampled-1`. Mean utility per
trial with 95% bootstrap intervals:

| Policy | A · none | B · conventional | C · explainable | D · uncertainty-aware |
| --- | --- | --- | --- | --- |
| Always follows | 0.08 [0.00, 0.16] | −1.14 [−1.26, −1.02] | −1.07 [−1.17, −0.97] | 0.40 [0.34, 0.45] |
| Synthetic participant | 0.13 [0.06, 0.20] | −0.78 [−0.90, −0.66] | −0.70 [−0.81, −0.59] | 0.32 [0.26, 0.39] |
| Careful analyst | 0.37 [0.31, 0.42] | 0.33 [0.26, 0.40] | 0.36 [0.31, 0.41] | 0.40 [0.35, 0.46] |
| Face-value analyst | −0.70 [−0.80, −0.60] | −0.77 [−0.89, −0.65] | −0.72 [−0.82, −0.62] | −0.63 [−0.73, −0.52] |
| Majority vote | 0.08 [0.01, 0.16] | −0.01 [−0.10, 0.08] | 0.06 [−0.03, 0.15] | 0.15 [0.07, 0.24] |

Assistant behavior over the same 1,200 trials per condition: B and C concluded on every trial and were
wrong on 514 (B) and 497 (C); D concluded on 711, abstained on 489, was wrong on 46, and its guardrails
rejected all 200 simulated faulty proposals. A policy that follows the assistant made wrong conclusions on
0.43 of trials with B and 0.04 with D.

How to read this:

- **By construction.** Following D reproduces the careful analyst (0.40 vs 0.40), because D *is* the
  careful analysis under the model that generated the honest evidence. These numbers show that the
  pipeline computes what it should and bound what each condition can deliver; they are not a finding.
- **Not uniformly better.** By information condition (always-follow policy), D's utility was below the
  unassisted majority vote on stale reports (0.08 vs 0.38) and similar on echoed reports (0.39 vs 0.35).
  On the fixed protocol materials (8 simulated participants, so 8 trials per cell), D was below B on stale
  (−0.50 vs −0.25) and echo (−0.75 vs −0.25) trials, and across all 96 D trials its conclusions were wrong
  on 10 of 56 — a higher error share than on resampled materials (46 of 711). Small cells; reported
  because they are inconvenient: people in the study will see exactly these materials.
- **Largest differences** were where the conventional assistant is misled by design: corrupted reports
  (D 0.48 vs B −3.65), assumption shifts (0.24 vs −3.05), and faulty upstream models (contradictory
  explanation 0.80 vs −3.75).

The synthetic participant's hypothesis tests on resampled materials (H1–H4 met; H5, H6 not met; H7 not
testable in a single group; on the protocol materials only H1 and H2 met) only demonstrate that the
preregistered analysis runs end to end. Its behavior is assumed.

Full tables, including the protocol-materials run and the robustness laboratory, are in
[`results/baseline-agents.md`](results/baseline-agents.md).

#### 15.3 Software verification

At the time of writing: 163 unit tests and 40 end-to-end tests pass; ESLint and strict TypeScript pass;
axe reports no WCAG 2.2 AA rule violations on any research route, dialog or study screen tested; the workbench's
default batch (1,920 trials) produces the same package hash in Chromium as in Node; the committed results
regenerate byte-identically.

#### 15.4 Limitations

- No human data. No claim about how people decide with any condition is made.
- D's advantage over B and C for scripted policies is partly by construction (§15.2).
- Calibration is established only on data sampled from the declared model.
- Scenarios are fictional and stylized; the payoff is imposed, not elicited.
- Automated accessibility checks cover part of WCAG; no assistive-technology users have tested Orpheus.
- Replay has been exercised in Node and Chromium only.
- The language-model adapter is untested against real models and not connected to the interface.
- The microphone is the only measurement and is never interpreted physiologically; no biosensor exists.

### 16. Next-stage research questions

1. Do people accept abstentions — verify rather than guess — and does that acceptance depend on the
   stated reason (conflict, misfit, insufficient confidence)?
2. Does a calibrated probability help people beyond the abstention itself, or does it anchor them?
3. Does D reduce over-reliance on wrong conclusions without reducing appropriate acceptance (RAIR, RSR)?
4. How does reliance on D degrade when its own assumptions fail (assumption shift, model misfit) — does
   the misfit signal transfer to the person?
5. When a language model proposes and the verifier disposes, how often is the proposal repaired or
   rejected, and do people notice the fallback?
6. Does ambient sensory feedback change comprehension, comfort or performance at all (H7)?

### 17. Evidence ladder

Stages: Proposed → Implemented → Tested → Reproduced → Experimentally observed (here: simulation
experiments only) → Externally validated. The canonical, test-checked version is on the Method page
(`src/content/evidenceLadder.ts`); this copy mirrors it.

| Capability | Stage | Evidence | Not yet established |
| --- | --- | --- | --- |
| Seeded simulation with exact replay | Reproduced | Checkpoint hashes match on replay in Node and Chromium; edited records rejected; packages regenerate to identical hashes. | Firefox and Safari untested. |
| Evidence admissibility rules | Tested | Unit tests per rule and for the baseline without them. | Not compared with how analysts grade evidence. |
| Calibrated probabilities | Experimentally observed | ECE 0.0056 over 20,000 sampled trials; reproduced in the browser. | Calibration on real sources unknown. |
| Abstention reduces wrong conclusions for a policy that follows the assistant | Experimentally observed | Wrong conclusions per trial 0.04 with D vs 0.43 with B (scripted agents, resampled materials). | Agents only; partly by construction; not better on every condition. |
| Guardrails reject faulty or overconfident output | Experimentally observed | 200 of 200 simulated faulty proposals rejected in D; unit tests per rule. | Not evaluated on real model output. |
| Study runner, scoring and analysis pipeline | Tested | Unit tests; complete participant session in the browser, withdrawal, resume. | Not piloted with people. |
| Human–AI teaming effects in people (H1–H7) | Proposed | Preregistered hypotheses only. | No human data. |
| Effect of ambient sensory feedback | Proposed | Implemented as a study factor. | No data; no benefit assumed. |
| Accessibility | Tested | axe scans of all research routes and dialogs; keyboard, reduced motion, phone layouts. | Original command room not yet covered; no assistive-technology user testing. |
| Microphone consent and shutdown | Tested | Unit tests; browser tests with a synthetic microphone. | Real hardware and mobile browsers untested. |
| Optional language-model assistant | Tested | Adapter tests with simulated endpoints and fallback. | Not connected; never run with a real model. |
| Physiological sensing | Proposed | Sensor interface pattern (consent, quality, disconnect). | No biosensor; nothing measured or inferred. |
| Real-world operational validity | Proposed | None; scenarios are fictional. | Not claimed. |

### 18. References

- Bansal, G., Wu, T., Zhou, J., Fok, R., Nushi, B., Kamar, E., Ribeiro, M. T., & Weld, D. (2021). Does the
  whole exceed its parts? The effect of AI explanations on complementary team performance. *CHI 2021*.
- Chow, C. K. (1970). On optimum recognition error and reject tradeoff. *IEEE Transactions on Information
  Theory, 16*(1), 41–46.
- Geifman, Y., & El-Yaniv, R. (2017). Selective classification for deep neural networks. *NeurIPS 2017*.
- Guo, C., Pleiss, G., Sun, Y., & Weinberger, K. Q. (2017). On calibration of modern neural networks.
  *ICML 2017*.
- Hart, S. G., & Staveland, L. E. (1988). Development of NASA-TLX (Task Load Index). In *Human Mental
  Workload*. North-Holland.
- Holm, S. (1979). A simple sequentially rejective multiple test procedure. *Scandinavian Journal of
  Statistics, 6*(2), 65–70.
- Lee, J. D., & See, K. A. (2004). Trust in automation: Designing for appropriate reliance. *Human Factors,
  46*(1), 50–80.
- Madras, D., Pitassi, T., & Zemel, R. (2018). Predict responsibly: Improving fairness and accuracy by
  learning to defer. *NeurIPS 2018*.
- Mozannar, H., & Sontag, D. (2020). Consistent estimators for learning to defer to an expert. *ICML 2020*.
- Parasuraman, R., & Riley, V. (1997). Humans and automation: Use, misuse, disuse, abuse. *Human Factors,
  39*(2), 230–253.
- Schemmer, M., Kühl, N., Benz, C., Bartos, A., & Satzger, G. (2023). Appropriate reliance on AI advice:
  Conceptualization and the effect of explanations. *IUI 2023*.
- Sniezek, J. A., & Buckley, T. (1995). Cueing and cognitive conflict in judge–advisor decision making.
  *Organizational Behavior and Human Decision Processes, 62*(2), 159–174.
- Williams, E. J. (1949). Experimental designs balanced for the estimation of residual effects of
  treatments. *Australian Journal of Scientific Research, Series A, 2*(2), 149–168.
- Wilson, E. B. (1927). Probable inference, the law of succession, and statistical inference. *Journal of
  the American Statistical Association, 22*(158), 209–212.
- Zhang, Y., Liao, Q. V., & Bellamy, R. K. E. (2020). Effect of confidence and explanation on accuracy and
  trust calibration in AI-assisted decision making. *FAT\* 2020*.
