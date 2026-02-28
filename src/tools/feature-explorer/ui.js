/**
 * Feature Explorer UI shell.
 * mount(container, state) / unmount()
 */
import {
  extractFeatures,
  computePropertyStats,
  filterActiveFeatures,
  trimFeatureProperties,
  buildFilteredFilename,
  getValueKey,
} from './logic.js'
import { downloadGeoJSON } from '../../utils/download.js'

let _container = null
let _state = null
let _allFeatures = []
let _allPropertyStats = null
let _sortMode = 'name'
let _minValuesFilter = 0
let _filterProperty = null
let _filterValueKey = null
let _selectedProperties = new Set()

export function mount(container, state) {
  _container = container
  _state = state

  if (!state.geojsonData) {
    container.innerHTML = '<div class="no-data-msg">Load a GeoJSON file to get started.</div>'
    return
  }

  try {
    _allFeatures = extractFeatures(state.geojsonData)
  } catch (err) {
    container.innerHTML = `<div class="error-msg">${err.message}</div>`
    return
  }

  _allPropertyStats = computePropertyStats(_allFeatures)
  _selectedProperties = new Set(_allPropertyStats.keys())
  _sortMode = 'countDesc'
  _minValuesFilter = 0
  _filterProperty = null
  _filterValueKey = null

  renderShell()
  renderPropertyCards()
}

export function unmount() {
  _container = null
  _state = null
}

function renderShell() {
  const propertyCount = _allPropertyStats.size

  _container.innerHTML = `
    <div class="tool-section">
      <h3>Property Explorer</h3>
      <p class="tool-description">Browse property statistics, filter by value, keep or drop columns</p>
      <div id="fe-summary" style="font-size:13px;color:var(--text-muted);margin-bottom:12px;"></div>

      <!-- Controls row -->
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:flex-end;">
        <div>
          <label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px;">Sort by</label>
          <select class="form-select" id="fe-sort-mode" style="width:auto;">
            <option value="name">Name (A→Z)</option>
            <option value="countDesc" selected>Features with value (↓)</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px;">Min features with value</label>
          <input type="number" class="form-input" id="fe-min-values" value="0" min="0" style="width:80px;">
        </div>
        <button class="btn" id="fe-reset-btn">Reset</button>
      </div>

      <!-- Property selection -->
      <div class="tool-section" style="padding:10px 12px;">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:13px;color:var(--text-muted);">${propertyCount} properties · selection applied in memory</span>
          <button class="btn" id="fe-select-all">All</button>
          <button class="btn" id="fe-select-none">None</button>
          <button class="btn btn-primary" id="fe-keep-btn" ${_selectedProperties.size ? '' : 'disabled'}>Keep selected properties</button>
        </div>
      </div>

      <!-- Subset filter -->
      <div class="tool-section" style="padding:10px 12px;">
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
          <div>
            <label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px;">Property</label>
            <select class="form-select" id="fe-filter-prop" style="width:auto;">
              <option value="">Select property…</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px;">Value</label>
            <select class="form-select" id="fe-filter-val" style="width:auto;" disabled>
              <option value="">Select property first</option>
            </select>
          </div>
          <button class="btn btn-primary" id="fe-download-btn">Download matching features</button>
        </div>
        <div id="fe-filter-info" style="font-size:12px;color:var(--text-muted);margin-top:6px;"></div>
      </div>

      <div id="fe-cards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-top:8px;"></div>
    </div>
  `

  populatePropertyFilterSelect()

  _container.querySelector('#fe-sort-mode').value = _sortMode
  _container.querySelector('#fe-sort-mode').addEventListener('change', (e) => {
    _sortMode = e.target.value
    renderPropertyCards()
  })
  _container.querySelector('#fe-min-values').addEventListener('change', (e) => {
    const v = parseInt(e.target.value, 10)
    _minValuesFilter = isNaN(v) ? 0 : Math.max(0, v)
    renderPropertyCards()
  })
  _container.querySelector('#fe-reset-btn').addEventListener('click', () => {
    _sortMode = 'countDesc'
    _minValuesFilter = 0
    _filterProperty = null
    _filterValueKey = null
    _container.querySelector('#fe-sort-mode').value = 'countDesc'
    _container.querySelector('#fe-min-values').value = '0'
    populatePropertyFilterSelect()
    renderPropertyCards()
  })
  _container.querySelector('#fe-select-all').addEventListener('click', () => {
    _selectedProperties = new Set(_allPropertyStats.keys())
    renderPropertyCards()
  })
  _container.querySelector('#fe-select-none').addEventListener('click', () => {
    _selectedProperties = new Set()
    renderPropertyCards()
  })
  _container.querySelector('#fe-keep-btn').addEventListener('click', handleKeepProperties)
  _container.querySelector('#fe-filter-prop').addEventListener('change', handlePropertyFilterChange)
  _container.querySelector('#fe-filter-val').addEventListener('change', handleValueFilterChange)
  _container.querySelector('#fe-download-btn').addEventListener('click', handleDownload)
}

