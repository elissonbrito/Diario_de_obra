import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import type { Entrega, Material } from '../../db/types'
import { useDados } from '../../hooks/useDados'
import { statusMaterial, type Situacao, type StatusMaterial } from '../../lib/analise'
import { parseNumero } from '../../lib/forms'
import { dataBR, dataCurta, dataLocal, formatNumero } from '../../lib/util'
import {
  registrarEntrega, removerEntrega, removerMaterial, salvarMaterial, type DadosMaterial,
} from '../../repo/materiais'

const ORDEM: Record<Situacao, number> = { pedir: 0, atencao: 1, ok: 2, 'sem-dados': 3 }

function Selo({ s, hoje }: { s: StatusMaterial; hoje: string }) {
  if (s.situacao === 'pedir') return <span className="etq falta">Pedir agora</span>
  if (s.situacao === 'atencao' && s.pedirAte) return <span className="etq atraso">Pedir até {dataCurta(s.pedirAte)}</span>
  if (s.situacao === 'ok') return <span className="etq ok">Em dia</span>
  void hoje
  return <span className="etq neutro">Sem dados</span>
}

export default function Materiais() {
  const { obra, servicos, medicoes, materiais, entregas } = useDados()
  const hoje = dataLocal()
  const [cobertura, setCobertura] = useState(5)
  const [form, setForm] = useState<Material | 'novo' | 'concreto' | null>(null)
  const [entregaPara, setEntregaPara] = useState<Material | null>(null)

  const itens = materiais
    .map((m) => statusMaterial(m, { servicos, medicoes, entregas, hoje }, cobertura))
    .sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao] || a.material.nome.localeCompare(b.material.nome, 'pt-BR'))

  const temServicoConcreto = servicos.some((s) => /concreto/i.test(s.nome))

  return (
    <>
      <div className="titulo-linha">
        <p className="mudo" style={{ margin: 0 }}>Materiais e ferramentas da obra</p>
        <button type="button" className="btn btn-primario" onClick={() => setForm('novo')}>+ Item</button>
      </div>

      {materiais.length > 0 && (
        <label className="cobertura">
          Cobertura do pedido
          <select value={cobertura} onChange={(e) => setCobertura(Number(e.target.value))}>
            {[3, 5, 7, 10, 15].map((n) => <option key={n} value={n}>{n} dias úteis</option>)}
          </select>
        </label>
      )}

      {materiais.length === 0 && (
        <section className="cartao">
          <p>
            Cadastre o que a obra consome (ex.: concreto, meio-fio) e as ferramentas. O app calcula o gasto
            a partir da produção que você lança, mostra o saldo e avisa <b>até quando pedir</b>.
          </p>
          {temServicoConcreto && (
            <button type="button" className="btn btn-sec" onClick={() => setForm('concreto')}>
              Começar pelo concreto
            </button>
          )}
        </section>
      )}

      <ul className="lista">
        {itens.map((s) => {
          const m = s.material
          return (
            <li key={m.id} className="cartao material">
              <div className="cartao-titulo">
                <h2>{m.nome} <span className="mudo">({m.tipo === 'ferramenta' ? 'ferramenta' : m.unidade})</span></h2>
                <Selo s={s} hoje={hoje} />
              </div>

              {m.tipo === 'ferramenta' ? (
                <dl className="dados">
                  <dt>Necessárias</dt><dd>{formatNumero(m.quantidadeNecessaria ?? 0)}</dd>
                  <dt>Disponíveis</dt><dd>{formatNumero(m.quantidadeDisponivel ?? 0)}</dd>
                  <dt>Faltam</dt><dd>{formatNumero(s.faltam ?? 0)}</dd>
                  {m.dataNecessaria && (<><dt>Precisa em</dt><dd>{dataBR(m.dataNecessaria)}</dd></>)}
                  {s.pedirAte && (<><dt>Pedir até</dt><dd>{dataBR(s.pedirAte)}</dd></>)}
                </dl>
              ) : s.consumoDia > 0 || s.recebido > 0 || s.consumoAcum > 0 ? (
                <>
                  <dl className="dados">
                    <dt>Gasto até hoje (estimado)</dt><dd>{formatNumero(s.consumoAcum)} {m.unidade}</dd>
                    <dt>Recebido</dt><dd>{formatNumero(s.recebido)} {m.unidade}</dd>
                    <dt>Saldo</dt>
                    <dd className={s.saldo < 0 ? 'erro' : ''}>{formatNumero(s.saldo)} {m.unidade}</dd>
                    {s.consumoDia > 0 && (<><dt>Consumo por dia útil</dt><dd>{formatNumero(s.consumoDia)} {m.unidade}</dd></>)}
                    {s.esgotaEm && (<><dt>Estoque dura até</dt><dd>{dataBR(s.esgotaEm)}</dd></>)}
                    {s.pedirAte && (<><dt>Pedir até</dt><dd><b>{dataBR(s.pedirAte)}</b></dd></>)}
                  </dl>
                  {s.saldo < 0 && (
                    <p className="aviso-linha">
                      O gasto estimado passou do que foi recebido. Falta registrar uma entrega ou o material acabou.
                    </p>
                  )}
                  {s.qtdSugerida !== null && s.qtdSugerida > 0 && (
                    <p className="sugestao">
                      Para cobrir {cobertura} dias úteis: pedir <b>{formatNumero(Math.ceil(s.qtdSugerida * 100) / 100)} {m.unidade}</b>
                    </p>
                  )}
                </>
              ) : (
                <p className="mudo">
                  {m.servicoId && m.consumoPorUnidade
                    ? 'Lance a produção e registre as entregas para calcular o saldo.'
                    : 'Informe o serviço e o consumo por unidade (botão Editar) para calcular.'}
                </p>
              )}

              <div className="form-acoes esquerda">
                {m.tipo === 'material' && (
                  <button type="button" className="btn btn-sec" onClick={() => setEntregaPara(m)}>+ Entrega</button>
                )}
                <button type="button" className="btn btn-sec" onClick={() => setForm(m)}>Editar</button>
              </div>

              {m.tipo === 'material' && entregas.some((e) => e.materialId === m.id) && (
                <details>
                  <summary>Entregas registradas ({entregas.filter((e) => e.materialId === m.id).length})</summary>
                  <ul className="lista-simples">
                    {entregas
                      .filter((e) => e.materialId === m.id)
                      .sort((a, b) => b.data.localeCompare(a.data))
                      .map((e) => (
                        <LinhaEntrega key={e.id} e={e} unidade={m.unidade} />
                      ))}
                  </ul>
                </details>
              )}
            </li>
          )
        })}
      </ul>

      <p className="mudo pequeno">
        O gasto é estimado: produção medida × consumo por unidade (+ perda). A data de pedido considera dias úteis
        de estoque menos a antecedência de entrega do fornecedor.
      </p>

      {form && (
        <FormMaterial
          obraId={obra.id}
          existente={form === 'novo' || form === 'concreto' ? undefined : form}
          modelo={form === 'concreto' ? 'concreto' : undefined}
          servicos={servicos.map((s) => ({ id: s.id, nome: s.nome, unidade: s.unidade }))}
          onClose={() => setForm(null)}
        />
      )}
      {entregaPara && (
        <FormEntrega obraId={obra.id} material={entregaPara} onClose={() => setEntregaPara(null)} />
      )}
    </>
  )
}

