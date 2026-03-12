# GitHub Pages Export

This `docs/` folder contains a standalone static site version of the Hyderabad cool-roof map.

## What it includes

- A Deck.gl-based frontend in `index.html` and `app.js`
- Static assets under `docs/data/`
- Chunked GeoJSON for all individual Hyderabad buildings
- Ready-to-publish structure for GitHub Pages from the `docs/` folder

## Refreshing the exported data

Run the exporter from the project root in the `coolroofs` conda environment:

```bash
conda run -n coolroofs python docs/export_static_site_data.py
```

## Publishing

In GitHub Pages settings, choose:

- Branch: `main` (or your default branch)
- Folder: `/docs`
