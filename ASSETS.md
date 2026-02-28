# Asset manifest – Corporate Takedown (v3)

All sprites and backgrounds live under **`assets/`**. This doc maps your **sprite_XXX** sources to the filenames and folders the game expects.

---

## Sprite mapping (your source → game files)

| Your sprite | Description | Game path / filename |
|-------------|-------------|----------------------|
| **sprite_000** | Cyberpunk server room background | `assets/backgrounds/background-server-room.png` |
| **sprite_001 / 002** | VP Dave hit (face punch close-ups, blue pinstripe) | `assets/hit/dave-hit-1.png`, `assets/hit/dave-hit-2.png` |
| **sprite_003** | VP Dave combat stance (blue suit, single frame) | Used in `dave_phase3.png` |
| **sprite_004** | VP Dave demonic rage (purple fire, skulls) | Used in `dave_phase4.png` |
| **sprite_005–009** | Rich's existing phase frames | `assets/phases/rich/rich_phase1.png` … `rich_phase4.png`, hit frames |
| **sprite_010** | Manny click minigame hands (idle → clicking → destroying mouse) | `assets/minigame/click_frame1.png`, `click_frame2.png`, `click_frame3.png` |
| **sprite_011** | Rich's original sprite sheet | Split into `assets/phases/rich/rich_phase*.png`, `rich_hit_a.png`, `rich_hit_b.png` |
| **sprite_012** | Graphic Design Intern Manny — casual (3×2, headphones) | `assets/chars/manny_frame1.png` … `manny_frame6.png` |
| **sprite_013** | Head of Security Larry — fighting poses (3×2) | (Reserved for future use; no path yet) |
| **sprite_014** | Supply-Chain Mgr Mikita — instructor (blackboard/VR) | `assets/chars/mikita_instructor.png`, `mikita_terminal.png`, `mikita_idle.png` |
| **sprite_015** | VP Dave casual office (3×2, bald stocky) | Used for Dave phases 1–2: `dave_phase1.png`, `dave_phase2.png` |

---

## Folder layout

```
assets/
├── backgrounds/          # Level / UI backgrounds
│   └── background-server-room.png   ← sprite_000 (cyberpunk server room)
├── phases/
│   ├── dave/             # VP Dave (replaces Frank)
│   │   ├── dave_phase1.png   # Idle / casual (sprite_015)
│   │   ├── dave_phase2.png   # Pointing / aggressive
│   │   ├── dave_phase3.png   # Combat stance (sprite_003)
│   │   └── dave_phase4.png   # Demonic rage (sprite_004)
│   └── rich/             # District Manager Rich
│       ├── rich_phase1.png … rich_phase4.png
│       ├── rich_hit_a.png
│       └── rich_hit_b.png
├── hit/                  # Dave hit overlays (face-punch close-ups)
│   ├── dave-hit-1.png    ← sprite_001
│   └── dave-hit-2.png    ← sprite_002
├── richard/              # "Your boss" Richard side event
│   ├── boss-pointing.png
│   └── boss-crossing.png
├── chars/                # Instructors & minigame characters
│   ├── mikita_instructor.png   # Blackboard (sprite_014)
│   ├── mikita_terminal.png    # Terminal
│   ├── mikita_idle.png        # VR headset
│   ├── manny_frame1.png … manny_frame6.png   ← sprite_012
│   └── (Larry sprite_013 when used)
└── minigame/             # Manny STRESS TEST click hand
    ├── click_frame1.png   # Idle
    ├── click_frame2.png   # Clicking / sparks
    └── click_frame3.png  # Destroying mouse
```

---

## Feature summary (what uses what)

- **VP Dave (right boss):** 4 phases from `assets/phases/dave/`; hit animation from `assets/hit/dave-hit-1.png` and `dave-hit-2.png`.
- **Rich (left boss):** 4 phases + 2 hit frames from `assets/phases/rich/`.
- **Background:** `assets/backgrounds/background-server-room.png` (sprite_000).
- **Skill panel:** Phishing active; click opens **Mikita popup** — cycles `mikita_instructor.png`, `mikita_terminal.png`, `mikita_idle.png`.
- **Manny STRESS TEST:** Random 3–8 min; 15s click quota; Manny cycles `manny_frame1`…`6`; hand cycles `click_frame1`→`2` on click, `click_frame3` on pass. All client-side, OBS-safe.
- **OBS widget:** Uses same Firebase ref; shows VP Dave from `assets/phases/dave/dave_phase1.png` and updates phase by HP. Health bar + script included.

---

## Legacy / cleanup

- **`backround-level-1.png`** at project root: a copy is in `assets/backgrounds/background-server-room.png`. Replace that file with your real sprite_000 (cyberpunk server room) when ready; you can delete the root file after.
- Old paths (`phases/dave/`, `phases/rich/`, `chars/`, `minigame/`, `yourbossvar/`, root `dave-hit-*.png`) are no longer used; everything is under **`assets/`**.
