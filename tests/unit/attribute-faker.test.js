import { describe, it, expect } from 'vitest'
import {
  extractAttributeNames,
  buildDefaultConfig,
  parseValue,
  generateValue,
  applyFakerChanges,
  FAKER_MODULES,
} from '../../src/tools/attribute-faker/logic.js'

const FC = (features) => ({ type: 'FeatureCollection', features })
const F = (props) => ({ type: 'Feature', properties: props, geometry: null })

describe('FAKER_MODULES', () => {
  it('contains expected namespaces', () => {
    expect(FAKER_MODULES).toHaveProperty('person')
    expect(FAKER_MODULES).toHaveProperty('location')
    expect(FAKER_MODULES).toHaveProperty('internet')
    expect(FAKER_MODULES).toHaveProperty('commerce')
  })

  it('each namespace has at least one method', () => {
    for (const [ns, methods] of Object.entries(FAKER_MODULES)) {
      expect(methods.length, `namespace ${ns} has no methods`).toBeGreaterThan(0)
    }
  })
})

describe('extractAttributeNames()', () => {
  it('collects attribute names from all features', () => {
    const fc = FC([F({ a: 1, b: 2 }), F({ b: 3, c: 4 })])
    const names = extractAttributeNames(fc)
    expect(names).toContain('a')
    expect(names).toContain('b')
    expect(names).toContain('c')
  })

  it('returns empty array for empty FeatureCollection', () => {
    expect(extractAttributeNames(FC([]))).toEqual([])
  })
})

describe('buildDefaultConfig()', () => {
  it('returns an object with required keys', () => {
    const cfg = buildDefaultConfig()
    expect(cfg).toHaveProperty('method')
    expect(cfg).toHaveProperty('valueType')
    expect(cfg).toHaveProperty('behavior')
    expect(cfg).toHaveProperty('fakerModule')
    expect(cfg).toHaveProperty('fakerMethod')
  })
})

describe('parseValue()', () => {
  it('parses number', () => expect(parseValue('3.14', 'number')).toBeCloseTo(3.14))
  it('parses boolean true', () => expect(parseValue('true', 'boolean')).toBe(true))
  it('parses boolean false', () => expect(parseValue('false', 'boolean')).toBe(false))
  it('parses null', () => expect(parseValue('anything', 'null')).toBeNull())
  it('parses string', () => expect(parseValue(42, 'string')).toBe('42'))
  it('parses JSON object', () => expect(parseValue('{"x":1}', 'object')).toEqual({ x: 1 }))
  it('parses JSON array', () => expect(parseValue('[1,2]', 'array')).toEqual([1, 2]))
  it('returns raw value on invalid JSON for object type', () => {
    expect(parseValue('not-json', 'object')).toBe('not-json')
  })
})

describe('generateValue()', () => {
  it('picks a value from the manual list', () => {
    const cfg = buildDefaultConfig()
    cfg.method = 'manual'
    cfg.manualValues = 'A,B,C'
    cfg.valueType = 'string'
    const val = generateValue(cfg)
    expect(['A', 'B', 'C']).toContain(val)
  })

  it('returns null for empty manual list', () => {
    const cfg = buildDefaultConfig()
    cfg.method = 'manual'
    cfg.manualValues = ''
    expect(generateValue(cfg)).toBeNull()
  })

  it('generates a value using faker', () => {
    const cfg = buildDefaultConfig()
    cfg.method = 'faker'
    cfg.fakerModule = 'person'
    cfg.fakerMethod = 'firstName'
    cfg.valueType = 'string'
    const val = generateValue(cfg)
    expect(typeof val).toBe('string')
    expect(val.length).toBeGreaterThan(0)
  })

  it('returns null for an unknown faker method', () => {
    const cfg = buildDefaultConfig()
    cfg.method = 'faker'
    cfg.fakerModule = 'person'
    cfg.fakerMethod = 'nonExistentMethod_xyz'
    expect(generateValue(cfg)).toBeNull()
  })
})

describe('applyFakerChanges()', () => {
  const fc = FC([F({ name: 'Alice', age: 30 }), F({ name: 'Bob' })])

  it('overwrites a property on all features', () => {
    const configsData = {
      name: { method: 'manual', manualValues: 'Carlos', valueType: 'string', behavior: 'overwrite' }
    }
    const result = applyFakerChanges(fc, ['name'], configsData)
    expect(result.features[0].properties.name).toBe('Carlos')
    expect(result.features[1].properties.name).toBe('Carlos')
  })

  it('overwrite_if_empty only fills empty values', () => {
    const fcData = FC([F({ name: 'Alice' }), F({ name: '' })])
    const configsData = {
      name: { method: 'manual', manualValues: 'Default', valueType: 'string', behavior: 'overwrite_if_empty' }
    }
    const result = applyFakerChanges(fcData, ['name'], configsData)
    expect(result.features[0].properties.name).toBe('Alice')
    expect(result.features[1].properties.name).toBe('Default')
  })

  it('ignore keeps original values', () => {
    const configsData = {
      name: { method: 'manual', manualValues: 'X', valueType: 'string', behavior: 'ignore' }
    }
    const result = applyFakerChanges(fc, ['name'], configsData)
    expect(result.features[0].properties.name).toBe('Alice')
    expect(result.features[1].properties.name).toBe('Bob')
  })

  it('set_null sets property to null', () => {
    const configsData = {
      name: { method: 'manual', manualValues: 'X', valueType: 'string', behavior: 'set_null' }
    }
    const result = applyFakerChanges(fc, ['name'], configsData)
    expect(result.features[0].properties.name).toBeNull()
  })

  it('does not mutate the original GeoJSON', () => {
    const configsData = {
      name: { method: 'manual', manualValues: 'Z', valueType: 'string', behavior: 'overwrite' }
    }
    applyFakerChanges(fc, ['name'], configsData)
    expect(fc.features[0].properties.name).toBe('Alice')
  })
})
