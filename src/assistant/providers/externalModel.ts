import { DEFAULT_THRESHOLD } from '@/evidence/engine';
import type { EvidenceContext } from '@/evidence/types';
import { SCHEMA } from '@/engine/version';
import { defaultRegistry, type CalibrationRegistry } from '../calibrationRegistry';
import { assistantInput, resolveProposal, deterministicOutput, type AssistantResult } from '../index';
import type { AssistedCondition } from '../schema';

/**
 * Optional adapter for a language model served by an OpenAI-compatible chat endpoint (for example a
 * local model server). It is experimental and not part of any evaluated condition. The model only
 * *proposes*; every proposal passes the same guardrails as the deterministic assistant, and any
 * failure — network error, timeout, invalid JSON, schema violation, unsupported conclusion — falls
 * back to the deterministic assessment.
 *
 * Status: implemented and tested against simulated responses only; it is not connected to the
 * interface. Connecting it requires (1) recording each displayed model output as an external input in
 * the session log, because model outputs are not reproducible, and (2) allowing the endpoint in the
 * page's Content-Security-Policy `connect-src`. Neither is done yet.
 */
export interface ExternalModelConfig {
  endpoint: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

export const buildModelPrompt = (context: EvidenceContext, condition: AssistedCondition): string => {
  const evidence = context.items.map((item) => ({
    id: item.id,
    kind: item.kind,
    title: item.title,
    text: item.text,
    source: item.sourceId,
    claim: item.claim,
    observedAtTick: item.observedAtTick,
    receivedAtTick: item.receivedAtTick,
    origin: item.originId,
    relayOf: item.relayOf,
    digest: item.digest,
    payload: item.payload,
  }));
  return [
    'You assist a person assessing a fictional simulated situation. You never give operational or tactical instructions.',
    `Return only JSON matching schema "${SCHEMA.assessment}" for condition "${condition}".`,
    'Cite only the evidence ids provided. Do not treat any assistant text as evidence. Abstain when the evidence is insufficient.',
    `Question: ${context.question}`,
    `Interpretations: ${JSON.stringify(context.hypotheses.map(({ id, label }) => ({ id, label })))}`,
    `Sources: ${JSON.stringify(context.sources.map(({ id, label, reliability, freshnessTicks }) => ({ id, label, reliability, freshnessTicks })))}`,
    `Current tick: ${context.nowTick}`,
    `Evidence: ${JSON.stringify(evidence)}`,
  ].join('\n');
};

const extractJson = (content: unknown): unknown => {
  if (typeof content !== 'string') return content;
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Model reply contained no JSON object.');
  return JSON.parse(content.slice(start, end + 1));
};

export const requestModelAssessment = async (
  config: ExternalModelConfig,
  condition: AssistedCondition,
  rawContext: EvidenceContext,
  options: { fetchImpl?: FetchLike; threshold?: number; registry?: CalibrationRegistry } = {},
): Promise<AssistantResult> => {
  const context = assistantInput(rawContext);
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const registry = options.registry ?? defaultRegistry;
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 15000);
  try {
    const response = await fetchImpl(config.endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}) },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        messages: [{ role: 'user', content: buildModelPrompt(context, condition) }],
      }),
    });
    if (!response.ok) throw new Error(`Model endpoint returned HTTP ${response.status}.`);
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const proposal = extractJson(body.choices?.[0]?.message?.content);
    return { condition, ...resolveProposal(condition, proposal, context, threshold, registry) };
  } catch (error) {
    const fallback = deterministicOutput(condition, context, threshold, registry);
    const message = error instanceof Error ? error.message : 'Unknown error.';
    return {
      condition,
      output: { ...fallback, flags: [{ code: 'assistant-unavailable', message: `External model unavailable (${message}); deterministic assessment shown.` }, ...fallback.flags].slice(0, 12) },
      proposal: null,
      guardrail: null,
      usedFallback: true,
    };
  } finally {
    clearTimeout(timer);
  }
};
