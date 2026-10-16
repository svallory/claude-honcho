/**
 * Tiny activity-state file the hooks write and the statusline reads.
 * Decoupled by design: hooks can't draw to the Claude Code TUI (no /dev/tty),
 * so instead they record what memory is doing and let the host-managed
 * statusline render the glow/pulse on its own refresh cycle.
 */

import { homedir } from "os";
import { join } from "path";
import { writeFileSync, unlinkSync, readFileSync } from "fs";

const DIR = join(homedir(), ".honcho");

// Per-window files keyed by Claude Code's session_id (the one field guaranteed
// identical between hook stdin and statusLine stdin). Falls back to a global
// file when no session_id is available, so multiple windows don't clobber each
// other's link/phase.
function stateFile(sessionId?: string): string {
  return join(DIR, sessionId ? `state-${sessionId}.json` : "state.json");
}
function sessionFile(sessionId?: string): string {
  return join(DIR, sessionId ? `session-${sessionId}.json` : "session.json");
}
function peerFile(sessionId: string): string {
  return join(DIR, `peer-${sessionId}.json`);
}

/**
 * Per-session peer override, set mid-session by the `set_session_peer` MCP
 * tool (`/honcho:peer`). Hooks and the MCP server read it on every call and
 * apply it on top of env/config, so a running session can change which peer
 * its messages are saved under without a relaunch or a config-file write.
 * Earlier messages keep the peer they were saved with: Honcho has no
 * re-attribution endpoint.
 */
export interface SessionPeerOverride {
  aiPeer?: string;
  peerName?: string;
  setAt: number;
}

export function getSessionPeer(sessionId?: string | null): SessionPeerOverride | null {
  if (!sessionId) return null;
  try {
    const raw = JSON.parse(readFileSync(peerFile(sessionId), "utf-8"));
    if (!raw || typeof raw !== "object") return null;
    const out: SessionPeerOverride = { setAt: Number(raw.setAt) || 0 };
    if (typeof raw.aiPeer === "string" && raw.aiPeer) out.aiPeer = raw.aiPeer;
    if (typeof raw.peerName === "string" && raw.peerName) out.peerName = raw.peerName;
    return out.aiPeer || out.peerName ? out : null;
  } catch {
    return null;
  }
}

export function setSessionPeer(sessionId: string, patch: { aiPeer?: string; peerName?: string }): SessionPeerOverride {
  const merged: SessionPeerOverride = { ...(getSessionPeer(sessionId) ?? {}), ...patch, setAt: Date.now() };
  writeFileSync(peerFile(sessionId), JSON.stringify(merged));
  return merged;
}

export function clearSessionPeer(sessionId: string): void {
  try { unlinkSync(peerFile(sessionId)); } catch { /* already gone */ }
}

export type MemoryPhase =
  | "idle"
  | "loading"
  | "compacting"
  | "recalling"
  | "querying";    // an explicit honcho MCP tool call (search/chat/context/...)

export function setMemoryState(phase: MemoryPhase, detail?: string, sessionId?: string): void {
  try {
    writeFileSync(stateFile(sessionId), JSON.stringify({ phase, since: Date.now(), detail }));
  } catch {
    // best-effort — statusline falls back to idle if this is missing/stale
  }
}

// The hooks own the workspace + session-name math, so they write the resolved
// web URL here for the statusline to render as a clickable link.
export function setSessionLink(url: string, name: string | undefined, sessionId?: string): void {
  try {
    writeFileSync(sessionFile(sessionId), JSON.stringify({ url, name }));
  } catch {
    // best-effort — statusline just omits the link if this is missing
  }
}

// Clean up this window's files when its session ends, so they don't accumulate.
export function clearSessionFiles(sessionId?: string): void {
  if (!sessionId) return;
  for (const f of [stateFile(sessionId), sessionFile(sessionId), peerFile(sessionId)]) {
    try { unlinkSync(f); } catch { /* already gone */ }
  }
}
