import Dexie, { type Table } from 'dexie'
import type {
  Diario, Entrega, Foto, Frequencia, Funcionario, Material, Medicao, Meta, Obra, Ocorrencia, Servico, Trecho,
} from './types'

class DiarioDB extends Dexie {
  meta!: Table<Meta, string>
  obras!: Table<Obra, string>
  servicos!: Table<Servico, string>
  trechos!: Table<Trecho, string>
  funcionarios!: Table<Funcionario, string>
  frequencias!: Table<Frequencia, string>
  medicoes!: Table<Medicao, string>
  diarios!: Table<Diario, string>
  ocorrencias!: Table<Ocorrencia, string>
  fotos!: Table<Foto, string>
  materiais!: Table<Material, string>
  entregas!: Table<Entrega, string>

  constructor() {
    super('diario-de-obra')
    // Obs.: IndexedDB não indexa valores booleanos, por isso 'ativo' não entra nos índices.
    this.version(1).stores({
      meta: 'key',
      obras: 'id',
      servicos: 'id, obraId',
      trechos: 'id, obraId',
      funcionarios: 'id, obraId, nome',
      frequencias: 'id, obraId, data, funcionarioId',
      medicoes: 'id, obraId, data, servicoId, trechoId',
      diarios: 'id, obraId, data',
      ocorrencias: 'id, obraId, data, tipo',
      fotos: 'id, obraId, data, servicoId, trechoId',
    })
    // v2: materiais/ferramentas e entregas de material (tabelas novas; as demais seguem iguais)
    this.version(2).stores({
      materiais: 'id, obraId, servicoId',
      entregas: 'id, obraId, materialId, data',
    })
  }
}

export const db = new DiarioDB()

/** Tabelas que entram no backup (as de dados do usuário). */
export const TABELAS_BACKUP = [
  'meta', 'obras', 'servicos', 'trechos', 'funcionarios', 'frequencias',
  'medicoes', 'diarios', 'ocorrencias', 'materiais', 'entregas',
] as const
// 'fotos' entra no backup na etapa das fotos (arquivos precisam de tratamento à parte).
