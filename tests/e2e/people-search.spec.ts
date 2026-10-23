import { test, expect } from "@playwright/test";

const person = {
  id: "10000000-0000-0000-0000-000000000001",
  full_name: "Rafael Santos",
  headline: "Designer in Candelaria",
  avatar_url: null,
};

test("navbar suggests people, supports keyboard selection, and fits the viewport", async ({
  page,
}) => {
  const queries: string[] = [];
  await page.route("**/api/people/suggestions?*", async (route) => {
    queries.push(new URL(route.request().url()).searchParams.get("q")!);
    await route.fulfill({ json: { people: [person] } });
  });
  await page.goto("/login");
  const search = page.getByRole("combobox", { name: "Search people" });
  await search.fill("R");
  await expect(page.getByRole("status")).toContainText("at least 2 characters");
  await expect(page.getByRole("option")).toHaveCount(0);
  expect(queries).toHaveLength(0);
  await search.fill("Rafael");
  const option = page.getByRole("option", { name: /Rafael Santos/ });
  await expect(option).toBeVisible();
  expect(queries).toEqual(["Rafael"]);
  await expect(
    page.getByRole("link", { name: "See all results" }),
  ).toHaveAttribute("href", "/people?q=Rafael");
  const panel = await page.locator(".people-suggestions").boundingBox();
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await search.press("ArrowDown");
  await expect(option).toHaveAttribute("aria-selected", "true");
  await page.screenshot({
    path: test.info().outputPath("people-search-light.png"),
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await page.screenshot({
    path: test.info().outputPath("people-search-dark.png"),
  });
  await search.press("Enter");
  await expect(page).toHaveURL(`/profiles/${person.id}`);
  await expect(page.getByRole("listbox")).toHaveCount(0);
});

test("navbar search dismisses, handles empty results, and reports failures", async ({
  page,
}) => {
  await page.route("**/api/people/suggestions?*", async (route) => {
    const keyword = new URL(route.request().url()).searchParams.get("q");
    await route.fulfill(
      keyword === "offline"
        ? { status: 503, json: { error: "unavailable" } }
        : { json: { people: keyword === "Rafael" ? [person] : [] } },
    );
  });
  await page.goto("/login");
  const search = page.getByRole("combobox", { name: "Search people" });
  await search.fill("unknown");
  await expect(page.getByRole("status")).toContainText(
    "No matching public profiles",
  );
  await search.press("Escape");
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await search.fill("Rafael");
  await expect(page.getByRole("option")).toBeVisible();
  // The heading can sit behind the overlay on a narrow viewport.
  await page.mouse.click(4, 4);
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await search.fill("offline");
  await expect(page.getByRole("status")).toContainText("Search is unavailable");
  await expect(page.getByRole("option")).toHaveCount(0);
});

test("new search results cannot be replaced by an older, slower response", async ({
  page,
}) => {
  let releaseOld: () => void = () => {};
  let oldStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    oldStarted = resolve;
  });
  const released = new Promise<void>((resolve) => {
    releaseOld = resolve;
  });
  await page.route("**/api/people/suggestions?*", async (route) => {
    const keyword = new URL(route.request().url()).searchParams.get("q");
    if (keyword === "old") {
      oldStarted();
      await released;
    }
    await route.fulfill({
      json: { people: [{ ...person, full_name: `${keyword} person` }] },
    });
  });
  await page.goto("/login");
  const search = page.getByRole("combobox", { name: "Search people" });
  await search.fill("old");
  await started;
  await search.fill("new");
  await expect(page.getByRole("option", { name: /new person/ })).toBeVisible();
  releaseOld();
  await expect(page.getByRole("option", { name: /old person/ })).toHaveCount(0);
  await expect(page.getByRole("option", { name: /new person/ })).toBeVisible();
  const option = page.getByRole("option", { name: /new person/ });
  if (test.info().project.name === "mobile") await option.tap();
  else await option.click();
  await expect(page).toHaveURL(`/profiles/${person.id}`);
});
