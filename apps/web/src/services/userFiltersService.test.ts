import { describe, expect, it } from 'vitest'
import {
  createUserSavedFilter,
  deleteUserSavedFilter,
  listUserSavedFilters,
} from './userFiltersService'

describe('userFiltersService', () => {
  it('salva e lista filtros por usuário', () => {
    const created = createUserSavedFilter({
      userId: 'usr_admin',
      page: 'reports',
      name: 'Meu filtro',
      params: 'q=abc',
    })
    const list = listUserSavedFilters('usr_admin', 'reports')
    expect(list[0].id).toBe(created.id)
  })

  it('deleta filtro salvo', () => {
    const created = createUserSavedFilter({
      userId: 'usr_admin',
      page: 'reports',
      name: 'Filtro X',
      params: 'q=xyz',
    })
    deleteUserSavedFilter(created.id)
    expect(listUserSavedFilters('usr_admin', 'reports').some((x) => x.id === created.id)).toBe(
      false,
    )
  })
})
