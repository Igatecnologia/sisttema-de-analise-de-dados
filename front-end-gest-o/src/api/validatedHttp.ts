import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import { z, type ZodTypeAny } from 'zod'

export class ApiContractError extends Error {
  details?: unknown

  constructor(message: string, details?: unknown) {
    super(message)
    this.name = 'ApiContractError'
    this.details = details
  }
}

export async function getValidated<TSchema extends ZodTypeAny>(
  http: AxiosInstance,
  url: string,
  schema: TSchema,
  config?: AxiosRequestConfig,
): Promise<z.infer<TSchema>> {
  const res = await http.get(url, config)
  const parsed = schema.safeParse(res.data)
  if (!parsed.success) {
    throw new ApiContractError('Resposta da API fora do contrato.', parsed.error)
  }
  return parsed.data
}

export async function postValidated<TSchema extends ZodTypeAny>(
  http: AxiosInstance,
  url: string,
  body: unknown,
  schema: TSchema,
  config?: AxiosRequestConfig,
): Promise<z.infer<TSchema>> {
  const res = await http.post(url, body, config)
  const parsed = schema.safeParse(res.data)
  if (!parsed.success) {
    throw new ApiContractError('Resposta da API fora do contrato.', parsed.error)
  }
  return parsed.data
}

export async function putValidated<TSchema extends ZodTypeAny>(
  http: AxiosInstance,
  url: string,
  body: unknown,
  schema: TSchema,
  config?: AxiosRequestConfig,
): Promise<z.infer<TSchema>> {
  const res = await http.put(url, body, config)
  const parsed = schema.safeParse(res.data)
  if (!parsed.success) {
    throw new ApiContractError('Resposta da API fora do contrato.', parsed.error)
  }
  return parsed.data
}

export async function deleteValidated<TSchema extends ZodTypeAny>(
  http: AxiosInstance,
  url: string,
  schema: TSchema,
  config?: AxiosRequestConfig,
): Promise<z.infer<TSchema>> {
  const res = await http.delete(url, config)
  const parsed = schema.safeParse(res.data)
  if (!parsed.success) {
    throw new ApiContractError('Resposta da API fora do contrato.', parsed.error)
  }
  return parsed.data
}

