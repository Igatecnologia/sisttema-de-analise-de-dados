import { http } from './http'

export type MfaStatus = {
  enabled: boolean
  pendingSetup: boolean
  backupCodesRemaining: number
}

export async function getMfaStatus(): Promise<MfaStatus> {
  const { data } = await http.get<MfaStatus>('/api/v1/auth/mfa/status')
  return data
}

export async function initMfaSetup(): Promise<{ otpauthUrl: string; secret: string }> {
  const { data } = await http.post<{ otpauthUrl: string; secret: string }>('/api/v1/auth/mfa/setup-init')
  return data
}

export async function confirmMfaSetup(totp: string): Promise<{ ok: true; backupCodes: string[] }> {
  const { data } = await http.post<{ ok: true; backupCodes: string[] }>('/api/v1/auth/mfa/setup-confirm', { totp })
  return data
}

export async function disableMfa(password: string, totp: string): Promise<void> {
  await http.post('/api/v1/auth/mfa/disable', { password, totp })
}

export async function regenerateMfaBackupCodes(password: string, totp: string): Promise<string[]> {
  const { data } = await http.post<{ ok: true; backupCodes: string[] }>(
    '/api/v1/auth/mfa/backup-codes/regenerate',
    { password, totp },
  )
  return data.backupCodes
}

/** URL para gerar QR code do otpauth_url. Usa servico publico — pode trocar por lib offline depois. */
export function buildQrCodeUrl(otpauthUrl: string, size = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(otpauthUrl)}`
}
