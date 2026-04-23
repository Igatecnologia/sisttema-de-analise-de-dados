export function VendasAnaliticoSkeleton() {
  return (
    <div className="app-skeleton app-skeleton--table" aria-hidden>
      <div className="app-skeleton__block app-skeleton__block--toolbar" />
      {Array.from({ length: 10 }).map((_, idx) => (
        <div key={idx} className="app-skeleton__block app-skeleton__block--row" />
      ))}
    </div>
  )
}
