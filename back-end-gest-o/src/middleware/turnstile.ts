import type { Request, Response, NextFunction } from 'express'
import { isTurnstileEnabled, verifyTurnstileToken } from '../services/turnstile.js'

/**
 * Middleware: exige Turnstile token em endpoints publicos quando habilitado.
 * Token vem em `req.body.captchaToken` (forms) ou no header `X-Turnstile-Token`.
 */
export async function requireTurnstile(req: Request, res: Response, next: NextFunction) {
  if (!isTurnstileEnabled()) return next()
  const headerToken = typeof req.headers['x-turnstile-token'] === 'string' ? req.headers['x-turnstile-token'] : undefined
  const bodyToken = typeof (req.body as { captchaToken?: unknown })?.captchaToken === 'string'
    ? (req.body as { captchaToken: string }).captchaToken
    : undefined
  const token = bodyToken || headerToken
  const ok = await verifyTurnstileToken(token, req.ip)
  if (!ok) {
    return res.status(400).json({ message: 'Verificacao captcha falhou. Tente novamente.' })
  }
  next()
}
