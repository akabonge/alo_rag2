# How the AI Alo portfolio works

Read this as a guided system map: first the whole site, then the browser, answers, guestbook and deployment. The diagrams describe the code in this repository, not unverified infrastructure in a hosting account. File links let you move from each explanation to its implementation.

## 1. The complete system

```mermaid
flowchart TB
    Git[GitHub main branch] -->|Connected deployment| Vercel[Vercel]
    Vercel --> Static[Static files from src]
    Vercel --> Ask[api/ask.js]
    Vercel --> Guest[api/guestbook.js]
    Static --> Browser[Visitor browser]
    CDN[jsDelivr pinned modules] --> Browser
    Fonts[Google Fonts] --> Browser
    Browser -->|Question JSON| Ask
    Ask -->|Sources and question| Model[Anthropic Messages API]
    Model -->|Answer text| Ask
    Ask -->|Answer and source labels| Browser
    Browser -->|Read or add notes| Guest
    Guest <-->|REST pipeline| Redis[Upstash Redis]
    Browser -.->|Conditional script| Analytics[Vercel Analytics]
    Browser -->|External links| Demos[Separate project demos]
```

The browser renders the portfolio. Serverless functions handle operations that need credentials. Redis holds shared guestbook notes; portfolio facts live in source-controlled JavaScript. The Railway-hosted business demos are external destinations, not backend components required to render this portfolio.

Implementation: [deployment configuration](../vercel.json), [page](../src/page.html), [Ask API](../api/ask.js), [guestbook API](../api/guestbook.js).

## 2. From content to a navigable 3D world

```mermaid
flowchart LR
    Facts[content.js] --> UI[main.js UI and scene]
    Page[page.html] --> Wrap[Python page wrapper]
    Wrap --> Index[index.html]
    Facts --> Generator[Node text generator]
    Generator --> Text[text.html]
    Index --> UI
    Helpers[flags.js / landmask.js / usmap.js] --> UI
    Assets[Photos / audio / video / PDF] --> UI
    UI --> Scroll[Lenis scrolling]
    Scroll --> Motion[GSAP transitions]
    Motion --> Scene[Three.js scene and camera]
    Scene --> GPU[WebGL2 rendering and postprocessing]
```

1. [`content.js`](../src/content.js) defines profile facts, places, experience, projects, skills, community work, tour narration and endpoint URLs.
2. [`page.html`](../src/page.html) supplies HTML, CSS, accessible controls, metadata and the dependency import map. [`wrap.py`](../test/wrap.py) wraps it into the served `index.html`.
3. [`main.js`](../src/main.js) connects those DOM controls to the scene, camera, drawers, question panel and visitor stars. Lenis and GSAP coordinate scrolling and motion.
4. Three.js renders the world using WebGL2. Its add-ons provide bloom and other postprocessing passes plus thick line geometry. The map/flag helpers supply custom geographical and visual data.
5. [`make_text.mjs`](../test/make_text.mjs) creates the readable text page from the same facts. This provides an alternative to navigating the 3D scene. Reduced-motion preferences also affect interaction behavior.

Both generated HTML pages are committed. Vercel's configured build command is null, so editing a template alone does not regenerate the deployed page. The favicon is referenced in both page sources to survive regeneration.

## 3. Ask Alo: source-grounded answers, step by step

```mermaid
sequenceDiagram
    participant V as Visitor
    participant B as Browser
    participant R as Shared retrieval module
    participant A as Ask API
    participant C as Claude
    V->>B: Ask a question
    B->>R: Search local corpus, up to 4 chunks
    alt Insufficient relevance
        R-->>B: No matches
        B-->>V: Not covered on this site
    else Relevant sources
        R-->>B: Ranked sources and station IDs
        B-->>V: Extracted answer and camera navigation
        B->>B: Check session answer cache
        opt Browser cache miss
            B->>A: POST question
            A->>A: Validate, rate limit, check instance cache
            opt Server cache miss
                A->>R: Retrieve up to 3 chunks
                R-->>A: Grounded sources
                A->>C: Question and numbered sources
                C-->>A: Short cited answer
            end
            A-->>B: Answer and source labels
        end
        B-->>V: Display answer with sources
    end
```

