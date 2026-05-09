/**
 * k6 baseline load test — IGA Gestao backend
 *
 * Cenario:
 *  - 50 VUs concorrentes por 1 minuto
 *  - 3 endpoints publicos / leves (healthcheck, segments, plans)
 *  - Verifica p(95) < 500ms e error rate < 1%
 *
 * Como rodar (precisa do binario k6 — https://k6.io/docs/getting-started/installation/):
 *
 *   k6 run tests/load/baseline.js
 *
 * Variaveis:
 *   BASE_URL  — backend a testar (default: http://localhost:3001)
 *   STAGE     — "smoke" | "load" | "spike" (default: smoke)
 *
 * Exemplos:
 *   BASE_URL=https://api-staging.igagestao.com.br k6 run tests/load/baseline.js
 *   STAGE=load k6 run tests/load/baseline.js
 *
 * NAO rodar contra producao com VUs >= 50 sem aviso ao time SRE.
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const STAGE = __ENV.STAGE || 'smoke';

const STAGE_PROFILES = {
  smoke: { stages: [{ duration: '30s', target: 5 }, { duration: '30s', target: 0 }] },
  load: { stages: [{ duration: '30s', target: 50 }, { duration: '1m', target: 50 }, { duration: '30s', target: 0 }] },
  spike: { stages: [{ duration: '10s', target: 200 }, { duration: '20s', target: 0 }] },
};

const profile = STAGE_PROFILES[STAGE] ?? STAGE_PROFILES.smoke;

export const options = {
  stages: profile.stages,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
  },
};

export default function () {
  group('healthcheck', () => {
    const res = http.get(`${BASE_URL}/api/v1/health`);
    check(res, {
      'status 200': (r) => r.status === 200,
      'body has ok': (r) => r.body.includes('ok'),
    });
  });

  group('public segments', () => {
    const res = http.get(`${BASE_URL}/api/v1/auth/segments`);
    check(res, {
      'status 200': (r) => r.status === 200,
      'returns array': (r) => Array.isArray(JSON.parse(r.body || '[]')),
    });
  });

  group('public plans', () => {
    const res = http.get(`${BASE_URL}/api/v1/billing/plans`);
    check(res, {
      'status 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}
