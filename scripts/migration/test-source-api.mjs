#!/usr/bin/env node

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Set it only for the terminal session used for this check.`);
  }
  return value;
}

function normalizeSupabaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function redactKey(value) {
  if (!value || value.length < 12) return "<redacted>";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function requestJson(url, serviceRoleKey) {
  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text ? "<non-json response>" : null;
  }
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body,
  };
}

try {
  const sourceUrl = normalizeSupabaseUrl(requireEnv("SOURCE_SUPABASE_URL"));
  const serviceRoleKey = requireEnv("SOURCE_SERVICE_ROLE_KEY");

  const authUrl = `${sourceUrl}/auth/v1/admin/users?page=1&per_page=1`;
  const bucketsUrl = `${sourceUrl}/storage/v1/bucket`;

  const [authCheck, bucketsCheck] = await Promise.all([
    requestJson(authUrl, serviceRoleKey),
    requestJson(bucketsUrl, serviceRoleKey),
  ]);

  const bucketNames = Array.isArray(bucketsCheck.body)
    ? bucketsCheck.body.map((bucket) => bucket.name || bucket.id).filter(Boolean)
    : [];

  console.log(JSON.stringify({
    source: "supabase-api",
    checkedAt: new Date().toISOString(),
    sourceUrl,
    serviceRoleKey: redactKey(serviceRoleKey),
    authAdminReachable: authCheck.ok,
    authAdminStatus: authCheck.status,
    storageReachable: bucketsCheck.ok,
    storageStatus: bucketsCheck.status,
    bucketNames,
    hasFilesBucket: bucketNames.includes("files"),
    hasKanbanAttachmentsBucket: bucketNames.includes("kanban-attachments"),
  }, null, 2));

  if (!authCheck.ok || !bucketsCheck.ok) {
    process.exitCode = 2;
  }
} catch (error) {
  console.error(JSON.stringify({
    source: "supabase-api",
    connected: false,
    checkedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
}

