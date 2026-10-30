import { test } from "node:test"
import assert from "node:assert/strict"
import { normalizePiecePrice, MIN_PIECE_PRICE_PAISE, MAX_PIECE_PRICE_PAISE } from "@/lib/piece-price"

test("empty or zero price means not for sale", () => {
  for (const v of [null, undefined, "", 0]) assert.equal(normalizePiecePrice(v), null)
})

test("valid price passes through as integer paise", () => {
  assert.equal(normalizePiecePrice(MIN_PIECE_PRICE_PAISE), MIN_PIECE_PRICE_PAISE)
  assert.equal(normalizePiecePrice(4900), 4900)
})

test("below minimum, above maximum, fractional or junk is rejected", () => {
  for (const v of [MIN_PIECE_PRICE_PAISE - 1, MAX_PIECE_PRICE_PAISE + 1, 1000.5, -1000, "abc", NaN])
    assert.throws(() => normalizePiecePrice(v))
})
