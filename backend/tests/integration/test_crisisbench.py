"""Integration tests for CrisisBench-mini benchmark generation and split leakage."""

from pathlib import Path

from experiments.bench.manifest import generate_crisisbench_mini


def test_crisisbench_mini_generation_and_leakage(tmp_path: Path):
    """Verify CrisisBench-mini produces 240 instances, strict 8/2/2 event splits,

    and zero event leakage between train, val, and test partitions.
    """
    manifest = generate_crisisbench_mini(
        output_dir=tmp_path / "bench",
        instances_per_event=20,
        seed=42,
    )

    assert manifest["total_instances"] == 240
    assert manifest["event_count"] == 12
    assert manifest["leakage_verified"] is True

    # Check split breakdown
    summary = manifest["split_summary"]
    assert summary["train"] == 160  # 8 events * 20
    assert summary["val"] == 40  # 2 events * 20
    assert summary["test"] == 40  # 2 events * 20

    # Verify no overlap between event IDs
    instances = manifest["instances"]
    train_events = {i["event_id"] for i in instances if i["split"] == "train"}
    val_events = {i["event_id"] for i in instances if i["split"] == "val"}
    test_events = {i["event_id"] for i in instances if i["split"] == "test"}

    assert train_events == {1, 2, 3, 4, 5, 6, 7, 8}
    assert val_events == {9, 10}
    assert test_events == {11, 12}

    assert len(train_events.intersection(test_events)) == 0
    assert len(val_events.intersection(test_events)) == 0
    assert len(train_events.intersection(val_events)) == 0
