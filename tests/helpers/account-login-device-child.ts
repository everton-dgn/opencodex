/**
 * Device-login child for #3366. The pre-poll block is written straight to fd 1
 * (see `writeStdoutFully`, #1007), so it cannot be observed through the
 * in-process console capture the rest of the CLI suite uses — the code and the
 * verification URL have to be read from a real piped stdout.
 */
import { cmdAccount, type AccountDeps } from "../../src/cli/account";

let sawDeviceRequest = false;

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "POST" && url.pathname === "/api/codex-auth/login") {
      const body = (await req.json().catch(() => ({}))) as { device?: boolean };
      sawDeviceRequest = body.device === true;
      return Response.json({
        url: "https://auth.openai.com/codex/device",
        instructions: "Enter code: ABCD-EFGH",
        deviceCode: "ABCD-EFGH",
        flowId: "flow-device",
      });
    }
    if (url.pathname === "/api/codex-auth/login-status") {
      // Never resolves: the operator is still entering the code elsewhere.
      return Response.json({ status: "pending" });
    }
    return Response.json({ error: "unhandled" }, 404);
  },
});

const deps: AccountDeps = {
  baseUrl: `http://127.0.0.1:${server.port}`,
  loadConfigImpl: () => ({ providers: {} }) as ReturnType<NonNullable<AccountDeps["loadConfigImpl"]>>,
};

// Report the request shape on stdout too, so the parent can assert the flag
// actually reached the server rather than only that output looked right.
setTimeout(() => {
  if (sawDeviceRequest) process.stdout.write("device-requested\n");
}, 500);

await cmdAccount(["login", "openai", "--device"], deps);
server.stop(true);
