import { db, TABELAS_BACKUP } from '../db/db'
import { dataLocal } from '../lib/util'

const CHAVE_ULTIMO_BACKUP = 'ultimoBackup'

export const ultimoBackup = (): string | null => {
  try { return localStorage.getItem(CHAVE_ULTIMO_BACKUP) } catch { return null }
}
const marcarBackup = () => {
  try { localStorage.setItem(CHAVE_ULTIMO_BACKUP, new Date().toISOString()) } catch { /* sem armazenamento */ }
}

export interface ArquivoBackup {
  app: 'diario-de-obra'
  versao: 1
  exportadoEm: string
  dados: Record<string, unknown[]>
}

export async function montarBackup(): Promise<ArquivoBackup> {
  const dados: Record<string, unknown[]> = {}
  for (const nome of TABELAS_BACKUP) {
    dados[nome] = await db.table(nome).toArray()
  }
  return { app: 'diario-de-obra', versao: 1, exportadoEm: new Date().toISOString(), dados }
}

/** Exporta o backup: no iPhone abre a folha de compartilhamento (Arquivos, Drive, WhatsApp...). */
export async function exportarBackup(): Promise<'compartilhado' | 'baixado'> {
  const backup = await montarBackup()
  const nome = `diario-obra-backup-${dataLocal()}.json`
  const arquivo = new File([JSON.stringify(backup, null, 2)], nome, { type: 'application/json' })

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare && nav.canShare({ files: [arquivo] })) {
    try {
      await nav.share({ files: [arquivo], title: 'Backup do Diário de Obra' })
      marcarBackup()
      return 'compartilhado'
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e // usuário cancelou
      // qualquer outro erro: cai no download comum
    }
  }
  const url = URL.createObjectURL(arquivo)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  marcarBackup()
  return 'baixado'
}

/** Substitui todos os dados pelos do arquivo. Valida o formato antes de apagar qualquer coisa. */
export async function importarBackup(texto: string): Promise<{ registros: number }> {
  let json: ArquivoBackup
  try { json = JSON.parse(texto) } catch { throw new Error('O arquivo não é um JSON válido.') }
  if (json.app !== 'diario-de-obra' || json.versao !== 1 || typeof json.dados !== 'object' || !json.dados) {
    throw new Error('Este arquivo não é um backup do Diário de Obra.')
  }
  for (const nome of TABELAS_BACKUP) {
    if (json.dados[nome] !== undefined && !Array.isArray(json.dados[nome])) {
      throw new Error(`Backup inválido: "${nome}" deveria ser uma lista.`)
    }
  }
  let registros = 0
  await db.transaction('rw', TABELAS_BACKUP.map((n) => db.table(n)), async () => {
    for (const nome of TABELAS_BACKUP) {
      const linhas = (json.dados[nome] ?? []) as unknown[]
      await db.table(nome).clear()
      if (linhas.length) await db.table(nome).bulkPut(linhas)
      registros += linhas.length
    }
  })
  return { registros }
}

export async function apagarTudo() {
  await db.delete()
  try { localStorage.removeItem(CHAVE_ULTIMO_BACKUP) } catch { /* ok */ }
}
