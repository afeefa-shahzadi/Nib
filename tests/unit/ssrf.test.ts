import { test } from "node:test"
import assert from "node:assert/strict"
import { isPrivateAddress } from "@/lib/ssrf"

test("blocks loopback, private, link-local, CGNAT", () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fe80::1",
    "fc00::1",
    "::ffff:127.0.0.1", // IPv4-mapped loopback
    "not-an-ip",
  ]) {
    assert.equal(isPrivateAddress(ip), true, `${ip} should be blocked`)
  }
})

test("allows public addresses", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "192.169.0.1", "2606:4700:4700::1111"]) {
    assert.equal(isPrivateAddress(ip), false, `${ip} should be allowed`)
  }
})
