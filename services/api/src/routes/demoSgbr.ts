/**
 * Mock do servidor SGBR-BI da Tiete Espumas — serve fixtures determinísticas
 * para o tenant `tiete-espumas` em modo demo.
 *
 * Quando o api_url do datasource aponta para o próprio backend (em vez do servidor
 * SGBR real), o proxy chama estes endpoints e o resto do sistema funciona como se
 * fosse produção. Pra desativar: SET api_url de volta para a URL original.
 *
 * IDs hardcoded com prefixo simples. Dados gerados via seeded RNG → estáveis
 * entre reinícios. Cobre 90 dias por padrão.
 */
import { Router, type Request, type Response } from 'express'

export const demoSgbrRouter = Router()

// ── Seeded RNG (mulberry32) — determinístico ────────────────────────────────
function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── Date helpers ────────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

function fmtIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function parseSgbrDate(s: string): Date | null {
  const m = s.match(/(\d{4})[.\-/](\d{2})[.\-/](\d{2})/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function inRange(d: Date, dtDe?: string, dtAte?: string): boolean {
  if (dtDe) {
    const de = parseSgbrDate(dtDe)
    if (de && d < de) return false
  }
  if (dtAte) {
    const ate = parseSgbrDate(dtAte)
    if (ate) {
      const end = new Date(ate)
      end.setHours(23, 59, 59, 999)
      if (d > end) return false
    }
  }
  return true
}

function readDateQuery(req: Request): { dtDe?: string; dtAte?: string } {
  return {
    dtDe: typeof req.query.dt_de === 'string' ? req.query.dt_de : undefined,
    dtAte: typeof req.query.dt_ate === 'string' ? req.query.dt_ate : undefined,
  }
}

// ── Dicionários (PT-BR realistas) ───────────────────────────────────────────
const ESPUMA_DENSIDADES = ['D18', 'D20', 'D23', 'D26', 'D28', 'D33', 'D40', 'D45'] as const
const VENDEDORES = [
  { cod: 101, nome: 'Carlos Silva' },
  { cod: 102, nome: 'Ana Santos' },
  { cod: 103, nome: 'Roberto Lima' },
  { cod: 104, nome: 'Patrícia Costa' },
  { cod: 105, nome: 'Marcos Oliveira' },
] as const
const CLIENTES = [
  { cod: 5001, nome: 'Sleep Comfort Colchões Ltda', doc: '12.345.678/0001-90' },
  { cod: 5002, nome: 'Dorma Bem Indústria SA', doc: '23.456.789/0001-12' },
  { cod: 5003, nome: 'Magnífica Estofados ME', doc: '34.567.890/0001-23' },
  { cod: 5004, nome: 'Móveis Estrela do Sul', doc: '45.678.901/0001-34' },
  { cod: 5005, nome: 'Cama & Cia Distribuidora', doc: '56.789.012/0001-45' },
  { cod: 5006, nome: 'Espuma Tropical Ltda', doc: '67.890.123/0001-56' },
  { cod: 5007, nome: 'Industrial Norte Estofados', doc: '78.901.234/0001-67' },
  { cod: 5008, nome: 'Comércio Sul Distribuidora', doc: '89.012.345/0001-78' },
  { cod: 5009, nome: 'Mega Lar Mobília', doc: '90.123.456/0001-89' },
  { cod: 5010, nome: 'Conforto Total Indústria', doc: '01.234.567/0001-90' },
  { cod: 5011, nome: 'Espuma Real do Brasil', doc: '11.222.333/0001-44' },
  { cod: 5012, nome: 'Sono Premium Colchoaria', doc: '22.333.444/0001-55' },
  { cod: 5013, nome: 'Estofa Mais Ltda EPP', doc: '33.444.555/0001-66' },
  { cod: 5014, nome: 'Casa & Conforto SA', doc: '44.555.666/0001-77' },
  { cod: 5015, nome: 'Dormicasa Indústria', doc: '55.666.777/0001-88' },
] as const
const FORNECEDORES = [
  { cod: 9001, nome: 'Petroquímica Brasil SA' },
  { cod: 9002, nome: 'Polímeros Sudeste Ltda' },
  { cod: 9003, nome: 'Química Industrial Master' },
  { cod: 9004, nome: 'Aditivos Pro Indústria' },
  { cod: 9005, nome: 'Insumos Plast do Brasil' },
  { cod: 9006, nome: 'Distribuidora Química RJ' },
  { cod: 9007, nome: 'Solventes & Cia' },
] as const

// ── Estoque (catálogo completo de produtos) ─────────────────────────────────
type EstoqueItem = {
  controle: number
  produto: string
  grupo: 'MATERIA PRIMA' | 'INSUMO' | 'PRODUTO BASE' | 'PRODUTO FINAL'
  unidade: string
  qtdeatual: number
  qtdeminima: number
  precocusto: number
  precovenda: number
  ativo: string
  ultimaentrada: string
}

const ESTOQUE_BASE: ReadonlyArray<Omit<EstoqueItem, 'qtdeatual' | 'qtdeminima' | 'ultimaentrada' | 'ativo'>> = [
  // Matérias-primas
  { controle: 1001, produto: 'MDI Polimérico', grupo: 'MATERIA PRIMA', unidade: 'KG', precocusto: 18.5, precovenda: 0 },
  { controle: 1002, produto: 'Poliol Padrão Flexível', grupo: 'MATERIA PRIMA', unidade: 'KG', precocusto: 14.2, precovenda: 0 },
  { controle: 1003, produto: 'TDI Toluenodiisocianato', grupo: 'MATERIA PRIMA', unidade: 'KG', precocusto: 22.0, precovenda: 0 },
  { controle: 1004, produto: 'Poliol Polimérico Alta Resiliência', grupo: 'MATERIA PRIMA', unidade: 'KG', precocusto: 19.8, precovenda: 0 },
  { controle: 1005, produto: 'Água Desmineralizada', grupo: 'MATERIA PRIMA', unidade: 'L', precocusto: 0.5, precovenda: 0 },
  // Insumos
  { controle: 2001, produto: 'Catalisador Amina A33', grupo: 'INSUMO', unidade: 'L', precocusto: 45.0, precovenda: 0 },
  { controle: 2002, produto: 'Silicone Surfactante L-580', grupo: 'INSUMO', unidade: 'L', precocusto: 38.5, precovenda: 0 },
  { controle: 2003, produto: 'Pigmento Branco TiO2', grupo: 'INSUMO', unidade: 'KG', precocusto: 12.0, precovenda: 0 },
  { controle: 2004, produto: 'Aditivo Antichamas FR', grupo: 'INSUMO', unidade: 'KG', precocusto: 28.0, precovenda: 0 },
  { controle: 2005, produto: 'Estabilizante UV', grupo: 'INSUMO', unidade: 'KG', precocusto: 32.0, precovenda: 0 },
  // Produto Base — Espumas
  { controle: 3001, produto: 'Espuma D18 Soft', grupo: 'PRODUTO BASE', unidade: 'M3', precocusto: 110, precovenda: 0 },
  { controle: 3002, produto: 'Espuma D20 Flexível', grupo: 'PRODUTO BASE', unidade: 'M3', precocusto: 125, precovenda: 0 },
  { controle: 3003, produto: 'Espuma D23 Confort', grupo: 'PRODUTO BASE', unidade: 'M3', precocusto: 138, precovenda: 0 },
  { controle: 3004, produto: 'Espuma D26 Standard', grupo: 'PRODUTO BASE', unidade: 'M3', precocusto: 152, precovenda: 0 },
  { controle: 3005, produto: 'Espuma D28 Premium', grupo: 'PRODUTO BASE', unidade: 'M3', precocusto: 168, precovenda: 0 },
  { controle: 3006, produto: 'Espuma D33 Alta Resiliência', grupo: 'PRODUTO BASE', unidade: 'M3', precocusto: 195, precovenda: 0 },
  { controle: 3007, produto: 'Espuma D40 Firme', grupo: 'PRODUTO BASE', unidade: 'M3', precocusto: 222, precovenda: 0 },
  { controle: 3008, produto: 'Espuma D45 Extra Firme', grupo: 'PRODUTO BASE', unidade: 'M3', precocusto: 248, precovenda: 0 },
  // Produto Base — Aglomerados
  { controle: 3101, produto: 'Aglomerado AD-12 Reciclado', grupo: 'PRODUTO BASE', unidade: 'M3', precocusto: 78, precovenda: 0 },
  { controle: 3102, produto: 'Aglomerado AD-15 Standard', grupo: 'PRODUTO BASE', unidade: 'M3', precocusto: 92, precovenda: 0 },
  { controle: 3103, produto: 'Aglomerado AD-18 Premium', grupo: 'PRODUTO BASE', unidade: 'M3', precocusto: 108, precovenda: 0 },
  // Produto Final
  { controle: 4001, produto: 'Colchão Solteiro D23 0.78x1.88x0.18', grupo: 'PRODUTO FINAL', unidade: 'UN', precocusto: 145, precovenda: 289 },
  { controle: 4002, produto: 'Colchão Solteiro D28 0.78x1.88x0.20', grupo: 'PRODUTO FINAL', unidade: 'UN', precocusto: 178, precovenda: 359 },
  { controle: 4003, produto: 'Colchão Casal D23 1.38x1.88x0.18', grupo: 'PRODUTO FINAL', unidade: 'UN', precocusto: 245, precovenda: 489 },
  { controle: 4004, produto: 'Colchão Casal D28 1.38x1.88x0.22', grupo: 'PRODUTO FINAL', unidade: 'UN', precocusto: 312, precovenda: 629 },
  { controle: 4005, produto: 'Colchão Queen D28 1.58x1.98x0.24', grupo: 'PRODUTO FINAL', unidade: 'UN', precocusto: 398, precovenda: 799 },
  { controle: 4006, produto: 'Colchão King D33 1.93x2.03x0.30', grupo: 'PRODUTO FINAL', unidade: 'UN', precocusto: 612, precovenda: 1249 },
  { controle: 4007, produto: 'Travesseiro Confort 50x70 D23', grupo: 'PRODUTO FINAL', unidade: 'UN', precocusto: 18, precovenda: 45 },
  { controle: 4008, produto: 'Travesseiro Premium Cervical', grupo: 'PRODUTO FINAL', unidade: 'UN', precocusto: 32, precovenda: 89 },
  { controle: 4009, produto: 'Almofada Decorativa 40x40 D20', grupo: 'PRODUTO FINAL', unidade: 'UN', precocusto: 12, precovenda: 32 },
  { controle: 4010, produto: 'Almofada Encosto 50x50', grupo: 'PRODUTO FINAL', unidade: 'UN', precocusto: 22, precovenda: 58 },
  { controle: 4011, produto: 'Espuma Laminada 5cm — Rolo 30m', grupo: 'PRODUTO FINAL', unidade: 'RL', precocusto: 285, precovenda: 489 },
  { controle: 4012, produto: 'Espuma Laminada 10cm — Rolo 20m', grupo: 'PRODUTO FINAL', unidade: 'RL', precocusto: 410, precovenda: 698 },
  { controle: 4013, produto: 'Bloco Espuma D28 1m x 2m x 2m', grupo: 'PRODUTO FINAL', unidade: 'UN', precocusto: 672, precovenda: 1180 },
  { controle: 4014, produto: 'Bloco Espuma D33 1m x 2m x 2m', grupo: 'PRODUTO FINAL', unidade: 'UN', precocusto: 780, precovenda: 1349 },
  { controle: 4015, produto: 'Espumacolchao Box Casal Embalado', grupo: 'PRODUTO FINAL', unidade: 'UN', precocusto: 198, precovenda: 459 },
] as const

function buildEstoque(): EstoqueItem[] {
  const rng = mulberry32(42)
  return ESTOQUE_BASE.map((b) => {
    const isMpInsumo = b.grupo === 'MATERIA PRIMA' || b.grupo === 'INSUMO'
    const baseQtde = isMpInsumo ? randInt(rng, 150, 1800) : randInt(rng, 5, 60)
    const baseMin = isMpInsumo ? randInt(rng, 100, 400) : randInt(rng, 4, 12)
    // Alguns itens propositalmente abaixo do mínimo (estoque crítico → telas mostram alertas)
    const qtdeatual = rng() < 0.15 ? Math.floor(baseMin * 0.4) : baseQtde
    return {
      ...b,
      qtdeatual,
      qtdeminima: baseMin,
      ativo: 'SIM',
      ultimaentrada: fmtIso(daysAgo(randInt(rng, 1, 45))),
    }
  })
}

demoSgbrRouter.get('/estoque', (_req: Request, res: Response) => {
  res.json(buildEstoque())
})

// ── Login (qualquer credencial ok) ──────────────────────────────────────────
demoSgbrRouter.post('/usuario/login', (_req: Request, res: Response) => {
  res.json({
    token: 'demo-tiete-jwt-2026-05-12',
    user: 'iga',
    empresa: 'Tiete Espumas (DEMO)',
    expiresIn: 3600,
  })
})

// ── Produzido (com filtro de data) ─────────────────────────────────────────
demoSgbrRouter.get('/produzido', (req: Request, res: Response) => {
  const { dtDe, dtAte } = readDateQuery(req)
  const rng = mulberry32(101)
  const produtosBase = ESTOQUE_BASE.filter((p) => p.grupo === 'PRODUTO BASE' || p.grupo === 'PRODUTO FINAL')
  const rows: Record<string, unknown>[] = []
  let lote = 70000

  for (let d = 89; d >= 0; d--) {
    const data = daysAgo(d)
    // Pular fim de semana — fábrica não produz
    if (data.getDay() === 0 || data.getDay() === 6) continue
    if (!inRange(data, dtDe, dtAte)) continue
    const produzidosNoDia = randInt(rng, 1, 4)
    for (let i = 0; i < produzidosNoDia; i++) {
      const p = pick(rng, produtosBase)
      const qtde = p.grupo === 'PRODUTO BASE' ? round2(2 + rng() * 12) : randInt(rng, 8, 80)
      const componentes = p.grupo === 'PRODUTO FINAL'
        ? [
            { codprodcomp: 3005, nomeprodutocomp: 'Espuma D28 Premium', qtdeunitaria: round2(0.06 + rng() * 0.18), undcomp: 'M3' },
          ]
        : [
            { codprodcomp: 1001, nomeprodutocomp: 'MDI Polimérico', qtdeunitaria: round2(15 + rng() * 30), undcomp: 'KG' },
            { codprodcomp: 1002, nomeprodutocomp: 'Poliol Padrão Flexível', qtdeunitaria: round2(35 + rng() * 50), undcomp: 'KG' },
          ]
      rows.push({
        lote: lote++,
        codproduto: p.controle,
        produto: p.produto,
        qtdeproduzida: qtde,
        unidade: p.unidade,
        data: fmtIso(data),
        datafec: fmtIso(data),
        operador: pick(rng, ['Ana Costa', 'Carlos Mendes', 'João Pereira', 'Bruno Alves', 'Sandra Lima']),
        rendimentopct: round2(92 + rng() * 6),
        componentes,
      })
    }
  }
  res.json(rows)
})

// ── Vendas analítico ───────────────────────────────────────────────────────
demoSgbrRouter.get('/vendas/analitico', (req: Request, res: Response) => {
  const { dtDe, dtAte } = readDateQuery(req)
  const rng = mulberry32(202)
  const produtosVenda = ESTOQUE_BASE.filter((p) => p.grupo === 'PRODUTO FINAL')
  const rows: Record<string, unknown>[] = []
  let pedido = 200000

  for (let d = 89; d >= 0; d--) {
    const data = daysAgo(d)
    if (data.getDay() === 0) continue
    if (!inRange(data, dtDe, dtAte)) continue
    const vendasNoDia = randInt(rng, 0, 3)
    for (let i = 0; i < vendasNoDia; i++) {
      const p = pick(rng, produtosVenda)
      const cli = pick(rng, CLIENTES)
      const vend = pick(rng, VENDEDORES)
      const qtde = randInt(rng, 1, 12)
      const valorUnit = p.precovenda * (0.92 + rng() * 0.16)
      const total = round2(qtde * valorUnit)
      const status = rng() < 0.1 ? 'CANCELADO' : rng() < 0.15 ? 'PENDENTE' : 'FATURADO'
      rows.push({
        nrpedido: pedido++,
        datafec: fmtIso(data),
        codprod: p.controle,
        decprod: p.produto,
        qtdevendida: qtde,
        und: p.unidade,
        valorunit: round2(valorUnit),
        total,
        precocustoitem: round2(p.precocusto),
        codcliente: cli.cod,
        nomecliente: cli.nome,
        codvendedor: vend.cod,
        nomevendedor: vend.nome,
        statuspedido: status,
      })
    }
  }
  res.json(rows)
})

// ── NFe analítico ──────────────────────────────────────────────────────────
demoSgbrRouter.get('/vendanfe/analitico', (req: Request, res: Response) => {
  const { dtDe, dtAte } = readDateQuery(req)
  const rng = mulberry32(303)
  const produtosNF = ESTOQUE_BASE.filter((p) => p.grupo === 'PRODUTO FINAL')
  const rows: Record<string, unknown>[] = []
  let nrNota = 50000

  for (let d = 89; d >= 0; d--) {
    const data = daysAgo(d)
    if (data.getDay() === 0) continue
    if (!inRange(data, dtDe, dtAte)) continue
    const nfsNoDia = randInt(rng, 0, 2)
    for (let i = 0; i < nfsNoDia; i++) {
      const p = pick(rng, produtosNF)
      const cli = pick(rng, CLIENTES)
      const qtde = randInt(rng, 5, 30)
      const valor = round2(qtde * p.precovenda * (0.9 + rng() * 0.15))
      const valoricms = round2(valor * 0.18)
      rows.push({
        nrnota: nrNota++,
        serie: '1',
        datafec: fmtIso(data),
        dataemis: fmtIso(data),
        codcliente: cli.cod,
        nomecliente: cli.nome,
        cnpjcliente: cli.doc,
        codprod: p.controle,
        decprod: p.produto,
        qtdevendida: qtde,
        und: p.unidade,
        valortotal: valor,
        baseicms: valor,
        valoricms,
        cfop: '5102',
        situacao: 'AUTORIZADA',
      })
    }
  }
  res.json(rows)
})

// ── Compras ────────────────────────────────────────────────────────────────
demoSgbrRouter.get('/compras', (req: Request, res: Response) => {
  const { dtDe, dtAte } = readDateQuery(req)
  const rng = mulberry32(404)
  const mpInsumo = ESTOQUE_BASE.filter((p) => p.grupo === 'MATERIA PRIMA' || p.grupo === 'INSUMO')
  const rows: Record<string, unknown>[] = []
  let nrCompra = 80000

  for (let d = 89; d >= 0; d--) {
    const data = daysAgo(d)
    if (data.getDay() === 0 || data.getDay() === 6) continue
    if (rng() > 0.45) continue // só compra ~45% dos dias úteis
    if (!inRange(data, dtDe, dtAte)) continue
    const itens = randInt(rng, 1, 3)
    for (let i = 0; i < itens; i++) {
      const p = pick(rng, mpInsumo)
      const forn = pick(rng, FORNECEDORES)
      const qtde = randInt(rng, 50, 500)
      const valorunit = round2(p.precocusto * (0.92 + rng() * 0.16))
      const valortotal = round2(qtde * valorunit)
      rows.push({
        nrcompra: nrCompra++,
        dataemis: fmtIso(data),
        dataentrada: fmtIso(daysAgo(d - randInt(rng, 1, 5))),
        codprod: p.controle,
        nomeproduto: p.produto,
        produto: p.produto,
        qtde: qtde,
        und: p.unidade,
        valorunit,
        valortotal,
        codfornecedor: forn.cod,
        nomefornecedor: forn.nome,
        fornecedor: forn.nome,
        statuscompra: rng() < 0.85 ? 'RECEBIDO' : 'PENDENTE',
      })
    }
  }
  res.json(rows)
})

// ── Contas a receber ───────────────────────────────────────────────────────
demoSgbrRouter.get('/contas/receber', (req: Request, res: Response) => {
  const { dtDe, dtAte } = readDateQuery(req)
  const rng = mulberry32(606)
  const rows: Record<string, unknown>[] = []
  let nrTitulo = 70000

  for (let d = 89; d >= 0; d--) {
    const data = daysAgo(d)
    if (!inRange(data, dtDe, dtAte)) continue
    if (rng() > 0.3) continue
    const cli = pick(rng, CLIENTES)
    const valor = round2(1500 + rng() * 18000)
    const venceuHa = randInt(rng, -30, 45)
    const situacao = venceuHa > 0 ? (venceuHa > 14 ? 'EM_ATRASO' : 'VENCIDO') : 'EM_ABERTO'
    rows.push({
      nrtitulo: nrTitulo++,
      codcliente: cli.cod,
      cliente: cli.nome,
      nomecliente: cli.nome,
      cnpjcliente: cli.doc,
      dataemis: fmtIso(data),
      datavenc: fmtIso(daysAgo(d - 30)),
      datavencimento: fmtIso(daysAgo(d - 30)),
      valor,
      valoraberto: situacao === 'EM_ABERTO' ? valor : round2(valor * 0.4),
      situacao,
      formapagamento: pick(rng, ['BOLETO', 'PIX', 'CARTAO']),
    })
  }
  res.json(rows)
})

// ── Contas pagas ───────────────────────────────────────────────────────────
demoSgbrRouter.get('/contas/pagas', (req: Request, res: Response) => {
  const { dtDe, dtAte } = readDateQuery(req)
  const rng = mulberry32(505)
  const rows: Record<string, unknown>[] = []
  let nrTitulo = 60000

  const categorias = [
    { categoria: 'Matéria-prima', valorMed: 8000 },
    { categoria: 'Energia elétrica', valorMed: 4200 },
    { categoria: 'Folha de pagamento', valorMed: 32000 },
    { categoria: 'Impostos', valorMed: 12500 },
    { categoria: 'Aluguel', valorMed: 18500 },
    { categoria: 'Transportadora', valorMed: 5200 },
    { categoria: 'Manutenção', valorMed: 2800 },
    { categoria: 'Insumos', valorMed: 3200 },
  ] as const

  for (let d = 89; d >= 0; d--) {
    const data = daysAgo(d)
    if (!inRange(data, dtDe, dtAte)) continue
    if (rng() > 0.35) continue
    const ct = pick(rng, categorias)
    const forn = pick(rng, FORNECEDORES)
    const valor = round2(ct.valorMed * (0.85 + rng() * 0.3))
    rows.push({
      nrtitulo: nrTitulo++,
      codfornecedor: forn.cod,
      fornecedor: forn.nome,
      nomefornecedor: forn.nome,
      categoria: ct.categoria,
      datavenc: fmtIso(daysAgo(d + randInt(rng, 0, 3))),
      datapag: fmtIso(data),
      datapagamento: fmtIso(data),
      valor,
      valorpago: valor,
      situacao: 'PAGO',
      formapagamento: pick(rng, ['BOLETO', 'PIX', 'TRANSFERENCIA', 'CARTAO']),
    })
  }
  res.json(rows)
})
