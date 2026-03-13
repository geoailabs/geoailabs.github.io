# Street-View Tree Census Demo

This folder contains a self-contained public-facing demo that can be deployed directly as a
static site.

The map presents the output of a workflow that uses custom-trained computer vision models to
detect tree trunks from street-view imagery and convert those detections into a geographic tree
inventory. The broader idea is simple: if you can reliably identify trees from imagery that a
city already has or can collect at scale, you can build a tree census much faster than sending
teams to manually count every street one by one.

In the limited areas where ground-truth validation was carried out, the approach showed strong
accuracy. That makes the demo useful not just as a visualization, but as a preview of how
city-scale urban forestry monitoring could be modernized.

## What Visitors See

- A static interactive map of mapped trees and street-view capture points
- Basemap toggles for satellite, street, and minimal views
- Layer toggles for trees and street-view locations
- Clickable tree points with lightweight detection metadata

## Why This Version Exists

- It is GitHub Pages friendly
- It has no backend dependency
- It avoids the panorama-rendering pieces that made the original prototype heavier to deploy

Contents:
- `index.html`
- `app.js`
- `styles.css`
- `data/trees.geojson`
- `data/streetviews.geojson`
- `vendor/maplibre-gl.js`
- `vendor/maplibre-gl.css`

Notes:
- There is no backend dependency.
- Panorama fetching and rendering are intentionally removed.
- The only live network dependency left is third-party basemap tile servers.
- GeoJSON is prebuilt ahead of time for faster browser startup than CSV parsing.

Regeneration:
- If you need to rebuild the GeoJSON assets, run `python3 scripts/convert_standalone_demo_geojson.py` from the repo root.

GitHub Pages:
- Publish the contents of `standalone-demo/` as the site root.
- Do not open `index.html` via `file://`; serve it over HTTP.
