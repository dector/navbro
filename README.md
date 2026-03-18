# navbro

A tiny Firefox extension for a **keyboard-first, Vim-like browsing workflow**.

Main inspiration: [Tridactyl](https://github.com/tridactyl/tridactyl), but this project aims to stay much smaller and simpler.

Reference config for planned keybindings/features:
[dector/dotfiles `tridactylrc`](https://github.com/dector/dotfiles/blob/main/private_dot_config/tridactyl/tridactylrc)

## Current status

Initial scaffold only:
- Firefox extension loads on every page
- Shows a small `Hi` badge in the top-right corner

## Planned features (first roadmap)

Based on the referenced Tridactyl config, the first target feature set is:

### 1) Navigation & scrolling
- Vim-style scrolling (`j`, `k`, `h`, `l`)
- Faster/slower variants (`J`, `K`, etc.)
- Page scrolling (`Ctrl-d`, `Ctrl-u`, `Ctrl-f`, `Ctrl-b`)
- Jump to top/bottom (`gg`, `G`)

### 2) Tab operations
- Next/previous tab (`H`, `L`, `(`, `)`)
- First/last tab (`gh`, `gl`)
- Open/close/restore tabs (`gf`, `w`, `u`, `U`)
- Move tabs (`>>`, `<<`, start/end)
- Audio toggle / detach / push workflows

### 3) History & URL motions
- Back/forward bindings (`'`, `-`, `+`)
- URL parent/root navigation (`gu`, `gU`)
- Jump list navigation (`Ctrl-o`, `Ctrl-i`)

### 4) Hints & link interaction
- Hint mode (`f`, `F`, `T`)
- Open/copy/download/image-focused hint actions (`;...` family)

### 5) Editing, command-like actions, and utilities
- Focus input (`gi`, `gI`)
- Reload/stop (`R`, `x`)
- Copy/yank helpers (`yy`, `yt`, `ym`, `yq`)
- Bookmark shortcuts (`b`, `B`)
- Zoom controls (`zz`, `zi`, `zd`, `zI`, `zD`, `zm`, `zM`)

### 6) Modes and key handling
- Minimal normal/ignore mode handling
- Escape-based reset to normal mode
- Repeat last action (`.`)

## Non-goals (for now)

- Full Tridactyl compatibility
- Full command-line parser from day one
- Large, complex configuration surface in the first versions

## Development notes

This repo is intentionally starting tiny. The next steps are:
1. Add keybinding engine with multi-key sequence support
2. Implement scrolling + tab navigation primitives
3. Add simple hint mode
4. Add persistent user config
