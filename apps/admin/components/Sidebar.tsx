'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Crown,
  FileSearch,
  Gauge,
  HeartPulse,
  LogOut,
  Moon,
  Rocket,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Me } from '@/lib/api'
import { api } from '@/lib/api'
import { useTheme } from './ThemeProvider'

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
  badge?: string
}

const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: <Gauge size={16} /> },
  { href: '/beta', label: 'Beta Fechada', icon: <Rocket size={16} />, badge: 'beta' },
  { href: '/tenants', label: 'Tenants', icon: <Building2 size={16} /> },
  { href: '/users', label: 'Usuarios', icon: <Users size={16} /> },
  { href: '/subscriptions', label: 'Assinaturas', icon: <CreditCard size={16} /> },
  { href: '/ai-usage', label: 'IA Usage', icon: <Sparkles size={16} /> },
  { href: '/audit', label: 'Auditoria', icon: <FileSearch size={16} /> },
  { href: '/system', label: 'Saude do sistema', icon: <HeartPulse size={16} /> },
  { href: '/connectors', label: 'Connectors', icon: <Boxes size={16} /> },
]

export function Sidebar({ me }: { me: Me }) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('iga.admin.sidebar.collapsed') === '1')
    } catch {
      /* noop */
    }
  }, [])

  function setCollapsedPersist(v: boolean) {
    setCollapsed(v)
    try {
      localStorage.setItem('iga.admin.sidebar.collapsed', v ? '1' : '0')
    } catch {
      /* noop */
    }
  }

  async function handleLogout() {
    try {
      await api.post('/v1/auth/logout')
    } catch {
      /* noop */
    }
    router.replace('/login')
  }

  return (
    <aside
      className="sticky top-0 h-screen flex flex-col"
      style={{
        width: collapsed ? 72 : 240,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        transition: 'width 200ms ease',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #FFD700, #F59E0B)' }}
        >
          <Crown size={18} color="#0a0e14" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="font-semibold text-sm leading-tight">IGA Super Admin</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              cross-tenant ops
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Navegacao principal">
        {NAV.map((item) => {
          const isActive =
            item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group"
              style={{
                background: isActive ? 'var(--accent-muted)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 400,
              }}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold"
                      style={{ background: 'var(--accent-strong)', color: 'var(--accent)' }}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User / Theme / Collapse / Logout */}
      <div className="p-3 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
        {!collapsed && (
          <div className="px-3 py-2 mb-1">
            <div className="text-sm font-medium truncate">{me.user.name}</div>
            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {me.user.email}
            </div>
          </div>
        )}

        <button
          onClick={toggle}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        >
          <span className="flex-shrink-0">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</span>
          {!collapsed && <span>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>}
        </button>

        <button
          onClick={() => setCollapsedPersist(!collapsed)}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <span className="flex-shrink-0">
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </span>
          {!collapsed && <span>Recolher</span>}
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors"
          style={{ color: 'var(--danger)' }}
          title="Sair"
          aria-label="Sair"
        >
          <span className="flex-shrink-0">
            <LogOut size={16} />
          </span>
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  )
}
