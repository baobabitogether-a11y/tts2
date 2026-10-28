// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type ConfigEnv } from "vite";

const config = defineConfig({
  vite: {
    server: {
      host: "0.0.0.0",
      port: 5000,
      strictPort: true,
      allowedHosts: true,
      proxy: {
        "/auth/v1": {
          target: "http://127.0.0.1:54321",
          changeOrigin: true,
        },
      },
    },
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});

export default async (configEnv: ConfigEnv) => {
  const { mode } = configEnv;
  const env = loadEnv(mode, process.cwd(), "");

  const rawUrl =
    process.env["A_SUPABASE_URL"] ||
    env["A_SUPABASE_URL"] ||
    process.env["VITE_SUPABASE_URL"] ||
    process.env["SUPABASE_URL"] ||
    "";
  const supabaseUrl = rawUrl.trim().split(/\s+/)[0];

  const rawKey =
    process.env["A_SUPABASE_PUBLISHABLE_KEY"] ||
    env["A_SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    "";
  const supabaseKey = rawKey.trim();

  if (supabaseUrl) {
    process.env["VITE_SUPABASE_URL"] = supabaseUrl;
  }
  if (supabaseKey) {
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] = supabaseKey;
  }

  if (!process.env["OPENROUTER_API_KEYS"] && env["OPENROUTER_API_KEYS"]) {
    process.env["OPENROUTER_API_KEYS"] = env["OPENROUTER_API_KEYS"];
  }

  const resolved = await config(configEnv);

  resolved.define = {
    ...resolved.define,
    ...(supabaseUrl && {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      'import.meta.env["VITE_SUPABASE_URL"]': JSON.stringify(supabaseUrl),
      "process.env.SUPABASE_URL": JSON.stringify(supabaseUrl),
      'process.env["SUPABASE_URL"]': JSON.stringify(supabaseUrl),
    }),
    ...(supabaseKey && {
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey),
      'import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]': JSON.stringify(supabaseKey),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseKey),
      'import.meta.env["VITE_SUPABASE_ANON_KEY"]': JSON.stringify(supabaseKey),
      "process.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey),
      'process.env["SUPABASE_PUBLISHABLE_KEY"]': JSON.stringify(supabaseKey),
    }),
  };

  return resolved;
};
