import { Download, FlaskConical, UserPlus } from 'lucide-react';
import { CONDITION_LABEL, CONDITION_SUMMARY } from '@/assistant/schema';
import { shortHash } from '@/engine/canonical';
import { trialRowsToCsv, type ResearchPackage } from '@/experiment/package';
import { PROTOCOL } from '@/experiment/protocol';
import { scoredResponses, studyProgress, type StudySession } from '@/experiment/study';
import { downloadJson, downloadText } from '@/state/missionStore';

/** End of a session: debrief for the participant, then the researcher's download and handoff. */
export const Completion = ({
  session,
  pkg,
  onDownloaded,
  onOpenWorkbench,
  onNextParticipant,
}: {
  session: StudySession;
  pkg: ResearchPackage;
  onDownloaded: () => void;
  onOpenWorkbench: () => void;
  onNextParticipant: () => void;
}) => {
  const { state } = session;
  const withdrawn = state.stage === 'withdrawn';
  const scored = scoredResponses(state);
  const points = scored.reduce((total, response) => total + response.score.utility, 0);
  const correct = scored.filter((response) => response.score.correct).length;
  const verified = scored.filter((response) => !response.score.committed).length;
  const { planned } = studyProgress(state);
  const code = state.config.participantCode;
  const demo = state.config.trialsPerBlock !== PROTOCOL.trialsPerBlock;

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10 sm:px-6">
      <section className="space-y-3" aria-labelledby="debrief-heading">
        <p className="o-eyebrow">{withdrawn ? 'Session stopped' : 'Session complete'}</p>
        <h1 id="debrief-heading" className="text-2xl font-semibold text-o-text">
          {withdrawn ? 'You stopped the session. Thank you for your time.' : 'Thank you for taking part.'}
        </h1>
        {scored.length > 0 && (
          <p className="text-sm text-o-text2">
            Over {scored.length} scored trials you earned <strong className="text-o-text">{points} points</strong>: {correct} correct conclusions, {scored.length - correct - verified}{' '}
            wrong conclusions and {verified} &ldquo;verify first&rdquo; answers.
          </p>
        )}
        <div className="space-y-2 text-sm leading-relaxed text-o-text2">
          <p>
            <strong className="text-o-text">What this study is about.</strong> It asks whether an assistant improves decisions under uncertainty by knowing when to advise, when
            to explain, and when to decline to recommend anything. You worked under four conditions:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {state.assignment.conditions.map((condition) => (
              <li key={condition}>
                <span className="font-medium text-o-text">{CONDITION_LABEL[condition]}:</span> {CONDITION_SUMMARY[condition]}
              </li>
            ))}
          </ul>
          <p>
            Some reports were deliberately flawed — relayed copies, stale or altered reports, sources whose channel had changed — and on some trials the assistant itself was
            wrong or overconfident. That was by design, to see when people rely on an assistant appropriately.
          </p>
        </div>
      </section>

      <section className="o-panel space-y-4 p-5" aria-labelledby="researcher-heading">
        <h2 id="researcher-heading" className="text-base font-semibold text-o-text">
          For the researcher
        </h2>
        <p className="text-sm text-o-text2">
          Participant <span className="font-mono">{code}</span> · {scored.length} of {planned} scored trials · {state.questionnaires.length} questionnaires · package{' '}
          <span className="font-mono">{shortHash(pkg.contentHash)}</span>
          {withdrawn ? ' · marked withdrawn' : ''}
          {demo ? ' · demonstration (not combinable with protocol data)' : ''}
        </p>
        <p role="note" className="text-sm text-o-amber">
          Download the package before closing this tab. It exists only in this browser.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="o-button-primary"
            onClick={() => {
              downloadJson(pkg, `orpheus-study-${code}.json`);
              onDownloaded();
            }}
          >
            <Download aria-hidden="true" className="h-4 w-4" /> Participant package (JSON)
          </button>
          <button type="button" className="o-button" onClick={() => downloadText(trialRowsToCsv(pkg.content.trials), `orpheus-study-${code}-trials.csv`, 'text/csv')}>
            <Download aria-hidden="true" className="h-4 w-4" /> Trial table (CSV)
          </button>
          <button type="button" className="o-button" onClick={onOpenWorkbench}>
            <FlaskConical aria-hidden="true" className="h-4 w-4" /> Open in the Research workbench
          </button>
          <button type="button" className="o-button" onClick={onNextParticipant}>
            <UserPlus aria-hidden="true" className="h-4 w-4" /> Set up the next participant
          </button>
        </div>
      </section>
    </div>
  );
};
