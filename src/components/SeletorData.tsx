import { dataBR, deslocaDia, diaSemana } from '../lib/util'

export function SeletorData({ data, setData, hoje }: { data: string; setData: (d: string) => void; hoje: string }) {
  return (
    <>
      <div className="seletor-data">
        <button type="button" className="btn btn-sec" onClick={() => setData(deslocaDia(data, -1))} aria-label="Dia anterior">◀</button>
        <div className="seletor-centro">
          <input
            type="date"
            value={data}
            max={hoje}
            onChange={(e) => e.target.value && setData(e.target.value)}
            aria-label="Data"
          />
          <span className="mudo">{diaSemana(data)} · {dataBR(data)}</span>
        </div>
        <button
          type="button"
          className="btn btn-sec"
          onClick={() => setData(deslocaDia(data, 1))}
          disabled={data >= hoje}
          aria-label="Próximo dia"
        >▶</button>
      </div>
      {data !== hoje && (
        <button type="button" className="link-botao" onClick={() => setData(hoje)}>Voltar para hoje</button>
      )}
    </>
  )
}
