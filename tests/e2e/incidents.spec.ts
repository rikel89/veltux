import { expect, test } from "@playwright/test";

/** Imprevistos y notificaciones actúan sobre datos reales: sin Supabase no muestran nada ficticio. */
test("imprevistos y notificaciones no inventan datos en modo demostración", async ({ page }) => {
  await page.goto("/profesional/imprevistos");
  await expect(page.getByRole("heading", { level: 1, name: "Imprevistos" })).toBeVisible();
  await expect(page.getByText("Disponible al conectar Supabase")).toBeVisible();

  await page.goto("/profesional/notificaciones");
  await expect(page.getByRole("heading", { level: 1, name: "Notificaciones" })).toBeVisible();
  await expect(page.getByText("Enviada")).toHaveCount(0);
});

test("un enlace de cliente no válido no muestra ninguna cita", async ({ page }) => {
  await page.goto("/cita/6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f.firma-falsa");
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
});

test("el procesador de la cola exige el secreto", async ({ request }) => {
  const res = await request.get("/api/internal/notifications/process");
  expect(res.status()).toBe(401);
});
