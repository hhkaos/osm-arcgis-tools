/**
 * GeoJSON → Overpass poly UI shell.
 * mount(container, state) / unmount()
 *
 * This tool is map-first: the user picks or draws a boundary from the embedded
 * map companion and gets the Overpass poly: expression for it. It does not
 * read from the shared GeoJSON state.
 */
import { geometryToOverpassPoly } from './logic.js'

let _container = null
let _selectedFeature = null   // geometry received from map companion

function handleMapMessage(event) {
  if (event.data?.type !== 'osm-tools-geojson') return
  const geojson = event.data.geojson
  const feature = geojson?.features?.[0]
  if (!feature) return
  _selectedFeature = feature
  renderResult()
}

export function mount(container, _state) {
  _container = container
  _selectedFeature = null

  window.addEventListener('message', handleMapMessage)

  container.innerHTML = `
    <div class="tool-section">
      <h3>Geometry → Overpass</h3>
      <p class="tool-description">Build precise polygon filters for Overpass API — query within an exact boundary, not a rectangular bounding box</p>
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:14px;">
        Overpass <code>poly:</code> filters let you query OSM data within an exact polygon shape — ideal for administrative boundaries or any custom area.
        Pick a boundary from the map below or draw your own polygon, then copy the generated expression into your Overpass query.
      </p>

      <div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:14px;">
        <iframe
          src="map-companion.html"
          style="width:100%;height:780px;border:none;display:block;"
          title="Boundary Picker Map"
          allow="clipboard-write"
        ></iframe>
      </div>

      <div id="overpass-result"></div>
    </div>
  `

  renderResult()
}

function renderResult() {
  const el = _container?.querySelector('#overpass-result')
  if (!el) return

  if (!_selectedFeature) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Click any polygon feature on the map, or use Draw Polygon, to generate its Overpass poly: expression.</p>'
    return
  }

  const geom = _selectedFeature.geometry
  const props = _selectedFeature.properties ?? {}
  const geomType = geom?.type ?? 'unknown'
  const isPolygonLike = geomType === 'Polygon' || geomType === 'MultiPolygon'

  const nameKey = ['name', 'NAME', 'Name', 'label', 'LABEL'].find((k) => props[k])
  const label = nameKey ? props[nameKey] : null

  const poly = isPolygonLike ? geometryToOverpassPoly(geom) : null

  el.innerHTML = `
    <div style="background:var(--bg-tool);border:1px solid var(--border);border-radius:var(--radius);padding:12px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
        <span class="badge badge-blue">${geomType}</span>
        ${label ? `<span style="font-weight:600;font-size:14px;">${escHtml(label)}</span>` : ''}
        <span id="overpass-copy-status" style="font-size:12px;color:var(--success);margin-left:auto;"></span>
      </div>

      ${poly ? `
        <div style="margin-bottom:10px;">
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;color:var(--text-muted);">Overpass poly: expression</label>
          <textarea
            id="overpass-poly-text"
            readonly
            rows="4"
            style="width:100%;font-family:monospace;font-size:11px;resize:vertical;box-sizing:border-box;padding:6px;border:1px solid var(--border);border-radius:4px;background:#f8fafc;"
          >${escHtml(poly)}</textarea>
        </div>
      ` : `
        <p style="color:#b91c1c;font-size:13px;margin-bottom:10px;">
          <i class="fa-solid fa-triangle-exclamation"></i>
          This geometry type (<strong>${geomType}</strong>) cannot be converted to an Overpass poly: expression. Only Polygon and MultiPolygon are supported.
        </p>
      `}

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${poly ? `<button class="btn btn-primary" id="btn-copy-poly">Copy poly</button>` : ''}
        <button class="btn" id="btn-copy-geojson">Copy GeoJSON geometry</button>
        <button class="btn" id="btn-download-geojson">Download GeoJSON geometry</button>
      </div>

      ${poly ? `
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
          <p style="margin:0 0 8px 0;font-size:13px;color:var(--text-muted);">
            Open <a href="https://overpass-turbo.eu/" target="_blank" rel="noopener noreferrer">overpass-turbo.eu</a>, paste this query, run it, and replace the <code>poly:</code> value with your selected polygon (already filled below).
          </p>
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;color:var(--text-muted);">Example query for this polygon</label>
          <textarea
            id="overpass-example-query"
            readonly
            rows="12"
            style="width:100%;font-family:monospace;font-size:11px;resize:vertical;box-sizing:border-box;padding:6px;border:1px solid var(--border);border-radius:4px;background:#f8fafc;"
          >${escHtml(buildOverpassExampleQuery(poly))}</textarea>
        </div>
      ` : ''}
    </div>
  `

  if (poly) {
    el.querySelector('#btn-copy-poly').addEventListener('click', () => {
      copyToClipboard(poly, 'Overpass poly: copied to clipboard.')
    })
  }

  el.querySelector('#btn-copy-geojson').addEventListener('click', () => {
    copyToClipboard(JSON.stringify(geom, null, 2), 'GeoJSON geometry copied to clipboard.')
  })

  el.querySelector('#btn-download-geojson').addEventListener('click', () => {
    downloadTextFile(JSON.stringify(geom, null, 2), 'geometry.geojson', 'application/geo+json')
  })
}

export function unmount() {
  window.removeEventListener('message', handleMapMessage)
  _container = null
  _selectedFeature = null
}

function copyToClipboard(text, successMsg) {
  const statusEl = _container?.querySelector('#overpass-copy-status')
  const done = (msg) => { if (statusEl) { statusEl.textContent = msg; setTimeout(() => { if (statusEl) statusEl.textContent = '' }, 2500) } }

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => done(successMsg)).catch(() => fallbackCopy(text, successMsg, done))
  } else {
    fallbackCopy(text, successMsg, done)
  }
}

function fallbackCopy(text, successMsg, done) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.cssText = 'position:fixed;left:-9999px;'
  document.body.appendChild(ta)
  ta.select()
  try { document.execCommand('copy'); done(successMsg) } catch { alert('Could not copy.\n' + text) }
  document.body.removeChild(ta)
}

function downloadTextFile(text, filename, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function buildOverpassExampleQuery(poly) {
  return `[out:json][timeout:180];
(
  way["building"]${poly};
  relation["building"]${poly};
);
out body;
>;
out skel qt;`
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
