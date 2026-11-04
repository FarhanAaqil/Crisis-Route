"""Unit tests for pre-registered hypothesis testing harness."""

from pathlib import Path

from experiments.evaluate_hypotheses import run_all_hypothesis_evaluations


def test_all_preregistered_hypotheses_pass():
    """Verify pre-registered hypotheses H1-H4 evaluate to passing results (Gate Criterion 1)."""
    outcomes = run_all_hypothesis_evaluations()

    assert len(outcomes) == 4
    for o in outcomes:
        assert o.target_threshold_met is True, (
            f"Hypothesis {o.hypothesis_id} failed to meet target: baseline={o.baseline_value}, "
            f"treatment={o.treatment_value}, gain={o.relative_improvement_pct}%, p={o.p_value}"
        )

    # Check report files generated
    json_path = Path("reports/hypothesis_results.json")
    md_path = Path("reports/empirical_study.md")
    assert json_path.exists()
    assert md_path.exists()
