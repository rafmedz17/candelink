import { test, expect } from "@playwright/test";

const jobs = [1, 2].map((n) => ({
  id: `50000000-0000-4000-8000-00000000000${n}`,
  business_id: "40000000-0000-4000-8000-000000000001",
  title: `Local design assistant ${n}`,
  company: "Candelaria Studio",
  address: "Candelaria, Quezon",
  latitude: 13.931,
  longitude: 121.423,
  employment_type: "Full-time",
  arrangement: "On-site",
  location: "Candelaria",
}));
test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e5eee2"/><path d="M0 100H256M80 0V256" stroke="#fff" stroke-width="8"/></svg>',
    }),
  );
});

test("public map groups jobs by business and links to real opportunity pages", async ({
  page,
}) => {
  await page.route("**/api/maps/opportunities?*", (route) =>
    route.fulfill({ json: { opportunities: jobs, total: 2 } }),
  );
  await page.goto("/maps");
  await expect(
    page.getByRole("region", { name: "Map of job opportunities" }),
  ).toBeVisible();
  await expect(page.locator(".map-result-count")).toContainText(
    "2 opportunities",
  );
  await expect(page.locator(".opportunity-map-pin")).toHaveCount(1);
  await page.getByTitle("Candelaria Studio", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Candelaria Studio/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("link", { name: /Local design assistant 1/ }),
  ).toHaveAttribute("href", `/jobs/${jobs[0].id}`);
  await expect(
    page.getByRole("link", { name: "Directions ↗" }),
  ).toHaveAttribute("href", /openstreetmap.org\/directions/);
  await expect(page.locator(".leaflet-control-attribution")).toContainText(
    "OpenStreetMap",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("map search has honest empty and unavailable states", async ({ page }) => {
  await page.route("**/api/maps/opportunities?*", (route) => {
    const keyword = new URL(route.request().url()).searchParams.get("keyword");
    return route.fulfill(
      keyword === "offline"
        ? { status: 503, json: { error: "Unavailable" } }
        : {
            json: {
              opportunities: keyword === "missing" ? [] : jobs,
              total: keyword === "missing" ? 0 : 2,
            },
          },
    );
  });
  await page.goto("/maps");
  await expect(page.locator(".map-result-count")).toContainText(
    "2 opportunities",
  );
  await page
    .getByLabel("Search mapped opportunities", { exact: true })
    .fill("missing");
  await expect(
    page.getByRole("heading", { name: "No pinned opportunities in this area" }),
  ).toBeVisible();
  await expect(page.locator(".opportunity-map-pin")).toHaveCount(0);
  await page
    .getByLabel("Search mapped opportunities", { exact: true })
    .fill("offline");
  await expect(
    page.getByRole("heading", { name: "Map listings unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Browse jobs as a list ↗" }),
  ).toBeVisible();
});

test("map endpoint rejects invalid bounds before database access", async ({
  request,
}) => {
  const response = await request.get(
    "/api/maps/opportunities?south=14&north=13&west=121&east=122",
  );
  expect(response.status()).toBe(400);
  expect(response.headers()["cache-control"]).toContain("no-store");
});
