import { db, TABELAS_BACKUP } from '../db/db'
import type { Foto } from '../db/types'
import { compartilharOuBaixar } from '../lib/compartilhar'
import { ehZip } from '../lib/imagem'
import { dataLocal } from '../lib/util'

const CHAVE_ULTIMO_BACKUP = 'ultimoBackup'

export const ultimoBackup = (): string | null => {
  try { return localStorage.getItem(CHAVE_ULTIMO_BACKUP) } catch { return null }
}
const marcarBackup = () => {
  try { localStorage.setItem(CHAVE_ULTIMO_BACKUP, new Date().toISOString()) } catch { /* sem armazenamento */ }
}

/** Foto no backup completo: igual ao registro, mas com o caminho do arquivo dentro do ZIP no lugar do Blob. */
export type FotoNoBackup = Omit<Foto, 'arquivo' | 'miniatura'> & { arquivo: string; miniatura?: string }

export interface ArquivoBackup {
  app: 'diario-de-obra'
  versao: 1
  exportadoEm: string
  comFotos?: boolean // true só no dados.json do backup completo (ZIP)
  dados: Record<string, unknown[]>
}

export async function montarBackup(): Promise<ArquivoBackup> {
  const dados: Record<string, unknown[]> = {}
  for (const nome of TABELAS_BACKUP) {
    dados[nome] = await db.table(nome).toArray()
  }
  return { app: 'diario-de-obra', versao: 1, exportadoEm: new Date().toISOString(), dados }
}

/** Backup leve (só dados, sem fotos). No iPhone abre a folha de compartilhamento (Arquivos, Drive, WhatsApp...). */
export async function exportarBackup(): Promise<'compartilhado' | 'baixado'> {
  const backup = await montarBackup()
  const nome = `diario-obra-backup-${dataLocal()}.json`
  const arquivo = new File([JSON.stringify(backup, null, 2)], nome, { type: 'application/json' })
  const como = await compartilharOuBaixar(arquivo, 'Backup do Diário de Obra')
  marcarBackup()
  return como
}

/** Backup completo: um ZIP com dados.json e as fotos em fotos/<id>.jpg (miniaturas em miniaturas/<id>.jpg). */
export async function exportarBackupCompleto(): Promise<{ como: 'compartilhado' | 'baixado'; fotos: number }> {
  const { zipSync, strToU8 } = await import('fflate') // só carrega a biblioteca quando precisa
  const backup = await montarBackup()
  const fotos = (await db.fotos.toArray()).filter((f) => !f.deletedAt)
  const arquivos: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {}
  const metas: FotoNoBackup[] = []
  for (const f of fotos) {
    const { arquivo, miniatura, ...resto } = f
    const meta: FotoNoBackup = { ...resto, arquivo: `fotos/${f.id}.jpg` }
    // JPEG já é comprimido: guardar sem recomprimir (level 0) é bem mais rápido no celular.
    arquivos[meta.arquivo] = [new Uint8Array(await arquivo.arrayBuffer()), { level: 0 }]
    if (miniatura) {
      meta.miniatura = `miniaturas/${f.id}.jpg`
      arquivos[meta.miniatura] = [new Uint8Array(await miniatura.arrayBuffer()), { level: 0 }]
    }
    metas.push(meta)
  }
  const completo: ArquivoBackup = { ...backup, comFotos: true, dados: { ...backup.dados, fotos: metas } }
  arquivos['dados.json'] = strToU8(JSON.stringify(completo))
  const zip = zipSync(arquivos)
  const nome = `diario-obra-completo-${dataLocal()}.zip`
  const como = await compartilharOuBaixar(new File([zip], nome, { type: 'application/zip' }), 'Backup completo do Diário de Obra')
  marcarBackup()
  return { como, fotos: fotos.length }
}

export type FormatoBackup = 'json' | 'zip'
export const formatoDoArquivo = (bytes: Uint8Array): FormatoBackup => (ehZip(bytes) ? 'zip' : 'json')

