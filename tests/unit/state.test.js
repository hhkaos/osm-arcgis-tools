import { describe, it, expect, beforeEach } from 'vitest'

// Re-import a fresh state for each test by resetting via load()
// Note: state is a singleton, so we reset between tests.
import state from '../../src/state.js'

const SAMPLE = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { a: 1 }, geometry: null }] }
const SAMPLE2 = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { b: 2 }, geometry: null }] }

beforeEach(() => {
  // Reset to clean state
  state.load(null, null)
  // Clear isModified and history side effect of load(null)
  state.geojsonData = null
  state.filename = null
  state.isModified = false
  // Clear history by doing a dummy load
  state.load(SAMPLE, 'test.geojson')
  state.isModified = false
  // Now undo stack is empty (load clears history)
})

describe('state.load()', () => {
  it('sets geojsonData and filename', () => {
    state.load(SAMPLE, 'demo.geojson')
    expect(state.geojsonData).toEqual(SAMPLE)
    expect(state.filename).toBe('demo.geojson')
  })

  it('clears undo history', () => {
    state.update(SAMPLE2, 'step 1')
    state.load(SAMPLE, 'new.geojson')
    expect(state.canUndo()).toBe(false)
  })

  it('resets isModified to false', () => {
    state.update(SAMPLE2, 'step 1')
    expect(state.isModified).toBe(true)
    state.load(SAMPLE, 'reset.geojson')
    expect(state.isModified).toBe(false)
  })
})

describe('state.update()', () => {
  it('updates geojsonData', () => {
    state.update(SAMPLE2, 'applied filter')
    expect(state.geojsonData).toEqual(SAMPLE2)
  })

  it('sets isModified to true', () => {
    state.update(SAMPLE2, 'applied filter')
    expect(state.isModified).toBe(true)
  })

  it('saves previous state for undo', () => {
    state.update(SAMPLE2, 'step 1')
    expect(state.canUndo()).toBe(true)
    expect(state.getLastActionLabel()).toBe('step 1')
  })

  it('stacks multiple snapshots', () => {
    const s3 = { type: 'FeatureCollection', features: [] }
    state.update(SAMPLE2, 'step 1')
    state.update(s3, 'step 2')
    expect(state.getHistoryCount()).toBe(2)
    expect(state.getLastActionLabel()).toBe('step 2')
  })
})

describe('state.undo()', () => {
  it('reverts geojsonData to previous version', () => {
    state.update(SAMPLE2, 'step 1')
    state.undo()
    expect(state.geojsonData).toEqual(SAMPLE)
  })

  it('is a no-op when history is empty', () => {
    state.undo() // no-op
    expect(state.geojsonData).toEqual(SAMPLE)
  })

  it('canUndo returns false after all undos', () => {
    state.update(SAMPLE2, 'step 1')
    state.undo()
    expect(state.canUndo()).toBe(false)
  })
})

describe('state.subscribe()', () => {
  it('calls subscriber on load', () => {
    let called = 0
    const fn = () => called++
    state.subscribe(fn)
    state.load(SAMPLE, 'x.geojson')
    expect(called).toBeGreaterThan(0)
    state.unsubscribe(fn)
  })

  it('calls subscriber on update', () => {
    let called = 0
    const fn = () => called++
    state.subscribe(fn)
    state.update(SAMPLE2, 'x')
    expect(called).toBeGreaterThan(0)
    state.unsubscribe(fn)
  })

  it('calls subscriber on undo', () => {
    state.update(SAMPLE2, 'x')
    let called = 0
    const fn = () => called++
    state.subscribe(fn)
    state.undo()
    expect(called).toBeGreaterThan(0)
    state.unsubscribe(fn)
  })

  it('stops calling after unsubscribe', () => {
    let called = 0
    const fn = () => called++
    state.subscribe(fn)
    state.unsubscribe(fn)
    state.update(SAMPLE2, 'x')
    expect(called).toBe(0)
  })
})
