import { http } from './http'

export type CsvDatasetSummary = {
  id: string
  name: string
  filename: string
  columns: string[]
  rowCount: number
  sizeBytes: number
  createdAt: string
  updatedAt: string
}

export type CsvDatasetDetail = CsvDatasetSummary & {
  rows: Array<Array<string | number | boolean | null>>
  hasMore: boolean
}

const BASE = '/api/v1/csv-datasets'

export async function listCsvDatasets(): Promise<CsvDatasetSummary[]> {
  const { data } = await http.get<{ datasets: CsvDatasetSummary[] }>(BASE)
  return data.datasets
}

export async function getCsvDataset(
  id: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<CsvDatasetDetail> {
  const params = new URLSearchParams()
  if (opts.limit != null) params.set('limit', String(opts.limit))
  if (opts.offset != null) params.set('offset', String(opts.offset))
  const qs = params.toString() ? `?${params.toString()}` : ''
  const { data } = await http.get<CsvDatasetDetail>(`${BASE}/${id}${qs}`)
  return data
}

export async function uploadCsvDataset(input: {
  name: string
  filename: string
  columns: string[]
  rows: Array<Array<string | number | boolean | null>>
}): Promise<CsvDatasetSummary> {
  const { data } = await http.post<CsvDatasetSummary>(BASE, input)
  return data
}

export async function deleteCsvDataset(id: string): Promise<void> {
  await http.delete(`${BASE}/${id}`)
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}
