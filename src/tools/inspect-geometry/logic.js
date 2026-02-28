/**
 * Pure data-transformation functions for the Geometry Inspector tool.
 * Zero DOM dependencies.
 */

/**
 * Remove surrounding single or double quotes from a string.
 * @param {string} str
 * @returns {string}
 */
export function unquote(str) {
  const s = str.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  return s
}

/**
 * Parse a wizard-style query string into an array of category objects.
 * Format: "key or key=value or amenity=parking"
 * Terms joined by "or", "||", or "|".
 *
 * @param {string} input
 * @returns {Array<{id: number, label: string, conditions: Condition[], mode: 'wizard'}>}
 *
 * @typedef {{ key: string, value: string|null, type: 'eq'|'exists' }} Condition
 */
export function parseWizardQuery(input) {
  const text = input.trim()
  if (!text) return []

  const parts = text
    .split(/(?:\s+or\s+|\s+\|\|\s+|\s+\|\s+)/i)
    .map((s) => s.trim())
    .filter(Boolean)

  let id = 0
  return parts.map((part) => {
    const p = part.replace(/^\(+|\)+$/g, '').trim()
    const kvMatch = p.match(/^(.*?)=(.*)$/)
    let conditions = []
    if (kvMatch) {
      const key = unquote(kvMatch[1].trim())
      const value = unquote(kvMatch[2].trim())
      conditions.push({ key, value, type: 'eq' })
    } else {
      const key = unquote(p)
      conditions.push({ key, value: null, type: 'exists' })
    }
    return { id: id++, label: part, conditions, mode: 'wizard' }
  })
}

/**
 * Parse an Overpass QL snippet into category objects.
 * One line per category; tags extracted from ["key"="value"] filters.
 *
 * @param {string} input
 * @returns {Array<{id: number, label: string, conditions: Condition[], mode: 'overpass'}>}
 */
export function parseOverpassQLQuery(input) {
  const lines = input.split(/\r?\n/)
  const cats = []
  let id = 0

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('//') || line.startsWith('#')) continue

    const conds = []
    const tagRe = /\[([^\]]+)\]/g
    let m
    while ((m = tagRe.exec(line)) !== null) {
      const content = m[1].trim()
      if (!content) continue
      const eqIndex = content.indexOf('=')
      if (eqIndex >= 0) {
        const key = unquote(content.slice(0, eqIndex).trim())
        const value = unquote(content.slice(eqIndex + 1).trim())
        conds.push({ key, value, type: 'eq' })
      } else {
        conds.push({ key: unquote(content), value: null, type: 'exists' })
      }
    }

    if (!conds.length) continue
    cats.push({ id: id++, label: line, conditions: conds, mode: 'overpass' })
  }

  return cats
}

/**
 * Test whether a GeoJSON feature satisfies all conditions of a category.
 * @param {object} feature - GeoJSON Feature
 * @param {{ conditions: Condition[] }} cat - parsed category
 * @returns {boolean}
 */
export function featureMatchesCategory(feature, cat) {
  if (!feature || feature.type !== 'Feature') return false
  const props = feature.properties ?? {}
  if (!cat.conditions?.length) return false

  for (const cond of cat.conditions) {
    const { key } = cond
    if (cond.type === 'exists') {
      if (!Object.prototype.hasOwnProperty.call(props, key)) return false
    } else if (cond.type === 'eq') {
      if (!Object.prototype.hasOwnProperty.call(props, key)) return false
      if (String(props[key]) !== String(cond.value)) return false
    }
  }
  return true
}

/**
 * Build result rows by matching features against categories, grouped by geometry type.
 *
 * @param {object[]} features - array of GeoJSON Features
 * @param {object[]} categories - parsed category objects
 * @returns {object[]} array of row objects
 */
export function buildRows(features, categories) {
  const newRows = []
  if (!features.length || !categories.length) return newRows

  for (const cat of categories) {
    const geomMap = new Map()

    features.forEach((feat, idx) => {
      if (!feat || feat.type !== 'Feature' || !feat.geometry) return
      const geomType = feat.geometry.type || 'Unknown'
      if (featureMatchesCategory(feat, cat)) {
        if (!geomMap.has(geomType)) geomMap.set(geomType, { count: 0, indexes: [] })
        const entry = geomMap.get(geomType)
        entry.count += 1
        entry.indexes.push(idx)
      }
    })

    if (geomMap.size === 0) {
      newRows.push({
        id: `${cat.id}::none`,
        catId: cat.id,
        categoryLabel: cat.label,
        tagsLabel: buildTagsLabel(cat),
        geomType: '(none)',
        count: 0,
        indexes: [],
        selected: false,
        mode: cat.mode,
      })
    } else {
      for (const [geomType, entry] of geomMap) {
        newRows.push({
          id: `${cat.id}::${geomType}`,
          catId: cat.id,
          categoryLabel: cat.label,
          tagsLabel: buildTagsLabel(cat),
          geomType,
          count: entry.count,
          indexes: entry.indexes,
          selected: entry.count > 0,
          mode: cat.mode,
        })
      }
    }
  }

  return newRows
}

/**
 * Format category conditions as a human-readable tags label.
 * @param {{ conditions: Condition[] }} cat
 * @returns {string}
 */
export function buildTagsLabel(cat) {
  if (!cat.conditions?.length) return ''
  return cat.conditions
    .map((cond) => (cond.type === 'exists' ? `${cond.key} (exists)` : `${cond.key}=${cond.value}`))
    .join(', ')
}

/**
 * Sort rows in place by a given key and direction.
 * @param {object[]} rows
 * @param {{ key: string, dir: 'asc'|'desc' }} sortState
 * @returns {object[]} the same array, sorted
 */
export function sortRows(rows, sortState) {
  const { key, dir } = sortState
  const factor = dir === 'asc' ? 1 : -1

  rows.sort((a, b) => {
    let va, vb
    switch (key) {
      case 'category':
        va = a.categoryLabel.toLowerCase()
        vb = b.categoryLabel.toLowerCase()
        break
      case 'tags':
        va = (a.tagsLabel || '').toLowerCase()
        vb = (b.tagsLabel || '').toLowerCase()
        break
      case 'geom':
        va = a.geomType.toLowerCase()
        vb = b.geomType.toLowerCase()
        break
      case 'count':
        if (a.count < b.count) return -1 * factor
        if (a.count > b.count) return 1 * factor
        return 0
      default:
        return 0
    }
    if (va < vb) return -1 * factor
    if (va > vb) return 1 * factor
    return 0
  })

  return rows
}

/**
 * Extract the features at the given indexes from the features array.
 * @param {object[]} features
 * @param {number[]} indexes
 * @returns {object[]}
 */
export function extractSelectedFeatures(features, indexes) {
  return indexes.map((i) => features[i]).filter(Boolean)
}
