/**
 * Rate limiting de tentativas de login no frontend.
 * NÃO substitui rate limiting no backend — é uma camada extra de UX.
 */

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 60 * 1000 // 1 minuto
const WINDOW_MS = 5 * 60 * 1000 // 5 minutos

type AttemptLog = { timestamps: number[]; lockedUntil: number | null }

let state: AttemptLog = { timestamps: [], lockedUntil: null }

export function checkLoginAllowed(): { allowed: boolean; waitSeconds: number } {
  const now = Date.now()

  // Se está em lockout
  if (state.lockedUntil && now < state.lockedUntil) {
    return { allowed: false, waitSeconds: Math.ceil((state.lockedUntil - now) / 1000) }
  }

  // Limpa lockout expirado
  if (state.lockedUntil && now >= state.lockedUntil) {
    state.lockedUntil = null
  }

  return { allowed: true, waitSeconds: 0 }
}

export function recordLoginAttempt(success: boolean) {
  const now = Date.now()

  if (success) {
    // Reset no sucesso
    state = { timestamps: [], lockedUntil: null }
    return
  }

  // Remove tentativas fora da janela
  state.timestamps = state.timestamps.filter((t) => now - t < WINDOW_MS)
  state.timestamps.push(now)

  // Se excedeu o máximo, ativa lockout progressivo
  if (state.timestamps.length >= MAX_ATTEMPTS) {
    const multiplier = Math.floor(state.timestamps.length / MAX_ATTEMPTS)
    state.lockedUntil = now + LOCKOUT_MS * multiplier
  }
}

export function getLoginAttemptsRemaining(): number {
  const now = Date.now()
  const recent = state.timestamps.filter((t) => now - t < WINDOW_MS)
  return Math.max(0, MAX_ATTEMPTS - recent.length)
}
