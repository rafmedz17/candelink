import { test, expect } from "@playwright/test";
test("landing page, keyword discovery, details, and honest sample application state", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Find opportunities/ }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Job title, keyword, or company" })
    .fill("Administrative");
  await page.getByRole("button", { name: "Find jobs" }).click();
  await expect(page).toHaveURL(/q=Administrative/);
  await page
    .getByRole("link", { name: "Administrative Assistant", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Administrative Assistant",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("This is a sample opportunity. Applications open"),
  ).toBeVisible();
});
test("job filters and empty-state recovery work", async ({ page }) => {
  await page.goto("/jobs");
  const filterToggle = page.getByRole("button", {
    name: "Filters",
    exact: true,
  });
  if (await filterToggle.isVisible()) await filterToggle.click();
  await page.getByLabel("Employment type").selectOption("Part-time");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByRole("link", { name: "Social Media Associate" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Administrative Assistant", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Search jobs" })
    .fill("no-such-job-123");
  await page.getByRole("button", { name: "Search opportunities" }).click();
  await expect(
    page.getByRole("heading", { name: "No opportunities found" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reset search" }).click();
  await expect(
    page.getByRole("link", { name: "Administrative Assistant", exact: true }),
  ).toBeVisible();
});
test("sample bookmark cannot falsely report persisted success", async ({
  page,
}) => {
  await page.goto("/jobs");
  await page
    .getByRole("button", { name: "Save job", exact: true })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText("Connect Supabase");
  await expect(
    page.getByRole("button", { name: "Save job", exact: true }).first(),
  ).toHaveAttribute("aria-pressed", "false");
});
test("authentication form validates and explains missing configuration", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.locator(".auth-stack").getByRole("alert")).toContainText(
    "not configured",
  );
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(
    page.getByRole("button", { name: "Send recovery link" }),
  ).toBeVisible();
});
test("unconfigured admin dashboard reveals no administrative data", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Your workspace is almost ready." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pending verification" }),
  ).toHaveCount(0);
});
test("mobile and desktop layouts stay within viewport", async ({ page }) => {
  for (const path of [
    "/",
    "/jobs",
    "/jobs/sample-1",
    "/businesses",
    "/businesses/sample-1",
    "/register",
    "/dashboard",
    "/business/dashboard",
    "/admin",
  ]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("registration choices and password visibility are usable", async ({
  page,
}) => {
  await page.goto("/register?role=business_owner");
  await expect(page.getByRole("radio", { name: /Hire locally/ })).toBeChecked();
  await page.getByRole("radio", { name: /Find work/ }).check();
  await expect(page.getByRole("radio", { name: /Find work/ })).toBeChecked();
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("example-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");
});

test("mobile filters and navigation can be opened and dismissed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/jobs?arrangement=Hybrid");
  const filters = page.getByRole("button", {
    name: "Filters (1)",
    exact: true,
  });
  await expect(filters).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Work arrangement")).not.toBeVisible();
  await filters.click();
  await expect(page.getByLabel("Work arrangement")).toHaveValue("Hybrid");
  await expect(page.getByLabel("Work arrangement")).toHaveCSS(
    "font-size",
    "16px",
  );
  await filters.click();
  await expect(page.getByLabel("Work arrangement")).not.toBeVisible();
  await page.getByRole("link", { name: "Remove Hybrid filter" }).click();
  await expect(page).not.toHaveURL(/arrangement/);
  const nav = page.getByLabel("Open navigation", { exact: true });
  await nav.click();
  await expect(page.locator(".mobile-menu")).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(page.locator(".mobile-menu")).not.toHaveAttribute("open", "");
  await nav.click();
  await page.locator("main").click({ position: { x: 4, y: 10 } });
  await expect(page.locator(".mobile-menu")).not.toHaveAttribute("open", "");
});
