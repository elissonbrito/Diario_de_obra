import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Funcionario } from '../db/types'
import { Modal } from '../components/Modal'
import { useObra } from '../state/ObraContext'
import { alternarAtivo, removerFuncionario, salvarFuncionario } from '../repo/cadastros'

export default function Equipe() {
  const obra = useObra()
  const lista = useLiveQuery(() => db.funcionarios.where('obraId').equals(obra.id).toArray(), [obra.id], [])
  const [editando, setEditando] = useState<Funcionario | 'novo' | null>(null)

  const ordenar = (a: Funcionario, b: Funcionario) => a.nome.localeCompare(b.nome, 'pt-BR')
  const visiveis = lista.filter((f) => !f.deletedAt)
  const ativos = visiveis.filter((f) => f.ativo).sort(ordenar)
  const inativos = visiveis.filter((f) => !f.ativo).sort(ordenar)

  return (
    <div className="pagina">
      <div className="titulo-linha">
        <h1>Equipe</h1>
        <button type="button" className="btn btn-primario" onClick={() => setEditando('novo')}>
          + Novo
        </button>
      </div>

      {ativos.length === 0 && inativos.length === 0 && (
        <p className="mudo">Nenhum funcionário cadastrado ainda. Toque em “+ Novo” para começar.</p>
      )}

      <ul className="lista">
        {ativos.map((f) => (
          <li key={f.id} className="item">
            <div className="item-texto">
              <b>{f.nome}</b>
              <span className="mudo">{f.funcao || 'sem função'}</span>
            </div>
            <button type="button" className="btn btn-sec" onClick={() => setEditando(f)}>Editar</button>
          </li>
        ))}
      </ul>

      {inativos.length > 0 && (
        <>
          <h2 className="subtitulo">Inativos</h2>
          <ul className="lista">
            {inativos.map((f) => (
              <li key={f.id} className="item item-inativo">
                <div className="item-texto">
                  <b>{f.nome}</b>
                  <span className="mudo">{f.funcao || 'sem função'}</span>
                </div>
                <button type="button" className="btn btn-sec" onClick={() => alternarAtivo(f)}>Reativar</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {editando && (
        <FormFuncionario
          obraId={obra.id}
          existente={editando === 'novo' ? undefined : editando}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  )
}

function FormFuncionario({
  obraId, existente, onClose,
}: { obraId: string; existente?: Funcionario; onClose: () => void }) {
  const [nome, setNome] = useState(existente?.nome ?? '')
  const [funcao, setFuncao] = useState(existente?.funcao ?? '')
  const [erro, setErro] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) { setErro('Informe o nome.'); return }
    await salvarFuncionario(obraId, { nome: nome.trim(), funcao: funcao.trim() }, existente)
    onClose()
  }

  return (
    <Modal titulo={existente ? 'Editar funcionário' : 'Novo funcionário'} onClose={onClose}>
      <form onSubmit={enviar} className="form">
        <label>
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus autoComplete="off" />
        </label>
        <label>
          Função
          <input
            value={funcao}
            onChange={(e) => setFuncao(e.target.value)}
            placeholder="ex.: Pedreiro, Servente, Encarregado"
            autoComplete="off"
          />
        </label>
        {erro && <p className="erro">{erro}</p>}
        <div className="form-acoes">
          {existente && existente.ativo && (
            <button
              type="button"
              className="btn btn-perigo"
              onClick={async () => { await alternarAtivo(existente); onClose() }}
            >
              Desativar
            </button>
          )}
          {existente && (
            <button
              type="button"
              className="btn btn-perigo"
              onClick={async () => {
                if (window.confirm(`Excluir ${existente.nome}? O histórico de presença já lançado é mantido.`)) {
                  await removerFuncionario(existente); onClose()
                }
              }}
            >
              Excluir
            </button>
          )}
          <button type="submit" className="btn btn-primario">Salvar</button>
        </div>
        {existente && existente.ativo && (
          <p className="mudo pequeno">
            Desativar tira da chamada, mas mantém o histórico de presença já lançado.
          </p>
        )}
      </form>
    </Modal>
  )
}
