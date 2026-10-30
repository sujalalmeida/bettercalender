export interface AIRequest {
  purpose?: string
  parts: { text?: string; inlineData?: { mimeType: string; data: string } }[]
}

export interface PreparedAnalysis {
  systemInstruction: string
  responseSchema: unknown
  validate: (text: string) => string
}

export interface PersonalAI {
  prepare(input: AIRequest): PreparedAnalysis | null
}

// Replaced by an optional local integration in personal deployments.
export const personalAI: PersonalAI = { prepare: () => null }
