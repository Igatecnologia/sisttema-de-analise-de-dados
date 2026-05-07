import { GenericConnector } from './genericConnector.js'
import { SgbrEspumaConnector } from './sgbrEspumaConnector.js'
import { BlingConnector, CsvConnector, OmieConnector, TinyConnector } from './csvConnector.js'
import type { IndustryConnector } from './industryConnector.js'

const connectors = new Map<string, IndustryConnector>()

for (const connector of [
  new GenericConnector(),
  new SgbrEspumaConnector(),
  new CsvConnector(),
  new BlingConnector(),
  new TinyConnector(),
  new OmieConnector(),
]) {
  connectors.set(connector.id, connector)
}

export const ConnectorRegistry = {
  get(id?: string | null): IndustryConnector {
    return connectors.get(id ?? '') ?? connectors.get('generic')!
  },
  list(): IndustryConnector[] {
    return [...connectors.values()]
  },
}

