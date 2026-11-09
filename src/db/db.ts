import Dexie, { type Table } from 'dexie'
import type {
  Diario, Entrega, Foto, Frequencia, Funcionario, ImagemFoto, Material, Medicao, Meta, Obra, Ocorrencia, Servico, Trecho,
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
  imagens!: Table<ImagemFoto, string>

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
    // v3: bytes das fotos numa tabela própria (ArrayBuffer em vez de Blob, que falha no iOS).
    // A conversão das fotos antigas não cabe no upgrade (ler Blob é assíncrono e fecharia a transação):
    // roda logo depois de abrir o banco, em migrarFotosAntigas().
    this.version(3).stores({
      imagens: 'id, fotoId',
    })
  }
}

export const db = new DiarioDB()

/** Tabelas que entram no backup (as de dados do usuário). */
export const TABELAS_BACKUP = [
  'meta', 'obras', 'servicos', 'trechos', 'funcionarios', 'frequencias',
  'medicoes', 'diarios', 'ocorrencias', 'materiais', 'entregas',
] as const
// 'fotos' e 'imagens' ficam fora do backup JSON (bytes não vão em JSON): entram só no backup completo (ZIP).

/** Chave em db.meta com o logo do relatório (data URL, para caber no backup JSON). */
export const CHAVE_LOGO = 'logoRelatorio'
