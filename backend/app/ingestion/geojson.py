"""GeoJSON Ingestion Interface."""

from app.ingestion.geojson_parser import parse_geojson_features, parse_geojson_file

__all__ = ["parse_geojson_features", "parse_geojson_file"]
