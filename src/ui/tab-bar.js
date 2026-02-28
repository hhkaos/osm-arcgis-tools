/**
 * Tab bar: handles tab switching and tool mount/unmount lifecycle.
 *
 * Each tool module must export:
 *   mount(container, state)  — renders the tool into container
 *   unmount()                 — cleans up event listeners, timers, etc.
 */
import state from '../state.js'

const tabBar = document.getElementById('tab-bar')
const toolContainer = document.getElementById('tool-container')
const placeholder = document.getElementById('tool-placeholder')

// Lazy-loaded tool modules keyed by data-tool attribute value
const TOOL_MODULES = {
  'inspect-geometry': () => import('../tools/inspect-geometry/ui.js'),
  'geometry-filter': () => import('../tools/geometry-filter/ui.js'),
  'feature-explorer': () => import('../tools/feature-explorer/ui.js'),
  'attribute-faker': () => import('../tools/attribute-faker/ui.js'),
  'osm-to-arcgis': () => import('../tools/osm-to-arcgis/ui.js'),
  'property-editor': () => import('../tools/property-editor/ui.js'),
  'geojson-to-overpass': () => import('../tools/geojson-to-overpass/ui.js'),
}

let currentTool = null      // { id, module }
let activeTabBtn = null

async function switchTo(toolId) {
  if (currentTool?.id === toolId) return

  // Unmount current tool
  if (currentTool) {
    currentTool.module.unmount()
    toolContainer.innerHTML = ''
  }

  // Update tab active state
  if (activeTabBtn) activeTabBtn.classList.remove('active')
  activeTabBtn = tabBar.querySelector(`[data-tool="${toolId}"]`)
  if (activeTabBtn) activeTabBtn.classList.add('active')

  placeholder.style.display = 'none'

  const loader = TOOL_MODULES[toolId]
  if (!loader) return

  const mod = await loader()
  currentTool = { id: toolId, module: mod }
  mod.mount(toolContainer, state)
}

/**
 * Called by state subscriber when GeoJSON is loaded/changed.
 * Re-mounts the active tool so it picks up the new data.
 */
function remountActive() {
  if (!currentTool) return
  currentTool.module.unmount()
  toolContainer.innerHTML = ''
  currentTool.module.mount(toolContainer, state)
}

export function initTabBar() {
  tabBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn')
    if (!btn) return
    switchTo(btn.dataset.tool)
  })

  // Re-mount on state load (new file uploaded)
  state.subscribe((s) => {
    // Only remount on load events (not on update/undo, which tools handle themselves)
    if (currentTool && s._loadEvent) remountActive()
  })
}

export { switchTo, remountActive }
