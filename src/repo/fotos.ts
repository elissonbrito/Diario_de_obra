import { db } from '../db/db'
import type { Foto, ImagemFoto, QualImagem } from '../db/types'
import type { Bytes, FotoReduzida, ResultadoGPS } from '../lib/fotos'
import { agoraISO, dataLocal, horaLocal, uid } from '../lib/util'

export interface Vinculo { servicoId?: string; trechoId?: string }

export const idImagem = (fotoId: string, qual: QualImagem) => `${fotoId}__${qual}`

const imagem = (fotoId: string, qual: QualImagem, b: Bytes): ImagemFoto =>
  ({ id: idImagem(fotoId, qual), fotoId, tipo: b.tipo, dados: b.dados })

export async function adicionarFoto(
  obraId: string, data: string, foto: FotoReduzida, gps: ResultadoGPS | null, vinculo: Vinculo,
): Promise<string> {
  // Nunca grava foto vazia: o registro ficaria com imagem quebrada.
  if (!foto.grande.dados || foto.grande.dados.byteLength === 0) {
    throw new Error('A foto ficou vazia ao processar e não foi salva. Tente de novo.')
  }
  const agora = new Date()
  // Hora: a da captura (EXIF) quando ela é do mesmo dia do diário; senão, a hora do registro.
  const [dataExif, horaExif] = foto.capturadaEm?.split(' ') ?? []
  const registro: Foto = {
    id: uid(),
    obraId,
    data,
    hora: dataExif === data && horaExif ? horaExif : horaLocal(agora),
    tamanho: foto.grande.dados.byteLength,
    temMiniatura: Boolean(foto.mini?.dados.byteLength),
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
  await db.transaction('rw', db.fotos, db.imagens, async () => {
    await db.imagens.put(imagem(registro.id, 'grande', foto.grande))
    if (registro.temMiniatura && foto.mini) await db.imagens.put(imagem(registro.id, 'mini', foto.mini))
    await db.fotos.put(registro)
  })
  // Confere lendo de volta: se o aparelho gravou vazio, desfaz e avisa em vez de deixar foto quebrada.
  const salva = await db.imagens.get(idImagem(registro.id, 'grande'))
  if (!salva?.dados || salva.dados.byteLength === 0) {
    await db.transaction('rw', db.fotos, db.imagens, async () => {
      await db.fotos.delete(registro.id)
      await db.imagens.where('fotoId').equals(registro.id).delete()
    })
    throw new Error('O aparelho não conseguiu guardar a foto (talvez falte espaço). Nada foi salvo.')
  }
  return registro.id
}

/** Bytes da imagem para exibir. Sem miniatura, usa a grande. null = indisponível. */
export async function lerImagem(foto: Pick<Foto, 'id' | 'temMiniatura'>, qual: QualImagem): Promise<Bytes | null> {
  const id = idImagem(foto.id, qual === 'mini' && foto.temMiniatura ? 'mini' : 'grande')
  const img = await db.imagens.get(id)
  if (!img?.dados || img.dados.byteLength === 0) return null
  return { tipo: img.tipo, dados: img.dados }
}

/** GPS só faz sentido para fotos do dia de hoje: a posição atual não é a de uma foto antiga. */
export const deveUsarGPS = (data: string) => data === dataLocal()

export async function atualizarFoto(id: string, campos: Partial<Pick<Foto, 'legenda' | 'servicoId' | 'trechoId'>>) {
  await db.fotos.update(id, { ...campos, updatedAt: agoraISO() })
}

/** Exclusão lógica: o registro fica marcado; os bytes da imagem são apagados para liberar espaço. */
export async function excluirFoto(id: string) {
  const agora = agoraISO()
  await db.transaction('rw', db.fotos, db.imagens, async () => {
    await db.fotos.update(id, { deletedAt: agora, updatedAt: agora, tamanho: 0, temMiniatura: false, arquivo: undefined, miniatura: undefined })
    await db.imagens.where('fotoId').equals(id).delete()
  })
}

async function lerBlob(b?: Blob): Promise<Bytes | null> {
  if (!(b instanceof Blob) || b.size === 0) return null
  try {
    const dados = await b.arrayBuffer()
    return dados.byteLength > 0 ? { tipo: b.type || 'image/jpeg', dados } : null
  } catch {
    return null // o iOS às vezes perde o arquivo do Blob guardado
  }
}

/**
 * Converte as fotos da v0.3 (imagem como Blob dentro do registro) para a tabela 'imagens'.
 * A que não puder ser lida fica marcada como indisponível, sem apagar o registro; o Blob é mantido
 * para uma nova tentativa na próxima abertura. Pode rodar quantas vezes for preciso.
 */
export async function migrarFotosAntigas(): Promise<{ convertidas: number; indisponiveis: number }> {
  const antigas = (await db.fotos.toArray()).filter((f) => f.arquivo !== undefined || f.miniatura !== undefined)
  let convertidas = 0
  let indisponiveis = 0
  for (const f of antigas) {
    // Ler o Blob é assíncrono fora do IndexedDB: tem de ser fora da transação.
    const grande = await lerBlob(f.arquivo)
    const mini = await lerBlob(f.miniatura)
    await db.transaction('rw', db.fotos, db.imagens, async () => {
      if (grande) {
        await db.imagens.put(imagem(f.id, 'grande', grande))
        if (mini) await db.imagens.put(imagem(f.id, 'mini', mini))
        await db.fotos.update(f.id, {
          tamanho: grande.dados.byteLength, temMiniatura: Boolean(mini), indisponivel: undefined,
          arquivo: undefined, miniatura: undefined,
        })
      } else if (f.deletedAt) {
        await db.fotos.update(f.id, { arquivo: undefined, miniatura: undefined, tamanho: 0 })
      } else {
        await db.fotos.update(f.id, { indisponivel: true, tamanho: 0 })
      }
    })
    if (grande) convertidas++
    else if (!f.deletedAt) indisponiveis++
  }
  return { convertidas, indisponiveis }
}
