import { Command } from 'cmdk'
import { Modal } from 'antd'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { http } from '../services/http'

type SearchResult = {
  id: string
  category: string
  title: string
  subtitle: string
  route: string
}

type Props = {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>()
    for (const item of results) {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    return map
  }, [results])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => {
      try {
        const { data } = await http.get<SearchResult[]>('/api/v1/search', {
          params: { q: query },
        })
        setResults(data)
      } catch {
        setResults([])
      }
    }, 160)
    return () => clearTimeout(t)
  }, [open, query])

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={null} width={680}>
      <Command label="Busca global">
        <div className="cmdk-search-row">
          <Search size={16} />
          <Command.Input value={query} onValueChange={setQuery} placeholder="Buscar clientes, produtos, telas..." />
        </div>
        <Command.List className="cmdk-list">
          <Command.Empty>Nenhum resultado.</Command.Empty>
          {[...grouped.entries()].map(([group, items]) => (
            <Command.Group key={group} heading={group}>
              {items.map((item) => (
                <Command.Item
                  key={item.id}
                  value={`${item.title} ${item.subtitle}`}
                  onSelect={() => {
                    navigate(item.route)
                    onClose()
                    setQuery('')
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>{item.title}</span>
                    <small style={{ opacity: 0.65 }}>{item.subtitle}</small>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </Modal>
  )
}
