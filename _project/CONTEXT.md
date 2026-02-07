# FATA ORGANA — Project Context

> This document exists so that any new Claude conversation can pick up where the last one left off. It synthesizes context from all three primary workstreams: story development, sound design/scoring, and the website. Read this first, then examine the repo.

---

## The Project

Fata Organa is a 12-episode audio drama told as a podcast. Created by Wiley Davis. It began development in late December 2025 at Mars College near the Salton Sea.

**The tagline:** "They thought it was a weapon. But it's a gift."

**The premise:** Humanity once built unconscious systems ("automations") to maintain consensus reality — physics, causality, time. A weapon (the "Adjustment") destroyed those automations inside a geographic region called the Containment Zone. Inside the CZ, consciousness is the only medium left. Sound doesn't propagate unless a Mind maintains the conditions for it. Time doesn't pass unless someone holds it together.

**The format:** Radio transmissions from Marcus Reed, a man who stole a sailboat and returned to the CZ after being rescued. He's broadcasting as he sails back in. What appears to be a confused man's journey is actually a carefully constructed narrative — Marcus has been through this many times (loops), and is crafting transmissions designed to emotionally transform a specific listener.

---

## Three Workstreams, One Project

### 1. Story Development (Chat: "Fata Organa")
Where the world-building, character development, and narrative structure live. Key outputs:
- **World Bible** (`fata_organa_bible.md`) — complete mechanics, characters, locations
- **Beat Map** (`fata_organa_beat_map.md`) — episode-by-episode breakdown, 12 episodes
- **Terminology Dictionary** (`fata_organa_terminology.md`) — 68 entries, 11 categories
- **Story Threads Overview** (`story_threads_overview.md`) — 4 primary threads, 9 subplots
- **Isla & Leo Backstory** (`isla_and_leo_backstory.md`) — character deep-dive
- **Transmission Grid** (`fata_organa_transmission_grid.md`) — hidden loop structure
- **Writing Process Meta** (`writing_process_meta.md`) — the human/AI collaboration methodology
- **Episode 1 Scene Map** — 9 scenes, ~35-40 minutes, detailed audio notes

### 2. Sound Design & Scoring (Chat: "Sound Design - Fata Organa")
Where the Ableton Live production methodology was developed. Key outputs:
- **Sound Manual** (full HTML, now Artifice 0 on the website) — 9 chapters, 14 appendices
- **Sound Notebook** (`fata_organa_sound_notebook.md`) — scratchpad, open questions
- **MIDI Asset Library** — pre-composed patterns in D# minor at 120 BPM

**Core production framework:**
- Key: D# minor, Tempo: 120 BPM, DAW: Ableton Live
- Reference artists: Kangding Ray (Solens Arc), Gas (Pop), Ben Frost (A U R O R A)
- Signal flow: Source → Shape → Space → Destroy → Space Again
- Three narrative states: Analytical (voice forward), Receptive (trance), Transitional (seamless blend)
- Voice processing rack: 3 parallel chains (Clarity/Texture/Rhythm) with chain selector macro
- Rhythmic entrainment as both production technique and in-world plot mechanism

### 3. Website (Chat: "Website - Fata Organa")
Where the site was built and is maintained. Lives at **fata-organa.pages.dev**, deployed from **github.com/wileydavis/fata-organa** via Cloudflare Pages.

---

## Website Architecture

### Deployment
- **Repo:** `github.com/wileydavis/fata-organa` (branch: `main`)
- **Hosting:** Cloudflare Pages (auto-deploys on push to main)
- **Push method:** `gh_push.py` — Python script using GitHub Contents API
  - Requires `GITHUB_TOKEN` env var (or uses hardcoded PAT)
  - Functions: `push_file(repo_path, content, message)`, `push_binary_file()`, `push_directory()`
  - No git clone needed — works through API from any Claude session

### File Structure
```
/
├── index.html              # Homepage: single-screen transmitter interface
├── feed.xml                # RSS stub
├── css/
│   ├── style.css           # Global styles, typography, nav, overlays
│   ├── document.css        # Document/field manual styling, content link colors
│   ├── spoiler.css         # Spoiler/clearance system + onboarding modal
│   └── layers.css          # Artifice layer system + tooltip
├── js/
│   ├── main.js             # Minimal bootstrap
│   ├── atmosphere.js       # Ambient particle animation (consciousness motes)
│   ├── spoiler.js          # Spoiler clearance engine + doc-viewer hooks
│   ├── layers.js           # Artifice layer navigation + tooltip
│   ├── vu-meter.js         # Canvas VU meter with audio analysis + signal export
│   ├── ambient-light.js    # Audio-reactive page lighting system
│   ├── doc-viewer.js       # SPA document projector overlay
│   └── spa-redirect.js     # Redirects subpage visits to homepage with ?doc= param
├── audio/
│   └── teaser.mp3          # Audio teaser file
├── transmissions/
│   └── index.html          # Transmissions listing (placeholder)
├── archive/
│   ├── index.html          # Field Manuals index page
│   ├── sound-manual/       # FM-001: Sound Manual (2 artifice layers)
│   ├── continuity-protocol/ # FM-002: Continuity Protocol (2 artifice layers, spoiler-gated)
│   ├── terminology/        # FM-003: Terminology Index (68 entries, spoiler-gated)
│   ├── writing-process/    # FM-004: The Writing Process (2 artifice layers)
│   └── dev-log/            # Project Log (20 entries)
├── about/
│   └── index.html          # About page: origin story, AI transparency
└── _project/
    ├── CONTEXT.md          # This file
    └── docs/               # All working documents (bible, beat map, etc.)
```

