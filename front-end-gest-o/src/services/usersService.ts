import { z } from 'zod'
import type { User, UserRole } from '../types/models'
import { http } from './http'
import { getValidated, postValidated, putValidated } from '../api/validatedHttp'
import {
  userCreateInputSchema,
  userSchema,
  userUpdateInputSchema,
  usersResponseSchema,
} from '../api/schemas'

const BASE = '/api/v1/users'

export async function listUsers(): Promise<User[]> {
  return getValidated(http, BASE, usersResponseSchema)
}

export async function createUser(input: {
  name: string
  email: string
  role: UserRole
  status: User['status']
  password: string
  permissions?: string[]
}): Promise<User> {
  const payload = userCreateInputSchema.parse(input)
  return postValidated(http, BASE, payload, userSchema)
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<User, 'name' | 'email' | 'role' | 'status' | 'password'>> & {
    permissions?: string[] | null
  },
): Promise<User> {
  const payload = userUpdateInputSchema.parse(patch)
  return putValidated(http, `${BASE}/${id}`, payload, userSchema)
}

export async function deleteUser(id: string): Promise<void> {
  const parsedId = z.string().min(1).parse(id)
  await http.delete(`${BASE}/${parsedId}`)
}
