import { useState } from 'react'
import { useDados } from '../../hooks/useDados'
import { addDias, inicioSemana, resumirFrequencia } from '../../lib/analise'
import { dataBR, dataLocal, diaSemanaCurto } from '../../lib/util'

type Preset = 'semana' | 'mes' | '30' | 'outro'

export default function Faltas() {
  const { frequencias, funcionariosTodos } = useDados()
  const hoje = dataLocal()
  const [preset, setPreset] = useState<Preset>('mes')
  const [outroIni, setOutroIni] = useState(addDias(hoje, -14))
  const [outroFim, setOutroFim] = useState(hoje)

  const [ini, fim] =
    preset === 'semana' ? [inicioSemana(hoje), hoje]
    : preset === 'mes' ? [`${hoje.slice(0, 8)}01`, hoje]
    : preset === '30' ? [addDias(hoje, -29), hoje]
    : [outroIni, outroFim]

  const regs = frequencias.filter((f) => f.data >= ini && f.data <= fim)
  const resumo = resumirFrequencia(regs).sort(
    (a, b) => b.faltas - a.faltas || b.atrasos - a.atrasos || b.registros - a.registros,
  )
  const nomeDe = (id: string) => funcionariosTodos.find((f) => f.id === id)

  const totalFaltas = resumo.reduce((a, r) => a + r.faltas, 0)
  const totalAtrasos = resumo.reduce((a, r) => a + r.atrasos, 0)
  const trabalhados = resumo.reduce((a, r) => a + r.presencas + r.atrasos, 0)

  const botoes: [Preset, string][] = [['semana', 'Esta semana'], ['mes', 'Este mês'], ['30', '30 dias'], ['outro', 'Escolher']]

  return (
    <>
      <div className="segmentos pequeno-seg" role="group" aria-label="Período">
        {botoes.map(([k, rotulo]) => (
          <button key={k} type="button" className={preset === k ? 'ativo' : ''} onClick={() => setPreset(k)}>{rotulo}</button>
        ))}
      </div>

      {preset === 'outro' && (
        <div className="linha-campos" style={{ marginBottom: 12 }}>
          <label>De<input type="date" value={outroIni} max={outroFim} onChange={(e) => e.target.value && setOutroIni(e.target.value)} /></label>
          <label>Até<input type="date" value={outroFim} min={outroIni} max={hoje} onChange={(e) => e.target.value && setOutroFim(e.target.value)} /></label>
        </div>
      )}
      <p className="mudo">Período: {dataBR(ini)} a {dataBR(fim)}</p>

      <div className="resumo-grade resumo-3">
        <div className="resumo falta"><b>{totalFaltas}</b><span>faltas</span></div>
        <div className="resumo atraso"><b>{totalAtrasos}</b><span>atrasos</span></div>
        <div className="resumo ok"><b>{trabalhados}</b><span>dias trabalhados</span></div>
      </div>

      {resumo.length === 0 ? (
        <p className="mudo" style={{ marginTop: 16 }}>Nenhuma chamada lançada neste período.</p>
      ) : (
        <ul className="lista" style={{ marginTop: 14 }}>
          {resumo.map((r) => {
            const f = nomeDe(r.funcionarioId)
            return (
              <li key={r.funcionarioId} className="cartao pessoa">
                <div className="pessoa-topo">
                  <div className="item-texto">
                    <b>{f?.nome ?? 'Funcionário removido'}</b>
                    <span className="mudo">
                      {f?.funcao || 'sem função'}
                      {f?.deletedAt ? ' · excluído' : f && !f.ativo ? ' · inativo' : ''}
                    </span>
                  </div>
                  <div className="pessoa-pct">
                    <b>{r.pctPresenca !== null ? `${Math.round(r.pctPresenca)}%` : '—'}</b>
                    <span className="mudo pequeno">presença</span>
                  </div>
                </div>
                <div className="etiquetas">
                  <span className="etq falta">{r.faltas} falta(s)</span>
                  <span className="etq atraso">{r.atrasos} atraso(s)</span>
                  <span className="etq ok">{r.presencas} presença(s)</span>
                </div>
                {r.ocorrencias.length > 0 && (
                  <details>
                    <summary>Ver datas</summary>
                    <ul className="lista-simples">
                      {r.ocorrencias.map((o) => (
                        <li key={o.id}>
                          <b>{diaSemanaCurto(o.data)} {dataBR(o.data)}</b>{' '}
                          <span className={o.status === 'falta' ? 'erro' : 'atraso-texto'}>
                            {o.status === 'falta' ? 'falta' : 'atraso'}
                          </span>
                          {o.obs ? ` — ${o.obs}` : ''}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
