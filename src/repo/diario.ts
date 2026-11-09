import { db } from '../db/db'
import type { Diario } from '../db/types'
import { idDiario } from '../lib/diario'
import { agoraISO } from '../lib/util'

export type CamposDiario = Partial<Pick<Diario,
  'climaManha' | 'climaTarde' | 'paralisacao' | 'motivoParalisacao' | 'atividades' | 'equipamentos' | 'ocorrencias'>>

/**
 * Grava só os campos informados no diário do dia (cria se não existir).
 * Lê o registro dentro da transação: nunca sobrescreve com uma cópia antiga da tela.
 */
export async function salvarDiario(obraId: string, data: string, campos: CamposDiario) {
  const id = idDiario(obraId, data)
  await db.transaction('rw', db.diarios, async () => {
    const agora = agoraISO()
    const atual = await db.diarios.get(id)
    if (atual) {
      await db.diarios.update(id, { ...campos, deletedAt: null, updatedAt: agora })
    } else {
      await db.diarios.put({ id, obraId, data, ...campos, createdAt: agora, updatedAt: agora })
    }
  })
}
