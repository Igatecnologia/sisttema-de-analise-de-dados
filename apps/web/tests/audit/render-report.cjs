#!/usr/bin/env node
/**
 * Le o results.json gerado pelo full-audit.spec.ts e renderiza um HTML
 * interativo (sem dependencias) em report.html no mesmo diretorio.
 *
 * Uso:
 *   node tests/audit/render-report.cjs [pathToResultsJsonOrRunDir]
 *
 * Se nenhum arg for passado, pega o run-* mais recente em audit-results/.
 */
const { readFileSync, writeFileSync, readdirSync, statSync, existsSync } = require('node:fs')
const { join, resolve, dirname } = require('node:path')

function resolveRunDir(arg) {
  if (arg && existsSync(arg)) {
    const st = statSync(arg)
    if (st.isDirectory()) return arg
    return dirname(arg)
  }
  const base = resolve(__dirname, '../../audit-results')
  if (!existsSync(base)) throw new Error(`Diretorio nao encontrado: ${base}`)
  const runs = readdirSync(base).filter((f) => f.startsWith('run-')).sort().reverse()
  if (runs.length === 0) throw new Error('Nenhum run-* encontrado em audit-results/')
  return join(base, runs[0])
}

function fmtMs(v) {
  if (v == null) return '—'
  return `${Math.round(v)}ms`
}

function fmtCls(v) {
  if (v == null) return '—'
  return v.toFixed(3)
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
}

function statusBadge(s) {
  const colors = { ok: '#22c55e', warn: '#eab308', error: '#ef4444' }
  return `<span class="badge" style="background:${colors[s] || '#888'};color:#0a0e14">${s.toUpperCase()}</span>`
}

function impactBadge(impact) {
  const colors = { critical: '#ef4444', serious: '#f97316', moderate: '#eab308', minor: '#94a3b8' }
  return `<span class="impact" style="background:${colors[impact] || '#666'};color:#0a0e14">${escape(impact || 'n/a')}</span>`
}

function renderRoute(r, i) {
  const errs = r.consoleErrors.length + r.pageErrors.length
  const netFails = r.networkFailures.length
  const a11yCount = r.a11y.violations.length
  const lcp = r.perf.lcpMs
  const lcpClass = lcp == null ? '' : lcp > 2500 ? 'bad' : lcp > 1500 ? 'warn' : 'good'
  const ttfb = r.perf.ttfbMs

  return `
  <article class="card" data-status="${r.status}" data-app="${r.app}" id="r-${i}">
    <header>
      <div class="title">${statusBadge(r.status)} <span class="app-tag app-${r.app}">${r.app}</span> <strong>${escape(r.label)}</strong></div>
      <div class="path">${escape(r.path)}</div>
    </header>
    <div class="body">
      <div class="thumb">
        <a href="${escape(r.screenshot)}" target="_blank" rel="noopener">
          <img loading="lazy" src="${escape(r.screenshot)}" alt="screenshot de ${escape(r.label)}" />
        </a>
      </div>
      <div class="meta">
        <div class="metrics">
          <div class="metric ${lcpClass}"><span>LCP</span><strong>${fmtMs(lcp)}</strong></div>
          <div class="metric"><span>TTFB</span><strong>${fmtMs(ttfb)}</strong></div>
          <div class="metric"><span>DCL</span><strong>${fmtMs(r.perf.domContentLoadedMs)}</strong></div>
          <div class="metric"><span>Load</span><strong>${fmtMs(r.perf.loadEventMs)}</strong></div>
          <div class="metric"><span>CLS</span><strong>${fmtCls(r.perf.cls)}</strong></div>
          <div class="metric"><span>Dur</span><strong>${fmtMs(r.durationMs)}</strong></div>
        </div>

        <div class="findings">
          <div class="finding"><span class="k">Console errors</span><span class="v ${errs ? 'bad' : 'good'}">${errs}</span></div>
          <div class="finding"><span class="k">Network failures</span><span class="v ${netFails ? 'warn' : 'good'}">${netFails}</span></div>
          <div class="finding"><span class="k">A11y violations</span><span class="v ${a11yCount ? 'warn' : 'good'}">${a11yCount}</span></div>
          <div class="finding"><span class="k">A11y passes</span><span class="v good">${r.a11y.passes}</span></div>
        </div>

        ${r.pageError ? `<div class="block error-block"><h4>Erro de pagina</h4><pre>${escape(r.pageError)}</pre></div>` : ''}

        ${r.consoleErrors.length ? `
        <details ${errs ? 'open' : ''}>
          <summary>Console errors (${r.consoleErrors.length})</summary>
          <ul class="logs">${r.consoleErrors.map((e) => `<li>${escape(e)}</li>`).join('')}</ul>
        </details>` : ''}

        ${r.consoleWarnings.length ? `
        <details>
          <summary>Console warnings (${r.consoleWarnings.length})</summary>
          <ul class="logs">${r.consoleWarnings.map((e) => `<li>${escape(e)}</li>`).join('')}</ul>
        </details>` : ''}

        ${r.networkFailures.length ? `
        <details>
          <summary>Network failures (${r.networkFailures.length})</summary>
          <table class="logs"><thead><tr><th>Status</th><th>URL</th></tr></thead><tbody>
          ${r.networkFailures.map((n) => `<tr><td>${n.status || n.statusText}</td><td class="url">${escape(n.url)}</td></tr>`).join('')}
          </tbody></table>
        </details>` : ''}

        ${r.a11y.violations.length ? `
        <details>
          <summary>A11y violations (${r.a11y.violations.length})</summary>
          <table class="logs"><thead><tr><th>Impacto</th><th>Regra</th><th>Nos</th><th>Help</th></tr></thead><tbody>
          ${r.a11y.violations.map((v) => `<tr><td>${impactBadge(v.impact)}</td><td><code>${escape(v.id)}</code></td><td>${v.nodes}</td><td>${escape(v.help)}</td></tr>`).join('')}
          </tbody></table>
        </details>` : ''}
      </div>
    </div>
  </article>`
}

