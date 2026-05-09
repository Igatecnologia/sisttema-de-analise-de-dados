import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDataDir } from '../paths.js'
import { BUSINESS_SEGMENTS, type BusinessSegment, isBusinessSegment } from '../segments.js'
import { GenericConnector } from './genericConnector.js'
import { SgbrEspumaConnector } from './sgbrEspumaConnector.js'
import { BlingConnector, CsvConnector, OmieConnector, TinyConnector } from './csvConnector.js'
import { IgaCustomApiConnector } from './customApiConnector.js'
import type { ConnectorArea, IndustryConnector, WarmTarget } from './industryConnector.js'

type ExternalConnectorConfig = {
  id: string
  name: string
  cspConnectSrc?: string[]
  segments?: BusinessSegment[]
  areaHints?: Partial<Record<ConnectorArea, string[]>>
  warmTargets?: WarmTarget[]
}

class ExternalConnector extends GenericConnector {
  constructor(config: ExternalConnectorConfig) {
    super()
    this.id = config.id
    this.name = config.name
    this.cspConnectSrc = config.cspConnectSrc ?? []
    /** Segmentos do JSON externo são validados; default cobre todos. */
    this.segments = (config.segments ?? BUSINESS_SEGMENTS).filter((s): s is BusinessSegment => isBusinessSegment(s))
    if (this.segments.length === 0) this.segments = [...BUSINESS_SEGMENTS]
    this.areaHints = { ...this.areaHints, ...(config.areaHints ?? {}) }
    this.warmTargets = config.warmTargets ?? []
  }
}

const builtinConnectors: IndustryConnector[] = [
  new GenericConnector(),
  new SgbrEspumaConnector(),
  new IgaCustomApiConnector(),
  new CsvConnector(),
  new BlingConnector(),
  new TinyConnector(),
  new OmieConnector(),
]

let connectors = new Map<string, IndustryConnector>()
let externalConnectorCount = 0

function readExternalConnectors(): IndustryConnector[] {
  const dir = process.env.IGA_CONNECTORS_DIR?.trim() || join(resolveDataDir(), 'connectors')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const raw = JSON.parse(readFileSync(join(dir, file), 'utf8')) as ExternalConnectorConfig
      if (!raw.id || !raw.name) throw new Error(`Connector externo invalido: ${file}`)
      return new ExternalConnector(raw)
    })
}

function loadConnectors() {
  const next = new Map<string, IndustryConnector>()
  for (const connector of builtinConnectors) next.set(connector.id, connector)
  const external = readExternalConnectors()
  for (const connector of external) next.set(connector.id, connector)
  connectors = next
  externalConnectorCount = external.length
}

loadConnectors()

export const ConnectorRegistry = {
  get(id?: string | null): IndustryConnector {
    return connectors.get(id ?? '') ?? connectors.get('generic')!
  },
  list(): IndustryConnector[] {
    return [...connectors.values()]
  },
  /** Lista connectors compatíveis com um segmento — usado pelo onboarding/UI. */
  listBySegment(segment: BusinessSegment): IndustryConnector[] {
    return [...connectors.values()].filter((c) => c.segments.includes(segment))
  },
  reload(): { total: number; external: number } {
    loadConnectors()
    return { total: connectors.size, external: externalConnectorCount }
  },
}
