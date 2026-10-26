import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Usage reports — Speak API" },
      { name: "description", content: "Provider request, latency, audio, cache, and token statistics." },
    ],
  }),
  component: Reports,
});

type ServiceReport = {
  service: string;
  requests: number;
  successful: number;
  failed: number;
  cached: number;
  audio_bytes: number;
  input_chars: number;
  output_chars: number;
  estimated_input_tokens: number;
  provider_input_tokens: number;
  provider_output_tokens: number;
  avg_duration_ms: number;
};
type Report = {
  window_hours: number;
  totals: Omit<ServiceReport, "service">;
  services: ServiceReport[];
};

function Reports() {
  const [token, setToken] = useState("");
  const [hours, setHours] = useState("24");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/public/usage?hours=${encodeURIComponent(hours)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Report request failed");
      setReport(body as Report);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setReport(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-foreground">
      <nav className="flex gap-4 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Back</Link>
        <Link to="/openrouter" className="hover:text-foreground">Provider keys</Link>
      </nav>
      <h1 className="mt-5 text-2xl font-semibold">Usage reports</h1>
      <form className="mt-6 flex flex-wrap items-end gap-3" onSubmit={load}>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Management token
          <input aria-label="Management token" type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)} className="w-72 max-w-full border border-border bg-background px-3 py-2 text-sm text-foreground" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Window
          <select aria-label="Report window" value={hours} onChange={event => setHours(event.target.value)} className="border border-border bg-background px-3 py-2 text-sm text-foreground">
            <option value="24">24 hours</option>
            <option value="168">7 days</option>
            <option value="720">30 days</option>
          </select>
        </label>
        <Button type="submit" variant="outline" disabled={!token || busy}>{busy ? "Loading" : "Load report"}</Button>
      </form>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {report && (
        <section className="mt-8 overflow-x-auto">
          <h2 className="text-sm font-semibold">Last {report.window_hours} hours</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-border py-4 sm:grid-cols-4">
            <Metric label="Requests" value={report.totals.requests} />
            <Metric label="Succeeded / failed" value={`${report.totals.successful} / ${report.totals.failed}`} />
            <Metric label="Average duration" value={`${report.totals.avg_duration_ms} ms`} />
            <Metric label="Audio generated" value={formatBytes(report.totals.audio_bytes)} />
            <Metric label="Characters in / out" value={`${report.totals.input_chars} / ${report.totals.output_chars}`} />
            <Metric label="Cache hits" value={report.totals.cached} />
            <Metric label="Estimated input tokens" value={report.totals.estimated_input_tokens} />
            <Metric label="Reported input tokens" value={report.totals.provider_input_tokens} />
            <Metric label="Reported output tokens" value={report.totals.provider_output_tokens} />
          </dl>
          <table className="mt-6 w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Service</th>
                <th className="py-2 pr-4 font-medium">Requests</th>
                <th className="py-2 pr-4 font-medium">Success / failed</th>
                <th className="py-2 pr-4 font-medium">Cache hits</th>
                <th className="py-2 pr-4 font-medium">Characters in / out</th>
                <th className="py-2 pr-4 font-medium">Estimated input tokens</th>
                <th className="py-2 pr-4 font-medium">Reported tokens in / out</th>
                <th className="py-2 font-medium">Avg. ms</th>
              </tr>
            </thead>
            <tbody>
              {report.services.map(service => (
                <tr key={service.service} className="border-b border-border">
                  <td className="py-3 pr-4 font-medium">{service.service}</td>
                  <td className="py-3 pr-4">{service.requests}</td>
                  <td className="py-3 pr-4">{service.successful} / {service.failed}</td>
                  <td className="py-3 pr-4">{service.cached}</td>
                  <td className="py-3 pr-4">{service.input_chars} / {service.output_chars}</td>
                  <td className="py-3 pr-4">{service.estimated_input_tokens}</td>
                  <td className="py-3 pr-4">{service.provider_input_tokens} / {service.provider_output_tokens}</td>
                  <td className="py-3">{service.avg_duration_ms}</td>
                </tr>
              ))}
              {report.services.length === 0 && <tr><td colSpan={8} className="py-5 text-muted-foreground">No requests in this window.</td></tr>}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">Input tokens are estimated from spoken text. Reported token totals are included only when a provider returns usage data. Request text and credentials are never stored in this report.</p>
        </section>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-medium tabular-nums">{value}</dd></div>;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
