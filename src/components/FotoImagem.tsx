import { useEffect, useState } from 'react'
import type { Foto, QualImagem } from '../db/types'
import { useFotoUrl } from '../hooks/useFotoUrl'

type FotoBase = Pick<Foto, 'id' | 'tamanho' | 'temMiniatura' | 'indisponivel'>

/**
 * Mostra a foto; se os bytes faltarem ou o navegador não conseguir desenhar (onError),
 * troca o ícone de imagem quebrada por "Foto indisponível" (com "Remover", quando informado).
 */
export function FotoImagem({
  foto, qual, alt, lazy = true, className, onEstado, onRemover,
}: {
  foto: FotoBase; qual: QualImagem; alt: string; lazy?: boolean; className?: string
  onEstado?: (estado: 'ok' | 'indisponivel') => void
  onRemover?: () => void
}) {
  const { url, estado } = useFotoUrl(foto, qual)
  const [falhou, setFalhou] = useState(false)
  useEffect(() => setFalhou(false), [url])

  const indisponivel = estado === 'indisponivel' || falhou
  useEffect(() => { if (indisponivel) onEstado?.('indisponivel') }, [indisponivel, onEstado])

  if (indisponivel) {
    return (
      <span className={`foto-indisponivel ${className ?? ''}`} role="img" aria-label="Foto indisponível">
        <span>Foto indisponível</span>
        {onRemover && (
          <button type="button" className="btn btn-perigo" onClick={onRemover}>Remover</button>
        )}
      </span>
    )
  }
  if (!url) return <span className={`foto-vazia ${className ?? ''}`} aria-hidden="true" />
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
      onLoad={(e) => {
        if ((e.target as HTMLImageElement).naturalWidth > 0) onEstado?.('ok')
        else setFalhou(true)
      }}
      onError={() => setFalhou(true)}
    />
  )
}
