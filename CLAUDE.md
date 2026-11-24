# Obsidian MP Publisher — Codebase Architecture & Logic

## Overview

**MP Publisher** is an Obsidian plugin (v2.7.7) that:
1. Renders Markdown notes into styled HTML previews with custom CSS themes
2. Copies formatted HTML to clipboard (for pasting into WeChat Official Accounts editor)
3. Publishes articles directly to WeChat Official Accounts draft box via WeChat API

**Tech stack**: TypeScript, esbuild, Obsidian API, juice (CSS inlining), highlight.js, vitest

---

## Project Structure

```
src/
├── main.ts                      # Plugin entry point
├── converter.ts                 # Markdown→HTML conversion + DOM formatting
├── view.ts                      # Main preview panel UI
├── copyManager.ts               # Clipboard copy with CSS inlining
├── themeManager.ts              # CSS theme lifecycle management
├── themeManagerView.ts          # Theme management panel UI
├── themePreviewView.ts          # Theme preview panel (sample markdown)
├── themeCSSView.ts              # CSS code viewer/editor panel
├── guideView.ts                 # GUIDE.md / CHANGELOG.md markdown doc viewer
├── donateManager.ts             # Donation/author info modal
├── constants.ts                 # Shared constants
├── css.d.ts                     # TypeScript declaration for .css imports
├── settings/
│   ├── settings.ts              # SettingsManager (load/save/update plugin settings)
│   ├── MPSettingTab.ts          # Settings tab UI
│   └── ConfirmModal.ts          # Generic confirm/cancel modal
├── types/
│   ├── css-theme.ts             # CSSTheme, ThemeSource, FontOption types
│   └── metadata.ts              # DocumentMetadata (image cache, draft ID)
├── publisher/
│   ├── index.ts                 # showPublishModal() entry point
│   └── wechat.ts                # WechatPublisher (WeChat API integration)
├── ui/
│   ├── modals.ts                # PublishModal + CoverImageModal
│   └── ProgressIndicator.ts     # Publishing progress overlay
├── themes/
│   └── index.ts                 # Theme registry (builtin + community CSS imports)
├── utils/
│   ├── css-props.ts             # parseCssString(), IMAGE_CAPTION_STYLE, inlineCSSWithJuice()
│   ├── dom-utils.ts             # processListItems(), collectTextNodes(), parseHtmlToContainer()
│   ├── html-cleaner.ts          # cleanObsidianUIElements()
│   ├── image-utils.ts           # fetchImageAsArrayBuffer(), arrayBufferToDataUrl()
│   ├── logger.ts                # Logger singleton (debug/info/warn/error)
│   ├── math-formula.ts          # LaTeX preprocessing + MathJax→image conversion
│   ├── nanoid.ts                # Re-export of nanoid
│   ├── path-utils.ts            # Path pattern resolution
│   └── pseudo-element-renderer.ts # CSS ::before/::after → real <span> DOM elements
├── assets/
│   ├── donate.ts                # Base64 donate QR code
│   └── qrcode.ts                # Base64 WeChat QR code
└── styles/
    ├── index.css                # Main plugin styles
    ├── theme-manager.css        # Theme manager panel styles
    ├── settings/
    │   └── settings.css         # Settings tab styles
    └── view/
        ├── layout.css           # Preview panel layout styles
        └── preview.css          # Preview content styles
```

---

## Core Architecture

### 1. Plugin Entry (`main.ts`)

`MPPublisherPlugin extends Plugin` is the Obsidian plugin entry. On `onload()`:

1. **Logger** singleton init
2. **SettingsManager** loads persisted settings from `data.json`
3. **ThemeManager** initializes: loads builtin themes (8), community themes (4), downloaded remote themes, local custom themes from `custom/` folder
4. **MPConverter** static init with `app` reference
5. **DonateManager** static init
6. **WechatPublisher** init
7. Registers **6 custom views**: preview panel, theme manager, theme preview, theme CSS, guide doc, changelog doc
8. Registers **ribbon icon** + **3 commands**: open preview, open theme manager, publish to WeChat
9. Registers **settings tab**

The plugin exposes a `settings` getter (delegates to `settingsManager.getSettings()`) for backward compatibility.

### 2. Markdown→HTML Conversion Pipeline (`converter.ts`)

The `markdownToHtml()` function is the **core rendering pipeline** (shared by preview, copy, and publish):

