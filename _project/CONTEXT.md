# FATA ORGANA — Project Context

> This document exists so that any new Claude conversation can pick up where the last one left off. It synthesizes context from all three primary workstreams: story development, sound design/scoring, and the website. Read this first, then examine the repo.

---

## The Project

Fata Organa is a 12-episode audio drama told as a podcast. Created by Wiley Davis. It began development in late December 2025 at Mars College near the Salton Sea.

**The tagline:** "They thought it was a weapon. But it's a gift."

**The premise:** Humanity once built unconscious systems ("automations") to maintain consensus reality — physics, causality, time. A weapon destroyed those automations inside a geographic region called the Containment Zone. Inside the CZ, consciousness is the only medium left. Sound doesn't propagate unless a Mind maintains the conditions for it. Time doesn't pass unless someone holds it together.

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
├── index.html              # Homepage: tagline, VU meter player, transmission log
├── feed.xml                # RSS stub
├── css/
│   ├── style.css           # Global styles, typography, nav, overlays
│   ├── document.css        # Archive document styling
│   ├── spoiler.css         # Spoiler/clearance system
│   └── layers.css          # Artifice layer system
├── js/
│   ├── main.js             # Minimal bootstrap
│   ├── atmosphere.js       # Ambient particle animation (consciousness motes)
│   ├── spoiler.js          # Spoiler clearance engine
│   ├── layers.js           # Artifice layer navigation
│   └── vu-meter.js         # Canvas VU meter with audio analysis
├── audio/
│   └── teaser.mp3          # Audio teaser file
├── transmissions/
│   └── index.html          # Transmissions listing (placeholder)
├── archive/
│   ├── index.html          # Archive listing page
│   ├── sound-manual/       # Sound Manual (2 artifice layers)
│   ├── terminology/        # Terminology Index (68 entries, spoiler-gated)
│   ├── writing-process/    # Writing Process methodology
│   ├── continuity-protocol/ # Project context (2 artifice layers, spoiler-gated)
│   └── dev-log/            # Full transmission/development log
├── about/
│   └── index.html          # About page with AI transparency
└── _project/
    └── CONTEXT.md          # This file
```

### Design Principles
- **Aesthetic:** Dark, amber-tinted, signal-interference. Scanline and noise overlays. Monospace typography (JetBrains Mono). Traditional paragraph indentation, no bullet-point formatting in documents.
- **Dual register:** Every production document exists simultaneously as an in-world artifact and a real creative tool. The Sound Manual is both a field report about acoustic phenomena in the Containment Zone AND an Ableton production guide.
- **CSS variables:** `--amber` (196, 163, 90), `--text` (230, 225, 215), `--bg` (10, 10, 12), `--mono` (JetBrains Mono), `--serif` (EB Garamond)

### Key Systems

#### Spoiler System (`spoiler.js`, `spoiler.css`)
- Content wrapped in `data-spoiler="N"` attributes, where N = episode number (0-12)
- Level 0 = safe for anyone, Level 12 = final reveals
- Session-based clearance stored in localStorage
- First visit triggers interstitial asking clearance level
- Redacted content shows as `████` blocks until clearance matches
- Phrase-level spoilers within paragraphs, not whole-document redaction

#### Artifice Layer System (`layers.js`, `layers.css`)
- Documents can have multiple depth layers, measured by "Artifice"
- Highest number = most constructed (in-world fiction), presented first
- Zero = no artifice (raw production notes)
- `data-layers` on container, `data-layer="N"` on content divs
- Each layer has `data-layer-name` and `data-layer-classification` attributes
- Controls: depth gauge with pips, "↓ LESS ARTIFICE" / "↑ MORE ARTIFICE" buttons
- Transition animation: dissolve (0.7s blur/distort/tear) → reform (0.8s assembly from noise)
- Currently deployed on Sound Manual: Artifice 1 (field report) and Artifice 0 (Ableton guide with linked appendix panel)

#### VU Meter Audio Player (`vu-meter.js`)
- Canvas-rendered analog meter with needle, scale markings, warm backlight
- Web Audio API: AnalyserNode for real-time frequency analysis
- Green "RECEIVE TRANSMISSION" / "RECEIVING" label
- Needle geometry: pivot at cy = H*0.88, BASE_ANGLE = -π/2 (straight up), sweep ±0.75 radians

#### Atmosphere (`atmosphere.js`)
- Canvas particle system: amber dots drifting through viewport
- Represents consciousness motes / signal interference

### Development Log
The homepage shows recent entries; the full log lives at `/archive/dev-log/`. Entries are written in dual register — production updates that also read as signal intercepts. Currently 12 entries spanning 2025.12.31 to 2026.02.06.

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

---

## Story Summary (SPOILERS)

**Marcus Reed** was inside the CZ when the weapon deployed. He encountered **Isla** at Land's End — a neuroscientist with high-functioning autism whose mind type ("Octopus Mind") let her maintain a stable pocket of reality. He fled in fear, was rescued, then stole a sailboat to return.

What the listener doesn't know: Marcus has completed this journey many times. He built a self-resetting automation that returns him to the boat whenever his mind is about to become trapped. He discovered that Isla's son **Leo** (age 7) didn't die — his child consciousness remained fluid and manifests as an octopus at Land's End. Isla plans revenge against the weapon-deployers. Marcus needs to transform her emotionally (not argue her out of it) so she can be reunited with Leo.

The 12 episodes are Marcus performing his past confusion to bring both Isla and the listener through the emotional journey from wanting revenge to releasing it. The transmissions themselves are the "weapon/gift" — the story IS the mechanism.

**Key characters:** Marcus Reed (The Bridge), Isla (Octopus Mind), Leo (fluid child consciousness), Marcus's father (dementia as metaphor for automation failure), David Chen (first survivor Marcus meets), Sarah Vickers (gives moral permission for revenge)

**Hidden structure:** Days repeat as loops. The octopus encounter recurs identically. By Episode 7, Marcus "discovers" loops — but the careful listener realizes he's known all along.

---

## Key Documents to Request from User

If starting fresh, ask the user if they have local copies of:
- `fata_organa_bible.md`
- `fata_organa_beat_map.md`
- `fata_organa_terminology.md`
- `story_threads_overview.md`
- `isla_and_leo_backstory.md`
- `fata_organa_transmission_grid.md`
- `writing_process_meta.md`
- `fata_organa_sound_notebook.md`
- `fata_organa_sound_manual.html` (the standalone version with its own sidebar/layout)

These were all output as downloadable files from previous chats. The website itself contains most of this content in HTML form, but the markdown originals are more useful as working references.

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

*Last updated: 2026-02-06*
