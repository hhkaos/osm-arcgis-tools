/**
 * Pure data-transformation functions for the OSM → ArcGIS field name cleaner.
 * Zero DOM dependencies.
 */

const MAX_LENGTH = 64

/**
 * Check if a field name is valid for ArcGIS.
 * Rules: starts with a letter, only letters/digits/underscore, max 64 chars.
 * @param {string} name
 * @returns {boolean}
 */
export function isValidArcGISFieldName(name) {
  if (!name || typeof name !== 'string') return false
  if (!/^[A-Za-z]/.test(name)) return false
  if (!/^[A-Za-z0-9_]+$/.test(name)) return false
  if (name.length > MAX_LENGTH) return false
  return true
}

/**
 * Return an array of unique invalid characters found in a field name.
 * @param {string} name
 * @returns {string[]}
 */
export function getInvalidChars(name) {
  if (!name) return []
  const matches = name.match(/[^A-Za-z0-9_]/g)
  return matches ? Array.from(new Set(matches)) : []
}

/**
 * Convert an arbitrary string to an ArcGIS-safe field name.
 * Does NOT enforce uniqueness — call ensureUniqueNames() separately.
 *
 * @param {string} original
 * @param {{ counter: number }} counterRef - mutable counter object for fallback names
 * @returns {string}
 */
export function makeArcGISSafeName(original, counterRef = { counter: 1 }) {
  if (!original || typeof original !== 'string') {
    return 'FIELD_' + counterRef.counter++
  }

  // Normalize and strip accents
  let name = original.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Replace invalid chars with underscore
  name = name.replace(/[^A-Za-z0-9_]/g, '_')

  // Remove leading non-letter characters
  name = name.replace(/^[^A-Za-z]+/, '')

  // Fallback if empty
  if (!name || !/^[A-Za-z]/.test(name)) {
    name = 'FIELD_' + counterRef.counter++
  }

  // Truncate
  if (name.length > MAX_LENGTH) name = name.substring(0, MAX_LENGTH)

  return name
}

/**
 * Ensure all proposed names in a name mapping are unique.
 * Modifies the map in place and returns it.
 *
 * @param {string[]} propertyNames - ordered list of original property names
 * @param {Map<string, string>} nameMapping - original → proposed name
 * @returns {Map<string, string>} the same map, with duplicates resolved
 */
export function ensureUniqueNames(propertyNames, nameMapping) {
  const used = new Set()
  for (const original of propertyNames) {
    let proposed = nameMapping.get(original) || original
    const base = proposed
    let suffix = 1
    while (used.has(proposed)) {
      const truncatedBase = base.substring(0, MAX_LENGTH - ('_' + suffix).length)
      proposed = truncatedBase + '_' + suffix
      suffix++
    }
    used.add(proposed)
    nameMapping.set(original, proposed)
  }
  return nameMapping
}

/**
 * Extract unique property names from any GeoJSON structure.
 * @param {object|object[]} geojson - FeatureCollection, Feature, or array of Features
 * @returns {string[]} sorted array of property names
 */
export function extractPropertyNames(geojson) {
  const names = new Set()

  function collectFromFeature(feature) {
    if (!feature || typeof feature !== 'object') return
    const props = feature.properties
    if (props && typeof props === 'object') {
      for (const key of Object.keys(props)) names.add(key)
    }
  }

  if (Array.isArray(geojson?.features)) {
    geojson.features.forEach(collectFromFeature)
  } else if (geojson?.type === 'Feature') {
    collectFromFeature(geojson)
  } else if (Array.isArray(geojson)) {
    geojson.forEach(collectFromFeature)
  }

  return Array.from(names).sort((a, b) => a.localeCompare(b))
}

/**
 * Apply a name mapping to a GeoJSON object, returning a new object with renamed properties.
 * Also calls ensureUniqueNames internally to guarantee uniqueness before applying.
 *
 * @param {object} originalGeoJSON
 * @param {string[]} propertyNames
 * @param {Map<string, string>} nameMapping
 * @returns {object} new GeoJSON with renamed properties
 */
export function buildUpdatedGeoJSON(originalGeoJSON, propertyNames, nameMapping) {
  if (!originalGeoJSON) throw new Error('No GeoJSON provided.')

  // Ensure uniqueness before applying
  ensureUniqueNames(propertyNames, nameMapping)

  const cloned = JSON.parse(JSON.stringify(originalGeoJSON))

  function updateFeatureProps(feature) {
    if (!feature || typeof feature !== 'object') return
    const props = feature.properties
    if (!props || typeof props !== 'object') return

    const newProps = {}
    for (const [key, value] of Object.entries(props)) {
      const newKey = nameMapping.get(key) || key
      newProps[newKey] = value
    }
    feature.properties = newProps
  }

  if (Array.isArray(cloned.features)) {
    cloned.features.forEach(updateFeatureProps)
  } else if (cloned.type === 'Feature') {
    updateFeatureProps(cloned)
  } else if (Array.isArray(cloned)) {
    cloned.forEach(updateFeatureProps)
  }

  return cloned
}
