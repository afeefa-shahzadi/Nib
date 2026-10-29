import net from "net"

// True if `ip` is a loopback / private / link-local / CGNAT address that an
// SSRF-exposed fetch must refuse (e.g. cloud metadata at 169.254.169.254,
// RFC1918, ::1). Anything that doesn't parse as an IP is treated as blocked —
// callers resolve hostnames to IPs first and pass the resolved addresses here.
export function isPrivateAddress(ip: string): boolean {
  const v = net.isIP(ip)
  if (v === 4) return isPrivateV4(ip)
  if (v === 6) {
    const lower = ip.toLowerCase()
    if (lower === "::1" || lower === "::") return true
    if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateV4(mapped[1])
    return false
  }
  return true // not a parseable IP → refuse
}

function isPrivateV4(ip: string): boolean {
  const p = ip.split(".").map(Number)
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true
  const [a, b] = p
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) // CGNAT 100.64/10
  )
}
