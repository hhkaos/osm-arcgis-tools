/**
 * Pure data-transformation functions for GeoJSON → Overpass poly tool.
 * Zero DOM dependencies.
 */

/**
 * Count total vertices across all geometry types.
 * @param {object} geometry - GeoJSON Geometry object
 * @returns {number}
 */
export function countVertices(geometry) {
  if (!geometry || !geometry.type) return 0
  const { type, coordinates } = geometry

  if (type === 'Point') return 1
  if (type === 'MultiPoint') return Array.isArray(coordinates) ? coordinates.length : 0
  if (type === 'LineString') return Array.isArray(coordinates) ? coordinates.length : 0
  if (type === 'MultiLineString') {
    if (!Array.isArray(coordinates)) return 0
    return coordinates.reduce((sum, line) => sum + (Array.isArray(line) ? line.length : 0), 0)
  }
  if (type === 'Polygon') {
    if (!Array.isArray(coordinates)) return 0
    return coordinates.reduce((sum, ring) => sum + (Array.isArray(ring) ? ring.length : 0), 0)
  }
  if (type === 'MultiPolygon') {
    if (!Array.isArray(coordinates)) return 0
    let count = 0
    for (const poly of coordinates) {
      if (!Array.isArray(poly)) continue
      for (const ring of poly) {
        if (Array.isArray(ring)) count += ring.length
      }
    }
    return count
  }
  if (type === 'GeometryCollection') {
    if (!Array.isArray(geometry.geometries)) return 0
    return geometry.geometries.reduce((sum, g) => sum + countVertices(g), 0)
  }
  return 0
}

/**
 * Convert a Polygon or MultiPolygon outer ring to an Overpass poly expression.
 * Format: (poly:"lat lon lat lon ...")
 *
 * @param {object} geometry - GeoJSON Polygon or MultiPolygon
 * @returns {string|null} Overpass poly expression, or null if unsupported
 */
export function geometryToOverpassPoly(geometry) {
  if (!geometry || !geometry.coordinates) return null
  let outerRing = null

  if (geometry.type === 'Polygon') {
    outerRing = geometry.coordinates[0]
  } else if (geometry.type === 'MultiPolygon') {
    if (!geometry.coordinates.length || !geometry.coordinates[0]?.length) return null
    outerRing = geometry.coordinates[0][0]
  } else {
    return null
  }

  if (!Array.isArray(outerRing) || outerRing.length < 3) return null

  // Ensure ring is closed
  const first = outerRing[0]
  const last = outerRing[outerRing.length - 1]
  if (!arraysEqual(first, last)) {
    outerRing = [...outerRing, first]
  }

  // GeoJSON: [lon, lat] → Overpass: "lat lon"
  const parts = outerRing.map(([lon, lat]) => `${Number(lat).toFixed(6)} ${Number(lon).toFixed(6)}`)
  return `(poly:"${parts.join(' ')}")`
}

/**
 * Compare two arrays for element-wise equality.
 * @param {any[]} a
 * @param {any[]} b
 * @returns {boolean}
 */
export function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Extract all unique property keys from a GeoJSON FeatureCollection or Feature.
 * @param {object} geojson
 * @returns {string[]} sorted array of property key names
 */
export function extractPropertyKeys(geojson) {
  const keys = new Set()
  const features = geojson?.features ?? (geojson?.type === 'Feature' ? [geojson] : [])
  for (const f of features) {
    for (const k of Object.keys(f?.properties ?? {})) keys.add(k)
  }
  return Array.from(keys).sort()
}
