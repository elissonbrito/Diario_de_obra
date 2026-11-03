import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDados } from '../../hooks/useDados'
import { addDias, inicioSemana } from '../../lib/analise'
import { dataCurta, dataLocal, formatNumero } from '../../lib/util'

const ROTULOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export default function Producao() {
  const { servicos, medicoes, frequencias } = useDados()
  const hoje = dataLocal()
  const semanaAtual = inicioSemana(hoje)
  const [ini, setIni] = useState(semanaAtual)
  const fim = addDias(ini, 6)
  const dias = Array.from({ length: 7 }, (_, i) => addDias(ini, i))
  const iniAnterior = addDias(ini, -7)

  const regs = frequencias.filter((f) => f.data >= ini && f.data <= fim)
  const homemDias = regs.filter((f) => f.status !== 'falta').length
  const faltas = regs.filter((f) => f.status === 'falta').length

  const somaDia = (servicoId: string, d: string) =>
    medicoes.filter((m) => m.servicoId === servicoId && m.data === d).reduce((a, m) => a + m.quantidade, 0)

  const temAlgo = medicoes.some((m) => m.data >= ini && m.data <= fim)

  return (
    <>
      <div className="seletor-data">
        <button type="button" className="btn btn-sec" onClick={() => setIni(addDias(ini, -7))} aria-label="Semana anterior">◀</button>
        <div className="seletor-centro">
          <b>{dataCurta(ini)} a {dataCurta(fim)}</b>
          <span className="mudo">{ini === semanaAtual ? 'esta semana' : 'semana de segunda a domingo'}</span>
        </div>
        <button type="button" className="btn btn-sec" onClick={() => setIni(addDias(ini, 7))} disabled={ini >= semanaAtual} aria-label="Próxima semana">▶</button>
      </div>
      {ini !== semanaAtual && (
        <button type="button" className="link-botao" onClick={() => setIni(semanaAtual)}>Voltar para esta semana</button>
      )}

      <section className="cartao">
        <h2>Equipe na semana</h2>
        <div className="resumo-grade resumo-3">
          <div className="resumo ok"><b>{homemDias}</b><span>dias trabalhados (soma da equipe)</span></div>
          <div className="resumo falta"><b>{faltas}</b><span>faltas</span></div>
          <div className="resumo neutro"><b>{regs.filter((f) => f.status === 'atraso').length}</b><span>atrasos</span></div>
        </div>
      </section>

      {servicos.length === 0 && (
        <p className="mudo">Cadastre os serviços em <Link to="/obra">Obra</Link> e lance a produção na aba Medição.</p>
      )}
      {servicos.length > 0 && !temAlgo && (
        <p className="mudo">Nenhuma produção lançada nesta semana. Use a aba <Link to="/medicao">Medição</Link>.</p>
      )}

      {servicos.map((s) => {
        const porDia = dias.map((d) => somaDia(s.id, d))
        const total = porDia.reduce((a, b) => a + b, 0)
        const totalAnt = Array.from({ length: 7 }, (_, i) => somaDia(s.id, addDias(iniAnterior, i))).reduce((a, b) => a + b, 0)
        const max = Math.max(...porDia, 1)
        const variacao = totalAnt > 0 ? ((total - totalAnt) / totalAnt) * 100 : null
        const prod = homemDias > 0 ? total / homemDias : null
        return (
          <section key={s.id} className="cartao">
            <div className="cartao-titulo">
              <h2>{s.nome}</h2>
            </div>
            <p className="linha-info">
              <b>{formatNumero(total)} {s.unidade}</b> na semana
              {variacao !== null && (
                <span className={variacao >= 0 ? 'ok-texto' : 'erro'}>
                  {' '}({variacao >= 0 ? '+' : ''}{formatNumero(variacao)}% vs. semana anterior)
                </span>
              )}
            </p>
            <div className="grafico" aria-hidden="true">
              {porDia.map((v, i) => (
                <div key={dias[i]} className="grafico-col">
                  <span className="grafico-valor">{v > 0 ? formatNumero(v) : ''}</span>
                  <div className="grafico-barra" style={{ height: `${(v / max) * 100}%` }} />
                  <span className="grafico-rotulo">{ROTULOS[i]}</span>
                </div>
              ))}
            </div>
            {prod !== null && total > 0 && (
              <p className="mudo pequeno">
                Produtividade: {formatNumero(prod)} {s.unidade} por dia trabalhado da equipe (considera a equipe toda).
              </p>
            )}
          </section>
        )
      })}
    </>
  )
}
