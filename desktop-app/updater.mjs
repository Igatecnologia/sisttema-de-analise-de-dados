import https from 'node:https'
import http from 'node:http'
import { dialog, shell } from 'electron'

/**
 * Checagem leve de atualização. Habilitada só se `IGA_UPDATE_FEED_URL` estiver
 * definida no ambiente (env var) apontando para um JSON:
 *
 *   { "version": "1.2.3", "url": "https://.../IGA-Gestao-Desktop-Setup.exe", "notes": "..." }
 *
 * Quando há versão mais nova, mostramos um dialog não-bloqueante sugerindo
 * download. Não substituímos binários automaticamente (exige assinatura +
 * CI de releases; fica como evolução futura com `electron-updater`).
 */

function compareVersions(a, b) {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da !== db) return da < db ? -1 : 1
  }
  return 0
}

function fetchJson(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http
    const req = lib.get(url, (res) => {
      if ((res.statusCode ?? 0) >= 400) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      let body = ''
      res.setEncoding('utf-8')
      res.on('data', (chunk) => {
        body += chunk
        if (body.length > 32_768) {
          req.destroy(new Error('Feed muito grande'))
        }
      })
      res.on('end', () => {
        try { resolve(JSON.parse(body)) } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Timeout')))
  })
}

/**
 * Executa a verificação. `currentVersion` vem de `app.getVersion()`.
 * `onLog` (opcional) recebe mensagens para logar em arquivo.
 */
export async function checkForUpdates(currentVersion, onLog = () => {}) {
  const feedUrl = process.env.IGA_UPDATE_FEED_URL?.trim()
  if (!feedUrl) {
    onLog('info', 'update check desabilitada (IGA_UPDATE_FEED_URL não definida)')
    return { status: 'disabled' }
  }
  try {
    const meta = await fetchJson(feedUrl)
    if (!meta || typeof meta.version !== 'string' || typeof meta.url !== 'string') {
      onLog('warn', `feed inválido: ${JSON.stringify(meta).slice(0, 200)}`)
      return { status: 'invalid' }
    }
    if (compareVersions(currentVersion, meta.version) >= 0) {
      onLog('info', `versão atual ${currentVersion} já é a mais recente (feed: ${meta.version})`)
      return { status: 'up-to-date' }
    }
    onLog('info', `nova versão disponível: ${meta.version} (atual: ${currentVersion})`)
    const choice = await dialog.showMessageBox({
      type: 'info',
      title: 'Nova versão disponível',
      message: `IGA Gestão ${meta.version} foi publicado.`,
      detail: [
        `Versão instalada: ${currentVersion}`,
        `Versão disponível: ${meta.version}`,
        meta.notes ? '' : null,
        meta.notes ?? null,
      ].filter(Boolean).join('\n'),
      buttons: ['Baixar agora', 'Lembrar depois'],
      defaultId: 0,
      cancelId: 1,
    })
    if (choice.response === 0) {
      shell.openExternal(meta.url).catch(() => {})
    }
    return { status: 'update-available', version: meta.version }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    onLog('warn', `falha ao verificar atualização: ${msg}`)
    return { status: 'error', error: msg }
  }
}
