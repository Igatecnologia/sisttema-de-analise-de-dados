/** Retorna SHA-256 da string em hexadecimal minúsculo (compatível com APIs que exigem senha hasheada). */
export async function sha256Hex(plain: string): Promise<string> {
  const enc = new TextEncoder().encode(plain)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