function populatePropertyFilterSelect() {
  const sel = _container?.querySelector('#fe-filter-prop')
  if (!sel) return
  sel.innerHTML = '<option value="">Select property…</option>'

  const names = Array.from(_allPropertyStats.keys()).sort((a, b) => a.localeCompare(b))
  for (const name of names) {
    const stats = _allPropertyStats.get(name)
    if (!stats?.valueCounts?.size) continue
    const opt = document.createElement('option')
    opt.value = name
    opt.textContent = `${name} (${stats.valueCounts.size} values)`
    sel.appendChild(opt)
  }
}

function handlePropertyFilterChange() {
  const propName = _container.querySelector('#fe-filter-prop').value
  _filterProperty = null
  _filterValueKey = null

  const valSel = _container.querySelector('#fe-filter-val')
  valSel.innerHTML = ''
  valSel.disabled = true

  if (!propName || !_allPropertyStats.has(propName)) {
    renderPropertyCards()
    return
  }

  const stats = _allPropertyStats.get(propName)
  const entries = Array.from(stats.valueCounts.entries()).sort((a, b) => b[1] - a[1])

  valSel.innerHTML = '<option value="">Select value</option>'
  for (const [valueKey, cnt] of entries) {
    const opt = document.createElement('option')
    opt.value = valueKey
    opt.textContent = `${valueKey} (${cnt})`
    valSel.appendChild(opt)
  }
  valSel.disabled = false
  renderPropertyCards()
}

function handleValueFilterChange() {
  const propName = _container.querySelector('#fe-filter-prop').value
  const valueKey = _container.querySelector('#fe-filter-val').value
  const infoEl = _container.querySelector('#fe-filter-info')

  if (!propName || !valueKey) {
    _filterProperty = null
    _filterValueKey = null
    infoEl.textContent = ''
    renderPropertyCards()
    return
  }

  _filterProperty = propName
  _filterValueKey = valueKey

  const stats = _allPropertyStats.get(propName)
  const count = stats?.valueCounts.get(valueKey) ?? 0
  infoEl.textContent = `Selected value appears in ${count} feature(s).`
  renderPropertyCards()
}

function handleKeepProperties() {
  _allFeatures = _allFeatures.map((f) => trimFeatureProperties(f, _selectedProperties))
  _allPropertyStats = computePropertyStats(_allFeatures)
  _selectedProperties = new Set(_allPropertyStats.keys())
  _filterProperty = null
  _filterValueKey = null
  populatePropertyFilterSelect()
  renderPropertyCards()
}

function handleDownload() {
  const activeFeatures = filterActiveFeatures(_allFeatures, _filterProperty, _filterValueKey)
  if (!activeFeatures.length) {
    _container.querySelector('#fe-filter-info').textContent = 'No features match the current filter.'
    return
  }
  const fc = { type: 'FeatureCollection', features: activeFeatures }
  downloadGeoJSON(fc, buildFilteredFilename(_filterProperty, _filterValueKey, _state.filename))
}

