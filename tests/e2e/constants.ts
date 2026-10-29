// TEST-ONLY, obviously fake values. Never use as real secrets.
export const TEST_BYOK_KEY = {
  // 32 bytes hex (64 chars): AES key the webServer is started with under Playwright.
  encryptionKey: "0".repeat(60) + "e2e0",
  plain: "sk-test-e2e",
}
