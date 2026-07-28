import * as GEOLIB from "./geolib_old.js";
import * as CROSS_SECTION from "./cross-section.js";
import { RENDER_FUNCS } from "./render.js";

// VARIABILI GLOBALI PER L'APPLICAZIONE
const MIN_DIMENSION = 2;
const MAX_DIMENSION = 6;

const APP = {
  initialTime: null,
  finalTime: null,
  deltaTime: () => APP.finalTime - APP.initialTime,
  k: Math.PI / 4, // rad/s
  dimensions: 3,
  MIN_DIMENSIONS: 2,
  MAX_DIMENSIONS: 6,
  theta: [],
  omega: [],
  planes: [],
  isRendering: false,
  guiHandlers: {},
  animationId: {},
  selectedObj: null,
  isCrossSectionMode: false,
  renderScale: GEOLIB.DEFAULT_RENDER_SCALE,
  isOrtho: false,
  axesEnabled: false,
  fixedAxes: true,
  lastCoordinateEnabled: false
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
  APP.renderScale += threshold;
  renderEnvironment(APP.selectedObj);
}

function zoomOut(threshold) {
  APP.renderScale -= threshold;
  renderEnvironment(APP.selectedObj);
}

const THRESHOLD = 50;

function addWindowEvents() {
  window.addEventListener("resize", () => {
    GEOLIB.resizeCanvas();
    const h1 = document.querySelector("h1");
    h1.style.textAlign = "center";
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
    APP.isOrtho = !APP.isOrtho;
    icon.style.setProperty('--icon-url', `url('/icons/${APP.isOrtho ? "perspective" : "ortho"}.png')`);
    RENDER_FUNCS.updateTHREE(APP);
  });
}

function setProjectionMode() {
  const projection = {
    button: document.querySelector(".button.projection-mode"),
    icon: document.querySelector(".button.projection-mode .icon"),
  };
  setProjectionButton(projection);
  APP.guiHandlers.projection = projection;
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
  meshesMap.set("Orthoplex", GEOLIB.Orthoplex);
  meshesMap.set("Hypersphere", GEOLIB.Hypersphere);
  meshesMap.set("LowHypersphere", GEOLIB.LowHypersphere);
  meshesMap.set("Torus", GEOLIB.Torus);
  meshesMap.set("LowHypertorus", GEOLIB.LowHypertorus);
  meshesMap.set("LowHyperspherinder", GEOLIB.LowHyperspherinder);
  meshesMap.set("LowHypercone", GEOLIB.LowHypercone);
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
      APP.selectedObj = button.innerHTML;
      if (APP.selectedObj !== "And so on...") {
        cancelAnimationFrame(APP.animationId);
        uploadWikipage();
        GEOLIB.disableColorLegend();
        RENDER_FUNCS.updateTHREE(APP);
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
  APP.guiHandlers.meshSelector = meshSelector;
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
  return dimensions >= APP.MIN_DIMENSIONS && dimensions <= APP.MAX_DIMENSIONS;
}

function setDimensionsButton({button, input}) {
  button.addEventListener("click", () => {
    input = prompt(`Enter the number of dimensions of the shape you want to see (${APP.MIN_DIMENSIONS}-${APP.MAX_DIMENSIONS}):`) * 1;
    GEOLIB.disableColorLegend();
    if (!ValidDimensions(input)) {
      alert(`Invalid number of dimensions: ${input}`);
    } else {
      APP.dimensions = input;
      APP.lastCoordinateEnabled = false;
      setRotationHandler();
    }

    const h1 = document.querySelector("h1");
    h1.innerHTML = `A ${APP.dimensions}-${input} rotating in ${APP.dimensions}`;
    RENDER_FUNCS.updateTHREE(APP);
  });
}

function setDimensionsHandler() {
  const dimensions = {
    button: document.querySelector(".button.dimensions-handler"),
    input: null,
  };
  setDimensionsButton(dimensions);
  APP.guiHandlers.dimension = dimensions;
}

// ROTATION HANDLER
function setPlanes({planes, angularSpeedFactors, options, dropmenu}) {
  const planesMap = new Map();
  for (let i = 0; i < planes.length; i++) {
    planesMap.set(planes[i], angularSpeedFactors[i]);
  }
  options = document.createElement("ul");
  options.classList.add("rotation-handler-options", "button");
  const planesUl = dropmenu.querySelector("ul.planes");
  planesUl.innerHTML = "";

  planesMap.forEach((value, key) => {
    const rotationPlane = document.createElement("li");
    rotationPlane.classList.add("button", "rotation-plane", key);
    rotationPlane.innerHTML = key.toUpperCase() + " | " + value;
    planesUl.appendChild(rotationPlane);
  });
}

const MAX_SPEED = 4;
const MIN_SPEED = -MAX_SPEED;

function setPlaneButtons({planes, angularSpeedFactors, planeButtons}) {
  planeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.innerHTML.toLowerCase();
      let rotationPlane = input.slice(0, 2);
      let angularSpeedFactor = prompt(`Enter the angular speed factor for the plane ${rotationPlane}:`) * 1;
      angularSpeedFactor = Math.min(angularSpeedFactor, MAX_SPEED);
      angularSpeedFactor = Math.max(angularSpeedFactor, MIN_SPEED);
      angularSpeedFactor *= APP.k;
      let index = planes.indexOf(rotationPlane);
      angularSpeedFactors[index] = angularSpeedFactor;
      button.innerHTML = rotationPlane.toUpperCase() + " | " + angularSpeedFactor / APP.k;
      APP.initialTime = Date.now();
      APP.omega = angularSpeedFactors;
      RENDER_FUNCS.updateTHREE(APP);
    });
  });
}

