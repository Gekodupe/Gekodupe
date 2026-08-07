# Local browser tools

These tabs run entirely in your browser. Your files and text stay on the device. Nothing is uploaded to Geckodupe for dedupe or despam.

| Tab | Best for |
|-----|----------|
| **Text Data** | Paste or upload a single file: lists, CSV, Excel, JSON, logs, code, todos |
| **Directories** | Folder or zip projects: identical files, within-file lines, cross-file cleanup |
| **Media** | Photo/video libraries: bursts, resizes, near-duplicates |
| **Spam** | Form dumps, mailing lists, logs: local spam score and clean |

Quotas apply (guest soft caps until you sign in). See the banner on each tab.

---

## Text Data

### How to use

1. Paste into the box, drag a file, or tap **Upload**
2. Geckodupe auto-detects format (CSV, Excel, JSON, log, code, todo, or plain text) and shows matching options
3. Tune comparison options and similarity
4. Click **Deduplicate**
5. **Copy** or **Download** (extension follows the detected format)

### Comparison options

| Option | Default | What it does |
|--------|---------|--------------|
| Ignore Markdown list bullets | Off | Ignore `*`, `-`, numbered list markers when matching (plain text mode) |
| Stack duplicates | On | Prefix kept lines with `xN` for how many times they appeared |
| Ignore Capitals | Off | Case-insensitive matching |
| Keep Leading Blanks | Off | When off, leading whitespace is trimmed; blank lines are skipped |
| Ignore Punctuation | Off | Ignore `. ! , ? ; :` while comparing |
| Collapse Whitespace | Off | Collapse runs of spaces/tabs to one space |
| Filter Mode | All unique | `all` / only duplicates / only singletons |
| Sort Order | Original | Original order, A–Z, Z–A, or by frequency |

### Format-specific options

Panels appear after the engine sniff. Defaults are tuned for each format.

**CSV / Excel** — Preserve header row (on). Header is never treated as a duplicate.

**JSON** — Pretty print (on); canonical key matching (on) so same object with different key order counts as a duplicate.

**Log & SQL** (all on by default) — Strip dates/timestamps, PIDs/request IDs, UUIDs, SQL serial IDs, IP/MAC, hex addresses, normalize log levels, strip URL query strings. You compare the message, not the metadata.

**Code** — Ignore inline comments, indentation, trailing `;`/`,`, and block comments/docstrings (on). Optionally ignore numbers, string literals, or group/alphabetize imports.

**Todo & lists** — Ignore checkbox state and status prefixes like `TODO:` / `DONE:` (on). Prefer completed markers when merging.

### Similarity slider

- **100%** (default): exact matches only after normalization
- **50–95%**: soft match using word overlap (Jaccard). Lower = more aggressive grouping

---

## Directories

### How to use

1. Drop a folder or zip, or use **Upload**
2. Set **Project mode** and skip rules
3. Adjust line options (same family as Text Data, with `folder-` controls)
4. **Deduplicate**, then **Download (.zip)**

### Project mode

| Mode | Identical files | Within-file lines | Cross-file lines | Code blocks | Notes |
|------|-----------------|-------------------|------------------|-------------|-------|
| **Safe (recommended)** | Yes | Yes | Yes | Detect only | Protects entry points; keeps shortest path as canonical |
| **Data files only** | No | Yes | Yes | No | Spreadsheet/text cleanup |
| **Report only** | Analyze | No | No | Report | No mutation; zip is original snapshot |
| **Aggressive** | Yes | Yes | Yes | Remove dupes | Also strips duplicate function/class blocks |

### Paths to leave alone

Manual skip box: one rule per line (folder name, file name, relative path, or glob like `*.lock`). `#` starts a comment. Matched files stay in the output zip **unchanged**.

### Also exclude from scan

Checked by default: `node_modules`, `.git` (also `.svn` / `.hg`), `dist` / `build` (also `.next`, `coverage`, `out`), `vendor` (also `__pycache__`, `.cache`). These paths are omitted from processing.

**Difference:** Built-in excludes skip scanning. Manual skips keep the file bytes verbatim in the zip.

### Line options and similarity

Same controls as Text Data (stack, case, punctuation, filter/sort, CSV/JSON/log/code/todo panels). Fuzzy Match slider defaults to **100%** (exact).

---

## Media

### How to use

1. Drop a folder/zip of images and videos, or **Upload**
2. Optional: set a **reference target** so only variations of that file are removed
3. Tune burst / quality / sampling options
4. Set similarity (default **92%**)
5. **Deduplicate**, preview kept vs removed, **Download (.zip)** or **Revert**

### Path skips

Manual skips work like Directories. Quick skips (on by default): thumbnail/preview/cache folders; `.DS_Store` / `__MACOSX`.

### Reference target

When **Only remove variations of my target** is on and a target is set (from the library or an external file), the library is compared to that target. Near-matches of the target are removed; unrelated files stay.

### Process options

| Option | Default | What it does |
|--------|---------|--------------|
| Collapse burst sequences | On | Collapse rapid bursts to a few frames |
| Keep best quality copy | On | Prefer largest file among matches |
| Match across sizes | On | Allow thumbnail vs full-size matches |
| Keep per burst | 2 frames | Keep 1 / 2 / 3 frames per burst |
| Video frame sampling | Every 100ms | 33 / 100 / 250 / 500 ms between samples (capped frame count) |

### Similarity

- **100%**: identical bytes only
- **Lower (85–99%)**: perceptual / near-visual matches (hashes, hue, video timeline alignment)

---

## Spam (local)

This tab is **local only**. Hosted prevention for apps is on the **API** tab after you sign in and create a key.

### How to use

1. Paste form fields (`name=…`), a JSON object, a list, or log lines
2. Pick **Mode**
3. Toggle detectors and set near-duplicate threshold
4. Optional blocklist (one phrase per line)
5. **Despam** → review verdict → **Copy cleaned** or **Send to Text Data**

### Mode

| Mode | Behavior |
|------|----------|
| **Form payload** | Parse JSON or `key=value` lines; score/clean fields; filled honeypots can wipe the payload |
| **Line list** | Drop `block`, near-duplicates, and soft rejects |
| **Log scrub** | Line-by-line; soft reject drops mainly for bait / URL flood |

### Detection (all on by default)

| Option | What it does |
|--------|--------------|
| Honeypot fields | Filled traps (`website`, `_gotcha`, etc.) → hard spam |
| URL / link flood | Many URLs or known shorteners |
| Disposable email | Throwaway domains |
| Bait / injection | SEO/pharma/crypto bait, script patterns |
| Strip trackers | Normalize away timestamps, UUIDs, IPs, query junk before matching |

### Near-duplicate slider

Default **85%**. Soft similarity for collapsing similar lines. Higher = stricter.

### Verdict

Meter shows score band (`allow` / `soft_reject` / `block`) and reason chips. Engine thresholds: block ≈ 0.72, soft ≈ 0.42.

---

## Quotas and privacy

- Guests get soft daily caps; signed-in plans raise local limits
- Banner on each tool shows plan and caps
- Local tools never upload your dataset for processing
- Hosted API traffic only happens when **your servers** call Geckodupe with an API key
