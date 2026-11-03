import { HashRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { ObraProvider, useObra } from './state/ObraContext'
import { IconeAnalises, IconeChamada, IconeHoje, IconeMais, IconeMedicao } from './components/Icons'
import Hoje from './pages/Hoje'
import Chamada from './pages/Chamada'
import Equipe from './pages/Equipe'
import ObraPage from './pages/Obra'
import Ajustes from './pages/Ajustes'
import Medicao from './pages/Medicao'
import Mais from './pages/Mais'
import Analises from './pages/analises/Analises'
import Producao from './pages/analises/Producao'
import Previsao from './pages/analises/Previsao'
import Faltas from './pages/analises/Faltas'
import Materiais from './pages/analises/Materiais'

function Casca() {
  const obra = useObra()
  const { pathname } = useLocation()
  const maisAtivo = ['/mais', '/equipe', '/obra', '/ajustes'].includes(pathname)
  return (
    <div className="app">
      <header className="topo">
        <img src="./logo-escudo.png" alt="" width={34} height={34} />
        <div className="topo-texto">
          <b>Diário de Obra</b>
          <span>{obra.nome}</span>
        </div>
      </header>
      <main className="conteudo">
        <Routes>
          <Route path="/" element={<Hoje />} />
          <Route path="/chamada" element={<Chamada />} />
          <Route path="/medicao" element={<Medicao />} />
          <Route path="/analises" element={<Analises />}>
            <Route index element={<Navigate to="producao" replace />} />
            <Route path="producao" element={<Producao />} />
            <Route path="previsao" element={<Previsao />} />
            <Route path="faltas" element={<Faltas />} />
            <Route path="materiais" element={<Materiais />} />
          </Route>
          <Route path="/mais" element={<Mais />} />
          <Route path="/equipe" element={<Equipe />} />
          <Route path="/obra" element={<ObraPage />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="*" element={<Hoje />} />
        </Routes>
      </main>
      <nav className="abas" aria-label="Navegação principal">
        <NavLink to="/" end><IconeHoje /><span>Hoje</span></NavLink>
        <NavLink to="/chamada"><IconeChamada /><span>Chamada</span></NavLink>
        <NavLink to="/medicao"><IconeMedicao /><span>Medição</span></NavLink>
        <NavLink to="/analises"><IconeAnalises /><span>Análises</span></NavLink>
        <NavLink to="/mais" className={maisAtivo ? 'active' : ''}><IconeMais /><span>Mais</span></NavLink>
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ObraProvider>
        <Casca />
      </ObraProvider>
    </HashRouter>
  )
}
