import { test, expect } from "@playwright/test";
const fixture = "http://127.0.0.1:54329";
const owner = "a1000000-0000-4000-8000-000000000001";
const first = "b1000000-0000-4000-8000-000000000001";
const second = "b1000000-0000-4000-8000-000000000002";
test.beforeEach(async ({ context, request, page }) => {
  await request.post(fixture + "/__fixtures/reset", {
    data: { scenario: "two" },
  });
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: owner,
        role: "authenticated",
        aud: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "fixture",
  ].join(".");
  const session = {
    access_token: jwt,
    refresh_token: "fixture-refresh",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: owner,
      email: "owner@example.test",
      aud: "authenticated",
      role: "authenticated",
    },
  };
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value:
        "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"),
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
});
test("owner selects a business explicitly and can switch without mixed context", async ({
  page,
}) => {
  await page.goto("/business/dashboard?tab=jobs");
  await expect(
    page.getByRole("heading", { name: "Choose a business", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("article")
    .filter({ hasText: "Second Local Shop" })
    .getByRole("link", { name: "Choose business", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(second));
  await expect(
    page.getByRole("heading", { name: "Second Local Shop", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Switch business").selectOption(first);
  await page
    .getByRole("button", { name: "Open business", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(first));
  await page.getByRole("link", { name: "My businesses", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your businesses", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("empty account creates with essentials and immediately reaches review", async ({
  page,
  request,
}) => {
  await request.post(fixture + "/__fixtures/reset", {
    data: { scenario: "empty" },
  });
  await page.goto("/business/dashboard");
  await expect(page.locator(".stats")).toHaveCount(0);
  await page
    .getByRole("link", { name: "Create your first business", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create business", exact: true })
    .click();
  await expect(page.locator("#business-name")).toBeFocused();
  await page.locator("#business-name").fill("My new shop");
  await page.locator("#business-category").fill("Retail");
  await page.locator("#business-address").fill("Candelaria, Quezon");
  await page
    .getByRole("button", { name: "Create business", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My new shop", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Waiting for admin review", { exact: true }),
  ).toBeVisible();
  expect(
    (await (await request.get(fixture + "/__fixtures/state")).json())
      .createCalls,
  ).toBe(1);
});
test("unsaved text and optional contact are previewed and navigation can be cancelled", async ({
  page,
}) => {
  await page.goto(`/business/dashboard?tab=profile&business=${first}`);
  await page.locator("#business-name").fill("Unsaved shop name");
  await page
    .locator("summary")
    .filter({ hasText: "Public contact information" })
    .click();
  await page.locator("#business-public_email").fill("hello@example.test");
  await page.getByLabel("Switch business").selectOption(second);
  await page
    .getByRole("button", { name: "Open business", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Save your changes?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stay here", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(first));
  await page
    .getByRole("button", { name: "Preview profile", exact: true })
    .click();
  const preview = page.getByRole("dialog", {
    name: "Business profile preview",
  });
  await expect(
    preview.getByText("Unsaved shop name", { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByText("hello@example.test", { exact: true }),
  ).toBeVisible();
  await preview.getByRole("button", { name: "Close preview" }).click();
  await page.getByRole("link", { name: "My businesses", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Save your changes?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stay here", exact: true }).click();
  await expect(page.locator("#business-name")).toHaveValue("Unsaved shop name");
  await page.getByRole("link", { name: "My businesses", exact: true }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page).toHaveURL(/tab=overview/);
});
test("deletion is hidden in a menu and cancellation preserves the business", async ({
  page,
  request,
}) => {
  await page.goto("/business/dashboard");
  await page.getByLabel("More actions for First Local Shop").click();
  await page
    .getByRole("button", { name: "Delete business", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Delete First Local Shop?" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Keep business" }),
  ).toBeFocused();
  await dialog.getByRole("button", { name: "Keep business" }).click();
  expect(
    (await (await request.get(fixture + "/__fixtures/state")).json()).businesses
      .length,
  ).toBe(2);
});
test("rejected business requires saved changes before resubmission and suspended business cannot resubmit", async ({
  page,
  request,
}) => {
  await request.post(fixture + "/__fixtures/reset", {
    data: { scenario: "rejected" },
  });
  await page.goto(`/business/dashboard?tab=profile&business=${first}`);
  await expect(
    page.getByText("Please correct the business address.", { exact: false }),
  ).toBeVisible();
  await page.locator("#business-address").fill("Corrected address");
  await expect(
    page.getByRole("button", { name: "Resubmit for review" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(/tab=overview/);
  await page
    .getByRole("link", { name: "Business details", exact: true })
    .click();
  await page.getByRole("button", { name: "Resubmit for review" }).click();
  await expect(
    page.getByText("Waiting for admin review", { exact: true }),
  ).toBeVisible();
  await request.post(fixture + "/__fixtures/reset", {
    data: { scenario: "suspended" },
  });
  await page.goto(`/business/dashboard?tab=profile&business=${first}`);
  await expect(
    page.getByRole("button", { name: "Resubmit for review" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Contact admin", exact: true }),
  ).toBeVisible();
});
test("cropped photo draft survives a failed upload and retry creates no duplicate business", async ({
  page,
  request,
}) => {
  await request.post(fixture + "/__fixtures/reset", {
    data: { scenario: "empty" },
  });
  await page.goto("/business/dashboard?tab=new-business");
  await page.locator("#business-name").fill("Photo shop");
  await page.locator("#business-category").fill("Retail");
  await page.locator("#business-address").fill("Candelaria");
  await page
    .locator("summary")
    .filter({ hasText: "Logo and background photos" })
    .click();
  const bytes = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 500;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#147d59";
    c.fillRect(0, 0, 900, 500);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator("input[type=file][multiple]").setInputFiles({
    name: "cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(bytes, "base64"),
  });
  await page.getByRole("button", { name: "Use photo", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Unsaved background photo" }),
  ).toBeVisible();
  await page
    .getByRole("img", { name: "Unsaved background photo" })
    .evaluate((img: HTMLImageElement) => img.decode());
  await request.post(fixture + "/__fixtures/fail-upload");
  await page
    .getByRole("button", { name: "Create business", exact: true })
    .click();
  await expect(page.locator(".owner-save-error")).toContainText(
    "Your business was created",
  );
  await expect(
    page.getByRole("img", { name: "Unsaved background photo" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create business", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Photo shop", exact: true }),
  ).toBeVisible();
  const state = await (await request.get(fixture + "/__fixtures/state")).json();
  expect(state.createCalls).toBe(1);
  expect(state.businesses[0].cover_paths).toHaveLength(1);
});

test("map drafts share the bottom save and light/dark layouts remain usable", async ({
  page,
  request,
}) => {
  await page.goto(`/business/dashboard?tab=profile&business=${first}`);
  await expect(page.locator(".leaflet-container")).toHaveCount(0);
  await page
    .locator("summary")
    .filter({ hasText: /^Map location/ })
    .click();
  await page
    .locator("summary")
    .filter({ hasText: "Advanced: enter coordinates" })
    .click();
  await page.getByLabel("Latitude", { exact: true }).fill("13.93");
  await page.getByRole("link", { name: "My businesses", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Save your changes?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stay here", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText(
      "Choose valid latitude and longitude together, or remove the pin.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByLabel("Longitude", { exact: true }).fill("121.42");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(/tab=overview/);
  const state = await (await request.get(fixture + "/__fixtures/state")).json();
  expect(state.businesses[0].latitude).toBe(13.93);
  expect(state.businesses[0].longitude).toBe(121.42);
  await page
    .getByRole("link", { name: "Business details", exact: true })
    .click();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: `test-results/owner-editor-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("multiple background crops can be revised, previewed and discarded before saving", async ({
  page,
}) => {
  await page.goto(`/business/dashboard?tab=profile&business=${first}`);
  await page
    .locator("summary")
    .filter({ hasText: "Logo and background photos" })
    .click();
  const bytes = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 900;
    c.height = 500;
    const x = c.getContext("2d")!;
    x.fillStyle = "#147d59";
    x.fillRect(0, 0, 900, 500);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.locator("input[type=file][multiple]").setInputFiles(
    ["one", "two"].map((name) => ({
      name: name + ".png",
      mimeType: "image/png",
      buffer: Buffer.from(bytes, "base64"),
    })),
  );
  await page.getByRole("button", { name: "Use photo", exact: true }).click();
  await page.getByRole("button", { name: "Use photo", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Unsaved background photo", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Remove selected photo 1", exact: true })
    .click();
  await page.getByRole("button", { name: "Adjust crop", exact: true }).click();
  await page.getByLabel("Zoom", { exact: true }).fill("1.5");
  await page.getByRole("button", { name: "Use photo", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview profile", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Business profile preview" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close preview" }).click();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Unsaved background photo", exact: true }),
  ).toHaveCount(0);
});
