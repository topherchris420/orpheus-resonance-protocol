import React from 'react';
import { Mic, MicOff, Orbit, ShieldAlert } from 'lucide-react';
import { appConfig } from '@/config/appConfig';

interface ModeToolbarProps {
  audioEnabled: boolean;
  showNeuroSim: boolean;
  redTeamActive: boolean;
  redTeamAvailable: boolean;
  onRequestBiofeedback: () => void;
  onDisableBiofeedback: () => void;
  onToggleNeuroSim: () => void;
  onToggleRedTeam: () => void;
}

/** Optional tools. Every control states what it does in plain words; none is required. */
export const ModeToolbar: React.FC<ModeToolbarProps> = React.memo(
  ({ audioEnabled, showNeuroSim, redTeamActive, redTeamAvailable, onRequestBiofeedback, onDisableBiofeedback, onToggleNeuroSim, onToggleRedTeam }) => {
    const audioAvailable = appConfig.features.enableAudioBiofeedback;
    return (
      <div role="group" aria-label="Optional tools" className="flex flex-wrap items-center gap-2">
        <button type="button" className="o-button" aria-pressed={audioEnabled} disabled={!audioAvailable} onClick={audioEnabled ? onDisableBiofeedback : onRequestBiofeedback}>
          {audioEnabled ? <MicOff aria-hidden="true" className="h-4 w-4" /> : <Mic aria-hidden="true" className="h-4 w-4" />}
          {!audioAvailable ? 'Audio response unavailable' : audioEnabled ? 'Stop microphone and tones' : 'Start local audio response'}
        </button>
        <button type="button" className="o-button" aria-pressed={showNeuroSim} onClick={onToggleNeuroSim}>
          <Orbit aria-hidden="true" className="h-4 w-4" />
          {showNeuroSim ? 'Hide 3D visual' : 'Show 3D visual'}
        </button>
        <button type="button" className="o-button" aria-pressed={redTeamActive} disabled={!redTeamAvailable} onClick={onToggleRedTeam}>
          <ShieldAlert aria-hidden="true" className="h-4 w-4" />
          {redTeamActive ? 'Stop red-team simulation' : 'Start red-team simulation'}
        </button>
        {!redTeamAvailable && <span className="text-xs text-o-text3">Red team unlocks at phase 2.</span>}
      </div>
    );
  },
);

ModeToolbar.displayName = 'ModeToolbar';
