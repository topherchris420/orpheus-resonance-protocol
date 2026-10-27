import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GLOSSARY, type GlossaryKey } from '@/content/glossary';

/**
 * A readable explanation that opens on click, tap or keyboard — not on hover alone — so it works for
 * touch and screen-reader users and stays open while being read.
 */
export const InfoTip = ({ term, label }: { term: GlossaryKey; label?: string }) => {
  const entry = GLOSSARY[term];
  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-o-text3 hover:bg-o-s3 hover:text-o-text"
        aria-label={`What is "${label ?? entry.term}"?`}
      >
        <Info aria-hidden="true" className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-80 border-o-line-strong bg-o-s2 text-sm text-o-text2" side="top">
        <p className="font-semibold text-o-text">{entry.term}</p>
        <p className="mt-1">{entry.short}</p>
        <p className="mt-2 text-o-text3">{entry.detail}</p>
      </PopoverContent>
    </Popover>
  );
};
