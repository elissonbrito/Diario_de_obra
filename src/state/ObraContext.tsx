import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Obra } from '../db/types'
import { migrarFotosAntigas } from '../repo/fotos'
import { garantirObraAtiva } from '../repo/obra'

const Ctx = createContext<Obra | null>(null)

export function useObra(): Obra {
  const obra = useContext(Ctx)
  if (!obra) throw new Error('Obra ativa não carregada')
  return obra
}

export function ObraProvider({ children }: { children: ReactNode }) {
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    garantirObraAtiva()
      // Fotos da v0.3 (Blob) passam para a tabela 'imagens' antes de abrir as telas. Uma falha aqui não
      // impede o app de abrir: a foto fica como "indisponível" e a conversão tenta de novo na próxima vez.
      .then(() => migrarFotosAntigas().catch(() => undefined))
      .then(() => setPronto(true))
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : String(e)))
    // Pede ao navegador para não apagar os dados do app sozinho (importante no iPhone).
    try { void navigator.storage?.persist?.() } catch { /* sem suporte */ }
  }, [])

  // undefined = carregando · null = não existe obra ativa (ex.: depois de importar backup sem obra)
  const obra = useLiveQuery(
    async () => {
      if (!pronto) return undefined
      const meta = await db.meta.get('obraAtivaId')
      const o = typeof meta?.value === 'string' ? await db.obras.get(meta.value) : undefined
      return o && !o.deletedAt ? o : null
    },
    [pronto],
  )

  useEffect(() => {
    if (pronto && obra === null) void garantirObraAtiva()
  }, [pronto, obra])

  if (erro) {
    return (
      <div className="tela-cheia">
        <h2>Não foi possível abrir o banco de dados</h2>
        <p>{erro}</p>
        <p className="mudo">
          Se estiver numa aba privada, abra o endereço numa aba normal do Safari e tente de novo.
        </p>
      </div>
    )
  }
  if (!obra) return <div className="tela-cheia">Carregando…</div>
  return <Ctx.Provider value={obra}>{children}</Ctx.Provider>
}
