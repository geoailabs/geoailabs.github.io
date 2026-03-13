const treeGeoJsonUrl = './data/trees.geojson';
const streetViewGeoJsonUrl = './data/streetviews.geojson';
const { maplibregl } = window;

const basemapStyles = {
  satellite: {
    version: 8,
    sources: {
      satellite: {
        type: 'raster',
        tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
      },
    },
    layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
  },
  streets: {
    version: 8,
    sources: {
      streets: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
      },
    },
    layers: [{ id: 'streets', type: 'raster', source: 'streets' }],
  },
  minimal: {
    version: 8,
    sources: {
      minimal: {
        type: 'raster',
        tiles: ['https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
        tileSize: 256,
      },
    },
    layers: [{ id: 'minimal', type: 'raster', source: 'minimal' }],
  },
};

const state = {
  currentBasemap: 'satellite',
  treesVisible: true,
  streetViewsVisible: true,
  selectedTree: null,
  treeFeatures: [],
  streetViewFeatures: [],
};

const selectionContent = document.getElementById('selection-content');
const treeCount = document.getElementById('tree-count');
const streetViewCount = document.getElementById('streetview-count');
const toggleTrees = document.getElementById('toggle-trees');
const toggleStreetViews = document.getElementById('toggle-streetviews');
const basemapButtons = Array.from(document.querySelectorAll('.basemap-button'));

const map = new maplibregl.Map({
  container: 'map',
  style: basemapStyles[state.currentBasemap],
  center: [77.209, 28.6139],
  zoom: 11,
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

function updateSelection(tree) {
  state.selectedTree = tree;

  if (!tree) {
    selectionContent.className = 'empty-state';
    selectionContent.textContent = 'Click a tree point to inspect its static metadata.';
    return;
  }

  selectionContent.className = '';
  selectionContent.innerHTML = [
    `<div class="selection-line">Lat/Lng: ${tree.tree_lat.toFixed(6)}, ${tree.tree_lng.toFixed(6)}</div>`,
    `<div class="selection-line">Pano ID: ${tree.pano_id}</div>`,
    `<div class="selection-line">Confidence: ${Number.isFinite(tree.conf) ? tree.conf.toFixed(3) : 'N/A'}</div>`,
    `<div class="selection-line">Distance to pano: ${Number.isFinite(tree.distance_pano) ? tree.distance_pano.toFixed(2) : 'N/A'} m</div>`,
  ].join('');
}

function setBasemap(nextBasemap) {
  state.currentBasemap = nextBasemap;
  map.setStyle(basemapStyles[nextBasemap]);
  basemapButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.basemap === nextBasemap);
  });
  map.once('styledata', addSourcesAndLayers);
}

function updateLayerVisibility() {
  if (map.getLayer('trees-layer')) {
    map.setLayoutProperty('trees-layer', 'visibility', state.treesVisible ? 'visible' : 'none');
  }
  if (map.getLayer('streetviews-layer')) {
    map.setLayoutProperty(
      'streetviews-layer',
      'visibility',
      state.streetViewsVisible ? 'visible' : 'none'
    );
  }
}

function addSourcesAndLayers() {
  const treeGeoJson = {
    type: 'FeatureCollection',
    features: state.treeFeatures,
  };

  const streetViewGeoJson = {
    type: 'FeatureCollection',
    features: state.streetViewFeatures,
  };

  if (!map.getSource('trees')) {
    map.addSource('trees', { type: 'geojson', data: treeGeoJson });
  } else {
    map.getSource('trees').setData(treeGeoJson);
  }

  if (!map.getSource('streetviews')) {
    map.addSource('streetviews', { type: 'geojson', data: streetViewGeoJson });
  } else {
    map.getSource('streetviews').setData(streetViewGeoJson);
  }

  if (!map.getLayer('streetviews-layer')) {
    map.addLayer({
      id: 'streetviews-layer',
      type: 'circle',
      source: 'streetviews',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 16, 5],
        'circle-color': 'rgba(30, 144, 255, 0.82)',
        'circle-stroke-width': 0.5,
        'circle-stroke-color': '#ffffff',
      },
    });
  }

  if (!map.getLayer('trees-layer')) {
    map.addLayer({
      id: 'trees-layer',
      type: 'circle',
      source: 'trees',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 16, 6],
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          '#ff5a36',
          'rgba(34, 139, 34, 0.88)',
        ],
        'circle-stroke-width': 0.75,
        'circle-stroke-color': '#ffffff',
      },
    });
  }

  updateLayerVisibility();
}

