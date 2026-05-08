const STORAGE_KEY = 'iga.cookieConsent.v1'

export type ConsentChoice = {
  essential: true
  analytics: boolean
  marketing: boolean
  decidedAt: string
}

export function getConsent(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ConsentChoice>
    if (parsed && typeof parsed === 'object' && parsed.decidedAt) {
      return {
        essential: true,
        analytics: Boolean(parsed.analytics),
        marketing: Boolean(parsed.marketing),
        decidedAt: parsed.decidedAt,
      }
    }
    return null
  } catch {
    return null
  }
}

export function saveConsent(choice: Omit<ConsentChoice, 'essential' | 'decidedAt'>) {
  const data: ConsentChoice = {
    essential: true,
    analytics: choice.analytics,
    marketing: choice.marketing,
    decidedAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
