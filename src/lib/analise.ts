// Cálculos do app. Funções puras (sem banco, sem tela) para poderem ser testadas isoladamente.
// Convenção: datas no formato AAAA-MM-DD; "dia útil" = segunda a sexta (feriados não são considerados).
import type { Entrega, Frequencia, Material, Medicao, Servico } from '../db/types'
import { dataLocal } from './util'

const parse = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDias = (iso: string, n: number): string => {
  const d = parse(iso)
  d.setDate(d.getDate() + n)
  return dataLocal(d)
}

export const ehUtil = (iso: string): boolean => {
  const w = parse(iso).getDay()
  return w !== 0 && w !== 6
}

/** Diferença em dias corridos (b − a). */
export const difDias = (a: string, b: string): number =>
  Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000)

/** Quantidade de dias úteis entre duas datas, contando as duas pontas. */
export function diasUteis(ini: string, fim: string): number {
  if (fim < ini) return 0
  let n = 0
  const d = parse(ini)
  while (dataLocal(d) <= fim) {
    if (d.getDay() !== 0 && d.getDay() !== 6) n++
    d.setDate(d.getDate() + 1)
  }
  return n
}

/** Avança n dias úteis a partir da data (n = 0 devolve a própria data). */
export function addDiasUteis(iso: string, n: number): string {
  const d = parse(iso)
  let c = 0
  while (c < n) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) c++
  }
  return dataLocal(d)
}

/** Segunda-feira da semana da data. */
export function inicioSemana(iso: string): string {
  const dia = parse(iso).getDay() // 0 = domingo
  return addDias(iso, -((dia + 6) % 7))
}

const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

// ---------------------------------------------------------------------------
// Produção e ritmo
// ---------------------------------------------------------------------------

export const executadoDoServico = (medicoes: Medicao[], servicoId: string): number =>
  soma(medicoes.filter((m) => m.servicoId === servicoId).map((m) => m.quantidade))

export interface Ritmo {
  porDia: number // média por dia útil
  dias: number // dias úteis considerados
  ini: string
  fim: string
}

/**
 * Ritmo médio por dia útil de um serviço, nos últimos `janelaUteis` dias úteis.
 * - A janela termina hoje (se já houve lançamento hoje) ou no último dia útil anterior.
 * - Começa, no máximo, na primeira medição do serviço (para não diluir o ritmo antes de ele começar).
 * - Dias úteis sem produção entram no cálculo (chuva, falta de material etc. fazem parte da realidade).
 */
export function ritmoServico(
  todas: Medicao[], servicoId: string, hoje: string, janelaUteis = 14,
): Ritmo {
  const doServico = todas.filter((m) => m.servicoId === servicoId)
  if (doServico.length === 0) return { porDia: 0, dias: 0, ini: hoje, fim: hoje }

  const primeira = doServico.reduce((min, m) => (m.data < min ? m.data : min), doServico[0].data)
  let fim = hoje
  if (!todas.some((m) => m.data === hoje)) {
    fim = addDias(hoje, -1)
    while (!ehUtil(fim)) fim = addDias(fim, -1)
  }
  if (fim < primeira) return { porDia: 0, dias: 0, ini: primeira, fim }

  let ini = fim
  let contados = ehUtil(fim) ? 1 : 0
  while (contados < janelaUteis && ini > primeira) {
    ini = addDias(ini, -1)
    if (ehUtil(ini)) contados++
  }
  if (ini < primeira) ini = primeira

  const dias = Math.max(1, diasUteis(ini, fim))
  const total = soma(doServico.filter((m) => m.data >= ini && m.data <= fim).map((m) => m.quantidade))
  return { porDia: total / dias, dias, ini, fim }
}

// ---------------------------------------------------------------------------
// Previsão de término
// ---------------------------------------------------------------------------

export interface PrevisaoServico {
  servico: Servico
  executado: number
  restante: number
  pct: number // 0–100+ (pode passar de 100 se exceder o previsto)
  ritmo: Ritmo
  diasRestantes: number | null // dias úteis; null se não há ritmo
  termino: string | null // null se concluído ou sem ritmo
  concluido: boolean
}

export function preverServicos(
  servicos: Servico[], medicoes: Medicao[], hoje: string, janelaUteis = 14,
): PrevisaoServico[] {
  return servicos.map((servico) => {
    const executado = executadoDoServico(medicoes, servico.id)
    const restante = Math.max(0, servico.quantidadePrevista - executado)
    const concluido = servico.quantidadePrevista > 0 && restante === 0
    const ritmo = ritmoServico(medicoes, servico.id, hoje, janelaUteis)
    const diasRestantes = concluido ? 0 : ritmo.porDia > 0 ? Math.ceil(restante / ritmo.porDia) : null
    const termino = concluido || diasRestantes === null ? null : addDiasUteis(hoje, diasRestantes)
    const pct = servico.quantidadePrevista > 0 ? (executado / servico.quantidadePrevista) * 100 : 0
    return { servico, executado, restante, pct, ritmo, diasRestantes, termino, concluido }
  })
}

