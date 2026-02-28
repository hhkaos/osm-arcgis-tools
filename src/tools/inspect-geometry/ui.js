/**
 * Geometry Inspector UI shell.
 * mount(container, state) / unmount()
 */
import { parseWizardQuery, parseOverpassQLQuery, buildRows, sortRows, extractSelectedFeatures } from './logic.js'
import { downloadGeoJSON, buildFilename } from '../../utils/download.js'

let _container = null
let _state = null
let _rows = []
let _sortState = { key: 'category', dir: 'asc' }
let _currentMode = 'wizard'

export function mount(container, state) {
  _container = container
  _state = state
  _rows = []
  _sortState = { key: 'category', dir: 'asc' }
  _currentMode = 'wizard'
  renderShell()
}

export function unmount() {
  _container = null
  _state = null
}

function renderShell() {
  const hasData = !!_state.geojsonData
  const featureCount = _state.geojsonData?.features?.length ?? 0

  _container.innerHTML = `
    <div class="tool-section">
      <h3>Tag Inspector</h3>
      <p class="tool-description">Filter and export features by OSM tags or geometry type</p>
      ${!hasData ? '<div class="no-data-msg">Load a GeoJSON file to get started.</div>' : `
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px;">
          ${featureCount.toLocaleString()} features loaded. Define categories to analyse geometry distribution.
        </p>

        <div style="display:flex;gap:0;margin-bottom:12px;border-bottom:1px solid var(--border);">
          <button class="tab-btn ${_currentMode === 'wizard' ? 'active' : ''}" id="ig-tab-wizard" data-mode="wizard">
            Wizard-style query
          </button>
          <button class="tab-btn ${_currentMode === 'overpass' ? 'active' : ''}" id="ig-tab-overpass" data-mode="overpass">
            Overpass QL query
          </button>
        </div>

        <div id="ig-panel-wizard" style="display:${_currentMode === 'wizard' ? 'block' : 'none'};">
          <div class="form-group">
            <label class="form-group label">Wizard-style query (terms joined by "or")</label>
            <textarea id="ig-query-wizard" class="form-textarea" rows="3"
              placeholder="highway or sidewalk or highway=crossing or amenity=parking"></textarea>
          </div>
          <p style="font-size:12px;color:var(--text-muted);">
            Bare term = property exists · <code>key=value</code> = property equals value
          </p>
        </div>

        <div id="ig-panel-overpass" style="display:${_currentMode === 'overpass' ? 'block' : 'none'};">
          <div class="form-group">
            <label>Overpass QL snippet (one line = one category)</label>
            <textarea id="ig-query-overpass" class="form-textarea" rows="8"
              placeholder='node["highway"="street_lamp"]({{bbox}});&#10;node["amenity"="bench"]({{bbox}});'></textarea>
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
          <button class="btn btn-primary" id="ig-analyze-btn">Analyze GeoJSON</button>
          <span id="ig-status" style="font-size:13px;color:var(--text-muted);"></span>
        </div>

        <div id="ig-results" style="display:none;margin-top:16px;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
            <button class="btn" id="ig-select-all">Select all</button>
            <button class="btn" id="ig-select-none">None</button>
            <button class="btn btn-primary" id="ig-export-btn">Download filtered GeoJSON</button>
            <span id="ig-selection-info" style="font-size:13px;color:var(--text-muted);"></span>
          </div>

          <div style="overflow:auto;max-height:55vh;border:1px solid var(--border);border-radius:var(--radius);">
            <table id="ig-table">
              <thead>
                <tr>
                  <th>✔</th>
                  <th data-sort="category" class="sortable" style="cursor:pointer;">Category ⬍</th>
                  <th data-sort="tags" class="sortable" style="cursor:pointer;">Tags ⬍</th>
                  <th data-sort="geom" class="sortable" style="cursor:pointer;">Geometry ⬍</th>
                  <th data-sort="count" class="sortable" style="cursor:pointer;">Count ⬍</th>
                </tr>
              </thead>
              <tbody id="ig-tbody"></tbody>
            </table>
          </div>
        </div>
      `}
    </div>
  `

  if (!hasData) return

  // Tab switching
  _container.querySelector('#ig-tab-wizard')?.addEventListener('click', () => switchTab('wizard'))
  _container.querySelector('#ig-tab-overpass')?.addEventListener('click', () => switchTab('overpass'))

  // Analyze
  _container.querySelector('#ig-analyze-btn')?.addEventListener('click', handleAnalyze)

  // Results buttons
  _container.querySelector('#ig-select-all')?.addEventListener('click', () => {
    _rows.forEach((r) => { if (r.count > 0) r.selected = true })
    renderResultRows()
  })
  _container.querySelector('#ig-select-none')?.addEventListener('click', () => {
    _rows.forEach((r) => { r.selected = false })
    renderResultRows()
  })
  _container.querySelector('#ig-export-btn')?.addEventListener('click', handleExport)

  // Column sort
  _container.querySelector('#ig-table')?.querySelector('thead')?.addEventListener('click', (e) => {
    const th = e.target.closest('[data-sort]')
    if (!th) return
    const key = th.dataset.sort
    if (_sortState.key === key) {
      _sortState.dir = _sortState.dir === 'asc' ? 'desc' : 'asc'
    } else {
      _sortState.key = key
      _sortState.dir = 'asc'
    }
    renderResultRows()
  })
}

