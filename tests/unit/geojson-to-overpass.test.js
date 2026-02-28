import { describe, it, expect } from 'vitest'
import { countVertices, geometryToOverpassPoly, arraysEqual, extractPropertyKeys } from '../../src/tools/geojson-to-overpass/logic.js'

describe('countVertices()', () => {
  it('returns 1 for a Point', () => {
    expect(countVertices({ type: 'Point', coordinates: [0, 0] })).toBe(1)
  })

  it('counts MultiPoint', () => {
    expect(countVertices({ type: 'MultiPoint', coordinates: [[0,0],[1,1],[2,2]] })).toBe(3)
  })

  it('counts LineString', () => {
    expect(countVertices({ type: 'LineString', coordinates: [[0,0],[1,1],[2,2],[3,3]] })).toBe(4)
  })

  it('counts Polygon rings', () => {
    const geom = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]], [[0.1,0.1],[0.5,0.1],[0.5,0.5],[0.1,0.1]]] }
    expect(countVertices(geom)).toBe(8)
  })

  it('counts MultiPolygon', () => {
    const geom = {
      type: 'MultiPolygon',
      coordinates: [
        [[[0,0],[1,0],[1,1],[0,0]]],
        [[[2,2],[3,2],[3,3],[2,2]]]
      ]
    }
    expect(countVertices(geom)).toBe(8)
  })

  it('returns 0 for null geometry', () => {
    expect(countVertices(null)).toBe(0)
  })

  it('handles GeometryCollection recursively', () => {
    const geom = {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Point', coordinates: [0, 0] },
        { type: 'LineString', coordinates: [[0,0],[1,1]] }
      ]
    }
    expect(countVertices(geom)).toBe(3)
  })
})

describe('geometryToOverpassPoly()', () => {
  it('converts a Polygon to Overpass poly format', () => {
    const geom = {
      type: 'Polygon',
      coordinates: [[[-3.707407, 40.415384], [-3.706555, 40.415431], [-3.706546, 40.415005], [-3.707394, 40.414959], [-3.707407, 40.415384]]]
    }
    const result = geometryToOverpassPoly(geom)
    expect(result).toMatch(/^\(poly:"/)
    expect(result).toContain('40.415384 -3.707407')
  })

  it('converts a MultiPolygon using first polygon outer ring', () => {
    const geom = {
      type: 'MultiPolygon',
      coordinates: [[[[-3.71, 40.41], [-3.70, 40.41], [-3.70, 40.42], [-3.71, 40.41]]]]
    }
    const result = geometryToOverpassPoly(geom)
    expect(result).toMatch(/^\(poly:"/)
  })

  it('returns null for a Point', () => {
    expect(geometryToOverpassPoly({ type: 'Point', coordinates: [0, 0] })).toBeNull()
  })

  it('returns null for null geometry', () => {
    expect(geometryToOverpassPoly(null)).toBeNull()
  })

  it('closes the ring if not already closed', () => {
    const geom = {
      type: 'Polygon',
      coordinates: [[[-3.71, 40.41], [-3.70, 40.41], [-3.70, 40.42]]]  // not closed
    }
    const result = geometryToOverpassPoly(geom)
    expect(result).not.toBeNull()
  })
})

describe('arraysEqual()', () => {
  it('returns true for equal arrays', () => {
    expect(arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true)
  })

  it('returns false for different lengths', () => {
    expect(arraysEqual([1, 2], [1, 2, 3])).toBe(false)
  })

  it('returns false for different values', () => {
    expect(arraysEqual([1, 2, 3], [1, 2, 4])).toBe(false)
  })

  it('returns false for non-arrays', () => {
    expect(arraysEqual(null, [1])).toBe(false)
  })
})

describe('extractPropertyKeys()', () => {
  it('collects all property keys', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { a: 1, b: 2 }, geometry: null },
        { type: 'Feature', properties: { b: 3, c: 4 }, geometry: null },
      ]
    }
    expect(extractPropertyKeys(geojson)).toEqual(['a', 'b', 'c'])
  })

  it('returns empty array for empty FeatureCollection', () => {
    expect(extractPropertyKeys({ type: 'FeatureCollection', features: [] })).toEqual([])
  })
})