function setRandomRotationBtn(handler){
  const randomBtn = handler.dropmenu.querySelector(".tools .random-btn");

  randomBtn.addEventListener("click", ()=>{
    handler.planeButtons.forEach((button)=>{
      console.log("Funzione random!")
      const input = button.innerHTML.toLowerCase();
      let rotationPlane = input.slice(0,2);
      let randomSpeed = Math.round(100 * (Math.random() - Math.random()) * MAX_SPEED) / 100;
      let index = handler.planes.indexOf(rotationPlane);
      handler.angularSpeedFactors[index] = randomSpeed;
      button.innerHTML = rotationPlane.toUpperCase() + " | " + randomSpeed;
      APP.initialTime = Date.now();
      APP.omega = handler.angularSpeedFactors;
      console.time('updateTHREE');
      RENDER_FUNCS.updateTHREE(APP);
      console.timeEnd('updateTHREE')
    });
  });
}

const CLEAN_SPEED = 0;

function setClearRotationsBtn(handler){
  const clearBtn = handler.dropmenu.querySelector(".tools .clear-btn");

  clearBtn.addEventListener("click", () => {
    handler.planeButtons.forEach((button) => {
      console.log("Funzione random!")
      const input = button.innerHTML.toLowerCase();
      let rotationPlane = input.slice(0, 2);
      let index = handler.planes.indexOf(rotationPlane);
      handler.angularSpeedFactors[index] = CLEAN_SPEED;
      button.innerHTML = rotationPlane.toUpperCase() + " | " + CLEAN_SPEED;
      APP.initialTime = Date.now();
      APP.omega = handler.angularSpeedFactors;
      RENDER_FUNCS.updateTHREE(APP);
    });
  });
}

function setTools(handler){
  setRandomRotationBtn(handler);
  setClearRotationsBtn(handler);
}

function setPlanesDropmenu(handler) {
  setPlanes(handler);
  setTools(handler);
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

function nRots(n) {
  if( n < 0 ) throw new Error("Invalid n:", n);
  return n * (n-1) / 2;
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
    planes: allPossiblePlanes(APP.dimensions),
    angularSpeedFactors: Array(nRots(APP.dimensions)).fill(0),
    planeButtons: null,
    options: null,
  };
  setPlanesDropmenu(rotation);
  setRotationButton(rotation);
  APP.omega = rotation.angularSpeedFactors;
  APP.planes = rotation.planes;
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
    APP.guiHandlers.wiki.wikipage.replaceChildren();
    writeMeshWikipage(APP.dimensions + "-" + APP.selectedObj, APP.guiHandlers.wiki.wikipage);
  } catch {
    writeDefaultWikipage(APP.guiHandlers.wiki.wikipage);
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
  APP.guiHandlers.wiki = wiki;
}

