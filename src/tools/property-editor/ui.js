/**
 * Property Editor UI shell.
 * mount(container, state) / unmount()
 */
import {
  getAllPropertyNames,
  getTotalPages,
  deletePropertyFromAll,
  deletePropertiesFromAll,
  addPropertyToAll,
  renamePropertyOnAll,
  applyBulkEditToAll,
  deleteFeatureAtIndex,
  coerceValueToType,
  prepareDownloadData,
  computePropertyTypeStats,
} from './logic.js'
import { downloadGeoJSON, buildFilename } from '../../utils/download.js'

const PAGE_SIZE = 20
const TYPES = ['Ignore', 'String', 'Number', 'Boolean', 'Null', 'Array', 'Object']

let _container = null
let _state = null
let _propertyNames = []
let _currentPage = 0
let _typeSelections = {}   // propName → type string

export function mount(container, state) {
  _container = container
  _state = state

  if (!state.geojsonData) {
    container.innerHTML = '<div class="no-data-msg">Load a GeoJSON file to get started.</div>'
    return
  }

  _propertyNames = getAllPropertyNames(state.geojsonData)
  _currentPage = 0
  _typeSelections = {}
  for (const p of _propertyNames) _typeSelections[p] = 'Ignore'

  renderShell()
}

export function unmount() {
  _container = null
  _state = null
}

function renderShell() {
  const fc = _state.geojsonData
  const featureCount = fc?.features?.length ?? 0
  const totalPages = getTotalPages(featureCount, PAGE_SIZE)

  _container.innerHTML = `
    <div class="tool-section">
      <h3>Property Editor</h3>
      <p class="tool-description">Edit, add, rename and delete feature properties</p>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">
        ${featureCount.toLocaleString()} features · ${_propertyNames.length} properties
      </div>

      <!-- Add property -->
      <div class="tool-section" style="padding:10px 12px;margin-bottom:12px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Add property</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
          <div>
            <label style="font-size:12px;display:block;margin-bottom:4px;">Name</label>
            <input type="text" class="form-input" id="pe-new-name" placeholder="property_name" style="width:160px;">
          </div>
          <div>
            <label style="font-size:12px;display:block;margin-bottom:4px;">Default value</label>
            <input type="text" class="form-input" id="pe-new-value" placeholder="" style="width:120px;">
          </div>
          <button class="btn btn-primary" id="pe-add-btn">Add to all</button>
        </div>
      </div>

      <!-- Property header management -->
      <div class="tool-section" style="padding:10px 12px;margin-bottom:12px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Properties</div>
        <div id="pe-property-list" style="display:flex;flex-direction:column;gap:6px;"></div>
      </div>

      <!-- Plain download -->
      <div style="margin-bottom:12px;">
        <button class="btn btn-primary" id="pe-download-btn">Download GeoJSON</button>
      </div>

      <!-- Type coercion + download -->
      <div class="tool-section" style="padding:10px 12px;margin-bottom:12px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Download with type coercion</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">
          Optionally set property types before downloading. "Ignore" leaves values unchanged. Empty strings are removed after coercion.
        </div>
        <div id="pe-type-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;"></div>
        <button class="btn" id="pe-download-coerce-btn">Download with coercions</button>
      </div>

      <!-- Feature table -->
      <div class="tool-section" style="padding:10px 12px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Features (paginated)</div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <button class="btn" id="pe-prev-btn" ${_currentPage === 0 ? 'disabled' : ''}>← Prev</button>
          <span id="pe-page-label" style="font-size:13px;">Page ${_currentPage + 1} of ${Math.max(1, totalPages)}</span>
          <button class="btn" id="pe-next-btn" ${_currentPage >= totalPages - 1 ? 'disabled' : ''}>Next →</button>
        </div>
        <div id="pe-table-wrap" style="overflow-x:auto;"></div>
      </div>
    </div>
  `

  renderPropertyList()
  renderTypeList()
  renderFeatureTable()

  _container.querySelector('#pe-add-btn').addEventListener('click', handleAddProperty)
  _container.querySelector('#pe-prev-btn').addEventListener('click', () => { _currentPage--; renderPagedTable() })
  _container.querySelector('#pe-next-btn').addEventListener('click', () => { _currentPage++; renderPagedTable() })
  _container.querySelector('#pe-download-btn').addEventListener('click', handleDownload)
  _container.querySelector('#pe-download-coerce-btn').addEventListener('click', handleDownloadWithCoercions)
}

