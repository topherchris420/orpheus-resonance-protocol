import { useState } from 'react';
import { PROTOCOL } from '@/experiment/protocol';

/** Participant information and consent. Plain language; nothing starts until the participant agrees. */
export const Information = ({ scoredTrials, onAgree, onDecline }: { scoredTrials: number; onAgree: () => void; onDecline: () => void }) => {
  const [agreed, setAgreed] = useState(false);
  const { payoff } = PROTOCOL;
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <div>
        <p className="o-eyebrow">Before you start</p>
        <h1 className="mt-2 text-2xl font-semibold text-o-text">Deciding what the evidence shows</h1>
      </div>
      <section className="space-y-3 text-sm leading-relaxed text-o-text2" aria-labelledby="task-heading">
        <h2 id="task-heading" className="text-base font-semibold text-o-text">
          What you will do
        </h2>
        <p>
          You will read short sets of fictional reports — for example, whether a road is clear or whether a position beacon is genuine — and decide what they establish. Each time
          you can conclude one of two interpretations, or say that the evidence does not establish either and should be verified first.
        </p>
        <p>
          There are 2 practice trials and {scoredTrials} scored trials in four blocks, with a short questionnaire after each block. In some blocks an assistant offers its own
          assessment after you have answered, and you may then keep or change your answer. <strong className="text-o-text">The assistant can be wrong.</strong>
        </p>
        <p>
          Points: {payoff.correct > 0 ? '+' : ''}
          {payoff.correct} for a correct conclusion, {payoff.wrong} for a wrong conclusion and {payoff.defer} for &ldquo;verify first&rdquo;. A wrong conclusion costs four times
          what a correct one earns, so it is worth concluding only when you are at least {Math.round(PROTOCOL.threshold * 100)}% sure. You will not see whether you were right until
          the end.
        </p>
      </section>
      <section className="space-y-2 text-sm leading-relaxed text-o-text2" aria-labelledby="data-heading">
        <h2 id="data-heading" className="text-base font-semibold text-o-text">
          What is recorded
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your answers, how confident you were, how long each answer took, and which reports you opened for details.</li>
          <li>Your questionnaire answers.</li>
          <li>A random participant code. No name, contact details, account, microphone, camera or free text.</li>
        </ul>
        <p>Everything stays in this browser tab until the researcher downloads it. Nothing is sent over the network.</p>
      </section>
      <section className="space-y-2 text-sm leading-relaxed text-o-text2" aria-labelledby="rights-heading">
        <h2 id="rights-heading" className="text-base font-semibold text-o-text">
          Your choices
        </h2>
        <p>
          Taking part is voluntary. You can stop at any time with the &ldquo;Stop session&rdquo; button, without giving a reason; the record is then marked as withdrawn and you can
          ask the researcher to delete it. All scenarios are fictional and involve no real people, places or operations.
        </p>
      </section>
      <div className="o-panel space-y-4 p-5">
        <label className="flex items-start gap-3 text-sm text-o-text">
          <input type="checkbox" className="mt-1" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
          I have read this information, I am 18 or older, and I agree to take part.
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="o-button-primary" disabled={!agreed} onClick={onAgree}>
            Start the practice
          </button>
          <button type="button" className="o-button" onClick={onDecline}>
            I do not want to take part
          </button>
        </div>
      </div>
    </div>
  );
};
