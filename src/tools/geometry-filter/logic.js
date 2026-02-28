/**
 * Pure data-transformation functions for the Geometry Filter tool.
 * Zero DOM dependencies.
 */

/**
 * Detect all unique geometry types present in a GeoJSON FeatureCollection.
 * @param {object} geojson - GeoJSON FeatureCollection
 * @returns {string[]} sorted array of geometry type strings
 */
export function detectGeometryTypes(geojson) {
  const types = new Set()
  const features = geojson?.features ?? []
  for (const f of features) {
    const t = f?.geometry?.type
    if (t) types.add(t)
  }
  return Array.from(types).sort()
}

/**
 * Count features by geometry type.
 * @param {object} geojson - GeoJSON FeatureCollection
 * @returns {Map<string, number>} type → feature count
 */
export function countByGeometryType(geojson) {
  const counts = new Map()
  for (const f of geojson?.features ?? []) {
    const t = f?.geometry?.type ?? 'null'
    counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return counts
}

/**
 * Return a new FeatureCollection with features of the specified geometry types removed.
 * @param {object} geojson - GeoJSON FeatureCollection
 * @param {string[]} typesToRemove - geometry type strings to exclude
 * @returns {object} new GeoJSON FeatureCollection
 */
export function filterByGeometryTypes(geojson, typesToRemove) {
  const removeSet = new Set(typesToRemove)
  const features = (geojson?.features ?? []).filter(
    (f) => !f?.geometry?.type || !removeSet.has(f.geometry.type)
  )
  return { type: 'FeatureCollection', features }
}
