/**
 * The part of the harness that does not know what it is testing: one model playing one role through
 * one tool of the Messages API, and the price table. It depends only on the Anthropic SDK types, so
 * another project can copy this file unchanged (the adversarial eval sample does).
 */
import type Anthropic from '@anthropic-ai/sdk';

/**
 * USD per million tokens, Claude Haiku 5.5, prompts up to 100K tokens. Source: the API model table
 * cached 2026-11-03. A list price, not an invoice: the console shows what was billed.
 */
export const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
};

export function costUsd(model: string, inputTokens: number, outputTokens: number): number | undefined {
  const price = PRICE_PER_MTOK[model];
  return price ? (inputTokens * price.input + outputTokens * price.output) / 1_000_000 : undefined;
}

/**
 * One model, one system prompt, one tool. `next(seen)` hands the model what the last call returned
 * and gives back the next call it wants to make, parsed by `parse`; `null` means it is done, or the
 * API refused (then `refusal` says why and the run proves nothing). No sampling parameters: Haiku 5.5
 * rejects non-default values.
 */
export class ModelDriver<T> {
  tokens = 0;
  inputTokens = 0;
  outputTokens = 0;
  /** Set when the API refused the request with its own safeguards, not the target's. */
  refusal = '';
  summary = '';
  private messages: Anthropic.MessageParam[] = [];
  private queue: Anthropic.ToolUseBlock[] = [];
  private results: Anthropic.ToolResultBlockParam[] = [];
  private current: string | null = null;
  private started = false;

  constructor(
    private readonly client: Anthropic,
    private readonly model: string,
    private readonly goal: string,
    private readonly system: string,
    private readonly tool: Anthropic.Tool,
    private readonly parse: (input: unknown) => T,
  ) {}

  async next(seen: string | null): Promise<T | null> {
    if (this.current !== null) {
      this.results.push({ type: 'tool_result', tool_use_id: this.current, content: seen ?? '(no reply)' });
      this.current = null;
    }
    if (this.queue.length === 0) {
      if (!this.started) {
        this.messages = [{ role: 'user', content: `Goal: ${this.goal}` }];
        this.started = true;
      } else if (this.results.length > 0) {
        this.messages.push({ role: 'user', content: this.results });
        this.results = [];
      } else {
        return null;
      }
      this.queue.push(...(await this.ask()));
    }
    const use = this.queue.shift();
    if (!use) return null;
    this.current = use.id;
    return this.parse(use.input);
  }

  private async ask(): Promise<Anthropic.ToolUseBlock[]> {
    const reply = await this.client.messages.create({
      model: this.model,
      max_tokens: 1500,
      system: this.system,
      tools: [this.tool],
      messages: this.messages,
    });
    this.inputTokens += reply.usage.input_tokens;
    this.outputTokens += reply.usage.output_tokens;
    this.tokens += reply.usage.input_tokens + reply.usage.output_tokens;
    if (reply.stop_reason === 'refusal') {
      const details = (reply as unknown as { stop_details?: { category?: string | null } | null }).stop_details;
      this.refusal = details?.category ?? 'unspecified';
      return [];
    }
    this.messages.push({ role: 'assistant', content: reply.content });
    const text = reply.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim();
    if (text) this.summary = text;
    return reply.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  }
}
