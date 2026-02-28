import { describe, it, expect } from 'vitest'
import { detectGeometryTypes, filterByGeometryTypes } from '../../src/tools/geometry-filter/logic.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mixed = JSON.parse(readFileSync(join(__dirname, '../fixtures/sample-mixed.geojson'), 'utf-8'))

describe('detectGeometryTypes()', () => {
  it('detects all geometry types in mixed GeoJSON', () => {
    const types = detectGeometryTypes(mixed)
    expect(types).toContain('Polygon')
    expect(types).toContain('Point')
    expect(types).toContain('LineString')
    expect(types).toContain('MultiPolygon')
  })

  it('returns sorted array', () => {
    const types = detectGeometryTypes(mixed)
    expect(types).toEqual([...types].sort())
  })

  it('returns empty array for empty FeatureCollection', () => {
    expect(detectGeometryTypes({ type: 'FeatureCollection', features: [] })).toEqual([])
  })

  it('returns empty array for null', () => {
    expect(detectGeometryTypes(null)).toEqual([])
  })
})

describe('filterByGeometryTypes()', () => {
  it('removes specified geometry types', () => {
    const filtered = filterByGeometryTypes(mixed, ['Point', 'LineString'])
    const types = detectGeometryTypes(filtered)
    expect(types).not.toContain('Point')
    expect(types).not.toContain('LineString')
    expect(types).toContain('Polygon')
    expect(types).toContain('MultiPolygon')
  })

  it('returns all features when typesToRemove is empty', () => {
    const filtered = filterByGeometryTypes(mixed, [])
    expect(filtered.features.length).toBe(mixed.features.length)
  })

  it('returns a FeatureCollection object', () => {
    const filtered = filterByGeometryTypes(mixed, ['Point'])
    expect(filtered.type).toBe('FeatureCollection')
    expect(Array.isArray(filtered.features)).toBe(true)
  })

  it('does not mutate the original', () => {
    const originalCount = mixed.features.length
    filterByGeometryTypes(mixed, ['Point'])
    expect(mixed.features.length).toBe(originalCount)
  })

  it('returns empty features when all types removed', () => {
    const filtered = filterByGeometryTypes(mixed, ['Polygon', 'Point', 'LineString', 'MultiPolygon'])
    expect(filtered.features.length).toBe(0)
  })
})
