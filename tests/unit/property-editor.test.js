import { describe, it, expect } from 'vitest'
import {
  getAllPropertyNames,
  getTotalPages,
  deletePropertyFromAll,
  deletePropertiesFromAll,
  addPropertyToAll,
  renamePropertyOnAll,
  applyBulkEditToAll,
  deleteFeatureAtIndex,
  coerceValueToType,
  prepareDownloadData,
  computePropertyTypeStats,
} from '../../src/tools/property-editor/logic.js'

const FC = (features) => ({ type: 'FeatureCollection', features })
const F = (props) => ({ type: 'Feature', properties: props, geometry: null })

describe('getAllPropertyNames()', () => {
  it('returns all unique property names', () => {
    const fc = FC([F({ a: 1, b: 2 }), F({ b: 3, c: 4 })])
    const names = getAllPropertyNames(fc)
    expect(names).toContain('a')
    expect(names).toContain('b')
    expect(names).toContain('c')
    expect(names.length).toBe(3)
  })

  it('returns empty array for empty FeatureCollection', () => {
    expect(getAllPropertyNames(FC([]))).toEqual([])
  })
})

describe('getTotalPages()', () => {
  it('calculates correct page count', () => {
    expect(getTotalPages(10, 5)).toBe(2)
    expect(getTotalPages(11, 5)).toBe(3)
    expect(getTotalPages(0, 5)).toBe(0)
    expect(getTotalPages(5, 5)).toBe(1)
  })
})

describe('deletePropertyFromAll()', () => {
  it('removes property from all features', () => {
    const fc = FC([F({ a: 1, b: 2 }), F({ a: 3, b: 4 })])
    const result = deletePropertyFromAll(fc, 'a')
    expect(result.features[0].properties.a).toBeUndefined()
    expect(result.features[0].properties.b).toBe(2)
  })

  it('does not mutate the original', () => {
    const fc = FC([F({ a: 1 })])
    deletePropertyFromAll(fc, 'a')
    expect(fc.features[0].properties.a).toBe(1)
  })

  it('handles features that lack the property', () => {
    const fc = FC([F({ a: 1 }), F({ b: 2 })])  // second feature has no 'a'
    expect(() => deletePropertyFromAll(fc, 'a')).not.toThrow()
  })
})

describe('deletePropertiesFromAll()', () => {
  it('removes multiple properties', () => {
    const fc = FC([F({ a: 1, b: 2, c: 3 })])
    const result = deletePropertiesFromAll(fc, ['a', 'b'])
    expect(result.features[0].properties).toEqual({ c: 3 })
  })
})

describe('addPropertyToAll()', () => {
  it('adds property with default value to all features', () => {
    const fc = FC([F({ a: 1 }), F({ b: 2 })])
    const result = addPropertyToAll(fc, 'newProp', 'default')
    expect(result.features[0].properties.newProp).toBe('default')
    expect(result.features[1].properties.newProp).toBe('default')
  })

  it('does not mutate the original', () => {
    const fc = FC([F({ a: 1 })])
    addPropertyToAll(fc, 'x', 'y')
    expect(fc.features[0].properties.x).toBeUndefined()
  })
})

describe('renamePropertyOnAll()', () => {
  it('renames property on all features', () => {
    const fc = FC([F({ old: 'val1' }), F({ old: 'val2' })])
    const result = renamePropertyOnAll(fc, 'old', 'newName')
    expect(result.features[0].properties.newName).toBe('val1')
    expect(result.features[0].properties.old).toBeUndefined()
    expect(result.features[1].properties.newName).toBe('val2')
  })

  it('handles features that lack the old property', () => {
    const fc = FC([F({ other: 1 })])
    const result = renamePropertyOnAll(fc, 'missing', 'newName')
    expect(result.features[0].properties.newName).toBeUndefined()
  })
})

describe('applyBulkEditToAll()', () => {
  it('sets all features to the same value', () => {
    const fc = FC([F({ a: 1 }), F({ a: 2 })])
    const result = applyBulkEditToAll(fc, 'a', 'BULK')
    expect(result.features[0].properties.a).toBe('BULK')
    expect(result.features[1].properties.a).toBe('BULK')
  })
})

describe('deleteFeatureAtIndex()', () => {
  it('removes feature at given index', () => {
    const fc = FC([F({ a: 1 }), F({ b: 2 }), F({ c: 3 })])
    const result = deleteFeatureAtIndex(fc, 1)
    expect(result.features).toHaveLength(2)
    expect(result.features[0].properties.a).toBe(1)
    expect(result.features[1].properties.c).toBe(3)
  })

  it('does not mutate the original', () => {
    const fc = FC([F({ a: 1 }), F({ b: 2 })])
    deleteFeatureAtIndex(fc, 0)
    expect(fc.features).toHaveLength(2)
  })
})

describe('coerceValueToType()', () => {
  it('coerces to String', () => {
    expect(coerceValueToType(42, 'String')).toBe('42')
    expect(coerceValueToType(null, 'String')).toBe('')
  })

  it('coerces to Number', () => {
    expect(coerceValueToType('3.14', 'Number')).toBeCloseTo(3.14)
    expect(coerceValueToType('not-a-num', 'Number')).toBeNull()
  })

  it('coerces to Boolean', () => {
    expect(coerceValueToType('true', 'Boolean')).toBe(true)
    expect(coerceValueToType('false', 'Boolean')).toBe(false)
    expect(coerceValueToType('yes', 'Boolean')).toBe(true)
    expect(coerceValueToType('no', 'Boolean')).toBe(false)
    expect(coerceValueToType(1, 'Boolean')).toBe(true)
    expect(coerceValueToType(0, 'Boolean')).toBe(false)
  })

  it('coerces to Null', () => {
    expect(coerceValueToType('anything', 'Null')).toBeNull()
  })

  it('coerces to Array', () => {
    expect(coerceValueToType('x', 'Array')).toEqual(['x'])
    expect(coerceValueToType([1, 2], 'Array')).toEqual([1, 2])
  })

  it('coerces to Object from JSON string', () => {
    expect(coerceValueToType('{"x":1}', 'Object')).toEqual({ x: 1 })
  })

  it('wraps non-object in {value} for Object', () => {
    expect(coerceValueToType('hello', 'Object')).toEqual({ value: 'hello' })
  })

  it('returns value unchanged for unknown type', () => {
    expect(coerceValueToType('x', 'Ignore')).toBe('x')
  })
})

describe('prepareDownloadData()', () => {
  it('coerces types and removes empty strings', () => {
    const fc = FC([F({ count: '5', name: '' })])
    const typeSelections = { count: 'Number' }
    const result = prepareDownloadData(fc, typeSelections)
    expect(result.features[0].properties.count).toBe(5)
    expect(result.features[0].properties.name).toBeUndefined()
  })

  it('ignores properties with Ignore type', () => {
    const fc = FC([F({ count: '5' })])
    const result = prepareDownloadData(fc, { count: 'Ignore' })
    expect(result.features[0].properties.count).toBe('5')
  })
})

describe('computePropertyTypeStats()', () => {
  it('counts type distribution', () => {
    const fc = FC([
      F({ x: 'str' }),
      F({ x: 42 }),
      F({ x: true }),
      F({ x: null }),
      F({}),  // missing
    ])
    const stats = computePropertyTypeStats(fc, 'x')
    expect(stats.String).toBe(1)
    expect(stats.Number).toBe(1)
    expect(stats.Boolean).toBe(1)
    expect(stats.Null).toBe(1)
    expect(stats.Missing).toBe(1)
  })
})
