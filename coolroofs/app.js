const {Deck, GeoJsonLayer, TileLayer, BitmapLayer} = globalThis.deck;

const INITIAL_VIEW_STATE = {
  longitude: 78.4746551513672,
  latitude: 17.40568382996758,
  zoom: 11,
  minZoom: 9,
  maxZoom: 19,
  pitch: 0,
  bearing: 0,
};

const DATA_PATHS = {
  manifest: "./data/buildings/manifest.json",
  pincodes: "./data/hyderabad-pincodes.geojson",
  infosys: "./data/infosys-buildings.geojson",
};

const state = {
  showPincodes: true,
  showInfosys: true,
  showBuildings: false,
  pincodes: null,
  infosys: null,
  buildingManifest: null,
  buildingChunks: [],
  buildingLoadStarted: false,
};

const statusText = document.getElementById("status-text");
const buildingProgress = document.getElementById("building-progress");
const togglePincodes = document.getElementById("toggle-pincodes");
const toggleInfosys = document.getElementById("toggle-infosys");
const toggleBuildings = document.getElementById("toggle-buildings");

const deckgl = new Deck({
  parent: document.getElementById("deck-map"),
  initialViewState: INITIAL_VIEW_STATE,
  controller: true,
  getTooltip,
  layers: [],
});

togglePincodes.addEventListener("change", (event) => {
  state.showPincodes = event.target.checked;
  render();
});

toggleInfosys.addEventListener("change", (event) => {
  state.showInfosys = event.target.checked;
  render();
});

toggleBuildings.addEventListener("change", async (event) => {
  state.showBuildings = event.target.checked;
  if (state.showBuildings) {
    await ensureBuildingsLoaded();
  }
  render();
});

bootstrap().catch((error) => {
  console.error(error);
  statusText.textContent = "The static site failed to load one or more datasets.";
  buildingProgress.textContent = String(error);
});

async function bootstrap() {
  const [pincodes, infosys, manifest] = await Promise.all([
    loadJson(DATA_PATHS.pincodes),
    loadJson(DATA_PATHS.infosys),
    loadJson(DATA_PATHS.manifest),
  ]);

  state.pincodes = pincodes;
  state.infosys = infosys;
  state.buildingManifest = manifest;

  statusText.textContent =
    "Pin codes and Infosys footprints are ready. Turn on the full building layer whenever you want.";
  buildingProgress.textContent = `Full building layer contains ${manifest.total_features.toLocaleString()} polygons across ${manifest.parts.length} chunks.`;

  render();
}

async function ensureBuildingsLoaded() {
  if (state.buildingLoadStarted) {
    return;
  }

  state.buildingLoadStarted = true;
  state.buildingChunks = [];
  buildingProgress.textContent = "Starting progressive building load...";
  render();

  let loadedFeatures = 0;

  for (const [index, part] of state.buildingManifest.parts.entries()) {
    const featureCollection = await loadJson(`./data/buildings/${part.file}`);
    state.buildingChunks.push(featureCollection);
    loadedFeatures += part.features;
    buildingProgress.textContent =
      `Loaded chunk ${index + 1} of ${state.buildingManifest.parts.length} ` +
      `(${loadedFeatures.toLocaleString()} / ${state.buildingManifest.total_features.toLocaleString()} buildings).`;
    render();
  }

  buildingProgress.textContent =
    `Loaded all ${state.buildingManifest.total_features.toLocaleString()} buildings.`;
}

function render() {
  const layers = [
    createBasemapLayer(),
    state.showPincodes && state.pincodes ? createPincodeLayer(state.pincodes) : null,
    state.showInfosys && state.infosys ? createInfosysLayer(state.infosys) : null,
    ...(
      state.showBuildings
        ? state.buildingChunks.map((chunk, index) => createBuildingsLayer(chunk, index))
        : []
    ),
  ].filter(Boolean);

  deckgl.setProps({layers});
}

function createBasemapLayer() {
  return new TileLayer({
    id: "osm-basemap",
    data: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    renderSubLayers: (props) => {
      const {
        boundingBox: [[west, south], [east, north]],
      } = props.tile;

      return new BitmapLayer(props, {
        data: null,
        image: props.data,
        bounds: [west, south, east, north],
      });
    },
  });
}

function createPincodeLayer(data) {
  return new GeoJsonLayer({
    id: "pincodes",
    data,
    pickable: true,
    stroked: true,
    filled: true,
    lineWidthMinPixels: 1.2,
    getLineColor: [104, 72, 48, 180],
    getFillColor: (feature) => {
      const value = Number(feature.properties.cool || 0);
      return interpolateColor(value, 0, 2250, [246, 232, 195, 130], [184, 92, 56, 185]);
    },
  });
}

function createInfosysLayer(data) {
  return new GeoJsonLayer({
    id: "infosys-buildings",
    data,
    pickable: true,
    stroked: true,
    filled: true,
    lineWidthMinPixels: 1,
    getLineColor: [46, 35, 22, 180],
    getFillColor: (feature) =>
      feature.properties.cool === 1
        ? [11, 143, 97, 220]
        : [209, 73, 91, 220],
  });
}

function createBuildingsLayer(data, index) {
  return new GeoJsonLayer({
    id: `hyderabad-buildings-${index}`,
    data,
    pickable: true,
    stroked: false,
    filled: true,
    opacity: 0.48,
    getFillColor: (feature) =>
      feature.properties.cool === 1
        ? [11, 143, 97, 185]
        : [209, 73, 91, 120],
    updateTriggers: {
      getFillColor: index,
    },
  });
}

function interpolateColor(value, min, max, startColor, endColor) {
  const safeValue = Number.isFinite(value) ? value : min;
  const t = Math.max(0, Math.min(1, (safeValue - min) / (max - min)));
  return startColor.map((channel, idx) =>
    Math.round(channel + (endColor[idx] - channel) * t)
  );
}

function getTooltip({object, layer}) {
  if (!object || !layer) {
    return null;
  }

  if (layer.id === "pincodes") {
    return {
      text:
        `Pin code: ${object.properties.pin_code}\n` +
        `Cool roofs: ${Number(object.properties.cool || 0).toLocaleString()}`,
    };
  }

  if (layer.id === "infosys-buildings" || layer.id.startsWith("hyderabad-buildings-")) {
    return {
      text:
        `Cool roof: ${object.properties.cool === 1 ? "Yes" : "No"}\n` +
        (object.properties.area_in_me
          ? `Area: ${Number(object.properties.area_in_me).toFixed(1)} sq m`
          : "Building footprint"),
    };
  }

  return null;
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}
