import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CONDITION_LABEL } from '@/assistant/schema';
import { assignParticipant } from '@/experiment/counterbalance';
import { PROTOCOL } from '@/experiment/protocol';
import { defaultStudyConfig, type StudyConfig, type StudySession } from '@/experiment/study';

/** Short demonstration sessions use the first conditions of the block mix; they are not protocol sessions. */
export const DEMO_TRIALS_PER_BLOCK = 4;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Random participant code. It carries no information about the person. */
const newParticipantCode = () => {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `P-${Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')}`;
};

const randomSeed = () => {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  return `study-${bytes[0].toString(36)}${bytes[1].toString(36)}`;
};

export type FeedbackFactor = 'off' | 'balanced' | 'on';

/** Balanced assignment of the between-subjects factor: alternates every complete Latin square. */
const ambientFor = (factor: FeedbackFactor, participantIndex: number) =>
  factor === 'on' ? true : factor === 'off' ? false : Math.floor(participantIndex / 4) % 2 === 1;

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const SessionSetup = ({
  initialNumber,
  initialFactor,
  resumable,
  onStart,
  onResume,
  onDiscard,
}: {
  initialNumber: number;
  initialFactor: FeedbackFactor;
  resumable: StudySession | null;
  onStart: (config: StudyConfig) => void;
  onResume: () => void;
  onDiscard: () => void;
}) => {
  const [number, setNumber] = useState(Math.max(1, initialNumber));
  const [code, setCode] = useState(newParticipantCode);
  const [factor, setFactor] = useState<FeedbackFactor>(initialFactor);
  const [length, setLength] = useState<'protocol' | 'demo'>('protocol');
  const index = number - 1;
  const assignment = useMemo(() => assignParticipant(index), [index]);
  const ambient = ambientFor(factor, index);
  const trialsPerBlock = length === 'protocol' ? PROTOCOL.trialsPerBlock : DEMO_TRIALS_PER_BLOCK;
  const scored = trialsPerBlock * PROTOCOL.conditions.length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div>
        <p className="o-eyebrow">Study runner · researcher setup</p>
        <h1 className="mt-2 text-2xl font-semibold text-o-text">Prepare a participant session</h1>
        <p className="mt-2 text-sm text-o-text2">
          Protocol {PROTOCOL.id}@{PROTOCOL.version}. Run each participant in a fresh browser tab. Nothing leaves this browser: at the end you download the participant&apos;s
          package and combine packages in the Research workbench. Use this runner with people only under your institution&apos;s ethics approval.
        </p>
      </div>

      {resumable && (
        <section className="o-panel-raised space-y-3 p-5" aria-labelledby="resume-heading">
          <h2 id="resume-heading" className="text-base font-semibold text-o-text">
            An unfinished session is stored in this tab
          </h2>
          <p className="text-sm text-o-text2">
            Participant <span className="font-mono">{resumable.state.config.participantCode}</span>, {resumable.state.responses.length} responses recorded. It was rebuilt from
            its command log.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="o-button-primary" onClick={onResume}>
              Resume this session
            </button>
            <button type="button" className="o-button" onClick={onDiscard}>
              Discard it
            </button>
          </div>
        </section>
      )}

      <form
        className="o-panel space-y-5 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          onStart(
            defaultStudyConfig({
              participantCode: code,
              participantIndex: index,
              seed: randomSeed(),
              ambientFeedback: ambient,
              trialsPerBlock,
            }),
          );
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-o-text2">
            Participant number
            <input
              type="number"
              min={1}
              max={999}
              required
              className="o-input mt-1 block w-full"
              value={number}
              onChange={(event) => setNumber(Math.max(1, Math.min(999, Math.round(Number(event.target.value)) || 1)))}
            />
            <span className="mt-1 block text-xs text-o-text3">Determines the Latin-square row. Number participants consecutively from 1.</span>
          </label>
          <div className="text-sm text-o-text2">
            Participant code
            <div className="mt-1 flex items-center gap-2">
              <output className="o-input flex min-h-10 flex-1 items-center font-mono text-o-text" aria-live="polite">
                {code}
              </output>
              <button type="button" className="o-button" onClick={() => setCode(newParticipantCode())} aria-label="Generate a new participant code">
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <span className="mt-1 block text-xs text-o-text3">Random; never enter a name. Keep any link between codes and people outside Orpheus.</span>
          </div>
        </div>

        <div className="rounded-lg border border-o-line p-3 text-sm">
          <p className="font-semibold text-o-text">Assignment for participant {number} (row {assignment.row})</p>
          <ol className="mt-1 grid gap-1 text-o-text2 sm:grid-cols-2">
            {assignment.conditions.map((condition, block) => (
              <li key={block} className="font-mono text-xs">
                Block {block + 1}: {condition} · {CONDITION_LABEL[condition]} · set {assignment.structureSets[block] + 1} · form {assignment.forms[block] + 1}
              </li>
            ))}
          </ol>
        </div>

        <fieldset className="text-sm text-o-text2">
          <legend className="font-semibold text-o-text">Ambient sensory feedback (between-subjects factor)</legend>
          <div className="mt-2 space-y-1.5">
            {(
              [
                ['off', 'Not used in this study (off)'],
                ['balanced', 'Balanced by participant number (off for 1–4, on for 5–8, …)'],
                ['on', 'On for this participant'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input type="radio" name="feedback" checked={factor === value} onChange={() => setFactor(value)} />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-o-text3">
            This participant: <strong className="text-o-text">{ambient ? 'on' : 'off'}</strong>. A slow visual pacing ring, identical for everyone in the group. No microphone and
            no sound. No benefit is assumed; the factor exists to test whether one exists.
          </p>
          {ambient && prefersReducedMotion() && (
            <p role="alert" className="mt-2 text-xs text-o-amber">
              This browser asks for reduced motion, so the ring will not move. Assign this participant with the factor off, or record the deviation.
            </p>
          )}
        </fieldset>

        <fieldset className="text-sm text-o-text2">
          <legend className="font-semibold text-o-text">Session length</legend>
          <div className="mt-2 space-y-1.5">
            <label className="flex items-center gap-2">
              <input type="radio" name="length" checked={length === 'protocol'} onChange={() => setLength('protocol')} />
              Full protocol: 2 practice + {PROTOCOL.trialsPerBlock * 4} scored trials and 4 questionnaires (about 30–40 minutes)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="length" checked={length === 'demo'} onChange={() => setLength('demo')} />
              Demonstration: {DEMO_TRIALS_PER_BLOCK} trials per block (about 10 minutes; not combinable with protocol data)
            </label>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="o-button-primary">
            Hand over to the participant
          </button>
          <span className="text-xs text-o-text3">{scored} scored trials. The next screen is written for the participant.</span>
        </div>
      </form>
    </div>
  );
};
