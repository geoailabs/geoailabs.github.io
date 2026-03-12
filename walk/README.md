# Static Deck.gl Walkability Dashboard

This subfolder contains a static HTML migration of the original Streamlit dashboard.

## Contents

- `index.html`, `app.js`, `styles.css`: the frontend
- `scripts/export_geojson.py`: converts the shapefiles in the parent repo into GeoJSON and a manifest
- `data/`: generated GeoJSON and metadata
- `assets/`: copied images used by the page

All layers are exported as GeoJSON in this version, including the heavier Bangalore tree layer.

## Export the data

```bash
conda run -n walkdash python static-deckgl/scripts/export_geojson.py
```

## Serve locally

Use a local static server so the browser can fetch `./data/*.json`:

```bash
cd static-deckgl
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).
