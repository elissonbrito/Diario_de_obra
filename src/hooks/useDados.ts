import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useObra } from '../state/ObraContext'

const vivos = <T extends { deletedAt?: string | null }>(xs: T[]) => xs.filter((x) => !x.deletedAt)

/** Carrega tudo da obra ativa (volume pequeno: centenas de registros), já sem os itens excluídos. */
export function useDados() {
  const obra = useObra()
  const id = obra.id
  const servicos = useLiveQuery(() => db.servicos.where('obraId').equals(id).toArray(), [id], [])
  const trechos = useLiveQuery(() => db.trechos.where('obraId').equals(id).toArray(), [id], [])
  const funcionarios = useLiveQuery(() => db.funcionarios.where('obraId').equals(id).toArray(), [id], [])
  const frequencias = useLiveQuery(() => db.frequencias.where('obraId').equals(id).toArray(), [id], [])
  const medicoes = useLiveQuery(() => db.medicoes.where('obraId').equals(id).toArray(), [id], [])
  const materiais = useLiveQuery(() => db.materiais.where('obraId').equals(id).toArray(), [id], [])
  const entregas = useLiveQuery(() => db.entregas.where('obraId').equals(id).toArray(), [id], [])
  const diarios = useLiveQuery(() => db.diarios.where('obraId').equals(id).toArray(), [id], [])
  const fotos = useLiveQuery(() => db.fotos.where('obraId').equals(id).toArray(), [id], [])

  return {
    obra,
    servicos: vivos(servicos).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    trechos: vivos(trechos).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })),
    funcionarios: vivos(funcionarios),
    funcionariosTodos: funcionarios, // inclui excluídos: o histórico de presença continua mostrando o nome
    frequencias,
    medicoes,
    materiais: vivos(materiais).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    entregas,
    diarios: vivos(diarios),
    fotos: vivos(fotos).sort((a, b) => (a.data + a.hora + a.createdAt).localeCompare(b.data + b.hora + b.createdAt)),
  }
}
