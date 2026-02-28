# morris-boss-v3 — Corporate Takedown

**Games We Miss | Corporate Takedown** — VP Dave & District Manager Rich boss fight, Firebase sync, OBS widget, skill panel (Mikita Phishing), and Manny STRESS TEST minigame.

## Project structure

| Path | Purpose |
|------|---------|
| `index.html`, `script.js`, `style.css` | Main game (login, dual boss, shop, inventory, skill panel, Mikita popup, Manny stress test) |
| `widget.html`, `widget.js` | OBS Browser Source (VP Dave + health bar, same Firebase) |
| `assets/` | All sprites and backgrounds — see **[ASSETS.md](ASSETS.md)** for sprite_000…015 mapping |

Sprites are organized under **`assets/`**: `backgrounds/`, `phases/dave/`, `phases/rich/`, `hit/`, `richard/`, `chars/`, `minigame/`. Put your PNGs in those folders; [ASSETS.md](ASSETS.md) lists exact filenames and how they map to your sprite sources.