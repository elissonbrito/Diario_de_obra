import { db } from '../db/db'
import type { Frequencia, StatusFrequencia } from '../db/types'
import { agoraISO, dataLocal, horaLocal } from '../lib/util'

// O id é fixo (dia + funcionário): lançar de novo no mesmo dia apenas atualiza o registro.
export const idFrequencia = (data: string, funcionarioId: string) => `${data}__${funcionarioId}`

function montarRegistro(
  obraId: string, data: string, funcionarioId: string, status: StatusFrequencia, atual?: Frequencia,
): Frequencia {
  const agora = agoraISO()
  const trabalhou = status !== 'falta'
  const ehHoje = data === dataLocal()
  return {
    id: idFrequencia(data, funcionarioId),
    obraId,
    data,
    funcionarioId,
    status,
    entrada: trabalhou ? (atual?.entrada ?? (ehHoje ? horaLocal() : undefined)) : undefined,
    saida: trabalhou ? atual?.saida : undefined,
    trechoId: trabalhou ? atual?.trechoId : undefined,
    obs: atual?.obs,
    createdAt: atual?.createdAt ?? agora,
    updatedAt: agora,
  }
}

/**
 * Define o status do dia. Tocar no mesmo status de novo remove o lançamento (desfazer).
 * Sempre lê o registro atual do banco (nunca confia em cópia antiga da tela).
 */
export async function definirStatus(
  obraId: string, data: string, funcionarioId: string, status: StatusFrequencia,
) {
  const id = idFrequencia(data, funcionarioId)
  await db.transaction('rw', db.frequencias, async () => {
    const atual = await db.frequencias.get(id)
    if (atual && atual.status === status) {
      await db.frequencias.delete(id)
      return
    }
    await db.frequencias.put(montarRegistro(obraId, data, funcionarioId, status, atual))
  })
}

/** Altera só os campos informados, sem sobrescrever o resto do registro. */
export async function atualizarDetalhes(
  id: string,
  campos: Partial<Pick<Frequencia, 'entrada' | 'saida' | 'trechoId' | 'obs'>>,
) {
  await db.frequencias.update(id, { ...campos, updatedAt: agoraISO() })
}

export async function todosPresentes(obraId: string, data: string, funcionarioIds: string[]) {
  await db.transaction('rw', db.frequencias, async () => {
    for (const fid of funcionarioIds) {
      const existe = await db.frequencias.get(idFrequencia(data, fid))
      if (!existe) await db.frequencias.put(montarRegistro(obraId, data, fid, 'presente'))
    }
  })
}
