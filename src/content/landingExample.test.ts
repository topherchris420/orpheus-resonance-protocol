import { describe, expect, it } from 'vitest';
import { assistantFor } from '@/engine/mission/selectors';
import { createSession, dispatch } from '@/engine/mission/session';
import { ORIENTATION } from '@/scenarios/orientation';
import { LANDING_ABSTENTION } from './landingExample';

describe('landing page example', () => {
  it('quotes the assistant’s actual abstention from the guided scenario', () => {
    let session = createSession(ORIENTATION, 'orientation-1', 'D');
    for (const command of [
      { type: 'advance', ticks: 1 },
      { type: 'commitDecision', pointId: 'or-route', optionId: 'or-route-go', actor: 'participant' },
    ] as const) {
      const result = dispatch(session, command);
      if (!result.accepted) throw new Error(result.reason);
      session = result.session;
    }
    const output = assistantFor(session.state, ORIENTATION, 'or-overpass')!.output!;
    expect(output.status).toBe('abstention');
    expect(output.abstention?.explanation).toBe(LANDING_ABSTENTION.explanation);
    expect(output.recommendation?.text).toBe(LANDING_ABSTENTION.recommendation);
  });
});
