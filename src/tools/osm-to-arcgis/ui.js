/**
 * OSM → ArcGIS field name cleaner UI shell.
 * mount(container, state) / unmount()
 */
import {
  extractPropertyNames,
  isValidArcGISFieldName,
  getInvalidChars,
  makeArcGISSafeName,
  ensureUniqueNames,
  buildUpdatedGeoJSON,
} from './logic.js'
import { downloadGeoJSON, buildFilename } from '../../utils/download.js'

let _container = null
let _state = null

// Local tool state (not shared; applies renaming before calling state.update())
let _propertyNames = []
let _nameMapping = new Map()
let _counterRef = { counter: 1 }

export function mount(container, state) {
  _container = container
  _state = state

  if (!state.geojsonData) {
    container.innerHTML = '<div class="no-data-msg">Load a GeoJSON file to get started.</div>'
    return
  }

  _propertyNames = extractPropertyNames(state.geojsonData)
  _nameMapping = new Map(_propertyNames.map((n) => [n, n]))
  _counterRef = { counter: 1 }

  renderTable()
}

export function unmount() {
  _container = null
  _state = null
}

function renderTable() {
  const rows = _propertyNames.map((original) => {
    const proposed = _nameMapping.get(original) ?? original
    const valid = isValidArcGISFieldName(proposed)
    const invalids = getInvalidChars(proposed)

    return `
      <tr>
        <td>${original}</td>
        <td>
          <input class="form-input arcgis-name-input" data-original="${original}"
            value="${proposed}" style="max-width:240px;"
            class="${valid ? '' : 'border-red'}">
          <span class="badge ${valid ? 'badge-green' : 'badge-red'}" style="margin-left:6px;">
            ${valid ? 'Valid' : 'Invalid'}
          </span>
        </td>
        <td style="font-family:monospace;font-size:12px;color:var(--danger);">
          ${invalids.length ? invalids.join(' ') : '–'}
        </td>
      </tr>`
  }).join('')

  const validCount = _propertyNames.filter((n) => isValidArcGISFieldName(_nameMapping.get(n) ?? n)).length
  const invalidCount = _propertyNames.length - validCount

  _container.innerHTML = `
    <div class="tool-section">
      <h3>ArcGIS-safe names</h3>
      <p class="tool-description">Rename OSM properties to ArcGIS-compatible field names</p>
      <div class="info-msg" style="margin-bottom:12px;">
        <strong>ArcGIS field name rules:</strong> start with a letter · only letters, digits, underscore · max 64 chars
      </div>

      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
        <button class="btn btn-primary" id="arcgis-auto-btn">Auto-rename (ArcGIS-safe)</button>
        <button class="btn" id="arcgis-reset-btn">Reset names</button>
        <button class="btn" id="arcgis-download-btn">Download cleaned GeoJSON</button>
        <span style="font-size:12px;color:${invalidCount === 0 ? 'var(--success)' : 'var(--danger)'};" id="arcgis-validity">
          ${invalidCount === 0
            ? 'All names are ArcGIS-safe.'
            : `${invalidCount} of ${_propertyNames.length} names still invalid.`}
        </span>
      </div>

      <div style="overflow:auto;max-height:60vh;border:1px solid var(--border);border-radius:var(--radius);">
        <table>
          <thead><tr><th>Original name</th><th>New name</th><th>Invalid chars</th></tr></thead>
          <tbody id="arcgis-tbody">${rows}</tbody>
        </table>
      </div>

      <div id="arcgis-error" class="error-msg" style="display:none;margin-top:8px;"></div>
    </div>
  `

  // Wire events
  _container.querySelector('#arcgis-auto-btn').addEventListener('click', handleAutoRename)
  _container.querySelector('#arcgis-reset-btn').addEventListener('click', handleReset)
  _container.querySelector('#arcgis-download-btn').addEventListener('click', handleDownload)
  _container.querySelector('#arcgis-tbody').addEventListener('input', handleInputChange)
}

function handleInputChange(e) {
  const input = e.target.closest('.arcgis-name-input')
  if (!input) return
  const original = input.dataset.original
  _nameMapping.set(original, input.value)
  // Update validity badge inline
  const valid = isValidArcGISFieldName(input.value)
  const badge = input.nextElementSibling
  badge.textContent = valid ? 'Valid' : 'Invalid'
  badge.className = `badge ${valid ? 'badge-green' : 'badge-red'}`
  // Update summary
  updateValiditySummary()
}

function handleAutoRename() {
  _counterRef = { counter: 1 }
  for (const original of _propertyNames) {
    _nameMapping.set(original, makeArcGISSafeName(original, _counterRef))
  }
  ensureUniqueNames(_propertyNames, _nameMapping)
  renderTable()
}

function handleReset() {
  _counterRef = { counter: 1 }
  for (const original of _propertyNames) {
    _nameMapping.set(original, original)
  }
  renderTable()
}

function handleDownload() {
  const errorEl = _container.querySelector('#arcgis-error')
  errorEl.style.display = 'none'

  const invalid = _propertyNames.filter((n) => !isValidArcGISFieldName(_nameMapping.get(n) ?? n))
  if (invalid.length > 0) {
    const proceed = confirm(
      `Some names are still invalid:\n${invalid.map((n) => `${n} → ${_nameMapping.get(n)}`).join('\n')}\n\nDownload anyway?`
    )
    if (!proceed) return
  }

  try {
    const updated = buildUpdatedGeoJSON(_state.geojsonData, _propertyNames, _nameMapping)
    _state.update(updated, 'OSM→ArcGIS names applied')
    downloadGeoJSON(updated, buildFilename(_state.filename, 'arcgis-names'))
  } catch (err) {
    errorEl.textContent = err.message
    errorEl.style.display = ''
  }
}

function updateValiditySummary() {
  const validCount = _propertyNames.filter((n) => isValidArcGISFieldName(_nameMapping.get(n) ?? n)).length
  const invalidCount = _propertyNames.length - validCount
  const el = _container.querySelector('#arcgis-validity')
  if (!el) return
  el.textContent = invalidCount === 0
    ? 'All names are ArcGIS-safe.'
    : `${invalidCount} of ${_propertyNames.length} names still invalid.`
  el.style.color = invalidCount === 0 ? 'var(--success)' : 'var(--danger)'
}
