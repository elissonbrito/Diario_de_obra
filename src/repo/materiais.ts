import { db } from '../db/db'
import type { Entrega, Material } from '../db/types'
import { agoraISO, uid } from '../lib/util'

export type DadosMaterial = Omit<Material, 'id' | 'obraId' | 'createdAt' | 'updatedAt' | 'deletedAt'>

export async function salvarMaterial(obraId: string, dados: DadosMaterial, existente?: Material) {
  const agora = agoraISO()
  if (existente) {
    await db.materiais.put({ ...existente, ...dados, updatedAt: agora })
  } else {
    await db.materiais.put({ id: uid(), obraId, ...dados, createdAt: agora, updatedAt: agora })
  }
}

export async function removerMaterial(m: Material) {
  const agora = agoraISO()
  await db.materiais.update(m.id, { deletedAt: agora, updatedAt: agora })
}

export async function registrarEntrega(
  obraId: string, materialId: string, dados: { data: string; quantidade: number; obs?: string },
) {
  const agora = agoraISO()
  await db.entregas.put({ id: uid(), obraId, materialId, ...dados, createdAt: agora, updatedAt: agora })
}

export async function removerEntrega(e: Entrega) {
  await db.entregas.delete(e.id)
}
