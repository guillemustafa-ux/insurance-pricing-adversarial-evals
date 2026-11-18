import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { renderReport } from '../evals/report.js';
import { attempt, SUBMIT_ANSWER, SYSTEM, type Attempt } from '../evals/solve.js';
import { buildItems } from '../src/items.js';

// The attempt path and the report, with a stub in place of the Messages API: no key, no network.
// What is pinned is how a reply is read and graded, not how any real model behaves.

const item = buildItems()[0]!;

function stub(reply: unknown | Error): { client: Anthropic; bodies: any[] } {
  const bodies: any[] = [];
  const create = async (body: unknown) => {
    bodies.push(body);
    if (reply instanceof Error) throw reply;
    return reply;
  };
  return { client: { messages: { create } } as unknown as Anthropic, bodies };
}

const reply = (content: unknown[], stop_reason = 'tool_use') => ({ content, stop_reason, usage: { input_tokens: 500, output_tokens: 120 } });
const submit = (answer: unknown) => ({ type: 'tool_use', id: 'toolu_1', name: 'submit_answer', input: { answer } });

describe('one attempt', () => {
  it('sends the variant through one strict tool and grades the submitted number', async () => {
    const { client, bodies } = stub(reply([{ type: 'text', text: 'working' }, submit(item.key)]));
    const a = await attempt(client, 'claude-haiku-5-5', item, 'adversarial', 1);
    expect(a).toMatchObject({ item: item.id, variant: 'adversarial', answer: item.key, verdict: 'correct', inputTokens: 500, outputTokens: 120, text: 'working' });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ model: 'claude-haiku-5-5', system: SYSTEM, tools: [SUBMIT_ANSWER] });
    expect(bodies[0].messages[0].content).toBe(`Goal: ${item.adversarial}`);
  });

  it('the trap answer is graded trap', async () => {
    const { client } = stub(reply([submit(item.trapValue)]));
    expect((await attempt(client, 'claude-haiku-5-5', item, 'adversarial', 1)).verdict).toBe('trap');
  });

  it('a reply with no tool call is no answer, and its text is kept', async () => {
    const { client } = stub(reply([{ type: 'text', text: 'I cannot be sure.' }], 'end_turn'));
    expect(await attempt(client, 'claude-haiku-5-5', item, 'clean', 1)).toMatchObject({ answer: null, verdict: 'no_answer', text: 'I cannot be sure.' });
  });

  it('a non-numeric answer is no answer', async () => {
    const { client } = stub(reply([submit('823.00')]));
    expect((await attempt(client, 'claude-haiku-5-5', item, 'clean', 1)).verdict).toBe('no_answer');
  });

  it('a refusal by the API is refused, with its category', async () => {
    const { client } = stub({ ...reply([], 'refusal'), stop_details: { category: 'cyber' } });
    expect(await attempt(client, 'claude-haiku-5-5', item, 'clean', 1)).toMatchObject({ verdict: 'refused', refusal: 'cyber' });
  });

  it('a failed call is error, with the message, and costs nothing', async () => {
    const { client } = stub(new Error('overloaded'));
    expect(await attempt(client, 'claude-haiku-5-5', item, 'clean', 1)).toMatchObject({ verdict: 'error', error: 'overloaded', inputTokens: 0 });
  });
});

describe('the report', () => {
  const at = (variant: Attempt['variant'], verdict: Attempt['verdict']): Attempt => ({
    item: item.id,
    family: item.family,
    trap: item.trap,
    variant,
    rep: 1,
    answer: null,
    verdict,
    inputTokens: 1000,
    outputTokens: 200,
    text: '',
  });

  it('counts correct and trap answers by variant, family and item, and the unanswered apart', () => {
    const md = renderReport(
      [at('clean', 'correct'), at('clean', 'correct'), at('adversarial', 'trap'), at('adversarial', 'correct'), at('adversarial', 'refused')],
      [item],
      { model: 'claude-haiku-5-5', reps: 3, date: '2026-11-18', costUsd: 0.0012 },
    );
    expect(md).toContain('**Correct: clean 2/2 (100%), adversarial 1/3 (33%).** The adversarial variant gave the trap answer in 1/3 (33%).');
    expect(md).toContain(`| ${item.family} | `);
    expect(md).toMatch(new RegExp(`\\| ${item.id} \\| ${item.key} \\| ${item.trapValue} \\| 2/2 \\(100%\\) \\| 1/3 \\(33%\\) \\| 1/3 \\(33%\\) \\|`));
    expect(md).toContain('| 0 / 1 |');
    expect(md).toContain('Refused by the API: 1. Failed calls: 0.');
    expect(md).toContain('Tokens: 5,000 input, 1,000 output, USD 0.0012 at list price.');
  });
});
