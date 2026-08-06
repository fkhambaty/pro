const MAX_REDIRECTS = 4;
const DEFAULT_TIMEOUT_MS = 8_000;

export type SafeFetchResult = {
  ok: boolean;
  status: number;
  finalUrl: string;
};

function isBlockedIpv4(value: string): boolean {
  const parts = value.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedIpv6(value: string): boolean {
  const ip = value.toLowerCase().replace(/^\[|\]$/g, "");
  if (ip === "::" || ip === "::1") return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(ip)) return true;
  const mapped = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isBlockedIpv4(mapped[1]) : false;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "localhost" ||
    host === "metadata" ||
    host === "metadata.google.internal" ||
    host === "169.254.169.254" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    isBlockedIpv4(host) ||
    isBlockedIpv6(host)
  );
}

async function assertPublicHttps(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL is invalid");
  }
  if (url.protocol !== "https:") throw new Error("Only HTTPS URLs are allowed");
  if (url.username || url.password) throw new Error("URL credentials are not allowed");
  if (url.port && url.port !== "443") throw new Error("Only the standard HTTPS port is allowed");
  if (isBlockedHostname(url.hostname)) throw new Error("Private network URLs are not allowed");

  // Resolve every hop before fetching it. This blocks friendly hostnames that
  // point at loopback, RFC1918, link-local, or cloud metadata addresses.
  if (!isBlockedIpv4(url.hostname) && !isBlockedIpv6(url.hostname)) {
    const addresses = new Set<string>();
    for (const recordType of ["A", "AAAA"] as const) {
      try {
        const records = await Deno.resolveDns(url.hostname, recordType);
        records.forEach((address) => addresses.add(address));
      } catch {
        // A host commonly has only one record family.
      }
    }
    if (addresses.size === 0) throw new Error("Host could not be resolved");
    for (const address of addresses) {
      if (isBlockedIpv4(address) || isBlockedIpv6(address)) {
        throw new Error("Host resolves to a private network");
      }
    }
  }
  return url;
}

/**
 * Fetch an untrusted public URL without following redirects implicitly.
 * Each redirect target is revalidated and DNS checked before the next request.
 */
export async function safeFetch(
  rawUrl: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<SafeFetchResult> {
  let current = rawUrl;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    let url: URL;
    try {
      url = await assertPublicHttps(current);
    } catch {
      return { ok: false, status: 0, finalUrl: current };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "OkavoExamBot/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || redirects === MAX_REDIRECTS) {
          return { ok: false, status: response.status, finalUrl: url.href };
        }
        current = new URL(location, url).href;
        continue;
      }

      await response.body?.cancel();
      return { ok: response.ok, status: response.status, finalUrl: url.href };
    } catch {
      return { ok: false, status: 0, finalUrl: url.href };
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, status: 0, finalUrl: current };
}
