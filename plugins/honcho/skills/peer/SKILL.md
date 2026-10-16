---
description: Switch the Honcho AI peer for this session only (promote a one-off agent to a named peer mid-session)
allowed-tools: set_session_peer, get_config
user-invocable: true
---

# Honcho Session Peer

Change which Honcho peer this Claude Code session saves the assistant's messages under, without relaunching and without touching `~/.honcho/config.json`. Other sessions are unaffected.

## Usage

- `/honcho:peer <ai-peer>` — save the assistant's messages as `<ai-peer>` from now on
- `/honcho:peer <ai-peer> --user <peer>` — also change the peer the user's prompts are saved under
- `/honcho:peer --clear` — drop the override, back to env/config peers

## Steps

1. Parse the arguments. No arguments: call `get_config` and report `resolved.peerName`, `resolved.aiPeer` and `resolved.sessionPeer`, then stop.
2. Call `set_session_peer` with `aiPeer` (and `peerName` when `--user` was given), or `clear: true`.
3. Report the result in one or two lines: previous peers, new peers, and the note that earlier messages keep their original peer. Quote `warnings` verbatim if any.

## Limits

- Takes effect from the next message. Messages already saved keep the peer they were saved with; Honcho has no re-attribution endpoint.
- The override ends with the session. Make it permanent by launching with `HONCHO_AI_PEER=<ai-peer>`.
