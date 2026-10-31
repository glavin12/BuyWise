import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
async function check(query, failure, expected, calls) {
  let exchanges = 0;
  const exports = {};
  runInNewContext(code, { exports, URL, Response, require: () => {
    return {createClient: async () => ({auth:{exchangeCodeForSession: async (value, options) => {
      assert.equal(options?.flowId, new URLSearchParams(query).get("sb_flow_id") ?? undefined);
      exchanges++; assert.equal(value, 'test-code');
      if (failure === 'throw') throw new Error('network');
      return {error: failure ? {message:'invalid code'} : null};
    }}})};
  }});
  const response = await exports.GET(new Request('https://internal-host/auth/callback'+query));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), expected);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(exchanges,calls);
}
test('OAuth callback exchanges codes and safely handles failures', async () => {
  await check('?code=test-code', false, '/chat', 1);
  await check('?code=test-code&sb_flow_id=flow_12345678', false, '/chat', 1);
  await check('?code=test-code&next=https://evil.test', false, '/chat', 1);
  await check('', false, '/login?auth_error=google', 0);
  await check('?code=test-code&error=access_denied', false, '/login?auth_error=google', 0);
  await check('?code=test-code', true, '/login?auth_error=google', 1);
  await check('?code=test-code', 'throw', '/login?auth_error=google', 1);
  console.log('Web callback: 7 checks passed (success, safe redirect, missing code, denied consent, expired code, network failure).');
});
