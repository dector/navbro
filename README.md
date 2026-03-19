# navbro

A tiny Firefox extension for a **keyboard-first, Vim-like browsing workflow**.

Main inspiration: [Tridactyl](https://github.com/tridactyl/tridactyl), but this project aims to stay much smaller and simpler.

Reference config for planned keybindings/features:
[dector/dotfiles `tridactylrc`](https://github.com/dector/dotfiles/blob/main/private_dot_config/tridactyl/tridactylrc)

## TODO checklist

Legend:
- `[x]` implemented
- `[ ]` planned

### Core / modes
- [x] Extension loads on every page
- [x] Mode badge UI (`nav` / `pass` / `hint` / `input`)
- [x] Debug panel UI for key logs
- [x] Debug panel view toggle (`?d`: hidden → 1 line → 10 lines)
- [x] Hotkeys quick help (`??`)
- [x] Mode toggle (`Ctrl-Insert`)
- [x] Multi-key sequence support (initial, for `g...`)
- [x] Sequence timeout handling
- [x] Input passthrough mode (`input`, entered by `i` on focused input)
- [x] Escape-based reset to normal mode (`Esc`)
- [ ] Repeat last action (`.`)

### Navigation & scrolling
- [x] Scroll down (`j`)
- [x] Scroll up (`k`)
- [x] Scroll down fast (`J`)
- [x] Scroll up fast (`K`)
- [x] Half-page down (`Ctrl-d`)
- [x] Half-page up (`Ctrl-u`)
- [x] Full-page down (`Ctrl-f`)
- [x] Full-page up (`Ctrl-b`)
- [x] Jump to top (`gg`)
- [x] Jump to bottom (`G`)

### Tab operations
- [x] Previous tab (`Ctrl-Alt-h`)
- [x] Next tab (`Ctrl-Alt-l`)
- [ ] Previous tab (`H`)
- [ ] Next tab (`L`)
- [ ] Previous tab (`(`)
- [ ] Next tab (`)`)
- [ ] First tab (`gh`)
- [ ] Last tab (`gl`)
- [x] Open tab after current (`gf`)
- [x] Close tab (`w`)
- [x] Restore closed tab (`u`)
- [ ] Restore closed window/tab stack (`U`)
- [ ] Move tab right (`>>`)
- [ ] Move tab left (`<<`)
- [ ] Move tab to start
- [ ] Move tab to end
- [x] Go to tab playing audio / cycle (`ga`)
- [ ] Toggle tab audio
- [x] Detach tab (`tD`)
- [x] Move tab to selected window (`td`)
- [ ] Push tab workflow

### History & URL motions
- [x] History back (`'`)
- [x] History back/alt binding (`-`)
- [x] History forward (`+`)
- [x] URL parent (`gu`)
- [x] URL root (`gU`)
- [ ] Jump list back (`Ctrl-o`)
- [ ] Jump list forward (`Ctrl-i`)

### Hints & link interaction
- [x] Hint mode (`f`)
- [x] Hint mode in new tab (`F`)
- [x] Hint mode (alternate, `T`)
- [x] Covered/occluded targets are hidden by default (e.g. behind dialogs)
- [ ] Hint action family (`;...`)

Hint config (see `key-config.js`):
- `hints.displayCovered: false` (default) — hide hints for covered elements
- `hints.displayCovered: true` — show hints even if elements are covered

Pass mode defaults (see `key-config.js`):
- `passMode.defaultHosts: ["mail.google.com"]` — start in `pass` mode on matching hosts
- Supports exact hosts and wildcard subdomain rules like `"*.example.com"`

### Editing, command-like actions, utilities
- [x] Focus input (`gi`)
- [ ] Focus input (alternate, `gI`)
- [x] Search page (`/`, native Firefox find)
- [ ] Reload (`R`)
- [x] Stop loading (`x`)
- [x] Yank URL (`yy`)
- [x] Yank title + URL (`yY`)
- [ ] Yank title (`yt`)
- [ ] Yank markdown (`ym`)
- [x] Show URL QR code (`yq`, `Esc` closes)
- [ ] Bookmark (`b`)
- [ ] Bookmark in new context (`B`)
- [x] Zoom reset (`zz`)
- [x] Zoom in (`zi`)
- [x] Zoom out (`zd`)
- [x] Zoom in (strong, `zI`)
- [x] Zoom out (strong, `zD`)
- [x] Zoom min preset (`zm`)
- [x] Zoom max preset (`zM`)

## Non-goals (for now)

- Full Tridactyl compatibility
- Full command-line parser from day one
- Large, complex configuration surface in the first versions
- Horizontal scrolling bindings (`h`, `l`) are not planned for now (deferred)