export interface PrevisaoObra {
  termino: string | null // data do último serviço a terminar (serviços avançam em paralelo)
  semPrevisao: Servico[] // serviços pendentes sem ritmo (ainda não começaram ou estão parados)
  concluida: boolean
}

export function preverObra(previsoes: PrevisaoServico[]): PrevisaoObra {
  const pendentes = previsoes.filter((p) => !p.concluido)
  const datas = pendentes.map((p) => p.termino).filter((d): d is string => !!d)
  return {
    termino: datas.length ? datas.reduce((a, b) => (a > b ? a : b)) : null,
    semPrevisao: pendentes.filter((p) => p.termino === null).map((p) => p.servico),
    concluida: previsoes.length > 0 && pendentes.length === 0,
  }
}

export interface ComparacaoPrazo {
  situacao: 'adiantada' | 'no-prazo' | 'atrasada'
  diasUteis: number // quantos dias úteis de folga (adiantada) ou de atraso
}

export function compararPrazo(termino: string, prazo: string): ComparacaoPrazo {
  if (termino > prazo) return { situacao: 'atrasada', diasUteis: diasUteis(addDias(prazo, 1), termino) }
  const folga = diasUteis(addDias(termino, 1), prazo)
  return { situacao: folga > 0 ? 'adiantada' : 'no-prazo', diasUteis: folga }
}

/** Quanto precisa produzir por dia útil, a partir de amanhã, para terminar no prazo. */
export function ritmoNecessario(restante: number, prazo: string, hoje: string): number | null {
  const du = diasUteis(addDias(hoje, 1), prazo)
  return du > 0 ? restante / du : null
}

// ---------------------------------------------------------------------------
// Medição estimada do período
// ---------------------------------------------------------------------------

/** Data de fechamento no mês (dia 31 = último dia do mês, mesmo em meses mais curtos). */
export function fechamentoNoMes(ano: number, mes0: number, dia: number): string {
  const ultimo = new Date(ano, mes0 + 1, 0).getDate()
  return dataLocal(new Date(ano, mes0, Math.min(dia, ultimo)))
}

/** Período de medição que contém `hoje`: do dia seguinte ao fechamento anterior até o próximo fechamento. */
export function periodoMedicao(hoje: string, diaFechamento: number): { ini: string; fim: string } {
  const d = parse(hoje)
  let fim = fechamentoNoMes(d.getFullYear(), d.getMonth(), diaFechamento)
  if (hoje > fim) fim = fechamentoNoMes(d.getFullYear(), d.getMonth() + 1, diaFechamento)
  const f = parse(fim)
  const anterior = fechamentoNoMes(f.getFullYear(), f.getMonth() - 1, diaFechamento)
  return { ini: addDias(anterior, 1), fim }
}

export interface LinhaMedicao {
  servico: Servico
  medido: number // no período, até hoje
  projetado: number // até o fechamento, mantendo o ritmo (limitado ao que falta)
  valorMedido: number | null
  valorProjetado: number | null
}

export interface EstimativaMedicao {
  periodo: { ini: string; fim: string }
  linhas: LinhaMedicao[]
  totalMedido: number | null
  totalProjetado: number | null
}

export function estimarMedicao(
  servicos: Servico[], medicoes: Medicao[], hoje: string, diaFechamento: number, janelaUteis = 14,
): EstimativaMedicao {
  const periodo = periodoMedicao(hoje, diaFechamento)
  const diasAteFechar = diasUteis(addDias(hoje, 1), periodo.fim)
  const linhas = servicos.map<LinhaMedicao>((servico) => {
    const medido = soma(
      medicoes
        .filter((m) => m.servicoId === servico.id && m.data >= periodo.ini && m.data <= hoje)
        .map((m) => m.quantidade),
    )
    const restante = Math.max(0, servico.quantidadePrevista - executadoDoServico(medicoes, servico.id))
    const ritmo = ritmoServico(medicoes, servico.id, hoje, janelaUteis).porDia
    const projetado = medido + Math.min(restante, ritmo * diasAteFechar)
    const preco = servico.precoUnitario
    return {
      servico, medido, projetado,
      valorMedido: preco !== undefined ? medido * preco : null,
      valorProjetado: preco !== undefined ? projetado * preco : null,
    }
  })
  const somaValores = (campo: 'valorMedido' | 'valorProjetado') => {
    const v = linhas.map((l) => l[campo]).filter((x): x is number => x !== null)
    return v.length ? soma(v) : null
  }
  return { periodo, linhas, totalMedido: somaValores('valorMedido'), totalProjetado: somaValores('valorProjetado') }
}

