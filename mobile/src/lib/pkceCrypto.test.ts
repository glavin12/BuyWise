import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("the native PKCE adapter uses secure random values and SHA-256", async () => {
  const source = readFileSync(new URL("./pkceCrypto.native.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  let randomCalls = 0;
  const context = { exports: {}, crypto: undefined as unknown as Crypto, require: () => ({
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
    digest: (algorithm: string, data: Parameters<typeof webcrypto.subtle.digest>[1]) => webcrypto.subtle.digest(algorithm, data),
    getRandomValues: (values: Uint8Array<ArrayBuffer>) => { randomCalls++; return webcrypto.getRandomValues(values); },
    randomUUID: () => webcrypto.randomUUID(),
  }) };
  runInNewContext(code, context);
  const values = context.crypto.getRandomValues(new Uint8Array(32));
  assert.equal(randomCalls, 1);
  assert.ok(values.some(value => value !== 0));
  const hash = await context.crypto.subtle.digest("SHA-256", new TextEncoder().encode("abc"));
  assert.equal(Buffer.from(hash).toString("hex"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.throws(() => context.crypto.subtle.digest("SHA-1", new Uint8Array()), /Only SHA-256/);
});
