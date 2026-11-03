export function Barra({ pct, cor = 'azul' }: { pct: number; cor?: 'azul' | 'verde' | 'laranja' }) {
  return (
    <div className="barra" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`barra-preench ${cor}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}
