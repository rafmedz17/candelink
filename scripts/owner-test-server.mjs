// Isolated Supabase-shaped fixtures for the authenticated owner browser tests.
// Binds to loopback only and never reads production credentials.
import http from "node:http";
import { spawn } from "node:child_process";
export const ownerId = "a1000000-0000-4000-8000-000000000001";
export const firstId = "b1000000-0000-4000-8000-000000000001";
export const secondId = "b1000000-0000-4000-8000-000000000002";
const user = {
  id: ownerId,
  aud: "authenticated",
  role: "authenticated",
  email: "owner@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Test Owner" },
  created_at: "2026-01-01T00:00:00Z",
};
const profile = {
  ...user,
  full_name: "Test Owner",
  role: "business_owner",
  suspended: false,
  public_profile: false,
  headline: "",
  location: "Candelaria",
  introduction: "",
  avatar_path: null,
};
function business(id, name, status = "verified") {
  return {
    id,
    name,
    category: "Services",
    address: "Candelaria, Quezon",
    description: "",
    operating_details: "",
    public_email: "",
    public_phone: "",
    logo_path: null,
    cover_paths: [],
    latitude: null,
    longitude: null,
    verification_status: status,
    moderation_reason:
      status === "rejected"
        ? "Please correct the business address."
        : status === "suspended"
          ? "Contact admin to resolve this issue."
          : null,
    created_at: "2026-01-01T00:00:00Z",
    business_members: [{ user_id: ownerId }],
  };
}
let state;
function reset(scenario = "two") {
  state = {
    businesses:
      scenario === "empty"
        ? []
        : [
            business(
              firstId,
              "First Local Shop",
              ["pending", "rejected", "suspended"].includes(scenario)
                ? scenario
                : "verified",
            ),
            ...(scenario === "two"
              ? [business(secondId, "Second Local Shop")]
              : []),
          ],
    createCalls: 0,
    reviewCalls: 0,
    failUploads: 0,
    uploads: 0,
  };
}
reset();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:54329");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  let data = {};
  if (req.headers["content-type"]?.includes("application/json") && body.length)
    data = JSON.parse(body.toString());
  const reply = (value, status = 200) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  };
  if (url.pathname === "/__fixtures/shutdown") {
    reply({ ok: true });
    setTimeout(() => {
      child?.kill();
      server.closeAllConnections();
      server.close();
      process.exit(0);
    }, 100);
    return;
  }
  if (url.pathname === "/__fixtures/reset") {
    reset(data.scenario);
    return reply({ ok: true });
  }
  if (url.pathname === "/__fixtures/state") return reply(state);
  if (url.pathname === "/__fixtures/fail-upload") {
    state.failUploads = 1;
    return reply({ ok: true });
  }
  if (url.pathname === "/auth/v1/user") return reply(user);
  if (url.pathname.startsWith("/storage/v1/object/")) {
    if (req.method === "POST") {
      state.uploads++;
      if (state.failUploads-- > 0)
        return reply(
          {
            statusCode: "500",
            error: "Upload failed",
            message: "Simulated upload failure",
          },
          500,
        );
      return reply({
        Key: "avatars/" + url.pathname.split("/avatars/")[1],
        Id: crypto.randomUUID(),
      });
    }
    return reply([]);
  }
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const rpc = url.pathname.split("/").at(-1);
    const b = state.businesses.find((b) => b.id === data.bid);
    if (rpc === "account_activity")
      return reply({ messages: 0, friends: 0, notifications: 0 });
    if (rpc === "create_business") {
      state.createCalls++;
      const next = business(crypto.randomUUID(), data.details.name, "pending");
      Object.assign(next, data.details);
      state.businesses.push(next);
      return reply(next.id);
    }
    if (rpc === "update_business") {
      if (!b) return reply({ message: "Not authorized" }, 403);
      Object.assign(b, data.details);
      return reply(b.id);
    }
    if (rpc === "set_business_location") {
      if (!b) return reply({ message: "Not authorized" }, 403);
      b.latitude = data.pin_latitude;
      b.longitude = data.pin_longitude;
      return reply(null);
    }
    if (rpc === "set_business_logo") {
      if (!b) return reply({ message: "Not authorized" }, 403);
      b.logo_path = data.image_path;
      return reply(null);
    }
    if (rpc === "business_photo") {
      if (!b) return reply({ message: "Not authorized" }, 403);
      b.cover_paths = data.remove_photo
        ? b.cover_paths.filter((p) => p !== data.image_path)
        : [...b.cover_paths, data.image_path];
      return reply(null);
    }
    if (rpc === "request_business_review") {
      if (!b || !["pending", "rejected"].includes(b.verification_status))
        return reply(
          { message: "Business cannot be submitted for review" },
          403,
        );
      state.reviewCalls++;
      b.verification_status = "pending";
      return reply(null);
    }
    if (rpc === "delete_business") {
      state.businesses = state.businesses.filter((b) => b.id !== data.bid);
      return reply(null);
    }
    return reply([]);
  }
  if (url.pathname.startsWith("/rest/v1/")) {
    const table = url.pathname.split("/").at(-1);
    let rows =
      table === "profiles"
        ? [profile]
        : table === "businesses"
          ? state.businesses
          : table === "business_members"
            ? state.businesses.map((b) => ({
                business_id: b.id,
                user_id: ownerId,
              }))
            : [];
    for (const [key, value] of url.searchParams) {
      if (value.startsWith("eq.") && !key.includes("."))
        rows = rows.filter((row) => String(row[key]) === value.slice(3));
    }
    res.setHeader(
      "Content-Range",
      `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
    );
    if (req.method === "HEAD") {
      res.writeHead(200);
      return res.end();
    }
    return reply(
      req.headers.accept?.includes("application/vnd.pgrst.object+json")
        ? rows[0] || null
        : rows,
    );
  }
  return reply({ message: "Unknown fixture endpoint" }, 404);
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(54329, "127.0.0.1", resolve);
});
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_owner_fixture",
  SUPABASE_SECRET_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3103",
  NEXT_TELEMETRY_DISABLED: "1",
};
let child;
function command(args) {
  return new Promise((resolve, reject) => {
    child = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", ...args],
      { env, stdio: "inherit", windowsHide: true },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Next exited ${code}`)),
    );
  });
}
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    child?.kill();
    server.close();
    process.exit(0);
  });
try {
  await command(["build"]);
  await command(["start", "--port", "3103"]);
} finally {
  server.close();
}
