import * as GEOLIB from "/geolib.js";
import * as CROSS_SECTION from "/cross-section.js";

// VARIABILI GLOBALI PER L'APPLICAZIONE
const app = {
  initialTime: Date.now(),
  finalTime: null,
  deltaTime: () => app.finalTime - app.initialTime,
  angularSpeed: Math.PI / 4, // rad/s
  dimensionsToRender: 4,
  MIN_DIMENSIONS: 2,
  MAX_DIMENSIONS: 6,
  angle: 0,
  isRendering: false,
  guiHandlers: {},
  animationId: {},
  meshToRender: null,
  isCrossSectionMode: false,
  renderScale: GEOLIB.DEFAULT_RENDER_SCALE,
  isOrtho: false,
  axesEnabled: false,
  fixedAxes: true,
  lastCoordinateEnabled: false,
  pause: false
};

async function fetchWiki() {
  try {
    const response = await fetch("./wiki.json");
    const wiki = await response.json();
    return wiki;
  } catch (error) {
    throw new Error("Errore durante il fetch della wiki:", error);
  }
}

const WIKI = await fetchWiki();

function zoomIn(threshold) {
  app.renderScale += threshold;
}

function zoomOut(threshold) {
  app.renderScale -= threshold;
}

const THRESHOLD = 50;

function addWindowEvents() {
  window.addEventListener("resize", () => {
    GEOLIB.resizeCanvas();
    const h1 = document.querySelector("h1");
    h1.style.textAlign = "center";
    tic();
  });

  window.addEventListener("wheel", (event) => {
    if (event.deltaY < 0) {
      zoomIn(THRESHOLD);
    } else {
      zoomOut(THRESHOLD);
    }
  });
}

/*
*
* ZOOM IN/OUT BUTTON
*
*/

function setZoomInBtn(){
  const zoomInBtn = document.querySelector(".zoom-in-btn");
  zoomInBtn.addEventListener("click", ()=>{
    zoomIn(THRESHOLD);
  });
}

function setZoomOutBtn(){
  const zoomOutBtn = document.querySelector(".zoom-out-btn");
  zoomOutBtn.addEventListener("click", ()=>{
    zoomOut(THRESHOLD);
  });
}

// PROJECTION MODE
function setProjectionButton({ button, icon }) {
  button.addEventListener("click", () => {
    app.isOrtho = !app.isOrtho;
    icon.src = `./icons/${app.isOrtho ? "perspective" : "ortho"}.png`;
  });
}

function setProjectionMode() {
  const projection = {
    button: document.querySelector(".button.projection-mode"),
    icon: document.querySelector(".button.projection-mode .icon"),
  };
  setProjectionButton(projection);
  app.guiHandlers.projection = projection;
}

function isDropmenuOpen(dropmenu) {
  return dropmenu.classList.contains("open");
}

function isValidDisplay(display) {
  const temp = document.createElement("div");
  temp.style.display = display;
  return temp.style.display === display;
}

function toggleDropmenuDisplay(dropmenu, displayWhenOpen) {
  if (!isValidDisplay(displayWhenOpen)) {
    throw new Error("Invalid display entered: " + displayWhenOpen);
  }
  if (displayWhenOpen === "none") {
    throw new Error("Cannot enter 'none'.");
  }
  dropmenu.style.display = displayWhenOpen;
  setTimeout(() => {
    dropmenu.classList.toggle("open");
  }, 10);
  dropmenu.addEventListener("transitionend", () => {
    if (!isDropmenuOpen(dropmenu)) {
      dropmenu.style.display = "none";
    }
  }, {once: true});
}

// MESH SELECTOR
function setMeshSelectorButton({ button, dropmenu }) {
  button.addEventListener("click", () => {
    toggleDropmenuDisplay(dropmenu, "flex");
  });
}

