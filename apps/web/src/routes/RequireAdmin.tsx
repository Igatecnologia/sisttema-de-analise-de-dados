import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/** Apenas usuarios com role `admin` (rotas de sistema / operacao). */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  if (!session || session.user.role !== 'admin') {
    return <Navigate to="/gestao" replace />
  }
  return <>{children}</>
}
