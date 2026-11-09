import { useRef, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { UNIDADES, type Servico, type Trecho, type Unidade } from '../db/types'
import { Modal } from '../components/Modal'
import { useObra } from '../state/ObraContext'
import { brl, formatNumero } from '../lib/util'
import { parseNumero } from '../lib/forms'
import { definirLogoEmpresa, salvarObra } from '../repo/obra'
import { useLogoEmpresa } from '../hooks/useLogoEmpresa'
import { reduzirLogo } from '../lib/fotos'
import { removerServico, removerTrecho, salvarServico, salvarTrecho } from '../repo/cadastros'

export default function ObraPage() {
  const obra = useObra()
  const servicos = useLiveQuery(() => db.servicos.where('obraId').equals(obra.id).toArray(), [obra.id], [])
  const trechos = useLiveQuery(() => db.trechos.where('obraId').equals(obra.id).toArray(), [obra.id], [])

  const [nome, setNome] = useState(obra.nome)
  const [empresa, setEmpresa] = useState(obra.empresa)
  const [local, setLocal] = useState(obra.local)
  const [inicio, setInicio] = useState(obra.inicio ?? '')
  const [prazo, setPrazo] = useState(obra.prazoFinal ?? '')
  const [fech, setFech] = useState(String(obra.diaFechamento ?? 31))
  const [salvo, setSalvo] = useState(false)

  const logo = useLogoEmpresa(obra)
  const inputLogo = useRef<HTMLInputElement>(null)
  const [erroLogo, setErroLogo] = useState('')

  async function trocarLogo(arquivo: File) {
    setErroLogo('')
    try {
      await definirLogoEmpresa(obra.id, await reduzirLogo(arquivo))
    } catch (e) {
      setErroLogo((e as Error).message)
    } finally {
      if (inputLogo.current) inputLogo.current.value = ''
    }
  }

  async function removerLogo() {
    if (!window.confirm('Remover o logo da empresa? Os relatórios passam a mostrar só o nome.')) return
    await definirLogoEmpresa(obra.id, null)
  }

  const [editServ, setEditServ] = useState<Servico | 'novo' | null>(null)
  const [editTrecho, setEditTrecho] = useState<Trecho | 'novo' | null>(null)

  const listaServ = servicos.filter((s) => !s.deletedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const listaTrechos = trechos.filter((t) => !t.deletedAt).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))

  async function salvar(e: FormEvent) {
    e.preventDefault()
    await salvarObra(obra, { nome: nome.trim() || 'Minha obra', empresa: empresa.trim(), local: local.trim(),
      inicio: inicio || undefined, prazoFinal: prazo || undefined,
      diaFechamento: Math.min(31, Math.max(1, Math.round(Number(fech)) || 31)),
    })
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  return (
    <div className="pagina">
      <h1>Obra</h1>

      <section className="cartao">
        <h2>Dados da obra</h2>
        <form onSubmit={salvar} className="form">
          <label>
            Nome da obra
            <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />
          </label>
          <label>
            Empresa contratante do acompanhamento
            <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="ex.: BW Engenharia Ltda" autoComplete="off" />
          </label>
          <label>
            Local
            <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="ex.: Maricá – RJ" autoComplete="off" />
          </label>
          <div className="linha-campos">
            <label>Início da obra<input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
            <label>Prazo final (opcional)<input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></label>
          </div>
          <label>
            Dia de fechamento da medição (1 a 31; 31 = fim do mês)
            <input value={fech} onChange={(e) => setFech(e.target.value)} inputMode="numeric" />
          </label>
          <div className="form-acoes">
            {salvo && <span className="ok-texto">Salvo ✓</span>}
            <button type="submit" className="btn btn-primario">Salvar</button>
          </div>
        </form>
      </section>

      <section className="cartao">
        <h2>Logo da empresa</h2>
        <p className="mudo pequeno">
          Aparece no cabeçalho de todos os relatórios desta obra
          {obra.empresa.trim() ? <>, junto com o nome <b>{obra.empresa}</b></> : ''}. Use PNG ou JPEG; fundo
          transparente fica melhor.
        </p>
        {logo ? (
          <img src={logo} alt={`Logo de ${obra.empresa || 'empresa'}`} className="logo-previa" />
        ) : (
          <p className="mudo">Sem logo: o relatório mostra só o nome da empresa.</p>
        )}
        <div className="form-acoes esquerda">
          <button type="button" className="btn btn-sec" onClick={() => inputLogo.current?.click()}>
            {logo ? 'Trocar logo' : 'Escolher imagem'}
          </button>
          {logo && <button type="button" className="btn btn-perigo" onClick={() => void removerLogo()}>Remover</button>}
          <input ref={inputLogo} type="file" accept="image/*" hidden data-testid="input-logo"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void trocarLogo(f) }} />
        </div>
        {erroLogo && <p className="erro">{erroLogo}</p>}
      </section>

      <section className="cartao">
        <div className="cartao-titulo">
          <h2>Serviços da obra</h2>
          <button type="button" className="btn btn-sec" onClick={() => setEditServ('novo')}>+ Serviço</button>
        </div>
        {listaServ.length === 0 ? (
          <p className="mudo">Cadastre os serviços que serão medidos (ex.: meio-fio, calçada).</p>
        ) : (
          <ul className="lista">
            {listaServ.map((s) => (
              <li key={s.id} className="item">
                <div className="item-texto">
                  <b>{s.nome}</b>
                  <span className="mudo">previsto: {formatNumero(s.quantidadePrevista)} {s.unidade}{s.precoUnitario ? ` · ${brl(s.precoUnitario)}/${s.unidade}` : ''}</span>
                </div>
                <button type="button" className="btn btn-sec" onClick={() => setEditServ(s)}>Editar</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cartao">
        <div className="cartao-titulo">
          <h2>Trechos / frentes</h2>
          <button type="button" className="btn btn-sec" onClick={() => setEditTrecho('novo')}>+ Trecho</button>
        </div>
        {listaTrechos.length === 0 ? (
          <p className="mudo">Cadastre as ruas ou trechos onde a equipe vai atuar.</p>
        ) : (
          <ul className="lista">
            {listaTrechos.map((t) => (
              <li key={t.id} className="item">
                <div className="item-texto">
                  <b>{t.nome}</b>
                  {t.descricao && <span className="mudo">{t.descricao}</span>}
                </div>
                <button type="button" className="btn btn-sec" onClick={() => setEditTrecho(t)}>Editar</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editServ && (
        <FormServico obraId={obra.id} existente={editServ === 'novo' ? undefined : editServ} onClose={() => setEditServ(null)} />
      )}
      {editTrecho && (
        <FormTrecho obraId={obra.id} existente={editTrecho === 'novo' ? undefined : editTrecho} onClose={() => setEditTrecho(null)} />
      )}
    </div>
  )
}

function FormServico({ obraId, existente, onClose }: { obraId: string; existente?: Servico; onClose: () => void }) {
  const [nome, setNome] = useState(existente?.nome ?? '')
  const [unidade, setUnidade] = useState<Unidade>(existente?.unidade ?? 'm')
  const [qtd, setQtd] = useState(existente ? String(existente.quantidadePrevista).replace('.', ',') : '')
  const [preco, setPreco] = useState(existente?.precoUnitario !== undefined ? String(existente.precoUnitario).replace('.', ',') : '')
  const [erro, setErro] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const n = parseNumero(qtd)
    const pr = preco.trim() ? parseNumero(preco) : undefined
    if (pr !== undefined && (!Number.isFinite(pr) || pr < 0)) { setErro('Preço inválido.'); return }
    if (!nome.trim()) { setErro('Informe o nome do serviço.'); return }
    if (!Number.isFinite(n) || n < 0) { setErro('Informe a quantidade prevista (número).'); return }
    await salvarServico(obraId, { nome: nome.trim(), unidade, quantidadePrevista: n, precoUnitario: pr }, existente)
    onClose()
  }

  return (
    <Modal titulo={existente ? 'Editar serviço' : 'Novo serviço'} onClose={onClose}>
      <form onSubmit={enviar} className="form">
        <label>
          Serviço
          <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus autoComplete="off" />
        </label>
        <div className="linha-campos">
          <label>
            Unidade
            <select value={unidade} onChange={(e) => setUnidade(e.target.value as Unidade)}>
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label>
            Quantidade prevista
            <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" placeholder="ex.: 3500" />
          </label>
        </div>
        <label>
          Preço unitário R$ (opcional, para estimar a medição)
          <input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" placeholder="ex.: 38,00" />
        </label>
        {erro && <p className="erro">{erro}</p>}
        <div className="form-acoes">
          {existente && (
            <button
              type="button"
              className="btn btn-perigo"
              onClick={async () => { await removerServico(existente); onClose() }}
            >
              Excluir
            </button>
          )}
          <button type="submit" className="btn btn-primario">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}

function FormTrecho({ obraId, existente, onClose }: { obraId: string; existente?: Trecho; onClose: () => void }) {
  const [nome, setNome] = useState(existente?.nome ?? '')
  const [descricao, setDescricao] = useState(existente?.descricao ?? '')
  const [erro, setErro] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) { setErro('Informe o nome do trecho.'); return }
    await salvarTrecho(obraId, { nome: nome.trim(), descricao: descricao.trim() || undefined }, existente)
    onClose()
  }

  return (
    <Modal titulo={existente ? 'Editar trecho' : 'Novo trecho'} onClose={onClose}>
      <form onSubmit={enviar} className="form">
        <label>
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="ex.: Rua das Flores" autoComplete="off" />
        </label>
        <label>
          Descrição (opcional)
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="ex.: do nº 100 ao 480" autoComplete="off" />
        </label>
        {erro && <p className="erro">{erro}</p>}
        <div className="form-acoes">
          {existente && (
            <button
              type="button"
              className="btn btn-perigo"
              onClick={async () => { await removerTrecho(existente); onClose() }}
            >
              Excluir
            </button>
          )}
          <button type="submit" className="btn btn-primario">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}