// CROSS SECTION
function setCrossSectionButton({button, icon}) {
  button.addEventListener("click", () => {
    APP.isCrossSectionMode = !APP.isCrossSectionMode;
    if (APP.isCrossSectionMode) {
      button.setAttribute("title", "Disable cross-section mode");
    } else {
      button.setAttribute("title", "Enable cross-section mode");
    }
    icon.style.setProperty('--icon-url', `url('/icons/cross_section_view_${APP.isCrossSectionMode ? "off" : "on"}_btn.svg')`);
    renderEnvironment(APP.selectedObj);
  });
}

function setCrossSectionMode() {
  const crossSection = {
    button: document.querySelector(".button.cross-section-mode"),
    icon: document.querySelector(".button.cross-section-mode .icon"),
  };
  setCrossSectionButton(crossSection);
  APP.guiHandlers.crossSection = crossSection;
}

const FIXED_AXES_SRC = "/icons/cartesian_axes_view_locked_btn.svg";
const ROTATING_AXES_SRC = "/icons/cartesian_axes_view_on_btn.svg";
const AXES_OFF_SRC = "/icons/cartesian_axes_view_off_btn.svg";

function setAxesMode() {
  const axesButton = document.querySelector(".axes.button");
  const axesIcon = axesButton.querySelector(".icon");
  let counter = 0;

  axesButton.addEventListener("click", () => {
    counter++;
    counter %= 3;
    switch(counter){
      case 0:
        APP.axesEnabled = false;
        axesButton.setAttribute("title", "Enable fixed axes");
        axesIcon.style.setProperty('--icon-url', `url('${FIXED_AXES_SRC}')`);
        break;
      case 1:
        APP.axesEnabled = true;
        APP.fixedAxes = true;
        axesButton.setAttribute("title", "Enable rotating axes");
        axesIcon.style.setProperty('--icon-url', `url('${ROTATING_AXES_SRC}')`);
        break;
      case 2:
        APP.fixedAxes = false;
        axesButton.setAttribute("title", "Disable axes");
        axesIcon.style.setProperty('--icon-url', `url('${AXES_OFF_SRC}')`);
      default:
        console.error("Error in axes elaboration!");
        break;
    }
    renderEnvironment(APP.selectedObj);
  });
}

