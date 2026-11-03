import { expect, test } from "@playwright/test";

/** Agenda en modo demostración: citas de ejemplo marcadas DEMO, sin acciones de escritura. */
test.describe("Mi agenda (demo)", () => {
  test("vista de día con citas DEMO y detalle sin acciones", async ({ page }) => {
    await page.goto("/profesional/agenda");
    await expect(page.getByRole("heading", { level: 1, name: "Mi agenda" })).toBeVisible();
    await expect(page.getByText("6 citas")).toBeVisible();

    const agenda = page.getByRole("region", { name: "Agenda" });
    await expect(agenda.getByText("Demo", { exact: true })).toHaveCount(6);
    await expect(page.getByRole("button", { name: "Nueva cita" })).toHaveCount(0);

    await agenda.getByRole("button", { name: /Cliente demo A/ }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("Detalle de la cita")).toBeVisible();
    await expect(sheet.getByText("Corte clásico")).toBeVisible();
    await expect(sheet.getByText("Confirmada")).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: /Cancelar cita|Mover|Completada/ })).toHaveCount(0);
  });

  test("cambia a la semana y vuelve a un día concreto", async ({ page }) => {
    await page.goto("/profesional/agenda?fecha=2026-12-02&vista=semana");
    await expect(page.getByText("Semana del 30 nov al 6 dic")).toBeVisible();
    await page.getByRole("link", { name: /Jue\s*3/ }).click();
    await expect(page).toHaveURL(/fecha=2026-12-03&vista=dia/);
    await expect(page.getByText("Jueves, 3 de diciembre")).toBeVisible();
    await page.getByRole("link", { name: "Día siguiente" }).click();
    await expect(page).toHaveURL(/fecha=2026-12-04&vista=dia/);
  });
});

test("Mis clientes no muestra datos ficticios en modo demostración", async ({ page }) => {
  await page.goto("/profesional/clientes");
  await expect(page.getByRole("heading", { level: 1, name: "Mis clientes" })).toBeVisible();
  await expect(page.getByText("Disponible al conectar Supabase")).toBeVisible();
});
