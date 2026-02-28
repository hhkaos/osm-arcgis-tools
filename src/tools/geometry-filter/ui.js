/**
 * Geometry Filter UI shell.
 * mount(container, state) / unmount()
 */
import { detectGeometryTypes, countByGeometryType, filterByGeometryTypes } from './logic.js'
import { downloadGeoJSON, buildFilename } from '../../utils/download.js'

let _container = null
let _state = null

export function mount(container, state) {
  _container = container
  _state = state

  render()
}

export function unmount() {
  _container = null
  _state = null
}

function render() {
  if (!_state.geojsonData) {
    _container.innerHTML = '<div class="no-data-msg">Load a GeoJSON file to get started.</div>'
    return
  }

  const types = detectGeometryTypes(_state.geojsonData)
  const counts = countByGeometryType(_state.geojsonData)
  const featureCount = _state.geojsonData.features?.length ?? 0
  const mixedWarning = types.length > 1
    ? `<div class="info-msg" style="margin-bottom:12px;">
        ArcGIS Portal's <em>Add Item</em> will fail if the file contains mixed geometry types.
        Use the filter or download buttons below to export a single-type file.
       </div>`
    : ''

  _container.innerHTML = `
    <div class="tool-section">
      <h3>Geometry Filter</h3>
      <p class="tool-description">Remove features by geometry type</p>
      ${mixedWarning}
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px;">
        ${featureCount.toLocaleString()} features total.
        Check the types you want to <strong>keep</strong>, then apply or download.
      </p>
      ${types.length === 0
        ? '<div class="info-msg">No geometry types found.</div>'
        : `<div id="gf-checkboxes" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
            ${types.map((t) => `
              <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                <input type="checkbox" class="gf-type-cb" value="${t}" checked>
                <span class="badge badge-blue">${t}</span>
                <span style="font-size:12px;color:var(--text-muted);">${(counts.get(t) ?? 0).toLocaleString()}</span>
              </label>
            `).join('')}
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button class="btn btn-danger" id="gf-apply-btn">Remove unchecked types</button>
            <button class="btn btn-primary" id="gf-download-checked-btn">Download checked types only</button>
            <button class="btn" id="gf-download-btn">Download current GeoJSON</button>
            <span id="gf-status" style="color:var(--text-muted);font-size:13px;"></span>
          </div>`
      }
    </div>
  `

  if (types.length === 0) return

  _container.querySelector('#gf-apply-btn').addEventListener('click', handleApply)
  _container.querySelector('#gf-download-checked-btn').addEventListener('click', handleDownloadChecked)
  _container.querySelector('#gf-download-btn').addEventListener('click', handleDownload)
}

function getCheckedTypes() {
  return Array.from(_container.querySelectorAll('.gf-type-cb:checked')).map((cb) => cb.value)
}

function getUncheckedTypes() {
  return Array.from(_container.querySelectorAll('.gf-type-cb:not(:checked)')).map((cb) => cb.value)
}

function handleApply() {
  const toRemove = getUncheckedTypes()
  if (toRemove.length === 0) {
    _container.querySelector('#gf-status').textContent = 'All types are checked — nothing to remove.'
    return
  }

  const newGeoJSON = filterByGeometryTypes(_state.geojsonData, toRemove)
  const removedCount = (_state.geojsonData.features?.length ?? 0) - newGeoJSON.features.length
  _state.update(newGeoJSON, `Geometry Filter: kept ${getCheckedTypes().join(', ')}`)
  render()
  _container.querySelector('#gf-status').textContent = `Removed ${removedCount.toLocaleString()} feature(s).`
}

function handleDownloadChecked() {
  const toKeep = getCheckedTypes()
  if (toKeep.length === 0) {
    _container.querySelector('#gf-status').textContent = 'No types checked.'
    return
  }
  const allTypes = detectGeometryTypes(_state.geojsonData)
  const toRemove = allTypes.filter((t) => !toKeep.includes(t))
  const result = filterByGeometryTypes(_state.geojsonData, toRemove)
  downloadGeoJSON(result, buildFilename(_state.filename, `geometry-filter_${toKeep.join('-')}`))
}

function handleDownload() {
  if (!_state.geojsonData) return
  downloadGeoJSON(_state.geojsonData, buildFilename(_state.filename, 'geometry-filter'))
}
