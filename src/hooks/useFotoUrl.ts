import { useEffect, useState } from 'react'
import type { Foto, QualImagem } from '../db/types'
import { lerImagem } from '../repo/fotos'

export type EstadoFoto = 'carregando' | 'ok' | 'indisponivel'

/**
 * URL para mostrar a foto em <img>. Lê os bytes do banco e cria o object URL uma vez por foto:
 * depende só do id e da versão da imagem (tamanho), não do objeto que o liveQuery entrega a cada
 * atualização — então editar a legenda, por exemplo, não recria nem revoga a URL. Revoga ao desmontar.
 */
export function useFotoUrl(
  foto: Pick<Foto, 'id' | 'tamanho' | 'temMiniatura' | 'indisponivel'> | null | undefined, qual: QualImagem,
): { url?: string; estado: EstadoFoto } {
  const chave = foto ? `${foto.id}|${qual}|${foto.tamanho ?? 0}|${foto.temMiniatura ? 1 : 0}|${foto.indisponivel ? 1 : 0}` : ''
  const [r, setR] = useState<{ chave: string; url?: string; estado: EstadoFoto }>({ chave: '', estado: 'carregando' })

  useEffect(() => {
    if (!foto || !foto.tamanho || foto.indisponivel) { setR({ chave, estado: 'indisponivel' }); return }
    let vivo = true
    let url: string | undefined
    lerImagem(foto, qual)
      .then((b) => {
        if (!vivo) return
        if (!b) { setR({ chave, estado: 'indisponivel' }); return }
        url = URL.createObjectURL(new Blob([b.dados], { type: b.tipo }))
        setR({ chave, url, estado: 'ok' })
      })
      .catch(() => { if (vivo) setR({ chave, estado: 'indisponivel' }) })
    return () => {
      vivo = false
      if (url) URL.revokeObjectURL(url)
    }
    // a chave resume o que importa da foto (id e versão da imagem)
  }, [chave])

  return r.chave === chave ? r : { estado: 'carregando' }
}
