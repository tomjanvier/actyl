import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { proxy } from "../proxy";

const secret = "test-secret-with-sufficient-length";

test("protected redirects and responses are private and non-cacheable", async () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = secret;
  try {
    const redirect = await proxy(new NextRequest("https://actyl.example/settings"));
    assert.equal(redirect.status, 307);
    assert.equal(redirect.headers.get("cache-control"), "private, no-store");
    assert.equal(redirect.headers.get("pragma"), "no-cache");

    const token = await new SignJWT({ sub: "user-test" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(secret));
    const request = new NextRequest("https://actyl.example/settings", {
      headers: { cookie: `actyl_session=${token}` },
    });
    const response = await proxy(request);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("pragma"), "no-cache");
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});

test("API route responses carry non-cacheable headers", async () => {
  const response = await proxy(new NextRequest("https://actyl.example/api/account"));
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("pragma"), "no-cache");
});
