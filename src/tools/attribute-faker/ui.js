/**
 * Attribute Faker UI shell.
 * mount(container, state) / unmount()
 */
import {
  FAKER_MODULES,
  extractAttributeNames,
  buildDefaultConfig,
  applyFakerChanges,
} from './logic.js'
import { downloadGeoJSON, buildFilename } from '../../utils/download.js'

let _container = null
let _state = null
let _attributes = []
let _configs = {}   // attrName → config object

export function mount(container, state) {
  _container = container
  _state = state

  if (!state.geojsonData) {
    container.innerHTML = '<div class="no-data-msg">Load a GeoJSON file to get started.</div>'
    return
  }

  _attributes = extractAttributeNames(state.geojsonData)
  _configs = {}
  for (const attr of _attributes) {
    _configs[attr] = buildDefaultConfig()
  }

  renderShell()
  renderAttributeCards()
}

export function unmount() {
  _container = null
  _state = null
}

function renderShell() {
  const featureCount = _state.geojsonData?.features?.length ?? 0
  _container.innerHTML = `
    <div class="tool-section">
      <h3>Property Faker</h3>
      <p class="tool-description">Fill or randomise property values with fake data</p>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">
        ${featureCount.toLocaleString()} features · ${_attributes.length} attributes
      </div>

      <div id="af-status" style="font-size:12px;color:var(--text-muted);margin-bottom:8px;"></div>

      <div id="af-cards" style="display:flex;flex-direction:column;gap:12px;"></div>

      ${_attributes.length === 0 ? '<div class="info-msg">No attributes found in this GeoJSON.</div>' : ''}

      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">
        <button class="btn btn-primary" id="af-apply-btn" ${_attributes.length ? '' : 'disabled'}>
          Apply to all features
        </button>
        <button class="btn" id="af-download-btn" ${_attributes.length ? '' : 'disabled'}>
          Download result
        </button>
        <button class="btn" id="af-reset-btn">Reset configs</button>
      </div>
    </div>
  `

  _container.querySelector('#af-apply-btn').addEventListener('click', handleApply)
  _container.querySelector('#af-download-btn').addEventListener('click', handleDownload)
  _container.querySelector('#af-reset-btn').addEventListener('click', () => {
    for (const attr of _attributes) {
      _configs[attr] = buildDefaultConfig()
    }
    renderAttributeCards()
  })
}

function renderAttributeCards() {
  const cardsEl = _container?.querySelector('#af-cards')
  if (!cardsEl) return
  cardsEl.innerHTML = ''

  for (const attr of _attributes) {
    cardsEl.appendChild(buildAttributeCard(attr))
  }
}

