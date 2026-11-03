import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Barra } from '../components/Barra'
import { Modal } from '../components/Modal'
import { SeletorData } from '../components/SeletorData'
import type { Medicao, Servico } from '../db/types'
import { useDados } from '../hooks/useDados'
import { executadoDoServico } from '../lib/analise'
import { parseNumero } from '../lib/forms'
import { dataLocal, formatNumero } from '../lib/util'
import { removerMedicao, salvarMedicao } from '../repo/medicao'

export default function MedicaoPage() {
  const { obra, servicos, trechos, medicoes } = useDados()
  const hoje = dataLocal()
  const [data, setData] = useState(hoje)
  const [form, setForm] = useState<{ servico: Servico; existente?: Medicao } | null>(null)

  const doDia = medicoes.filter((m) => m.data === data)
  const totalDoDia = (servicoId: string) =>
    doDia.filter((m) => m.servicoId === servicoId).reduce((a, m) => a + m.quantidade, 0)
  const nomeTrecho = (id?: string) => trechos.find((t) => t.id === id)?.nome

  return (
    <div className="pagina">
      <h1>Medição</h1>
      <p className="mudo">Lance aqui o que foi executado no dia, por serviço.</p>

      <SeletorData data={data} setData={setData} hoje={hoje} />

      {servicos.length === 0 ? (
        <p className="mudo">
          Nenhum serviço cadastrado. <Link to="/obra">Cadastre os serviços da obra</Link> para começar a medir.
        </p>
      ) : (
        <ul className="lista">
          {servicos.map((s) => {
            const exec = executadoDoServico(medicoes, s.id)
            const pct = s.quantidadePrevista > 0 ? (exec / s.quantidadePrevista) * 100 : 0
            const excedeu = s.quantidadePrevista > 0 && exec > s.quantidadePrevista
            const dia = totalDoDia(s.id)
            return (
              <li key={s.id} className="cartao servico-card">
                <div className="cartao-titulo">
                  <h2>{s.nome}</h2>
                  <button type="button" className="btn btn-primario" onClick={() => setForm({ servico: s })}>
                    + Lançar
                  </button>
                </div>
                <Barra pct={pct} cor={excedeu ? 'laranja' : 'azul'} />
                <p className="linha-info">
                  <b>{formatNumero(exec)}</b> de {formatNumero(s.quantidadePrevista)} {s.unidade}
                  <span className="mudo"> · {formatNumero(pct)}%</span>
                </p>
                {excedeu && (
                  <p className="aviso-linha">Passou do previsto. Verifique se precisa de aditivo contratual.</p>
                )}
                <p className="mudo pequeno">
                  Neste dia: {dia > 0 ? `${formatNumero(dia)} ${s.unidade}` : 'nada lançado'}
                </p>
              </li>
            )
          })}
        </ul>
      )}

      {doDia.length > 0 && (
        <>
          <h2 className="subtitulo">Lançamentos do dia</h2>
          <ul className="lista">
            {doDia
              .slice()
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
              .map((m) => {
                const s = servicos.find((x) => x.id === m.servicoId)
                return (
                  <li key={m.id} className="item">
                    <div className="item-texto">
                      <b>{formatNumero(m.quantidade)} {s?.unidade} · {s?.nome ?? 'Serviço removido'}</b>
                      <span className="mudo">
                        {[nomeTrecho(m.trechoId), m.obs].filter(Boolean).join(' · ') || 'sem trecho'}
                      </span>
                    </div>
                    {s && (
                      <button type="button" className="btn btn-sec" onClick={() => setForm({ servico: s, existente: m })}>
                        Editar
                      </button>
                    )}
                  </li>
                )
              })}
          </ul>
        </>
      )}

      {form && (
        <FormMedicao
          obraId={obra.id}
          data={data}
          servico={form.servico}
          existente={form.existente}
          trechos={trechos.map((t) => ({ id: t.id, nome: t.nome }))}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  )
}

function FormMedicao({
  obraId, data, servico, existente, trechos, onClose,
}: {
  obraId: string; data: string; servico: Servico; existente?: Medicao
  trechos: { id: string; nome: string }[]; onClose: () => void
}) {
  const [qtd, setQtd] = useState(existente ? String(existente.quantidade).replace('.', ',') : '')
  const [trechoId, setTrechoId] = useState(existente?.trechoId ?? '')
  const [obs, setObs] = useState(existente?.obs ?? '')
  const [erro, setErro] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const n = parseNumero(qtd)
    if (!Number.isFinite(n) || n <= 0) { setErro('Informe a quantidade executada (maior que zero).'); return }
    await salvarMedicao(obraId, {
      data, servicoId: servico.id, quantidade: n,
      trechoId: trechoId || undefined, obs: obs.trim() || undefined,
    }, existente)
    onClose()
  }

  return (
    <Modal titulo={existente ? 'Editar lançamento' : 'Lançar produção'} onClose={onClose}>
      <form onSubmit={enviar} className="form">
        <p className="mudo" style={{ margin: 0 }}>{servico.nome}</p>
        <label>
          Quantidade executada ({servico.unidade})
          <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" autoFocus placeholder="ex.: 120" />
        </label>
        {trechos.length > 0 && (
          <label>
            Trecho (opcional)
            <select value={trechoId} onChange={(e) => setTrechoId(e.target.value)}>
              <option value="">—</option>
              {trechos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </label>
        )}
        <label>
          Observação (opcional)
          <input value={obs} onChange={(e) => setObs(e.target.value)} autoComplete="off" />
        </label>
        {erro && <p className="erro">{erro}</p>}
        <div className="form-acoes">
          {existente && (
            <button type="button" className="btn btn-perigo" onClick={async () => { await removerMedicao(existente); onClose() }}>
              Excluir
            </button>
          )}
          <button type="submit" className="btn btn-primario">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}
