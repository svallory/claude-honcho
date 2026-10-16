import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { home } from "./helpers/home";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";


let loadConfig: typeof import("../src/config").loadConfig;
let applySessionPeer: typeof import("../src/config").applySessionPeer;
let state: typeof import("../src/state");

const HONCHO_ENV = ["HONCHO_API_KEY", "HONCHO_PEER_NAME", "HONCHO_AI_PEER", "HONCHO_WORKSPACE", "HONCHO_SAVE_MESSAGES", "HONCHO_ENABLED"];

function writeConfig(extra: Record<string, unknown> = {}) {
  mkdirSync(join(home, ".honcho"), { recursive: true });
  writeFileSync(join(home, ".honcho", "config.json"), JSON.stringify({
    apiKey: "k",
    peerName: "saulo",
    aiPeer: "claude",
    workspace: "ws",
    ...extra,
  }));
}

beforeAll(async () => {
  ({ loadConfig, applySessionPeer } = await import("../src/config"));
  state = await import("../src/state");
});
beforeEach(() => {
  for (const k of HONCHO_ENV) delete process.env[k];
  writeConfig();
});

describe("session peer override (state.ts)", () => {
  test("round-trips and merges patches", () => {
    expect(state.getSessionPeer("s1")).toBeNull();
    state.setSessionPeer("s1", { aiPeer: "honcho-lead" });
    expect(state.getSessionPeer("s1")?.aiPeer).toBe("honcho-lead");
    state.setSessionPeer("s1", { peerName: "mx-lead" });
    const got = state.getSessionPeer("s1");
    expect(got?.aiPeer).toBe("honcho-lead");
    expect(got?.peerName).toBe("mx-lead");
    expect(got?.setAt).toBeGreaterThan(0);
  });

  test("is per session", () => {
    state.setSessionPeer("a", { aiPeer: "one" });
    expect(state.getSessionPeer("b")).toBeNull();
    expect(state.getSessionPeer(undefined)).toBeNull();
    expect(state.getSessionPeer(null)).toBeNull();
  });

  test("clearSessionPeer and clearSessionFiles remove it", () => {
    state.setSessionPeer("c", { aiPeer: "x" });
    state.clearSessionPeer("c");
    expect(state.getSessionPeer("c")).toBeNull();
    state.setSessionPeer("d", { aiPeer: "x" });
    state.clearSessionFiles("d");
    expect(existsSync(join(home, ".honcho", "peer-d.json"))).toBe(false);
  });

  test("ignores a corrupt or empty file", () => {
    writeFileSync(join(home, ".honcho", "peer-bad.json"), "{nope");
    expect(state.getSessionPeer("bad")).toBeNull();
    writeFileSync(join(home, ".honcho", "peer-empty.json"), JSON.stringify({ setAt: 1 }));
    expect(state.getSessionPeer("empty")).toBeNull();
  });
});

describe("applySessionPeer precedence", () => {
  test("override beats the config file", () => {
    state.setSessionPeer("s2", { aiPeer: "honcho-lead" });
    const cfg = applySessionPeer(loadConfig(), "s2");
    expect(cfg?.aiPeer).toBe("honcho-lead");
    expect(cfg?.peerName).toBe("saulo");
    expect(cfg?.workspace).toBe("ws");
  });

  test("override beats HONCHO_AI_PEER", () => {
    process.env.HONCHO_AI_PEER = "mx-lead";
    state.setSessionPeer("s3", { aiPeer: "honcho-lead" });
    expect(applySessionPeer(loadConfig(), "s3")?.aiPeer).toBe("honcho-lead");
    expect(applySessionPeer(loadConfig(), "other")?.aiPeer).toBe("mx-lead");
  });

  test("no session id or no override is a no-op", () => {
    expect(applySessionPeer(loadConfig(), undefined)?.aiPeer).toBe("claude");
    expect(applySessionPeer(loadConfig(), "nothing-here")?.aiPeer).toBe("claude");
    expect(applySessionPeer(null, "s2")).toBeNull();
  });
});

describe("HONCHO_SAVE_MESSAGES with a config file", () => {
  test("false turns saving off even when the file says on", () => {
    writeConfig({ saveMessages: true });
    process.env.HONCHO_SAVE_MESSAGES = "false";
    expect(loadConfig()?.saveMessages).toBe(false);
  });
  test("true turns saving on even when the file says off", () => {
    writeConfig({ saveMessages: false });
    process.env.HONCHO_SAVE_MESSAGES = "true";
    expect(loadConfig()?.saveMessages).toBe(true);
  });
  test("unset leaves the file value", () => {
    writeConfig({ saveMessages: false });
    expect(loadConfig()?.saveMessages).toBe(false);
  });
});
