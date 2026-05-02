const routes = [
  "/dashboard",
  "/projects",
  "/missions",
  "/teams",
  "/employees",
  "/technician",
  "/advances",
  "/purchases",
  "/expenses",
  "/allowances",
  "/cash",
  "/suppliers",
  "/taxes",
  "/warehouse",
  "/fleet",
  "/reports",
  "/boss-room",
  "/boss",
  "/settings",
  "/audit-history",
  "/audit"
];

const baseUrl = process.env.QA_BASE_URL || "http://localhost:3000";

async function checkRoute(route) {
  const url = new URL(route, baseUrl);
  const response = await fetch(url, { redirect: "manual" });
  const ok = response.status < 500;
  return {
    route,
    status: response.status,
    location: response.headers.get("location"),
    ok
  };
}

(async () => {
  const results = [];
  for (const route of routes) {
    try {
      results.push(await checkRoute(route));
    } catch (error) {
      results.push({ route, status: "FETCH_ERROR", ok: false, error: error.message });
    }
  }

  for (const result of results) {
    const marker = result.ok ? "OK" : "FAIL";
    const target = result.location ? ` -> ${result.location}` : "";
    const error = result.error ? ` (${result.error})` : "";
    console.log(`${marker} ${result.route} ${result.status}${target}${error}`);
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length) process.exit(1);
})();
