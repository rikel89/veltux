import { expect, test } from "@playwright/test";

/**
 * Pruebas de humo en modo demostración (sin Supabase configurado).
 * Con Supabase configurado, /profesional redirige a /login.
 */
test.describe("Panel profesional (demo)", () => {
  test("muestra el dashboard con los datos marcados como DEMO", async ({ page }) => {
    await page.goto("/profesional");
    await expect(page.getByRole("status")).toContainText("Modo demostración");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Carlos");
    await expect(page.getByRole("heading", { name: "Agenda de hoy" })).toBeVisible();
    await expect(page.getByText("Confirmada")).toHaveCount(0);
  });

  test("la navegación lleva a la agenda y las secciones pendientes indican su sprint", async ({ page, isMobile }) => {
    await page.goto("/profesional");
    if (isMobile) {
      await page.getByRole("navigation", { name: "Navegación inferior" }).getByRole("link", { name: "Agenda" }).click();
    } else {
      await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: /Mi agenda/ }).click();
    }
    await expect(page).toHaveURL(/\/profesional\/agenda$/);
    await expect(page.getByRole("heading", { level: 1, name: "Mi agenda" })).toBeVisible();

    await page.goto("/profesional/imprevistos");
    await expect(page.getByText("Disponible en el Sprint 6")).toBeVisible();
  });

  test("en móvil usa la barra inferior con acción de nueva cita", async ({ page, isMobile }) => {
    test.skip(!isMobile, "solo móvil");
    await page.goto("/profesional");
    await expect(page.getByRole("link", { name: "Nueva cita" }).last()).toBeVisible();
    await page.getByRole("button", { name: "Más" }).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: /Imprevistos/ })).toBeVisible();
  });
});

test("la portada muestra la identidad VELTUX", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Tu ritmo.").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Acceder a mi agenda/ })).toHaveAttribute("href", "/login");
});

test.describe("Acceso", () => {
  test("el login enlaza con la recuperación de contraseña", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
    await expect(page).toHaveURL(/\/recuperar$/);
    await expect(page.getByRole("heading", { name: "Recupera tu acceso" })).toBeVisible();
  });

  test("un enlace caducado muestra un aviso claro", async ({ page }) => {
    await page.goto("/login?error=enlace");
    await expect(page.getByRole("alert").filter({ hasText: "caducado" })).toBeVisible();
  });

  test("sin roles de propietario o administrador, esas áreas redirigen a la agenda", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/profesional$/);
    await page.goto("/propietario");
    await expect(page).toHaveURL(/\/profesional$/);
  });
});
