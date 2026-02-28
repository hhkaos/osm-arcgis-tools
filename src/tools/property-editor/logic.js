/**
 * Pure data-transformation functions for the Property Editor tool.
 * Zero DOM dependencies.
 */

/**
 * Get all unique property names from a GeoJSON FeatureCollection.
 * @param {object} geojson
 * @returns {string[]}
 */
export function getAllPropertyNames(geojson) {
  const propertySet = new Set()
  for (const feature of geojson?.features ?? []) {
    for (const key of Object.keys(feature?.properties ?? {})) {
      propertySet.add(key)
    }
  }
  return Array.from(propertySet)
}

/**
 * Calculate total pages for paginated display.
 * @param {number} featureCount
 * @param {number} pageSize
 * @returns {number}
 */
export function getTotalPages(featureCount, pageSize) {
  return Math.ceil(featureCount / pageSize)
}

/**
 * Delete a property from every feature in a GeoJSON FeatureCollection.
 * Returns a new GeoJSON object.
 *
 * @param {object} geojson
 * @param {string} propertyName
 * @returns {object} new GeoJSON
 */
export function deletePropertyFromAll(geojson, propertyName) {
  const cloned = JSON.parse(JSON.stringify(geojson))
  for (const feature of cloned.features ?? []) {
    if (feature.properties?.hasOwnProperty(propertyName)) {
      delete feature.properties[propertyName]
    }
  }
  return cloned
}

/**
 * Delete multiple properties from every feature.
 * Returns a new GeoJSON object.
 *
 * @param {object} geojson
 * @param {string[]} propertyNames
 * @returns {object} new GeoJSON
 */
export function deletePropertiesFromAll(geojson, propertyNames) {
  const toDelete = new Set(propertyNames)
  const cloned = JSON.parse(JSON.stringify(geojson))
  for (const feature of cloned.features ?? []) {
    if (!feature.properties) continue
    for (const name of toDelete) {
      delete feature.properties[name]
    }
  }
  return cloned
}

/**
 * Add a new property with a default value to every feature.
 * Returns a new GeoJSON object.
 *
 * @param {object} geojson
 * @param {string} propertyName
 * @param {any} defaultValue
 * @returns {object} new GeoJSON
 */
export function addPropertyToAll(geojson, propertyName, defaultValue) {
  const cloned = JSON.parse(JSON.stringify(geojson))
  for (const feature of cloned.features ?? []) {
    if (!feature.properties) feature.properties = {}
    feature.properties[propertyName] = defaultValue
  }
  return cloned
}

/**
 * Rename a property across all features.
 * Returns a new GeoJSON object.
 *
 * @param {object} geojson
 * @param {string} oldName
 * @param {string} newName
 * @returns {object} new GeoJSON
 */
export function renamePropertyOnAll(geojson, oldName, newName) {
  const cloned = JSON.parse(JSON.stringify(geojson))
  for (const feature of cloned.features ?? []) {
    if (feature.properties?.hasOwnProperty(oldName)) {
      feature.properties[newName] = feature.properties[oldName]
      delete feature.properties[oldName]
    }
  }
  return cloned
}

/**
 * Set a property to a specific value on all features.
 * Returns a new GeoJSON object.
 *
 * @param {object} geojson
 * @param {string} propertyName
 * @param {any} value
 * @returns {object} new GeoJSON
 */
export function applyBulkEditToAll(geojson, propertyName, value) {
  const cloned = JSON.parse(JSON.stringify(geojson))
  for (const feature of cloned.features ?? []) {
    if (!feature.properties) feature.properties = {}
    feature.properties[propertyName] = value
  }
  return cloned
}

/**
 * Delete a single feature by index from a GeoJSON FeatureCollection.
 * Returns a new GeoJSON object.
 *
 * @param {object} geojson
 * @param {number} index - 0-based feature index
 * @returns {object} new GeoJSON
 */
export function deleteFeatureAtIndex(geojson, index) {
  const cloned = JSON.parse(JSON.stringify(geojson))
  cloned.features = cloned.features.filter((_, i) => i !== index)
  return cloned
}

/**
 * Coerce a value to the specified type name.
 * @param {any} value
 * @param {'String'|'Number'|'Boolean'|'Null'|'Array'|'Object'} typeName
 * @returns {any}
 */
export function coerceValueToType(value, typeName) {
  switch (typeName) {
    case 'String':
      if (value === null || value === undefined) return ''
      return String(value)
    case 'Number': {
      const num = Number(value)
      return isNaN(num) ? null : num
    }
    case 'Boolean':
      if (typeof value === 'boolean') return value
      if (typeof value === 'number') return value !== 0
      if (typeof value === 'string') {
        const v = value.trim().toLowerCase()
        if (['true', 'yes', '1'].includes(v)) return true
        if (['false', 'no', '0', ''].includes(v)) return false
        return Boolean(value)
      }
      return Boolean(value)
    case 'Null':
      return null
    case 'Array':
      if (Array.isArray(value)) return value
      return [value]
    case 'Object':
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value)
          if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
        } catch { /* ignore */ }
      }
      return { value }
    default:
      return value
  }
}

/**
 * Prepare a GeoJSON for download: apply type coercions and remove empty-string values.
 *
 * @param {object} geojson
 * @param {Record<string, string>} propertyTypeSelections - map of propName → type name ('Ignore'|'String'|...)
 * @returns {object} new GeoJSON ready for serialisation
 */
export function prepareDownloadData(geojson, propertyTypeSelections) {
  const coercedFeatures = (geojson?.features ?? []).map((feature) => {
    const newFeature = { ...feature }
    const props = { ...(feature.properties ?? {}) }

    for (const key of Object.keys(props)) {
      const targetType = propertyTypeSelections[key] || 'Ignore'
      if (targetType && targetType !== 'Ignore') {
        props[key] = coerceValueToType(props[key], targetType)
      }
    }

    newFeature.properties = Object.fromEntries(
      Object.entries(props).filter(([, v]) => v !== '')
    )
    return newFeature
  })

  return { ...geojson, features: coercedFeatures }
}

/**
 * Compute type statistics for a single property across all features.
 * @param {object} geojson
 * @param {string} propertyName
 * @returns {{ String: number, Number: number, Boolean: number, Null: number, Array: number, Object: number, Missing: number }}
 */
export function computePropertyTypeStats(geojson, propertyName) {
  const stats = { String: 0, Number: 0, Boolean: 0, Null: 0, Array: 0, Object: 0, Missing: 0 }
  for (const feature of geojson?.features ?? []) {
    const props = feature?.properties ?? {}
    if (!Object.prototype.hasOwnProperty.call(props, propertyName)) {
      stats.Missing++
      continue
    }
    const v = props[propertyName]
    if (v === null) stats.Null++
    else if (Array.isArray(v)) stats.Array++
    else {
      const t = typeof v
      if (t === 'string') stats.String++
      else if (t === 'number') stats.Number++
      else if (t === 'boolean') stats.Boolean++
      else if (t === 'object') stats.Object++
      else stats.String++
    }
  }
  return stats
}
