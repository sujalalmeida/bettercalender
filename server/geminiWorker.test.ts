import { describe, expect, it, vi } from 'vitest'
import { handleGeminiRequest } from './geminiWorker'

describe('Gemini Pages proxy', () => {
  it('requires a Firebase sign-in before calling Google', async () => {
    const requestFetch = vi.fn()
    const response = await handleGeminiRequest(new Request('https://plan.example/api/gemini', {
      method: 'POST', body: JSON.stringify({ parts: [{ text: 'Review surgery' }] })
    }), 'gemini-key', 'firebase-key', 'gemini-3.1-flash-lite', requestFetch)
    expect(response.status).toBe(401)
    expect(requestFetch).not.toHaveBeenCalled()
  })

  it('verifies the account and keeps the Gemini key on the server', async () => {
    const requestFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ users: [{ localId: 'student-1' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"items":[]}' }] } }] }), { status: 200 }))
    const response = await handleGeminiRequest(new Request('https://plan.example/api/gemini', {
      method: 'POST', headers: { Authorization: 'Bearer firebase-token' }, body: JSON.stringify({ parts: [{ text: 'Review surgery' }] })
    }), 'private-gemini-key', 'public-firebase-key', 'gemini-3.1-flash-lite', requestFetch)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ text: '{"items":[]}' })
    expect(requestFetch.mock.calls[1][1].headers['x-goog-api-key']).toBe('private-gemini-key')
    expect(requestFetch.mock.calls[1][0]).toContain('/models/gemini-3.1-flash-lite:generateContent')
  })
})
