/**
 * Shared download utility.
 * Triggers a browser file download of GeoJSON data.
 */

/**
 * Build a download filename from the original loaded filename + a tool suffix.
 * e.g. buildFilename('buildings.geojson', 'property-editor') → 'buildings_property-editor.geojson'
 * @param {string|null} originalFilename
 * @param {string} suffix
 * @returns {string}
 */
export function buildFilename(originalFilename, suffix) {
  const base = (originalFilename ?? 'output').replace(/\.(geojson|json)$/i, '')
  return `${base}_${suffix}.geojson`
}

/**
 * @param {object} geojson
 * @param {string} filename
 */
export function downloadGeoJSON(geojson, filename = 'output.geojson') {
  const json = JSON.stringify(geojson, null, 2)
  const blob = new Blob([json], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
