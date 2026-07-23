import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────
//  TESTS: Carga general de la aplicación
// ─────────────────────────────────────────────
test.describe('Carga de la aplicación', () => {
  test('debe cargar la página principal correctamente', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/transferencia|calor|simulador/i);
  });

  test('debe mostrar el Header', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header');
    await expect(header).toBeVisible();
  });

  test('debe mostrar el simulador principal', async ({ page }) => {
    await page.goto('/');
    // El SimulatorSandbox debe estar visible
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });
});

// ─────────────────────────────────────────────
//  TESTS: Navegación entre mecanismos
// ─────────────────────────────────────────────
test.describe('Navegación entre mecanismos de transferencia', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('debe mostrar el mecanismo de Conducción por defecto', async ({ page }) => {
    const texto = await page.locator('body').textContent();
    expect(texto).toMatch(/conducci[oó]n/i);
  });

  test('debe poder cambiar a Convección', async ({ page }) => {
    // Click en el tab/botón de Convección
    const btnConveccion = page.getByRole('button', { name: /convecci[oó]n/i })
      .or(page.getByText(/convecci[oó]n/i).first());
    await btnConveccion.click();
    await expect(page.locator('body')).toContainText(/convecci[oó]n/i);
  });

  test('debe poder cambiar a Radiación', async ({ page }) => {
    const btnRadiacion = page.getByRole('button', { name: /radiaci[oó]n/i })
      .or(page.getByText(/radiaci[oó]n/i).first());
    await btnRadiacion.click();
    await expect(page.locator('body')).toContainText(/radiaci[oó]n/i);
  });
});

// ─────────────────────────────────────────────
//  TESTS: Modal de Teoría
// ─────────────────────────────────────────────
test.describe('Modal de Teoría', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('debe abrir el modal de teoría al hacer click', async ({ page }) => {
    // Buscar el botón que abre la teoría en el Header
    const btnTeoria = page.getByRole('button', { name: /teor[ií]a/i })
      .or(page.getByText(/teor[ií]a/i).first());
    await btnTeoria.click();
    // Verificar que el modal aparece
    const modal = page.locator('[class*="modal"], [class*="Modal"], dialog').first();
    await expect(modal).toBeVisible();
  });

  test('debe cerrar el modal de teoría', async ({ page }) => {
    const btnTeoria = page.getByRole('button', { name: /teor[ií]a/i })
      .or(page.getByText(/teor[ií]a/i).first());
    await btnTeoria.click();

    // Cerrar con el botón X o "Cerrar"
    const btnCerrar = page.getByRole('button', { name: /cerrar|close|×|✕/i }).last();
    await btnCerrar.click();

    const modal = page.locator('[class*="modal"], [class*="Modal"], dialog').first();
    await expect(modal).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────
//  TESTS: Simulador de Conducción
// ─────────────────────────────────────────────
test.describe('Simulador de Conducción de Calor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Asegurarse de estar en Conducción
    const btnConduccion = page.getByRole('button', { name: /conducci[oó]n/i }).first();
    if (await btnConduccion.isVisible()) {
      await btnConduccion.click();
    }
  });

  test('debe mostrar el formulario de conducción', async ({ page }) => {
    // Debe haber inputs para temperatura interior y exterior
    const inputs = page.locator('input[type="number"], input[type="range"]');
    await expect(inputs.first()).toBeVisible();
  });

  test('debe poder calcular la conducción', async ({ page }) => {
    // Hacer click en el botón de calcular
    const btnCalcular = page.getByRole('button', { name: /calcular|simular|calculate/i });
    if (await btnCalcular.isVisible()) {
      await btnCalcular.click();
      // Esperar resultado
      await expect(page.locator('body')).toContainText(/watts|W|resultado/i, { timeout: 10000 });
    }
  });
});

// ─────────────────────────────────────────────
//  TESTS: Responsividad
// ─────────────────────────────────────────────
test.describe('Responsividad', () => {
  test('debe verse bien en mobile (375x667)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
  });

  test('debe verse bien en tablet (768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('debe verse bien en desktop (1280x720)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});
