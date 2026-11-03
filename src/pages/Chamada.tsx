import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Frequencia, Funcionario, StatusFrequencia, Trecho } from '../db/types'
import { useObra } from '../state/ObraContext'
import { dataBR, dataLocal, deslocaDia, diaSemana } from '../lib/util'
import { atualizarDetalhes, definirStatus, todosPresentes } from '../repo/frequencia'

const STATUS: { valor: StatusFrequencia; rotulo: string }[] = [
  { valor: 'presente', rotulo: 'Presente' },
  { valor: 'atraso', rotulo: 'Atraso' },
  { valor: 'falta', rotulo: 'Falta' },
]

export default function Chamada() {
  const obra = useObra()
  const hoje = dataLocal()
  const [data, setData] = useState(hoje)

  const funcs = useLiveQuery(() => db.funcionarios.where('obraId').equals(obra.id).toArray(), [obra.id], [])
  const trechosTodos = useLiveQuery(() => db.trechos.where('obraId').equals(obra.id).toArray(), [obra.id], [])
  const regs = useLiveQuery(() => db.frequencias.where('data').equals(data).toArray(), [data], [])

  const mapa = new Map<string, Frequencia>(
    regs.filter((r) => r.obraId === obra.id).map((r) => [r.funcionarioId, r]),
  )
  const trechos = trechosTodos.filter((t) => !t.deletedAt)

  // Mostra os ativos + inativos que já têm registro neste dia (para não sumir do histórico).
  const lista = funcs
    .filter((f) => !f.deletedAt && (f.ativo || mapa.has(f.id)))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const contar = (s: StatusFrequencia) => lista.filter((f) => mapa.get(f.id)?.status === s).length
  const semRegistro = lista.filter((f) => !mapa.has(f.id)).length
  const ativosSemRegistro = lista.filter((f) => f.ativo && !mapa.has(f.id))

  return (
    <div className="pagina">
      <h1>Chamada</h1>

      <div className="seletor-data">
        <button type="button" className="btn btn-sec" onClick={() => setData(deslocaDia(data, -1))} aria-label="Dia anterior">◀</button>
        <div className="seletor-centro">
          <input
            type="date"
            value={data}
            max={hoje}
            onChange={(e) => e.target.value && setData(e.target.value)}
            aria-label="Data da chamada"
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

      <div className="resumo-grade resumo-compacto">
        <div className="resumo ok"><b>{contar('presente')}</b><span>presentes</span></div>
        <div className="resumo atraso"><b>{contar('atraso')}</b><span>atrasos</span></div>
        <div className="resumo falta"><b>{contar('falta')}</b><span>faltas</span></div>
        <div className="resumo neutro"><b>{semRegistro}</b><span>sem registro</span></div>
      </div>

      {lista.length === 0 ? (
        <p className="mudo">Cadastre os funcionários na aba Equipe para fazer a chamada.</p>
      ) : (
        <>
          {ativosSemRegistro.length > 0 && (
            <button
              type="button"
              className="btn btn-sec btn-largo"
              onClick={() => todosPresentes(obra.id, data, ativosSemRegistro.map((f) => f.id))}
            >
              Marcar todos como presentes ({ativosSemRegistro.length})
            </button>
          )}
          <ul className="lista">
            {lista.map((f) => (
              <LinhaChamada
                key={f.id}
                func={f}
                reg={mapa.get(f.id)}
                data={data}
                obraId={obra.id}
                trechos={trechos}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function LinhaChamada({
  func, reg, data, obraId, trechos,
}: { func: Funcionario; reg?: Frequencia; data: string; obraId: string; trechos: Trecho[] }) {
  const trabalhou = reg && reg.status !== 'falta'
  return (
    <li className={`chamada-item ${reg ? `st-${reg.status}` : ''}`}>
      <div className="chamada-topo">
        <div className="item-texto">
          <b>{func.nome}</b>
          <span className="mudo">{func.funcao || 'sem função'}{!func.ativo ? ' · inativo' : ''}</span>
        </div>
      </div>

      <div className="status-grupo" role="group" aria-label={`Situação de ${func.nome}`}>
        {STATUS.map((s) => (
          <button
            key={s.valor}
            type="button"
            className={`status-btn ${s.valor} ${reg?.status === s.valor ? 'ativo' : ''}`}
            aria-pressed={reg?.status === s.valor}
            onClick={() => definirStatus(obraId, data, func.id, s.valor)}
          >
            {s.rotulo}
          </button>
        ))}
      </div>

      {reg && (
        <div className="chamada-detalhes">
          {trabalhou && (
            <div className="linha-campos">
              <label>
                Entrada
                <input
                  type="time"
                  value={reg.entrada ?? ''}
                  onChange={(e) => atualizarDetalhes(reg.id, { entrada: e.target.value || undefined })}
                />
              </label>
              <label>
                Saída
                <input
                  type="time"
                  value={reg.saida ?? ''}
                  onChange={(e) => atualizarDetalhes(reg.id, { saida: e.target.value || undefined })}
                />
              </label>
            </div>
          )}
          {trabalhou && trechos.length > 0 && (
            <label>
              Frente / trecho
              <select
                value={reg.trechoId ?? ''}
                onChange={(e) => atualizarDetalhes(reg.id, { trechoId: e.target.value || undefined })}
              >
                <option value="">—</option>
                {trechos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </label>
          )}
          <label>
            Observação
            <input
              key={reg.updatedAt}
              defaultValue={reg.obs ?? ''}
              placeholder={reg.status === 'falta' ? 'ex.: atestado, sem aviso' : 'opcional'}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v !== (reg.obs ?? '')) void atualizarDetalhes(reg.id, { obs: v || undefined })
              }}
            />
          </label>
        </div>
      )}
    </li>
  )
}
