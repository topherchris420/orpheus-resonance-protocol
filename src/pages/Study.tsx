import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { AssistanceCondition } from '@/assistant/schema';
import { AppShell } from '@/components/common/AppShell';
import { AmbientPacer } from '@/components/study/AmbientPacer';
import { BlockQuestionnaire } from '@/components/study/BlockQuestionnaire';
import { Completion } from '@/components/study/Completion';
import { Information } from '@/components/study/Information';
import { SessionSetup, type FeedbackFactor } from '@/components/study/SessionSetup';
import { TrialView, type TrialPosition } from '@/components/study/TrialView';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { humanStudyPackage } from '@/experiment/reproduce';
import { createStudySession, currentTrial, dispatchStudy, studyProgress, type StudyCommand, type StudyConfig, type StudySession } from '@/experiment/study';
import { formById } from '@/scenarios/taskFamily';
import { holdPackage } from '@/state/packageStore';
import { clearStudyProgress, loadStudyProgress, saveStudyProgress } from '@/state/studyProgress';

type Phase = { kind: 'setup' } | { kind: 'information'; config: StudyConfig } | { kind: 'declined' } | { kind: 'session' };

const BLOCK_INTRO: Record<AssistanceCondition, string> = {
  A: 'In this block you work without an assistant.',
  B: 'In this block, after you answer, an assistant shows the answer it suggests. You can then keep or change yours.',
  C: 'In this block, after you answer, an assistant shows the answer it suggests and the evidence behind it. You can then keep or change yours.',
  D: 'In this block, after you answer, an assistant shows what it thinks the evidence establishes. It may say that the evidence is insufficient. You can then keep or change your answer.',
};

const BlockIntro = ({ block, condition, title, trials, onContinue }: { block: number; condition: AssistanceCondition; title: string; trials: number; onContinue: () => void }) => {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-12 sm:px-6">
      <p className="o-eyebrow">{block < 0 ? 'Practice' : `Block ${block + 1} of 4`}</p>
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold text-o-text outline-none">
        {block < 0 ? 'Two practice trials' : title}
      </h1>
      <p className="text-o-text2">
        {block < 0
          ? 'These trials are not scored. They show how reports, data-quality notes and answers work. There is no assistant in the practice.'
          : `${BLOCK_INTRO[condition]} ${trials} trials.`}
      </p>
      <p className="text-sm text-o-text3">
        Open &ldquo;Inspect provenance&rdquo; on any report to see its details. Concluding wrongly costs four times what a correct conclusion earns.
      </p>
      <button type="button" className="o-button-primary" onClick={onContinue}>
        {block < 0 ? 'Start the practice' : 'Start the block'}
      </button>
    </div>
  );
};

const StudyPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [stored] = useState(loadStudyProgress);
  const [resumable, setResumable] = useState<StudySession | null>(stored);
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' });
  const [session, setSession] = useState<StudySession | null>(null);
  const [acknowledgedBlock, setAcknowledgedBlock] = useState<number | null>(null);
  const [nextNumber, setNextNumber] = useState(() => Math.max(1, Number(params.get('participant')) || 1));
  const [downloaded, setDownloaded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const generatedAt = useRef<string | null>(null);
  const initialFactor = (['off', 'balanced', 'on'] as const).find((value) => value === params.get('feedback')) ?? ('off' as FeedbackFactor);

  const state = session?.state;
  const ended = state?.stage === 'complete' || state?.stage === 'withdrawn';
  const pkg = useMemo(() => {
    if (!session || !ended) return null;
    generatedAt.current ??= new Date().toISOString();
    return humanStudyPackage([session], { generatedAt: generatedAt.current });
  }, [ended, session]);

  // Warn before leaving while a session runs, and until its package has been downloaded.
  const guard = phase.kind === 'session' && !!session && (!ended || !downloaded);
  useEffect(() => {
    if (!guard) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [guard]);

  const act = (command: StudyCommand) => {
    if (!session) return;
    const result = dispatchStudy(session, command);
    if (!result.accepted) {
      setNotice(result.reason ?? 'That response could not be recorded.');
      return;
    }
    setNotice(null);
    setSession(result.session);
    saveStudyProgress(result.session);
  };

  const begin = (config: StudyConfig) => {
    const created = createStudySession(config);
    clearStudyProgress();
    setResumable(null);
    setSession(created);
    saveStudyProgress(created);
    setAcknowledgedBlock(null);
    setDownloaded(false);
    generatedAt.current = null;
    setPhase({ kind: 'session' });
  };

  const resetForNext = (number: number) => {
    clearStudyProgress();
    setSession(null);
    setResumable(null);
    setNextNumber(number);
    setPhase({ kind: 'setup' });
  };

  let content: JSX.Element;
  if (phase.kind === 'setup') {
    content = (
      <SessionSetup
        key={nextNumber}
        initialNumber={nextNumber}
        initialFactor={initialFactor}
        resumable={resumable}
        onStart={(config) => setPhase({ kind: 'information', config })}
        onResume={() => {
          if (!resumable) return;
          setSession(resumable);
          setAcknowledgedBlock(null);
          setPhase({ kind: 'session' });
        }}
        onDiscard={() => {
          clearStudyProgress();
          setResumable(null);
        }}
      />
    );
  } else if (phase.kind === 'information') {
    content = (
      <Information
        scoredTrials={phase.config.trialsPerBlock * 4}
        onAgree={() => begin(phase.config)}
        onDecline={() => setPhase({ kind: 'declined' })}
      />
    );
  } else if (phase.kind === 'declined') {
    content = (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold text-o-text">Thank you</h1>
        <p className="text-o-text2">Nothing was recorded.</p>
        <button type="button" className="o-button" onClick={() => setPhase({ kind: 'setup' })}>
          Back to setup (researcher)
        </button>
      </div>
    );
  } else if (!session || !state) {
    content = <p className="p-6 text-o-text2">No session.</p>;
  } else if (ended && pkg) {
    content = (
      <Completion
        session={session}
        pkg={pkg}
        onDownloaded={() => setDownloaded(true)}
        onOpenWorkbench={() => {
          holdPackage(pkg);
          navigate('/research?tab=results');
        }}
        onNextParticipant={() => resetForNext(state.config.participantIndex + 2)}
      />
    );
  } else if (state.stage === 'questionnaire') {
    const block = state.plan[state.cursor - 1]?.block ?? 0;
    content = (
      <BlockQuestionnaire
        key={block}
        blockNumber={block + 1}
        blockCount={4}
        onSubmit={(answers) => act({ type: 'questionnaire', block, ...answers })}
      />
    );
  } else {
    const trial = currentTrial(state)!;
    const inBlock = state.plan.filter((candidate) => candidate.block === trial.block);
    const first = state.plan.findIndex((candidate) => candidate.block === trial.block);
    const position: TrialPosition = {
      label: trial.block < 0 ? 'Practice' : `Block ${trial.block + 1} of 4`,
      index: state.cursor - first + 1,
      total: inBlock.length,
    };
    content =
      acknowledgedBlock !== trial.block ? (
        <BlockIntro
          block={trial.block}
          condition={trial.condition}
          title={formById(trial.spec.formId).title}
          trials={inBlock.length}
          onContinue={() => setAcknowledgedBlock(trial.block)}
        />
      ) : (
        <TrialView
          key={`${trial.spec.id}-${state.stage}`}
          trial={trial}
          stage={state.stage === 'initial' ? 'initial' : 'final'}
          pendingInitial={state.pendingInitial}
          showQualityFlags={state.config.showQualityFlags}
          position={position}
          onInspect={(evidenceId) => act({ type: 'inspectEvidence', trialId: trial.spec.id, evidenceId })}
          onSubmit={(response) => act({ type: state.stage === 'initial' ? 'initialResponse' : 'finalResponse', trialId: trial.spec.id, ...response })}
        />
      );
  }

  const running = phase.kind === 'session' && !!state && !ended;
  const progress = state ? studyProgress(state) : null;

  return (
    <AppShell minimal mode="Study" wide>
      {running && progress && (
        <div className="sticky top-0 z-20 border-b border-o-line bg-o-bg/95">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-2 text-sm sm:px-6">
            <span className="text-o-text3">
              {progress.completed} of {progress.planned} scored trials answered
            </span>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-o-line" aria-hidden="true">
              <div className="h-full bg-o-teal" style={{ width: `${(100 * progress.completed) / Math.max(1, progress.planned)}%` }} />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button type="button" className="o-button ml-auto min-h-10">
                  Stop session
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Stop the session?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your answers so far are kept and marked as withdrawn. You can ask the researcher to delete them. You cannot continue the session afterwards.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Continue the session</AlertDialogCancel>
                  <AlertDialogAction onClick={() => act({ type: 'withdraw' })}>Stop</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
      {notice && (
        <p role="alert" className="mx-auto max-w-[1400px] px-4 pt-3 text-sm text-o-amber sm:px-6">
          {notice}
        </p>
      )}
      {running && state?.config.ambientFeedback && <AmbientPacer />}
      <div className="relative z-10">{content}</div>
    </AppShell>
  );
};

export default StudyPage;
