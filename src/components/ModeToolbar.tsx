import React from 'react';
import { Activity, BrainCircuit, Download, Mic, MicOff, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appConfig } from '@/config/appConfig';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ModeToolbarProps {
  audioEnabled: boolean;
  showNeuroSim: boolean;
  redTeamActive: boolean;
  redTeamAvailable: boolean;
  onRequestBiofeedback: () => void;
  onDisableBiofeedback: () => void;
  onToggleNeuroSim: () => void;
  onToggleRedTeam: () => void;
  onExport: () => void;
}

export const ModeToolbar: React.FC<ModeToolbarProps> = React.memo(({
  audioEnabled,
  showNeuroSim,
  redTeamActive,
  redTeamAvailable,
  onRequestBiofeedback,
  onDisableBiofeedback,
  onToggleNeuroSim,
  onToggleRedTeam,
  onExport,
}) => {
  const bioLabel = !appConfig.features.enableAudioBiofeedback ? 'Audio response unavailable in this deployment' : audioEnabled ? 'Stop microphone and tones' : 'Start local audio response';

  return (
    <div className="flex flex-wrap items-center gap-1.5 border border-current/15 bg-black/55 p-1.5 2xl:p-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={audioEnabled ? 'secondary' : 'outline'}
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={audioEnabled ? onDisableBiofeedback : onRequestBiofeedback}
            aria-label={bioLabel}
            disabled={!appConfig.features.enableAudioBiofeedback}
          >
            {audioEnabled ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            <span className="hidden sm:inline">{audioEnabled ? 'Stop Audio' : 'Start Audio'}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{bioLabel}</TooltipContent>
      </Tooltip>

      <Button type="button" variant="outline" size="sm" onClick={onExport} aria-label="Export simulation record" className="h-7 gap-1.5 px-2.5 text-xs">
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Export</span>
      </Button>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={showNeuroSim ? 'secondary' : 'outline'}
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={onToggleNeuroSim}
            aria-label={showNeuroSim ? 'Hide NeuroSim' : 'Show NeuroSim'}
          >
            <BrainCircuit className="h-4 w-4" />
            <span className="hidden sm:inline">{showNeuroSim ? 'Hide Sim' : 'Show Sim'}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{showNeuroSim ? 'Hide NeuroSim' : 'Show NeuroSim'}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={redTeamActive ? 'destructive' : 'outline'}
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={onToggleRedTeam}
            disabled={!redTeamAvailable}
            aria-label={redTeamActive ? 'Stop Red Team' : 'Start Red Team'}
          >
            <ShieldAlert className="h-4 w-4" />
            <span className="hidden sm:inline">{redTeamActive ? 'Stop Red' : 'Start Red'}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {redTeamAvailable ? 'Toggle Red Team simulation' : 'Red Team unlocks after simulation mode starts'}
        </TooltipContent>
      </Tooltip>

      <div className="ml-auto hidden items-center gap-2 pr-1 text-[10px] uppercase text-current/75 2xl:flex">
        <Activity className="h-3.5 w-3.5" />
        Mode controls
      </div>
    </div>
  );
});