function buildAttributeCard(attr) {
  const cfg = _configs[attr]
  const active = cfg.behavior !== 'ignore'

  const moduleOptions = Object.keys(FAKER_MODULES)
    .map((m) => `<option value="${m}" ${cfg.fakerModule === m ? 'selected' : ''}>${m}</option>`)
    .join('')

  const methodOptions = (FAKER_MODULES[cfg.fakerModule] ?? [])
    .map((m) => `<option value="${m}" ${cfg.fakerMethod === m ? 'selected' : ''}>${m}</option>`)
    .join('')

  const card = document.createElement('div')
  card.className = 'tool-section'
  card.style.cssText = 'margin-bottom:0;'
  card.dataset.attr = attr

  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <span style="font-weight:600;font-size:14px;">${escHtml(attr)}</span>
    </div>

    <!-- Behavior row (always visible) -->
    <div>
      <label style="font-size:12px;font-weight:500;display:block;margin-bottom:6px;">Behavior</label>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        ${[
          ['ignore', 'Ignore'],
          ['overwrite', 'Overwrite'],
          ['overwrite_if_empty', 'Only if empty'],
          ['set_null', 'Set null'],
        ].map(([val, label]) => `
          <label style="font-size:13px;display:flex;align-items:center;gap:4px;">
            <input type="radio" name="af-behavior-${escAttr(attr)}" value="${val}" ${cfg.behavior === val ? 'checked' : ''}>
            ${label}
          </label>
        `).join('')}
      </div>
    </div>

    <!-- Method + panels (hidden when behavior = ignore) -->
    <div class="af-active-panel" style="${active ? 'margin-top:10px;' : 'display:none;'}">

      <!-- Method row -->
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px;">
        <label style="font-size:13px;display:flex;align-items:center;gap:4px;">
          <input type="radio" name="af-method-${escAttr(attr)}" value="manual" ${cfg.method === 'manual' ? 'checked' : ''}>
          Manual values
        </label>
        <label style="font-size:13px;display:flex;align-items:center;gap:4px;">
          <input type="radio" name="af-method-${escAttr(attr)}" value="faker" ${cfg.method === 'faker' ? 'checked' : ''}>
          Faker
        </label>
      </div>

      <!-- Manual panel -->
      <div class="af-manual-panel" style="${cfg.method === 'manual' ? '' : 'display:none;'}">
        <div style="margin-bottom:8px;">
          <label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px;">Values (comma or newline separated)</label>
          <textarea class="form-input af-manual-values" rows="3" style="width:100%;resize:vertical;">${escHtml(cfg.manualValues)}</textarea>
        </div>
        <div>
          <label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px;">Value type</label>
          <select class="form-select af-value-type">
            ${['string','number','boolean','null'].map((t) =>
              `<option value="${t}" ${cfg.valueType === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <!-- Faker panel -->
      <div class="af-faker-panel" style="${cfg.method === 'faker' ? '' : 'display:none;'}">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
          <div>
            <label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px;">Module</label>
            <select class="form-select af-faker-module">${moduleOptions}</select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px;">Method</label>
            <select class="form-select af-faker-method">${methodOptions}</select>
          </div>
        </div>
      </div>

    </div>
  `

  // Wire behavior → show/hide active panel
  card.querySelectorAll(`input[name="af-behavior-${escAttr(attr)}"]`).forEach((radio) => {
    radio.addEventListener('change', () => {
      cfg.behavior = radio.value
      const panel = card.querySelector('.af-active-panel')
      if (cfg.behavior === 'ignore') {
        panel.style.display = 'none'
      } else {
        panel.style.display = ''
        panel.style.marginTop = '10px'
      }
    })
  })

  // Wire method toggle
  card.querySelectorAll(`input[name="af-method-${escAttr(attr)}"]`).forEach((radio) => {
    radio.addEventListener('change', () => {
      cfg.method = radio.value
      card.querySelector('.af-manual-panel').style.display = cfg.method === 'manual' ? '' : 'none'
      card.querySelector('.af-faker-panel').style.display = cfg.method === 'faker' ? '' : 'none'
    })
  })

  // Wire manual values
  card.querySelector('.af-manual-values').addEventListener('input', (e) => {
    cfg.manualValues = e.target.value
  })
  card.querySelector('.af-value-type').addEventListener('change', (e) => {
    cfg.valueType = e.target.value
  })

  // Wire faker module → repopulate methods
  const moduleSelect = card.querySelector('.af-faker-module')
  const methodSelect = card.querySelector('.af-faker-method')
  moduleSelect.addEventListener('change', () => {
    cfg.fakerModule = moduleSelect.value
    const methods = FAKER_MODULES[cfg.fakerModule] ?? []
    cfg.fakerMethod = methods[0] ?? ''
    methodSelect.innerHTML = methods
      .map((m) => `<option value="${m}">${m}</option>`)
      .join('')
  })
  methodSelect.addEventListener('change', () => {
    cfg.fakerMethod = methodSelect.value
  })

  return card
}

function handleApply() {
  const updated = applyFakerChanges(_state.geojsonData, _attributes, _configs)
  _state.update(updated, 'Attribute Faker applied')
  const statusEl = _container?.querySelector('#af-status')
  if (statusEl) {
    statusEl.textContent = `Applied to ${updated.features?.length ?? 0} features.`
    setTimeout(() => { if (statusEl) statusEl.textContent = '' }, 2500)
  }
}

function handleDownload() {
  const data = _state.geojsonData
  if (!data) return
  downloadGeoJSON(data, buildFilename(_state.filename, 'property-faker'))
}

// XSS-safe helpers
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escAttr(str) {
  return String(str ?? '').replace(/[^a-zA-Z0-9_-]/g, '_')
}
