from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd


ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"
DATA_DIR = DOCS_DIR / "data"
BUILDINGS_DIR = DATA_DIR / "buildings"

HYD_PINCODES_GEOJSON = ROOT / "data" / "hyderabad-pincodes.geojson"
HYD_BUILDINGS_PARQUET = ROOT / "data" / "hyd-buildings.parquet"
INFOSYS_BUILDINGS_SHP = ROOT / "data" / "shps" / "shpsinfosys-buildings.shp"

BUILDING_CHUNK_SIZE = 50_000


def write_geojson(gdf: gpd.GeoDataFrame, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(gdf.to_json(drop_id=True), encoding="utf-8")


def write_chunked_geojson(gdf: gpd.GeoDataFrame, output_dir: Path, chunk_size: int) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)

    for existing in output_dir.glob("part-*.geojson"):
        existing.unlink()

    parts = []
    total_features = len(gdf)

    for start in range(0, total_features, chunk_size):
        end = min(start + chunk_size, total_features)
        chunk = gdf.iloc[start:end]
        file_name = f"part-{(start // chunk_size) + 1:03d}.geojson"
        write_geojson(chunk, output_dir / file_name)
        parts.append({"file": file_name, "features": len(chunk)})
        print(f"Wrote {file_name} with {len(chunk)} features")

    return {
        "total_features": total_features,
        "chunk_size": chunk_size,
        "parts": parts,
    }


def export_data() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    hyd_pin_codes = gpd.read_file(HYD_PINCODES_GEOJSON)[["pin_code", "cool", "geometry"]]
    write_geojson(hyd_pin_codes, DATA_DIR / "hyderabad-pincodes.geojson")
    print("Wrote hyderabad-pincodes.geojson")

    infosys_buildings = gpd.read_file(INFOSYS_BUILDINGS_SHP)[
        ["cool", "area_in_me", "confidence", "geometry"]
    ].to_crs("EPSG:4326")
    write_geojson(infosys_buildings, DATA_DIR / "infosys-buildings.geojson")
    print("Wrote infosys-buildings.geojson")

    hyd_buildings = gpd.read_parquet(HYD_BUILDINGS_PARQUET, columns=["geometry", "cool"])
    hyd_buildings = hyd_buildings.set_crs("EPSG:32644", allow_override=True).to_crs("EPSG:4326")

    manifest = write_chunked_geojson(hyd_buildings[["cool", "geometry"]], BUILDINGS_DIR, BUILDING_CHUNK_SIZE)
    (BUILDINGS_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2),
        encoding="utf-8",
    )
    print("Wrote building manifest")


if __name__ == "__main__":
    export_data()
