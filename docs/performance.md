# Performance notes

Measured with Lighthouse 12 against the production build served by the API (`/`, sign-in page, Chrome headless on a development laptop).

| Preset | Performance | Accessibility | Best practices | FCP | LCP | TBT |
|---|---|---|---|---|---|---|
| Desktop | 100 | 100 | 100 | 0.4 s | 0.4 s | 0 ms |
| Mobile (4x CPU throttle, slow 4G) | 47 on the test laptop | 100 | 100 | 3.1 s | 4.1 s | 3.8 s |

The mobile number is dominated by emulated CPU slowdown of React start-up on a busy laptop; transfer size is 67 KiB. Re-run on a quiet machine or in CI for a stable figure.

## What is in place

| Technique | Where |
|---|---|
| Server-side response caching keyed by scenario version | `backend/app/core/cache.py`, used by passability, routes, recon and the plan risk comparison |
| Cached expensive computation (optimizer comparison over sampled worlds) | `_RISK_CACHE` in `api/intelligence.py` |
| gzip for API and static payloads | `GZipMiddleware` in `main.py` |
| Immutable year-long caching of hashed assets, `no-cache` for `index.html` | `SPAStaticFiles` in `main.py` |
| Pagination | audit (`limit`, `offset`, `X-Total-Count`), observations |
| Code splitting, lazy loading | one chunk per page, three.js and MapLibre load only on the Map views |
| Bundle size | first paint about 34 kB app code plus 142 kB React (about 56 kB gzipped); was a 1.64 MB single bundle |
| Unused dependencies removed | `@tanstack/react-query` |
| Minified JS and CSS, no render-blocking scripts | Vite build, module scripts |
| Fonts | system font stack, nothing to download |
| Images | screenshots quantised (about 650 kB to 230 kB) |
| Debounced input | link search on the observations page |
| Loading skeletons, no empty flashes | `useAsync` keeps previous data while reloading |
| Fewer network requests | passability fetched once per scenario version, shared by the map and observation screens through the server cache |

## Not applicable or left to deployment

- **Database indexing, N+1 queries, connection pooling:** there is no database. State is JSON files and an in-memory index, so there are no queries to optimise.
- **Load balancer and CDN:** `deploy/nginx.example.conf` shows a least-connections upstream and long-lived asset caching that a CDN can honour. Running several replicas requires a shared state volume.
