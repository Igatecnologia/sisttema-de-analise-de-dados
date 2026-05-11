import { Button, Card, Col, Drawer, Popconfirm, Row, Skeleton, Space, Table, Tag, Typography, message } from 'antd'
import { Database, FileSpreadsheet, Plus, Table as TableIcon, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  deleteCsvDataset,
  formatBytes,
  getCsvDataset,
  listCsvDatasets,
  type CsvDatasetDetail,
  type CsvDatasetSummary,
} from '../services/csvDatasetsService'
import { CsvUploadModal } from './CsvUploadModal'

export function CsvDatasetsSection() {
  const [datasets, setDatasets] = useState<CsvDatasetSummary[] | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [previewing, setPreviewing] = useState<CsvDatasetDetail | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  async function load() {
    try {
      setDatasets(await listCsvDatasets())
    } catch {
      setDatasets([])
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function openPreview(id: string) {
    setPreviewing(null)
    setPreviewLoading(true)
    try {
      const detail = await getCsvDataset(id, { limit: 200 })
      setPreviewing(detail)
    } catch {
      message.error('Falha ao carregar prévia')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function remove(id: string) {
    try {
      await deleteCsvDataset(id)
      message.success('CSV removido')
      void load()
    } catch {
      message.error('Falha ao remover')
    }
  }

  return (
    <>
      <Card
        styles={{ body: { padding: 20 } }}
        style={{
          borderRadius: 16,
          border: '1px solid var(--qc-border-subtle)',
          background: 'linear-gradient(135deg, rgba(22,119,255,0.04) 0%, transparent 60%)',
        }}
      >
        <Row align="middle" justify="space-between" gutter={[16, 12]} style={{ marginBottom: datasets && datasets.length > 0 ? 20 : 0 }}>
          <Col>
            <Space size={12}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, var(--qc-primary), color-mix(in srgb, var(--qc-primary) 60%, #06b6d4))',
                  color: '#fff',
                }}
              >
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <Typography.Title level={5} style={{ margin: 0 }}>
                  Importar CSV
                </Typography.Title>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  Suba planilhas exportadas de qualquer ERP — sem precisar de API.
                </Typography.Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Button type="primary" icon={<Plus size={14} />} onClick={() => setUploadOpen(true)}>
              Novo CSV
            </Button>
          </Col>
        </Row>

        {datasets === null ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : datasets.length === 0 ? null : (
          <Row gutter={[12, 12]}>
            {datasets.map((ds) => (
              <Col key={ds.id} xs={24} sm={12} lg={8}>
                <DatasetCard dataset={ds} onPreview={() => openPreview(ds.id)} onRemove={() => remove(ds.id)} />
              </Col>
            ))}
          </Row>
        )}
      </Card>

      <CsvUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => void load()}
      />

      <Drawer
        open={!!previewing || previewLoading}
        title={
          previewing ? (
            <Space>
              <FileSpreadsheet size={16} color="var(--qc-primary)" />
              <span>{previewing.name}</span>
              <Tag>{previewing.rowCount.toLocaleString('pt-BR')} linhas</Tag>
            </Space>
          ) : (
            'Carregando…'
          )
        }
        size={Math.min(1100, typeof window !== 'undefined' ? window.innerWidth - 80 : 1100)}
        onClose={() => setPreviewing(null)}
      >
        {previewLoading || !previewing ? (
          <Skeleton active />
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space size={16} wrap>
              <Typography.Text type="secondary">
                {previewing.filename} · {formatBytes(previewing.sizeBytes)} · {previewing.columns.length} colunas
              </Typography.Text>
            </Space>
            <Table
              size="small"
              scroll={{ x: 'max-content', y: 'calc(100vh - 260px)' }}
              pagination={{ pageSize: 50 }}
              columns={previewing.columns.map((col, i) => ({
                title: col,
                dataIndex: i,
                key: col,
                render: (v: unknown) => {
                  if (v === null || v === undefined || v === '') return <span style={{ color: 'var(--qc-text-muted)' }}>—</span>
                  return String(v)
                },
              }))}
              dataSource={previewing.rows.map((row, idx) => ({
                key: idx,
                ...Object.fromEntries(row.map((v, i) => [i, v])),
              }))}
              footer={() =>
                previewing.hasMore ? (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Mostrando primeiras {previewing.rows.length.toLocaleString('pt-BR')} linhas. O dataset tem {previewing.rowCount.toLocaleString('pt-BR')} no total.
                  </Typography.Text>
                ) : null
              }
            />
          </Space>
        )}
      </Drawer>
    </>
  )
}

function DatasetCard({
  dataset,
  onPreview,
  onRemove,
}: {
  dataset: CsvDatasetSummary
  onPreview: () => void
  onRemove: () => void
}) {
  return (
    <div
      style={{
        padding: 16,
        background: 'var(--qc-surface)',
        border: '1px solid var(--qc-border-subtle)',
        borderRadius: 12,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'all 120ms ease',
      }}
    >
      <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Space>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(22,119,255,0.1)',
              color: 'var(--qc-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Database size={18} />
          </div>
          <Space direction="vertical" size={0}>
            <Typography.Text strong ellipsis style={{ maxWidth: 200 }}>
              {dataset.name}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {dataset.filename}
            </Typography.Text>
          </Space>
        </Space>
      </Space>

      <Space size={6} wrap>
        <Tag>{dataset.rowCount.toLocaleString('pt-BR')} linhas</Tag>
        <Tag>{dataset.columns.length} colunas</Tag>
        <Tag>{formatBytes(dataset.sizeBytes)}</Tag>
      </Space>

      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        Importado em {new Date(dataset.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
      </Typography.Text>

      <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 'auto' }}>
        <Button size="small" icon={<TableIcon size={14} />} onClick={onPreview}>
          Ver dados
        </Button>
        <Popconfirm title="Excluir CSV?" description="Esta ação não pode ser desfeita." okType="danger" onConfirm={onRemove}>
          <Button size="small" danger icon={<Trash2 size={14} />} />
        </Popconfirm>
      </Space>
    </div>
  )
}
