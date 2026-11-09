import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AdicionarFotos } from '../components/AdicionarFotos'
import { GradeFotos } from '../components/GradeFotos'
import { SeletorData } from '../components/SeletorData'
import { useDados } from '../hooks/useDados'
import { agruparPorDia } from '../lib/diario'
import { dataBR, dataLocal, diaSemana } from '../lib/util'

export default function Fotos() {
  const { servicos, trechos, fotos } = useDados()
  const hoje = dataLocal()
  const [params, setParams] = useSearchParams()
  const data = params.get('data') || hoje
  const modo = params.get('ver') === 'todas' ? 'todas' : 'dia'
  const [filtroServico, setFiltroServico] = useState('')

  const mudar = (novo: Record<string, string>) => setParams({ data, ver: modo, ...novo }, { replace: true })

  const doDia = fotos.filter((f) => f.data === data)
  const filtradas = filtroServico ? fotos.filter((f) => f.servicoId === filtroServico) : fotos
  const grupos = agruparPorDia(filtradas)

  return (
    <div className="pagina">
      <div className="titulo-linha">
        <h1>Fotos</h1>
        <Link to={`/diario?data=${data}`} className="link-acao">Diário do dia</Link>
      </div>
      <nav className="segmentos" aria-label="Quais fotos mostrar">
        <button type="button" className={modo === 'dia' ? 'ativo' : ''} onClick={() => mudar({ ver: 'dia' })}>Do dia</button>
        <button type="button" className={modo === 'todas' ? 'ativo' : ''} onClick={() => mudar({ ver: 'todas' })}>
          Todas ({fotos.length})
        </button>
      </nav>

      {modo === 'dia' ? (
        <>
          <SeletorData data={data} setData={(d) => mudar({ data: d })} hoje={hoje} />
          <section className="cartao">
            <AdicionarFotos data={data} servicos={servicos} trechos={trechos} />
          </section>
          {doDia.length === 0 ? (
            <p className="mudo centro">Nenhuma foto em {dataBR(data)}. Use os botões acima para registrar.</p>
          ) : (
            <GradeFotos fotos={doDia} servicos={servicos} trechos={trechos} />
          )}
        </>
      ) : (
        <>
          {servicos.length > 0 && (
            <label className="cobertura">
              Serviço
              <select value={filtroServico} onChange={(e) => setFiltroServico(e.target.value)}>
                <option value="">Todos</option>
                {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </label>
          )}
          {grupos.length === 0 ? (
            <p className="mudo centro">
              {fotos.length === 0 ? 'Nenhuma foto registrada ainda.' : 'Nenhuma foto deste serviço.'}
            </p>
          ) : (
            grupos.map((g) => (
              <section key={g.data} className="grupo-dia">
                <h2 className="subtitulo">
                  <button type="button" className="link-botao" onClick={() => mudar({ data: g.data, ver: 'dia' })}>
                    {diaSemana(g.data)}, {dataBR(g.data)}
                  </button>
                  <span className="mudo pequeno"> · {g.itens.length} {g.itens.length === 1 ? 'foto' : 'fotos'}</span>
                </h2>
                <GradeFotos fotos={g.itens} servicos={servicos} trechos={trechos} />
              </section>
            ))
          )}
        </>
      )}
    </div>
  )
}
