export function FinanceiroSkeleton() {
  return (
    <div className="app-skeleton app-skeleton--finance" aria-hidden>
      <div className="app-skeleton__row app-skeleton__row--tabs">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="app-skeleton__block app-skeleton__block--tab" />
        ))}
      </div>
      <div className="app-skeleton__row app-skeleton__row--kpis">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="app-skeleton__block app-skeleton__block--kpi" />
        ))}
      </div>
      <div className="app-skeleton__block app-skeleton__block--chart-lg" />
    </div>
  )
}
