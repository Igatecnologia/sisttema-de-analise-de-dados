import { Dropdown, Tooltip, theme } from 'antd'
import { X, XCircle } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { OpenTab } from '../hooks/useOpenTabs'

type Props = {
  tabs: OpenTab[]
  activePath: string
  onClose: (path: string) => void
  onCloseOthers: (keepPath: string) => void
  onCloseAll: () => void
}

export function OpenTabsBar({ tabs, activePath, onClose, onCloseOthers, onCloseAll }: Props) {
  const navigate = useNavigate()
  const { token } = theme.useToken()

  if (tabs.length === 0) return null

  function handleClick(tab: OpenTab) {
    if (tab.path !== activePath) navigate(tab.url)
  }

  function handleCloseClick(e: MouseEvent, path: string) {
    e.stopPropagation()
    e.preventDefault()
    onClose(path)
  }

  return (
    <div
      role="tablist"
      aria-label="Páginas abertas"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 2,
        padding: '4px 12px 0',
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        overflowX: 'auto',
        overflowY: 'hidden',
        position: 'sticky',
        top: 64, // abaixo do Header
        zIndex: 99,
        scrollbarWidth: 'thin',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.path === activePath
        return (
          <Dropdown
            key={tab.path}
            trigger={['contextMenu']}
            menu={{
              items: [
                { key: 'close', label: 'Fechar', onClick: () => onClose(tab.path) },
                { key: 'others', label: 'Fechar outras', onClick: () => onCloseOthers(tab.path) },
                { key: 'all', label: 'Fechar todas', onClick: onCloseAll },
              ],
            }}
          >
            <div
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onClick={() => handleClick(tab)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleClick(tab)
                }
                if (e.key === 'Delete' || (e.ctrlKey && e.key.toLowerCase() === 'w')) {
                  e.preventDefault()
                  onClose(tab.path)
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px 6px 12px',
                maxWidth: 200,
                borderRadius: '6px 6px 0 0',
                background: isActive ? token.colorBgLayout : 'transparent',
                borderBottom: isActive ? `2px solid ${token.colorPrimary}` : '2px solid transparent',
                color: isActive ? token.colorText : token.colorTextSecondary,
                cursor: 'pointer',
                fontSize: 13,
                userSelect: 'none',
                whiteSpace: 'nowrap',
                transition: 'background 120ms, color 120ms',
                flex: '0 0 auto',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = token.colorFillQuaternary
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent'
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 160,
                }}
              >
                {tab.title}
              </span>
              <button
                type="button"
                aria-label={`Fechar ${tab.title}`}
                onClick={(e) => handleCloseClick(e, tab.path)}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  width: 18,
                  height: 18,
                  display: 'grid',
                  placeItems: 'center',
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  opacity: 0.6,
                  borderRadius: 3,
                  cursor: 'pointer',
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1'
                  e.currentTarget.style.background = token.colorFillSecondary
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.6'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <X size={12} />
              </button>
            </div>
          </Dropdown>
        )
      })}

      {tabs.length > 1 && (
        <Tooltip title="Fechar todas as abas">
          <button
            type="button"
            aria-label="Fechar todas as abas"
            onClick={onCloseAll}
            style={{
              flex: '0 0 auto',
              display: 'grid',
              placeItems: 'center',
              width: 28,
              height: 28,
              margin: '2px 0 2px 4px',
              border: 'none',
              borderRadius: 6,
              background: 'transparent',
              color: token.colorTextSecondary,
              cursor: 'pointer',
              opacity: 0.5,
              transition: 'opacity 150ms, background 150ms, color 150ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.background = token.colorFillSecondary
              e.currentTarget.style.color = token.colorError
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.5'
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = token.colorTextSecondary
            }}
          >
            <XCircle size={14} />
          </button>
        </Tooltip>
      )}
    </div>
  )
}
