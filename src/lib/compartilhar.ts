/**
 * No iPhone abre a folha de compartilhamento (Arquivos, Drive, WhatsApp...); onde não houver, baixa o arquivo.
 * Rejeita com AbortError se o usuário cancelar o compartilhamento.
 */
export async function compartilharOuBaixar(arquivo: File, titulo: string): Promise<'compartilhado' | 'baixado'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare && nav.canShare({ files: [arquivo] })) {
    try {
      await nav.share({ files: [arquivo], title: titulo })
      return 'compartilhado'
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e // usuário cancelou
      // qualquer outro erro: cai no download comum
    }
  }
  const url = URL.createObjectURL(arquivo)
  const a = document.createElement('a')
  a.href = url
  a.download = arquivo.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'baixado'
}
