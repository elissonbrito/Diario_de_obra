import { db } from '../db/db'
import type { Medicao } from '../db/types'
import { agoraISO, uid } from '../lib/util'

export interface DadosMedicao {
  data: string
  servicoId: string
  trechoId?: string
  quantidade: number
  obs?: string
}

export async function salvarMedicao(obraId: string, dados: DadosMedicao, existente?: Medicao) {
  const agora = agoraISO()
  if (existente) {
    await db.medicoes.put({ ...existente, ...dados, updatedAt: agora })
  } else {
    await db.medicoes.put({ id: uid(), obraId, ...dados, createdAt: agora, updatedAt: agora })
  }
}

export async function removerMedicao(m: Medicao) {
  await db.medicoes.delete(m.id)
}
