import { Link } from 'react-router-dom'
import { useDados } from '../hooks/useDados'
import { compararPrazo, preverObra, preverServicos, statusMaterial } from '../lib/analise'
import { dataBR, dataCurta, dataLocal, diaSemana, ehIOS, emModoApp, formatNumero } from '../lib/util'
import { ultimoBackup } from '../repo/backup'

export default function Hoje() {
  const { obra, servicos, trechos, funcionarios: funcs, frequencias, medicoes, materiais, entregas } = useDados()
  const hoje = dataLocal()

  const ativos = funcs.filter((f) => f.ativo)
  const idsAtivos = new Set(ativos.map((f) => f.id))
  const doDia = frequencias.filter((r) => r.data === hoje && idsAtivos.has(r.funcionarioId))
  const presentes = doDia.filter((r) => r.status === 'presente').length
  const atrasos = doDia.filter((r) => r.status === 'atraso').length
  const faltas = doDia.filter((r) => r.status === 'falta').length
  const semRegistro = ativos.length - doDia.length

  const prevs = preverServicos(servicos, medicoes, hoje)
  const prevObra = preverObra(prevs)
  const cmp = obra.prazoFinal && prevObra.termino ? compararPrazo(prevObra.termino, obra.prazoFinal) : null
  const producaoHoje = servicos
    .map((s) => ({ s, q: medicoes.filter((m) => m.servicoId === s.id && m.data === hoje).reduce((t, m) => t + m.quantidade, 0) }))
    .filter((x) => x.q > 0)
  const alertas = materiais
    .map((m) => statusMaterial(m, { servicos, medicoes, entregas, hoje }))
    .filter((x) => x.situacao === 'pedir' || x.situacao === 'atencao')

  const nServicos = servicos.length
  const nTrechos = trechos.length

  const ub = ultimoBackup()
  const diasSemBackup = ub ? Math.floor((Date.now() - new Date(ub).getTime()) / 86400000) : null
  const precisaBackup = ativos.length > 0 && (diasSemBackup === null || diasSemBackup >= 3)

  return (
    <div className="pagina">
      <p className="data-topo">
        {diaSemana(hoje)}, {dataBR(hoje)}
      </p>

      {ehIOS() && !emModoApp() && (
        <div className="aviso aviso-info">
          <strong>Instale o app no iPhone:</strong> no Safari, toque em Compartilhar e depois em
          “Adicionar à Tela de Início”. Instalado, ele funciona sem sinal e o iPhone não apaga os dados.
        </div>
      )}

      {precisaBackup && (
        <div className="aviso aviso-alerta">
          {diasSemBackup === null
            ? 'Você ainda não fez nenhum backup.'
            : `Último backup há ${diasSemBackup} dias.`}{' '}
          <Link to="/ajustes">Fazer backup agora</Link>
        </div>
      )}

      <section className="cartao">
        <div className="cartao-titulo">
          <h2>Presença de hoje</h2>
          <Link to="/chamada" className="link-acao">Abrir chamada</Link>
        </div>
        {ativos.length === 0 ? (
          <p className="mudo">
            Nenhum funcionário cadastrado. <Link to="/equipe">Cadastrar equipe</Link>
          </p>
        ) : (
          <div className="resumo-grade">
            <div className="resumo ok"><b>{presentes}</b><span>presentes</span></div>
            <div className="resumo atraso"><b>{atrasos}</b><span>atrasos</span></div>
            <div className="resumo falta"><b>{faltas}</b><span>faltas</span></div>
            <div className="resumo neutro"><b>{semRegistro}</b><span>sem registro</span></div>
          </div>
        )}
      </section>

      <section className="cartao">
        <div className="cartao-titulo">
          <h2>Produção de hoje</h2>
          <Link to="/medicao" className="link-acao">Lançar</Link>
        </div>
        {producaoHoje.length === 0 ? (
          <p className="mudo">Nada lançado hoje.</p>
        ) : (
          <dl className="dados">
            {producaoHoje.map(({ s, q }) => (<><dt key={s.id + 't'}>{s.nome}</dt><dd key={s.id + 'd'}>{formatNumero(q)} {s.unidade}</dd></>))}
          </dl>
        )}
        {prevObra.termino && (
          <p className="pequeno" style={{ marginTop: 10, marginBottom: 0 }}>
            Previsão de término: <b>{dataBR(prevObra.termino)}</b>
            {cmp && (cmp.diasUteis > 0
              ? <span className="erro"> · {cmp.diasUteis} dias úteis após o prazo</span>
              : <span className="ok-texto"> · dentro do prazo</span>)}
          </p>
        )}
      </section>

      {alertas.length > 0 && (
        <section className="cartao">
          <div className="cartao-titulo">
            <h2>Atenção: pedidos</h2>
            <Link to="/analises/materiais" className="link-acao">Ver</Link>
          </div>
          <ul className="lista-simples">
            {alertas.map((a) => (
              <li key={a.material.id}>
                <b>{a.material.nome}</b>{' '}
                {a.situacao === 'pedir' ? <span className="erro">pedir agora</span>
                  : <span>pedir até {a.pedirAte ? dataCurta(a.pedirAte) : ''}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(nServicos === 0 || nTrechos === 0 || ativos.length === 0) && (
        <section className="cartao">
          <h2>Para começar</h2>
          <ul className="checklist">
            <li className={nServicos > 0 ? 'feito' : ''}>
              <Link to="/obra">Cadastrar os serviços da obra</Link> <span className="mudo">({nServicos})</span>
            </li>
            <li className={nTrechos > 0 ? 'feito' : ''}>
              <Link to="/obra">Cadastrar os trechos</Link> <span className="mudo">({nTrechos})</span>
            </li>
            <li className={ativos.length > 0 ? 'feito' : ''}>
              <Link to="/equipe">Cadastrar a equipe</Link> <span className="mudo">({ativos.length})</span>
            </li>
          </ul>
        </section>
      )}

      <section className="cartao">
        <h2>Atalhos</h2>
        <div className="atalhos">
          <Link to="/chamada" className="atalho">Chamada do dia</Link>
          <Link to="/medicao" className="atalho">Lançar produção</Link>
          <Link to="/analises/previsao" className="atalho">Previsão da obra</Link>
          <Link to="/analises/materiais" className="atalho">Materiais</Link>
          <Link to="/analises/faltas" className="atalho">Faltas</Link>
          <span className="atalho desativado">Fotos<small>em breve</small></span>
        </div>
      </section>
    </div>
  )
}
