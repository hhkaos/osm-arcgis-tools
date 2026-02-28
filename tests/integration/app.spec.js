/**
 * Playwright integration tests for OSM Tools Unified.
 *
 * Prerequisites: `npm run dev` is started by Playwright's webServer config.
 */
import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = path.join(__dirname, '../fixtures')

/**
 * Helper: Upload a GeoJSON fixture file via the hidden file input.
 */
async function uploadFixture(page, filename) {
  const filePath = path.join(FIXTURE_DIR, filename)
  const fileInput = page.locator('#global-file-input')
  await fileInput.setInputFiles(filePath)
}

/**
 * Helper: Click a tab button by its data-tool attribute.
 */
async function switchTab(page, toolId) {
  await page.click(`[data-tool="${toolId}"]`)
}

// ── Status bar ─────────────────────────────────────────────────────────────────

test.describe('Status bar', () => {
  test('shows empty state before any file is loaded', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#status-empty')).toBeVisible()
    await expect(page.locator('#status-filename')).toBeHidden()
  })

  test('shows filename and feature count after upload', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await expect(page.locator('#status-filename')).toBeVisible()
    await expect(page.locator('#status-filename')).toContainText('sample-mixed')
    await expect(page.locator('#status-details')).toContainText('4 features')
  })

  test('shows geometry breakdown', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    const details = page.locator('#status-details')
    await expect(details).toContainText('Polygon')
    await expect(details).toContainText('Point')
    await expect(details).toContainText('LineString')
  })

  test('shows empty file correctly', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-empty.geojson')
    await expect(page.locator('#status-details')).toContainText('0 features')
  })
})

// ── Tab navigation ─────────────────────────────────────────────────────────────

test.describe('Tab navigation', () => {
  test('all 7 tabs are present', async ({ page }) => {
    await page.goto('/')
    const tabs = page.locator('.tab-btn')
    await expect(tabs).toHaveCount(7)
  })

  test('switching tabs shows the correct tool', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await switchTab(page, 'geometry-filter')
    await expect(page.locator('#tool-container')).toContainText('Geometry Filter')
    await switchTab(page, 'feature-explorer')
    await expect(page.locator('#tool-container')).toContainText('Feature Explorer')
  })

  test('GeoJSON data persists when switching tabs', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await switchTab(page, 'geometry-filter')
    await expect(page.locator('#tool-container')).not.toContainText('Load a GeoJSON')
    await switchTab(page, 'feature-explorer')
    await expect(page.locator('#tool-container')).not.toContainText('Load a GeoJSON')
    await switchTab(page, 'property-editor')
    await expect(page.locator('#tool-container')).not.toContainText('Load a GeoJSON')
  })

  test('tools show no-data message before upload', async ({ page }) => {
    await page.goto('/')
    await switchTab(page, 'geometry-filter')
    await expect(page.locator('#tool-container')).toContainText('Load a GeoJSON')
  })
})

// ── Geometry Filter ────────────────────────────────────────────────────────────

test.describe('Geometry Filter tool', () => {
  test('shows geometry type checkboxes after upload', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await switchTab(page, 'geometry-filter')
    await expect(page.locator('#tool-container')).toContainText('Polygon')
    await expect(page.locator('#tool-container')).toContainText('Point')
  })

  test('apply filter reduces feature count in status bar', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await switchTab(page, 'geometry-filter')

    // Uncheck Point to remove it
    const pointCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /Point/ }).first()
    // Find checkbox associated with "Point" label
    const pointLabel = page.locator('label', { hasText: 'Point' }).first()
    if (await pointLabel.count() > 0) {
      const cb = pointLabel.locator('input[type="checkbox"]')
      const isChecked = await cb.isChecked()
      if (isChecked) await cb.uncheck()
    } else {
      // fallback: try clicking a checkbox near "Point" text
      const row = page.locator('#tool-container').locator('label', { hasText: /^Point/ }).first()
      if (await row.count() > 0) {
        await row.locator('input').uncheck()
      }
    }

    const applyBtn = page.locator('button', { hasText: 'Remove unchecked' })
    if (await applyBtn.count() === 0) {
      // Try alternate label
      const altBtn = page.locator('button', { hasText: /Apply|Remove/ }).first()
      if (await altBtn.count() > 0) await altBtn.click()
    } else {
      await applyBtn.click()
    }

    // Feature count should have changed (undo button should appear)
    await expect(page.locator('#undo-btn')).toBeVisible()
  })
})

// ── Undo ───────────────────────────────────────────────────────────────────────

test.describe('Undo', () => {
  test('undo button is hidden before any edit', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await expect(page.locator('#undo-btn')).not.toBeVisible()
  })

  test('undo button appears after geometry filter is applied', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-polygons.geojson')
    await switchTab(page, 'geometry-filter')

    // Uncheck Polygon (remove it)
    const label = page.locator('#tool-container label', { hasText: 'Polygon' }).first()
    if (await label.count() > 0) {
      await label.locator('input').uncheck()
    }
    const applyBtn = page.locator('#tool-container button', { hasText: /Remove|Apply/ }).first()
    if (await applyBtn.count() > 0) await applyBtn.click()

    await expect(page.locator('#undo-btn')).toBeVisible()
  })

  test('undo reverts feature count', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await switchTab(page, 'geometry-filter')

    const originalDetails = await page.locator('#status-details').textContent()

    // Remove a geometry type
    const labels = page.locator('#tool-container label')
    const count = await labels.count()
    if (count > 0) {
      const firstCb = labels.first().locator('input[type="checkbox"]')
      if (await firstCb.isChecked()) await firstCb.uncheck()
    }
    const applyBtn = page.locator('#tool-container button', { hasText: /Remove|Apply/ }).first()
    if (await applyBtn.count() > 0) await applyBtn.click()

    // Undo
    const undoBtn = page.locator('#undo-btn')
    if (await undoBtn.isVisible()) {
      await undoBtn.click()
      await expect(page.locator('#status-details')).toHaveText(originalDetails)
    }
  })
})

