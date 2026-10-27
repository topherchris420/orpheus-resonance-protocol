import React from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { MissionAlert, MissionSeverity } from '@/lib/missionUx';

interface MissionAlertQueueProps {
  alerts: MissionAlert[];
  dismissedAlertIds: string[];
  onDismiss: (alertId: string) => void;
}

const TONE: Record<MissionSeverity, { className: string; icon: typeof Info; label: string }> = {
  nominal: { className: 'border-o-teal/40 text-o-teal-strong', icon: Info, label: 'Note' },
  watch: { className: 'border-o-amber/50 text-o-amber', icon: AlertTriangle, label: 'Watch' },
  critical: { className: 'border-o-red/60 text-o-red', icon: AlertOctagon, label: 'Attention' },
};

export const MissionAlertQueue: React.FC<MissionAlertQueueProps> = React.memo(({ alerts, dismissedAlertIds, onDismiss }) => {
  const visible = alerts.filter((alert) => !dismissedAlertIds.includes(alert.id)).slice(0, 3);
  if (visible.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-o-line bg-o-s1 px-3 py-2 text-sm text-o-text2">
        <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-o-teal" /> No active alerts.
      </div>
    );
  }
  return (
    <ul className="space-y-2" aria-label="Alerts">
      {visible.map((alert) => {
        const { className, icon: Icon, label } = TONE[alert.severity];
        return (
          <li key={alert.id} className={`flex items-start justify-between gap-2 rounded-xl border bg-o-s1 px-3 py-2 text-sm ${className.split(' ')[0]}`}>
            <div className="flex min-w-0 gap-2">
              <Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${className.split(' ')[1]}`} />
              <div className="min-w-0">
                <p className="font-semibold text-o-text">
                  <span className="sr-only">{label}: </span>
                  {alert.title}
                </p>
                <p className="text-o-text2">{alert.message}</p>
                <p className="text-xs text-o-text3">{alert.action}</p>
              </div>
            </div>
            <button type="button" className="o-button-quiet min-h-9 w-9 shrink-0 px-0" onClick={() => onDismiss(alert.id)} aria-label={`Dismiss ${alert.title}`}>
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
});

MissionAlertQueue.displayName = 'MissionAlertQueue';
