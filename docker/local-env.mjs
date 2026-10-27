import { createHmac, randomBytes } from "node:crypto";
import { closeSync, existsSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const output = resolve(".env.local-supabase");
const codespacesDomain =
  process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? `https://${process.env.CODESPACE_NAME}`
    : undefined;
const publicUrls = {
  VITE_SUPABASE_URL:
    process.env.LOCAL_SUPABASE_PUBLIC_URL ||
    (codespacesDomain
      ? `${codespacesDomain}-54321.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
      : "http://127.0.0.1:54321"),
  LOCAL_APP_URL:
    process.env.LOCAL_APP_URL ||
    (codespacesDomain
      ? `${codespacesDomain}-8080.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
      : "http://127.0.0.1:8080"),
};
if (existsSync(output)) {
  let contents = readFileSync(output, "utf8");
  let updated = false;
  for (const [name, url] of Object.entries(publicUrls)) {
    const setting = new RegExp(`^${name}=(.*)$`, "m");
    const current = contents.match(setting)?.[1];
    if (
      current === undefined ||
      process.env[name] ||
      current === "http://127.0.0.1:54321" ||
      current === "http://127.0.0.1:8080"
    ) {
      contents =
        current === undefined
          ? `${contents.trimEnd()}\n${name}=${url}\n`
          : contents.replace(setting, `${name}=${url}`);
      updated = true;
    }
  }
  if (updated) writeFileSync(output, contents, { mode: 0o600 });
  console.log(
    updated
      ? "Updated local browser URLs in .env.local-supabase"
      : "Using existing .env.local-supabase",
  );
  process.exit(0);
}

const jwtSecret = randomBytes(48).toString("base64url");
const makeJwt = (role) => {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: "supabase-local",
      role,
      iat: issuedAt,
      exp: issuedAt + 10 * 365 * 24 * 60 * 60,
    }),
  ).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", jwtSecret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
};

const postgresPassword = randomBytes(32).toString("hex");
const values = {
  POSTGRES_PASSWORD: postgresPassword,
  JWT_SECRET: jwtSecret,
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_PUBLISHABLE_KEY: makeJwt("anon"),
  SUPABASE_SERVICE_ROLE_KEY: makeJwt("service_role"),
  ...publicUrls,
  OPENROUTER_KEY_ENCRYPTION_SECRET: randomBytes(48).toString("base64url"),
  PROVIDER_MANAGEMENT_TOKEN: randomBytes(32).toString("base64url"),
};
const contents = Object.entries(values)
  .map(([name, value]) => `${name}=${value}`)
  .join("\n");
const fd = openSync(output, "wx", 0o600);
try {
  writeFileSync(fd, `${contents}\n`);
} finally {
  closeSync(fd);
}
console.log("Created .env.local-supabase with local-only generated secrets");
