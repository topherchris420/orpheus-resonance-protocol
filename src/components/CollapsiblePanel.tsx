import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsiblePanelProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  statusBadge?: React.ReactNode;
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = React.memo(({
  title,
  icon,
  defaultOpen = false,
  open,
  onOpenChange,
  children,
  statusBadge,
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <div className="border border-current/20 bg-black/40 backdrop-blur-sm rounded-sm overflow-hidden transition-all duration-300">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 active:bg-white/5 touch-manipulation select-none"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider opacity-80">
          {icon}
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge}
          {isOpen ? (
            <ChevronUp className="w-4 h-4 opacity-60" />
          ) : (
            <ChevronDown className="w-4 h-4 opacity-60" />
          )}
        </div>
      </button>
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-2">{children}</div>
      </div>
    </div>
  );
});