### Design Principles
- **Single-page app:** The homepage IS the site. All documents open as projector overlays from the transmitter. User never leaves the homepage. Audio playback continues behind overlays.
- **Aesthetic:** Dark, amber-tinted, signal-interference. Scanline and noise overlays. Monospace typography (JetBrains Mono). Traditional paragraph indentation, no bullet-point formatting in documents.
- **Dual register:** Every production document exists simultaneously as an in-world artifact and a real creative tool. The Sound Manual is both a field report about acoustic phenomena in the Containment Zone AND an Ableton production guide.
- **Field Manuals:** All archive documents are framed as research materials compiled by teams studying the effects of the Adjustment on the Containment Zone. Numbered FM-001 through FM-004.
- **CSS variables:** `--accent` (#c4a35a), `--accent-dim` (#8a7340), `--text` (230, 225, 215), `--text-dim` (#6b6860), `--bg` (10, 10, 12), `--mono` (JetBrains Mono), `--serif` (EB Garamond)

### Homepage — The Transmitter Interface
The homepage is a fixed, single-screen transmitter panel. No scrolling. Components:
- **Nav bar** (z-index 600): Logo (home/close viewer) + About link. Fades out during audio playback.
- **TX Header**: "FATA ORGANA" title
- **Frequency bar**: Episode selector (Ep 01-12), currently shows "TEASER — SIGNAL RECOVERED"
- **VU Meter**: Canvas-rendered analog meter, center of page. Real-time audio visualization.
- **Status strip**: "MONITORING" / playback status
- **Panel buttons**: Three buttons — Transmissions (drawer), Field Manuals (drawer), Project Log (opens in projector overlay)
- **Tagline**: "They thought it was a weapon. But it's a gift."
- **Drawers**: Slide-out panels for Transmissions (left) and Field Manuals (right). Opened by panel buttons, closed by overlay click / x button / Escape key.

### Key Systems

#### Document Projector Overlay (`doc-viewer.js`)
- SPA system: intercepts all internal `<a>` clicks, fetches target page via `fetch()`, injects `<main>` content into floating overlay panel
- Overlay DOM: backdrop (88% opacity) → warm radial glow (projected from VU meter center) → floating panel (820px max, 92vw mobile)
- Chrome bar at top: spoiler clearance controls (built dynamically by spoiler.js) + x close button
- Preserves `data-layers` attribute for artifice system reinit
- Reinitializes both spoiler and layers systems on each document load
- Rewrites internal links within documents to open in viewer (recursive navigation)
- `pushState` / `popstate` for browser back/forward support
- Escape key, backdrop click, x button all close
- Loading state: "RECEIVING SIGNAL" with pulse animation
- Error state: "SIGNAL LOST"
- Mobile: full viewport, overlay z-index 700 (above nav at 600), safe-area-inset padding
- Global API: `window.docViewer.open(url)`, `window.docViewer.close()`, `window.docViewer.isOpen()`

#### SPA Redirect (`spa-redirect.js`)
- Added to all subpages (about, archive/*, transmissions)
- If user lands directly on e.g. `/archive/terminology/`, redirects to `/?doc=/archive/terminology/`
- Homepage detects `?doc=` param and opens the projector overlay on load
- Progressive enhancement: pages render normally if JS disabled

#### Spoiler System (`spoiler.js`, `spoiler.css`)
- Content wrapped in `data-spoiler="N"` attributes, where N = episode number (0-12)
- Level 0 = safe for anyone, Level 12 = final reveals
- Clearance stored in localStorage (persists), onboarding seen stored in sessionStorage (once per session)
- **Inline redaction**: word/phrase-level `<span data-spoiler>` elements with proportional-width bars. Width pre-measured, slight random jitter (0.92-1.08x) to obscure exact word length. Surrounding text remains visible.
- **Block redaction**: paragraphs, terms, sections show striped overlay with "REDACTED — CLEARANCE LEVEL N REQUIRED" label
- **Clearance toggle**: built dynamically into doc-viewer chrome bar by `buildViewerToggle()`. +/- buttons and display. Tooltip on hover.
- **Onboarding modal**: once per session, triggered when first document with `[data-spoiler]` elements is opened. Shows inside doc-viewer panel. Static noise canvas, clearance selector, "Enter Archive" button. In-world framing: "SIGNAL INTERCEPT NOTICE — Clearance Required."
- **Doc-viewer hooks**: `window.spoilerSystem.init()` (re-measures and applies redactions) and `window.spoilerSystem.onDocumentOpen()` (builds toggle, checks for onboarding)

#### Artifice Layer System (`layers.js`, `layers.css`)
- Documents can have multiple depth layers, measured by "Artifice"
- Highest number = most constructed (in-world fiction), presented first
- Zero = no artifice (raw production notes)
- `data-layers` on container, `data-layer="N"` on content divs
- Each layer has `data-layer-name` and `data-layer-classification` attributes
- Controls: depth gauge with pips, "LESS ARTIFICE" / "MORE ARTIFICE" buttons
- **Tooltip on hover** (control bar): "Archive documents have layers of artifice. The highest layer is in-world fiction. Strip it away to find the real production materials underneath."
- Transition animation: dissolve (0.7s blur/distort/tear) → reform (0.8s assembly from noise)
- Currently deployed on: FM-001 Sound Manual (2 layers), FM-002 Continuity Protocol (2 layers), FM-004 Writing Process (2 layers)

#### VU Meter Audio Player (`vu-meter.js`)
- Canvas-rendered analog meter with needle, scale markings, signal-driven warm backlight
- Web Audio API: AnalyserNode for real-time frequency analysis (fftSize 256, smoothing 0.8)
- Frequency band separation: low bins (bottom 20%), high bins (top 40%), overall RMS
- **Signal export** via `window.vuSignal`: `rms`, `low`, `high`, `peak`, `smoothRms`, `smoothLow`, `isPlaying`, `hasStarted`. Heavily smoothed values (~500ms time constants) for ambient system.
- Backlight is signal-driven: color temperature shifts with energy (deep amber → gold → pale warm white), intensity tracks smoothed RMS, breathing modulation via slow sine. Face background darkens during playback for contrast.
- Needle tip glow uses signal-driven color/intensity
- Green "RECEIVE TRANSMISSION" / "RECEIVING" indicator
- Needle geometry: pivot at cy = H*0.88, BASE_ANGLE = -pi/2 (straight up), sweep +/-0.75 radians
- Progress bar: clickable for seeking

#### Ambient Light System (`ambient-light.js`)
- When audio plays, page fades to black over ~5 seconds (`FADE_IN_SPEED = 0.0033` per frame at 60fps)
- Max darkness: 97% (`DARKNESS_MAX = 0.97`)
- **Elements dimmed**: `.site-nav`, `.tx-header`, `.tx-frequency-bar`, `.tx-status-strip`, `.tx-panel-buttons`, `.tx-tagline`, `.tx-footer` — all fade to near-invisible
- **Ambient glow**: circular radial gradient centered at 50% 45% (transmitter area). 7-stop smooth falloff. Radius expands with energy (35-60% of viewport).
- **Color temperature**: matches VU meter palette — deep amber (196,163,90) at rest, warm gold (220,190,110) at mid energy, pale warm white (240,220,170) at peaks. Driven by `smoothRms`.
- **Breathing modulation**: slow sine (~17 second period), +/-15% intensity variation. Prevents static look.
- **Panel border glow**: box-shadow on `.tx-panel` pulses with energy — candle light spill effect.
- **Meter border glow**: `.tx-meter` border color brightens with energy.
- Returns to normal at faster rate when audio pauses/ends (`FADE_OUT_SPEED = 0.012`)
- Z-index stack: darkness overlay (1) → ambient glow (2) → transmitter (3) → drawers (300-301) → doc-viewer (500, or 700 on mobile) → nav (600)

#### Atmosphere (`atmosphere.js`)
- Canvas particle system: amber dots drifting through viewport
- Represents consciousness motes / signal interference

#### Content Link Styling (`document.css`)
- Links in `.page-content` and `.doc-viewer-content`: warm accent color (`--accent-dim`), subtle 25% opacity underline
- Hover: brightens to full `--accent`, underline strengthens
- Visited: faded muted gold (`rgba(138, 115, 64, 0.45)`), near-invisible underline. No purple.

### Project Log
The Project Log lives at `/archive/dev-log/` and opens in the projector overlay via the "Project Log" button on the transmitter panel. It is NOT listed in the Field Manuals index (those are just FM-001 through FM-004). Currently 20 entries spanning 2025.12.31 to 2026.02.07. Tags: SITE, SYSTEM, FIELD MANUAL, WRITING, SOUND, ORIGIN.

### About Page
Personal origin story at `/about/`. Twelve-year project genesis at Land's End. Explains why audio format (rhythmic entrainment, four-on-the-floor as structural scaffolding). Transparency about AI as collaborative tool. Links woven throughout to field manuals, terminology, sound manual, writing process, continuity protocol.

---

## Writing Process

The human/AI collaboration follows six phases:
1. **Exploration** — Conversation, divergent thinking, no commitments
2. **Solidification** — Document decisions into reference materials
3. **Writing** — Human solo. AI is not involved. The prose is 100% human-written.
4. **Analysis** — AI reads draft as reader first, then analyst
5. **Recontextualization** — Update all documents to match what the draft discovered
6. **Deepening** — Find interweaving resonances, add complexity

**Core principle:** "The human writes the story. The AI holds the complexity."

**AI responsibilities:** Track consistency across episodes, find unintended implications, maintain the document ecosystem, remember what the writer forgets. Never write the actual prose.

**In-world parallel (Artifice 1):** The Writing Process field manual describes AI-assisted identity maintenance for Containment Zone researchers. AI serves as "prosthetic Automations" — holding researcher identity coherence during Zone operations where reality no longer maintains it automatically. Same six phases, reframed as calibration → documentation → zone operations → debrief → recontextualization → integration.

---

## Story Summary (SPOILERS)

**Marcus Reed** was inside the CZ when the weapon deployed. He encountered **Isla** at Land's End — a neuroscientist with high-functioning autism whose mind type ("Octopus Mind") let her maintain a stable pocket of reality. He fled in fear, was rescued, then stole a sailboat to return.

What the listener doesn't know: Marcus has completed this journey many times. He built a self-resetting automation that returns him to the boat whenever his mind is about to become trapped. He discovered that Isla's son **Leo** (age 7) didn't die — his child consciousness remained fluid and manifests as an octopus at Land's End. Isla plans revenge against the weapon-deployers. Marcus needs to transform her emotionally (not argue her out of it) so she can be reunited with Leo.

The 12 episodes are Marcus performing his past confusion to bring both Isla and the listener through the emotional journey from wanting revenge to releasing it. The transmissions themselves are the "weapon/gift" — the story IS the mechanism.

**Key characters:** Marcus Reed (The Bridge), Isla (Octopus Mind), Leo (fluid child consciousness), Marcus's father (dementia as metaphor for automation failure), David Chen (first survivor Marcus meets), Sarah Vickers (gives moral permission for revenge)

**Hidden structure:** Days repeat as loops. The octopus encounter recurs identically. By Episode 7, Marcus "discovers" loops — but the careful listener realizes he's known all along.

---

## Key Documents

All working documents are version-controlled in `_project/docs/` in the repo:

- `fata_organa_bible.md` — complete world mechanics, characters, locations
- `fata_organa_beat_map.md` — episode-by-episode breakdown, 12 episodes
- `fata_organa_terminology.md` — 68 entries, 11 categories
- `story_threads_overview.md` — 4 primary threads, 9 subplots
- `isla_and_leo_backstory.md` — Isla, Leo, child mind mechanics
- `fata_organa_transmission_grid.md` — hidden loop structure
- `fata_organa_episode_1_guide.md` — Episode 1 scene-by-scene map
- `writing_process_meta.md` — human/AI collaboration methodology
- `writing_process_starter_prompt.md` — prompt for initiating writing sessions
- `writing_process_slides.md` — 3-minute presentation on the process

When documents are updated in any workstream chat, they should be pushed to `_project/docs/` using `gh_push.py` to keep the repo as single source of truth.

---

## Audio Storage (Future)

When transmissions are ready: Cloudflare R2 with subdomain (audio.fata-organa.pages.dev). Episodes ~30-35MB each at 128kbps, 12 episodes = ~400MB (too large for repo). R2: same Cloudflare ecosystem, no egress fees. Needs CORS header `Access-Control-Allow-Origin: *` for Web Audio API AnalyserNode cross-origin access. VU meter already works with any audio source via AudioContext. Episode selector will swap `data-src` URL to R2 paths.

---

## How to Resume Work

1. Clone or examine the repo at `github.com/wileydavis/fata-organa`
2. Read this CONTEXT.md
3. Set up `gh_push.py` with a valid GitHub token
4. The local working directory is `/home/claude/site/` — mirror the repo structure
5. Push changes with `push_file(repo_path, content, commit_message)`
6. Cloudflare auto-deploys from main branch
7. Live site: `fata-organa.pages.dev`

---

*Last updated: 2026-02-07*
