/**
 * App entry point.
 * - Global file loading (click + drag-and-drop)
 * - Wires status bar, tab bar
 */
import state from './state.js'
import { initStatusBar } from './ui/status-bar.js'
import { initTabBar, remountActive } from './ui/tab-bar.js'

const fileInput = document.getElementById('global-file-input')
const uploadTrigger = document.getElementById('upload-trigger')
const dropOverlay = document.getElementById('drop-overlay')

// ── File loading ─────────────────────────────────────────────────

function loadFile(file) {
  if (!file) return
  if (!file.name.match(/\.(geojson|json)$/i)) {
    alert('Please load a .geojson or .json file.')
    return
  }
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result)
      // Mark as a load event so tab-bar knows to remount
      state._loadEvent = true
      state.load(parsed, file.name)
      state._loadEvent = false
      // Remount the active tool with the new data
      remountActive()
    } catch {
      alert('Failed to parse GeoJSON file. Make sure it is valid JSON.')
    }
  }
  reader.readAsText(file)
}

// Click to upload
uploadTrigger.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', (e) => {
  loadFile(e.target.files[0])
  fileInput.value = ''
})

// ── Drag-and-drop ─────────────────────────────────────────────────

let dragCounter = 0

document.addEventListener('dragenter', (e) => {
  if (e.dataTransfer?.types?.includes('Files')) {
    dragCounter++
    dropOverlay.classList.add('active')
  }
})

document.addEventListener('dragleave', () => {
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    dropOverlay.classList.remove('active')
  }
})

document.addEventListener('dragover', (e) => e.preventDefault())

document.addEventListener('drop', (e) => {
  e.preventDefault()
  dragCounter = 0
  dropOverlay.classList.remove('active')
  const file = e.dataTransfer?.files?.[0]
  if (file) loadFile(file)
})

// ── Init ──────────────────────────────────────────────────────────

initStatusBar()
initTabBar()
