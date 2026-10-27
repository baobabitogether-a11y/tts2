import { createHmac, randomBytes } from "node:crypto";
import { closeSync, existsSync, openSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const output = resolve(".env.local-supabase");
if (existsSync(output)) {
  console.log("Using existing .env.local-supabase");
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
  VITE_SUPABASE_URL: process.env.LOCAL_SUPABASE_PUBLIC_URL || "http://127.0.0.1:54321",
  LOCAL_APP_URL: process.env.LOCAL_APP_URL || "http://127.0.0.1:8080",
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
