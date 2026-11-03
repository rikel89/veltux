import { expect, test } from "@playwright/test";

/** Servicios y horarios en modo demostración (sin Supabase): datos marcados y sin guardar. */
test.describe("Mis servicios (demo)", () => {
  test("lista el catálogo de ejemplo marcado como DEMO y sin edición", async ({ page }) => {
    await page.goto("/profesional/servicios");
    await expect(page.getByRole("heading", { level: 1, name: "Mis servicios" })).toBeVisible();
    const list = page.getByRole("list", { name: "Servicios" });
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await expect(list.getByText("Demo")).toHaveCount(3);
    await expect(list.getByText("Solo en tu agenda")).toBeVisible();
    await expect(page.getByRole("button", { name: "Editar" })).toHaveCount(0);
    await expect(page.getByLabel("Nombre del servicio")).toBeDisabled();
  });
});

test.describe("Mis horarios (demo)", () => {
  test("edita la jornada partida y detecta solapes en el navegador", async ({ page }) => {
    await page.goto("/profesional/horarios");
    await expect(page.getByRole("heading", { level: 1, name: "Mis horarios" })).toBeVisible();
    await expect(page.getByText("50 h semanales")).toBeVisible();

    // Domingo libre → se activa con una franja por defecto.
    const sunday = page.getByRole("switch", { name: /Domingo/ });
    await expect(sunday).not.toBeChecked();
    await sunday.check({ force: true });
    await expect(page.getByLabel("Domingo, franja 1: inicio")).toHaveValue("09:00");

    // Una segunda franja que pisa la primera muestra el error.
    await page.getByRole("button", { name: "Jornada partida" }).last().click();
    await page.getByLabel("Domingo, franja 2: inicio").fill("13:00");
    await expect(page.getByText("Se solapa con otra franja del mismo día").first()).toBeVisible();

    await page.getByRole("button", { name: "Quitar franja 2 del domingo" }).click();
    await expect(page.getByText("Se solapa con otra franja del mismo día")).toHaveCount(0);

    // En demo no hay botón de guardar.
    await expect(page.getByRole("button", { name: "Guardar horario" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ver huecos" })).toBeDisabled();
  });
});