// ---------------------------------------------------------------------------
// Materiais e ferramentas
// ---------------------------------------------------------------------------

export type Situacao = 'ok' | 'atencao' | 'pedir' | 'sem-dados'

export interface StatusMaterial {
  material: Material
  consumoAcum: number // consumido até hoje (estimado pela produção)
  recebido: number // soma das entregas
  saldo: number // recebido − consumido
  consumoDia: number // consumo previsto por dia útil, no ritmo atual
  diasEstoque: number | null // dias úteis que o saldo ainda cobre
  esgotaEm: string | null // último dia coberto pelo estoque
  pedirAte: string | null // esgotaEm − antecedência
  situacao: Situacao
  qtdSugerida: number | null // quanto pedir para cobrir a janela de cobertura
  faltam: number | null // ferramentas: quantas faltam
}

const DIAS_ATENCAO = 3

function situacaoPorData(pedirAte: string, hoje: string): Situacao {
  if (pedirAte < hoje) return 'pedir'
  return difDias(hoje, pedirAte) <= DIAS_ATENCAO ? 'atencao' : 'ok'
}

export function statusMaterial(
  material: Material,
  ctx: { servicos: Servico[]; medicoes: Medicao[]; entregas: Entrega[]; hoje: string; janelaUteis?: number },
  coberturaDias = 5,
): StatusMaterial {
  const { medicoes, hoje } = ctx
  const recebido = soma(ctx.entregas.filter((e) => e.materialId === material.id).map((e) => e.quantidade))

  const base: StatusMaterial = {
    material, consumoAcum: 0, recebido, saldo: recebido, consumoDia: 0, diasEstoque: null,
    esgotaEm: null, pedirAte: null, situacao: 'sem-dados', qtdSugerida: null, faltam: null,
  }

  if (material.tipo === 'ferramenta') {
    const nec = material.quantidadeNecessaria ?? 0
    const disp = material.quantidadeDisponivel ?? 0
    const faltam = Math.max(0, nec - disp)
    if (faltam === 0) return { ...base, faltam, situacao: nec > 0 ? 'ok' : 'sem-dados' }
    if (!material.dataNecessaria) return { ...base, faltam, situacao: 'pedir' }
    const pedirAte = addDias(material.dataNecessaria, -material.antecedenciaDias)
    return { ...base, faltam, pedirAte, situacao: situacaoPorData(pedirAte, hoje) }
  }

  const coef = material.consumoPorUnidade
  if (!material.servicoId || !coef || coef <= 0) return base
  const fator = coef * (1 + (material.perdaPct ?? 0) / 100)
  const consumoAcum = executadoDoServico(medicoes, material.servicoId) * fator
  const saldo = recebido - consumoAcum
  const consumoDia = ritmoServico(medicoes, material.servicoId, hoje, ctx.janelaUteis ?? 14).porDia * fator

  if (consumoDia <= 0) {
    return { ...base, consumoAcum, saldo, situacao: saldo < 0 ? 'pedir' : 'sem-dados' }
  }

  const diasEstoque = Math.max(0, Math.floor(saldo / consumoDia))
  const esgotaEm = addDiasUteis(hoje, diasEstoque)
  const pedirAte = addDias(esgotaEm, -material.antecedenciaDias)
  const qtdSugerida = Math.max(0, consumoDia * coberturaDias - Math.max(0, saldo))
  return {
    ...base, consumoAcum, saldo, consumoDia, diasEstoque, esgotaEm, pedirAte, qtdSugerida,
    situacao: saldo < 0 ? 'pedir' : situacaoPorData(pedirAte, hoje),
  }
}

// ---------------------------------------------------------------------------
// Frequência
// ---------------------------------------------------------------------------

export interface ResumoFuncionario {
  funcionarioId: string
  presencas: number
  atrasos: number
  faltas: number
  registros: number
  pctPresenca: number | null // (presenças + atrasos) ÷ registros
  ocorrencias: Frequencia[] // faltas e atrasos, mais recentes primeiro
}

export function resumirFrequencia(regs: Frequencia[]): ResumoFuncionario[] {
  const porFunc = new Map<string, Frequencia[]>()
  for (const r of regs) porFunc.set(r.funcionarioId, [...(porFunc.get(r.funcionarioId) ?? []), r])
  return [...porFunc.entries()].map(([funcionarioId, lista]) => {
    const presencas = lista.filter((r) => r.status === 'presente').length
    const atrasos = lista.filter((r) => r.status === 'atraso').length
    const faltas = lista.filter((r) => r.status === 'falta').length
    return {
      funcionarioId, presencas, atrasos, faltas, registros: lista.length,
      pctPresenca: lista.length ? ((presencas + atrasos) / lista.length) * 100 : null,
      ocorrencias: lista.filter((r) => r.status !== 'presente').sort((a, b) => b.data.localeCompare(a.data)),
    }
  })
}
