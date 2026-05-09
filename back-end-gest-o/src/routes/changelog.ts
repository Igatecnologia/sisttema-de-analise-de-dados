import { Router } from 'express'

export const changelogRouter = Router()

changelogRouter.get('/', (_req, res) => {
  res.json([
    {
      version: '1.2.0',
      date: '2026-05-08',
      type: 'Novo',
      title: 'Shell premium e auditoria frontend',
      items: ['Navegacao com abas abertas', 'Tour guiado', 'Base para paginas premium'],
    },
    {
      version: '1.1.0',
      date: '2026-05-02',
      type: 'Melhoria',
      title: 'Dashboards operacionais',
      items: ['KPIs por modulo', 'Alertas operacionais', 'Exportacoes aprimoradas'],
    },
    {
      version: '1.0.0',
      date: '2026-04-24',
      type: 'Lancamento',
      title: 'Beta privado',
      items: ['Autenticacao', 'Relatorios', 'Financeiro', 'Fontes de dados'],
    },
  ])
})