function fitToData(features) {
  if (!features.length) {
    return;
  }

  const bounds = new maplibregl.LngLatBounds();
  features.forEach((feature) => bounds.extend(feature.geometry.coordinates));
  map.fitBounds(bounds, { padding: 80, duration: 0, maxZoom: 12.5 });
}

function attachInteractions() {
  map.on('click', 'trees-layer', (event) => {
    const feature = event.features && event.features[0];
    if (!feature) {
      return;
    }

    if (state.selectedTree) {
      map.setFeatureState({ source: 'trees', id: state.selectedTree.id }, { selected: false });
    }

    const tree = feature.properties;
    state.selectedTree = {
      id: feature.id,
      tree_lat: Number(tree.tree_lat),
      tree_lng: Number(tree.tree_lng),
      pano_id: tree.pano_id,
      conf: tree.conf ? Number(tree.conf) : NaN,
      distance_pano: tree.distance_pano ? Number(tree.distance_pano) : NaN,
    };

    map.setFeatureState({ source: 'trees', id: feature.id }, { selected: true });
    updateSelection(state.selectedTree);
  });

  map.on('mouseenter', 'trees-layer', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'trees-layer', () => {
    map.getCanvas().style.cursor = '';
  });

  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 12,
  });

  map.on('mousemove', 'trees-layer', (event) => {
    const feature = event.features && event.features[0];
    if (!feature) {
      return;
    }

    const props = feature.properties;
    popup
      .setLngLat(event.lngLat)
      .setHTML(
        `<strong>Tree</strong><br>Lat/Lng: ${Number(props.tree_lat).toFixed(6)}, ${Number(
          props.tree_lng
        ).toFixed(6)}<br>Pano ID: ${props.pano_id}<br>Confidence: ${
          props.conf ? Number(props.conf).toFixed(3) : 'N/A'
        }`
      )
      .addTo(map);
  });

  map.on('mouseleave', 'trees-layer', () => popup.remove());

  map.on('mousemove', 'streetviews-layer', (event) => {
    const feature = event.features && event.features[0];
    if (!feature) {
      return;
    }

    const props = feature.properties;
    popup
      .setLngLat(event.lngLat)
      .setHTML(
        `<strong>Street View Point</strong><br>Lat/Lng: ${Number(props.lat).toFixed(6)}, ${Number(
          props.lng
        ).toFixed(6)}<br>Pano ID: ${props.pano_id}`
      )
      .addTo(map);
  });

  map.on('mouseleave', 'streetviews-layer', () => popup.remove());
}

function ensureMapReady() {
  if (map.getSource('trees') || map.getSource('streetviews')) {
    return;
  }

  addSourcesAndLayers();
  attachInteractions();
}

async function init() {
  const [treeGeoJson, streetViewGeoJson] = await Promise.all([
    fetch(treeGeoJsonUrl).then((response) => {
      if (!response.ok) {
        throw new Error(`Tree GeoJSON request failed with ${response.status}`);
      }
      return response.json();
    }),
    fetch(streetViewGeoJsonUrl).then((response) => {
      if (!response.ok) {
        throw new Error(`Street-view GeoJSON request failed with ${response.status}`);
      }
      return response.json();
    }),
  ]);

  state.treeFeatures = treeGeoJson.features || [];
  state.streetViewFeatures = streetViewGeoJson.features || [];

  treeCount.textContent = state.treeFeatures.length.toLocaleString();
  streetViewCount.textContent = state.streetViewFeatures.length.toLocaleString();

  fitToData([...state.treeFeatures, ...state.streetViewFeatures]);

  if (map.isStyleLoaded()) {
    ensureMapReady();
  } else {
    map.once('load', ensureMapReady);
  }
}

toggleTrees.addEventListener('change', (event) => {
  state.treesVisible = event.target.checked;
  updateLayerVisibility();
});

toggleStreetViews.addEventListener('change', (event) => {
  state.streetViewsVisible = event.target.checked;
  updateLayerVisibility();
});

basemapButtons.forEach((button) => {
  button.addEventListener('click', () => setBasemap(button.dataset.basemap));
});

init().catch((error) => {
  selectionContent.className = 'empty-state';
  selectionContent.textContent = `Failed to load static data: ${
    error instanceof Error ? error.message : String(error)
  }`;
});
