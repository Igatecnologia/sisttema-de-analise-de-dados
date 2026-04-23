import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { sanitizeAppRedirectPath } from '../utils/sanitizeAppRedirectPath'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: sanitizeAppRedirectPath(location.pathname, '/dashboard') }}
      />
    )
  }

  return children
}