function renderPropertyList() {
  const listEl = _container?.querySelector('#pe-property-list')
  if (!listEl) return
  listEl.innerHTML = ''

  if (_propertyNames.length === 0) {
    listEl.innerHTML = '<div style="font-size:13px;color:var(--text-muted);">No properties.</div>'
    return
  }

  for (const name of _propertyNames) {
    const row = document.createElement('div')
    row.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;'

    const nameSpan = document.createElement('span')
    nameSpan.style.cssText = 'font-size:13px;font-weight:500;min-width:120px;'
    nameSpan.textContent = name

    const renameInput = document.createElement('input')
    renameInput.type = 'text'
    renameInput.className = 'form-input'
    renameInput.value = name
    renameInput.style.width = '140px'
    renameInput.title = 'New name'

    const renameBtn = document.createElement('button')
    renameBtn.className = 'btn'
    renameBtn.textContent = 'Rename'
    renameBtn.addEventListener('click', () => {
      const newName = renameInput.value.trim()
      if (!newName || newName === name) return
      _state.update(renamePropertyOnAll(_state.geojsonData, name, newName), `Rename "${name}" → "${newName}"`)
      refresh()
    })

    const bulkInput = document.createElement('input')
    bulkInput.type = 'text'
    bulkInput.className = 'form-input'
    bulkInput.placeholder = 'Bulk value'
    bulkInput.style.width = '110px'

    const bulkBtn = document.createElement('button')
    bulkBtn.className = 'btn'
    bulkBtn.textContent = 'Set all'
    bulkBtn.addEventListener('click', () => {
      _state.update(applyBulkEditToAll(_state.geojsonData, name, bulkInput.value), `Bulk set "${name}"`)
      refresh()
    })

    const delBtn = document.createElement('button')
    delBtn.className = 'btn btn-danger'
    delBtn.textContent = 'Delete'
    delBtn.addEventListener('click', () => {
      if (!confirm(`Delete property "${name}" from all features?`)) return
      _state.update(deletePropertyFromAll(_state.geojsonData, name), `Delete "${name}"`)
      refresh()
    })

    // Type stats badge
    const stats = computePropertyTypeStats(_state.geojsonData, name)
    const typeStr = Object.entries(stats)
      .filter(([, c]) => c > 0)
      .map(([t, c]) => `${t}:${c}`)
      .join(' ')
    const statsBadge = document.createElement('span')
    statsBadge.style.cssText = 'font-size:11px;color:var(--text-muted);'
    statsBadge.textContent = typeStr

    row.append(nameSpan, renameInput, renameBtn, bulkInput, bulkBtn, delBtn, statsBadge)
    listEl.appendChild(row)
  }
}

function renderTypeList() {
  const listEl = _container?.querySelector('#pe-type-list')
  if (!listEl) return
  listEl.innerHTML = ''

  for (const name of _propertyNames) {
    const row = document.createElement('div')
    row.style.cssText = 'display:flex;gap:8px;align-items:center;'

    const label = document.createElement('span')
    label.style.cssText = 'font-size:13px;min-width:160px;'
    label.textContent = name

    const sel = document.createElement('select')
    sel.className = 'form-select'
    sel.innerHTML = TYPES.map((t) =>
      `<option value="${t}" ${_typeSelections[name] === t ? 'selected' : ''}>${t}</option>`
    ).join('')
    sel.addEventListener('change', () => { _typeSelections[name] = sel.value })

    row.append(label, sel)
    listEl.appendChild(row)
  }
}

