"""Contract validation tests for CrisisRoute JSON schemas and fixtures."""

import json
from pathlib import Path

import jsonschema


def test_scenario_fixture_conforms_to_schema():
    """Verify that canonical Kerala scenario fixture strictly conforms to scenario.schema.json."""
    contracts_dir = Path(__file__).resolve().parent.parent.parent / "contracts"
    schema_path = contracts_dir / "scenario.schema.json"
    fixture_path = contracts_dir / "fixtures" / "scenario.json"

    assert schema_path.exists(), f"Schema not found at {schema_path}"
    assert fixture_path.exists(), f"Fixture not found at {fixture_path}"

    with open(schema_path, encoding="utf-8") as sf:
        schema = json.load(sf)

    with open(fixture_path, encoding="utf-8") as ff:
        fixture = json.load(ff)

    # Validate against JSON Schema Draft 2020-12
    jsonschema.validate(instance=fixture, schema=schema)
