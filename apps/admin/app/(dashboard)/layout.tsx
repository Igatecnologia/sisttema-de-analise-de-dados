'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { api, ApiError, type Me } from '@/lib/api'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const data = await api.get<Me>('/v1/auth/me')
        if (!active) return
        if (!data.isSuperAdmin) {
          router.replace('/login')
          return
        }
        setMe(data)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login')
          return
        }
        console.error(err)
      } finally {
        if (active) setChecking(false)
      }
    })()
    return () => {
      active = false
    }
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Verificando acesso...
        </div>
      </div>
    )
  }

  if (!me) return null

  return (
    <div className="flex min-h-screen">
      <Sidebar me={me} />
      <main className="flex-1 min-w-0 animate-fade-in">
        <div className="max-w-[1400px] mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  )
}
