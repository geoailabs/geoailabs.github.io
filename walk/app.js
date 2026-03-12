const milestones = [
  { version: 0, capture: "Safe and frequent crossings" },
  { version: 1, capture: "Footpaths and tree cover" },
  { version: 2, capture: "Lighting and nearby destinations" },
  { version: 3, capture: "Space to walk and active street edges" },
  { version: 4, capture: "Comfort, cleanliness, and places to pause" }
];

const INITIAL_CITY = "amd";
const GOOGLE_SATELLITE_TILES = "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}";
const PLAIN_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const citySelect = document.getElementById("city-select");
const crossingsToggle = document.getElementById("crossings-toggle");
const treesToggle = document.getElementById("trees-toggle");
const crossingsMetric = document.getElementById("crossings-metric");
const crossingCount = document.getElementById("crossing-count");
const treeCount = document.getElementById("tree-count");
const mapTitle = document.getElementById("map-title");
const layerNote = document.getElementById("layer-note");
const milestonesContainer = document.getElementById("milestones");
const basemapSelect = document.getElementById("basemap-select");

let manifest;
let currentCity = INITIAL_CITY;
let currentBasemap = "google";
let currentViewState = {
  longitude: 77.2,
  latitude: 28.6,
  zoom: 10,
  minZoom: 3,
  maxZoom: 18,
  pitch: 0,
  bearing: 0
};
const deckInstance = new deck.Deck({
  parent: document.getElementById("map"),
  viewState: currentViewState,
  controller: true,
  onViewStateChange: ({ viewState }) => {
    currentViewState = viewState;
    deckInstance.setProps({ viewState });
  },
  getTooltip: ({ object, layer }) => {
    if (!object || !layer) {
      return null;
    }

    if (layer.id === "crossings") {
      return { text: "Crossing point" };
    }

    if (layer.id.startsWith("trees")) {
      return { text: "Tree cover polygon" };
    }

    return null;
  }
});

function renderMilestones() {
  milestonesContainer.innerHTML = "";
  milestones.forEach((item) => {
    const card = document.createElement("article");
    card.className = "milestone-card";
    card.innerHTML = `
      <p class="milestone-version">Index v${item.version}</p>
      <p class="milestone-copy">${item.capture}</p>
    `;
    milestonesContainer.appendChild(card);
  });
}

function boundsToViewState(bounds) {
  const [minLng, minLat, maxLng, maxLat] = bounds;
  const longitude = (minLng + maxLng) / 2;
  const latitude = (minLat + maxLat) / 2;
  const lngSpan = Math.max(maxLng - minLng, 0.01);
  const latSpan = Math.max(maxLat - minLat, 0.01);
  const span = Math.max(lngSpan, latSpan);

  let zoom = 11;
  if (span > 0.5) zoom = 9;
  if (span > 1) zoom = 8;
  if (span > 2) zoom = 7;

  return {
    ...currentViewState,
    longitude,
    latitude,
    zoom,
    transitionDuration: 600
  };
}

function buildLayers(cityConfig) {
  const layers = [
    new deck.TileLayer({
      id: "basemap",
      data: currentBasemap === "google" ? GOOGLE_SATELLITE_TILES : PLAIN_TILES,
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      renderSubLayers: (props) => {
        const {
          bbox: { west, south, east, north }
        } = props.tile;

        return new deck.BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [west, south, east, north]
        });
      }
    })
  ];

  if (crossingsToggle.checked) {
    layers.push(
      new deck.GeoJsonLayer({
        id: "crossings",
        data: cityConfig.crossings.path,
        pointType: "circle",
        filled: true,
        stroked: false,
        pickable: true,
        getPointRadius: 18,
        pointRadiusMinPixels: 3,
        pointRadiusMaxPixels: 8,
        getFillColor: [240, 95, 64, 190]
      })
    );
  }

  if (treesToggle.checked && cityConfig.trees) {
    layers.push(
      new deck.GeoJsonLayer({
        id: "trees",
        data: cityConfig.trees.path,
        filled: true,
        stroked: false,
        pickable: true,
        opacity: 0.45,
        getFillColor: [68, 140, 106, 180]
      })
    );
  }

  return layers;
}

function updatePanel(cityKey) {
  const cityConfig = manifest.cities[cityKey];
  mapTitle.textContent = `${cityConfig.label} overview`;
  crossingsMetric.textContent = cityConfig.crossingsPerKm.toFixed(3);
  crossingCount.textContent = cityConfig.crossings.featureCount.toLocaleString();
  treeCount.textContent = cityConfig.trees ? cityConfig.trees.featureCount.toLocaleString() : "Not available";

  if (cityConfig.trees) {
    layerNote.textContent = "Tree cover is currently available for Mohali and Bangalore.";
  } else {
    layerNote.textContent = `Tree cover is not available yet for ${cityConfig.label}.`;
  }
}

function renderCity(cityKey) {
  currentCity = cityKey;
  const cityConfig = manifest.cities[cityKey];
  const focusBounds = cityConfig.trees?.bounds ?? cityConfig.crossings.bounds;
  const viewState = boundsToViewState(focusBounds);
  currentViewState = viewState;
  deckInstance.setProps({
    viewState,
    layers: buildLayers(cityConfig)
  });
  updatePanel(cityKey);
}

function populateCitySelect() {
  const entries = Object.entries(manifest.cities);
  entries.forEach(([cityKey, cityConfig]) => {
    const option = document.createElement("option");
    option.value = cityKey;
    option.textContent = cityConfig.label;
    citySelect.appendChild(option);
  });
  citySelect.value = currentCity;
}

function bindEvents() {
  citySelect.addEventListener("change", (event) => {
    renderCity(event.target.value);
  });

  crossingsToggle.addEventListener("change", () => {
    renderCity(currentCity);
  });

  treesToggle.addEventListener("change", () => {
    renderCity(currentCity);
  });

  basemapSelect.addEventListener("change", (event) => {
    currentBasemap = event.target.value;
    renderCity(currentCity);
  });
}

async function init() {
  renderMilestones();
  const response = await fetch("./data/manifest.json");
  manifest = await response.json();
  basemapSelect.value = currentBasemap;
  populateCitySelect();
  bindEvents();
  renderCity(currentCity);
}

init().catch((error) => {
  console.error(error);
  layerNote.textContent = "The app could not load its data. Serve this folder with a local web server instead of opening index.html directly.";
});
