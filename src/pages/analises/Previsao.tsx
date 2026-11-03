import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Barra } from '../../components/Barra'
import { useDados } from '../../hooks/useDados'
import {
  compararPrazo, diasUteis, estimarMedicao, preverObra, preverServicos, ritmoNecessario, addDias,
} from '../../lib/analise'
import { brl, dataBR, dataCurta, dataLocal, formatNumero } from '../../lib/util'

export default function Previsao() {
  const { obra, servicos, medicoes } = useDados()
  const hoje = dataLocal()
  const [janela, setJanela] = useState(14)

  const previsoes = preverServicos(servicos, medicoes, hoje, janela)
  const pObra = preverObra(previsoes)
  const prazo = obra.prazoFinal
  const cmp = pObra.termino && prazo ? compararPrazo(pObra.termino, prazo) : null
  const diasComDados = new Set(medicoes.map((m) => m.data)).size
  const diaFech = obra.diaFechamento ?? 31
  const est = estimarMedicao(servicos, medicoes, hoje, diaFech, janela)

  if (servicos.length === 0) {
    return <p className="mudo">Cadastre os serviços em <Link to="/obra">Obra</Link> para ver a previsão.</p>
  }

  return (
    <>
      <div className="segmentos pequeno-seg" role="group" aria-label="Período usado para calcular o ritmo">
        {[7, 14, 30].map((n) => (
          <button key={n} type="button" className={janela === n ? 'ativo' : ''} onClick={() => setJanela(n)}>
            Ritmo dos últimos {n} dias úteis
          </button>
        ))}
      </div>

      {diasComDados < 5 && (
        <div className="aviso aviso-info">
          {diasComDados === 0
            ? 'Ainda não há produção lançada. Lance a medição diária na aba Medição para gerar a previsão.'
            : `Só há ${diasComDados} dia(s) com produção lançada. A previsão fica confiável depois de uns 10 dias de dados.`}
        </div>
      )}

      <section className="cartao destaque">
        <h2>Término previsto da obra</h2>
        {pObra.concluida ? (
          <p className="grande ok-texto">Todos os serviços concluídos ✓</p>
        ) : pObra.termino ? (
          <>
            <p className="grande">{dataBR(pObra.termino)}</p>
            <p className="mudo">mantendo o ritmo atual (considera segunda a sexta)</p>
          </>
        ) : (
          <p className="mudo">Sem dados suficientes para prever.</p>
        )}
        {cmp && prazo && (
          <p className={cmp.situacao === 'atrasada' ? 'erro' : 'ok-texto'}>
            Prazo final {dataBR(prazo)}:{' '}
            {cmp.situacao === 'atrasada' && `${cmp.diasUteis} dia(s) útil(eis) de ATRASO`}
            {cmp.situacao === 'adiantada' && `${cmp.diasUteis} dia(s) útil(eis) de folga`}
            {cmp.situacao === 'no-prazo' && 'no limite do prazo'}
          </p>
        )}
        {!prazo && (
          <p className="mudo pequeno">
            Quer comparar com o prazo? Informe o <Link to="/obra">prazo final em Obra</Link>.
          </p>
        )}
        {pObra.semPrevisao.length > 0 && (
          <p className="mudo pequeno">
            Sem ritmo ainda (não entram na data): {pObra.semPrevisao.map((s) => s.nome).join('; ')}.
          </p>
        )}
      </section>

      <h2 className="subtitulo">Por serviço</h2>
      {previsoes.map((p) => {
        const nec = prazo ? ritmoNecessario(p.restante, prazo, hoje) : null
        const abaixo = nec !== null && p.ritmo.porDia < nec
        return (
          <section key={p.servico.id} className="cartao">
            <h2>{p.servico.nome}</h2>
            <Barra pct={p.pct} cor={p.concluido ? 'verde' : 'azul'} />
            <p className="linha-info">
              <b>{formatNumero(p.executado)}</b> de {formatNumero(p.servico.quantidadePrevista)} {p.servico.unidade}
              <span className="mudo"> · faltam {formatNumero(p.restante)}</span>
            </p>
            {p.concluido ? (
              <p className="ok-texto">Concluído ✓</p>
            ) : p.termino ? (
              <p>
                Ritmo: <b>{formatNumero(p.ritmo.porDia)} {p.servico.unidade}/dia útil</b> · termina em{' '}
                <b>{dataBR(p.termino)}</b> <span className="mudo">({p.diasRestantes} dias úteis)</span>
              </p>
            ) : (
              <p className="mudo">Sem produção recente: não dá para prever.</p>
            )}
            {nec !== null && !p.concluido && (
              <p className={abaixo ? 'erro pequeno' : 'ok-texto pequeno'}>
                Para cumprir o prazo: {formatNumero(nec)} {p.servico.unidade}/dia útil
                {abaixo ? ' (acima do ritmo atual)' : ' (ritmo atual basta)'}
              </p>
            )}
          </section>
        )
      })}

      <h2 className="subtitulo">Medição estimada do período</h2>
      <section className="cartao">
        <p className="mudo" style={{ marginTop: 0 }}>
          Período: <b>{dataCurta(est.periodo.ini)} a {dataCurta(est.periodo.fim)}</b>
          {' '}· faltam {diasUteis(addDias(hoje, 1), est.periodo.fim)} dias úteis para fechar
          {obra.diaFechamento === undefined && (
            <> (considerando fechamento no fim do mês; ajuste em <Link to="/obra">Obra</Link>)</>
          )}
        </p>
        <div className="tabela-rolavel">
          <table className="tabela">
            <thead>
              <tr><th>Serviço</th><th>Medido até hoje</th><th>Projeção até fechar</th></tr>
            </thead>
            <tbody>
              {est.linhas.map((l) => (
                <tr key={l.servico.id}>
                  <td>{l.servico.nome}</td>
                  <td>
                    {formatNumero(l.medido)} {l.servico.unidade}
                    {l.valorMedido !== null && <small>{brl(l.valorMedido)}</small>}
                  </td>
                  <td>
                    {formatNumero(l.projetado)} {l.servico.unidade}
                    {l.valorProjetado !== null && <small>{brl(l.valorProjetado)}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
            {est.totalProjetado !== null && (
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>{est.totalMedido !== null ? brl(est.totalMedido) : '—'}</td>
                  <td>{brl(est.totalProjetado)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {est.totalProjetado === null && (
          <p className="mudo pequeno">
            Para ver valores em R$, informe o preço unitário de cada serviço em <Link to="/obra">Obra</Link>.
          </p>
        )}
        <p className="mudo pequeno">
          A projeção mantém o ritmo recente até a data de fechamento e nunca passa do que falta executar.
          Chuva, falta de material e feriados podem mudar o resultado.
        </p>
      </section>
    </>
  )
}
