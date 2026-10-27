import { useMemo, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import type { AssistanceCondition } from '@/assistant/schema';
import { AppShell } from '@/components/common/AppShell';
import { ExplorerWorkspace } from '@/components/explorer/ExplorerWorkspace';
import { getScenario } from '@/scenarios/registry';
import { MissionStore } from '@/state/missionStore';

const CONDITIONS: AssistanceCondition[] = ['A', 'B', 'C', 'D'];

/** A fresh seed for free exploration. The seed is recorded, so the session stays reproducible. */
const randomSeed = () => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0].toString(36);
};

const ORIENTATION_SEED = 'orientation-1';

const Explore = () => {
  const { scenarioId = 'orientation' } = useParams();
  const [params] = useSearchParams();
  const manifest = getScenario(scenarioId);
  const guided = scenarioId === 'orientation';
  const requestedCondition = params.get('condition');
  const initialCondition: AssistanceCondition = CONDITIONS.includes(requestedCondition as AssistanceCondition) ? (requestedCondition as AssistanceCondition) : 'D';
  const initialSeed = params.get('seed') ?? (guided ? ORIENTATION_SEED : randomSeed());
  const [session, setSession] = useState({ key: 0, seed: initialSeed, condition: initialCondition });
  const store = useMemo(() => (manifest ? new MissionStore(manifest, session.seed, session.condition) : null), [manifest, session]);

  if (!manifest || !store) return <Navigate to="/explore/orientation" replace />;
  return (
    <AppShell mode={guided ? 'Explorer · guided' : 'Explorer'} wide>
      <ExplorerWorkspace
        key={`${manifest.id}-${session.key}`}
        store={store}
        guided={guided}
        onNewSession={() => setSession((previous) => ({ key: previous.key + 1, seed: guided ? ORIENTATION_SEED : randomSeed(), condition: previous.condition }))}
        onPlayAgain={(condition) => setSession((previous) => ({ key: previous.key + 1, seed: previous.seed, condition }))}
      />
    </AppShell>
  );
};

export default Explore;
