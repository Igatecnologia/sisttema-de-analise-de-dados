import { Alert, Button, Input, Modal, Space, Table, Tag, Typography, Upload, message } from 'antd'
import type { UploadProps } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import { FileSpreadsheet, Trash2, Upload as UploadIcon } from 'lucide-react'
import Papa from 'papaparse'
import { useState } from 'react'
import { uploadCsvDataset, formatBytes, type CsvDatasetSummary } from '../services/csvDatasetsService'

const MAX_PREVIEW_ROWS = 8
const MAX_BYTES = 10 * 1024 * 1024

type ParsedCsv = {
  filename: string
  columns: string[]
  rows: Array<Array<string | number | boolean | null>>
  sizeBytes: number
  totalRows: number
}

type Props = {
  open: boolean
  onClose: () => void
  onUploaded?: (dataset: CsvDatasetSummary) => void
}

export function CsvUploadModal({ open, onClose, onUploaded }: Props) {
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [parsing, setParsing] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setParsed(null)
    setName('')
    setError(null)
    setParsing(false)
    setSaving(false)
  }

  function close() {
    reset()
    onClose()
  }

  function handleFile(file: File) {
    setError(null)
    if (file.size > MAX_BYTES) {
      setError(`Arquivo excede ${MAX_BYTES / 1024 / 1024}MB`)
      return false
    }
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      setError('Apenas arquivos .csv são aceitos')
      return false
    }
    setParsing(true)
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: true,
      complete: (result) => {
        const fields = result.meta.fields ?? []
        if (fields.length === 0) {
          setError('Cabeçalho não encontrado. Garanta que a primeira linha tenha os nomes das colunas.')
          setParsing(false)
          return
        }
        const rows = result.data.map((row) =>
          fields.map((f) => {
            const v = row[f]
            if (v === undefined || v === null) return null
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
            return String(v)
          }),
        )
        setParsed({
          filename: file.name,
          columns: fields,
          rows,
          sizeBytes: file.size,
          totalRows: rows.length,
        })
        if (!name) setName(file.name.replace(/\.csv$/i, ''))
        setParsing(false)
      },
      error: (err) => {
        setError(`Falha ao ler CSV: ${err.message}`)
        setParsing(false)
      },
    })
    return false
  }

  async function save() {
    if (!parsed) return
    if (!name.trim()) {
      message.error('Dê um nome ao dataset')
      return
    }
    setSaving(true)
    try {
      const result = await uploadCsvDataset({
        name: name.trim(),
        filename: parsed.filename,
        columns: parsed.columns,
        rows: parsed.rows,
      })
      message.success(`CSV importado — ${result.rowCount.toLocaleString('pt-BR')} linhas`)
      onUploaded?.(result)
      close()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e.response?.data?.message ?? 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const dragger: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.csv,text/csv',
    showUploadList: false,
    beforeUpload: (file) => {
      handleFile(file)
      return false
    },
  }

  return (
    <Modal
      open={open}
      title={
        <Space>
          <FileSpreadsheet size={18} color="var(--qc-primary)" />
          <span>Importar CSV</span>
        </Space>
      }
      width={760}
      onCancel={close}
      footer={null}
      destroyOnClose
    >
      {!parsed ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Suba um arquivo <Typography.Text code>.csv</Typography.Text> com cabeçalho na primeira linha.
            Tamanho máximo: 10 MB. Codificação UTF-8 recomendada.
          </Typography.Paragraph>

          <Upload.Dragger {...dragger} disabled={parsing} style={{ padding: 16 }}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: 'var(--qc-primary)', fontSize: 56 }} />
            </p>
            <p className="ant-upload-text" style={{ fontWeight: 600 }}>
              Clique ou arraste um arquivo CSV
            </p>
            <p className="ant-upload-hint" style={{ fontSize: 13, color: 'var(--qc-text-muted)' }}>
              Cabeçalho com nomes das colunas + uma linha por registro
            </p>
          </Upload.Dragger>

          {error ? <Alert type="error" showIcon message={error} /> : null}

          <div
            style={{
              padding: 12,
              background: 'var(--qc-surface)',
              borderRadius: 8,
              border: '1px solid var(--qc-border-subtle)',
              fontSize: 12,
              color: 'var(--qc-text-muted)',
            }}
          >
            <Typography.Text strong style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>
              Exemplo de CSV válido:
            </Typography.Text>
            <pre style={{ margin: 0, fontSize: 11, fontFamily: 'monospace' }}>
{`data,produto,quantidade,valor
2026-01-15,Espuma D33,12,2400.50
2026-01-16,Espuma D26,8,1600.00`}
            </pre>
          </div>
        </Space>
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div
            style={{
              padding: 16,
              background: 'linear-gradient(135deg, rgba(82,196,26,0.08), rgba(82,196,26,0.02))',
              borderRadius: 12,
              border: '1px solid rgba(82,196,26,0.2)',
            }}
          >
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <FileSpreadsheet size={20} color="var(--qc-success)" />
                <Space direction="vertical" size={0}>
                  <Typography.Text strong>{parsed.filename}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {parsed.totalRows.toLocaleString('pt-BR')} linhas · {parsed.columns.length} colunas · {formatBytes(parsed.sizeBytes)}
                  </Typography.Text>
                </Space>
              </Space>
              <Button size="small" icon={<Trash2 size={14} />} onClick={reset}>
                Trocar arquivo
              </Button>
            </Space>
          </div>

          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            <Typography.Text strong>Nome do dataset</Typography.Text>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Vendas Janeiro 2026"
              maxLength={160}
              size="large"
            />
          </Space>

          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            <Typography.Text strong>Prévia das colunas detectadas</Typography.Text>
            <Space wrap size={4}>
              {parsed.columns.map((col) => (
                <Tag key={col} color="blue">
                  {col}
                </Tag>
              ))}
            </Space>
          </Space>

          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            <Typography.Text strong>Prévia dos dados (primeiras {Math.min(MAX_PREVIEW_ROWS, parsed.rows.length)} linhas)</Typography.Text>
            <Table
              size="small"
              pagination={false}
              scroll={{ x: 'max-content', y: 240 }}
              columns={parsed.columns.map((col, i) => ({
                title: col,
                dataIndex: i,
                key: col,
                render: (v: unknown) => {
                  if (v === null || v === undefined || v === '') return <span style={{ color: 'var(--qc-text-muted)' }}>—</span>
                  return String(v)
                },
              }))}
              dataSource={parsed.rows.slice(0, MAX_PREVIEW_ROWS).map((row, idx) => ({
                key: idx,
                ...Object.fromEntries(row.map((v, i) => [i, v])),
              }))}
            />
          </Space>

          {error ? <Alert type="error" showIcon message={error} /> : null}

          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={close}>Cancelar</Button>
            <Button type="primary" loading={saving} onClick={save} icon={<UploadIcon size={14} />}>
              Importar {parsed.totalRows.toLocaleString('pt-BR')} linhas
            </Button>
          </Space>
        </Space>
      )}
    </Modal>
  )
}
