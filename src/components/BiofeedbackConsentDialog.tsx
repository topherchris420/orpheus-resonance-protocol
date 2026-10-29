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
      <DialogContent className="max-h-[85vh] overflow-y-auto border-cyan-400/40 bg-black font-mono text-cyan-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-cyan-300" />
            Enable local audio response
          </DialogTitle>
          <DialogDescription className="text-cyan-100/85">
            The browser will ask for microphone access. Generated tones start at low volume, and you can stop audio from the mode toolbar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm text-cyan-100/85">
          <div className="flex gap-3 border border-cyan-400/25 bg-cyan-400/[0.04] p-3">
            <Mic className="mt-0.5 h-4 w-4 text-cyan-300" />
            <span>Only audio energy is analyzed in the browser. This does not measure pulse, respiration, HRV, stress, or cognitive state. The other dashboard values are generated.</span>
          </div>
          <div className="flex gap-3 border border-cyan-400/25 bg-cyan-400/[0.04] p-3">
            <Volume2 className="mt-0.5 h-4 w-4 text-cyan-300" />
            <span>Use headphones at a comfortable level if you enable tones. Audio stops when you leave this page; the choice is requested again next visit.</span>
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
