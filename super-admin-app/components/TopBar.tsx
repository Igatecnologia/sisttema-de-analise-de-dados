'use client'

import { useRouter } from 'next/navigation'
import { Crown, LogOut } from 'lucide-react'
import { api } from '@/lib/api'
import type { Me } from '@/lib/api'

export function TopBar({ me }: { me: Me }) {
  const router = useRouter()

  async function handleLogout() {
    try {
      await api.post('/v1/auth/logout')
    } catch {
      /* ignora */
    }
    router.replace('/login')
  }

  return (
    <header
      className="sticky top-0 z-10 backdrop-blur-md"
      style={{ background: 'rgba(10,14,20,0.85)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #FFD700, #F59E0B)' }}
          >
            <Crown size={16} color="#0a0e14" strokeWidth={2.5} />
          </div>
          <span className="font-semibold">IGA Super Admin</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>
            <div style={{ color: 'var(--text)' }}>{me.user.name}</div>
            <div>{me.user.email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
            aria-label="Sair"
            title="Sair"
            style={{ color: 'var(--text-muted)' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
