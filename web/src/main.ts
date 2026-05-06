import './style.css'
import { downgradeLitematicToV6 } from './conversion/downgrade'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('App container not found')
}

app.innerHTML = `
  <main class="container">
    <header>
      <h1>Litematica Downgrade Tool</h1>
      <p>Convert Litematica v7 schematics (1.21.x data) to v6 / 1.20.4 format in your browser.</p>
    </header>

    <form id="downgrade-form" class="card">
      <label class="field">
        <span>Input .litematic</span>
        <input id="file-input" type="file" accept=".litematic" required />
      </label>

      <label class="field">
        <span>Target version</span>
        <select id="target-version">
          <option value="v6-1.20.4">Litematica v6 (Minecraft 1.20.4)</option>
        </select>
      </label>

      <button id="convert-button" type="submit">Downgrade schematic</button>
    </form>

    <section id="status" class="status" aria-live="polite"></section>

    <section id="summary" class="card hidden">
      <h2>Conversion summary</h2>
      <dl>
        <div><dt>Regions</dt><dd id="summary-regions">-</dd></div>
        <div><dt>Block entities</dt><dd id="summary-block-entities">-</dd></div>
        <div><dt>Entities</dt><dd id="summary-entities">-</dd></div>
        <div><dt>Source data version</dt><dd id="summary-data-version">-</dd></div>
      </dl>
    </section>

    <a id="download-link" class="button hidden" download>Download downgraded schematic</a>
  </main>
`

const form = document.querySelector<HTMLFormElement>('#downgrade-form')!
const fileInput = document.querySelector<HTMLInputElement>('#file-input')!
const convertButton = document.querySelector<HTMLButtonElement>('#convert-button')!
const status = document.querySelector<HTMLDivElement>('#status')!
const summary = document.querySelector<HTMLDivElement>('#summary')!
const summaryRegions = document.querySelector<HTMLSpanElement>('#summary-regions')!
const summaryBlockEntities = document.querySelector<HTMLSpanElement>('#summary-block-entities')!
const summaryEntities = document.querySelector<HTMLSpanElement>('#summary-entities')!
const summaryDataVersion = document.querySelector<HTMLSpanElement>('#summary-data-version')!
const downloadLink = document.querySelector<HTMLAnchorElement>('#download-link')!

let downloadUrl: string | null = null

function setStatus(message: string, tone: 'info' | 'error' = 'info'): void {
  status.textContent = message
  status.classList.toggle('error', tone === 'error')
}

function resetOutput(): void {
  summary.classList.add('hidden')
  downloadLink.classList.add('hidden')
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl)
  }
  downloadUrl = null
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  resetOutput()

  const file = fileInput.files?.[0]
  if (!file) {
    setStatus('Please choose a .litematic file to downgrade.', 'error')
    return
  }

  convertButton.disabled = true
  setStatus('Reading file…')

  try {
    const buffer = await file.arrayBuffer()
    setStatus('Downgrading schematic…')

    const result = await downgradeLitematicToV6(new Uint8Array(buffer))
    const outputName = file.name.replace(/\.litematic$/i, '') + '-v6.litematic'

    const outputBytes = Uint8Array.from(result.output)
    downloadUrl = URL.createObjectURL(new Blob([outputBytes], { type: 'application/octet-stream' }))
    downloadLink.href = downloadUrl
    downloadLink.download = outputName
    downloadLink.classList.remove('hidden')

    summaryRegions.textContent = String(result.summary.regions)
    summaryBlockEntities.textContent = String(result.summary.blockEntities)
    summaryEntities.textContent = String(result.summary.entities)
    summaryDataVersion.textContent = String(result.summary.minecraftDataVersion)
    summary.classList.remove('hidden')

    setStatus('Downgrade complete. Download the v6 schematic below.')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error during downgrade.'
    setStatus(message, 'error')
  } finally {
    convertButton.disabled = false
  }
})
