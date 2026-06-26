import React from 'react';
import { Activity, BrainCircuit, Mic, MicOff, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}) => {
  const bioLabel = audioEnabled ? 'Stop biofeedback' : 'Start biofeedback';

  return (
    <div className="flex flex-wrap items-center gap-2 border border-current/15 bg-black/55 p-2 backdrop-blur-md">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={audioEnabled ? 'secondary' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={audioEnabled ? onDisableBiofeedback : onRequestBiofeedback}
            aria-label={bioLabel}
          >
            {audioEnabled ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            <span className="hidden sm:inline">{audioEnabled ? 'Stop Bio' : 'Start Bio'}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{bioLabel}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={showNeuroSim ? 'secondary' : 'outline'}
            size="sm"
            className="gap-2"
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
            className="gap-2"
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

      <div className="ml-auto hidden items-center gap-2 pr-1 text-[10px] uppercase text-current/50 md:flex">
        <Activity className="h-3.5 w-3.5" />
        Mode controls
      </div>
    </div>
  );
});
