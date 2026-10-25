import { AsyncLocalStorage } from "node:async_hooks";
import { SSG_BUILD_CONTEXT } from "./build-context.generated";

/**
 * Fail-closed integration mode for every paid or mutating outbound call.
 *
 * Netlify documents CONTEXT as a build-time read-only variable (production,
 * deploy-preview, branch-deploy, dev). Function runtime is guaranteed only
 * URL, SITE_NAME, and SITE_ID, so a runtime read of CONTEXT is undefined on
 * both production and preview and cannot be the live switch.
 *
 * Live production calls require both:
 * 1. The build-baked context is exactly "production" (scripts/write-build-context.mjs).
 * 2. The request Host header, or the site URL host when there is no request,
 *    is on LEAD_PRODUCTION_HOSTS (default: the SSG apex, www, and
 *    ssg-site.netlify.app). X-Forwarded-Host is used only when it matches Host.
 *    Mock and live-test never run on those hosts, even if the allowlist is
 *    missing or unparseable. LEAD_LIVE_TEST on a production host fails closed.
 *
 * A runtime CONTEXT value, when present, can only force mock. It cannot
 * promote a preview build to live. A production credential never enables live
 * calls by itself. LEAD_LIVE_TEST=true is the only non-production opt-in, and
 * it never uses production HubSpot credentials.
 */

export const PRODUCTION_HUBSPOT_PORTAL_ID = "246622244";

export const DEFAULT_PRODUCTION_HOSTS = [
  "shipleysolutionsgroup.com",
  "www.shipleysolutionsgroup.com",
  "ssg-site.netlify.app",
];

export type RuntimeMode = "mock" | "live" | "live-test";

export type ModeBlock = "production_portal" | "live_test_on_prod_host";

export type ModeDecision = {
  mode: RuntimeMode;
  block: ModeBlock | null;
};

export type Env = Record<string, string | undefined>;

const hostStore = new AsyncLocalStorage<string | null>();

export function readBuildContext(): string {
  return SSG_BUILD_CONTEXT === "production" ? "production" : "non-production";
}

export function normalizeHost(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!first || first.includes("://") || first.includes("/") || first.includes(" ")) return null;
  const host = first.replace(/\.$/, "").replace(/:\d+$/, "");
  if (!host || !/^[a-z0-9.-]+$/.test(host) || host.startsWith(".") || host.endsWith(".")) return null;
  return host;
}

export function hostFromHeaders(headers: { get(name: string): string | null }): string | null {
  const host = normalizeHost(headers.get("host"));
  const forwarded = normalizeHost(headers.get("x-forwarded-host"));
  if (host && forwarded && host === forwarded) return host;
  if (host) return host;
  return null;
}

/** A production build that still resolved to mock must not pretend the lead was stored. */
export function productionModeMismatch(buildContext: string, decision: ModeDecision): boolean {
  return buildContext === "production" && decision.mode === "mock";
}

export function hostFromUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return normalizeHost(new URL(value).hostname);
  } catch {
    return null;
  }
}

export function productionHosts(env: Env): { hosts: string[]; unparseable: boolean } {
  const raw = env.LEAD_PRODUCTION_HOSTS;
  if (raw == null || raw.trim() === "") return { hosts: [...DEFAULT_PRODUCTION_HOSTS], unparseable: false };
  const hosts: string[] = [];
  for (const part of raw.split(",")) {
    const host = normalizeHost(part);
    if (part.trim() && !host) return { hosts: [], unparseable: true };
    if (host && !hosts.includes(host)) hosts.push(host);
  }
  if (!hosts.length) return { hosts: [], unparseable: true };
  return { hosts, unparseable: false };
}

/**
 * Hosts that must never run mock or live-test. A broken LEAD_PRODUCTION_HOSTS
 * value cannot remove the built-in production hosts from this set.
 */
export function productionScopeHosts(env: Env): string[] {
  const { hosts, unparseable } = productionHosts(env);
  const scope = new Set<string>(DEFAULT_PRODUCTION_HOSTS);
  if (!unparseable) for (const host of hosts) scope.add(host);
  return [...scope];
}

export function hostInProductionScope(host: string | null | undefined, env: Env): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  return productionScopeHosts(env).includes(normalized);
}

export function runWithRequestHost<T>(host: string | null, fn: () => T): T {
  return hostStore.run(host, fn);
}

export function currentRequestHost(): string | null | undefined {
  return hostStore.getStore();
}

function liveTestDecision(env: Env): ModeDecision {
  const portal = (env.HUBSPOT_TEST_PORTAL_ID || "").trim();
  if (portal === PRODUCTION_HUBSPOT_PORTAL_ID) return { mode: "mock", block: "production_portal" };
  const token = (env.HUBSPOT_TEST_ACCESS_TOKEN || "").trim();
  if (!portal || !token) return { mode: "mock", block: null };
  return { mode: "live-test", block: null };
}

/**
 * Pure mode decision. Live is returned only for a production build whose host
 * is allowlisted. Any other build context, a non-production runtime CONTEXT,
 * a missing host, or an unparseable host list is mock.
 */
export function decideRuntimeMode(input: {
  buildContext?: string | null;
  runtimeContext?: string | null;
  host?: string | null;
  env?: Env;
}): ModeDecision {
  const env = input.env ?? {};
  const runtime = input.runtimeContext;
  const buildIsProduction = input.buildContext === "production";
  const host = normalizeHost(input.host);
  const { hosts, unparseable } = productionHosts(env);
  const hostAllowed = Boolean(host && !unparseable && hosts.includes(host));
  const runtimeAllowsProduction = runtime == null || runtime === "" || runtime === "production";
  const liveTest = env.LEAD_LIVE_TEST;

  // The flag must never select live-test on a production host, including a
  // production bake on ssg-site.netlify.app and a non-production bake on the apex.
  if (liveTest === "true" && hostInProductionScope(host, env)) {
    return { mode: "mock", block: "live_test_on_prod_host" };
  }

  // Production capture stays live only for a production build on an allowlisted
  // host. A non-production runtime CONTEXT, when one is actually present, cannot
  // be promoted and instead forces the request off the production path.
  if (buildIsProduction && hostAllowed && runtimeAllowsProduction) return { mode: "live", block: null };

  if (liveTest != null && liveTest !== "" && liveTest !== "true" && liveTest !== "false") {
    return { mode: "mock", block: null };
  }
  if (liveTest === "true") return liveTestDecision(env);
  return { mode: "mock", block: null };
}

export function currentDecision(env: Env = process.env): ModeDecision {
  const requestHost = hostStore.getStore();
  const host = requestHost === undefined ? hostFromUrl(env.URL) : requestHost;
  return decideRuntimeMode({
    buildContext: readBuildContext(),
    runtimeContext: env.CONTEXT,
    host,
    env,
  });
}

export function modeLabel(decision: ModeDecision): RuntimeMode {
  return decision.block ? "mock" : decision.mode;
}