```
Raw Markdown
  → preprocessMathFormula()        # LaTeX syntax normalization (\[→$$, \(→$)
  → MarkdownRenderer.render()      # Obsidian's built-in renderer
  → waitForAsyncRender()           # Wait for MathJax/Mermaid async render
  → convertMermaidSVGToImage()     # SVG→PNG via Canvas (WeChat doesn't support SVG)
  → cleanObsidianUIElements()      # Remove Obsidian UI (copy buttons, internal links, checkboxes)
  → MPConverter.formatContent()    # Structural DOM transformation
  → applyCodeHighlightStyles()     # Computed style→inline style for code spans
  → convertCodeBlockLines()        # Code indentation via padding-left + NBSP
  → prerenderPseudoElements()      # CSS ::before/::after→real <span> elements
  → convertNonDefaultFontsToImages() # Non-default font text→Canvas PNG images
  → XMLSerializer serialize        # DOM→HTML string
  → mathToSVG()                    # Optional: MathJax→CodeCogs PNG API
  → inlineCSSWithJuice()           # juice: CSS→inline style attributes
  → reapplyImageCaptionStyles()    # Post-juice fix for image captions
```

**Key design decision**: Uses `activeDocument.createElement` (not `document.createElement`) because the plugin runs in Obsidian's Electron environment where the active document may differ from the global document.

#### `MPConverter.formatContent()` — DOM Structural Transform

This is the most complex transformation. It restructures the rendered HTML to be **WeChat-compatible**:

1. **Lists** (`processLists` → `convertSingleList`): Converts `<ul>/<ol>/<li>` to `<section>`-based structure because WeChat's editor auto-normalizes list tags and destroys custom styling. Uses `• ` / `1. ` markers with inline styles. Handles nested lists recursively with depth tracking.

2. **Code blocks**: Adds macOS-style window dots (red/yellow/green), removes Obsidian copy buttons.

3. **Callouts** (`processCallouts`): Converts Obsidian callout blocks to styled `<section>` elements with icon, colored background, and border. Maps 30+ callout types to color schemes.

4. **Images**: Resolves Obsidian internal embed `src` to absolute `app://` paths.

5. **Links** (`processLinksToFootnotes`): Internal links→plain text. External links→footnote-style `[N]` superscript with footnote section at bottom.

6. **Image captions** (optional): Extracts alt text and adds styled `<p>` below images.

#### Code Block Indentation Strategy

WeChat strips `white-space: pre-wrap` and collapses whitespace (including `&nbsp;`). The converter uses a **dual approach**:
- Replace spaces with ` ` (NBSP) for inline spacing
- Split code by line, wrap each line in a `<section>` with `padding-left = leading_spaces × 0.5em`
- Remove leading NBSPs (replaced by padding-left)
- Keep syntax highlighting `<span>` structure intact

### 3. CSS Theme System

**Four-tier theme architecture** (defined in `types/css-theme.ts`):

| Source | Enum | Location | Examples |
|--------|------|----------|---------|
| Builtin | `ThemeSource.BUILTIN` | Bundled in `src/themes/builtin/` | default, elegant, dark, minimal, green-fresh, orange-warm, scarlet, academic |
| Community | `ThemeSource.COMMUNITY` | Bundled in `src/themes/custom/` | colorful-style, wechat-green, crimson-glow, fresh-azure |
| Remote | `ThemeSource.REMOTE` | Downloaded from GitHub | Fetched via `REMOTE_THEME_CONFIG.indexUrl` |
| Local | `ThemeSource.LOCAL` | `{pluginDir}/custom/*.css` | User-created CSS files |

Themes are **pure CSS** that target `.mp-content-section` as the root selector. CSS files are imported as strings via esbuild's text loader.

**ThemeManager** (`themeManager.ts`):
- Stores all themes in a `Map<string, CSSTheme>`
- Applies themes by injecting a `<style data-mp-theme>` tag into the target element
- Scopes CSS with `[data-mp-scope]` attribute to prevent cross-view style leakage
- Overrides font family and font size via generated CSS
- Supports quick-switch visibility toggling (hidden theme IDs persisted in settings)

**Theme quick-switch visibility**: Users can hide themes from the preview panel's dropdown without deleting them. Hidden IDs stored in `settings.hiddenThemeIds[]`.

### 4. Preview Panel (`view.ts`)

`MPView extends ItemView` — the main UI panel:

- **Toolbar**: Refresh button, theme selector dropdown, font selector dropdown, font size ± buttons
- **Preview area**: Renders current Markdown file with Obsidian's `MarkdownRenderer`, then applies `MPConverter.formatContent()` + theme CSS
- **Bottom bar**: Help tooltip, "Copy to WeChat" button, "Publish" button
- **Auto-refresh**: Listens to `file-open` and `vault.modify` events; 500ms debounce on content changes
- **Scroll preservation**: Maintains scroll position on content updates (tracks bottom-anchored state)
- **Theme sync**: Polls settings every 2s to detect theme changes from the theme manager panel

### 5. Copy Pipeline (`copyManager.ts`)

