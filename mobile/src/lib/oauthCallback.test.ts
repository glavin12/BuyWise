import assert from "node:assert/strict";
import { test } from "node:test";
import { oauthCode } from "./oauthCallback.ts";

const native = "buywise://auth/callback";
const web = "http://localhost:8081/auth/callback";

test("accepts a PKCE code only on the expected mobile or web callback", () => {
  for (const redirect of [native, web]) {
    assert.equal(oauthCode(`${redirect}?code=one-time-code`, redirect), "one-time-code");
  }
});

test("rejects provider errors, missing codes and token fragments without echoing secrets", () => {
  for (const query of ["?error=access_denied&error_description=secret", "", "?code=ok#access_token=secret"]) {
    assert.throws(() => oauthCode(native + query, native), (error: Error) => !error.message.includes("secret"));
  }
});

test("rejects callbacks for other apps, hosts and paths", () => {
  for (const url of ["evil://auth/callback?code=x", "buywise://evil/callback?code=x", "buywise://auth/other?code=x", "https://evil.test/auth/callback?code=x", "http://localhost:9090/auth/callback?code=x"]) {
    assert.throws(() => oauthCode(url, url.startsWith("http") ? web : native), /Unexpected/);
  }
});
