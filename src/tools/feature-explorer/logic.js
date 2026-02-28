/**
 * Pure data-transformation functions for the Feature Explorer tool.
 * Zero DOM dependencies.
 */

/**
 * Extract a flat array of Features from various GeoJSON structures.
 * @param {object|object[]} geojson
 * @returns {object[]} array of GeoJSON Feature objects
 * @throws {Error} if structure is not recognised
 */
export function extractFeatures(geojson) {
  if (!geojson) throw new Error('Empty GeoJSON object.')

  if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
    return geojson.features
  }
  if (geojson.type === 'Feature') {
    return [geojson]
  }
  if (Array.isArray(geojson)) {
    const features = geojson.filter((f) => f && f.type === 'Feature')
    if (!features.length) throw new Error('Array does not contain valid Feature objects.')
    return features
  }
  throw new Error('Unsupported GeoJSON structure. Expected FeatureCollection, Feature, or array.')
}

/**
 * Serialize a property value to a string key for deduplication.
 * @param {any} rawValue
 * @returns {string}
 */
export function getValueKey(rawValue) {
  const valueType = Array.isArray(rawValue) ? 'array' : typeof rawValue
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return String(rawValue)
  }
  return JSON.stringify(rawValue)
}

/**
 * @typedef {{ countWithValue: number, typeCounts: Map<string,number>, valueCounts: Map<string,number> }} PropertyStats
 */

/**
 * Compute per-property statistics across all features.
 * @param {object[]} features
 * @returns {Map<string, PropertyStats>}
 */
export function computePropertyStats(features) {
  const statsMap = new Map()

  for (const feature of features) {
    const props = feature?.properties ?? {}
    for (const name of Object.keys(props)) {
      const value = props[name]
      const hasValue =
        value !== null &&
        value !== undefined &&
        !(typeof value === 'string' && value.trim() === '')

      if (!statsMap.has(name)) {
        statsMap.set(name, { countWithValue: 0, typeCounts: new Map(), valueCounts: new Map() })
      }

      if (!hasValue) continue

      const stat = statsMap.get(name)
      stat.countWithValue += 1

      const valueType = Array.isArray(value) ? 'array' : typeof value
      stat.typeCounts.set(valueType, (stat.typeCounts.get(valueType) ?? 0) + 1)

      const keyForValue = getValueKey(value)
      stat.valueCounts.set(keyForValue, (stat.valueCounts.get(keyForValue) ?? 0) + 1)
    }
  }

  return statsMap
}

/**
 * Filter features to those where the given property matches the given value key.
 * If filterProperty or filterValueKey is null/empty, returns all features.
 *
 * @param {object[]} allFeatures
 * @param {string|null} filterProperty
 * @param {string|null} filterValueKey
 * @returns {object[]}
 */
export function filterActiveFeatures(allFeatures, filterProperty, filterValueKey) {
  if (!filterProperty || !filterValueKey) return allFeatures

  return allFeatures.filter((feature) => {
    const props = feature?.properties ?? {}
    const rawValue = props[filterProperty]
    const hasValue =
      rawValue !== null &&
      rawValue !== undefined &&
      !(typeof rawValue === 'string' && rawValue.trim() === '')
    if (!hasValue) return false
    return getValueKey(rawValue) === filterValueKey
  })
}

/**
 * Return a new feature with only the properties in the selectedProperties set.
 * @param {object} feature
 * @param {Set<string>} selectedProperties
 * @returns {object} new feature with trimmed properties
 */
export function trimFeatureProperties(feature, selectedProperties) {
  const props = feature?.properties ?? {}
  const newProps = {}
  for (const key of selectedProperties) {
    if (Object.prototype.hasOwnProperty.call(props, key)) {
      newProps[key] = props[key]
    }
  }
  return { ...feature, properties: newProps }
}

/**
 * Build a download filename for filtered features, incorporating the original filename.
 * @param {string|null} filterProperty
 * @param {string|null} filterValueKey
 * @param {string|null} originalFilename  e.g. "buildings.geojson"
 * @returns {string} e.g. "buildings_property-explorer_amenity_parking.geojson"
 */
export function buildFilteredFilename(filterProperty, filterValueKey, originalFilename) {
  const base = (originalFilename ?? 'output').replace(/\.(geojson|json)$/i, '')
  if (!filterProperty || !filterValueKey) return `${base}_property-explorer.geojson`
  const safeProp = filterProperty.replace(/[^a-z0-9-_]+/gi, '_')
  const safeVal = String(filterValueKey).slice(0, 40).replace(/[^a-z0-9-_]+/gi, '_') || 'value'
  return `${base}_property-explorer_${safeProp}_${safeVal}.geojson`
}