function LinhaEntrega({ e, unidade }: { e: Entrega; unidade: string }) {
  return (
    <li className="entrega-linha">
      <span>{dataBR(e.data)} · <b>{formatNumero(e.quantidade)} {unidade}</b>{e.obs ? ` — ${e.obs}` : ''}</span>
      <button
        type="button"
        className="link-botao"
        onClick={() => { if (window.confirm('Excluir esta entrega?')) void removerEntrega(e) }}
      >
        excluir
      </button>
    </li>
  )
}

function FormEntrega({ obraId, material, onClose }: { obraId: string; material: Material; onClose: () => void }) {
  const [data, setData] = useState(dataLocal())
  const [qtd, setQtd] = useState('')
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const n = parseNumero(qtd)
    if (!Number.isFinite(n) || n <= 0) { setErro('Informe a quantidade recebida.'); return }
    await registrarEntrega(obraId, material.id, { data, quantidade: n, obs: obs.trim() || undefined })
    onClose()
  }

  return (
    <Modal titulo={`Entrega de ${material.nome}`} onClose={onClose}>
      <form onSubmit={enviar} className="form">
        <label>Data da entrega<input type="date" value={data} max={dataLocal()} onChange={(e) => setData(e.target.value)} /></label>
        <label>
          Quantidade recebida ({material.unidade})
          <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" autoFocus />
        </label>
        <label>Observação (opcional)<input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="ex.: nota 1234, caminhão 2" autoComplete="off" /></label>
        {erro && <p className="erro">{erro}</p>}
        <div className="form-acoes"><button type="submit" className="btn btn-primario">Salvar</button></div>
      </form>
    </Modal>
  )
}

