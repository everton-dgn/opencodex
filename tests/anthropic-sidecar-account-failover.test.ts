import { afterAll, afterEach, beforeAll, beforeEach, expect, mock, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProviderAdapter } from "../src/adapters/base";
import {
  clearAnthropicAccountPoolState,
} from "../src/oauth/anthropic-routing";
import { clearGenericFailoverHealth } from "../src/oauth/generic-account-failover";
import { getAccountSet, saveCredential, setActiveAccount } from "../src/oauth/store";
import type { AdapterEvent, OcxConfig, OcxParsedRequest, OcxProviderConfig } from "../src/types";
import { removeTreeWithRetry } from "./helpers/remove-tree";

const previousHome = process.env.OPENCODEX_HOME;
let testHome = "";
let handleResponses: typeof import("../src/server/responses")["handleResponses"];
let observedKeys: string[] = [];
let sidecarMode = false;
let kiroBuilds: Array<{ key: string; profileArn?: string; apiRegion?: string }> = [];

function fixtureAdapter(provider: OcxProviderConfig): ProviderAdapter {
  return {
    name: "anthropic",
    buildRequest() {
      return {
        url: provider.baseUrl,
        method: "POST",
        headers: { authorization: `Bearer ${provider.apiKey ?? ""}` },
        body: "{}",
      };
    },
    async *parseStream() {
      yield { type: "done" as const };
    },
  };
}

function kiroContinuationEvents(phase: string): AdapterEvent[] {
  if (phase === "plan") {
    return [
      { type: "text_delta", text: "I will modify the file now." },
      { type: "done", stopReason: "end_turn" },
    ];
  }
  if (phase === "complete") {
    return [
      { type: "tool_call_start", id: "call_read", name: "read_file" },
      { type: "tool_call_delta", arguments: "{}" },
      { type: "tool_call_end" },
      { type: "done", stopReason: "tool_use" },
    ];
  }
  throw new Error(`unexpected phase: ${phase}`);
}

function kiroFixtureAdapter(provider: OcxProviderConfig): ProviderAdapter {
  return {
    // Anthropic enables the bounded terminal continuation, while the provider id remains
    // Kiro so generic OAuth snapshot pairing is exercised.
    name: "anthropic",
    buildRequest(parsed: OcxParsedRequest) {
      kiroBuilds.push({
        key: provider.apiKey ?? "",
        ...(parsed._kiroAuthContext?.profileArn
          ? { profileArn: parsed._kiroAuthContext.profileArn }
          : {}),
        ...(parsed._kiroAuthContext?.apiRegion
          ? { apiRegion: parsed._kiroAuthContext.apiRegion }
          : {}),
      });
      return {
        url: provider.baseUrl,
        method: "POST",
        headers: { authorization: `Bearer ${provider.apiKey ?? ""}` },
        body: "{}",
      };
    },
    async *parseStream(response: Response): AsyncGenerator<AdapterEvent> {
      yield* kiroContinuationEvents(response.headers.get("x-test-phase") ?? "");
    },
  };
}

beforeAll(async () => {
  const actualResolver = await import("../src/server/adapter-resolve");
  const actualResolveAdapter = actualResolver.resolveAdapter;
  mock.module("../src/server/adapter-resolve", () => ({
    ...actualResolver,
    resolveAdapter(provider: OcxProviderConfig, cacheRetention?: "none" | "short" | "long") {
      if (provider.adapter === "test-anthropic-sidecar") return fixtureAdapter(provider);
      if (
        provider.adapter === "test-kiro-continuation"
        || (provider.adapter === "kiro" && provider.apiKey?.startsWith("kiro-access-"))
      ) return kiroFixtureAdapter(provider);
      return actualResolveAdapter(provider, cacheRetention);
    },
  }));

  mock.module("../src/web-search", () => ({
    buildWebSearchTool: () => ({
      name: "web_search",
      parameters: { type: "object", properties: {} },
    }),
    planWebSearch: () => sidecarMode
      ? {
          backend: "anthropic",
          hostedTool: { type: "web_search" },
          settings: { model: "claude-haiku-4-5", reasoning: "low", timeoutMs: 1_000 },
          maxSearches: 1,
        }
      : undefined,
    shouldResolveOpenAiWebSearchSidecar: () => false,
    runWithWebSearch: async (args: {
      parsed: OcxParsedRequest;
      adapter: ProviderAdapter;
      on429?: (retryAfter: string | null) => Promise<ProviderAdapter | null>;
    }) => {
      const first = await args.adapter.buildRequest(args.parsed);
      observedKeys.push(new Headers(first.headers).get("authorization") ?? "");
      const rotated = await args.on429?.("30");
      if (!rotated) throw new Error("Anthropic sidecar did not rotate after 429");
      const second = await rotated.buildRequest(args.parsed);
      observedKeys.push(new Headers(second.headers).get("authorization") ?? "");
      return new Response("sidecar-ok", { status: 200 });
    },
  }));

  ({ handleResponses } = await import("../src/server/responses"));
});