function setMeshSelectorDropmenu({ dropmenu, meshButtons }) {
  const meshesMap = new Map();
  meshesMap.set("Hypercube", GEOLIB.Hypercube);
  meshesMap.set("Simplex", GEOLIB.Simplex);
  meshesMap.set("Hypersphere", GEOLIB.Hypersphere);
  meshesMap.set("Torus", GEOLIB.Torus);
  meshesMap.set("Orthoplex", GEOLIB.Orthoplex);
  meshesMap.set("And so on...", null);

  meshesMap.keys().forEach((key) => {
    const mesh = document.createElement("li");
    mesh.classList.add("button", "mesh");
    mesh.innerHTML = key;
    dropmenu.appendChild(mesh);
  });

  meshButtons = document.querySelectorAll(".button.mesh");
  meshButtons.forEach((button) => {
    button.addEventListener("click", () => {
      app.meshToRender = button.innerHTML;
      if (app.meshToRender !== "And so on...") {
        cancelAnimationFrame(app.animationId);
        uploadWikipage();
        GEOLIB.disableColorLegend();
        tic(app.meshToRender);
      } else {
        alert("Wait for new meshes!");
      }
    });
  });
}

function setMeshSelector() {
  const meshSelector = {
    button: document.querySelector(".meshes-handler .button"),
    dropmenu: document.querySelector(".meshes-handler .dropmenu"),
    meshButtons: null,
  };
  setMeshSelectorDropmenu(meshSelector);
  setMeshSelectorButton(meshSelector);
  app.guiHandlers.meshSelector = meshSelector;
}

function selectMesh(input, dimensions) {
  switch (input) {
    case "Hypercube":
      return new GEOLIB.Hypercube(dimensions);
    case "Simplex":
      return new GEOLIB.Simplex(dimensions);
    case "Hypersphere":
      return new GEOLIB.Hypersphere(dimensions);
    case "Torus":
      return new GEOLIB.Torus(dimensions);
    case "Orthoplex":
      return new GEOLIB.Orthoplex(dimensions);
      default:
        throw new Error("Invalid input entered: " + '"' + input + '"');
  }
}

// DIMENSIONS HANDLER
function ValidDimensions(dimensions) {
  return dimensions >= app.MIN_DIMENSIONS && dimensions <= app.MAX_DIMENSIONS;
}

function setDimensionsButton({button, input}) {
  button.addEventListener("click", () => {
    input = prompt(`Enter the number of dimensions of the shape you want to see (${app.MIN_DIMENSIONS}-${app.MAX_DIMENSIONS}):`) * 1;
    GEOLIB.disableColorLegend();
    if (!ValidDimensions(input)) {
      alert(`Invalid number of dimensions: ${input}`);
    } else {
      app.dimensionsToRender = input;
      setRotationHandler();
    }

    if (app.isRendering) {
      const h1 = document.querySelector("h1");
      h1.innerHTML = `A ${app.dimensionsToRender}-${input} rotating in ${app.dimensionsToRender}`;
    }
  });
}

function setDimensionsHandler() {
  const dimensions = {
    button: document.querySelector(".button.dimensions-handler"),
    input: null,
  };
  setDimensionsButton(dimensions);
  app.guiHandlers.dimension = dimensions;
}

// ROTATION HANDLER
function setPlanes({planes, angularSpeedFactors, options, dropmenu}) {
  const planesMap = new Map();
  for (let i = 0; i < planes.length; i++) {
    planesMap.set(planes[i], angularSpeedFactors[i]);
  }
  options = document.createElement("ul");
  options.classList.add("rotation-handler-options", "button");
  dropmenu.innerHTML = "";

  planesMap.forEach((value, key) => {
    const rotationPlane = document.createElement("li");
    rotationPlane.classList.add("button", "rotation-plane", key);
    rotationPlane.innerHTML = key.toUpperCase() + " | " + value;
    dropmenu.appendChild(rotationPlane);
  });
}

function setPlaneButtons({planes, angularSpeedFactors, planeButtons}) {
  planeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.innerHTML.toLowerCase();
      let rotationPlane = input.slice(0, 2);
      let angularSpeedFactor = prompt(`Enter the angular speed factor for the plane ${rotationPlane}:`) * 1;
      let index = planes.indexOf(rotationPlane);
      angularSpeedFactors[index] = angularSpeedFactor;
      button.innerHTML = rotationPlane.toUpperCase() + " | " + angularSpeedFactor;
      app.initialTime = Date.now();
      tic(app.meshToRender);
    });
  });
}

