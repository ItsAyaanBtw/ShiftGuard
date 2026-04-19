export const config = { runtime: 'edge' }

const MAX_BODY_CHARS = 1_200_000

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.length < 10) {
    return jsonResponse(
      { error: 'ANTHROPIC_API_KEY not configured on server', type: 'config' },
      500,
    )
  }

  let bodyText
  try {
    bodyText = await req.text()
  } catch {
    return jsonResponse({ error: 'Invalid request body', type: 'parse' }, 400)
  }

  if (!bodyText || bodyText.length > MAX_BODY_CHARS) {
    return jsonResponse({ error: 'Request body too large', type: 'limit' }, 413)
  }

  let parsed
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    return jsonResponse({ error: 'Body must be valid JSON', type: 'parse' }, 400)
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.messages)) {
    return jsonResponse({ error: 'Invalid Anthropic request shape', type: 'validation' }, 400)
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: bodyText,
    })

    const text = await res.text()
    return new Response(text, {
      status: res.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return jsonResponse(
      { error: 'Upstream request failed', type: 'proxy', details: err.message },
      502,
    )
  }
}
