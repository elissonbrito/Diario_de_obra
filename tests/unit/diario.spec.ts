import { expect, test } from '@playwright/test'
import type { Diario, Frequencia, Medicao, Servico } from '../../src/db/types'
import {
  agruparPorDia, diarioTemConteudo, diasDoRelatorio, diasUteisPendentes, efetivoDoDia, idDiario, producaoDoDia, trechoInicial,
} from '../../src/lib/diario'

const base = { createdAt: '', updatedAt: '' }
const diario = (data: string, extra: Partial<Diario> = {}): Diario => ({ id: idDiario('o', data), obraId: 'o', data, ...base, ...extra })

test('id do diário é fixo por obra e dia', () => {
  expect(idDiario('obra1', '2026-11-05')).toBe('obra1__2026-11-05')
})

test('diário só conta como registrado com conteúdo', () => {
  expect(diarioTemConteudo(undefined)).toBe(false)
  expect(diarioTemConteudo(diario('2026-11-05'))).toBe(false)
  expect(diarioTemConteudo(diario('2026-11-05', { atividades: '   ', equipamentos: [] }))).toBe(false)
  expect(diarioTemConteudo(diario('2026-11-05', { atividades: 'Escavação' }))).toBe(true)
  expect(diarioTemConteudo(diario('2026-11-05', { climaManha: 'bom' }))).toBe(true)
  expect(diarioTemConteudo(diario('2026-11-05', { equipamentos: ['Retro'] }))).toBe(true)
  expect(diarioTemConteudo(diario('2026-11-05', { atividades: 'x', deletedAt: '2026' }))).toBe(false)
})

test('agruparPorDia: dia mais recente primeiro e horas em ordem', () => {
  const g = agruparPorDia([
    { data: '2026-11-03', hora: '10:00' },
    { data: '2026-11-05', hora: '15:00' },
    { data: '2026-11-05', hora: '08:30' },
  ])
  expect(g.map((x) => x.data)).toEqual(['2026-11-05', '2026-11-03'])
  expect(g[0].itens.map((x) => x.hora)).toEqual(['08:30', '15:00'])
  expect(agruparPorDia([])).toEqual([])
})

test('diasUteisPendentes: últimos dias úteis sem diário, sem fim de semana nem hoje', () => {
  // 2026-11-09 é segunda-feira
  const p = diasUteisPendentes('2026-11-09', new Set(['2026-11-05']), 5)
  // 5 dias úteis antes: 06 (sex), 05 (qui), 04, 03, 02 (seg) — 05 está registrado
  expect(p).toEqual(['2026-11-06', '2026-11-04', '2026-11-03', '2026-11-02'])
  expect(p).not.toContain('2026-11-09')
  expect(p).not.toContain('2026-11-07') // sábado
})

test('diasUteisPendentes respeita o início da obra', () => {
  expect(diasUteisPendentes('2026-11-09', new Set(), 14, '2026-11-05')).toEqual(['2026-11-06', '2026-11-05'])
})

test('diasDoRelatorio: só dias com diário preenchido ou foto, dentro do período', () => {
  const dias = diasDoRelatorio(
    '2026-11-02', '2026-11-06',
    [diario('2026-11-02', { atividades: 'a' }), diario('2026-11-03'), diario('2026-11-10', { atividades: 'fora' })],
    [{ data: '2026-11-04' }, { data: '2026-11-05', deletedAt: 'x' }, { data: '2026-11-02' }],
  )
  expect(dias).toEqual(['2026-11-02', '2026-11-04'])
})

test('efetivo e produção do dia', () => {
  const f = (id: string, status: Frequencia['status'], data = '2026-11-05'): Frequencia =>
    ({ id, obraId: 'o', data, funcionarioId: id, status, ...base })
  const regs = [f('a', 'presente'), f('b', 'atraso'), f('c', 'falta'), f('d', 'presente', '2026-11-04'), f('e', 'presente')]
  expect(efetivoDoDia(regs, '2026-11-05', new Set(['a', 'b', 'c']))).toEqual({ presentes: 1, atrasos: 1, faltas: 1, total: 3 })

  const s: Servico = { id: 's1', obraId: 'o', nome: 'Meio-fio', unidade: 'm', quantidadePrevista: 100, ...base }
  const s2: Servico = { ...s, id: 's2', nome: 'Calçada' }
  const m = (q: number, data = '2026-11-05', servicoId = 's1'): Medicao => ({ id: String(q), obraId: 'o', data, servicoId, quantidade: q, ...base })
  expect(producaoDoDia([s, s2], [m(10), m(5.5), m(99, '2026-11-04')], '2026-11-05')).toEqual([{ servico: s, quantidade: 15.5 }])
})

test('trechoInicial corta textos longos', () => {
  expect(trechoInicial('  curto\n texto ')).toBe('curto texto')
  expect(trechoInicial('a'.repeat(100), 10)).toBe('aaaaaaaaa…')
})
