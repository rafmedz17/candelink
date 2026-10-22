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
  await expect(page.getByRole("status")).toContainText("not configured");
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
  for (const path of ["/", "/jobs", "/businesses", "/register"]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
