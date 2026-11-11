# Contributing to CrisisRoute

Thank you for your interest in contributing to CrisisRoute. This project provides life-critical decision support for disaster logistics; as such, all contributions must uphold the highest standards of mathematical rigor, code quality, and operational safety.

---

## 1. Ethical Invariants & Operational Safety

CrisisRoute strictly adheres to human-in-the-loop operational safety standards:
- **No Autonomous Life-Safety Actions:** Algorithmic outputs are probabilistic decision support; they never autonomously dispatch resources or certify road safety without explicit human Incident Lead authorization.
- **Mandatory Disclaimers:** All user interfaces, exported plans, and API responses must preserve the mandatory uncertainty notice:
  > *"CrisisRoute provides probabilistic decision support under road uncertainty. It does not certify route safety or replace ground situational reports."*
- **Auditability:** Any code altering optimization objectives, constraints, or passability models must record immutable audit trail entries with cryptographic event identifiers.

---

## 2. Development Workflow & Quality Gates

### Branching Strategy
- Work lands on `master`; after each phase a pull request merges `master` into `main`.
- The CI gate must be green before merging: ruff lint and format, mypy, pytest, ESLint, tsc, vitest, the production build and the Docker build.
- Merge commits to `main` are non-fast-forward. Keep commit messages short, plain sentences that say what changed and why.

### Quality Checks
Before submitting a pull request, verify all quality gates locally:

```bash
# 1. Python Linting & Formatting
ruff check backend experiments
ruff format --check backend experiments

# 2. Static Type Verification
mypy --config-file backend/pyproject.toml backend/app experiments

# 3. Backend Unit & Integration Tests (100% pass required)
pytest

# 4. Frontend Typecheck & Vitest Suite
npm run lint --prefix frontend
npm run typecheck --prefix frontend
npm run test --prefix frontend
```

---

## 3. Commit Message Standards

To ensure a clean, professional git history:
- Use natural, descriptive English commit messages explaining *what* and *why*.
- Strictly avoid robotic prefixes like `feat:`, `fix:`, `add:`, `make:`, `chore:`.
- Maintain consistent author attribution:
  `Farhan Aaqil <fadurrani543@gmail.com>`.

---

## 4. Reporting Issues

Please open an issue on GitHub detailing:
1. Environment specifications (OS, Python version, Node version);
2. Benchmark instance ID or scenario parameters;
3. Expected vs. observed behavior;
4. Full stack trace or solver diagnostic output.