function setLastCoordinateMode() {
  const lastCoordinateButton = document.querySelector(".button.last-coordinate-mode");

  lastCoordinateButton.addEventListener("click", () => {
    if (APP.dimensions < GEOLIB.COLOR_MAPPING_DIMENSION)
      alert("Cannot enable 'Last Coordinate Mode' without color mapping. Try to select at least " + GEOLIB.COLOR_MAPPING_DIMENSION + " dimensions.");
    else {
      APP.lastCoordinateEnabled = !APP.lastCoordinateEnabled;
      lastCoordinateButton.setAttribute("title", (APP.lastCoordinateEnabled ? "Disable" : "Enable") + " last-coordinate mode");
      renderEnvironment(APP.selectedObj);
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
    APP.isRendering = !APP.isRendering;
    let pauseBtnIcon = pauseBtn.querySelector("img");

    if(!APP.isRendering){
      pauseBtnIcon.style.setProperty('--icon-url', `url('/icons/pause.svg')`);
      pauseBtn.title = "Pause animation";
      APP.initialTime = Date.now();
      //tic(APP.selectedObj);
    } else {
      pauseBtnIcon.style.setProperty('--icon-url', `url('/icons/resume.svg')`);
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
  const zeros = Array(APP.dimensions - 1).fill(0);
  const hyperplane = new CROSS_SECTION.Hyperplane([...zeros, 1]);
  const crossSection = hyperplane.crossSectionOfMesh(mesh, APP.dimensions);
  
  crossSection.render(APP.dimensions - 1, APP.isOrtho, APP.renderScale, 5, APP.lastCoordinateEnabled);
  
  const hyperplaneString = hyperplane.toString();
  
  if (dataDiv.classList.contains("hidden")) dataDiv.classList.remove("hidden");
  dataDiv.innerHTML = "";
  const p = document.createElement("p");
  switch (APP.dimensions) {
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
  const phase = APP.angle - 2 * Math.PI;
  const eased = 0.5 * (1 - Math.cos(angularSpeed * phase));
  return Math.min(Math.pow(eased, 3), maxY);
}

/* function renderEnvironment(input) {
  const mesh = selectMesh(input, APP.dimensions);
  const rotationScope = GEOLIB.rotationScope(APP.guiHandlers.rotation.planes, APP.guiHandlers.rotation.angularSpeedFactors);
  const rotatingAxes = new GEOLIB.CartesianAxes(APP.dimensions);
  if (mesh.nthDimension() < rotationScope) mesh.extendIn(rotationScope);
  GEOLIB.uploadEnvironment();
  // Creo la matrice di rotazione
  let r = GEOLIB.SingletonMatrix.init(APP.dimensions);
  if (APP.guiHandlers.rotation.planes.length !== APP.guiHandlers.rotation.angularSpeedFactors.length)
    throw new Error(
      `Num of planes and angles must be equal:\nRotation planes: ${APP.guiHandlers.rotation.planes} (${APP.guiHandlers.rotation.planes.length})\nAngles: ${APP.guiHandlers.rotation.angularSpeedFactors} (${APP.guiHandlers.rotation.angularSpeedFactors.length})`
    );
  // Calcolo gli angoli di rotazione nell'istante attuale
  let angles = APP.guiHandlers.rotation.angularSpeedFactors.map((factor) => (factor * APP.angle) % (2 * Math.PI));
  // Aggiorno il titolo
  const h1 = document.querySelector("h1");
  const humanizedInput = humanizeMeshName(`${APP.dimensions}-${input}`);
  if (rotationScope > 1) h1.innerHTML = `A ${humanizedInput} is rotating in ${rotationScope}D`;
  else h1.innerHTML = `A ${humanizedInput} is static`;
  const title = document.querySelector("title");
  title.innerHTML = "HDchamber | " + h1.innerHTML;
  // Applico la rotazione
  for (let i = 0; i < APP.guiHandlers.rotation.planes.length; i++) {
    r.set("r", [APP.guiHandlers.rotation.planes[i], angles[i]]);
    r.extendIn(rotationScope);
    mesh.transform(r.value);
    rotatingAxes.transform(r.value);
  }
  // Distruggo la matrice di rotazione. E' importante farlo per evitare memory leaks
  r.destroy();
  // Disegno la mesh
  const dataDiv = document.querySelector(".technical-data");
  if (APP.isCrossSectionMode) {
    renderCrossSection(mesh, dataDiv);
    const opacity = smoothGoniometricTransition(0.25, 0.5);
    mesh.render(rotationScope, APP.isOrtho, APP.renderScale, opacity, false);
  } else {
    dataDiv.innerHTML = "";
    if (!dataDiv.classList.contains("hidden")) dataDiv.classList.add("hidden");
    mesh.render(rotationScope, APP.isOrtho, APP.renderScale, undefined, APP.lastCoordinateEnabled);
  }
  // Rendering assi
  if (APP.axesEnabled && APP.fixedAxes) {
    const fixedAxes = new GEOLIB.CartesianAxes(APP.dimensions);
    fixedAxes.render(rotationScope, APP.isOrtho, APP.renderScale);
  } else if (!APP.fixedAxes && APP.axesEnabled) {
    rotatingAxes.render(rotationScope, APP.isOrtho, APP.renderScale);
  }

  return rotationScope;
}

function tic(input) {
  if (APP.isRendering)
    return;

  APP.isRendering = true;
  APP.finalTime = Date.now();
  APP.angle += (APP.angularSpeed * APP.deltaTime()) / 1000;
  APP.initialTime = APP.finalTime;
  let rotationScope = renderEnvironment(input);
  if(rotationScope === 0)
    return;
  APP.animationId = requestAnimationFrame(() => tic(input));
} */

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