function setPlanesDropmenu(handler) {
  setPlanes(handler);
  handler.planeButtons = document.querySelectorAll(".button.rotation-plane");
  setPlaneButtons(handler);
}

function allPossiblePlanes(dimensions) {
  const coords = GEOLIB.axisIdentifiers.slice(0, dimensions).split("");
  const planes = [];
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) planes.push(coords[i] + coords[j]);
  }
  return planes.sort(sortPlanes(coords));
}

function sortPlanes(coords) {
  return function (a, b) {
    const dimA1 = Math.max(coords.indexOf(a[0]), coords.indexOf(a[1]));
    const dimB1 = Math.max(coords.indexOf(b[0]), coords.indexOf(b[1]));
    if (dimA1 !== dimB1) return dimA1 - dimB1;
    const dimA2 = Math.min(coords.indexOf(a[0]), coords.indexOf(a[1]));
    const dimB2 = Math.min(coords.indexOf(b[0]), coords.indexOf(b[1]));
    return dimA2 - dimB2;
  };
}

function nCr(n, r) {
  if (r === 0 || r === n) return 1;
  return nCr(n - 1, r - 1) + nCr(n - 1, r);
}

function setRotationButton({button, dropmenu}) {
  button.onclick = () => {
    GEOLIB.disableColorLegend();
    toggleDropmenuDisplay(dropmenu, "flex");
  };
}

function setRotationHandler() {
  const rotation = {
    button: document.querySelector(".button.rotation-handler"),
    dropmenu: document.querySelector(".rotation-handler + .dropmenu"),
    planes: allPossiblePlanes(app.dimensionsToRender),
    angularSpeedFactors: Array(nCr(app.dimensionsToRender, 2)).fill(0),
    planeButtons: null,
    options: null,
  };
  setPlanesDropmenu(rotation);
  setRotationButton(rotation);
  app.guiHandlers.rotation = rotation;
}

// WIKI HANDLER
function getMeshWikiData(technicalName) {
  const target = WIKI.find((mesh) => mesh["technicalName"] === technicalName);
  if (target === undefined) throw new Error(`Cannot find the technical name "${technicalName}" in the wiki.`);
  return target;
}

function writeMeshWikipage(technicalName, container) {
  const target = getMeshWikiData(technicalName);
  const title = document.createElement("h3");
  const dimensions = document.createElement("p");
  const description = document.createElement("p");
  title.innerHTML = target["commonName"];
  dimensions.innerHTML = "Dimensions: " + target["dimensions"];
  description.innerHTML = target["description"];
  const elements = [title, dimensions, description];
  elements.forEach((element) => {
    container.appendChild(element);
  });
}

function writeDefaultWikipage(container) {
  const title = document.createElement("h3");
  const p = document.createElement("p");
  title.innerHTML = "Welcome to the Wiki!";
  p.innerHTML = "Select a mesh to see its documentation!";
  const elements = [title, p];
  elements.forEach((element) => {
    container.appendChild(element);
  });
}

function uploadWikipage() {
  try {
    app.guiHandlers.wiki.wikipage.replaceChildren();
    writeMeshWikipage(app.dimensionsToRender + "-" + app.meshToRender, app.guiHandlers.wiki.wikipage);
  } catch {
    writeDefaultWikipage(app.guiHandlers.wiki.wikipage);
  }
}

function setWikiButton({button, wikipage}) {
  button.addEventListener("click", () => {
    toggleDropmenuDisplay(wikipage, "block");
    button.classList.toggle("open");
    uploadWikipage();
  });
}

function setWikiHandler() {
  const wiki = {
    button: document.querySelector(".button.wiki"),
    wikipage: document.querySelector(".wikipage"),
    input: null,
    meshData: null,
  };
  setWikiButton(wiki);
  app.guiHandlers.wiki = wiki;
}

