const TOUR_STORAGE_KEY = 'iga.guided-tour.done'

export function markGuidedTourDone() {
  try { localStorage.setItem(TOUR_STORAGE_KEY, '1') } catch { /* noop */ }
}

export function shouldAutoOpenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) !== '1'
  } catch {
    return false
  }
}