[`ask.js`](../src/ask.js) builds chunks from the portfolio facts. Tokenization, a small stemmer, stop words and hand-written synonyms feed BM25-style ranking with a source-title boost. A candidate must match at least half the question's term groups and more groups than the count of terms unknown to the corpus. This is why a single shared word such as “white” should not turn a White House question into a White Nile answer.

The browser retrieves up to four chunks, extracts two relevant sentences from the best chunk and navigates to its scene station. The server independently retrieves up to three chunks and caps each source text at 700 characters. Its prompt asks Claude for two or three sentences with numbered citations, using only those sources. Output is capped at 220 tokens. Retrieval gating and prompt instructions reduce unsupported answers; generated claims and citations are not independently verified by another model or validator.

The default model identifier in code is `claude-haiku-4-5-20251001`, overridable through `ANTHROPIC_MODEL`. Calls use native `fetch`, not an Anthropic SDK. There is no vector database or embedding service in this portfolio's retrieval path. Technologies such as ChromaDB and Ollama mentioned in project descriptions belong to those projects.

### Caches, limits and fallbacks

| Layer | Current implementation | Scope |
| --- | --- | --- |
| Browser answer cache | Normalized question keys in `sessionStorage` | Browser tab session; no explicit TTL |
| Server answer cache | Up to 300 answers, 24-hour TTL | Warm function instance only |
| Ask request limit | 8 requests per IP per minute | In-memory, per instance, best effort |
| Input bound | Question trimmed to 300 characters | Ask API |
| Server response | `Cache-Control: no-store` | HTTP caching disabled |

If the endpoint fails, the browser can use the optional `window.claude` sampling integration when that host supplies it. Otherwise the extracted local answer remains. Ordinary website visitors do not need that integration. No-match server requests return a refusal without calling Claude. The sequence diagram shows the successful model path; network or provider failures take the fallback path.

## 4. Guestbook: a message becomes a star

```mermaid
flowchart TD
    Form[Name / city / message] --> API[POST guestbook API]
    API --> Clean[Strip links and HTML; bound lengths]
    Clean --> Check[Required fields and abuse filter]
    Check --> Limit[Redis IP counter]
    Limit --> Store[LPUSH note and LTRIM to 300]
    Store --> List[Read shared notes]
    List --> Stars[Browser list and star scene]
    Read[GET guestbook API] --> List
    Admin[DELETE with admin key] --> Remove[Remove note by timestamp]
    Remove --> StoreList[Rewrite remaining Redis list]
```

[`api/guestbook.js`](../api/guestbook.js) uses the Redis REST pipeline directly. Notes include name, city, message and timestamp. Names are capped at 30 characters, cities at 30 and messages at 90. The API rejects a count above three for each IP; the Redis counter expiry is reset to one hour on every attempted valid submission, so it is not a fixed calendar-hour window.

The shared list retains at most 300 notes. The UI lists up to 40; local-only fallback storage retains up to 50. At initialization the browser tries the server, then a host-provided Claude database, then `localStorage`. Local notes stay in that browser and are not shared with other visitors. A missing Redis configuration returns 503; upstream storage errors return 502.

An optional admin key authorizes deletion by timestamp. The current delete operation reads and rewrites the list; concurrent writes can race with moderation. The word filter is a basic automated filter, not a complete moderation system.

## 5. Technology and package inventory

Versions below are the repository's declared versions, not claims about the latest releases.

