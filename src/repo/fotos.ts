import { db } from '../db/db'
import type { Foto } from '../db/types'
import type { FotoReduzida, ResultadoGPS } from '../lib/fotos'
import { agoraISO, dataLocal, horaLocal, uid } from '../lib/util'

export interface Vinculo { servicoId?: string; trechoId?: string }

export async function adicionarFoto(
  obraId: string, data: string, foto: FotoReduzida, gps: ResultadoGPS | null, vinculo: Vinculo,
): Promise<string> {
  const agora = new Date()
  // Hora: a da captura (EXIF) quando ela é do mesmo dia do diário; senão, a hora do registro.
  const [dataExif, horaExif] = foto.capturadaEm?.split(' ') ?? []
  const registro: Foto = {
    id: uid(),
    obraId,
    data,
    hora: dataExif === data && horaExif ? horaExif : horaLocal(agora),
    arquivo: foto.arquivo,
    miniatura: foto.miniatura,
    largura: foto.largura,
    altura: foto.altura,
    capturadaEm: foto.capturadaEm ?? undefined,
    servicoId: vinculo.servicoId || undefined,
    trechoId: vinculo.trechoId || undefined,
    createdAt: agora.toISOString(),
    updatedAt: agora.toISOString(),
  }
  if (gps?.ok) {
    registro.latitude = gps.latitude
    registro.longitude = gps.longitude
    registro.precisaoM = gps.precisaoM
  }
  await db.fotos.put(registro)
  return registro.id
}

/** GPS só faz sentido para fotos do dia de hoje: a posição atual não é a de uma foto antiga. */
export const deveUsarGPS = (data: string) => data === dataLocal()

export async function atualizarFoto(id: string, campos: Partial<Pick<Foto, 'legenda' | 'servicoId' | 'trechoId'>>) {
  await db.fotos.update(id, { ...campos, updatedAt: agoraISO() })
}

/** Exclusão lógica. As imagens são descartadas para liberar espaço; o registro fica marcado como excluído. */
export async function excluirFoto(id: string) {
  const agora = agoraISO()
  await db.fotos.update(id, { deletedAt: agora, updatedAt: agora, arquivo: new Blob([]), miniatura: undefined })
}
