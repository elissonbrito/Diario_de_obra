import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CHAVE_LOGO, db } from '../db/db'
import { reduzirLogo } from '../lib/fotos'
import {
  apagarTudo, exportarBackup, exportarBackupCompleto, formatoDoArquivo, importarArquivo, ultimoBackup,
} from '../repo/backup'

interface Armazenamento { usado?: number; cota?: number; persistente?: boolean }

const mb = (n?: number) => (n === undefined ? '—' : `${(n / 1024 / 1024).toFixed(1)} MB`)
const LIMITE_AVISO = 0.7

async function lerArmazenamento(): Promise<Armazenamento> {
  try {
    const est = await navigator.storage?.estimate?.()
    const persistente = await navigator.storage?.persisted?.()
    return { usado: est?.usage, cota: est?.quota, persistente }
  } catch { return {} }
}

export default function Ajustes() {
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [arm, setArm] = useState<Armazenamento>({})
  const [ub, setUb] = useState(ultimoBackup())
  const inputArquivo = useRef<HTMLInputElement>(null)
  const inputLogo = useRef<HTMLInputElement>(null)
  const logo = useLiveQuery(async () => {
    const m = await db.meta.get(CHAVE_LOGO)
    return typeof m?.value === 'string' ? m.value : null
  }, [])
  const nFotos = useLiveQuery(async () => (await db.fotos.toArray()).filter((f) => !f.deletedAt).length, [], 0)

  useEffect(() => {
    void (async () => {
      // Pede de novo a proteção contra limpeza automática (o navegador pode conceder depois de instalado).
      try { await navigator.storage?.persist?.() } catch { /* sem suporte */ }
      setArm(await lerArmazenamento())
    })()
  }, [])

  async function exportar(completo: boolean) {
    setOcupado(completo ? 'Montando o backup completo…' : 'Exportando…'); setMsg(null)
    try {
      if (completo) {
        const { como, fotos } = await exportarBackupCompleto()
        setMsg({ tipo: 'ok', texto: `${como === 'compartilhado' ? 'Backup completo enviado' : 'Backup completo baixado'} (${fotos} fotos).` })
      } else {
        const como = await exportarBackup()
        setMsg({ tipo: 'ok', texto: como === 'compartilhado' ? 'Backup enviado. Guarde o arquivo no Drive ou em Arquivos.' : 'Backup baixado.' })
      }
      setUb(ultimoBackup())
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMsg({ tipo: 'erro', texto: `Falha ao exportar: ${(e as Error).message}` })
    } finally { setOcupado(null) }
  }

  async function importar(arquivo: File) {
    try {
      const bytes = new Uint8Array(await arquivo.arrayBuffer())
      const aviso = formatoDoArquivo(bytes) === 'zip'
        ? 'Importar vai SUBSTITUIR todos os dados e TODAS as fotos atuais pelos do arquivo. Continuar?'
        : 'Importar vai SUBSTITUIR todos os dados atuais pelos do arquivo (as fotos deste aparelho são mantidas). Continuar?'
      if (!window.confirm(aviso)) return
      setOcupado('Importando…'); setMsg(null)
      const { registros, fotos } = await importarArquivo(bytes)
      setMsg({ tipo: 'ok', texto: `Importação concluída (${registros} registros${fotos !== null ? `, ${fotos} fotos` : ''}).` })
      setArm(await lerArmazenamento())
    } catch (e) {
      const texto = (e as Error).name === 'QuotaExceededError'
        ? 'Sem espaço no aparelho para importar este backup. Nada foi alterado.'
        : `${(e as Error).message} Nada foi alterado.`
      setMsg({ tipo: 'erro', texto })
    } finally {
      setOcupado(null)
      if (inputArquivo.current) inputArquivo.current.value = ''
    }
  }

  async function trocarLogo(arquivo: File) {
    try {
      await db.meta.put({ key: CHAVE_LOGO, value: await reduzirLogo(arquivo) })
    } catch (e) {
      setMsg({ tipo: 'erro', texto: (e as Error).message })
    } finally {
      if (inputLogo.current) inputLogo.current.value = ''
    }
  }

  async function removerLogo() {
    if (!window.confirm('Remover o logo do relatório?')) return
    await db.meta.delete(CHAVE_LOGO)
  }

  const pctUso = arm.usado !== undefined && arm.cota ? arm.usado / arm.cota : undefined

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
          <button type="button" className="btn btn-primario" onClick={() => void exportar(true)} disabled={!!ocupado}>
            Backup completo (com fotos)
          </button>
          <button type="button" className="btn btn-sec" onClick={() => void exportar(false)} disabled={!!ocupado}>
            Backup rápido (sem fotos)
          </button>
          <button type="button" className="btn btn-sec" onClick={() => inputArquivo.current?.click()} disabled={!!ocupado}>
            Importar arquivo
          </button>
          <input
            ref={inputArquivo}
            type="file"
            accept="application/json,.json,application/zip,.zip"
            hidden
            data-testid="input-importar"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importar(f) }}
          />
        </div>
        {ocupado && <p className="mudo" role="status">{ocupado}</p>}
        {msg && <p className={msg.tipo === 'ok' ? 'ok-texto' : 'erro'} role="status">{msg.texto}</p>}
        <p className="mudo pequeno">
          O completo é um arquivo .zip com os dados e as {nFotos} fotos. O rápido é um .json pequeno, sem fotos,
          bom para o dia a dia. A importação aceita os dois.
        </p>
      </section>

      <section className="cartao">
        <h2>Logo do relatório</h2>
        {logo ? (
          <img src={logo} alt="Logo atual" className="logo-previa" />
        ) : (
          <p className="mudo">Sem logo: o relatório mostra só o nome da obra.</p>
        )}
        <div className="form-acoes esquerda">
          <button type="button" className="btn btn-sec" onClick={() => inputLogo.current?.click()}>
            {logo ? 'Trocar logo' : 'Escolher imagem'}
          </button>
          {logo && <button type="button" className="btn btn-perigo" onClick={() => void removerLogo()}>Remover</button>}
          <input ref={inputLogo} type="file" accept="image/*" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void trocarLogo(f) }} />
        </div>
      </section>

      <section className="cartao">
        <h2>Armazenamento</h2>
        <dl className="dados">
          <dt>Em uso</dt><dd>{mb(arm.usado)}{pctUso !== undefined && ` (${Math.round(pctUso * 100)}%)`}</dd>
          <dt>Limite do navegador</dt><dd>{mb(arm.cota)}</dd>
          <dt>Proteção contra limpeza</dt>
          <dd>{arm.persistente === undefined ? '—' : arm.persistente ? 'Ativa' : 'Não confirmada'}</dd>
        </dl>
        {pctUso !== undefined && pctUso > LIMITE_AVISO && (
          <div className="aviso aviso-alerta" style={{ marginTop: 10 }}>
            O espaço do app está quase cheio ({Math.round(pctUso * 100)}%). Faça o backup completo e guarde o arquivo
            fora do aparelho antes de tirar mais fotos.
          </div>
        )}
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

      <p className="mudo pequeno centro">Diário de Obra · EliTech · versão 0.3</p>
    </div>
  )
}
