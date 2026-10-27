import React from 'react';
import { Mic, ShieldCheck, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CONSENT_STATEMENT } from '@/sensing/microphone';

interface BiofeedbackConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** Explicit, per-session consent for local microphone energy analysis and generated tones. */
export const BiofeedbackConsentDialog: React.FC<BiofeedbackConsentDialogProps> = ({ open, onOpenChange, onConfirm }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85vh] overflow-y-auto border-o-line-strong bg-o-s1 text-o-text">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Mic aria-hidden="true" className="h-5 w-5 text-o-teal" />
          Enable local audio response?
        </DialogTitle>
        <DialogDescription className="text-o-text2">
          Optional. The browser will then ask for microphone access. You can stop at any time with “Stop microphone and tones”; leaving the page stops it too.
        </DialogDescription>
      </DialogHeader>
      <ul className="grid gap-3 text-sm text-o-text2">
        <li className="flex gap-3 rounded-lg border border-o-line bg-o-s2 p-3">
          <Mic aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-o-teal" />
          <span>
            <strong className="text-o-text">Measured:</strong> low-frequency audio energy, analyzed in this tab. It does not measure breathing, pulse, HRV, stress or any physiological
            state. Every vital sign on screen remains simulated.
          </span>
        </li>
        <li className="flex gap-3 rounded-lg border border-o-line bg-o-s2 p-3">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-o-teal" />
          <span>Nothing is recorded, stored or sent. Session records note only that the microphone was switched on or off.</span>
        </li>
        <li className="flex gap-3 rounded-lg border border-o-line bg-o-s2 p-3">
          <Volume2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-o-teal" />
          <span>Generated tones start silent and are capped at a low level. Set a comfortable device volume first. No benefit of the tones is claimed.</span>
        </li>
      </ul>
      <p className="text-xs text-o-text3">By enabling: “{CONSENT_STATEMENT}”</p>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Not now
        </Button>
        <Button type="button" onClick={onConfirm}>
          Enable for this session
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
