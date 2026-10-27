import { payloadDigest } from './sources';
import type { EvidenceItem, EvidenceKind, PayloadValue } from './types';

export interface ItemSpec {
  id: string;
  kind: EvidenceKind;
  title: string;
  text: string;
  sourceId?: string;
  claim?: string;
  observedAtTick: number;
  receivedAtTick?: number;
  originId?: string;
  relayOf?: string;
  fulfills?: string;
  fields?: Record<string, PayloadValue>;
  selfReportedConfidence?: EvidenceItem['selfReportedConfidence'];
  parents?: string[];
}

/** Builds an item whose digest matches its payload, as a correctly transmitted message would. */
export const buildItem = (spec: ItemSpec): EvidenceItem => {
  const payload: Record<string, PayloadValue> = { ...(spec.fields ?? {}) };
  if (spec.claim !== undefined) payload.claim = spec.claim;
  const item: EvidenceItem = {
    id: spec.id,
    kind: spec.kind,
    title: spec.title,
    text: spec.text,
    observedAtTick: spec.observedAtTick,
    receivedAtTick: spec.receivedAtTick ?? spec.observedAtTick,
    originId: spec.originId ?? spec.id,
    payload,
    digest: payloadDigest(payload),
  };
  if (spec.sourceId !== undefined) item.sourceId = spec.sourceId;
  if (spec.claim !== undefined) item.claim = spec.claim;
  if (spec.relayOf !== undefined) item.relayOf = spec.relayOf;
  if (spec.fulfills !== undefined) item.fulfills = spec.fulfills;
  if (spec.selfReportedConfidence !== undefined) item.selfReportedConfidence = spec.selfReportedConfidence;
  if (spec.parents !== undefined) item.parents = spec.parents;
  return item;
};

/**
 * Simulates corruption in transit: the payload (and the claim parsed from it) change while the
 * transmitted digest stays the same, so an integrity check can detect it.
 */
export const corruptItem = (
  item: EvidenceItem,
  changes: { claim?: string; fields?: Record<string, PayloadValue>; text?: string },
): EvidenceItem => {
  const payload = { ...item.payload, ...(changes.fields ?? {}) };
  if (changes.claim !== undefined) payload.claim = changes.claim;
  return {
    ...item,
    payload,
    claim: changes.claim ?? item.claim,
    text: changes.text ?? item.text,
  };
};
