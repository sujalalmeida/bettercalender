/** Cloudflare Pages advanced-mode worker. Only this file receives the Gemini key. */
declare const __EMBEDDED_GEMINI_KEY__: string
declare const __FIREBASE_WEB_API_KEY__: string
declare const __GEMINI_MODEL__: string

type WorkerEnv = { GEMINI_API_KEY?: string; ASSETS: { fetch(request: Request): Promise<Response> } }
type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
})

export async function handleGeminiRequest(request: Request, apiKey: string, firebaseApiKey: string, model: string, requestFetch: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Use POST for Gemini requests.' }, 405)
  if (!apiKey || !firebaseApiKey) return json({ error: 'Gemini is not configured in this deployment.' }, 503)
  const token = /^Bearer (.+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1]
  if (!token) return json({ error: 'Sign in under Settings → Cloud sync before using Gemini.' }, 401)

  let input: { parts?: GeminiPart[] }
  try {
    const body = await request.text()
    if (body.length > 16_000_000) return json({ error: 'This upload is too large.' }, 413)
    input = JSON.parse(body)
  } catch { return json({ error: 'Invalid Gemini request.' }, 400) }
  if (!Array.isArray(input.parts) || input.parts.length < 1 || input.parts.length > 8 || !input.parts.every(part =>
    part && (typeof part.text === 'string' && part.text.length <= 16_000 ||
      part.inlineData && typeof part.inlineData.mimeType === 'string' && typeof part.inlineData.data === 'string' &&
      part.inlineData.data.length <= 12_000_000 && /^(image\/(jpeg|png|webp)|application\/pdf|audio\/(webm|mp4|mpeg))$/.test(part.inlineData.mimeType))
  )) return json({ error: 'Invalid Gemini request.' }, 400)

  try {
    const authResponse = await requestFetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token })
    })
    if (!authResponse.ok) return json({ error: 'Your sign-in expired. Sign in again under Settings → Cloud sync.' }, 401)
    const account = await authResponse.json() as { users?: { localId?: string }[] }
    if (!account.users?.[0]?.localId) return json({ error: 'Your sign-in could not be verified.' }, 401)

    const modelName = /^[a-z0-9.-]+$/.test(model) ? model : 'gemini-3.8-flash'
    const geminiResponse = await requestFetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: input.parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } })
    })
    const data = await geminiResponse.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } }
    if (!geminiResponse.ok) return json({ error: `Gemini could not process this (${geminiResponse.status}). ${String(data.error?.message ?? '').slice(0, 240)}`.trim() }, 502)
    const text = data.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('') ?? ''
    if (!text) return json({ error: 'Gemini returned no text. Please try again.' }, 502)
    return json({ text })
  } catch {
    return json({ error: 'Gemini is temporarily unavailable. Please try again.' }, 502)
  }
}

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/gemini') return handleGeminiRequest(request, env.GEMINI_API_KEY || __EMBEDDED_GEMINI_KEY__, __FIREBASE_WEB_API_KEY__, __GEMINI_MODEL__)
    return env.ASSETS.fetch(request)
  }
}
