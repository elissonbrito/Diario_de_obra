import { NavLink, Outlet } from 'react-router-dom'

export default function Analises() {
  return (
    <div className="pagina">
      <h1>Análises</h1>
      <nav className="segmentos" aria-label="Tipo de análise">
        <NavLink to="producao">Semana</NavLink>
        <NavLink to="previsao">Previsão</NavLink>
        <NavLink to="faltas">Faltas</NavLink>
        <NavLink to="materiais">Materiais</NavLink>
      </nav>
      <Outlet />
    </div>
  )
}
