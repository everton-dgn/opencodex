import { afterEach, beforeEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import type { Root } from "react-dom/client";
import { LanguageProvider } from "../src/i18n/provider";
import { writeOpenBrowserPref } from "../src/oauth-open-browser-pref";
import AddCodexAccountModal from "../src/components/AddCodexAccountModal";

/**
 * A device login (#3366) is useless without the short code: the user opens the
 * verification page on another machine and types it there. The Codex modal used
 * to pass only `url` into LoginHint, so the code the server sent was dropped on
 * the floor even though the shared renderer knows how to display one.
 */

const DEVICE_URL = "https://auth.openai.com/codex/device";
const DEVICE_CODE = "ABCD-EFGH";

const globals = ["document", "window", "navigator", "localStorage", "IS_REACT_ACT_ENVIRONMENT"] as const;
let previous: Record<(typeof globals)[number], unknown>;
let win: Window;
let host: HTMLElement;
let root: Root | null = null;
let originalFetch: typeof globalThis.fetch;
let statusHolders: Array<{ resolve: (value: Response) => void }> = [];
let loginHolders: Array<{ resolve: () => void }> = [];
let loginBodies: Array<Record<string, unknown>> = [];

beforeEach(() => {
  previous = Object.fromEntries(globals.map((k) => [k, Reflect.get(globalThis, k)])) as typeof previous;
  win = new Window({ url: "http://localhost/" });
  Object.defineProperty(win.navigator, "language", { configurable: true, value: "en-US" });
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: win.document },
    window: { configurable: true, value: win },
    navigator: { configurable: true, value: win.navigator },
    localStorage: { configurable: true, value: win.localStorage },
  });
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // "Don't open a browser on the proxy machine" is what selects the device
  // grant: the operator is not sitting at the host.
  writeOpenBrowserPref(false);

  originalFetch = globalThis.fetch;
  statusHolders = [];
  loginHolders = [];
  loginBodies = [];
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname === "/api/codex-auth/login") {
        loginBodies.push(
          typeof init?.body === "string"
            ? (JSON.parse(init.body) as Record<string, unknown>)
            : {},
        );
        return await new Promise<Response>((resolve) => {
          loginHolders.push({
            resolve: () => resolve(Response.json({
              url: DEVICE_URL,
              flowId: "flow-device",
              deviceCode: DEVICE_CODE,
              instructions: `Enter code: ${DEVICE_CODE}`,
            })),
          });
        });
      }
      if (url.pathname === "/api/codex-auth/login-status") {
        return await new Promise<Response>((resolve) => { statusHolders.push({ resolve }); });
      }
      return Response.json({});
    },
  });

  host = win.document.createElement("div") as unknown as HTMLElement;
  win.document.body.appendChild(host as never);
});

afterEach(async () => {
  for (const holder of loginHolders.splice(0)) holder.resolve();
  for (const holder of statusHolders.splice(0)) holder.resolve(Response.json({ status: "pending" }));
  if (root) {
    const current = root;
    await act(async () => { current.unmount(); });
    root = null;
  }
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  for (const key of globals) {
    Object.defineProperty(globalThis, key, { configurable: true, value: previous[key] });
  }
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: originalFetch });
  await win.happyDOM?.close?.();
});

async function mountReauthModal() {
  const { createRoot } = await import("react-dom/client");
  await act(async () => {
    root = createRoot(host);
    root.render(
      <LanguageProvider>
        <AddCodexAccountModal apiBase="" onClose={() => {}} onAdded={() => {}} reauthAccountId="acct-1" />
      </LanguageProvider>,
    );
  });
  await act(async () => {
    while (loginHolders.length === 0) await new Promise((r) => setTimeout(r, 0));
    for (const holder of loginHolders.splice(0)) holder.resolve();
    await new Promise((r) => setTimeout(r, 0));
  });
}

test("a device login renders the short code, not just the verification URL", async () => {
  await mountReauthModal();

  // Without this the test is false-green: the mock would answer with a device
  // payload no matter what the GUI asked for.
  expect(loginBodies[0]).toMatchObject({ device: true });

  // The code element is what LoginHint renders for a device flow; asserting on
  // it rather than raw text proves the field arrived rather than appearing
  // incidentally inside the instructions prose.
  const code = host.querySelector(".login-hint-device-code");
  expect(code).toBeTruthy();
  expect(code?.textContent).toBe(DEVICE_CODE);
  expect(host.textContent).toContain(DEVICE_URL);
});

test("the default browser flow does not ask for a device login", async () => {
  // No preference expressed: the callback flow must stay the default.
  window.localStorage.removeItem("ocx.oauth.openBrowser");
  await mountReauthModal();

  expect(loginBodies[0]?.device).toBeUndefined();
});
