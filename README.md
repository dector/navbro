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
- [ ] Open tab (`gf`)
- [x] Close tab (`w`)
- [x] Restore closed tab (`u`)
- [ ] Restore closed window/tab stack (`U`)
- [ ] Move tab right (`>>`)
- [ ] Move tab left (`<<`)
- [ ] Move tab to start
- [ ] Move tab to end
- [ ] Toggle tab audio
- [ ] Detach tab
- [ ] Push tab workflow

### History & URL motions
- [x] History back (`'`)
- [ ] History back/alt binding (`-`)
- [ ] History forward (`+`)
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

### Editing, command-like actions, utilities
- [x] Focus input (`gi`)
- [ ] Focus input (alternate, `gI`)
- [ ] Reload (`R`)
- [ ] Stop loading (`x`)
- [ ] Yank URL (`yy`)
- [ ] Yank title (`yt`)
- [ ] Yank markdown (`ym`)
- [ ] Yank quote (`yq`)
- [ ] Bookmark (`b`)
- [ ] Bookmark in new context (`B`)
- [ ] Zoom reset (`zz`)
- [ ] Zoom in (`zi`)
- [ ] Zoom out (`zd`)
- [ ] Zoom in (strong, `zI`)
- [ ] Zoom out (strong, `zD`)
- [ ] Zoom max preset (`zm`)
- [ ] Zoom min preset (`zM`)

## Non-goals (for now)

- Full Tridactyl compatibility
- Full command-line parser from day one
- Large, complex configuration surface in the first versions
- Horizontal scrolling bindings (`h`, `l`) are not planned for now (deferred)
