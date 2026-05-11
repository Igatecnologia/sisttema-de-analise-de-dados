const COPILOT_FLAG_KEY = 'iga.copilot.opened'

export const OPEN_COPILOT_EVENT = 'iga:open-copilot'

export function markCopilotOpened() {
  try {
    localStorage.setItem(COPILOT_FLAG_KEY, '1')
  } catch {
    /* ignora */
  }
}

export function hasOpenedCopilot(): boolean {
  try {
    return localStorage.getItem(COPILOT_FLAG_KEY) === '1'
  } catch {
    return false
  }
}
