import React from 'react';
import { Mic, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BiofeedbackConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export const BiofeedbackConsentDialog: React.FC<BiofeedbackConsentDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-cyan-500/30 bg-slate-950 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-cyan-300" />
            Enable live biofeedback
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            The browser will ask for microphone access. Audio tones start at low volume, and you can stop the feed at any time from the mode toolbar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm text-slate-300">
          <div className="flex gap-3 border border-slate-700 bg-slate-900/70 p-3">
            <Mic className="mt-0.5 h-4 w-4 text-cyan-300" />
            <span>Microphone input is analyzed locally for demo telemetry.</span>
          </div>
          <div className="flex gap-3 border border-slate-700 bg-slate-900/70 p-3">
            <Volume2 className="mt-0.5 h-4 w-4 text-cyan-300" />
            <span>Support tone volume defaults low and remains adjustable in Operator Vitals.</span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm}>
            Enable
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
