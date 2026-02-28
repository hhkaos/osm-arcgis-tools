/**
 * Shared GeoJSON state singleton with snapshot-based undo.
 *
 * API:
 *   state.geojsonData   — current working GeoJSON (null if none loaded)
 *   state.filename      — original filename string
 *   state.isModified    — true after any update() call
 *
 *   state.load(geojson, filename)          — initial load, resets history
 *   state.update(geojson, snapshotLabel)   — apply mutation + save undo snapshot
 *   state.undo()                           — revert to previous snapshot
 *   state.getLastActionLabel()             — label of the last applied action
 *   state.canUndo()                        — boolean
 *   state.subscribe(fn)                    — fn(state) called on every change
 *   state.unsubscribe(fn)
 */

const MAX_SNAPSHOTS = 20

const _subscribers = new Set()
const _history = [] // [{label, geojson}] oldest first

const state = {
  geojsonData: null,
  filename: null,
  isModified: false,

  load(geojson, filename) {
    _history.length = 0
    this.geojsonData = geojson
    this.filename = filename
    this.isModified = false
    _notify(this)
  },

  /**
   * Apply a new version of the GeoJSON, saving the current version as an
   * undoable snapshot first.
   *
   * @param {object} newGeojson  - the new GeoJSON to set as working state
   * @param {string} label       - human-readable label for the undo button
   */
  update(newGeojson, label) {
    if (this.geojsonData !== null) {
      if (_history.length >= MAX_SNAPSHOTS) _history.shift()
      _history.push({ label, geojson: structuredClone(this.geojsonData) })
    }
    this.geojsonData = newGeojson
    this.isModified = true
    _notify(this)
  },

  undo() {
    if (_history.length === 0) return
    const snapshot = _history.pop()
    this.geojsonData = snapshot.geojson
    if (_history.length === 0) this.isModified = false
    _notify(this)
  },

  canUndo() {
    return _history.length > 0
  },

  getLastActionLabel() {
    if (_history.length === 0) return null
    return _history[_history.length - 1].label
  },

  getHistoryCount() {
    return _history.length
  },

  subscribe(fn) {
    _subscribers.add(fn)
  },

  unsubscribe(fn) {
    _subscribers.delete(fn)
  },
}

function _notify(s) {
  for (const fn of _subscribers) fn(s)
}

export default state
