import { createFileRoute, Link } from "@tanstack/react-router";
import { openApiSpec } from "@/lib/openapi";

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";
type OpenApiOperation = {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    description?: string;
    schema?: unknown;
  }>;
  requestBody?: unknown;
  responses?: Record<string, { description?: string }>;
};

const methods: HttpMethod[] = ["get", "post", "put", "patch", "delete"];
const methodStyles: Record<HttpMethod, string> = {
  get: "text-sky-700 dark:text-sky-300",
  post: "text-green-700 dark:text-green-300",
  put: "text-amber-700 dark:text-amber-300",
  patch: "text-violet-700 dark:text-violet-300",
  delete: "text-red-700 dark:text-red-300",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOperation(value: unknown): value is OpenApiOperation {
  return (
    isRecord(value) && (typeof value.summary === "string" || typeof value.operationId === "string")
  );
}

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "API reference — Speak API" },
      {
        name: "description",
        content: "Browse the Speak API OpenAPI reference and request schemas.",
      },
    ],
  }),
  component: ApiDocs,
});

function ApiDocs() {
  const operations = Object.entries(openApiSpec.paths).flatMap(([path, pathItem]) =>
    methods.flatMap((method) => {
      const operation = Reflect.get(pathItem, method);
      return isOperation(operation) ? [{ path, method, operation }] : [];
    }),
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-foreground">
      <header className="border-b border-border pb-6">
        <nav className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Back to speech
          </Link>
          <a href="/api/public/openapi.json" className="hover:text-foreground">
            OpenAPI JSON
          </a>
        </nav>
        <h1 className="mt-6 text-3xl font-semibold">{openApiSpec.info.title} API reference</h1>
        <p className="mt-2 text-sm text-muted-foreground">{openApiSpec.info.description}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Version {openApiSpec.info.version} · {operations.length} operations ·{" "}
          <a className="underline" href="/api/public/openapi.json">
            Download the canonical OpenAPI document
          </a>
        </p>
      </header>

      <section aria-label="API operations" className="mt-8 space-y-4">
        {operations.map(({ path, method, operation }) => (
          <article key={`${method}-${path}`} className="border border-border">
            <div className="p-4">
              <h2 className="flex flex-wrap items-baseline gap-3 text-base font-semibold">
                <span className={`font-mono uppercase ${methodStyles[method]}`}>{method}</span>
                <code className="break-all">{path}</code>
              </h2>
              {operation.summary && <p className="mt-2 text-sm">{operation.summary}</p>}
              {operation.description && (
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {operation.description}
                </p>
              )}
              {operation.parameters && operation.parameters.length > 0 && (
                <section className="mt-4">
                  <h3 className="text-sm font-semibold">Parameters</h3>
                  <ul className="mt-2 divide-y divide-border border-y border-border">
                    {operation.parameters.map((parameter) => (
                      <li
                        key={`${parameter.in}-${parameter.name}`}
                        className="grid gap-1 py-2 text-sm sm:grid-cols-[12rem_1fr]"
                      >
                        <code>{parameter.name}</code>
                        <span className="text-muted-foreground">
                          {parameter.in}
                          {parameter.required ? " · required" : " · optional"}
                          {parameter.description ? ` · ${parameter.description}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {operation.requestBody !== undefined && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Request body schema
                  </summary>
                  <pre className="mt-2 max-h-96 overflow-auto bg-muted p-3 text-xs">
                    {pretty(operation.requestBody)}
                  </pre>
                </details>
              )}
              {operation.responses && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold">Responses</summary>
                  <ul className="mt-2 divide-y divide-border border-y border-border">
                    {Object.entries(operation.responses).map(([status, response]) => (
                      <li key={status} className="grid gap-1 py-2 text-sm sm:grid-cols-[8rem_1fr]">
                        <code>{status}</code>
                        <span className="text-muted-foreground">{response.description}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </article>
        ))}
      </section>

      <aside className="mt-8 border border-border p-4 text-sm">
        <h2 className="font-semibold">Try a request</h2>
        <p className="mt-1 text-muted-foreground">
          Use the{" "}
          <Link to="/" className="underline">
            speech playground
          </Link>{" "}
          for an interactive TTS request, or send a request directly to the documented endpoints.
        </p>
      </aside>
    </main>
  );
}
