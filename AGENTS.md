# AGENTS.md

Guidance for coding agents working in this repository.

## Project at a glance

**navbro** is a tiny Firefox extension focused on a **keyboard-first, Vim-like browsing workflow**.

- Inspiration: Tridactyl
- Product direction: keep scope small and simple (not full Tridactyl parity)
- Current version: early scaffold stage

## Current implementation status

What exists now:

- Manifest V3 Firefox extension
- Content scripts injected on `<all_urls>`:
  - `key-config.js`
  - `content.js`
- A small fixed mode badge in the top-right of pages
- Two modes in runtime state:
  - `nav` (intended normal/navigation mode)
  - `pass` (passthrough mode)
- Configured mode toggle shortcut (`Ctrl+Insert`)
- Placeholder `handleNavInput()` (no real keybinding actions yet)

## Basic goals

Build a minimal but practical Vim-like navigation layer for browsing.

Priority is incremental delivery of core keyboard workflows, not feature completeness.

## Planned features (roadmap)

Implement progressively, roughly in this order:

1. **Navigation & scrolling**
   - `j/k/h/l`, accelerated variants, page scroll (`Ctrl-d/u/f/b`), top/bottom (`gg`, `G`)

2. **Tab operations**
   - next/previous, first/last, open/close/restore, move tab, audio/detach/push flows

3. **History & URL motions**
   - back/forward, URL parent/root motions (`gu`, `gU`), jump list (`Ctrl-o`, `Ctrl-i`)

4. **Hints & link interaction**
   - hint mode (`f`, `F`, `T`) and `;` action family

5. **Editing/utility actions**
   - focus input, reload/stop, yanks/copy helpers, bookmarks, zoom controls

6. **Modes and key handling**
   - robust normal/ignore mode behavior, escape reset, repeat last action (`.`)

## Non-goals (near term)

- Full Tridactyl compatibility
- Full command-line parser from the beginning
- Large or complex configuration surface in early versions

## Source layout

- `manifest.json` — extension metadata and script injection
- `key-config.js` — centralized key combo definitions (currently mode toggle)
- `content.js` — runtime state, badge UI, keyboard event handling
- `build` — packaging script producing `dist/<name>-<version>.xpi`
- `dist/` — generated artifacts

## Agent working guidelines

When implementing tasks, prefer these principles:

1. **Keep it small and composable**
   - Add minimal primitives first.
   - Avoid large abstractions until repeated patterns are clear.

2. **Preserve keyboard-first behavior**
   - Use capture-phase key handling where appropriate.
   - Prevent default/propagation only when action is truly handled.

3. **Respect modes**
   - `pass` mode should stay as non-invasive as possible.
   - Keep mode transitions explicit and predictable.

4. **Favor deterministic key parsing**
   - Introduce a sequence engine for multi-key bindings (e.g., `gg`, `gu`, `>>`).
   - Handle timeout/reset behavior clearly.

5. **Make feature additions testable manually**
   - Ensure behavior can be verified in a page with straightforward steps.
   - Update docs/comments for any non-obvious key decisions.

## Immediate next steps for agents

From README development notes:

1. Add keybinding engine with multi-key sequence support
2. Implement scrolling + tab navigation primitives
3. Add simple hint mode
4. Add persistent user config

## Build/package

Create extension package:

- Run `./build`
- Output: `dist/navbro-<version>.xpi`

## Product reference

Reference keybinding source for feature parity decisions:

- https://github.com/dector/dotfiles/blob/main/private_dot_config/tridactyl/tridactylrc

Use it as inspiration, not as a strict compatibility contract.
