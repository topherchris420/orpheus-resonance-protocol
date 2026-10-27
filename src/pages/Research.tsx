import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/common/AppShell';
import { AssumptionsView } from '@/components/research/AssumptionsView';
import { CalibrationView } from '@/components/research/CalibrationView';
import { ProtocolView } from '@/components/research/ProtocolView';
import { ReproducePanel } from '@/components/research/ReproducePanel';
import { ResultsView } from '@/components/research/ResultsView';
import { SimulatePanel } from '@/components/research/SimulatePanel';
import { StudyAnalysis } from '@/components/research/StudyAnalysis';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ResearchPackage } from '@/experiment/package';
import { heldPackage } from '@/state/packageStore';

const TABS = [
  { id: 'protocol', label: 'Protocol' },
  { id: 'simulate', label: 'Simulate' },
  { id: 'study', label: 'Human study' },
  { id: 'results', label: 'Results' },
  { id: 'calibration', label: 'Calibration' },
  { id: 'reproduce', label: 'Reproduce' },
  { id: 'assumptions', label: 'Assumptions' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const isTab = (value: string | null): value is TabId => TABS.some((tab) => tab.id === value);

const Research = () => {
  const [params, setParams] = useSearchParams();
  const tab: TabId = isTab(params.get('tab')) ? (params.get('tab') as TabId) : 'protocol';
  const [pkg, setPkg] = useState<ResearchPackage | null>(heldPackage);

  const select = (next: string) => {
    const updated = new URLSearchParams(params);
    updated.set('tab', next);
    setParams(updated, { replace: true });
  };

  const show = (next: ResearchPackage) => {
    setPkg(next);
    select('results');
  };

  return (
    <AppShell mode="Research" wide>
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-8 sm:px-6">
        <header className="max-w-4xl">
          <p className="o-eyebrow text-o-teal">Research workbench</p>
          <h1 className="mt-2 text-3xl font-semibold text-o-text">Does knowing when to abstain make an assistant more useful?</h1>
          <p className="mt-3 text-o-text2">
            Configure and run the preregistered human–AI teaming protocol with scripted baseline participants or with people, inspect every result down to the single trial,
            and reproduce any package exactly. Nothing here needs an AI service, an account or special hardware. Results from scripted participants are not evidence about
            people; <Link className="o-link" to="/method">Method</Link> lists what has and has not been established.
          </p>
        </header>

        {/* Panels stay mounted (hidden when inactive) so a running job and its results survive switching tabs. */}
        <Tabs value={tab} onValueChange={select}>
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-o-s1 p-1">
            {TABS.map((entry) => (
              <TabsTrigger
                key={entry.id}
                value={entry.id}
                className="min-h-10 px-3 text-o-text2 data-[state=active]:bg-o-s3 data-[state=active]:text-o-teal-strong"
              >
                {entry.label}
                {entry.id === 'results' && pkg ? (
                  <>
                    <span aria-hidden="true" className="ml-1.5 h-1.5 w-1.5 rounded-full bg-o-teal" />
                    <span className="sr-only"> (a package is loaded)</span>
                  </>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="protocol" forceMount className="mt-6 data-[state=inactive]:hidden">
            <ProtocolView />
          </TabsContent>
          <TabsContent value="simulate" forceMount className="mt-6 data-[state=inactive]:hidden">
            <SimulatePanel onPackage={show} />
          </TabsContent>
          <TabsContent value="study" forceMount className="mt-6 data-[state=inactive]:hidden">
            <StudyAnalysis onPackage={show} />
          </TabsContent>
          <TabsContent value="results" forceMount className="mt-6 data-[state=inactive]:hidden">
            {pkg ? (
              <ResultsView key={pkg.contentHash} pkg={pkg} simulated={pkg.content.kind === 'agent-batch'} />
            ) : (
              <div className="o-panel p-6 text-sm text-o-text2">
                <p className="font-semibold text-o-text">No results loaded.</p>
                <p className="mt-1">
                  Run the protocol on the <button type="button" className="o-link" onClick={() => select('simulate')}>Simulate</button> tab, combine participant packages on the{' '}
                  <button type="button" className="o-link" onClick={() => select('study')}>Human study</button> tab, or open a package on the{' '}
                  <button type="button" className="o-link" onClick={() => select('reproduce')}>Reproduce</button> tab.
                </p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="calibration" forceMount className="mt-6 data-[state=inactive]:hidden">
            <CalibrationView />
          </TabsContent>
          <TabsContent value="reproduce" forceMount className="mt-6 data-[state=inactive]:hidden">
            <ReproducePanel current={pkg} onOpen={show} />
          </TabsContent>
          <TabsContent value="assumptions" forceMount className="mt-6 data-[state=inactive]:hidden">
            <AssumptionsView />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

export default Research;
