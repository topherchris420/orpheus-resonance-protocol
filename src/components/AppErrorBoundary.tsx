import React from "react";
import { appConfig } from "@/config/appConfig";

interface AppErrorBoundaryState {
  hasError: boolean;
  incidentId: string;
}

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

const createIncidentId = (): string => {
  return `INC-${Math.floor(Date.now() / 1000).toString(36).toUpperCase()}`;
};

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    incidentId: "",
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return {
      hasError: true,
      incidentId: createIncidentId(),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("Unhandled application error", {
      incidentId: this.state.incidentId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-xl border border-slate-700 rounded-lg bg-slate-900/90 p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Application Error</h1>
          <p className="text-sm text-slate-300">
            The interface encountered an unexpected error and was safely halted.
          </p>
          <p className="text-sm text-slate-300">
            Incident ID: <span className="font-mono text-cyan-300">{this.state.incidentId}</span>
          </p>
          <p className="text-sm text-slate-400">
            If the issue persists, contact support at {appConfig.supportEmail}.
          </p>
          <button
            type="button"
            className="rounded border border-cyan-500 px-4 py-2 text-cyan-200 hover:bg-cyan-500/10"
            onClick={this.handleReload}
          >
            Reload application
          </button>
        </div>
      </div>
    );
  }
}