function FormMaterial({
  obraId, existente, modelo, servicos, onClose,
}: {
  obraId: string; existente?: Material; modelo?: 'concreto'
  servicos: { id: string; nome: string; unidade: string }[]; onClose: () => void
}) {
  const concretoServ = servicos.find((s) => /concreto/i.test(s.nome))
  const [tipo, setTipo] = useState<Material['tipo']>(existente?.tipo ?? 'material')
  const [nome, setNome] = useState(existente?.nome ?? (modelo ? 'Concreto' : ''))
  const [unidade, setUnidade] = useState(existente?.unidade ?? (modelo ? 'm³' : ''))
  const [antecedencia, setAntecedencia] = useState(String(existente?.antecedenciaDias ?? 2))
  const [servicoId, setServicoId] = useState(existente?.servicoId ?? (modelo ? concretoServ?.id ?? '' : ''))
  const [consumo, setConsumo] = useState(existente?.consumoPorUnidade !== undefined ? String(existente.consumoPorUnidade).replace('.', ',') : '')
  const [perda, setPerda] = useState(String(existente?.perdaPct ?? 0).replace('.', ','))
  const [espessura, setEspessura] = useState('')
  const [necessarias, setNecessarias] = useState(existente?.quantidadeNecessaria !== undefined ? String(existente.quantidadeNecessaria) : '')
  const [disponiveis, setDisponiveis] = useState(existente?.quantidadeDisponivel !== undefined ? String(existente.quantidadeDisponivel) : '')
  const [dataNec, setDataNec] = useState(existente?.dataNecessaria ?? '')
  const [erro, setErro] = useState('')

  const servSel = servicos.find((s) => s.id === servicoId)

  function aoMudarEspessura(v: string) {
    setEspessura(v)
    const cm = parseNumero(v)
    if (Number.isFinite(cm) && cm > 0) setConsumo(String(cm / 100).replace('.', ','))
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const ant = parseNumero(antecedencia)
    if (!nome.trim()) { setErro('Informe o nome.'); return }
    if (!Number.isFinite(ant) || ant < 0) { setErro('Informe a antecedência em dias (pode ser 0).'); return }
    let dados: DadosMaterial
    if (tipo === 'material') {
      const c = parseNumero(consumo)
      const p = perda.trim() ? parseNumero(perda) : 0
      if (!unidade.trim()) { setErro('Informe a unidade (ex.: m³, peças, sacos).'); return }
      if (!servicoId) { setErro('Escolha o serviço que consome este material.'); return }
      if (!Number.isFinite(c) || c <= 0) { setErro('Informe o consumo por unidade do serviço (maior que zero).'); return }
      if (!Number.isFinite(p) || p < 0) { setErro('A perda deve ser um número (pode ser 0).'); return }
      dados = { tipo, nome: nome.trim(), unidade: unidade.trim(), antecedenciaDias: ant, servicoId, consumoPorUnidade: c, perdaPct: p }
    } else {
      const nec = parseNumero(necessarias)
      const disp = disponiveis.trim() ? parseNumero(disponiveis) : 0
      if (!Number.isFinite(nec) || nec < 0) { setErro('Informe quantas unidades são necessárias.'); return }
      if (!Number.isFinite(disp) || disp < 0) { setErro('Informe quantas já estão disponíveis (pode ser 0).'); return }
      dados = {
        tipo, nome: nome.trim(), unidade: unidade.trim() || 'un', antecedenciaDias: ant,
        quantidadeNecessaria: nec, quantidadeDisponivel: disp, dataNecessaria: dataNec || undefined,
      }
    }
    await salvarMaterial(obraId, dados, existente)
    onClose()
  }

  return (
    <Modal titulo={existente ? 'Editar item' : 'Novo item'} onClose={onClose}>
      <form onSubmit={enviar} className="form">
        <div className="segmentos pequeno-seg" role="group" aria-label="Tipo">
          <button type="button" className={tipo === 'material' ? 'ativo' : ''} onClick={() => setTipo('material')}>Material (gasta)</button>
          <button type="button" className={tipo === 'ferramenta' ? 'ativo' : ''} onClick={() => setTipo('ferramenta')}>Ferramenta / equipamento</button>
        </div>
        <label>Nome<input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={tipo === 'material' ? 'ex.: Concreto, Meio-fio' : 'ex.: Régua vibratória'} autoComplete="off" /></label>

        {tipo === 'material' ? (
          <>
            <div className="linha-campos">
              <label>Unidade<input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="m³, peças, sacos" autoComplete="off" /></label>
              <label>Pedir com antecedência de (dias)<input value={antecedencia} onChange={(e) => setAntecedencia(e.target.value)} inputMode="numeric" /></label>
            </div>
            <label>
              Serviço que consome
              <select value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
                <option value="">— escolha —</option>
                {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome} ({s.unidade})</option>)}
              </select>
            </label>
            <label>
              Consumo por {servSel ? servSel.unidade : 'unidade'} do serviço
              <input value={consumo} onChange={(e) => setConsumo(e.target.value)} inputMode="decimal" placeholder="ex.: 0,08" />
              <span className="ajuda">
                Ex.: concreto de calçada = espessura em metros por m² (8 cm → 0,08 m³ por m²). Meio-fio de 1 m → 1 peça por metro.
              </span>
            </label>
            <label>
              Calcular pela espessura (cm), só para concreto
              <input value={espessura} onChange={(e) => aoMudarEspessura(e.target.value)} inputMode="decimal" placeholder="ex.: 8" />
            </label>
            <label>Perda / sobra a somar (%)<input value={perda} onChange={(e) => setPerda(e.target.value)} inputMode="decimal" /></label>
          </>
        ) : (
          <>
            <div className="linha-campos">
              <label>Necessárias<input value={necessarias} onChange={(e) => setNecessarias(e.target.value)} inputMode="numeric" /></label>
              <label>Já disponíveis<input value={disponiveis} onChange={(e) => setDisponiveis(e.target.value)} inputMode="numeric" /></label>
            </div>
            <div className="linha-campos">
              <label>Precisa a partir de<input type="date" value={dataNec} onChange={(e) => setDataNec(e.target.value)} /></label>
              <label>Pedir com antecedência de (dias)<input value={antecedencia} onChange={(e) => setAntecedencia(e.target.value)} inputMode="numeric" /></label>
            </div>
          </>
        )}

        {erro && <p className="erro">{erro}</p>}
        <div className="form-acoes">
          {existente && (
            <button type="button" className="btn btn-perigo" onClick={async () => {
              if (window.confirm('Excluir este item?')) { await removerMaterial(existente); onClose() }
            }}>Excluir</button>
          )}
          <button type="submit" className="btn btn-primario">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}
