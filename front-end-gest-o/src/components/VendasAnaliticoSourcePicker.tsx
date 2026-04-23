import { DatabaseOutlined } from '@ant-design/icons'
import { Grid, Select, Space, Tooltip } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { queryKeys } from '../query/queryKeys'
import { getAllVendasAnaliticoDataSources, hasAnySources, listDataSourcesFromApi } from '../services/dataSourceService'
import {
  getVendasAnaliticoSelectionStored,
  setVendasAnaliticoSelection,
} from '../services/vendasAnaliticoSourceSelection'

/**
 * Troca qual(is) fonte(s) SGBR alimentam vendas analítico (dashboard, financeiro, relatórios).
 * Só aparece com 2+ fontes compatíveis; com uma única fonte o comportamento é o de sempre.
 */
export function VendasAnaliticoSourcePicker() {
  const screens = Grid.useBreakpoint()
  const qc = useQueryClient()
  const { dataUpdatedAt } = useQuery({
    queryKey: queryKeys.dataSources(),
    queryFn: listDataSourcesFromApi,
    enabled: hasAnySources(),
  })

  const sources = useMemo(() => getAllVendasAnaliticoDataSources(), [dataUpdatedAt])

  const [version, setVersion] = useState(0)
  const stored = useMemo(() => {
    void version
    return getVendasAnaliticoSelectionStored()
  }, [version, dataUpdatedAt])

  const selectValue = stored === 'all' ? '__all__' : stored

  const onChange = useCallback(
    (v: string) => {
      if (v === '__all__') setVendasAnaliticoSelection('all')
      else setVendasAnaliticoSelection(v)
      setVersion((n) => n + 1)
      void Promise.all([
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
        qc.invalidateQueries({ queryKey: ['finance'] }),
        qc.invalidateQueries({ queryKey: ['vendasAnalitico'] }),
        qc.invalidateQueries({ queryKey: ['reports'] }),
      ])
    },
    [qc],
  )

  if (!hasAnySources() || sources.length < 2) return null

  const options = [
    ...sources.map((ds) => ({
      value: ds.id,
      label: `${ds.name} (${ds.id.slice(0, 8)})`,
    })),
    {
      value: '__all__',
      label: 'Todas as fontes (unir linhas)',
    },
  ]

  return (
    <Tooltip
      title="Define quais conexões SGBR alimentam o analítico de vendas. “Todas” chama cada API e concatena as linhas (pode haver sobreposição se os conjuntos não forem disjuntos)."
      placement="bottomLeft"
    >
      <Space size={6} align="center" style={{ marginRight: 8 }}>
        <DatabaseOutlined style={{ opacity: 0.75 }} aria-hidden />
        {screens.md ? (
          <span style={{ fontSize: 12, opacity: 0.7 }}>Fonte vendas</span>
        ) : null}
        <Select
          size="small"
          aria-label="Fonte de dados do analítico de vendas"
          style={{ minWidth: 200, maxWidth: 280 }}
          value={selectValue || sources[0]?.id}
          options={options}
          onChange={onChange}
          popupMatchSelectWidth={false}
        />
      </Space>
    </Tooltip>
  )
}