// CROSS SECTION
function setCrossSectionButton({button, icon}) {
  button.addEventListener("click", () => {
    app.isCrossSectionMode = !app.isCrossSectionMode;
    if (app.isCrossSectionMode) {
      button.setAttribute("title", "Disable cross-section mode");
    } else {
      button.setAttribute("title", "Enable cross-section mode");
    }
    icon.src = "./icons/cross_section_view_" + (app.isCrossSectionMode ? "off" : "on") + "_btn.svg";
  });
}

function setCrossSectionMode() {
  const crossSection = {
    button: document.querySelector(".button.cross-section-mode"),
    icon: document.querySelector(".button.cross-section-mode .icon"),
  };
  setCrossSectionButton(crossSection);
  app.guiHandlers.crossSection = crossSection;
}

function setAxesMode() {
  const axesButton = document.querySelector(".axes.button");
  let counter = 0;
  axesButton.addEventListener("click", () => {
    counter++;
    if (counter % 3 === 0) {
      app.axesEnabled = false;
      axesButton.setAttribute("title", "Enable fixed axes");
    } else if (counter % 3 === 1) {
      app.axesEnabled = true;
      app.fixedAxes = true;
      axesButton.setAttribute("title", "Enable rotating axes");
    } else if (counter % 3 === 2) {
      app.fixedAxes = false;
      axesButton.setAttribute("title", "Disable axes");
    }
    console.log(app.axesEnabled, app.fixedAxes);
  });
}

function setLastCoordinateMode() {
  const lastCoordinateButton = document.querySelector(".button.last-coordinate-mode");
  lastCoordinateButton.addEventListener("click", () => {
    if (app.dimensionsToRender < GEOLIB.COLOR_MAPPING_DIMENSION)
      alert("Cannot enable 'Last Coordinate Mode' without color mapping. Try to select at least " + GEOLIB.COLOR_MAPPING_DIMENSION + " dimensions.");
    else {
      app.lastCoordinateEnabled = !app.lastCoordinateEnabled;
      lastCoordinateButton.setAttribute("title", (app.lastCoordinateEnabled ? "Disable" : "Enable") + " last-coordinate mode");
    }
  });
}

/*
* ============
* PAUSE BUTTON
* ============
*/

function setPauseBtn(){
  const pauseBtn = document.querySelector(".pause-btn");
  
  pauseBtn.addEventListener("click", ()=>{
    app.pause = !app.pause;
    let pauseBtnIcon = pauseBtn.querySelector("img");

    if(!app.pause){
      pauseBtnIcon.src = "icons/pause.svg";
      pauseBtn.title = "Pause animation";
      app.initialTime = Date.now();
      tic(app.meshToRender);
    } else {
      pauseBtnIcon.src = "icons/resume.svg";
      pauseBtn.title = "Resume animation";
    }
  });
}

// RENDER AND TIC
function humanizeMeshName(technicalName) {
  try {
    const target = getMeshWikiData(technicalName);
    return target["commonName"];
  } catch (error) {
    console.warn("An error is found, it will be returned the original name.", error);
    return technicalName;
  }
}

function renderCrossSection(mesh, dataDiv) {
  const zeros = Array(app.dimensionsToRender - 1).fill(0);
  const hyperplane = new CROSS_SECTION.Hyperplane([...zeros, 1]);
  const crossSection = hyperplane.crossSectionOfMesh(mesh, app.dimensionsToRender);
  
  crossSection.render(app.dimensionsToRender - 1, app.isOrtho, app.renderScale, 5, app.lastCoordinateEnabled);
  
  const hyperplaneString = hyperplane.toString();
  
  if (dataDiv.classList.contains("hidden")) dataDiv.classList.remove("hidden");
  dataDiv.innerHTML = "";
  const p = document.createElement("p");
  switch (app.dimensionsToRender) {
    case 2:
      p.innerHTML = "Line";
      break;
      case 3:
        p.innerHTML = "Plane";
      break;
    default:
      p.innerHTML = "Hyperplane";
    }
  p.innerHTML += ": " + hyperplaneString;
  dataDiv.appendChild(p);
}

function smoothGoniometricTransition(angularSpeed, maxY = 1) {
  const phase = app.angle - 2 * Math.PI;
  const eased = 0.5 * (1 - Math.cos(angularSpeed * phase));
  return Math.min(Math.pow(eased, 3), maxY);
}

