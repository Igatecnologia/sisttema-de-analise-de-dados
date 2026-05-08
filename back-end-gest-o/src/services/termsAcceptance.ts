import { createHash } from 'node:crypto'
import { getDb } from '../db/sqlite.js'

/**
 * SEC-4.4 — Aceite versionado de Termos de Uso e Politica de Privacidade.
 *
 * Estrategia:
 *  - Cada documento tem uma `version` (string ISO-like). Mudou o texto -> bump da versao.
 *  - O hash do documento (SHA-256 do texto canonico) eh gravado junto com o aceite,
 *    garantindo que quem aceitou viu *exatamente* aquele conteudo (anti-tampering).
 *  - O frontend pergunta `/legal/terms-status` no boot — se `needsAcceptance: true`,
 *    renderiza modal blocker.
 */

export const TERMS_VERSION = process.env.TERMS_VERSION ?? '2026-05-08'
export const PRIVACY_VERSION = process.env.PRIVACY_VERSION ?? '2026-05-08'

/** Hash placeholder dos documentos atuais. Ao publicar versao oficial, gerar
 *  com `sha256sum docs/legal/termos.md` e exportar via env TERMS_DOC_HASH. */
const TERMS_DOC_HASH = process.env.TERMS_DOC_HASH
  ?? createHash('sha256').update(`terms@${TERMS_VERSION}|privacy@${PRIVACY_VERSION}`).digest('hex')

export type AcceptanceRecord = {
  id: number
  tenantId: string
  userId: string
  termsVersion: string
  privacyVersion: string
  documentHash: string
  acceptedAt: string
  ipHash: string | null
  uaHash: string | null
}

function hashIdentifier(value: string | undefined): string | null {
  if (!value) return null
  return createHash('sha256').update(value).digest('hex').slice(0, 32)
}

export function getLatestAcceptance(userId: string): AcceptanceRecord | null {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT id, tenant_id as tenantId, user_id as userId,
              terms_version as termsVersion, privacy_version as privacyVersion,
              document_hash as documentHash, accepted_at as acceptedAt,
              ip_hash as ipHash, ua_hash as uaHash
         FROM terms_acceptance
        WHERE user_id = ?
        ORDER BY accepted_at DESC
        LIMIT 1`,
    )
    .get(userId) as AcceptanceRecord | undefined
  return row ?? null
}

export type TermsStatus = {
  needsAcceptance: boolean
  currentVersion: { terms: string; privacy: string; documentHash: string }
  acceptedVersion: { terms: string; privacy: string; documentHash: string; acceptedAt: string } | null
}

export function getTermsStatus(userId: string): TermsStatus {
  const latest = getLatestAcceptance(userId)
  const current = { terms: TERMS_VERSION, privacy: PRIVACY_VERSION, documentHash: TERMS_DOC_HASH }
  if (!latest) return { needsAcceptance: true, currentVersion: current, acceptedVersion: null }
  const matches =
    latest.termsVersion === TERMS_VERSION &&
    latest.privacyVersion === PRIVACY_VERSION &&
    latest.documentHash === TERMS_DOC_HASH
  return {
    needsAcceptance: !matches,
    currentVersion: current,
    acceptedVersion: {
      terms: latest.termsVersion,
      privacy: latest.privacyVersion,
      documentHash: latest.documentHash,
      acceptedAt: latest.acceptedAt,
    },
  }
}

export function recordAcceptance(args: {
  tenantId: string
  userId: string
  ip?: string
  userAgent?: string
}): AcceptanceRecord {
  const db = getDb()
  const acceptedAt = new Date().toISOString()
  const result = db
    .prepare(
      `INSERT INTO terms_acceptance
         (tenant_id, user_id, terms_version, privacy_version, document_hash, accepted_at, ip_hash, ua_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      args.tenantId,
      args.userId,
      TERMS_VERSION,
      PRIVACY_VERSION,
      TERMS_DOC_HASH,
      acceptedAt,
      hashIdentifier(args.ip),
      hashIdentifier(args.userAgent),
    )
  return {
    id: Number(result.lastInsertRowid),
    tenantId: args.tenantId,
    userId: args.userId,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    documentHash: TERMS_DOC_HASH,
    acceptedAt,
    ipHash: hashIdentifier(args.ip),
    uaHash: hashIdentifier(args.userAgent),
  }
}
