import { ArrowRight, Bot, FlaskConical, GitBranch, Microscope, Scale, ShieldQuestion } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AccessTerminal } from '@/components/AccessTerminal';
import { AppShell } from '@/components/common/AppShell';
import { appConfig } from '@/config/appConfig';

const Landing = () => {
  const navigate = useNavigate();
  return (
    <AppShell>
      <div className="orpheus-welcome">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
          <p className="o-eyebrow text-o-teal">Vers3Dynamics · human–AI decision research</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.1] tracking-tight text-o-text sm:text-6xl">
            Can an AI help you decide better by knowing when <span className="text-o-teal">not</span> to answer?
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-o-text2">
            Orpheus is a research simulator for decisions under uncertainty. You read a fictional situation, inspect evidence that may be conflicting, stale or damaged, and
            decide — with an assistant that concludes, explains, or declines when the evidence cannot support a conclusion.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/explore/orientation" className="o-button-primary min-h-12 px-5 text-base">
              Start the 5-minute guided scenario <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </Link>
            <Link to="/explore/building-47" className="o-button min-h-12 px-5 text-base">
              Explore the full mission
            </Link>
            <Link to="/research" className="o-button-quiet min-h-12 px-5 text-base">
              Open the research workbench
            </Link>
          </div>
          <p className="mt-4 text-sm text-o-text3">No account. No AI service. Microphone off. Nothing leaves your browser.</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-14 sm:px-6">
        <section aria-labelledby="loop-heading">
          <h2 id="loop-heading" className="text-2xl font-semibold text-o-text">
            One loop, three layers
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { icon: Microscope, title: '1 · Situation', text: 'A generated world on a seeded clock: a map, moving contacts, a stream of fictional reports.' },
              {
                icon: ShieldQuestion,
                title: '2 · Evidence',
                text: 'Every item is labeled observed, reported, derived, assumed or missing, with its source grade, age and data-quality problems.',
              },
              { icon: GitBranch, title: '3 · Decision', text: 'Each course says what it relies on. Commit one, see what was true, and compare how other assistants would have advised.' },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="o-panel p-5">
                <Icon aria-hidden="true" className="h-5 w-5 text-o-teal" />
                <h3 className="mt-3 font-semibold text-o-text">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-o-text2">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="assistant-heading" className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 id="assistant-heading" className="text-2xl font-semibold text-o-text">
              Four ways an assistant can help
            </h2>
            <p className="mt-3 text-o-text2">
              The same scenarios run under four assistance conditions, so the effect of explanation and abstention can be measured rather than assumed.
            </p>
            <dl className="mt-5 space-y-3 text-sm">
              {[
                ['A · Human only', 'No assistant.'],
                ['B · Conventional AI', 'A suggestion, without explanation.'],
                ['C · Explainable AI', 'A suggestion with the evidence behind it.'],
                ['D · Uncertainty-aware AI', 'Evidence, alternatives, what is unknown, a probability only when it has been validated — and a refusal to conclude when the evidence is insufficient.'],
              ].map(([term, detail]) => (
                <div key={term}>
                  <dt className="flex items-center gap-3 font-semibold text-o-text">
                    <Bot aria-hidden="true" className="h-4 w-4 shrink-0 text-o-amber" />
                    {term}
                  </dt>
                  <dd className="pl-7 text-o-text2">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
          <figure className="o-panel-raised p-5">
            <p className="o-eyebrow text-o-amber">Assistant · uncertainty-aware</p>
            <p className="mt-3 text-base font-medium text-o-text">Two reports disagree, and neither has independent confirmation. Orpheus cannot establish which is accurate.</p>
            <p className="mt-3 text-sm text-o-text2">Recommended next step: seek an independent observation before relying on either report.</p>
            <figcaption className="mt-4 text-xs text-o-text3">An actual abstention from the guided scenario. Assistant statements are labeled as AI output and are never treated as evidence.</figcaption>
          </figure>
        </section>

        <section aria-labelledby="honesty-heading" className="grid gap-4 md:grid-cols-3">
          <h2 id="honesty-heading" className="sr-only">
            What is real here
          </h2>
          <div className="o-panel p-5">
            <Scale aria-hidden="true" className="h-5 w-5 text-o-teal" />
            <h3 className="mt-3 font-semibold text-o-text">Simulated, and labeled so</h3>
            <p className="mt-2 text-sm text-o-text2">Situations, reports, pulse, HRV, respiration, stress and cohesion are generated. None of them measures you.</p>
          </div>
          <div className="o-panel p-5">
            <FlaskConical aria-hidden="true" className="h-5 w-5 text-o-teal" />
            <h3 className="mt-3 font-semibold text-o-text">Reproducible</h3>
            <p className="mt-2 text-sm text-o-text2">Every session is seeded and recorded as a hash-chained log. Replays are verified against state hashes.</p>
          </div>
          <div className="o-panel p-5">
            <ShieldQuestion aria-hidden="true" className="h-5 w-5 text-o-teal" />
            <h3 className="mt-3 font-semibold text-o-text">No claims without data</h3>
            <p className="mt-2 text-sm text-o-text2">
              No human-subject data has been collected yet. Results shown in the workbench come from simulated agents and are labeled as such.{' '}
              <Link className="o-link" to="/method">
                Read the method
              </Link>
              .
            </p>
          </div>
        </section>

        {appConfig.features.requireAccessGate && <AccessTerminal onAccess={() => navigate('/explore/building-47')} />}
      </div>
    </AppShell>
  );
};

export default Landing;
