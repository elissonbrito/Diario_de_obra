import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AdicionarFotos } from '../components/AdicionarFotos'
import { GradeFotos } from '../components/GradeFotos'
import { Modal } from '../components/Modal'
import { SeletorData } from '../components/SeletorData'
import { db } from '../db/db'
import { CLIMAS, type Clima } from '../db/types'
import { useDados } from '../hooks/useDados'
import { diarioTemConteudo, diasUteisPendentes, efetivoDoDia, idDiario, producaoDoDia, trechoInicial } from '../lib/diario'
import { dataBR, dataCurta, dataLocal, diaSemanaCurto, formatNumero } from '../lib/util'
import { salvarDiario, type CamposDiario } from '../repo/diario'

const ATRASO_SALVAR_MS = 600

export default function DiarioPage() {
  const { obra, servicos, trechos, funcionariosTodos, frequencias, medicoes, diarios, fotos } = useDados()
  const hoje = dataLocal()
  const [params, setParams] = useSearchParams()
  const data = params.get('data') || hoje
  const setData = (d: string) => setParams({ data: d }, { replace: true })
  const [relatorio, setRelatorio] = useState(false)

  const validos = new Set(funcionariosTodos.filter((f) => !f.deletedAt).map((f) => f.id))
  const efetivo = efetivoDoDia(frequencias, data, validos)
  const producao = producaoDoDia(servicos, medicoes, data)
  const fotosDoDia = fotos.filter((f) => f.data === data)

  // "Dias registrados": dias com diário preenchido ou com fotos, mais os dias úteis pendentes.
  const comDiario = new Map(diarios.filter(diarioTemConteudo).map((d) => [d.data, d]))
  const nFotos = new Map<string, number>()
  for (const f of fotos) nFotos.set(f.data, (nFotos.get(f.data) ?? 0) + 1)
  const pendentes = diasUteisPendentes(hoje, new Set(comDiario.keys()), 14, obra.inicio)
  const dias = [...new Set([...comDiario.keys(), ...nFotos.keys(), ...pendentes])].sort((a, b) => b.localeCompare(a))

  return (
    <div className="pagina">
      <div className="titulo-linha">
        <h1>Diário de obra</h1>
        <button type="button" className="btn btn-sec" onClick={() => setRelatorio(true)}>Gerar relatório</button>
      </div>

      <SeletorData data={data} setData={setData} hoje={hoje} />

      <FormDiario key={data} obraId={obra.id} data={data} />

      <section className="cartao">
        <div className="cartao-titulo">
          <h2>Efetivo do dia</h2>
          <Link to="/chamada" className="link-acao">Chamada</Link>
        </div>
        {efetivo.total === 0 ? (
          <p className="mudo">Nenhuma chamada registrada neste dia.</p>
        ) : (
          <div className="resumo-grade resumo-3" data-testid="efetivo">
            <div className="resumo ok"><b>{efetivo.presentes}</b><span>presentes</span></div>
            <div className="resumo atraso"><b>{efetivo.atrasos}</b><span>atrasos</span></div>
            <div className="resumo falta"><b>{efetivo.faltas}</b><span>faltas</span></div>
          </div>
        )}
      </section>

      <section className="cartao">
        <div className="cartao-titulo">
          <h2>Produção do dia</h2>
          <Link to="/medicao" className="link-acao">Lançar</Link>
        </div>
        {producao.length === 0 ? (
          <p className="mudo">Nenhuma produção lançada neste dia.</p>
        ) : (
          <dl className="dados" data-testid="producao">
            {producao.map(({ servico, quantidade }) => (
              <Fragment key={servico.id}>
                <dt>{servico.nome}</dt><dd>{formatNumero(quantidade)} {servico.unidade}</dd>
              </Fragment>
            ))}
          </dl>
        )}
      </section>

      <section className="cartao" id="fotos">
        <div className="cartao-titulo">
          <h2>Fotos do dia {fotosDoDia.length > 0 && <span className="mudo">({fotosDoDia.length})</span>}</h2>
          <Link to={`/fotos?data=${data}`} className="link-acao">Abrir fotos</Link>
        </div>
        <AdicionarFotos data={data} servicos={servicos} trechos={trechos} />
        {fotosDoDia.length > 0 && <GradeFotos fotos={fotosDoDia} servicos={servicos} trechos={trechos} />}
      </section>

      <h2 className="subtitulo">Dias registrados</h2>
      {dias.length === 0 ? (
        <p className="mudo">Nenhum dia registrado ainda.</p>
      ) : (
        <ul className="lista" data-testid="dias-registrados">
          {dias.map((d) => {
            const diario = comDiario.get(d)
            const n = nFotos.get(d) ?? 0
            return (
              <li key={d}>
                <button type="button" className={`item item-botao${d === data ? ' selecionado' : ''}`} onClick={() => { setData(d); window.scrollTo(0, 0) }}>
                  <span className="item-texto">
                    <b>{diaSemanaCurto(d)}, {dataCurta(d)}</b>
                    <span className="mudo pequeno">
                      {diario?.atividades?.trim() ? trechoInicial(diario.atividades) : diario ? 'Sem texto de atividades' : 'Sem diário'}
                    </span>
                  </span>
                  <span className="etiquetas">
                    {n > 0 && <span className="etq neutro">{n} {n === 1 ? 'foto' : 'fotos'}</span>}
                    {!diario && pendentes.includes(d) && <span className="etq atraso">pendente</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {relatorio && <EscolherRelatorio data={data} hoje={hoje} onClose={() => setRelatorio(false)} />}
    </div>
  )
}

type EstadoSalvar = 'salvo' | 'pendente' | 'erro' | null

/**
 * Formulário do dia. Montado com key={data}: ao trocar a data, o anterior desmonta e grava o que faltava.
 * Só grava os campos que o usuário mexeu (salvarDiario faz update no banco, não put da cópia da tela).
 */
function FormDiario({ obraId, data }: { obraId: string; data: string }) {
  const [form, setForm] = useState<CamposDiario | null>(null)
  const [estado, setEstado] = useState<EstadoSalvar>(null)
  const [novoEquip, setNovoEquip] = useState('')
  const atual = useRef<CamposDiario>({})
  const sujos = useRef(new Set<keyof CamposDiario>())
  const timer = useRef<number>()

  useEffect(() => {
    let vivo = true
    void db.diarios.get(idDiario(obraId, data)).then((d) => {
      if (!vivo) return
      const inicial: CamposDiario = {
        climaManha: d?.climaManha, climaTarde: d?.climaTarde, paralisacao: d?.paralisacao,
        motivoParalisacao: d?.motivoParalisacao ?? '', atividades: d?.atividades ?? d?.resumo ?? '',
        equipamentos: d?.equipamentos ?? [], ocorrencias: d?.ocorrencias ?? '',
      }
      atual.current = inicial
      setForm(inicial)
    })
    return () => { vivo = false }
  }, [obraId, data])

  const gravar = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    if (sujos.current.size === 0) return
    const campos: CamposDiario = {}
    for (const k of sujos.current) (campos as Record<string, unknown>)[k] = atual.current[k]
    sujos.current.clear()
    salvarDiario(obraId, data, campos)
      .then(() => { if (sujos.current.size === 0) setEstado('salvo') })
      .catch(() => setEstado('erro'))
  }, [obraId, data])

  // Grava o que estiver pendente ao sair da tela, trocar de dia ou mandar o app para segundo plano.
  useEffect(() => {
    const aoEsconder = () => { if (document.visibilityState === 'hidden') gravar() }
    document.addEventListener('visibilitychange', aoEsconder)
    window.addEventListener('pagehide', gravar)
    return () => {
      document.removeEventListener('visibilitychange', aoEsconder)
      window.removeEventListener('pagehide', gravar)
      gravar()
    }
  }, [gravar])

  function mudar<K extends keyof CamposDiario>(campo: K, valor: CamposDiario[K]) {
    atual.current = { ...atual.current, [campo]: valor }
    sujos.current.add(campo)
    setForm(atual.current)
    setEstado('pendente')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(gravar, ATRASO_SALVAR_MS)
  }

  function adicionarEquip(e: FormEvent) {
    e.preventDefault()
    const nome = novoEquip.trim()
    if (!nome) return
    mudar('equipamentos', [...(atual.current.equipamentos ?? []), nome])
    setNovoEquip('')
  }

  function removerEquip(i: number) {
    const lista = atual.current.equipamentos ?? []
    if (!window.confirm(`Remover “${lista[i]}” da lista de equipamentos?`)) return
    mudar('equipamentos', lista.filter((_, j) => j !== i))
  }

  if (!form) return <section className="cartao"><p className="mudo">Carregando…</p></section>

  return (
    <section className="cartao destaque form-diario">
      <div className="cartao-titulo">
        <h2>Registro do dia</h2>
        <span className={`estado-salvar ${estado ?? ''}`} role="status" aria-live="polite">
          {estado === 'salvo' ? 'Salvo ✓' : estado === 'pendente' ? 'Salvando…' : estado === 'erro' ? 'Erro ao salvar' : ''}
        </span>
      </div>

      <SeletorClima rotulo="Clima da manhã" valor={form.climaManha} onChange={(c) => mudar('climaManha', c)} />
      <SeletorClima rotulo="Clima da tarde" valor={form.climaTarde} onChange={(c) => mudar('climaTarde', c)} />

      <fieldset className="campo">
        <legend>Houve paralisação?</legend>
        <div className="segmentos pequeno-seg">
          <button type="button" className={form.paralisacao === false ? 'ativo' : ''} aria-pressed={form.paralisacao === false}
            onClick={() => mudar('paralisacao', form.paralisacao === false ? undefined : false)}>Não</button>
          <button type="button" className={form.paralisacao ? 'ativo' : ''} aria-pressed={form.paralisacao === true}
            onClick={() => mudar('paralisacao', form.paralisacao ? undefined : true)}>Sim</button>
        </div>
        {form.paralisacao && (
          <label>
            Motivo (opcional)
            <input value={form.motivoParalisacao ?? ''} onChange={(e) => mudar('motivoParalisacao', e.target.value)}
              placeholder="ex.: chuva forte das 13h às 15h" autoComplete="off" />
          </label>
        )}
      </fieldset>

      <label>
        Atividades realizadas no dia
        <textarea className="texto-grande" value={form.atividades ?? ''} onChange={(e) => mudar('atividades', e.target.value)}
          placeholder="O que foi feito hoje, onde e com qual equipe." rows={7} />
      </label>

      <fieldset className="campo">
        <legend>Equipamentos em obra</legend>
        {(form.equipamentos ?? []).length > 0 && (
          <ul className="lista-simples equipamentos">
            {(form.equipamentos ?? []).map((eq, i) => (
              <li key={`${eq}-${i}`} className="entrega-linha">
                <span>{eq}</span>
                <button type="button" className="btn-icone" onClick={() => removerEquip(i)} aria-label={`Remover ${eq}`}>✕</button>
              </li>
            ))}
          </ul>
        )}
        <form className="linha-adicionar" onSubmit={adicionarEquip}>
          <input value={novoEquip} onChange={(e) => setNovoEquip(e.target.value)} placeholder="ex.: Retroescavadeira"
            aria-label="Novo equipamento" autoComplete="off" />
          <button type="submit" className="btn btn-sec">Adicionar</button>
        </form>
      </fieldset>

      <label>
        Ocorrências / observações
        <textarea value={form.ocorrencias ?? ''} onChange={(e) => mudar('ocorrencias', e.target.value)}
          placeholder="Visitas, pedidos e chegadas de material, problemas, acidentes…" rows={4} />
      </label>
    </section>
  )
}

function SeletorClima({ rotulo, valor, onChange }: { rotulo: string; valor?: Clima; onChange: (c?: Clima) => void }) {
  return (
    <fieldset className="campo">
      <legend>{rotulo}</legend>
      <div className="segmentos pequeno-seg clima">
        {CLIMAS.map((c) => (
          <button key={c.valor} type="button" className={valor === c.valor ? 'ativo' : ''} aria-pressed={valor === c.valor}
            onClick={() => onChange(valor === c.valor ? undefined : c.valor)}>
            {c.rotulo}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function EscolherRelatorio({ data, hoje, onClose }: { data: string; hoje: string; onClose: () => void }) {
  const navigate = useNavigate()
  const [tipo, setTipo] = useState<'dia' | 'periodo'>('dia')
  const [de, setDe] = useState(data.slice(0, 8) + '01')
  const [ate, setAte] = useState(data)
  const [erro, setErro] = useState('')

  function gerar(e: FormEvent) {
    e.preventDefault()
    const [ini, fim] = tipo === 'dia' ? [data, data] : [de, ate]
    if (!ini || !fim) { setErro('Informe a data inicial e a final.'); return }
    if (fim < ini) { setErro('A data final não pode ser antes da inicial.'); return }
    navigate(`/relatorio?de=${ini}&ate=${fim}`)
  }

  return (
    <Modal titulo="Gerar relatório" onClose={onClose}>
      <form className="form" onSubmit={gerar}>
        <div className="segmentos">
          <button type="button" className={tipo === 'dia' ? 'ativo' : ''} onClick={() => setTipo('dia')}>Do dia</button>
          <button type="button" className={tipo === 'periodo' ? 'ativo' : ''} onClick={() => setTipo('periodo')}>Por período</button>
        </div>
        {tipo === 'dia' ? (
          <p className="mudo">Relatório de {dataBR(data)}.</p>
        ) : (
          <div className="linha-campos">
            <label>De<input type="date" value={de} max={hoje} onChange={(e) => setDe(e.target.value)} /></label>
            <label>Até<input type="date" value={ate} max={hoje} onChange={(e) => setAte(e.target.value)} /></label>
          </div>
        )}
        <p className="mudo pequeno">Entram só os dias com diário preenchido ou com fotos.</p>
        {erro && <p className="erro">{erro}</p>}
        <div className="form-acoes">
          <button type="submit" className="btn btn-primario">Abrir relatório</button>
        </div>
      </form>
    </Modal>
  )
}
