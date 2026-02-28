import { describe, it, expect } from 'vitest'
import {
  extractFeatures,
  getValueKey,
  computePropertyStats,
  filterActiveFeatures,
  trimFeatureProperties,
  buildFilteredFilename,
} from '../../src/tools/feature-explorer/logic.js'

const FC = (features) => ({ type: 'FeatureCollection', features })
const F = (props) => ({ type: 'Feature', properties: props, geometry: null })

describe('extractFeatures()', () => {
  it('extracts from FeatureCollection', () => {
    const fc = FC([F({ a: 1 }), F({ b: 2 })])
    expect(extractFeatures(fc)).toHaveLength(2)
  })

  it('wraps a single Feature in an array', () => {
    const feature = F({ a: 1 })
    expect(extractFeatures(feature)).toHaveLength(1)
  })

  it('filters Features from a raw array', () => {
    const arr = [F({ a: 1 }), { type: 'Geometry' }, F({ b: 2 })]
    expect(extractFeatures(arr)).toHaveLength(2)
  })

  it('throws for null input', () => {
    expect(() => extractFeatures(null)).toThrow()
  })

  it('throws for empty raw array', () => {
    expect(() => extractFeatures([{ type: 'Geometry' }])).toThrow()
  })
})

describe('getValueKey()', () => {
  it('returns string for strings', () => expect(getValueKey('hello')).toBe('hello'))
  it('returns string for numbers', () => expect(getValueKey(42)).toBe('42'))
  it('returns string for booleans', () => expect(getValueKey(true)).toBe('true'))
  it('returns JSON for objects', () => expect(getValueKey({ x: 1 })).toBe('{"x":1}'))
  it('returns JSON for arrays', () => expect(getValueKey([1, 2])).toBe('[1,2]'))
  it('returns JSON for null', () => expect(getValueKey(null)).toBe('null'))
})

describe('computePropertyStats()', () => {
  const features = [
    F({ amenity: 'parking', capacity: 50 }),
    F({ amenity: 'bench', capacity: 10 }),
    F({ amenity: 'parking' }),  // no capacity
    F({}),                      // no props
  ]

  it('counts features with values', () => {
    const stats = computePropertyStats(features)
    expect(stats.get('amenity').countWithValue).toBe(3)
    expect(stats.get('capacity').countWithValue).toBe(2)
  })

  it('tracks type counts', () => {
    const stats = computePropertyStats(features)
    expect(stats.get('amenity').typeCounts.get('string')).toBe(3)
    expect(stats.get('capacity').typeCounts.get('number')).toBe(2)
  })

  it('tracks unique value counts', () => {
    const stats = computePropertyStats(features)
    expect(stats.get('amenity').valueCounts.get('parking')).toBe(2)
    expect(stats.get('amenity').valueCounts.get('bench')).toBe(1)
  })

  it('handles empty features array', () => {
    expect(computePropertyStats([])).toEqual(new Map())
  })
})

describe('filterActiveFeatures()', () => {
  const features = [
    F({ amenity: 'parking' }),
    F({ amenity: 'bench' }),
    F({ amenity: 'parking' }),
  ]

  it('returns all features when no filter set', () => {
    expect(filterActiveFeatures(features, null, null)).toHaveLength(3)
    expect(filterActiveFeatures(features, '', '')).toHaveLength(3)
  })

  it('filters by property value', () => {
    const result = filterActiveFeatures(features, 'amenity', 'parking')
    expect(result).toHaveLength(2)
  })

  it('returns empty when no features match', () => {
    const result = filterActiveFeatures(features, 'amenity', 'restaurant')
    expect(result).toHaveLength(0)
  })
})

describe('trimFeatureProperties()', () => {
  const feature = F({ a: 1, b: 2, c: 3 })
  const selected = new Set(['a', 'c'])

  it('keeps only selected properties', () => {
    const trimmed = trimFeatureProperties(feature, selected)
    expect(trimmed.properties).toEqual({ a: 1, c: 3 })
  })

  it('does not include unselected properties', () => {
    const trimmed = trimFeatureProperties(feature, selected)
    expect(trimmed.properties.b).toBeUndefined()
  })

  it('does not mutate the original feature', () => {
    trimFeatureProperties(feature, selected)
    expect(feature.properties).toEqual({ a: 1, b: 2, c: 3 })
  })

  it('handles empty selectedProperties set', () => {
    const trimmed = trimFeatureProperties(feature, new Set())
    expect(trimmed.properties).toEqual({})
  })
})

describe('buildFilteredFilename()', () => {
  it('generates filename from original name + property+value', () => {
    expect(buildFilteredFilename('amenity', 'parking', 'buildings.geojson'))
      .toBe('buildings_property-explorer_amenity_parking.geojson')
  })

  it('sanitizes special chars', () => {
    const name = buildFilteredFilename('addr:city', 'New York!', 'data.geojson')
    expect(name).toMatch(/^data_property-explorer_/)
    expect(name).toMatch(/\.geojson$/)
    expect(name).not.toContain(':')
  })

  it('returns default when no filter', () => {
    expect(buildFilteredFilename(null, null, 'data.geojson')).toBe('data_property-explorer.geojson')
  })

  it('falls back to output when no original filename', () => {
    expect(buildFilteredFilename(null, null, null)).toBe('output_property-explorer.geojson')
  })
})
