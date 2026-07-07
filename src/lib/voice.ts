<<<<<<< HEAD
import { DIMS, DishVector } from './taste';
import { callClaude, parseJsonResponse } from './openrouter';
=======
import Anthropic from '@anthropic-ai/sdk';
import { DIMS, DishVector } from './taste';
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c

// Transcription happens client-side with the Web Speech API for MVP (zero cost, zero
// upload). This module turns the transcript into structured signal. "Too salty but I
// loved the char" should become {salty: 0.9, grilled: 0.8} + a sentiment note — not a blob.

const SYSTEM = `You extract structured taste signal from a short spoken note about a dish.
Respond with ONLY JSON, no fences:
{"attributes": {<only dims the note actually mentions, from: ${DIMS.join(', ')}>: number 0..1 presence},
 "sentiment_hint": number -1..1 or null (only if the note clearly signals overall like/dislike)}
"too salty" -> salty ~0.9. "loved the char" -> grilled ~0.8. "wish it was spicier" -> spicy ~0.2.
Mention nothing the note doesn't support.`;

export async function extractVoiceSignal(transcript: string): Promise<{ attributes: DishVector; sentiment_hint: number | null }> {
<<<<<<< HEAD
  if (!transcript.trim()) return { attributes: {}, sentiment_hint: null };

  const text = await callClaude(SYSTEM, transcript, { maxTokens: 300 });
  const parsed = parseJsonResponse<{ attributes?: Record<string, unknown>; sentiment_hint?: unknown }>(text);
  if (!parsed) return { attributes: {}, sentiment_hint: null };

  const attributes: DishVector = {};
  for (const [k, v] of Object.entries(parsed.attributes ?? {})) {
    if ((DIMS as readonly string[]).includes(k)) attributes[k] = Math.min(1, Math.max(0, Number(v)));
  }
  const hint = parsed.sentiment_hint;
  return { attributes, sentiment_hint: typeof hint === 'number' ? Math.min(1, Math.max(-1, hint)) : null };
=======
  if (!process.env.ANTHROPIC_API_KEY || !transcript.trim()) {
    return { attributes: {}, sentiment_hint: null };
  }
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: SYSTEM,
    messages: [{ role: 'user', content: transcript }],
  });
  const text = msg.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('');
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    const attributes: DishVector = {};
    for (const [k, v] of Object.entries(parsed?.attributes ?? {})) {
      if ((DIMS as readonly string[]).includes(k)) attributes[k] = Math.min(1, Math.max(0, Number(v)));
    }
    const hint = parsed?.sentiment_hint;
    return { attributes, sentiment_hint: typeof hint === 'number' ? Math.min(1, Math.max(-1, hint)) : null };
  } catch {
    return { attributes: {}, sentiment_hint: null };
  }
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
}
