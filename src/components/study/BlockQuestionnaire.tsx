import { useEffect, useRef, useState } from 'react';
import { Slider } from '@/components/common/Slider';
import { COMPREHENSION_ITEMS, TLX_SUBSCALES, type TlxSubscale } from '@/experiment/protocol';

export interface QuestionnaireAnswers {
  tlx: Record<TlxSubscale, number>;
  comprehension: Record<string, number>;
  comfort: number;
}

const COMFORT = [1, 2, 3, 4, 5, 6, 7];

/**
 * After-block questionnaire: raw NASA-TLX, comprehension items and one comfort item. Sliders start in
 * the middle but count as answered only once moved or confirmed, so a default is never recorded as a
 * response.
 */
export const BlockQuestionnaire = ({ blockNumber, blockCount, onSubmit }: { blockNumber: number; blockCount: number; onSubmit: (answers: QuestionnaireAnswers) => void }) => {
  const [tlx, setTlx] = useState<Record<string, number>>(() => Object.fromEntries(TLX_SUBSCALES.map(({ id }) => [id, 50])));
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [comprehension, setComprehension] = useState<Record<string, number>>({});
  const [comfort, setComfort] = useState<number | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const missing = [
    ...TLX_SUBSCALES.filter(({ id }) => !touched.has(id)).map(({ label }) => label),
    ...COMPREHENSION_ITEMS.filter((item) => comprehension[item.id] === undefined).map((_, index) => `Question ${index + 1}`),
    ...(comfort === null ? ['Comfort'] : []),
  ];

  return (
    <form
      className="mx-auto max-w-2xl space-y-8 px-4 py-10 sm:px-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (missing.length > 0 || comfort === null) {
          setShowMissing(true);
          return;
        }
        onSubmit({ tlx: tlx as Record<TlxSubscale, number>, comprehension, comfort });
      }}
    >
      <div>
        <p className="o-eyebrow">
          Block {blockNumber} of {blockCount} complete
        </p>
        <h1 ref={heading} tabIndex={-1} className="mt-2 text-2xl font-semibold text-o-text outline-none">
          A few questions about this block
        </h1>
        <p className="mt-2 text-sm text-o-text2">Answer for the block you just finished. There are no right answers in the first part.</p>
      </div>

      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-o-text">Workload</legend>
        {TLX_SUBSCALES.map(({ id, label, prompt }) => (
          <div key={id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-o-text">
                <span className="font-semibold">{label}.</span> {prompt}
              </span>
              <span className="shrink-0 font-mono text-o-text">{touched.has(id) ? tlx[id] : '—'}</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[tlx[id]]}
              onValueChange={([value]) => {
                setTlx((previous) => ({ ...previous, [id]: value }));
                setTouched((previous) => new Set(previous).add(id));
              }}
              onPointerDown={() => setTouched((previous) => new Set(previous).add(id))}
              label={label}
              valueText={(value) => (touched.has(id) ? `${value} of 100` : 'not answered')}
            />
            <div className="flex justify-between text-xs text-o-text3">
              <span>{id === 'performance' ? 'Perfect' : 'Very low'}</span>
              <span>{id === 'performance' ? 'Failure' : 'Very high'}</span>
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-o-text">Understanding</legend>
        {COMPREHENSION_ITEMS.map((item, index) => (
          <fieldset key={item.id} className="space-y-1.5">
            <legend className="text-sm text-o-text">
              {index + 1}. {item.question}
            </legend>
            {item.options.map((optionText, optionIndex) => (
              <label key={optionText} className="flex items-center gap-2 text-sm text-o-text2">
                <input
                  type="radio"
                  name={`${item.id}-${blockNumber}`}
                  checked={comprehension[item.id] === optionIndex}
                  onChange={() => setComprehension((previous) => ({ ...previous, [item.id]: optionIndex }))}
                />
                {optionText}
              </label>
            ))}
          </fieldset>
        ))}
      </fieldset>

      <fieldset>
        <legend className="text-base font-semibold text-o-text">How comfortable was the interface during this block?</legend>
        <div className="mt-2 flex flex-wrap gap-2" role="presentation">
          {COMFORT.map((value) => (
            <label
              key={value}
              className={`flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-o-teal ${
                comfort === value ? 'border-o-teal bg-o-teal/10 text-o-text' : 'border-o-line text-o-text2'
              }`}
            >
              <input type="radio" className="sr-only" name={`comfort-${blockNumber}`} checked={comfort === value} onChange={() => setComfort(value)} />
              <span aria-hidden="true">{value}</span>
              <span className="sr-only">
                {value}
                {value === 1 ? ', very uncomfortable' : value === 7 ? ', very comfortable' : ''}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-1 flex max-w-xs justify-between text-xs text-o-text3">
          <span>1 · very uncomfortable</span>
          <span>7 · very comfortable</span>
        </div>
      </fieldset>

      {showMissing && missing.length > 0 && (
        <p role="alert" className="text-sm text-o-amber">
          Please answer: {missing.join(', ')}.
        </p>
      )}
      <button type="submit" className="o-button-primary">
        Continue
      </button>
    </form>
  );
};
