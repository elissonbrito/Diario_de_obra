import { Link } from 'react-router-dom'

const ITENS = [
  { to: '/equipe', titulo: 'Equipe', desc: 'Adicionar, editar e remover funcionários e funções' },
  { to: '/obra', titulo: 'Obra e serviços', desc: 'Prazo, serviços, quantidades, preços e trechos' },
  { to: '/analises/materiais', titulo: 'Materiais e ferramentas', desc: 'Saldo, consumo e quando pedir' },
  { to: '/ajustes', titulo: 'Ajustes e backup', desc: 'Exportar e restaurar os dados' },
]

export default function Mais() {
  return (
    <div className="pagina">
      <h1>Mais</h1>
      <ul className="lista">
        {ITENS.map((i) => (
          <li key={i.to}>
            <Link to={i.to} className="menu-item">
              <b>{i.titulo}</b>
              <span className="mudo">{i.desc}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
