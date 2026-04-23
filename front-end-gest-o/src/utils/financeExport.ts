import dayjs from 'dayjs'
import { logExportAudit } from './auditExport'

type ExportColumn = { header: string; key: string; format?: (v: unknown) => string }

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(v: string | null) {
  return v ? dayjs(v).format('DD/MM/YYYY') : '—'
}

function basename(reportName: string) {
  return `${reportName}_${dayjs().format('YYYY-MM-DD_HHmm')}`
}

/* ───────── Excel ───────── */
export async function exportExcel<T extends Record<string, unknown>>(
  rows: T[],
  columns: ExportColumn[],
  sheetName: string,
  reportName: string,
) {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  const worksheet = workbook.addWorksheet(sheetName)
  worksheet.addRow(columns.map((col) => col.header))
  for (const row of rows) {
    worksheet.addRow(
      columns.map((col) => {
        const raw = row[col.key]
        return col.format ? col.format(raw) : String(raw ?? '')
      }),
    )
  }
  worksheet.columns.forEach((col) => {
    col.width = Math.min(42, Math.max(14, Number(col.header?.toString().length ?? 14) + 4))
  })
  const bytes = await workbook.xlsx.writeBuffer()
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${basename(reportName)}.xlsx`
  link.click()
  URL.revokeObjectURL(url)

  logExportAudit({ reportName: `${reportName}:${sheetName}`, format: 'excel', rowCount: rows.length })
}

/* ───────── PDF ───────── */
export async function exportPdf<T extends Record<string, unknown>>(
  rows: T[],
  columns: ExportColumn[],
  title: string,
  reportName: string,
) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text(title, 14, 14)
  doc.setFontSize(9)
  doc.text(`Gerado em ${dayjs().format('DD/MM/YYYY HH:mm')}`, 14, 20)

  autoTable(doc, {
    startY: 26,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) =>
      columns.map((col) => {
        const raw = row[col.key]
        return col.format ? col.format(raw) : String(raw ?? '')
      }),
    ),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [26, 122, 181] },
  })

  doc.save(`${basename(reportName)}.pdf`)
  logExportAudit({ reportName, format: 'pdf', rowCount: rows.length })
}

/* ───────── Definições de colunas por relatório ───────── */

export const conciliacaoCols: ExportColumn[] = [
  { header: 'ID', key: 'id' },
  { header: 'Cliente', key: 'cliente' },
  { header: 'Data Venda', key: 'dataVenda', format: (v) => formatDate(v as string) },
  { header: 'Valor Venda', key: 'valorVenda', format: (v) => formatBRL(v as number) },
  { header: 'Data Pagamento', key: 'dataPagamento', format: (v) => formatDate(v as string | null) },
  { header: 'Valor Pago', key: 'valorPago', format: (v) => formatBRL(v as number) },
  { header: 'Diferença', key: 'diferenca', format: (v) => formatBRL(v as number) },
  { header: 'Status', key: 'status' },
]

export const contasPagarCols: ExportColumn[] = [
  { header: 'ID', key: 'id' },
  { header: 'Fornecedor', key: 'fornecedor' },
  { header: 'Descrição', key: 'descricao' },
  { header: 'Categoria', key: 'categoria' },
  { header: 'Valor', key: 'valor', format: (v) => formatBRL(v as number) },
  { header: 'Vencimento', key: 'dataVencimento', format: (v) => formatDate(v as string) },
  { header: 'Pagamento', key: 'dataPagamento', format: (v) => formatDate(v as string | null) },
  { header: 'Status', key: 'status' },
]

export const contasReceberCols: ExportColumn[] = [
  { header: 'ID', key: 'id' },
  { header: 'Cliente', key: 'cliente' },
  { header: 'Descrição', key: 'descricao' },
  { header: 'Valor', key: 'valor', format: (v) => formatBRL(v as number) },
  { header: 'Emissão', key: 'dataEmissao', format: (v) => formatDate(v as string) },
  { header: 'Vencimento', key: 'dataVencimento', format: (v) => formatDate(v as string) },
  { header: 'Recebimento', key: 'dataRecebimento', format: (v) => formatDate(v as string | null) },
  { header: 'Status', key: 'status' },
]

export const estoqueMateriaPrimaCols: ExportColumn[] = [
  { header: 'ID', key: 'id' },
  { header: 'Material', key: 'material' },
  { header: 'Unidade', key: 'unidade' },
  { header: 'Qtde Atual', key: 'qtdeAtual' },
  { header: 'Qtde Mínima', key: 'qtdeMinima' },
  { header: 'Custo Unit.', key: 'custoUnitario', format: (v) => formatBRL(v as number) },
  { header: 'Custo Total', key: 'custoTotal', format: (v) => formatBRL(v as number) },
  { header: 'Última Entrada', key: 'ultimaEntrada', format: (v) => formatDate(v as string) },
  { header: 'Fornecedor', key: 'fornecedor' },
  { header: 'Status', key: 'status' },
]

export const estoqueEspumaCols: ExportColumn[] = [
  { header: 'ID', key: 'id' },
  { header: 'Produto', key: 'produto' },
  { header: 'Tipo', key: 'tipo' },
  { header: 'Densidade', key: 'densidade' },
  { header: 'Unidade', key: 'unidade' },
  { header: 'Qtde Atual', key: 'qtdeAtual' },
  { header: 'Qtde Mínima', key: 'qtdeMinima' },
  { header: 'Custo Unit.', key: 'custoUnitario', format: (v) => formatBRL(v as number) },
  { header: 'Custo Total', key: 'custoTotal', format: (v) => formatBRL(v as number) },
  { header: 'Última Entrada', key: 'ultimaEntrada', format: (v) => formatDate(v as string) },
  { header: 'Status', key: 'status' },
]

export const estoqueProdutoFinalCols: ExportColumn[] = [
  { header: 'ID', key: 'id' },
  { header: 'Produto', key: 'produto' },
  { header: 'Tipo', key: 'tipo' },
  { header: 'Densidade', key: 'densidade' },
  { header: 'Dimensões', key: 'dimensoes' },
  { header: 'Unidade', key: 'unidade' },
  { header: 'Qtde Atual', key: 'qtdeAtual' },
  { header: 'Qtde Mínima', key: 'qtdeMinima' },
  { header: 'Custo Unit.', key: 'custoUnitario', format: (v) => formatBRL(v as number) },
  { header: 'Preço Venda', key: 'precoVenda', format: (v) => formatBRL(v as number) },
  { header: 'Custo Total', key: 'custoTotal', format: (v) => formatBRL(v as number) },
  { header: 'Última Entrada', key: 'ultimaEntrada', format: (v) => formatDate(v as string) },
  { header: 'Status', key: 'status' },
]

export const vendasEspumaCols: ExportColumn[] = [
  { header: 'ID', key: 'id' },
  { header: 'Data', key: 'data', format: (v) => formatDate(v as string) },
  { header: 'Cliente', key: 'cliente' },
  { header: 'Produto', key: 'produto' },
  { header: 'Tipo', key: 'tipo' },
  { header: 'Qtde', key: 'qtde' },
  { header: 'Preço Unit.', key: 'precoUnitario', format: (v) => formatBRL(v as number) },
  { header: 'Total', key: 'total', format: (v) => formatBRL(v as number) },
  { header: 'Pagamento', key: 'formaPagamento' },
]
