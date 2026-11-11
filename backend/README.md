# CrisisRoute Backend

FastAPI service behind `/api/v1`:

- Bearer-token sign-in (`/auth/login`) with role-based access control (analyst, field analyst, approver, admin)
- NetworkX corridor graph, risk-aware routing and Yen alternatives
- Evidence fusion: field reports update edge passability in log-odds with credibility and decay
- OR-Tools CP-SAT equitable allocation with a per-commodity floor for protected groups, plus a two-stage recourse model
- EVPI-ranked reconnaissance targets
- Maker-checker plan approval and a hash-chained audit ledger
- File-backed state under `CRISISROUTE_STATE_DIR`

Run locally from the repository root:

```bash
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

Configuration is read from `CRISISROUTE_*` environment variables (see `app/core/config.py`).
