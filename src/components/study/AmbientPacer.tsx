/**
 * The ambient sensory-feedback stimulus for the between-subjects factor: a slow pacing ring, the same
 * for every participant in the group. It measures nothing and responds to nothing.
 */
export const AmbientPacer = () => (
  <div aria-hidden="true" className="pointer-events-none fixed bottom-6 right-6 z-0 h-24 w-24">
    <div data-ambient-surface className="ambient-pacer h-full w-full rounded-full border-2 border-o-teal/60 bg-o-teal/5" />
  </div>
);
