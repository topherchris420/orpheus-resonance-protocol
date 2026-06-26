import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MissionAlert, MissionSeverity } from '@/lib/missionUx';

interface MissionAlertQueueProps {
  alerts: MissionAlert[];
  dismissedAlertIds: string[];
  onDismiss: (alertId: string) => void;
}

const severityTone: Record<MissionSeverity, string> = {
  nominal: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
  watch: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
  critical: 'border-red-400/50 bg-red-500/15 text-red-100',
};

const severityIcon: Record<MissionSeverity, React.ReactNode> = {
  nominal: <Info className="h-4 w-4" />,
  watch: <AlertTriangle className="h-4 w-4" />,
  critical: <AlertTriangle className="h-4 w-4" />,
};

export const MissionAlertQueue: React.FC<MissionAlertQueueProps> = React.memo(({
  alerts,
  dismissedAlertIds,
  onDismiss,
}) => {
  const visibleAlerts = alerts.filter((alert) => !dismissedAlertIds.includes(alert.id)).slice(0, 3);

  if (visibleAlerts.length === 0) {
    return (
      <div className="border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
        <div className="flex items-center gap-2 font-semibold uppercase">
          <CheckCircle2 className="h-4 w-4" />
          No active alerts
        </div>
        <div className="mt-1 text-emerald-100/70">Continue monitoring telemetry and mission feed.</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visibleAlerts.map((alert) => (
        <div key={alert.id} className={`border px-3 py-2 text-xs ${severityTone[alert.severity]}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 gap-2">
              <div className="mt-0.5 shrink-0">{severityIcon[alert.severity]}</div>
              <div className="min-w-0">
                <div className="font-semibold uppercase tracking-wide">{alert.title}</div>
                <div className="mt-1 text-current/75">{alert.message}</div>
                <div className="mt-1 text-cyan-100">{alert.action}</div>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-current/70 hover:bg-white/10 hover:text-white"
              onClick={() => onDismiss(alert.id)}
              aria-label={`Acknowledge ${alert.title}`}
              title={`Acknowledge ${alert.title}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
});
