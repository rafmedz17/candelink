// Shut down the test-owned services before Playwright's Windows process cleanup.
export default async function teardown() {
  await fetch("http://127.0.0.1:54329/__fixtures/shutdown", {
    method: "POST",
  }).catch(() => {});
}
