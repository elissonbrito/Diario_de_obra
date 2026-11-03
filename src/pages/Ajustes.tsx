import { useEffect, useRef, useState } from 'react'
import { apagarTudo, exportarBackup, importarBackup, ultimoBackup } from '../repo/backup'

interface Armazenamento { usado?: number; cota?: number; persistente?: boolean }

const mb = (n?: number) => (n === undefined ? '—' : `${(n / 1024 / 1024).toFixed(1)} MB`)

export default function Ajustes() {
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [arm, setArm] = useState<Armazenamento>({})
  const [ub, setUb] = useState(ultimoBackup())
  const inputArquivo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      try {
        const est = await navigator.storage?.estimate?.()
        const persistente = await navigator.storage?.persisted?.()
        setArm({ usado: est?.usage, cota: est?.quota, persistente })
      } catch { /* sem suporte */ }
    })()
  }, [])

  async function exportar() {
    setOcupado(true); setMsg(null)
    try {
      const como = await exportarBackup()
      setUb(ultimoBackup())
      setMsg({ tipo: 'ok', texto: como === 'compartilhado' ? 'Backup enviado. Guarde o arquivo no Drive ou em Arquivos.' : 'Backup baixado.' })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMsg({ tipo: 'erro', texto: `Falha ao exportar: ${(e as Error).message}` })
    } finally { setOcupado(false) }
  }

  async function importar(arquivo: File) {
    if (!window.confirm('Importar vai SUBSTITUIR todos os dados atuais pelos do arquivo. Continuar?')) return
    setOcupado(true); setMsg(null)
    try {
      const { registros } = await importarBackup(await arquivo.text())
      setMsg({ tipo: 'ok', texto: `Importação concluída (${registros} registros).` })
    } catch (e) {
      setMsg({ tipo: 'erro', texto: (e as Error).message })
    } finally {
      setOcupado(false)
      if (inputArquivo.current) inputArquivo.current.value = ''
    }
  }

  async function apagar() {
    if (!window.confirm('Apagar TODOS os dados deste aparelho? Isso não pode ser desfeito. Faça um backup antes.')) return
    await apagarTudo()
    window.location.reload()
  }

  return (
    <div className="pagina">
      <h1>Ajustes</h1>

      <section className="cartao">
        <h2>Backup</h2>
        <p className="mudo">
          Os dados ficam só neste aparelho. Faça backup com frequência e guarde o arquivo no Google Drive,
          em Arquivos ou envie para você mesmo no WhatsApp.
        </p>
        <p className="mudo">
          Último backup: <b>{ub ? new Date(ub).toLocaleString('pt-BR') : 'nunca'}</b>
        </p>
        <div className="form-acoes esquerda">
          <button type="button" className="btn btn-primario" onClick={exportar} disabled={ocupado}>Exportar backup</button>
          <button type="button" className="btn btn-sec" onClick={() => inputArquivo.current?.click()} disabled={ocupado}>
            Importar arquivo
          </button>
          <input
            ref={inputArquivo}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importar(f) }}
          />
        </div>
        {msg && <p className={msg.tipo === 'ok' ? 'ok-texto' : 'erro'} role="status">{msg.texto}</p>}
        <p className="mudo pequeno">As fotos entram no backup quando o módulo de fotos for adicionado.</p>
      </section>

      <section className="cartao">
        <h2>Armazenamento</h2>
        <dl className="dados">
          <dt>Em uso</dt><dd>{mb(arm.usado)}</dd>
          <dt>Limite do navegador</dt><dd>{mb(arm.cota)}</dd>
          <dt>Proteção contra limpeza</dt>
          <dd>{arm.persistente === undefined ? '—' : arm.persistente ? 'Ativa' : 'Não confirmada'}</dd>
        </dl>
        {arm.persistente === false && (
          <p className="mudo pequeno">
            No iPhone, instalar o app na Tela de Início é o que evita que o Safari limpe os dados.
          </p>
        )}
      </section>

      <section className="cartao">
        <h2>Zona de perigo</h2>
        <button type="button" className="btn btn-perigo" onClick={apagar}>Apagar todos os dados</button>
      </section>

      <p className="mudo pequeno centro">Diário de Obra · EliTech · versão 0.1</p>
    </div>
  )
}