beforeEach(() => {
  testHome = mkdtempSync(join(tmpdir(), "ocx-oauth-429-boundaries-"));
  process.env.OPENCODEX_HOME = testHome;
  observedKeys = [];
  kiroBuilds = [];
  sidecarMode = false;
  clearAnthropicAccountPoolState();
  clearGenericFailoverHealth();
});

afterEach(() => {
  clearAnthropicAccountPoolState();
  clearGenericFailoverHealth();
  removeTreeWithRetry(testHome);
});

afterAll(() => {
  if (previousHome === undefined) delete process.env.OPENCODEX_HOME;
  else process.env.OPENCODEX_HOME = previousHome;
  mock.restore();
});

test("Anthropic web-search sidecar rotates on 429 when proactive pooling is disabled", async () => {
  sidecarMode = true;
  for (let index = 0; index < 2; index += 1) {
    await saveCredential("anthropic", {
      access: `anthropic-access-${index}`,
      refresh: `anthropic-refresh-${index}`,
      expires: Date.now() + 3_600_000,
      accountId: `anthropic-account-${index}`,
    } as never, { addAccount: true });
  }
  const ids = getAccountSet("anthropic")!.accounts.map(account => account.id);
  await setActiveAccount("anthropic", ids[0]!);

  const config = {
    port: 0,
    defaultProvider: "anthropic",
    anthropicAccountPool: { enabled: false, strategy: "round-robin" },
    providers: {
      anthropic: {
        adapter: "test-anthropic-sidecar",
        baseUrl: "https://anthropic-sidecar.test/v1",
        authMode: "oauth",
        models: ["model"],
      },
    },
  } as unknown as OcxConfig;

  const response = await handleResponses(new Request("http://localhost/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "anthropic/model",
      input: "search",
      stream: true,
      tools: [{ type: "web_search" }],
    }),
  }), config, { model: "", provider: "" });

  expect(response.status).toBe(200);
  expect(await response.text()).toBe("sidecar-ok");
  expect(observedKeys).toEqual([
    "Bearer anthropic-access-0",
    "Bearer anthropic-access-1",
  ]);
});

test("Kiro continuation 429 keeps the rotated bearer and routing metadata together", async () => {
  const profiles = [
    "arn:aws:codewhisperer:us-east-1:123456789012:profile/account-a",
    "arn:aws:codewhisperer:eu-west-1:123456789012:profile/account-b",
  ];
  const regions = ["us-east-1", "eu-west-1"];
  for (let index = 0; index < 2; index += 1) {
    await saveCredential("kiro", {
      access: `kiro-access-${index}`,
      refresh: `kiro-refresh-${index}`,
      expires: Date.now() + 3_600_000,
      accountId: `kiro-account-${index}`,
      kiro: {
        profileArn: profiles[index],
        apiRegion: regions[index],
        ssoRegion: regions[index],
      },
    } as never, { addAccount: true });
  }
  const ids = getAccountSet("kiro")!.accounts.map(account => account.id);
  await setActiveAccount("kiro", ids[0]!);

  const config = {
    port: 0,
    defaultProvider: "kiro",
    providers: {
      kiro: {
        adapter: "test-kiro-continuation",
        baseUrl: "https://kiro-continuation.test/v1",
        authMode: "oauth",
        models: ["model"],
      },
    },
  } as unknown as OcxConfig;

  const phases = ["plan", "rate-limit", "complete"];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    const phase = phases.shift();
    if (phase === "rate-limit") {
      return Response.json(
        { error: { message: "rate limited" } },
        { status: 429, headers: { "retry-after": "30" } },
      );
    }
    if (!phase) throw new Error("unexpected extra request");
    return new Response("", { status: 200, headers: { "x-test-phase": phase } });
  }) as typeof fetch;

  try {
    const response = await handleResponses(new Request("http://localhost/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "kiro/model",
        input: "Please modify the file",
        stream: true,
        tools: [{
          type: "function",
          name: "read_file",
          description: "Read one file",
          parameters: { type: "object", properties: {} },
        }],
      }),
    }), config, { model: "", provider: "" });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("read_file");
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(kiroBuilds).toEqual([
    { key: "kiro-access-0", profileArn: profiles[0], apiRegion: regions[0] },
    { key: "kiro-access-0", profileArn: profiles[0], apiRegion: regions[0] },
    { key: "kiro-access-1", profileArn: profiles[1], apiRegion: regions[1] },
  ]);
  expect(phases).toEqual([]);
});
