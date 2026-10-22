import { test, expect } from "@playwright/test";

test("theme follows the system until explicitly selected, then persists across pages and reloads", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const root = page.locator("html");
  const toggle = page.getByRole("button", { name: "Toggle dark mode" });
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-theme", "light");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.goto("/jobs");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".job-card").first()).toHaveCSS(
    "background-color",
    "rgb(26, 40, 32)",
  );
  await page.goto("/register");
  await expect(page.getByLabel("Email address")).toHaveCSS(
    "background-color",
    "rgb(20, 32, 25)",
  );
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "light");
});

test("theme works when local storage is blocked and fits narrow mobile navigation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage unavailable");
      },
    });
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Toggle dark mode" });
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
