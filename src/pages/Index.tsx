import React, { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PegasusSimulation } from '../components/PegasusSimulation';
import { AccessTerminal } from '../components/AccessTerminal';
import { appConfig } from '@/config/appConfig';
import { newSessionSeed, normalizeSeed } from '@/integrity/seal';
import { runSelfTests, type SelfTestResult } from '@/integrity/selftest';
import { BUILDING_47 } from '@/scenarios/building47';
import { MissionStore } from '@/state/missionStore';

interface Session {
  key: number;
  seed: string;
  /** Wall-clock time of tick 0, for date-time groups. Display only; the engine never reads it. */
  epochMs: number;
}

/**
 * The access terminal, then the command room. Each session is a fresh seeded world with the
 * uncertainty-aware analyst; `?seed=` reproduces a specific world exactly.
 */
const Index = () => {
  const [params] = useSearchParams();
  const requestedSeed = normalizeSeed(params.get('seed'));
  const [isAccessed, setIsAccessed] = useState(!appConfig.features.requireAccessGate);
  const [selfTests, setSelfTests] = useState<SelfTestResult[]>(() => (appConfig.features.requireAccessGate ? [] : runSelfTests()));
  const [session, setSession] = useState<Session>(() => ({ key: 0, seed: requestedSeed ?? newSessionSeed(), epochMs: Date.now() }));
  const store = useMemo(() => new MissionStore(BUILDING_47, session.seed, 'D'), [session]);

  const handleAccess = useCallback((results: SelfTestResult[]) => {
    setSelfTests(results);
    setSession((previous) => ({ ...previous, epochMs: Date.now() }));
    setIsAccessed(true);
  }, []);

  const handleNewSession = useCallback((seed?: string) => {
    setSession((previous) => ({ key: previous.key + 1, seed: seed ?? newSessionSeed(), epochMs: Date.now() }));
  }, []);

  return (
    <div className="min-h-screen overflow-hidden bg-black font-mono text-green-400">
      {!isAccessed ? (
        <AccessTerminal onAccess={handleAccess} />
      ) : (
        <PegasusSimulation key={session.key} store={store} epochMs={session.epochMs} selfTests={selfTests} onNewSession={handleNewSession} />
      )}
    </div>
  );
};

export default Index;