function renderFeatureTable() {
  const fc = _state.geojsonData
  const features = fc?.features ?? []
  const totalPages = getTotalPages(features.length, PAGE_SIZE)
  if (_currentPage >= totalPages && totalPages > 0) _currentPage = totalPages - 1
  if (_currentPage < 0) _currentPage = 0

  const wrap = _container?.querySelector('#pe-table-wrap')
  if (!wrap) return

  if (features.length === 0) {
    wrap.innerHTML = '<div style="font-size:13px;color:var(--text-muted);">No features.</div>'
    return
  }

  const start = _currentPage * PAGE_SIZE
  const slice = features.slice(start, start + PAGE_SIZE)

  const tbl = document.createElement('table')
  tbl.innerHTML = `<thead><tr>
    <th style="white-space:nowrap;">#</th>
    ${_propertyNames.map((p) => `<th style="white-space:nowrap;">${escHtml(p)}</th>`).join('')}
    <th></th>
  </tr></thead>`

  const tbody = document.createElement('tbody')
  for (let i = 0; i < slice.length; i++) {
    const globalIdx = start + i
    const feature = slice[i]
    const props = feature.properties ?? {}
    const tr = document.createElement('tr')
    tr.dataset.idx = globalIdx

    const idxTd = document.createElement('td')
    idxTd.textContent = globalIdx + 1
    idxTd.style.color = 'var(--text-muted)'
    idxTd.style.fontSize = '12px'
    tr.appendChild(idxTd)

    for (const name of _propertyNames) {
      const td = document.createElement('td')
      const val = props[name]
      const input = document.createElement('input')
      input.type = 'text'
      input.className = 'form-input'
      input.style.cssText = 'width:100%;min-width:80px;'
      input.value = val === undefined || val === null ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val))
      input.addEventListener('change', () => {
        const updated = JSON.parse(JSON.stringify(_state.geojsonData))
        if (!updated.features[globalIdx].properties) updated.features[globalIdx].properties = {}
        updated.features[globalIdx].properties[name] = input.value
        _state.update(updated, `Edit feature ${globalIdx + 1} · ${name}`)
      })
      td.appendChild(input)
      tr.appendChild(td)
    }

    const delTd = document.createElement('td')
    const delBtn = document.createElement('button')
    delBtn.className = 'btn btn-danger'
    delBtn.style.fontSize = '11px'
    delBtn.textContent = '✕'
    delBtn.title = 'Delete feature'
    delBtn.addEventListener('click', () => {
      if (!confirm(`Delete feature ${globalIdx + 1}?`)) return
      _state.update(deleteFeatureAtIndex(_state.geojsonData, globalIdx), `Delete feature ${globalIdx + 1}`)
      refresh()
    })
    delTd.appendChild(delBtn)
    tr.appendChild(delTd)

    tbody.appendChild(tr)
  }
  tbl.appendChild(tbody)
  wrap.innerHTML = ''
  wrap.appendChild(tbl)
}

function renderPagedTable() {
  const fc = _state.geojsonData
  const features = fc?.features ?? []
  const totalPages = getTotalPages(features.length, PAGE_SIZE)

  renderFeatureTable()

  const prevBtn = _container?.querySelector('#pe-prev-btn')
  const nextBtn = _container?.querySelector('#pe-next-btn')
  const pageLabel = _container?.querySelector('#pe-page-label')
  if (prevBtn) prevBtn.disabled = _currentPage === 0
  if (nextBtn) nextBtn.disabled = _currentPage >= totalPages - 1
  if (pageLabel) pageLabel.textContent = `Page ${_currentPage + 1} of ${Math.max(1, totalPages)}`
}

function handleAddProperty() {
  const nameInput = _container?.querySelector('#pe-new-name')
  const valueInput = _container?.querySelector('#pe-new-value')
  const name = nameInput?.value.trim()
  if (!name) { nameInput?.focus(); return }
  const value = valueInput?.value ?? ''
  _state.update(addPropertyToAll(_state.geojsonData, name, value), `Add property "${name}"`)
  if (nameInput) nameInput.value = ''
  if (valueInput) valueInput.value = ''
  refresh()
}

function handleDownload() {
  downloadGeoJSON(_state.geojsonData, buildFilename(_state.filename, 'property-editor'))
}

function handleDownloadWithCoercions() {
  const result = prepareDownloadData(_state.geojsonData, _typeSelections)
  downloadGeoJSON(result, buildFilename(_state.filename, 'property-editor'))
}

/**
 * Full re-render after a structural change (add/rename/delete property or feature).
 */
function refresh() {
  _propertyNames = getAllPropertyNames(_state.geojsonData)
  // Preserve existing type selections where possible
  const newSelections = {}
  for (const p of _propertyNames) {
    newSelections[p] = _typeSelections[p] ?? 'Ignore'
  }
  _typeSelections = newSelections
  renderPropertyList()
  renderTypeList()
  renderPagedTable()

  // Update summary
  const fc = _state.geojsonData
  const summaryEl = _container?.querySelector('div[style*="font-size:13px;color:var(--text-muted)"]')
  if (summaryEl) {
    summaryEl.textContent = `${(fc?.features?.length ?? 0).toLocaleString()} features · ${_propertyNames.length} properties`
  }
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
