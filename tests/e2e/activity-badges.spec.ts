import { test, expect } from "@playwright/test";

test("workspace badges share a request, cap large counts, and clear after an activity update", async ({
  page,
}) => {
  let counts = { messages: 120, friends: 2, notifications: 3 };
  let requests = 0;
  await page.route("**/api/account/activity", async (route) => {
    requests++;
    await route.fulfill({ json: counts });
  });
  await page.goto("/messages");
  const nav = page.getByRole("navigation", { name: "Workspace navigation" });
  await expect(nav.getByLabel("120 unread messages")).toHaveText("99+");
  await expect(nav.getByLabel("2 pending friend requests")).toHaveText("2");
  await expect(nav.getByLabel("3 unread notifications")).toHaveText("3");
  expect(requests).toBe(1);
  counts = { messages: 0, friends: 1, notifications: 0 };
  await page.evaluate(() =>
    window.dispatchEvent(new Event("candelink:activity")),
  );
  await expect(nav.getByLabel("1 pending friend requests")).toHaveText("1");
  await expect(nav.locator(".unread-badge")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
