import { http } from './http'
import { trackEvent } from './analytics'

export type CustomerAddress = {
  cep?: string
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
  complement?: string
}

export type Customer = {
  id: string
  name: string
  document: string | null
  email: string | null
  phone: string | null
  contactName: string | null
  address: CustomerAddress | null
  creditLimitCents: number | null
  notes: string | null
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export type CustomerInput = {
  name: string
  document?: string | null
  email?: string | null
  phone?: string | null
  contactName?: string | null
  address?: CustomerAddress | null
  creditLimitCents?: number | null
  notes?: string | null
  status?: 'active' | 'inactive'
}

export type ListCustomersParams = {
  search?: string
  status?: 'active' | 'inactive'
  limit?: number
  offset?: number
}

const BASE = '/api/v1/customers'

export async function listCustomers(params: ListCustomersParams = {}): Promise<{ items: Customer[]; total: number }> {
  const search = new URLSearchParams()
  if (params.search) search.set('search', params.search)
  if (params.status) search.set('status', params.status)
  if (params.limit != null) search.set('limit', String(params.limit))
  if (params.offset != null) search.set('offset', String(params.offset))
  const qs = search.toString() ? `?${search.toString()}` : ''
  const { data } = await http.get<{ items: Customer[]; total: number }>(`${BASE}${qs}`)
  return data
}

export async function getCustomer(id: string): Promise<Customer> {
  const { data } = await http.get<Customer>(`${BASE}/${id}`)
  return data
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const { data } = await http.post<Customer>(BASE, input)
  trackEvent('customer_created', { hasDocument: Boolean(input.document), hasEmail: Boolean(input.email) })
  return data
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>): Promise<Customer> {
  const { data } = await http.put<Customer>(`${BASE}/${id}`, input)
  trackEvent('customer_updated', { fields: Object.keys(input).length })
  return data
}

export async function deleteCustomer(id: string): Promise<void> {
  await http.delete(`${BASE}/${id}`)
  trackEvent('customer_deleted')
}

export type AbcSegment = 'A' | 'B' | 'C'

export type AbcSegmentationItem = {
  customerKey: string
  customerName: string
  revenue: number
  cumulativePct: number
  segment: AbcSegment
  registeredCustomer: { id: string; name: string } | null
}

export type AbcSegmentationResponse = {
  months: number
  totalRevenue: number
  counts: { A: number; B: number; C: number; unregistered: number }
  items: AbcSegmentationItem[]
}

export async function getCustomerAbcSegmentation(months = 12): Promise<AbcSegmentationResponse> {
  const { data } = await http.get<AbcSegmentationResponse>(`${BASE}/segmentation/abc?months=${months}`)
  return data
}
