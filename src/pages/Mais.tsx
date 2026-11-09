import { Link } from 'react-router-dom'

const ITENS = [
  { to: '/medicao', titulo: 'Medição', desc: 'Lançar a produção do dia por serviço' },
  { to: '/fotos?ver=todas', titulo: 'Fotos', desc: 'Todas as fotos da obra, por dia e por serviço' },
  { to: '/equipe', titulo: 'Equipe', desc: 'Adicionar, editar e remover funcionários e funções' },
  { to: '/obra', titulo: 'Obra e serviços', desc: 'Prazo, serviços, quantidades, preços e trechos' },
  { to: '/analises/materiais', titulo: 'Materiais e ferramentas', desc: 'Saldo, consumo e quando pedir' },
  { to: '/ajustes', titulo: 'Ajustes e backup', desc: 'Backup com fotos, restaurar dados, logo do relatório' },
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
