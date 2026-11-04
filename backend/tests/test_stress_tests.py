"""Unit tests for adversarial stress testing and failure mode documentation."""

from pathlib import Path

from experiments.stress_tests import run_all_stress_tests


def test_five_out_of_five_stress_tests_executed():
    """Verify that all 5 out of 5 stress tests execute and degrade gracefully (Gate Criterion 2)."""
    tests = run_all_stress_tests()

    assert len(tests) == 5, f"Expected 5 stress tests, got {len(tests)}"
    for t in tests:
        assert t.graceful_degradation_verified is True, (
            f"Stress test {t.test_id} ({t.scenario_name}) did not degrade gracefully: "
            f"behavior={t.system_behavior}"
        )

    # Check reports written
    json_path = Path("reports/stress_tests_results.json")
    md_path = Path("reports/stress_tests.md")
    assert json_path.exists()
    assert md_path.exists()
