from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "shps"
DATA = ROOT / "data"
CROSSINGS_DIR = DATA / "crossings"
TREES_DIR = DATA / "trees"

CITIES = ["amd", "blr", "chennai", "gurgaon", "hyd", "indore", "jaipur", "mohali", "pune"]
CROSSINGS_PER_KM = {
    "amd": 2.803,
    "blr": 2.885,
    "chennai": 2.276,
    "gurgaon": 1.874,
    "hyd": 3.319,
    "indore": 1.132,
    "jaipur": 0.655,
    "mohali": 2.626,
    "pune": 5.289,
}
TREE_FILES = {
    "mohali": "mohali_merged.shp",
    "blr": "blr_merged.shp",
}
CITY_LABELS = {
    "amd": "Ahmedabad",
    "blr": "Bangalore",
    "chennai": "Chennai",
    "gurgaon": "Gurgaon",
    "hyd": "Hyderabad",
    "indore": "Indore",
    "jaipur": "Jaipur",
    "mohali": "Mohali",
    "pune": "Pune",
}


def ensure_dirs() -> None:
    CROSSINGS_DIR.mkdir(parents=True, exist_ok=True)
    TREES_DIR.mkdir(parents=True, exist_ok=True)


def serialize_bounds(bounds: tuple[float, float, float, float]) -> list[float]:
    return [round(float(value), 6) for value in bounds]


def serialize_center(bounds: tuple[float, float, float, float]) -> list[float]:
    min_x, min_y, max_x, max_y = bounds
    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2
    return [round(float(center_x), 6), round(float(center_y), 6)]


def round_coordinates(value: object) -> object:
    if isinstance(value, list):
        if value and isinstance(value[0], (int, float)):
            return [round(float(item), 6) for item in value]
        return [round_coordinates(item) for item in value]
    return value


def export_geojson(gdf: gpd.GeoDataFrame, destination: Path) -> dict[str, object]:
    gdf = gdf.to_crs("EPSG:4326")
    payload = json.loads(gdf.to_json(drop_id=True))
    payload.pop("crs", None)

    for feature in payload["features"]:
        feature["properties"] = {
            key: value for key, value in feature.get("properties", {}).items() if value is not None
        }
        feature["geometry"]["coordinates"] = round_coordinates(feature["geometry"]["coordinates"])

    destination.write_text(json.dumps(payload, separators=(",", ":")))
    bounds = tuple(gdf.total_bounds.tolist())
    return {
        "path": destination.relative_to(ROOT).as_posix(),
        "featureCount": int(len(gdf)),
        "bounds": serialize_bounds(bounds),
        "center": serialize_center(bounds),
    }


def build_manifest() -> dict[str, object]:
    manifest: dict[str, object] = {
        "cities": {},
        "treeCities": list(TREE_FILES),
    }

    for city in CITIES:
        gdf = gpd.read_file(SOURCE / f"{city}_simplified.shp")
        crossings_meta = export_geojson(gdf, CROSSINGS_DIR / f"{city}.geojson")
        manifest["cities"][city] = {
            "label": CITY_LABELS[city],
            "crossingsPerKm": CROSSINGS_PER_KM[city],
            "crossings": crossings_meta,
        }

    for city, filename in TREE_FILES.items():
        source_path = SOURCE / filename
        pmtiles_path = TREES_DIR / f"{city}.pmtiles"
        if pmtiles_path.exists():
            pmtiles_path.unlink()
        gdf = gpd.read_file(source_path)
        tree_meta = export_geojson(gdf, TREES_DIR / f"{city}.geojson")
        tree_meta["format"] = "geojson"
        manifest["cities"][city]["trees"] = tree_meta

    return manifest


def main() -> None:
    ensure_dirs()
    manifest = build_manifest()
    manifest_path = DATA / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"Wrote {manifest_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
