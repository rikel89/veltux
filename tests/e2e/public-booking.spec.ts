import { expect, test } from "@playwright/test";

/**
 * Sin Supabase no hay establecimientos públicos: las páginas de reserva
 * responden 404 y la API no acepta peticiones (nunca inventa reservas).
 */
test("sin Supabase, la página pública de reservas no existe", async ({ page }) => {
  // Se transmite en streaming dentro de <Suspense>: se comprueba el contenido, no el código HTTP.
  await page.goto("/barberia-elegance/carlos");
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
});

test("la API pública rechaza escrituras desde otro origen", async ({ request }) => {
  const res = await request.post("/api/public/otp", {
    headers: { origin: "https://malicioso.example" },
    data: { professionalId: "6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f", phone: "+34600112233" },
  });
  expect(res.status()).toBe(403);
});

test("la API de huecos valida los parámetros", async ({ request }) => {
  const res = await request.get("/api/public/slots?serviceId=x&from=hoy&to=hoy");
  expect([400, 404]).toContain(res.status());
});