function renderHtml(data) {
  const t = data.totals
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Audit IGA — ${escape(data.generatedAt)}</title>
<style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; background: #0a0e14; color: #e6edf3; }
header.top { padding: 24px 32px; background: linear-gradient(180deg, #161b22, #0a0e14); border-bottom: 1px solid #30363d; position: sticky; top: 0; z-index: 10; }
header.top h1 { margin: 0 0 4px; font-size: 22px; }
header.top .sub { color: #8b949e; font-size: 13px; }
.totals { display: flex; gap: 16px; margin-top: 12px; flex-wrap: wrap; }
.tot { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 10px 16px; min-width: 110px; }
.tot strong { display: block; font-size: 20px; }
.tot.ok strong { color: #22c55e; } .tot.warn strong { color: #eab308; } .tot.err strong { color: #ef4444; }
.controls { margin-top: 16px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.controls label { display: inline-flex; gap: 6px; align-items: center; padding: 6px 12px; background: #161b22; border: 1px solid #30363d; border-radius: 999px; cursor: pointer; font-size: 12px; }
.controls input[type="search"] { padding: 8px 12px; background: #161b22; border: 1px solid #30363d; color: inherit; border-radius: 8px; min-width: 280px; }
main { padding: 24px 32px; display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(640px, 1fr)); }
.card { background: #0d1117; border: 1px solid #30363d; border-radius: 12px; overflow: hidden; }
.card[data-status="error"] { border-color: #ef4444; }
.card[data-status="warn"] { border-color: #eab308; }
.card[data-status="ok"] { border-color: #22c55e44; }
.card header { padding: 14px 16px; background: #161b22; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.card .title { display: flex; align-items: center; gap: 8px; }
.card .path { font-family: ui-monospace, "SF Mono", Consolas, monospace; color: #8b949e; font-size: 12px; }
.badge { padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; }
.app-tag { padding: 2px 8px; border-radius: 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
.app-web { background: #1f6feb; color: #fff; }
.app-admin { background: #db61a2; color: #fff; }
.app-landing { background: #2da44e; color: #fff; }
.impact { padding: 1px 6px; border-radius: 3px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
.body { display: grid; grid-template-columns: 280px 1fr; gap: 16px; padding: 16px; }
.thumb img { width: 100%; height: auto; border: 1px solid #30363d; border-radius: 6px; }
.metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
.metric { background: #161b22; border: 1px solid #30363d; padding: 8px 10px; border-radius: 6px; text-align: center; }
.metric span { display: block; color: #8b949e; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; }
.metric strong { font-size: 14px; }
.metric.bad strong { color: #ef4444; }
.metric.warn strong { color: #eab308; }
.metric.good strong { color: #22c55e; }
.findings { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 12px; }
.finding { display: flex; justify-content: space-between; background: #161b22; border: 1px solid #30363d; padding: 6px 10px; border-radius: 6px; font-size: 12px; }
.finding .k { color: #8b949e; }
.finding .v.bad { color: #ef4444; font-weight: 600; }
.finding .v.warn { color: #eab308; font-weight: 600; }
.finding .v.good { color: #22c55e; }
details { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 8px 12px; margin-bottom: 6px; }
details > summary { cursor: pointer; font-size: 12px; font-weight: 600; }
.logs { font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 11px; color: #c9d1d9; margin: 8px 0 0; padding-left: 20px; max-height: 200px; overflow: auto; }
.logs li { margin: 2px 0; word-break: break-word; }
table.logs { padding: 0; width: 100%; border-collapse: collapse; }
table.logs th, table.logs td { padding: 4px 6px; border-bottom: 1px solid #30363d; text-align: left; vertical-align: top; }
.url { word-break: break-all; }
.error-block { padding: 8px 12px; background: #2d0d0d; border: 1px solid #ef4444; border-radius: 6px; margin-bottom: 12px; }
.error-block h4 { margin: 0 0 6px; color: #ef4444; font-size: 12px; }
.error-block pre { margin: 0; white-space: pre-wrap; font-size: 11px; }
@media (max-width: 800px) { .body { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<header class="top">
  <h1>Auditoria de telas — IGA Gestao</h1>
  <div class="sub">Gerado em ${escape(data.generatedAt)} · API ${escape(data.apiBase)}</div>
  <div class="totals">
    <div class="tot"><span>Rotas</span><strong>${t.routes}</strong></div>
    <div class="tot ok"><span>OK</span><strong>${t.ok}</strong></div>
    <div class="tot warn"><span>Warn</span><strong>${t.warn}</strong></div>
    <div class="tot err"><span>Error</span><strong>${t.error}</strong></div>
  </div>
  <div class="controls">
    <input id="q" type="search" placeholder="Filtrar por rota ou label..." aria-label="Buscar">
    <label><input type="checkbox" value="ok" checked> ok</label>
    <label><input type="checkbox" value="warn" checked> warn</label>
    <label><input type="checkbox" value="error" checked> error</label>
    <span style="border-left:1px solid #30363d;height:18px;margin:0 4px"></span>
    <label><input type="checkbox" value="web" checked> web</label>
    <label><input type="checkbox" value="admin" checked> admin</label>
    <label><input type="checkbox" value="landing" checked> landing</label>
  </div>
</header>
<main id="grid">
${data.results.map(renderRoute).join('\n')}
</main>
<script>
(function() {
  var grid = document.getElementById('grid');
  var q = document.getElementById('q');
  var checks = document.querySelectorAll('.controls input[type="checkbox"]');
  function apply() {
    var term = (q.value || '').toLowerCase();
    var statusOn = {}, appOn = {};
    checks.forEach(function(c) {
      if (['ok','warn','error'].indexOf(c.value) >= 0) statusOn[c.value] = c.checked;
      else appOn[c.value] = c.checked;
    });
    Array.prototype.forEach.call(grid.children, function(card) {
      var st = card.getAttribute('data-status');
      var ap = card.getAttribute('data-app');
      var text = card.textContent.toLowerCase();
      var show = statusOn[st] && appOn[ap] && (term === '' || text.indexOf(term) >= 0);
      card.style.display = show ? '' : 'none';
    });
  }
  q.addEventListener('input', apply);
  checks.forEach(function(c) { c.addEventListener('change', apply); });
})();
</script>
</body>
</html>`
}

function main() {
  const arg = process.argv[2]
  const runDir = resolveRunDir(arg)
  const resultsPath = join(runDir, 'results.json')
  if (!existsSync(resultsPath)) throw new Error(`results.json nao encontrado em ${runDir}`)
  const data = JSON.parse(readFileSync(resultsPath, 'utf-8'))
  const html = renderHtml(data)
  const out = join(runDir, 'report.html')
  writeFileSync(out, html, 'utf-8')
  console.log(`[audit] Relatorio HTML: ${out}`)
}

main()
