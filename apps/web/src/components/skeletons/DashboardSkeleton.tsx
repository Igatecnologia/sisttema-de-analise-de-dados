export function DashboardSkeleton() {
  return (
    <div className="app-skeleton app-skeleton--dashboard" aria-hidden>
      <div className="app-skeleton__row app-skeleton__row--kpis">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="app-skeleton__block app-skeleton__block--kpi" />
        ))}
      </div>
      <div className="app-skeleton__row app-skeleton__row--charts">
        <div className="app-skeleton__block app-skeleton__block--chart-lg" />
        <div className="app-skeleton__block app-skeleton__block--chart-sm" />
      </div>
    </div>
  )
}
