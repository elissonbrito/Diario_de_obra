import { useLiveQuery } from 'dexie-react-hooks'
import { CHAVE_LOGO, db } from '../db/db'
import type { Obra } from '../db/types'

/** Logo da empresa da obra; se ainda não houver, o logo antigo da v0.3 (guardado em Ajustes). */
export function useLogoEmpresa(obra: Obra): string | null {
  const antigo = useLiveQuery(async () => {
    const m = await db.meta.get(CHAVE_LOGO)
    return typeof m?.value === 'string' ? m.value : null
  }, [])
  return obra.logoEmpresa ?? antigo ?? null
}
