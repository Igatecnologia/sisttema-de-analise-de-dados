/**
 * Refresh tokens vivem somente no cookie HttpOnly `iga_refresh`.
 * Mantemos estas funcoes como no-op para compatibilidade com imports antigos.
 */
export function saveRefreshToken(_token: string | undefined, _expiresAt: number | undefined): void {
  /* noop */
}

export function getRefreshToken(): string | null {
  return null
}

export function clearRefreshToken(): void {
  /* noop */
}
