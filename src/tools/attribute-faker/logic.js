/**
 * Pure data-transformation functions for the Attribute Faker tool.
 * Uses @faker-js/faker.
 * Zero DOM dependencies.
 */
import { faker } from '@faker-js/faker'

/**
 * Faker module/method catalog.
 * Maps UI-visible namespace → array of method names available.
 * Migrated from faker v3 → @faker-js/faker latest.
 */
export const FAKER_MODULES = {
  person: ['fullName', 'firstName', 'lastName', 'jobTitle', 'gender', 'prefix', 'suffix'],
  location: ['city', 'streetAddress', 'streetName', 'country', 'state', 'zipCode', 'latitude', 'longitude', 'countryCode'],
  internet: ['email', 'userName', 'url', 'domainName', 'ip', 'ipv6', 'password', 'userAgent'],
  commerce: ['productName', 'price', 'department', 'productDescription', 'product', 'color'],
  company: ['name', 'catchPhrase', 'buzzPhrase'],
  lorem: ['word', 'words', 'sentence', 'paragraph', 'text', 'slug'],
  phone: ['number'],
  finance: ['amount', 'currencyCode', 'currencyName', 'iban', 'bic', 'accountNumber'],
  date: ['past', 'future', 'recent', 'month', 'weekday'],
  number: ['int', 'float', 'binary', 'octal', 'hex'],
  string: ['uuid', 'alpha', 'alphanumeric', 'nanoid'],
}

/**
 * Collect all unique property keys across features.
 * Returns an array of attribute names.
 *
 * @param {object} geojson - GeoJSON FeatureCollection
 * @returns {string[]}
 */
export function extractAttributeNames(geojson) {
  const attrs = new Set()
  for (const f of geojson?.features ?? []) {
    for (const key of Object.keys(f?.properties ?? {})) {
      attrs.add(key)
    }
  }
  return Array.from(attrs)
}

/**
 * Build a default config object for an attribute.
 * @returns {object}
 */
export function buildDefaultConfig() {
  return {
    method: 'manual',           // 'manual' | 'faker'
    valueType: 'string',        // 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array'
    manualValues: '',           // comma/newline-separated list
    fakerModule: 'person',
    fakerMethod: 'fullName',
    behavior: 'ignore',         // 'overwrite' | 'overwrite_if_empty' | 'ignore' | 'set_null'
  }
}

/**
 * Convert a string value to the specified type.
 * @param {any} value
 * @param {string} type - 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array'
 * @returns {any}
 */
export function parseValue(value, type) {
  if (type === 'number') return parseFloat(value)
  if (type === 'boolean') return value === 'true' || value === true
  if (type === 'null') return null
  if (type === 'object' || type === 'array') {
    try { return JSON.parse(value) } catch { return value }
  }
  return String(value)
}

/**
 * Generate a single value from a config object.
 * Calls faker for 'faker' method; picks randomly from manual list for 'manual'.
 *
 * @param {object} config
 * @returns {any}
 */
export function generateValue(config) {
  if (config.method === 'manual') {
    const values = config.manualValues
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean)
    if (!values.length) return null
    const randomVal = values[Math.floor(Math.random() * values.length)]
    return parseValue(randomVal, config.valueType)
  }

  // Faker method
  try {
    const moduleObj = faker[config.fakerModule]
    if (moduleObj && typeof moduleObj[config.fakerMethod] === 'function') {
      const val = moduleObj[config.fakerMethod]()
      return parseValue(val, config.valueType)
    }
  } catch (err) {
    console.error('Faker error:', err)
  }
  return null
}

/**
 * Apply faker configurations to a GeoJSON FeatureCollection.
 * Returns a new GeoJSON object (deep clone of input).
 *
 * @param {object} geojson - GeoJSON FeatureCollection
 * @param {string[]} attributesList - ordered list of attribute names to process
 * @param {Record<string, object>} configsData - map of attrName → config
 * @returns {object} new GeoJSON with faked properties applied
 */
export function applyFakerChanges(geojson, attributesList, configsData) {
  const updated = JSON.parse(JSON.stringify(geojson))

  if (!updated.features) return updated

  for (const feature of updated.features) {
    const oldProps = feature.properties ?? {}
    const newProps = { ...oldProps }

    for (const attr of attributesList) {
      const cfg = configsData[attr]
      if (!cfg) continue

      const behavior = cfg.behavior || 'overwrite'
      const current = newProps[attr]

      if (behavior === 'ignore') continue
      if (behavior === 'set_null') {
        newProps[attr] = null
      } else if (behavior === 'overwrite_if_empty') {
        if (current === undefined || current === null || current === '') {
          newProps[attr] = generateValue(cfg)
        }
      } else {
        // default: overwrite
        newProps[attr] = generateValue(cfg)
      }
    }

    feature.properties = newProps
  }

  return updated
}
