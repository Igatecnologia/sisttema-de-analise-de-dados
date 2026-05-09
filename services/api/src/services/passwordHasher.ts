import { createHash } from 'node:crypto'

/**
 * AVISO DE SEGURANCA — uso restrito.
 *
 * Esta funcao NAO armazena senhas; ela apenas APLICA o hash exigido pela API
 * de ERP externo (SGBR e similares) antes de enviar credenciais no login proxy.
 * Os modos `md5`/`plain` existem porque alguns ERPs ainda os exigem.
 *
 * Para senhas de usuarios do app, use `hashUserPassword` em `userStorage.ts`
 * (scrypt com parametros OWASP).
 */
export async function hashPassword(password: string, mode: string): Promise<string> {
  switch (mode) {
    case 'sha256':
      return createHash('sha256').update(password).digest('hex')
    case 'md5':
      return createHash('md5').update(password).digest('hex')
    case 'plain':
    default:
      return password
  }
}
