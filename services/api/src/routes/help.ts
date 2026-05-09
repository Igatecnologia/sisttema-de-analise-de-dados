import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'

export const helpRouter = Router()

const articles = [
  { id: 'primeiros-passos', title: 'Primeiros passos no IGA Gestao', category: 'Onboarding', minutes: 4 },
  { id: 'fontes', title: 'Como conectar fontes de dados', category: 'Integracoes', minutes: 6 },
  { id: 'relatorios', title: 'Criando relatorios recorrentes', category: 'Relatorios', minutes: 5 },
  { id: 'permissoes', title: 'Perfis, permissoes e auditoria', category: 'Seguranca', minutes: 7 },
  { id: 'financeiro', title: 'Interpretando indicadores financeiros', category: 'Financeiro', minutes: 8 },
  { id: 'alertas', title: 'Configurando alertas operacionais', category: 'Operacao', minutes: 5 },
]

helpRouter.use(requireAuth)

helpRouter.get('/articles', (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase()
  const filtered = q
    ? articles.filter((article) => `${article.title} ${article.category}`.toLowerCase().includes(q))
    : articles
  res.json(filtered)
})
