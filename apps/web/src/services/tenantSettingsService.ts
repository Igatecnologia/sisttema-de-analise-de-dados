import { z } from 'zod'
import { getValidated, putValidated } from '../api/validatedHttp'
import { tenantSettingsSchema, tenantSettingsUpdateSchema } from '../api/schemas'
import { http } from './http'

const BASE = '/api/v1/tenants/current/settings'

export type TenantSettings = z.infer<typeof tenantSettingsSchema>
export type TenantSettingsUpdate = z.infer<typeof tenantSettingsUpdateSchema>

export async function getTenantSettings(): Promise<TenantSettings> {
  return getValidated(http, BASE, tenantSettingsSchema)
}

export async function updateTenantSettings(input: TenantSettingsUpdate): Promise<TenantSettings> {
  const payload = tenantSettingsUpdateSchema.parse(input)
  return putValidated(http, BASE, payload, tenantSettingsSchema)
}
