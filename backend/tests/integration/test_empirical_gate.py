"""Gate Verification for Phase 6: Empirical Evidence & Reproducibility.

Explicitly validates all three Empirical Evidence exit criteria:
1. All pre-registered hypotheses tested; results compiled into manuscript tables.
2. 5 out of 5 stress-test scenarios executed; failure modes documented.
3. Every claim in the paper draft links to a reproducible script producing the reported numbers.
"""

from pathlib import Path

from experiments.reproduce_all import build_reproducibility_manifest


def test_phase_6_exit_criteria_empirical_gate():
    """Verify Phase 6 Empirical Evidence gate: hypotheses, stress tests, and claim provenance."""
    manifest = build_reproducibility_manifest()

    # Exit Criterion 1: All hypotheses tested and verified
    assert manifest["hypothesis_tests"] is not None
    assert len(manifest["hypothesis_tests"]) == 4
    for h in manifest["hypothesis_tests"]:
        assert h["target_threshold_met"] is True

    # Exit Criterion 2: 5 out of 5 stress tests executed
    assert manifest["stress_tests"] is not None
    assert len(manifest["stress_tests"]) == 5
    for st in manifest["stress_tests"]:
        assert st["graceful_degradation_verified"] is True
        assert len(st["failure_mode_diagnosed"]) > 0

    # Exit Criterion 3: Every claim linked to reproducible script and verified
    claims = manifest["scientific_claims"]
    assert len(claims) == 5
    assert manifest["all_claims_verified"] is True
    for c in claims:
        assert c["verification_status"] == "VERIFIED"
        assert Path(c["script_path"].split("::")[0]).exists()

    # Check files exist
    assert Path("reports/reproducibility_manifest.json").exists()
    assert Path("reports/empirical_study.md").exists()
    assert Path("reports/stress_tests.md").exists()