function renderEnvironment(input) {
  const mesh = selectMesh(input, app.dimensionsToRender);
  const rotationScope = GEOLIB.rotationScope(app.guiHandlers.rotation.planes, app.guiHandlers.rotation.angularSpeedFactors);
  const rotatingAxes = new GEOLIB.CartesianAxes(app.dimensionsToRender);
  if (mesh.nthDimension() < rotationScope) mesh.extendIn(rotationScope);
  GEOLIB.uploadEnvironment();
  // Creo la matrice di rotazione
  let r = GEOLIB.SingletonMatrix.init(app.dimensionsToRender);
  if (app.guiHandlers.rotation.planes.length !== app.guiHandlers.rotation.angularSpeedFactors.length)
    throw new Error(
      `Num of planes and angles must be equal:\nRotation planes: ${app.guiHandlers.rotation.planes} (${app.guiHandlers.rotation.planes.length})\nAngles: ${app.guiHandlers.rotation.angularSpeedFactors} (${app.guiHandlers.rotation.angularSpeedFactors.length})`
    );
  // Calcolo gli angoli di rotazione nell'istante attuale
  let angles = app.guiHandlers.rotation.angularSpeedFactors.map((factor) => (factor * app.angle) % (2 * Math.PI));
  // Aggiorno il titolo
  const h1 = document.querySelector("h1");
  const humanizedInput = humanizeMeshName(`${app.dimensionsToRender}-${input}`);
  if (rotationScope > 1) h1.innerHTML = `A ${humanizedInput} is rotating in ${rotationScope}D`;
  else h1.innerHTML = `A ${humanizedInput} is static`;
  const title = document.querySelector("title");
  title.innerHTML = "HDchamber | " + h1.innerHTML;
  // Applico la rotazione
  for (let i = 0; i < app.guiHandlers.rotation.planes.length; i++) {
    r.set("r", [app.guiHandlers.rotation.planes[i], angles[i]]);
    r.extendIn(rotationScope);
    mesh.transform(r.value);
    rotatingAxes.transform(r.value);
  }
  // Distruggo la matrice di rotazione. E' importante farlo per evitare memory leaks
  r.destroy();
  // Disegno la mesh
  const dataDiv = document.querySelector(".technical-data");
  if (app.isCrossSectionMode) {
    renderCrossSection(mesh, dataDiv);
    const opacity = smoothGoniometricTransition(0.25, 0.5);
    mesh.render(rotationScope, app.isOrtho, app.renderScale, opacity, false);
  } else {
    dataDiv.innerHTML = "";
    if (!dataDiv.classList.contains("hidden")) dataDiv.classList.add("hidden");
    mesh.render(rotationScope, app.isOrtho, app.renderScale, undefined, app.lastCoordinateEnabled);
  }
  // Rendering assi
  if (app.axesEnabled && app.fixedAxes) {
    const fixedAxes = new GEOLIB.CartesianAxes(app.dimensionsToRender);
    fixedAxes.render(rotationScope, app.isOrtho, app.renderScale);
  } else if (!app.fixedAxes && app.axesEnabled) {
    rotatingAxes.render(rotationScope, app.isOrtho, app.renderScale);
  }

  return rotationScope;
}

function tic(input) {
  if (app.pause)
    return;

  app.isRendering = true;
  app.finalTime = Date.now();
  app.angle += (app.angularSpeed * app.deltaTime()) / 1000;
  app.initialTime = app.finalTime;
  let rotationScope = renderEnvironment(input);
  if(rotationScope === 0)
    return;
  app.animationId = requestAnimationFrame(() => tic(input));
}

function addGuiHandlers() {
  setProjectionMode();
  setMeshSelector();
  setDimensionsHandler();
  setRotationHandler();
  setWikiHandler();
  setCrossSectionMode();
  setAxesMode();
  setLastCoordinateMode();
  setPauseBtn();
  setZoomInBtn();
  setZoomOutBtn();
}

addWindowEvents();
addGuiHandlers();