/** Confere o formato inteiro antes de apagar qualquer coisa. */
function validar(json: unknown): ArquivoBackup {
  const b = json as ArquivoBackup
  if (!b || b.app !== 'diario-de-obra' || b.versao !== 1 || typeof b.dados !== 'object' || !b.dados) {
    throw new Error('Este arquivo não é um backup do Diário de Obra.')
  }
  for (const nome of [...TABELAS_BACKUP, 'fotos']) {
    const linhas = b.dados[nome]
    if (linhas === undefined) continue
    if (!Array.isArray(linhas)) throw new Error(`Backup inválido: "${nome}" deveria ser uma lista.`)
    const chave = nome === 'meta' ? 'key' : 'id'
    if (linhas.some((l) => !l || typeof l !== 'object' || typeof (l as Record<string, unknown>)[chave] !== 'string')) {
      throw new Error(`Backup inválido: há registros sem identificação em "${nome}".`)
    }
  }
  return b
}

function lerJSON(texto: string): ArquivoBackup {
  let json: unknown
  try { json = JSON.parse(texto) } catch { throw new Error('O arquivo não é um backup válido (nem JSON nem ZIP).') }
  return validar(json)
}

/**
 * Importa um backup JSON (substitui os dados, mantém as fotos atuais) ou ZIP completo (substitui tudo, com fotos).
 * Valida o arquivo inteiro antes; a gravação é numa transação só, então um erro não deixa os dados pela metade.
 */
export async function importarArquivo(bytes: Uint8Array): Promise<{ registros: number; fotos: number | null }> {
  if (formatoDoArquivo(bytes) === 'json') {
    const { registros } = await gravar(lerJSON(new TextDecoder().decode(bytes)), null)
    return { registros, fotos: null }
  }

  const { unzipSync, strFromU8 } = await import('fflate')
  let conteudo: Record<string, Uint8Array>
  try { conteudo = unzipSync(bytes) } catch { throw new Error('O arquivo ZIP está corrompido ou incompleto.') }
  if (!conteudo['dados.json']) throw new Error('Este ZIP não é um backup do Diário de Obra (falta dados.json).')
  const json = lerJSON(strFromU8(conteudo['dados.json']))
  const metas = (json.dados.fotos ?? []) as FotoNoBackup[]
  const fotos: Foto[] = metas.map((m) => {
    const dados = typeof m.arquivo === 'string' ? conteudo[m.arquivo] : undefined
    if (!dados) throw new Error(`Backup incompleto: falta o arquivo da foto de ${m.data ?? '?'} (${m.id}).`)
    const mini = m.miniatura ? conteudo[m.miniatura] : undefined
    return {
      ...m,
      arquivo: new Blob([dados as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }),
      miniatura: mini ? new Blob([mini as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }) : undefined,
    }
  })
  return gravar(json, fotos)
}

/** fotos = null: não mexe nas fotos (backup JSON leve). */
async function gravar(json: ArquivoBackup, fotos: Foto[] | null) {
  let registros = 0
  const tabelas = [...TABELAS_BACKUP.map((n) => db.table(n)), ...(fotos ? [db.fotos] : [])]
  await db.transaction('rw', tabelas, async () => {
    for (const nome of TABELAS_BACKUP) {
      const linhas = (json.dados[nome] ?? []) as unknown[]
      await db.table(nome).clear()
      if (linhas.length) await db.table(nome).bulkPut(linhas)
      registros += linhas.length
    }
    if (fotos) {
      await db.fotos.clear()
      if (fotos.length) await db.fotos.bulkPut(fotos)
    }
  })
  return { registros, fotos: fotos?.length ?? null }
}

/** Compatibilidade: importa o texto de um backup JSON. */
export async function importarBackup(texto: string): Promise<{ registros: number }> {
  return gravar(lerJSON(texto), null)
}

export async function apagarTudo() {
  await db.delete()
  try { localStorage.removeItem(CHAVE_ULTIMO_BACKUP) } catch { /* ok */ }
}