`CopyManager.copyToClipboard()`:
1. Calls `getInlinedHtml()` to produce final HTML
2. Writes to clipboard as `text/html` + `text/plain` via `ClipboardItem`

`CopyManager.getInlinedHtml()`:
1. Optionally converts images to base64 data URLs (for clipboard; **not** for publish)
2. Extracts `<style>` tag CSS from the content section
3. Serializes DOM to HTML string via `XMLSerializer`
4. Runs `juice` to inline CSS into `style` attributes
5. **Post-juice fixes**: reapplies computed styles for code highlighting + image captions (styles from `styles.css`, not in theme CSS, so juice can't inline them)
6. Cleans up `data-*`, `id`, `class` attributes (CSS already inlined)
7. Processes list items for inline display

### 6. WeChat Publishing (`publisher/wechat.ts`)

`WechatPublisher` handles the full publishing workflow:

#### Authentication
- Uses WeChat `stable_token` API (POST, not GET)
- **Token caching**: 110-min expiry cached in `localStorage` per account
- **Automatic retry**: 3 attempts with exponential backoff on token fetch
- **Token refresh**: Auto-refresh on 40001/40014/42001 errors
- **Multi-account support**: Each account has independent token cache

#### Image Processing (`processDocumentImages`)
1. Parses HTML content with `sanitizeHTMLToDom`
2. Processes list items for inline display
3. For each `<img>`:
   - **Base64 data URLs** (formula-generated): Decodes and uploads to WeChat
   - **`app://` local images**: Fetches via `window.fetch()`, uploads, caches metadata
   - **`http(s)://` remote images**: Downloads via `requestUrl`, uploads, caches
   - **File path images**: Resolves via `metadataCache.getFirstLinkpathDest()`, reads binary, uploads
4. Image metadata is cached per-document in `settings.documentMetadata[filePath]` to avoid re-uploading

#### Draft Management
- Creates/updates WeChat drafts via `draft/add` or `draft/update` API
- Stores `media_id` in document metadata for subsequent updates
- Handles stale draft IDs (40007 error) by falling back to new draft creation

#### WeChat-Specific HTML Transformations
- Converts `\n` in `<code>` blocks to `<br>` tags (WeChat API strips newlines)
- Converts inline `<code>` (outside `<pre>`) to `<span>` (WeChat renders all `<code>` as code blocks)

#### Publishing Flow
1. Progress indicator overlay shown
2. Images uploaded to WeChat with progress updates
3. Code block newlines converted
4. Draft created/updated via WeChat API
5. Draft metadata persisted
6. Success notification

### 7. Settings (`settings/`)

**SettingsManager**: Wraps Obsidian's `loadData()`/`saveData()`. Handles data migration:
- Old `templateId` → `activeThemeId`
- Old single-account config → multi-account `wechatAccounts[]`

**Key settings** (`MPSettings`):
- Theme: `activeThemeId`, `fontFamily`, `fontSize`, `hiddenThemeIds[]`
- WeChat: `wechatAccounts[]`, `activeWechatAccountId`, legacy `wechatAppId`/`wechatAppSecret`
- Publishing: `convertMathToSVG`, `extractFromFrontmatter`, `frontmatterTitleKey`, `frontmatterDescriptionKey`
- Debug: `debugMode`
- Document metadata: `documentMetadata` (image upload cache, draft IDs)

### 8. Utility Modules

#### `pseudo-element-renderer.ts`
Solves the problem that WeChat and juice cannot handle CSS `::before`/`::after` pseudo-elements:
1. Parses theme CSS to extract pseudo-element rules
2. Parses counter-reset/counter-increment configurations
3. Walks the DOM tree computing counter values
4. Creates real `<span>` elements with inline styles matching the pseudo-element rules
5. Removes pseudo-element rule blocks from CSS before juice inlining

Supports `content` values with mixed strings + `counter()` expressions, counter styles (decimal, decimal-leading-zero, upper/lower-roman, upper/lower-alpha), and Unicode escapes.

#### `html-cleaner.ts`
Removes Obsidian-specific UI elements from rendered HTML: copy buttons, internal links, collapse indicators, embed links, popovers, tooltips, task checkboxes. Preserves SVG elements and diagram containers.

#### `math-formula.ts`
- `preprocessMathFormula()`: Normalizes LaTeX delimiters (`\[...\]`→`$$...$$`, `\(...\)`→`$...$`) while protecting code blocks
- `waitForAsyncRender()`: Polls for MathJax/Mermaid rendering completion (up to 3s)
- `convertMathToSVG()`: Replaces MathJax containers with CodeCogs API PNG images (for WeChat compatibility)

#### `image-utils.ts`
Unified image fetching: supports `http(s)://` (via Obsidian `requestUrl`) and `app://` (via `window.fetch`). Converts ArrayBuffer to base64 data URLs.

#### `font-image-renderer.ts`
Converts text elements using non-default fonts into PNG images via Canvas 2D API:
1. Builds a "safe font" set from `DEFAULT_FONTS` + universal system fonts (宋体, 黑体, PingFang, Arial, etc.)
2. Walks the DOM tree, collecting block-level elements (h1-h6, p, blockquote, etc.) whose computed `font-family` primary font is NOT in the safe set
3. Verifies font availability via Canvas `measureText()` width comparison (detects if the font is actually loaded/installed)
4. Renders each qualifying text block to a hidden Canvas: word-wrapping via `measureText()` with CJK-aware line breaking, 2x scale for HiDPI
5. Replaces the original DOM element with an `<img src="data:image/png;base64,...">` inheriting layout CSS properties
6. The PNG data URL flows through juice CSS inlining and into the final output

**Key design decisions**:
- Only converts block-level elements (not inline spans) to avoid breaking text flow
- Skips elements where the font isn't actually available on the system (no point converting what will fall back anyway)
- Runs after pseudo-element rendering so pseudo-element text is also converted
- Runs while DOM is still mounted (needed for `getComputedStyle()` and `getBoundingClientRect()`)

#### `dom-utils.ts`
- `processListItems()`: Ensures `<p>` tags inside `mp-list-item` sections are inline
- `collectTextNodes()`: TreeWalker-based text node collection
- `parseHtmlToContainer()`: `sanitizeHTMLToDom` + temp div pattern

#### `logger.ts`
Singleton logger with debug mode toggle. Prefixes: `[DEBUG]`, `[INFO]`, `[WARN]`, `[ERROR]`.

### 9. UI Components

#### `PublishModal` (`ui/modals.ts`)
Publishing dialog with:
- Title + description inputs (auto-filled from frontmatter if enabled)
- Platform selector (WeChat only currently)
- Multi-account selector
- Cover image picker (opens `CoverImageModal`)
- Publish button

#### `CoverImageModal`
Cover image selection with two tabs:
- **素材库 (Material Library)**: Paginated grid from WeChat material API (20 per page)
- **本地图片 (Local Image)**: File picker with preview + direct upload

#### `ProgressIndicator` (`ui/ProgressIndicator.ts`)
Floating overlay showing publishing progress bar with step counter, status text, and warning to not close the page. Auto-hides on success (1.5s delay).

### 10. Theme Management Views

- **`ThemeManagerView`**: Full theme browser with sections for custom themes, community themes, builtin themes, and downloadable remote themes. Each theme card shows name, author, description, and action buttons (quick-switch toggle, preview, view CSS, delete).
- **`ThemePreviewView`**: Renders sample Markdown with a selected theme in a split pane.
- **`ThemeCSSView`**: Read-only syntax-highlighted CSS viewer with copy button. Local themes support edit mode with textarea + save.
- **`MarkdownDocView`**: Renders GUIDE.md / CHANGELOG.md from local plugin dir or GitHub raw as fallback.

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `obsidian` | Obsidian plugin API (types only, external at runtime) |
| `juice` | CSS inlining — converts `<style>` rules to inline `style` attributes |
| `highlight.js` | Code syntax highlighting (bundled but style is from Obsidian's theme) |
| `nanoid` | Generate unique IDs for WeChat accounts |

---

## Build System

`esbuild.config.mjs` bundles TypeScript+CSS into `main.js` and `styles.css`. CSS files are imported as strings via a custom `text` loader. `npm run build` runs `tsc --noEmit` for type checking, then esbuild for bundling.

---

## Development Notes

- **`activeDocument` vs `document`**: The codebase consistently uses `activeDocument` (the Obsidian window's document) rather than global `document`, because in Electron environments the active document context matters for DOM operations.
- **`setCssProps()`**: Obsidian's HTMLElement extension that sets CSS properties via the DOM API. Used extensively instead of direct style string manipulation.
- **`sanitizeHTMLToDom()`**: Obsidian's HTML sanitizer — preferred over `innerHTML` assignment for security.
- **No `innerHTML` usage**: The codebase avoids `innerHTML` in favor of `createEl()`/`createSpan()` etc. to satisfy Obsidian's linting rules.
- **Theme CSS constraints**: All selectors must start with `.mp-content-section`. CSS variables, `@media`, `@font-face`, pseudo-elements, and `!important` are not supported (pseudo-elements are handled by the prerenderer).
- **WeChat compatibility challenges**: WeChat's editor aggressively normalizes HTML — strips certain tags, collapses whitespace, removes `style` attributes selectively. The codebase works around this through extensive DOM restructuring and juice CSS inlining.
