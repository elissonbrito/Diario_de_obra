import { db } from '../db/db'
import type { Obra } from '../db/types'
import { agoraISO, uid } from '../lib/util'

const CHAVE_OBRA_ATIVA = 'obraAtivaId'

/** Garante que existe uma obra ativa (cria uma obra padrão na primeira abertura). */
export async function garantirObraAtiva(): Promise<Obra> {
  const meta = await db.meta.get(CHAVE_OBRA_ATIVA)
  if (meta && typeof meta.value === 'string') {
    const obra = await db.obras.get(meta.value)
    if (obra && !obra.deletedAt) return obra
  }
  const existente = (await db.obras.toArray()).find((o) => !o.deletedAt)
  if (existente) {
    await db.meta.put({ key: CHAVE_OBRA_ATIVA, value: existente.id })
    return existente
  }
  const agora = agoraISO()
  const nova: Obra = {
    id: uid(), nome: 'Minha obra', empresa: '', local: '', createdAt: agora, updatedAt: agora,
  }
  await db.transaction('rw', db.obras, db.meta, async () => {
    await db.obras.put(nova)
    await db.meta.put({ key: CHAVE_OBRA_ATIVA, value: nova.id })
  })
  return nova
}

export async function obraAtivaId(): Promise<string | undefined> {
  const meta = await db.meta.get(CHAVE_OBRA_ATIVA)
  return typeof meta?.value === 'string' ? meta.value : undefined
}

export async function salvarObra(
  obra: Obra,
  dados: Pick<Obra, 'nome' | 'empresa' | 'local' | 'inicio' | 'prazoFinal' | 'diaFechamento'>,
) {
  await db.obras.put({ ...obra, ...dados, updatedAt: agoraISO() })
}
