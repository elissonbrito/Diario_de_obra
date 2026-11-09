// Regras do diário de obra. Funções puras (sem banco, sem tela), testadas em tests/unit.
import type { Clima, Diario, Foto, Frequencia, Medicao, Servico } from '../db/types'
import { CLIMAS } from '../db/types'
import { addDias, ehUtil } from './analise'

/** Um diário por obra e por dia: o id é fixo, então salvar de novo no mesmo dia só atualiza. */
export const idDiario = (obraId: string, data: string) => `${obraId}__${data}`

export const rotuloClima = (c?: Clima) => CLIMAS.find((x) => x.valor === c)?.rotulo

/** O diário conta como registrado só se o usuário escreveu ou marcou algo (não basta abrir a tela). */
export function diarioTemConteudo(d?: Diario | null): boolean {
  if (!d || d.deletedAt) return false
  return Boolean(
    d.climaManha || d.climaTarde || d.paralisacao || d.motivoParalisacao?.trim() ||
    d.atividades?.trim() || d.ocorrencias?.trim() || (d.equipamentos && d.equipamentos.length > 0) ||
    d.resumo?.trim() || d.clima?.trim(),
  )
}

export interface Efetivo { presentes: number; atrasos: number; faltas: number; total: number }

/** Presença do dia a partir da chamada. `validos` = funcionários não excluídos (como na tela Chamada). */
export function efetivoDoDia(regs: Frequencia[], data: string, validos?: Set<string>): Efetivo {
  const doDia = regs.filter((r) => r.data === data && !r.deletedAt && (!validos || validos.has(r.funcionarioId)))
  const presentes = doDia.filter((r) => r.status === 'presente').length
  const atrasos = doDia.filter((r) => r.status === 'atraso').length
  const faltas = doDia.filter((r) => r.status === 'falta').length
  return { presentes, atrasos, faltas, total: doDia.length }
}

/** Produção lançada no dia, somada por serviço (só serviços com quantidade > 0, na ordem de cadastro). */
export function producaoDoDia(servicos: Servico[], medicoes: Medicao[], data: string) {
  return servicos
    .map((servico) => ({
      servico,
      quantidade: medicoes
        .filter((m) => m.servicoId === servico.id && m.data === data && !m.deletedAt)
        .reduce((t, m) => t + m.quantidade, 0),
    }))
    .filter((x) => x.quantidade > 0)
}

/** Agrupa por dia, do mais recente para o mais antigo; dentro do dia, por hora crescente. */
export function agruparPorDia<T extends { data: string; hora?: string }>(itens: T[]): { data: string; itens: T[] }[] {
  const mapa = new Map<string, T[]>()
  for (const i of itens) mapa.set(i.data, [...(mapa.get(i.data) ?? []), i])
  return [...mapa.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([data, lista]) => ({ data, itens: lista.sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? '')) }))
}

/**
 * Dias úteis sem diário, entre os últimos `n` dias úteis antes de hoje (hoje ainda está em andamento).
 * Não marca dias anteriores ao início da obra, quando ele foi informado. Mais recente primeiro.
 */
export function diasUteisPendentes(hoje: string, registrados: Set<string>, n = 14, inicioObra?: string): string[] {
  const pendentes: string[] = []
  let d = hoje
  let contados = 0
  while (contados < n) {
    d = addDias(d, -1)
    if (inicioObra && d < inicioObra) break
    if (!ehUtil(d)) continue
    contados++
    if (!registrados.has(d)) pendentes.push(d)
  }
  return pendentes
}

/** Dias do período que entram no relatório: os que têm diário preenchido ou pelo menos uma foto. */
export function diasDoRelatorio(de: string, ate: string, diarios: Diario[], fotos: Pick<Foto, 'data' | 'deletedAt'>[]): string[] {
  const dias = new Set<string>()
  for (const d of diarios) if (d.data >= de && d.data <= ate && diarioTemConteudo(d)) dias.add(d.data)
  for (const f of fotos) if (!f.deletedAt && f.data >= de && f.data <= ate) dias.add(f.data)
  return [...dias].sort()
}

/** Primeiras palavras do texto, para listas. */
export function trechoInicial(texto: string | undefined, max = 80): string {
  const t = (texto ?? '').replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}
