import { useEffect, useState } from 'react'

/** URL temporária para mostrar um Blob em <img>. É revogada ao trocar o Blob ou desmontar (sem vazar memória). */
export function useObjectUrl(blob?: Blob | null): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob || blob.size === 0) { setUrl(undefined); return }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}
