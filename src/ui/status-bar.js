/**
 * Status bar: subscribes to state and keeps the header metadata up to date.
 * Also wires the Undo button.
 */
import state from '../state.js'

const elEmpty = document.getElementById('status-empty')
const elFilename = document.getElementById('status-filename')
const elDivider = document.getElementById('status-divider')
const elDetails = document.getElementById('status-details')
const elModified = document.getElementById('status-modified')
const elUndoBtn = document.getElementById('undo-btn')

function getGeometryBreakdown(geojson) {
  if (!geojson) return null
  const features = geojson.features ?? (Array.isArray(geojson) ? geojson : [geojson])
  const counts = {}
  for (const f of features) {
    const t = f?.geometry?.type
    if (t) counts[t] = (counts[t] ?? 0) + 1
  }
  return counts
}

function render(s) {
  if (!s.geojsonData) {
    elEmpty.style.display = ''
    elFilename.style.display = 'none'
    elDivider.style.display = 'none'
    elDetails.style.display = 'none'
    elModified.style.display = 'none'
    elUndoBtn.classList.remove('visible')
    return
  }

  const features = s.geojsonData.features ?? []
  const featureCount = features.length

  const breakdown = getGeometryBreakdown(s.geojsonData)
  const parts = [`${featureCount.toLocaleString()} features`]
  if (breakdown) {
    for (const [type, count] of Object.entries(breakdown)) {
      parts.push(`${type}: ${count.toLocaleString()}`)
    }
  }

  elEmpty.style.display = 'none'
  elFilename.style.display = ''
  elDivider.style.display = ''
  elDetails.style.display = ''
  elFilename.textContent = s.filename ?? 'untitled.geojson'
  elDetails.textContent = parts.join(' · ')
  elModified.style.display = s.isModified ? '' : 'none'

  if (s.canUndo()) {
    const label = s.getLastActionLabel()
    elUndoBtn.classList.add('visible')
    elUndoBtn.disabled = false
    elUndoBtn.title = `Undo: ${label}`
    elUndoBtn.textContent = `↩ Undo: ${label}`
  } else {
    elUndoBtn.classList.remove('visible')
    elUndoBtn.disabled = true
  }
}

export function initStatusBar() {
  elUndoBtn.addEventListener('click', () => {
    state.undo()
  })
  state.subscribe(render)
  render(state)
}