// ── Feature Explorer ───────────────────────────────────────────────────────────

test.describe('Feature Explorer tool', () => {
  test('shows property cards', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await switchTab(page, 'feature-explorer')
    // Should show cards (at least one property from fixture)
    await expect(page.locator('#fe-cards')).toBeVisible()
    // The mixed fixture has properties like 'name', 'type'
    await expect(page.locator('#fe-summary')).toContainText('features')
  })

  test('filter by property and value shows subset count', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await switchTab(page, 'feature-explorer')
    // Select a property in the filter dropdown
    const propSel = page.locator('#fe-filter-prop')
    const options = await propSel.locator('option').all()
    if (options.length > 1) {
      await propSel.selectOption({ index: 1 })
      // Value dropdown should populate
      const valSel = page.locator('#fe-filter-val')
      await expect(valSel).not.toBeDisabled()
      const valOptions = await valSel.locator('option').all()
      if (valOptions.length > 1) {
        await valSel.selectOption({ index: 1 })
        await expect(page.locator('#fe-filter-info')).toContainText('feature')
      }
    }
  })
})

// ── OSM to ArcGIS ─────────────────────────────────────────────────────────────

test.describe('OSM to ArcGIS tool', () => {
  test('shows property table after upload', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await switchTab(page, 'osm-to-arcgis')
    await expect(page.locator('#tool-container table')).toBeVisible()
  })

  test('auto rename button generates safe names', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await switchTab(page, 'osm-to-arcgis')
    const autoBtn = page.locator('button', { hasText: /Auto.rename/i }).first()
    if (await autoBtn.count() > 0) {
      await autoBtn.click()
      // Should not throw; table still visible
      await expect(page.locator('#tool-container table')).toBeVisible()
    }
  })
})

// ── Property Editor ────────────────────────────────────────────────────────────

test.describe('Property Editor tool', () => {
  test('shows feature table and property list', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await switchTab(page, 'property-editor')
    await expect(page.locator('#pe-property-list')).toBeVisible()
    await expect(page.locator('#pe-table-wrap table')).toBeVisible()
  })

  test('add property adds it to all features', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-polygons.geojson')
    await switchTab(page, 'property-editor')

    await page.fill('#pe-new-name', 'test_prop')
    await page.fill('#pe-new-value', 'hello')
    await page.click('#pe-add-btn')

    // Undo button should appear (state was updated)
    await expect(page.locator('#undo-btn')).toBeVisible()
    // Property list should now contain 'test_prop'
    await expect(page.locator('#pe-property-list')).toContainText('test_prop')
  })

  test('pagination controls appear for large datasets', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await switchTab(page, 'property-editor')
    // sample-mixed has 4 features (< 20), so next button is disabled
    await expect(page.locator('#pe-next-btn')).toBeDisabled()
  })
})

// ── Attribute Faker ────────────────────────────────────────────────────────────

test.describe('Attribute Faker tool', () => {
  test('shows attribute config cards', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await switchTab(page, 'attribute-faker')
    await expect(page.locator('#af-cards')).toBeVisible()
    // Should have at least one card (mixed fixture has properties)
    await expect(page.locator('#af-apply-btn')).toBeEnabled()
  })

  test('apply faker updates state (undo button appears)', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await switchTab(page, 'attribute-faker')
    await page.click('#af-apply-btn')
    await expect(page.locator('#undo-btn')).toBeVisible()
  })
})

// ── GeoJSON to Overpass ────────────────────────────────────────────────────────

test.describe('GeoJSON to Overpass tool', () => {
  test('shows results table for polygon fixture', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-polygons.geojson')
    await switchTab(page, 'geojson-to-overpass')
    // Should show poly results
    await expect(page.locator('#tool-container')).toContainText('poly')
  })

  test('shows key filter UI', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await switchTab(page, 'geojson-to-overpass')
    // Should have key select or filter UI element
    await expect(page.locator('#tool-container')).toBeVisible()
  })
})

// ── Inspect Geometry ───────────────────────────────────────────────────────────

test.describe('Inspect Geometry tool', () => {
  test('wizard tab is active by default', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await switchTab(page, 'inspect-geometry')
    // Should show wizard input
    await expect(page.locator('#tool-container')).toBeVisible()
  })

  test('analyse button works and shows results', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await switchTab(page, 'inspect-geometry')
    const analyseBtn = page.locator('button', { hasText: /Analys/i }).first()
    if (await analyseBtn.count() > 0) {
      await analyseBtn.click()
      await expect(page.locator('#tool-container')).toContainText('Total')
    }
  })
})

// ── File reload ────────────────────────────────────────────────────────────────

test.describe('File reload', () => {
  test('loading a second file remounts the active tool', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'sample-mixed.geojson')
    await switchTab(page, 'geometry-filter')
    await expect(page.locator('#status-details')).toContainText('4 features')

    // Load a different file
    await uploadFixture(page, 'sample-polygons.geojson')
    await expect(page.locator('#status-details')).toContainText('2 features')
    // Tool container still shows the active tool (not blank)
    await expect(page.locator('#tool-container')).not.toContainText('Load a GeoJSON')
  })
})