function renderPropertyCards() {
  const activeFeatures = filterActiveFeatures(_allFeatures, _filterProperty, _filterValueKey)
  const activeCount = activeFeatures.length
  const propertyStats = computePropertyStats(activeFeatures)

  // Sort
  let names = Array.from(propertyStats.keys())
  if (_sortMode === 'countDesc') {
    names.sort((a, b) => (propertyStats.get(b).countWithValue - propertyStats.get(a).countWithValue) || a.localeCompare(b))
  } else {
    names.sort((a, b) => a.localeCompare(b))
  }

  // Filter
  names = names.filter((n) => propertyStats.get(n).countWithValue >= _minValuesFilter)

  const summaryEl = _container.querySelector('#fe-summary')
  if (summaryEl) {
    const totalCount = _allFeatures.length
    let summary = `Features: ${activeCount.toLocaleString()}`
    if (activeCount !== totalCount) summary += ` of ${totalCount.toLocaleString()}`
    summary += ` · Properties: ${_allPropertyStats.size}`
    if (_minValuesFilter > 0) summary += ` · Showing: ${names.length}`
    if (_filterProperty && _filterValueKey) summary += ` · Filter: ${_filterProperty} = ${_filterValueKey}`
    summaryEl.textContent = summary
  }

  const cardsEl = _container.querySelector('#fe-cards')
  if (!cardsEl) return
  cardsEl.innerHTML = ''

  for (const name of names) {
    const stats = propertyStats.get(name)
    cardsEl.appendChild(buildPropertyCard(name, stats, activeCount))
  }
}

function buildPropertyCard(name, stats, totalFeatures) {
  const uniqueValues = Array.from(stats.valueCounts.entries()).sort((a, b) => b[1] - a[1])
  const missing = totalFeatures - stats.countWithValue

  const card = document.createElement('div')
  card.className = 'tool-section'
  card.style.cssText = 'margin-bottom:0;display:flex;flex-direction:column;gap:8px;'

  const header = document.createElement('div')
  header.style.cssText = 'display:flex;align-items:center;gap:8px;'
  const cb = document.createElement('input')
  cb.type = 'checkbox'
  cb.checked = _selectedProperties.has(name)
  cb.addEventListener('change', () => {
    if (cb.checked) _selectedProperties.add(name)
    else _selectedProperties.delete(name)
  })
  const nameEl = document.createElement('span')
  nameEl.style.fontWeight = '600'
  nameEl.textContent = name
  const countEl = document.createElement('span')
  countEl.style.cssText = 'margin-left:auto;font-size:12px;color:var(--text-muted);'
  countEl.textContent = `${stats.countWithValue} with value`
  header.append(cb, nameEl, countEl)

  const statsEl = document.createElement('div')
  statsEl.style.cssText = 'font-size:12px;color:var(--text-muted);'
  statsEl.innerHTML = `Missing: ${missing} · Types: ${Array.from(stats.typeCounts.keys()).join(', ')}`

  const copyBtn = document.createElement('button')
  copyBtn.className = 'btn'
  copyBtn.style.fontSize = '12px'
  copyBtn.textContent = 'Copy values'
  copyBtn.disabled = uniqueValues.length === 0
  copyBtn.addEventListener('click', () => {
    const text = uniqueValues.map(([v]) => String(v)).join('\n')
    navigator.clipboard?.writeText(text).then(() => {
      copyBtn.textContent = 'Copied!'
      setTimeout(() => { copyBtn.textContent = 'Copy values' }, 1200)
    }).catch(() => window.prompt('Copy values:', text))
  })

  const details = document.createElement('details')
  details.open = uniqueValues.length <= 50
  const summary = document.createElement('summary')
  summary.innerHTML = `<span style="font-size:12px;font-weight:500;">Values</span>
    <span style="font-size:11px;color:var(--text-muted);margin-left:auto;">${uniqueValues.length} unique</span>`
  summary.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;list-style:none;'
  details.appendChild(summary)

  if (uniqueValues.length) {
    const tbl = document.createElement('table')
    tbl.style.marginTop = '6px'
    tbl.innerHTML = `<thead><tr><th>Value</th><th>Count</th></tr></thead>`
    const tbody = document.createElement('tbody')
    for (const [val, cnt] of uniqueValues.slice(0, 200)) {
      const tr = document.createElement('tr')
      tr.innerHTML = `<td style="word-break:break-all">${String(val)}</td><td>${cnt}</td>`
      tbody.appendChild(tr)
    }
    tbl.appendChild(tbody)
    details.appendChild(tbl)
  }

  card.append(header, statsEl, copyBtn, details)
  return card
}
