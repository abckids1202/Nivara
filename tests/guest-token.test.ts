import assert from "node:assert/strict";
import test from "node:test";
import { createGuestOrderToken, hashGuestOrderToken } from "../lib/guest-token.ts";

void test("guest tokens are random and only their hash is persisted", () => {
  const token = createGuestOrderToken();
  assert.ok(token.rawToken.length >= 40);
  assert.notEqual(token.rawToken, token.tokenHash);
  assert.equal(hashGuestOrderToken(token.rawToken), token.tokenHash);
});
