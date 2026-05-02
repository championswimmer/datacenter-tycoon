# @datacenter-tycoon/cli

Terminal client for Datacenter Tycoon.

It provides two modes:
- one-shot commands like `dct status`, `dct ls dc`, `dct add-rack ...`
- an interactive terminal UI launched with just `dct`

## Architecture

The CLI is split into:
- a local daemon that owns `GameState`, runs ticks, and autosaves
- a client that talks to the daemon over a local JSON-RPC socket

This keeps commands fast and lets the TUI receive live updates.

## Common commands

```bash
dct                          # open the TUI
dct status                   # short status line
dct status --json            # machine-readable status
dct new --yes                # start over
dct save [path]              # force-save, optionally export a copy
dct load <path>              # import a savefile
dct quit                     # stop the daemon

dct ls dc
dct ls racks <dcId>
dct ls market
dct ls active
dct ls catalog dc
dct ls catalog rack

dct build-dc garage
dct add-rack dc-123 0 0 C1
dct remove-rack dc-123 rp-123

dct accept-contract offer-1 dc-123
dct cancel-contract offer-1

dct tick 10
dct pause
dct resume
dct speed 4
```

## Global flags

- `--json` — print `{ ok, data }` / `{ ok, error }` envelopes
- `--save <path>` — override savefile path
- `--socket <path>` — override local socket path
- `--no-daemon` — fail instead of auto-spawning the daemon
- `--quiet` — suppress non-JSON success text output

## Savefile and runtime paths

Defaults:

- Linux save: `$XDG_DATA_HOME/dct/save.json`
- Linux socket: `$XDG_RUNTIME_DIR/dct/dct.sock`
- macOS save: `~/Library/Application Support/dct/save.json`
- macOS socket: `$TMPDIR/dct/dct.sock`
- Windows save: `%APPDATA%/dct/save.json`
- Windows socket: `\\.\pipe\dct`

## TUI keymap

- `q` — quit the TUI
- `1` — Dashboard tab
- `2` — Datacenters tab
- `3` — Contracts tab
- `4` — Catalog tab
- `:` — open command palette
- `?` — toggle help overlay
- `↑` / `↓` — move selection in the Datacenters tab
- `Tab` — autocomplete commands in the palette
- `Esc` — close the palette
- `Enter` — run the palette command

Helpful palette commands:
- `build-dc garage`
- `add-rack <dcId> <row> <position> C1`
- `accept-contract <contractId> <dcId>`
- `tick 10`

## Development

```bash
npm run dev:cli
npm run test:cli
npm run typecheck -w @datacenter-tycoon/cli
```

## Troubleshooting

If the daemon crashes and leaves behind a stale socket or pid file, remove the runtime directory entry and retry.

Examples:

```bash
rm -f ~/.local/state/dct/dct.sock ~/.local/state/dct/dct.sock.pid
rm -f ~/.local/share/dct/save.json.tmp
```

If a command should not auto-start the daemon, add `--no-daemon`.
