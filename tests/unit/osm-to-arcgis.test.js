import { describe, it, expect } from 'vitest'
import {
  isValidArcGISFieldName,
  getInvalidChars,
  makeArcGISSafeName,
  ensureUniqueNames,
  extractPropertyNames,
  buildUpdatedGeoJSON,
} from '../../src/tools/osm-to-arcgis/logic.js'

describe('isValidArcGISFieldName()', () => {
  it('accepts valid names', () => {
    expect(isValidArcGISFieldName('highway')).toBe(true)
    expect(isValidArcGISFieldName('name_en')).toBe(true)
    expect(isValidArcGISFieldName('Field1')).toBe(true)
    expect(isValidArcGISFieldName('A')).toBe(true)
  })

  it('rejects names starting with a digit', () => {
    expect(isValidArcGISFieldName('1name')).toBe(false)
  })

  it('rejects names starting with underscore', () => {
    expect(isValidArcGISFieldName('_name')).toBe(false)
  })

  it('rejects names with invalid characters', () => {
    expect(isValidArcGISFieldName('addr:street')).toBe(false)
    expect(isValidArcGISFieldName('name-en')).toBe(false)
    expect(isValidArcGISFieldName('name en')).toBe(false)
  })

  it('rejects empty string and non-string', () => {
    expect(isValidArcGISFieldName('')).toBe(false)
    expect(isValidArcGISFieldName(null)).toBe(false)
  })

  it('rejects names longer than 64 chars', () => {
    expect(isValidArcGISFieldName('a'.repeat(65))).toBe(false)
    expect(isValidArcGISFieldName('a'.repeat(64))).toBe(true)
  })
})

describe('getInvalidChars()', () => {
  it('returns invalid chars for addr:street', () => {
    expect(getInvalidChars('addr:street')).toContain(':')
  })

  it('returns empty array for valid name', () => {
    expect(getInvalidChars('highway')).toEqual([])
  })

  it('deduplicates chars', () => {
    const chars = getInvalidChars('a:b:c')
    expect(chars.filter((c) => c === ':').length).toBe(1)
  })

  it('handles empty string', () => {
    expect(getInvalidChars('')).toEqual([])
  })
})

describe('makeArcGISSafeName()', () => {
  it('replaces colons with underscore', () => {
    const result = makeArcGISSafeName('addr:street')
    expect(isValidArcGISFieldName(result)).toBe(true)
    expect(result).toBe('addr_street')
  })

  it('strips accents', () => {
    const result = makeArcGISSafeName('café')
    expect(result).toBe('cafe')
  })

  it('removes leading digits', () => {
    const result = makeArcGISSafeName('123abc')
    expect(isValidArcGISFieldName(result)).toBe(true)
    expect(result).toBe('abc')
  })

  it('generates a fallback for fully invalid names', () => {
    const counter = { counter: 1 }
    const result = makeArcGISSafeName('123', counter)
    expect(result).toMatch(/^FIELD_/)
    expect(counter.counter).toBe(2)
  })

  it('truncates to 64 chars', () => {
    const result = makeArcGISSafeName('a'.repeat(100))
    expect(result.length).toBe(64)
  })
})

describe('ensureUniqueNames()', () => {
  it('resolves duplicate proposed names', () => {
    const names = ['addr:street', 'addr:city']
    const mapping = new Map([['addr:street', 'addr_x'], ['addr:city', 'addr_x']])
    ensureUniqueNames(names, mapping)
    const values = Array.from(mapping.values())
    expect(new Set(values).size).toBe(values.length)
  })

  it('preserves unique names unchanged', () => {
    const names = ['highway', 'amenity']
    const mapping = new Map([['highway', 'highway'], ['amenity', 'amenity']])
    ensureUniqueNames(names, mapping)
    expect(mapping.get('highway')).toBe('highway')
    expect(mapping.get('amenity')).toBe('amenity')
  })
})

describe('extractPropertyNames()', () => {
  it('extracts from FeatureCollection', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { highway: 'road', name: 'A' }, geometry: null },
        { type: 'Feature', properties: { amenity: 'park' }, geometry: null },
      ]
    }
    const names = extractPropertyNames(geojson)
    expect(names).toContain('highway')
    expect(names).toContain('name')
    expect(names).toContain('amenity')
  })

  it('extracts from single Feature', () => {
    const geojson = { type: 'Feature', properties: { x: 1, y: 2 }, geometry: null }
    const names = extractPropertyNames(geojson)
    expect(names).toEqual(['x', 'y'])
  })

  it('returns sorted array', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { z: 1, a: 2, m: 3 }, geometry: null }]
    }
    const names = extractPropertyNames(geojson)
    expect(names).toEqual([...names].sort())
  })
})

describe('buildUpdatedGeoJSON()', () => {
  it('renames properties according to mapping', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { 'addr:street': 'Main St' }, geometry: null }]
    }
    const names = ['addr:street']
    const mapping = new Map([['addr:street', 'addr_street']])
    const result = buildUpdatedGeoJSON(geojson, names, mapping)
    expect(result.features[0].properties['addr_street']).toBe('Main St')
    expect(result.features[0].properties['addr:street']).toBeUndefined()
  })

  it('does not mutate the original', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { 'addr:street': 'X' }, geometry: null }]
    }
    const names = ['addr:street']
    const mapping = new Map([['addr:street', 'addr_street']])
    buildUpdatedGeoJSON(geojson, names, mapping)
    expect(geojson.features[0].properties['addr:street']).toBe('X')
  })
})
