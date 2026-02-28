import { describe, it, expect } from 'vitest'
import {
  unquote,
  parseWizardQuery,
  parseOverpassQLQuery,
  featureMatchesCategory,
  buildRows,
  buildTagsLabel,
  sortRows,
} from '../../src/tools/inspect-geometry/logic.js'

describe('unquote()', () => {
  it('removes double quotes', () => expect(unquote('"highway"')).toBe('highway'))
  it('removes single quotes', () => expect(unquote("'highway'")).toBe('highway'))
  it('leaves unquoted strings alone', () => expect(unquote('highway')).toBe('highway'))
  it('trims whitespace before unquoting', () => expect(unquote('  "highway"  ')).toBe('highway'))
})

describe('parseWizardQuery()', () => {
  it('parses bare key terms', () => {
    const cats = parseWizardQuery('highway')
    expect(cats).toHaveLength(1)
    expect(cats[0].conditions[0]).toEqual({ key: 'highway', value: null, type: 'exists' })
  })

  it('parses key=value terms', () => {
    const cats = parseWizardQuery('amenity=parking')
    expect(cats[0].conditions[0]).toEqual({ key: 'amenity', value: 'parking', type: 'eq' })
  })

  it('splits on "or"', () => {
    const cats = parseWizardQuery('highway or amenity=parking')
    expect(cats).toHaveLength(2)
  })

  it('splits on "||"', () => {
    const cats = parseWizardQuery('highway || amenity')
    expect(cats).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    expect(parseWizardQuery('')).toEqual([])
    expect(parseWizardQuery('   ')).toEqual([])
  })
})

describe('parseOverpassQLQuery()', () => {
  it('parses a single tag filter line', () => {
    const cats = parseOverpassQLQuery('node["highway"="street_lamp"]({{bbox}});')
    expect(cats).toHaveLength(1)
    expect(cats[0].conditions[0]).toEqual({ key: 'highway', value: 'street_lamp', type: 'eq' })
  })

  it('parses multiple lines as separate categories', () => {
    const query = 'node["highway"="street_lamp"]({{bbox}});\nnode["amenity"="bench"]({{bbox}});'
    const cats = parseOverpassQLQuery(query)
    expect(cats).toHaveLength(2)
  })

  it('handles multiple tag filters on one line (AND condition)', () => {
    const cats = parseOverpassQLQuery('nwr["amenity"="recycling"]["recycling_type"="container"]({{bbox}});')
    expect(cats[0].conditions).toHaveLength(2)
  })

  it('skips comment lines', () => {
    const cats = parseOverpassQLQuery('// this is a comment\nnode["highway"="stop"]({{bbox}});')
    expect(cats).toHaveLength(1)
  })

  it('skips lines without tag filters', () => {
    const cats = parseOverpassQLQuery('node({{bbox}});')
    expect(cats).toHaveLength(0)
  })

  it('returns empty for empty input', () => {
    expect(parseOverpassQLQuery('')).toEqual([])
  })
})

describe('featureMatchesCategory()', () => {
  const feature = {
    type: 'Feature',
    properties: { amenity: 'parking', highway: 'residential', capacity: '50' },
    geometry: null,
  }

  it('matches an exists condition', () => {
    const cat = { conditions: [{ key: 'amenity', value: null, type: 'exists' }] }
    expect(featureMatchesCategory(feature, cat)).toBe(true)
  })

  it('rejects exists condition when key absent', () => {
    const cat = { conditions: [{ key: 'name', value: null, type: 'exists' }] }
    expect(featureMatchesCategory(feature, cat)).toBe(false)
  })

  it('matches an eq condition', () => {
    const cat = { conditions: [{ key: 'amenity', value: 'parking', type: 'eq' }] }
    expect(featureMatchesCategory(feature, cat)).toBe(true)
  })

  it('rejects eq condition with wrong value', () => {
    const cat = { conditions: [{ key: 'amenity', value: 'bench', type: 'eq' }] }
    expect(featureMatchesCategory(feature, cat)).toBe(false)
  })

  it('requires ALL conditions to match (AND logic)', () => {
    const cat = {
      conditions: [
        { key: 'amenity', value: 'parking', type: 'eq' },
        { key: 'name', value: null, type: 'exists' },  // absent
      ]
    }
    expect(featureMatchesCategory(feature, cat)).toBe(false)
  })
})

describe('buildRows()', () => {
  const features = [
    { type: 'Feature', properties: { amenity: 'parking' }, geometry: { type: 'Polygon' } },
    { type: 'Feature', properties: { amenity: 'bench' }, geometry: { type: 'Point' } },
    { type: 'Feature', properties: { highway: 'road' }, geometry: { type: 'LineString' } },
  ]

  it('builds rows for matching categories', () => {
    const cats = parseWizardQuery('amenity=parking')
    const rows = buildRows(features, cats)
    expect(rows.some((r) => r.count === 1)).toBe(true)
  })

  it('creates a (none) row for unmatched category', () => {
    const cats = parseWizardQuery('building')
    const rows = buildRows(features, cats)
    expect(rows.some((r) => r.geomType === '(none)')).toBe(true)
  })

  it('returns empty array for empty features', () => {
    expect(buildRows([], [{ id: 0, label: 'x', conditions: [], mode: 'wizard' }])).toEqual([])
  })

  it('returns empty array for empty categories', () => {
    expect(buildRows(features, [])).toEqual([])
  })
})

describe('buildTagsLabel()', () => {
  it('formats exists condition', () => {
    const cat = { conditions: [{ key: 'highway', value: null, type: 'exists' }] }
    expect(buildTagsLabel(cat)).toBe('highway (exists)')
  })

  it('formats eq condition', () => {
    const cat = { conditions: [{ key: 'amenity', value: 'parking', type: 'eq' }] }
    expect(buildTagsLabel(cat)).toBe('amenity=parking')
  })

  it('joins multiple conditions with comma', () => {
    const cat = {
      conditions: [
        { key: 'amenity', value: 'parking', type: 'eq' },
        { key: 'access', value: null, type: 'exists' },
      ]
    }
    expect(buildTagsLabel(cat)).toBe('amenity=parking, access (exists)')
  })
})

describe('sortRows()', () => {
  const rows = [
    { categoryLabel: 'Parking', tagsLabel: 'amenity=parking', geomType: 'Polygon', count: 5 },
    { categoryLabel: 'Bench', tagsLabel: 'amenity=bench', geomType: 'Point', count: 10 },
    { categoryLabel: 'Road', tagsLabel: 'highway=road', geomType: 'LineString', count: 1 },
  ]

  it('sorts by category asc', () => {
    const sorted = sortRows([...rows], { key: 'category', dir: 'asc' })
    expect(sorted[0].categoryLabel).toBe('Bench')
    expect(sorted[2].categoryLabel).toBe('Road')
  })

  it('sorts by count desc', () => {
    const sorted = sortRows([...rows], { key: 'count', dir: 'desc' })
    expect(sorted[0].count).toBe(10)
    expect(sorted[2].count).toBe(1)
  })
})
