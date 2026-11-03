import { db } from '../db/db'
import type { Funcionario, Servico, Trecho, Unidade } from '../db/types'
import { agoraISO, uid } from '../lib/util'

// ---------- Funcionários ----------
export async function salvarFuncionario(
  obraId: string,
  dados: { nome: string; funcao: string },
  existente?: Funcionario,
) {
  const agora = agoraISO()
  if (existente) {
    await db.funcionarios.put({ ...existente, ...dados, updatedAt: agora })
  } else {
    await db.funcionarios.put({
      id: uid(), obraId, ...dados, ativo: true, createdAt: agora, updatedAt: agora,
    })
  }
}

export async function alternarAtivo(f: Funcionario) {
  await db.transaction('rw', db.funcionarios, async () => {
    const atual = await db.funcionarios.get(f.id)
    if (atual) await db.funcionarios.update(f.id, { ativo: !atual.ativo, updatedAt: agoraISO() })
  })
}

export async function removerFuncionario(f: Funcionario) {
  const agora = agoraISO()
  await db.funcionarios.update(f.id, { deletedAt: agora, updatedAt: agora })
}

// ---------- Serviços ----------
export async function salvarServico(
  obraId: string,
  dados: { nome: string; unidade: Unidade; quantidadePrevista: number; precoUnitario?: number },
  existente?: Servico,
) {
  const agora = agoraISO()
  if (existente) {
    await db.servicos.put({ ...existente, ...dados, updatedAt: agora })
  } else {
    await db.servicos.put({ id: uid(), obraId, ...dados, createdAt: agora, updatedAt: agora })
  }
}

export async function removerServico(s: Servico) {
  const agora = agoraISO()
  await db.servicos.put({ ...s, deletedAt: agora, updatedAt: agora })
}

// ---------- Trechos ----------
export async function salvarTrecho(
  obraId: string,
  dados: { nome: string; descricao?: string },
  existente?: Trecho,
) {
  const agora = agoraISO()
  if (existente) {
    await db.trechos.put({ ...existente, ...dados, updatedAt: agora })
  } else {
    await db.trechos.put({ id: uid(), obraId, ...dados, createdAt: agora, updatedAt: agora })
  }
}

export async function removerTrecho(t: Trecho) {
  const agora = agoraISO()
  await db.trechos.put({ ...t, deletedAt: agora, updatedAt: agora })
}
