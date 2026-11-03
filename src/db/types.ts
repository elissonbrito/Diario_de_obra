// Todos os registros têm id único (UUID), datas de criação/alteração e marca de exclusão.
// Isso deixa a sincronização com um servidor possível no futuro sem refazer o banco.
export interface Base {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface Meta {
  key: string
  value: unknown
}

export interface Obra extends Base {
  nome: string
  empresa: string // quem contrata o acompanhamento (ex.: BW Engenharia)
  local: string
  inicio?: string // AAAA-MM-DD
  prazoFinal?: string // AAAA-MM-DD (opcional)
  diaFechamento?: number // dia do mês em que fecha a medição (1–31; 31 = fim do mês)
}

export type Unidade = 'm' | 'm²' | 'm³' | 'un' | 'vb'
export const UNIDADES: Unidade[] = ['m', 'm²', 'm³', 'un', 'vb']

export interface Servico extends Base {
  obraId: string
  nome: string
  unidade: Unidade
  quantidadePrevista: number
  precoUnitario?: number // R$ por unidade, usado só nas estimativas de medição
}

export interface Trecho extends Base {
  obraId: string
  nome: string
  descricao?: string
}

export interface Funcionario extends Base {
  obraId: string
  nome: string
  funcao: string
  ativo: boolean
}

export type StatusFrequencia = 'presente' | 'atraso' | 'falta'

export interface Frequencia extends Base {
  obraId: string
  data: string // AAAA-MM-DD
  funcionarioId: string
  status: StatusFrequencia
  entrada?: string // HH:MM
  saida?: string // HH:MM
  trechoId?: string
  obs?: string
}

// Tabelas das próximas etapas (já criadas para não precisar migrar o banco depois).
export interface Medicao extends Base {
  obraId: string
  data: string
  servicoId: string
  trechoId?: string
  quantidade: number
  obs?: string
}

export interface Diario extends Base {
  obraId: string
  data: string
  clima?: string
  resumo?: string
}

export interface Ocorrencia extends Base {
  obraId: string
  data: string
  tipo: 'paralisacao' | 'material_pedido' | 'material_chegada' | 'outra'
  descricao: string
}

export interface Foto extends Base {
  obraId: string
  data: string
  hora: string
  latitude?: number
  longitude?: number
  precisaoM?: number
  servicoId?: string
  trechoId?: string
  legenda?: string
  arquivo: Blob
}

// Materiais consumíveis (ex.: concreto, meio-fio) e ferramentas/equipamentos.
export interface Material extends Base {
  obraId: string
  tipo: 'material' | 'ferramenta'
  nome: string
  unidade: string // texto livre: m³, peças, sacos, un...
  antecedenciaDias: number // quantos dias antes é preciso pedir
  // material: consumo calculado a partir da produção de um serviço
  servicoId?: string
  consumoPorUnidade?: number // quanto do material gasta por unidade do serviço (ex.: 0,08 m³ por m²)
  perdaPct?: number // % de perda/sobra a somar
  // ferramenta: quantidades fixas
  quantidadeNecessaria?: number
  quantidadeDisponivel?: number
  dataNecessaria?: string // AAAA-MM-DD
}

export interface Entrega extends Base {
  obraId: string
  materialId: string
  data: string
  quantidade: number
  obs?: string
}