| Technology | Version/source | Role here |
| --- | --- | --- |
| HTML and CSS | Native web platform | Semantic sections, responsive layout, overlays, controls, metadata |
| JavaScript ES modules | Native browser and Node.js modules | Shared content/retrieval and application code |
| `three` | 0.186.1 | Scene, geometry, camera, materials, WebGL2 renderer |
| Three.js add-ons | Same package/version | EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass, LineSegments2, LineSegmentsGeometry, LineMaterial |
| `gsap` | 3.15.0 | Animation and transitions |
| `lenis` | 1.3.26 | Smooth scrolling |
| jsDelivr | Browser import map | Delivers the three pinned packages without a bundle step |
| `serve` | Unpinned npx development command | Local static HTTP server; not a declared runtime dependency |
| Node.js/npm | No engine version pinned | API JavaScript, text generator and development commands |
| Python 3 | Standard library only | Wraps the main HTML template |
| Vercel | `vercel.json` | Static serving and serverless functions; optional analytics script |
| Anthropic Messages API | Native HTTPS fetch | Generates cited answers from retrieved portfolio sources |
| Upstash Redis REST API | Native HTTPS fetch | Shared guestbook notes and submission counters |
| Web Audio API | Browser | Synthesized ambient sound and effects |
| HTML media APIs | Browser | Recorded MP3 greetings/tours and MP4 video |
| Web Speech APIs | Browser-dependent | Speech synthesis and supported voice input |
| Web Storage | Browser | Session answer cache, preferences and local guestbook fallback |
| Google Fonts | Hosted CSS/font files | Bricolage Grotesque, IBM Plex Mono and IBM Plex Sans |
| SVG, JPEG, PDF | Static assets | Favicon, photos/share card and downloadable resume |
| Git/GitHub | Repository workflow | Source history and hosting integration input |
| Mermaid | GitHub Markdown rendering | Architecture diagrams in these docs; no website runtime dependency |

[`package.json`](../package.json) declares only three runtime packages. The browser uses the versions in the import map, so keep that map and the manifest synchronized when upgrading. Custom `flags.js`, `landmask.js`, `usmap.js` and `ask.js` are local modules, not npm packages. The optional `window.claude` capabilities are host integrations, not installed dependencies.

## 6. Configuration and deployment

```mermaid
flowchart LR
    Edit[Edit content and templates] --> Generate[Run page generators when needed]
    Generate --> Review[Review generated HTML and source changes]
    Review --> Commit[Commit and push main]
    Commit --> Integration[Connected Vercel Git integration]
    Integration --> Static[Serve committed src files]
    Integration --> Functions[Deploy API functions]
    Env[Server environment variables] --> Functions
```

| Variable | Purpose | Required for |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Authenticates model requests | Server-generated answers |
| `ANTHROPIC_MODEL` | Overrides the model identifier | Optional |
| `UPSTASH_REDIS_REST_URL` | Redis REST endpoint | Shared guestbook |
| `UPSTASH_REDIS_REST_TOKEN` | Redis REST credential | Shared guestbook |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Supported alternative Redis names; take precedence | Alternative to Upstash-named variables |
| `GUESTBOOK_ADMIN_KEY` | Authorizes note deletion | Optional moderation |

Secrets belong in the server environment, never in `src/`. Questions travel to the Ask function and, on an uncached model request, to Anthropic with selected public portfolio facts. Guestbook submissions travel to the function and Redis. IP-derived Redis counter keys are used for submission limiting.

The output directory is `src`. Ask has a configured maximum duration of 20 seconds and guestbook 10 seconds. The repository does not pin the Node engine or include a package lockfile. Domain, DNS, actual environment values, analytics enablement and deployment success are hosting-account state, not established by these files.

## 7. Operating boundaries and future improvements

The site can deliver its static content independently of model and guestbook availability. Its browser still depends on external module/font delivery for the full visual experience. The text page provides a simpler reading path.

The current implementation has no distributed answer cache and no durable Ask rate limiter. A scheduled GitHub Actions smoke check (`.github/workflows/uptime.yml`) verifies the live pages, both APIs and the demos every 6 hours. It also has no model citation verifier. If traffic grows, useful next steps are shared rate limiting/caching, API error-path coverage, and atomic guestbook moderation. These are future options, not infrastructure already deployed.

Keep the facts and generated pages synchronized, review model/provider usage in their dashboards, and avoid treating per-instance limits as a global cost ceiling. This architecture deliberately keeps public content in Git and credentials in the server runtime.
