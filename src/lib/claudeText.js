import { callClaude } from './claudeClient'

/**
 * Lightweight text-out helper around the dual-path Claude transport.
 * Callers that only need a string response (not tool-use JSON) go through here so the
 * transport never has to be duplicated.
 */
export async function callClaudeText(prompt, { maxTokens = 1200, system } = {}) {
  const response = await callClaude({
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: [
      { role: 'user', content: [{ type: 'text', text: String(prompt || '') }] },
    ],
  })

  const blocks = Array.isArray(response?.content) ? response.content : []
  const textBlock = blocks.find(b => b?.type === 'text' && typeof b.text === 'string')
  if (!textBlock) throw new Error('No text content in response.')
  return String(textBlock.text || '').trim()
}
