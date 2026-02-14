import { lookup } from "dns/promises";

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

function stripBrackets(hostname: string): string {
  if (hostname.startsWith("[") && hostname.endsWith("]"))
    return hostname.slice(1, -1);
  return hostname;
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => n < 0 || n > 255 || isNaN(n)))
    return true; // malformed => block
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local + metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGN)
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (/^f[cd]/i.test(lower)) return true; // fc00::/7 (ULA)
  if (/^fe[89ab]/i.test(lower)) return true; // fe80::/10 (link-local)
  const v4 = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) return isPrivateIPv4(v4[1]);
  return false;
}

/** Validate URL scheme, port, and hostname (no DNS). */
export function validateUrl(url: URL): boolean {
  if (!["http:", "https:"].includes(url.protocol)) return false;
  if (url.port && url.port !== "80" && url.port !== "443") return false;
  const host = stripBrackets(url.hostname).toLowerCase();
  if (host === "localhost" || host === "0.0.0.0") return false;
  if (IPV4_RE.test(host) && isPrivateIPv4(host)) return false;
  if (host.includes(":") && isPrivateIPv6(host)) return false;
  return true;
}

/** DNS-resolve hostname and reject private/reserved IPs. */
export async function dnsCheck(hostname: string): Promise<boolean> {
  const host = stripBrackets(hostname);
  if (IPV4_RE.test(host)) return !isPrivateIPv4(host);
  if (host.includes(":")) return !isPrivateIPv6(host);
  try {
    const results = await lookup(host, { all: true });
    if (results.length === 0) return false;
    for (const r of results) {
      if (r.family === 4 && isPrivateIPv4(r.address)) return false;
      if (r.family === 6 && isPrivateIPv6(r.address)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
