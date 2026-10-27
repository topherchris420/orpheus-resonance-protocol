import React, { useEffect, useMemo, useState } from 'react';

interface TemporalArchiveProps {
  phase: number;
  tick: number;
  audioLevel: number;
}

interface Fragment {
  id: string;
  chapter: number;
  type: 'memory' | 'choice' | 'echo' | 'prophecy';
  content: string;
}

/** Story fragments of the Orpheus fiction. They unlock as the simulated story advances. */
const FRAGMENTS: Fragment[] = [
  { id: 'art-001', chapter: 1, type: 'memory', content: 'First archive entry: an unusual resonance pattern is logged at Building 47.' },
  { id: 'art-002', chapter: 2, type: 'choice', content: 'Decision point: continue linear observation, or open the Orpheus file.' },
  { id: 'art-003', chapter: 2, type: 'echo', content: 'An echo from another branch of the story: "The myth was always true."' },
  { id: 'art-004', chapter: 3, type: 'prophecy', content: 'A prediction in the archive: every branch of the story converges on one moment.' },
  { id: 'art-005', chapter: 4, type: 'memory', content: 'Final archive entry: "We are no longer the observers. We have become the observed."' },
];

const CHAPTER_TITLE = ['', 'Linear logs', 'Fragments emerging', 'Corridors open', 'Final chapter'];

const TYPE_STYLE: Record<Fragment['type'], string> = {
  memory: 'text-o-sky',
  choice: 'text-o-amber',
  echo: 'text-o-violet',
  prophecy: 'text-o-red',
};

export const TemporalArchive: React.FC<TemporalArchiveProps> = ({ phase, tick, audioLevel }) => {
  const [selected, setSelected] = useState<Fragment | null>(null);
  const [corridor, setCorridor] = useState<string[]>([]);
  // The story advances with simulated time and phase; within a phase, a new fragment surfaces every 90 s.
  const chapterProgress = Math.min(1, (tick % 270) / 270);
  const unlocked = useMemo(() => FRAGMENTS.filter((fragment) => fragment.chapter < phase || (fragment.chapter === phase && chapterProgress > 0.33)), [chapterProgress, phase]);

  useEffect(() => {
    if (audioLevel > 0.8 && phase >= 3) {
      setCorridor((previous) => [...previous.slice(-4), 'A loud sound reached the local microphone. The archive opens another corridor in the story.']);
    }
  }, [audioLevel, phase]);

  return (
    <section aria-label="Temporal archive" className="h-full space-y-3 overflow-y-auto rounded-xl border border-o-line bg-o-s1 p-4">
      <div className="flex items-center justify-between border-b border-o-line pb-2">
        <h3 className="text-sm font-semibold text-o-text">Temporal archive</h3>
        <span className="o-chip border-dashed border-o-text3/70 text-o-text2">Story · fiction</span>
      </div>
      <p className="text-xs text-o-text3">
        Chapter {phase}: {CHAPTER_TITLE[Math.min(4, Math.max(1, phase))]}. Fragments unlock as the simulated story advances.
      </p>
      <ul className="space-y-1.5">
        {unlocked.map((fragment) => (
          <li key={fragment.id}>
            <button type="button" className="o-button w-full justify-start text-left text-xs" aria-pressed={selected?.id === fragment.id} onClick={() => setSelected(fragment)}>
              <span className={`font-semibold uppercase ${TYPE_STYLE[fragment.type]}`}>{fragment.type}</span>
              <span className="text-o-text3">· chapter {fragment.chapter}</span>
            </button>
          </li>
        ))}
        {unlocked.length === 0 && <li className="text-xs text-o-text3">No fragments yet.</li>}
      </ul>
      {selected && (
        <div className="rounded-lg border border-o-line bg-o-s2 p-3 text-sm text-o-text2">
          <p className={`text-xs font-semibold uppercase ${TYPE_STYLE[selected.type]}`}>{selected.type} fragment</p>
          <p className="mt-1">{selected.content}</p>
          <button type="button" className="o-button-quiet mt-2 min-h-9 px-2 text-xs" onClick={() => setSelected(null)}>
            Close
          </button>
        </div>
      )}
      {phase >= 3 && corridor.length > 0 && (
        <ul className="space-y-1 border-t border-o-line pt-2 text-xs text-o-violet" aria-label="Story corridor">
          {corridor.map((entry, index) => (
            <li key={index}>› {entry}</li>
          ))}
        </ul>
      )}
    </section>
  );
};
