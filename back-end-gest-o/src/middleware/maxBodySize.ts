import type { Request, Response, NextFunction } from 'express'

/**
 * Limita o tamanho de body por rota usando o header `Content-Length`.
 * Aplicado APOS `express.json()` global — funciona como guarda extra para rotas
 * sensiveis (auth: 4KB, copilot: 32KB) sem afrouxar o limite de 1MB do parser.
 *
 * Falha cedo (413) antes do handler — economiza CPU/memoria em ataques de
 * payload-grande.
 */
export function maxBodySize(maxBytes: number) {
  return function maxBodySizeMiddleware(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
    const raw = req.headers['content-length']
    if (typeof raw === 'string' && raw.trim()) {
      const declared = Number(raw)
      if (Number.isFinite(declared) && declared > maxBytes) {
        return res.status(413).json({ message: 'Payload muito grande.' })
      }
    }
    next()
  }
}