function switchTab(mode) {
  _currentMode = mode
  _container.querySelector('#ig-panel-wizard').style.display = mode === 'wizard' ? 'block' : 'none'
  _container.querySelector('#ig-panel-overpass').style.display = mode === 'overpass' ? 'block' : 'none'
  _container.querySelector('#ig-tab-wizard').classList.toggle('active', mode === 'wizard')
  _container.querySelector('#ig-tab-overpass').classList.toggle('active', mode === 'overpass')
}

function getQueryText() {
  const id = _currentMode === 'wizard' ? '#ig-query-wizard' : '#ig-query-overpass'
  return _container.querySelector(id)?.value?.trim() ?? ''
}

function handleAnalyze() {
  const q = getQueryText()
  const statusEl = _container.querySelector('#ig-status')
  const resultsEl = _container.querySelector('#ig-results')

  if (!q) { statusEl.textContent = 'Please enter a query.'; return }
  if (!_state.geojsonData) { statusEl.textContent = 'No GeoJSON loaded.'; return }

  const features = _state.geojsonData.features ?? []

  const categories = _currentMode === 'wizard'
    ? parseWizardQuery(q)
    : parseOverpassQLQuery(q)

  if (!categories.length) {
    statusEl.textContent = 'No categories parsed from query.'
    return
  }

  _rows = buildRows(features, categories)
  statusEl.textContent = `Parsed ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}.`

  if (!_rows.length) {
    statusEl.textContent = 'No rows generated — no features match any category.'
    return
  }

  resultsEl.style.display = 'block'
  renderResultRows()
}

function renderResultRows() {
  sortRows(_rows, _sortState)
  const tbody = _container.querySelector('#ig-tbody')
  tbody.innerHTML = ''

  for (const row of _rows) {
    const tr = document.createElement('tr')
    if (row.count === 0) tr.style.opacity = '0.5'

    const tdCb = document.createElement('td')
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = row.selected
    cb.addEventListener('change', () => {
      row.selected = cb.checked
      updateSelectionInfo()
    })
    tdCb.appendChild(cb)

    const tdCat = document.createElement('td')
    tdCat.textContent = row.categoryLabel
    tdCat.style.fontFamily = 'monospace'

    const tdTags = document.createElement('td')
    const tagsSpan = document.createElement('span')
    tagsSpan.style.fontFamily = 'monospace'
    tagsSpan.style.fontSize = '12px'
    tagsSpan.textContent = row.tagsLabel
    const modePill = document.createElement('span')
    modePill.className = `badge ${row.mode === 'overpass' ? 'badge-yellow' : 'badge-blue'}`
    modePill.textContent = row.mode === 'overpass' ? 'Overpass QL' : 'Wizard'
    modePill.style.marginLeft = '6px'
    tdTags.appendChild(tagsSpan)
    tdTags.appendChild(modePill)

    const tdGeom = document.createElement('td')
    tdGeom.textContent = row.geomType

    const tdCount = document.createElement('td')
    tdCount.textContent = row.count.toLocaleString()

    tr.append(tdCb, tdCat, tdTags, tdGeom, tdCount)
    tbody.appendChild(tr)
  }

  updateSelectionInfo()
}

function updateSelectionInfo() {
  const selected = _rows.filter((r) => r.selected && r.count > 0)
  const infoEl = _container.querySelector('#ig-selection-info')
  if (!infoEl) return

  if (!selected.length) {
    infoEl.textContent = 'No combination selected.'
    return
  }
  const indexSet = new Set()
  selected.forEach((r) => r.indexes.forEach((i) => indexSet.add(i)))
  infoEl.textContent = `${selected.length} combination(s) · ${indexSet.size} matching feature(s)`
}

function handleExport() {
  if (!_state.geojsonData) return
  const features = _state.geojsonData.features ?? []
  const selected = _rows.filter((r) => r.selected && r.count > 0)

  if (!selected.length) {
    if (!confirm('No combinations selected. Export all features?')) return
    downloadGeoJSON(_state.geojsonData, buildFilename(_state.filename, 'tag-inspector'))
    return
  }

  const indexSet = new Set()
  selected.forEach((r) => r.indexes.forEach((i) => indexSet.add(i)))
  const outFeatures = extractSelectedFeatures(features, Array.from(indexSet))
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  downloadGeoJSON({ type: 'FeatureCollection', features: outFeatures }, buildFilename(_state.filename, `tag-inspector_${ts}`))
}
