const TOUR_STORAGE_KEY = 'iga.guided-tour.done'

export function markGuidedTourDone() {
  try { localStorage.setItem(TOUR_STORAGE_KEY, '1') } catch { /* noop */ }
}

export function shouldAutoOpenTour(): boolean {
  // Auto-open desabilitado — usuario abre manualmente via botao "Tour" no header.
  // Decisao UX: pop-ups intrusivos prejudicam first impression. Fica disponivel
  // mas sob demanda.
  return false
}

