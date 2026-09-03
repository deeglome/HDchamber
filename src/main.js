import { RENDER_FUNCS, THREE_DIMENSIONS} from "./render.js";
import { animate } from "popmotion";
import { DEG2RAD, degToRad } from "three/src/math/MathUtils.js";

// VARIABILI GLOBALI PER L'APPLICAZIONE
const MIN_DIMENSION = 2;
const MAX_DIMENSION = 6;
const OMEGA0 = 45; // deg/s
const AXIS_IDENTIFIERS = "xyzwvu";

const APP = {
  initialTime: null,
  finalTime: null,
  deltaTime: () => APP.finalTime - APP.initialTime,
  dimensions: 3,
  MIN_DIMENSIONS: 2,
  MAX_DIMENSIONS: 6,
  theta: [],
  kValues: [],
  omega: () => APP.kValues.map((k) => k * OMEGA0),
  planes: [],
  isRendering: false,
  guiHandlers: {},
  animationId: {},
  selectedObj: null,
  crossSectionMode: {status: "off", hyperplaneNormal: "", hyperplaneOffset: 0},
  camera: { zoom: 1.00 },
  camChain: [],
  isOrtho: false,
  axesMode: "off",
  colorMapMode: "off",
  angleMeasurement: "degree"
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

const THRESHOLD = 0.20;
const MAX_ZOOM = 3.00;
const MIN_ZOOM = MAX_ZOOM / 10;

function addWindowEvents() {
  window.addEventListener("resize", () => {
    resizeCanvas();
    const h1 = document.querySelector("h1");
    h1.style.textAlign = "center";
  });
}

function enableColorLegend() {
  const colorLegend = document.querySelector("legend");
  if (colorLegend.classList.contains("hidden")) colorLegend.classList.remove("hidden");
  setLegendCoordinate();
  console.log("LEGENDA ON")
}

function disableColorLegend() {
  const colorLegend = document.querySelector("legend");
  if (!colorLegend.classList.contains("hidden")) colorLegend.classList.add("hidden");
  console.log("LEGENDA OFF")
}

function setLegendCoordinate() {
  const axisIdentifiers = "xyzwvu";
  const coordinateToMap = axisIdentifiers[APP.dimensions - 1].toUpperCase();
  const colorLegendLabel = document.querySelector("legend label");
  colorLegendLabel.innerHTML = coordinateToMap + " Coordinate";
}

function updateAndRender(){
  updateDeveloperDataDiv(developerDataDiv);
  RENDER_FUNCS.updateTHREE(APP);
  if(APP.dimensions > THREE_DIMENSIONS && APP.colorMapMode === "on"){
    enableColorLegend();
  } else {
    disableColorLegend();
  }
  updateTitle();
}

function rotationScope(planes, angularSpeeds) {
  let scopeIndex = 0;

  planes.forEach((plane) => {
    const speed = angularSpeeds[planes.indexOf(plane)];

    if (speed !== 0 && speed !== null && speed !== undefined) {
      const i1 = AXIS_IDENTIFIERS.indexOf(plane[0]);
      const i2 = AXIS_IDENTIFIERS.indexOf(plane[1]);

      if (i1 === -1 || i2 === -1) throw new Error(`Invalid axis in plane: ${plane}`);
      scopeIndex = Math.max(scopeIndex, i1, i2);
    }
  });

  return scopeIndex > 0 ? scopeIndex + 1 : 0;
}

function resizeCanvas() {
  const canvas = document.querySelector("canvas");
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  RENDER_FUNCS.resizeRenderer(APP, width, height);
}

function initInput(type, min, max, value, step, classes = [], onEvent = null, callback = null) {
  const input = document.createElement("input");
  input.type = type;
  input.min = min;
  input.max = max;
  input.value = value;
  input.step = step;

  if(Array.isArray(classes) && classes.length) {
    input.classList.add(...classes);
  } else if (typeof classes === 'string' && classes.trim() !== '') {
    input.classList.add(classes);
  } else {
    throw new Error("Invalid 'classes' given: ", classes);
  }

  if (onEvent && typeof callback === 'function') {
    input.addEventListener(onEvent, callback);
  } else if (onEvent && typeof callback !== 'function') {
    throw new Error("invalid 'callback' given: ", callback);
  }
  
  return input;
}

/*
*
* ZOOM IN/OUT BUTTON
*
*/

function setZoomInBtn(){
  const zoomInBtn = document.querySelector(".zoom-in-btn");
  zoomInBtn.addEventListener("click", ()=>{
    APP.camera.zoom = Math.min(MAX_ZOOM, APP.camera.zoom + THRESHOLD);
    RENDER_FUNCS.applyZoom(APP);
  });
}

function setZoomOutBtn(){
  const zoomOutBtn = document.querySelector(".zoom-out-btn");
  zoomOutBtn.addEventListener("click", ()=>{
    APP.camera.zoom = Math.max(MIN_ZOOM, APP.camera.zoom - THRESHOLD);
    RENDER_FUNCS.applyZoom(APP);
  });
}

// PROJECTION MODE
function setProjectionButton({ button, icon }) {
  button.addEventListener("click", () => {
    APP.isOrtho = !APP.isOrtho;
    icon.style.setProperty('--icon-url', `url('/icons/${APP.isOrtho ? "perspective" : "ortho"}.png')`);
    updateAndRender();
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
  const meshes = [
    "Hypercube",
    "Simplex",
    "Orthoplex",
    "Hypersphere",
    "LowHypersphere",
    "Hypertorus",
    "LowHypertorus",
    "Hyperspherinder",
    "LowHyperspherinder",
    "Hypercone",
    "LowHypercone",
    "And so on..."
  ];

  meshes.forEach((meshLabel) => {
    const mesh = document.createElement("li");
    mesh.classList.add("button", "text", "xs", "mesh");
    mesh.innerHTML = meshLabel;
    dropmenu.appendChild(mesh);
  });

  meshButtons = document.querySelectorAll(".button.mesh");
  meshButtons.forEach((button) => {
    button.addEventListener("click", () => {
      APP.selectedObj = button.innerHTML;
      if (APP.selectedObj !== "And so on...") {
        cancelAnimationFrame(APP.animationId);
        uploadWikipage();
        console.time('updateTHREE')
        updateAndRender();
        console.timeEnd('updateTHREE')
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

// DIMENSIONS HANDLER
function ValidDimensions(dimensions) {
  return dimensions >= APP.MIN_DIMENSIONS && dimensions <= APP.MAX_DIMENSIONS;
}

function setDimensionsInput(input) {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const value = parseInt(input.value);
      if (ValidDimensions(value)) {
        APP.dimensions = value;
      } else if (value < APP.MIN_DIMENSIONS) {
        input.value = APP.MIN_DIMENSIONS;
        APP.dimensions = APP.MIN_DIMENSIONS;
      } else if (value > APP.MAX_DIMENSIONS) {
        input.value = APP.MAX_DIMENSIONS;
        APP.dimensions = APP.MAX_DIMENSIONS;
      }
      setRotationHandler();
      setCamChainHandler();
      APP.camChain.forEach((c, i) => {
        console.log(`CAMERA ${APP.dimensions - i}D: `, c.hyperspherical_pos);
      });

      setCrossSectionDropmenu(document.querySelector(".cross-section-mode + .dropmenu"));
      setCrossSectionHyperplane(document.querySelector(".cross-section-mode + .dropmenu"));
      updateAndRender();
    }
  });
}

function setDimensionsButton({button, input}) {
  button.addEventListener("click", () => {
    const dropmenu = document.querySelector(".button.dimensions-handler + .dropmenu");
    toggleDropmenuDisplay(dropmenu, "flex");
  });
}

function setDimensionsHandler() {
  const dimensions = {
    button: document.querySelector(".button.dimensions-handler"),
    input: null,
  };
  setDimensionsButton(dimensions);
  setDimensionsInput(document.querySelector(".dimensions-input"));
  const dropmenu = document.querySelector(".button.dimensions-handler + .dropmenu");
}

// ROTATION HANDLER
const MAX_K_TOT = 4;
const MIN_K_TOT = -MAX_K_TOT;

function evenlyDistributedMaxK() {
  return MAX_K_TOT / Math.sqrt(rots(APP.dimensions));
}

const THETA_STEP = 5;
const K_STEP = 0.05;

function setPlanes({planes, kValues, theta, options, dropmenu}) {
  const planesMap = new Map();
  for (let i = 0; i < planes.length; i++) {
    console.log({planes, kValues, theta, options, dropmenu});
    planesMap.set(planes[i], {k: kValues[i], angle: theta[i]});
  }
  options = document.createElement("ul");
  options.classList.add("rotation-handler-options", "button");
  const planesUl = dropmenu.querySelector("ul.planes");
  planesUl.innerHTML = "";

  planesMap.forEach((rotationState, plane) => {
    const rotationPlane = document.createElement("li");
    rotationPlane.classList.add("rotation-plane", "slider", plane);

    const planeHeader = document.createElement("div");
    planeHeader.classList.add("plane-header", "header");

    const planeSpan = document.createElement("span");
    planeSpan.innerHTML = `${plane.toUpperCase()}`;
    planeHeader.appendChild(planeSpan);

    const thetaInput = initInput("number", 0, 360, rotationState.angle, THETA_STEP, "theta-input");

    planeHeader.appendChild(thetaInput);

    const maxK = evenlyDistributedMaxK();
    const kInput = initInput("number", -maxK, +maxK, rotationState.k, K_STEP, "k-input");

    planeHeader.appendChild(kInput);

    rotationPlane.appendChild(planeHeader);

    const slider = initInput("range", 0, 360, rotationState.angle, THETA_STEP, "theta-slider");

    rotationPlane.appendChild(slider);

    planesUl.appendChild(rotationPlane);
  });
}

function clamp(value, min, max){
  if(value > max) return max;
  else if(value < min) return min;
  return value;
}

function setKInputs({planes, kValues, kInputs}) {
  kInputs.forEach((input, index) => {
    input.addEventListener("keydown", (event) => {
      if(event.key === "Enter"){
        const maxK = Math.round(evenlyDistributedMaxK() * 100) / 100;
        input.value = clamp(input.value, -maxK, +maxK);
        kValues[index] = input.value;
        APP.initialTime = Date.now();
        APP.kValues = kValues;
        updateAndRender();
      }
    });
  });
}

function arg(value){
  while(value < 0) value += 360;
  while(value > 360) value -= 360;
  return value;
}

function updateThetaValue(input, index, theta){
  let angle = arg(input.value*1);
  input.value = angle;
  theta[index] = angle;
  APP.theta = theta;
  APP.initialTime = Date.now();

  RENDER_FUNCS.setAbsoluteTheta(APP, APP.theta.map(t => degToRad(t))); // R0 · v0
  updateAndRender();
}

function setThetaInputsAndSliders({planes, theta, thetaInputs, thetaSliders}){
  thetaInputs.forEach((input, index) =>{
      input.addEventListener("keydown", (event) => {
        if(event.key === "Enter"){
          updateThetaValue(input, index, theta);
        }
    });
  });

  thetaSliders.forEach((slider, index) => {
    slider.addEventListener("input", () => {
      updateThetaValue(slider, index, theta);
    });
  });
}

let sliderSyncId = null;

function setSliderSync() {
  cancelAnimationFrame(sliderSyncId);

  function frame() {
    APP.planes.forEach((plane, i) => {
      const inputEl = document.querySelector(`.rotation-plane.${plane} .theta-input`);
      const sliderEl = document.querySelector(`.rotation-plane.${plane} .theta-slider`);
      if (sliderEl && document.activeElement !== sliderEl) {
        sliderEl.value = APP.theta[i];
      }
      if (inputEl && document.activeElement !== inputEl) {
        inputEl.value = APP.theta[i]; 
      }
    });
    updateDeveloperDataDiv(developerDataDiv);
    sliderSyncId = requestAnimationFrame(frame);
  }

  sliderSyncId = requestAnimationFrame(frame);
}

function setRandomRotationBtn(handler){
  const randomBtn = handler.dropmenu.querySelector(".tools .random-btn");

  randomBtn.addEventListener("click", ()=>{
    handler.kInputs.forEach((input, index)=>{
      console.log("Funzione random!")
      const maxK = Math.round(evenlyDistributedMaxK() * 100) / 100;
      let randomK = Math.round(100 * (Math.random() - Math.random()) * maxK) / 100;
      handler.kValues[index] = randomK;
      input.value = randomK;
      APP.initialTime = Date.now();
      APP.kValues = handler.kValues;
    });
    console.time('updateTHREE');
    updateAndRender();

    console.timeEnd('updateTHREE')
  });
}

const CLEAN_K = 0;
const CLEAN_ANGLE = 0;

function setClearRotationsBtn(handler){
  const clearBtn = handler.dropmenu.querySelector(".tools .clear-btn");

  clearBtn.addEventListener("click", () => {
    handler.kInputs.forEach((input, index) => {
      console.log("Funzione clear!")
      handler.kValues[index] = CLEAN_K;
      input.value = CLEAN_K;
      APP.initialTime = Date.now();
      APP.kValues = handler.kValues;
      updateAndRender();
    });
  });
}

function refreshThetaControlsForUnit() {
  const max = 360;
  const step = 18; // step coerente con l'unità

  APP.planes.forEach((plane, i) => {
    const sliderEl = document.querySelector(`.rotation-plane.${plane} .theta-slider`);
    if (sliderEl) {
      sliderEl.max = max;
      sliderEl.step = step;
      sliderEl.value = APP.theta[i];
    }

    const inputEl = document.querySelector(`.rotation-plane.${plane} .theta-input`);
    if (inputEl) {
      inputEl.step = step;
      inputEl.value = APP.theta[i];
    }
  });
}

function setTools(handler){
  setRandomRotationBtn(handler);
  setClearRotationsBtn(handler);
}

function setPlanesDropmenu(handler) {
  setPlanes(handler);
  setTools(handler);
  handler.kInputs = document.querySelectorAll(".rotation-plane .k-input");
  handler.thetaInputs = document.querySelectorAll(".rotation-plane .theta-input");
  handler.thetaSliders = document.querySelectorAll(".rotation-plane .theta-slider");
  setKInputs(handler);
  setThetaInputsAndSliders(handler);
}

function allPossiblePlanes(dimensions) {
  const coords = AXIS_IDENTIFIERS.slice(0, dimensions).split("");
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

function rots(n) {
  if( n < 0 ) throw new Error("Invalid n:", n);
  return n * (n-1) / 2;
}

function setRotationButton({button, dropmenu}) {
  button.onclick = () => {
    toggleDropmenuDisplay(dropmenu, "flex");
  };
}

function setRotationHandler() {
  const rotation = {
    button: document.querySelector(".button.rotation-handler"),
    dropmenu: document.querySelector(".rotation-handler + .dropmenu"),
    planes: allPossiblePlanes(APP.dimensions),
    kValues: Array(rots(APP.dimensions)).fill(0),
    theta: Array(rots(APP.dimensions)).fill(0),
    kInputs: null,
    thetaSliders: null,
    options: null,
  };
  setPlanesDropmenu(rotation);
  setRotationButton(rotation);
  APP.kValues = rotation.kValues;
  APP.planes = rotation.planes;
  APP.theta = rotation.theta; 
  console.log("theta: ", APP.theta);
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
    let filteredName = APP.selectedObj;
    if(filteredName.includes('Low'))
      filteredName = filteredName.replace('Low', '');
    writeMeshWikipage(APP.dimensions + "-" + filteredName, APP.guiHandlers.wiki.wikipage);
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
function initHyperplaneNormalInput(hyperplane, value){
  const input = document.createElement("input");
  input.type = "number";
  input.value = value;
  input.step = 0.01;
  if(hyperplane.classList.contains("from")){
    input.addEventListener("input", () => {
      stopHyperplaneAnimation();
      const inputs = hyperplane.querySelectorAll("input:not(.offset)");
      const normal = Array.from(inputs).map((input) => parseFloat(input.value));
      APP.crossSectionMode.hyperplaneNormal = normal;
      updateAndRender();
    });
  }    
  return input;
}

function initHyperplaneOffsetInput(hyperplane){
  const input = document.createElement("input");
  input.classList.add("offset");
  input.type = "number";
  input.value = 0.00;
  input.step = 0.01;
  if(hyperplane.classList.contains("from")){
      stopHyperplaneAnimation();
      input.addEventListener("input", () => {
      APP.crossSectionMode.hyperplaneOffset = parseFloat(input.value);
      updateAndRender();
    });
  }
  return input;
}

function setCrossSectionHyperplane(dropmenu){
  const defaultNormal = new Array(APP.dimensions).fill(0.0);
  defaultNormal[APP.dimensions - 1] = 1.0;
  APP.crossSectionMode.hyperplaneNormal = defaultNormal;
  APP.crossSectionMode.hyperplaneOffset = 0.0;
  const hyperplanes = dropmenu.querySelectorAll(".cross-section-mode .hyperplane");

  hyperplanes.forEach(hyperplane => {
    hyperplane.innerHTML = "";
    const defaultHypeplaneNormal = Array(APP.dimensions).fill(0);
    defaultHypeplaneNormal[APP.dimensions - 1] = 1;
    for(let i = 0; i < APP.dimensions; i++){
        const input = initHyperplaneNormalInput(hyperplane, defaultHypeplaneNormal[i]);
        hyperplane.appendChild(input);
        const span = document.createElement("span");
        span.innerHTML = AXIS_IDENTIFIERS[i] + " + ";
        hyperplane.appendChild(span);
    }
    const offsetInput = initHyperplaneOffsetInput(hyperplane);
    hyperplane.appendChild(offsetInput);
    const offsetSpan = document.createElement("span");
    offsetSpan.innerHTML = " = 0";
    hyperplane.appendChild(offsetSpan);
  });
}

function setAnimationToolbarStatusButtons(dropmenu){
  const statusButtons = dropmenu.querySelectorAll(".animation-toolbar-states .button");
  statusButtons.forEach((button) => {
    button.addEventListener("click", () => {
      statusButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      
      const animationToolbar = document.querySelector(".animation-toolbar");
      const p = document.querySelector(".cross-section-mode p.from");

      if(button.innerHTML === "Open"){
        p.classList.remove("hidden");
        animationToolbar.classList.remove("hidden");
      } else {
        p.classList.add("hidden");
        animationToolbar.classList.add("hidden");
      }
      updateAndRender();
    });
  });
}

function getHyperplaneValues(hyperplaneEl) {
  const normalInputs = hyperplaneEl.querySelectorAll("input:not(.offset)");
  const offsetInput = hyperplaneEl.querySelector("input.offset");
  return {
    normal: Array.from(normalInputs).map((input) => parseFloat(input.value)),
    offset: parseFloat(offsetInput.value)
  };
}

function lerpArray(from, to, t) {
  return from.map((v, i) => v + (to[i] - v) * t);
}

let hyperplaneAnimation = null;

function stopHyperplaneAnimation() {
  hyperplaneAnimation?.stop();
  hyperplaneAnimation = null;
}

function setAnimateHyperplaneBtn(dropmenu) {
  const animateBtn = dropmenu.querySelector(".animation-toolbar .button");
  const durationInput = dropmenu.querySelector(".animation-toolbar .duration");
  const fromHyperplane = dropmenu.querySelector(".from.hyperplane");
  const toHyperplane = dropmenu.querySelector(".to.hyperplane");

  animateBtn.addEventListener("click", () => {
    stopHyperplaneAnimation();

    const fromNormal = [...APP.crossSectionMode.hyperplaneNormal];
    const fromOffset = APP.crossSectionMode.hyperplaneOffset;
    const to = getHyperplaneValues(toHyperplane);
    const duration = 1000 * parseFloat(durationInput.value) || 1000;

    const fromNormalInputs = fromHyperplane.querySelectorAll("input:not(.offset)");
    const fromOffsetInput = fromHyperplane.querySelector("input.offset");

    hyperplaneAnimation = animate({
      from: 0,
      to: 1,
      duration,
      onUpdate: (t) => {
        const currentNormal = lerpArray(fromNormal, to.normal, t);
        const currentOffset = fromOffset + (to.offset - fromOffset) * t;
        
        APP.crossSectionMode.hyperplaneNormal = lerpArray(fromNormal, to.normal, t);
        APP.crossSectionMode.hyperplaneOffset = fromOffset + (to.offset - fromOffset) * t;
        // sincronizza anche gli input .from visibili
        fromNormalInputs.forEach((input, i) => {
          input.value = currentNormal[i].toFixed(2);
        });
        if (fromOffsetInput) fromOffsetInput.value = currentOffset.toFixed(2);
        updateAndRender();
      },
      onComplete: () => {
        hyperplaneAnimation = null;
      }
    });
  });
}

function setCrossSectionStatusButtons(dropmenu){
  const statusButtons = dropmenu.querySelectorAll(".cross-section-mode .states .button");
  statusButtons.forEach((button) => {
    button.addEventListener("click", () => {
      statusButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      APP.crossSectionMode.status = button.innerHTML.toLowerCase();
      console.log("Cross-section mode:", APP.crossSectionMode.status);
      updateAndRender();
    });
  });
}

function setCrossSectionDropmenu(dropmenu){
  setCrossSectionHyperplane(dropmenu);
  setCrossSectionStatusButtons(dropmenu);
  setAnimationToolbarStatusButtons(dropmenu);
  setAnimateHyperplaneBtn(dropmenu);
}

function setCrossSectionButton({button, icon}) {
  const dropmenu = document.querySelector(".cross-section-mode + .dropmenu");
  setCrossSectionDropmenu(dropmenu);
  button.addEventListener("click", () => {
    toggleDropmenuDisplay(dropmenu, "flex");
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
        APP.axesMode = "off";
        axesButton.setAttribute("title", "Enable fixed axes");
        axesIcon.style.setProperty('--icon-url', `url('${FIXED_AXES_SRC}')`);
        break;
      case 1:
        APP.axesMode = "fixed";
        axesButton.setAttribute("title", "Enable rotating axes");
        axesIcon.style.setProperty('--icon-url', `url('${ROTATING_AXES_SRC}')`);
        break;
      case 2:
        APP.axesMode = "rotating";
        axesButton.setAttribute("title", "Disable axes");
        axesIcon.style.setProperty('--icon-url', `url('${AXES_OFF_SRC}')`);
      default:
        console.error("Error in axes elaboration!");
        break;
    }
    updateAndRender();
  });
}

function setColorMapMode() {
  const colorMapButton = document.querySelector(".button.color-map-mode");

  colorMapButton.addEventListener("click", () => {
    if (APP.dimensions <= THREE_DIMENSIONS)
      alert("Cannot enable 'Color Map Mode' in " + THREE_DIMENSIONS + "D. Try to select at least " + (THREE_DIMENSIONS + 1) + " dimensions.");
    else {
      APP.colorMapMode = APP.colorMapMode === "on" ? "off" : "on";
      colorMapButton.setAttribute("title", (APP.colorMapMode === "on" ? "Disable" : "Enable") + " Color Map mode");
      updateAndRender();
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
    } else {
      pauseBtnIcon.style.setProperty('--icon-url', `url('/icons/resume.svg')`);
      pauseBtn.title = "Resume animation";
    }
  });
}

/*
* =============
* HYPERCAMERA BUTTON
* =============
*/
const HYPERCAM_LABELS = ["\u03B8", "\u03A6", "\u03C8\u2083", "\u03C8\u2084", "\u03C8\u2085"]; // θ, Φ, ψ3, ψ4, ψ5

function activeHypersphericalCount(dimensions){
  return Math.max(0, dimensions - 1);
}

function initHypercamInput(value, index){
  const input = document.createElement("input");
  input.setAttribute("type", "number");
  input.setAttribute("min", 0);
  input.setAttribute("max", index === 0 ? 360 : 180);
  input.setAttribute("step", THETA_STEP);
  input.setAttribute("value", value);
  input.classList.add("hypercam-input");
  return input;
}

function initHypercamSlider(value, index){
  const slider = document.createElement("input");
  slider.classList.add("hypercam-slider");
  slider.setAttribute("type", "range");
  slider.setAttribute("min", 0);
  slider.setAttribute("max", index === 0 ? 360 : 180);
  slider.setAttribute("step", THETA_STEP);
  slider.setAttribute("value", value);
  return slider;
}

function initRhoInput(value){
  const rhoP = document.createElement("p");
  rhoP.classList.add("spherical-p", "rho-p");
  rhoP.innerHTML = "\u03C1";

  const input = document.createElement("input");
  input.setAttribute("type", "number");
  input.setAttribute("min", 0);
  input.setAttribute("value", value);

  input.addEventListener("keydown", (event) => {
    if(event.key === "Enter"){
      APP.camChain.at(-1).hyperspherical_pos[0] = parseFloat(input.value);
      const [rho, theta, phi] = APP.camChain.at(-1).hyperspherical_pos;
      RENDER_FUNCS.setCameraSpherical(APP, rho, degToRad(theta), degToRad(phi));
    }
  });

  rhoP.appendChild(input);
  return rhoP;
}

function updateHypercamValue(input, index){
  let angle = arg(input.value * 1);
  input.value = angle;

  // indice UI (0=θ,1=Φ,...) → indice in hyperspherical_pos (0=rho, 1=θ, 2=Φ,...)
  APP.camChain.at(-1).hyperspherical_pos[index + 1] = angle;

  const threeCamSpherical = APP.camChain.at(-1).hyperspherical_pos;
  RENDER_FUNCS.setCameraSpherical(
    APP,
    threeCamSpherical[0],
    degToRad(threeCamSpherical[1]),
    degToRad(threeCamSpherical[2])
  );
}

function setHypercamList(dropmenu){
  const hypercamUl = dropmenu.querySelector("ul.hypersphericals");
  hypercamUl.innerHTML = "";

  HYPERCAM_LABELS.forEach((label, index) => {
    const item = document.createElement("li");
    item.classList.add("hypercam-angle", `psi-${index}`, "slider");

    const header = document.createElement("div");
    header.classList.add("hypercam-header", "header");

    const labelSpan = document.createElement("span");
    labelSpan.innerHTML = label;
    header.appendChild(labelSpan);

    const value = 0;// APP.camera.hypersphericals[index] || 0;
    const input = initHypercamInput(value, index);
    header.appendChild(input);
    item.appendChild(header);

    const slider = initHypercamSlider(value, index);
    item.appendChild(slider);

    item.classList.toggle("hidden", index >= activeHypersphericalCount(APP.dimensions));

    input.addEventListener("keydown", (event) => {
      if(event.key === "Enter") updateHypercamValue(input, index);
    });
    slider.addEventListener("input", () => updateHypercamValue(slider, index));

    hypercamUl.appendChild(item);
  });
}

function buildHypercamTitle() {
  const title = document.createElement("div");
  title.classList.add("camchain-title", "header", "hypercam-title");
  title.innerHTML = `Camera ${APP.dimensions}D`;
  return title;
}

// sync

function setHypercamHandler(){
  const dropmenu = document.querySelector(".camera + .dropmenu");
  setHypercamList(dropmenu);

  const hypercameraLi = dropmenu.querySelector(".hypercamera-coords");
  if(!hypercameraLi.querySelector(".hypercam-title")){
    hypercameraLi.insertBefore(buildHypercamTitle(), hypercameraLi.firstChild);
  }

  if(!dropmenu.querySelector(".rho-p")){
    const rhoP = initRhoInput(APP.camera.radius);
    const hypercamUl = dropmenu.querySelector("ul.hypersphericals");
    hypercamUl.parentNode.insertBefore(rhoP, hypercamUl);
  }
}

function setRapidCameraAssetBtns(){

}

function setCameraBtn(dropmenu){
  const cameraBtn = document.querySelector(".camera.button");

  cameraBtn.addEventListener("click", ()=>{
    toggleDropmenuDisplay(dropmenu, "flex");
  });
}

function setCameraOptions(){
  const camera = {
    dropmenu: document.querySelector(".camera + .dropmenu")
  };
  setCamChainHandler();
  setHypercamHandler();
  setRapidCameraAssetBtns();
  setCameraBtn(camera.dropmenu);
}

let hypercamSyncId = null;

function setHypercamSync(){
  cancelAnimationFrame(hypercamSyncId);

  function frame(){
    const titleEl = document.querySelector(".hypercamera-coords .hypercam-title");
    if(titleEl) titleEl.innerHTML = `Camera ${APP.dimensions}D`;

    HYPERCAM_LABELS.forEach((_, index) => {
      const inputEl = document.querySelector(`.hypercam-angle.psi-${index} .hypercam-input`);
      const sliderEl = document.querySelector(`.hypercam-angle.psi-${index} .hypercam-slider`);
      const value = APP.camChain.at(-1).hyperspherical_pos[index] || 0;
      const displayValue = value;

      if(sliderEl && document.activeElement !== sliderEl) sliderEl.value = displayValue;
      if(inputEl && document.activeElement !== inputEl) inputEl.value = displayValue;

      const item = document.querySelector(`.hypercam-angle.psi-${index}`);
      if(item) item.classList.toggle("hidden", index >= activeHypersphericalCount(APP.dimensions));
    });
    hypercamSyncId = requestAnimationFrame(frame);
  }
  hypercamSyncId = requestAnimationFrame(frame);
}

/*
* =============
* CAM CHAIN (ipercamere intermedie)
* =============
*/

// Numero di stadi intermedi = ambient_dim - THREE_DIMENSIONS, per ambient_dim da
// APP.dimensions fino a THREE_DIMENSIONS+1 (l'ultimo stadio, 4D->3D, è escluso
// perché già gestito dalla riga ".hypercamera-coords" esistente in HTML).
function intermediateStagesCount(dimensions) {
  return Math.max(0, dimensions - THREE_DIMENSIONS);
}

// Per ogni stadio intermedio, il numero di angoli è (ambient_dim - 1),
// dove ambient_dim decresce da APP.dimensions-1 fino a 4.
function stageAmbientDim(stageIndex) {
  return APP.dimensions - 1 - stageIndex;
}

function initCamChainInput(value, i) {
  return initInput("number", 0, i===1 ? 360 : 180, value, THETA_STEP, "camchain-input");
}

function initCamChainSlider(value, i) {
  return initInput("range", 0, i===1 ? 360 : 180, value, THETA_STEP, "camchain-slider");
}

function updateCamChainValue(input, stageIndex, angleIndex) {
  let angle = arg(input.value * 1);
  input.value = angle;

  APP.camChain[stageIndex].hyperspherical_pos[angleIndex] = angle;
  APP.camChain[stageIndex].dirty = true;

  updateAndRender();
}

function updateCamChainRadius(input, stageIndex) {
  const value = parseFloat(input.value);
  input.value = value;
  APP.camChain[stageIndex].hyperspherical_pos[0] = value;
  APP.camChain[stageIndex].dirty = true;
  updateAndRender();
}

function initCamChainRhoInput(stageIndex, value) {
  const rhoP = document.createElement("p");
  rhoP.classList.add("spherical-p", "rho-p");
  rhoP.innerHTML = "\u03C1";

  const input = initInput("number", 0, 10, value, 0.01, "camchain-rho-input", "keydown", (event) => {
    if (event.key === "Enter") updateCamChainRadius(input, stageIndex);
  });

  rhoP.appendChild(input);
  return rhoP;
}

function buildCamChainStageTitle(stageIndex) {
  const ambientDim = stageAmbientDim(stageIndex) + 1;
  const title = document.createElement("div");
  title.classList.add("camchain-title", "header");
  title.innerHTML = `Camera ${ambientDim}D`;
  return title;
}

function buildCamChainStage(stageIndex) {
  const ambientDim = stageAmbientDim(stageIndex) + 1;
  const numAngles = ambientDim - 1;

  const li = document.createElement("li");
  li.classList.add("camchain-stage", `stage-${stageIndex}`);

  li.appendChild(buildCamChainStageTitle(stageIndex));

  const stageRadius = APP.camChain[stageIndex]?.radius ?? 1;
  li.appendChild(initCamChainRhoInput(stageIndex, stageRadius));

  const ul = document.createElement("ul");
  ul.classList.add("camchain-angles", "row");

  for (let i = 1; i < ambientDim; i++) {
    const item = document.createElement("li");
    item.classList.add("camchain-angle", `angle-${i}`, "slider");

    const header = document.createElement("div");
    header.classList.add("camchain-header", "header");

    const labelSpan = document.createElement("span");
    labelSpan.innerHTML = HYPERCAM_LABELS[i-1] || `\u03C8${i-1}`;
    header.appendChild(labelSpan);

    const value = APP.camChain[stageIndex].hyperspherical_pos[i] || 0;
    const input = initCamChainInput(value, i);
    header.appendChild(input);
    item.appendChild(header);

    const slider = initCamChainSlider(value, i);
    item.appendChild(slider);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") updateCamChainValue(input, stageIndex, i);
    });
    slider.addEventListener("input", () => updateCamChainValue(slider, stageIndex, i));

    ul.appendChild(item);
  }

  li.appendChild(ul);
  return li;
}

function setCamChainList(dropmenu) {
  const camChainUl = dropmenu.querySelector("ul.cam-chain");

  // Rimuove tutti gli stage intermedi già presenti (mantiene la
  // ".hypercamera-coords" fissa in HTML, la lascia intatta)
  camChainUl.querySelectorAll(".camchain-stage").forEach((el) => el.remove());

  const numStages = intermediateStagesCount(APP.dimensions);

  // Ricostruisce APP.camChain con le coordinate correnti, se disponibili,
  // altrimenti azzerate.
  const newCamChain = [];
  for (let s = 0; s <= numStages; s++) {
    const ambientDim = stageAmbientDim(s) + 1;
    const numAngles = ambientDim - 1;
    const existing = APP.camChain[s];
    const dftRadius = 3;

    newCamChain.push({
      ambient_dim: ambientDim,
      hyperspherical_pos: existing && existing.hyperspherical_pos.length === numAngles + 1
        ? existing.hyperspherical_pos
        : [dftRadius, ...Array(numAngles).fill(0)],
      dirty: true
    });
  }

  APP.camChain = newCamChain;

  for (let s = 0; s < numStages; s++) {
    camChainUl.appendChild(buildCamChainStage(s));
  }
}

function setCamChainHandler() {
  const dropmenu = document.querySelector(".camera + .dropmenu");
  setCamChainList(dropmenu);
}

let camChainSyncId = null;

function setCamChainSync() {
  cancelAnimationFrame(camChainSyncId);

  function frame() {
    const lastIndex = APP.camChain.length - 1;

    APP.camChain.forEach((stage, stageIndex) => {
      const isBaseCamera = stageIndex === lastIndex; // ambient_dim === 3, il vecchio "hypercam"

      // --- RHO (index 0 di hyperspherical_pos) ---
      const rhoSelector = isBaseCamera
        ? ".hypercamera-coords .rho-p input"
        : `.camchain-stage.stage-${stageIndex} .camchain-rho-input`;
      const rhoInputEl = document.querySelector(rhoSelector);
      if (rhoInputEl && document.activeElement !== rhoInputEl) {
        rhoInputEl.value = stage.hyperspherical_pos[0];
      }

      // --- ANGOLI (index >= 1 di hyperspherical_pos) ---
      stage.hyperspherical_pos.forEach((value, angleIndex) => {
        if (angleIndex === 0) return; // già gestito sopra come rho

        let inputEl, sliderEl;

        if (isBaseCamera) {
          const psiIndex = angleIndex - 1; // 1->psi-0 (θ), 2->psi-1 (Φ)
          const selector = `.hypercam-angle.psi-${psiIndex}`;
          inputEl = document.querySelector(`${selector} .hypercam-input`);
          sliderEl = document.querySelector(`${selector} .hypercam-slider`);
        } else {
          const selector = `.camchain-stage.stage-${stageIndex} .camchain-angle.angle-${angleIndex}`;
          inputEl = document.querySelector(`${selector} .camchain-input`);
          sliderEl = document.querySelector(`${selector} .camchain-slider`);
        }

        if (sliderEl && document.activeElement !== sliderEl) sliderEl.value = value;
        if (inputEl && document.activeElement !== inputEl) inputEl.value = value;
      });
    });

    camChainSyncId = requestAnimationFrame(frame);
  }
  camChainSyncId = requestAnimationFrame(frame);
}

/*
* ==============
* DEVELOPER MODE
* ==============
*/
const developerDataDiv = document.querySelector(".developer-data");

function updateDeveloperDataDiv(developerDataDiv){
  developerDataDiv.innerHTML = "";

  Object.getOwnPropertyNames(APP).forEach((prop) => {
    const developerP = document.createElement("p");
    developerP.classList.add("developer-p");
    developerP.innerHTML = `${prop}: ${APP[prop]}`;
    developerDataDiv.appendChild(developerP);
  });
}

function setDeveloperModeBtn(){
  const developerModeBtn = document.querySelector(".developer-mode.button");

  developerModeBtn.addEventListener("click", ()=>{
    developerDataDiv.classList.toggle("hidden");
  });
}

function humanizeMeshName(technicalName) {
  try {
    const target = getMeshWikiData(technicalName);
    return target["commonName"];
  } catch (error) {
    console.warn("An error is found, it will be returned the original name.", error);
    return technicalName;
  }
}

function updateTitle(){
  const rScope = rotationScope(APP.planes, APP.omega());
  console.log("Rotation scope:", rScope);
  const h1 = document.querySelector("h1");
  let filteredName = APP.selectedObj;
  if(filteredName.includes('Low'))
    filteredName = filteredName.replace('Low', '');
  const humanizedInput = humanizeMeshName(`${APP.dimensions}-${filteredName}`);
  if (rScope > 1) h1.innerHTML = `A ${humanizedInput} is rotating in ${rScope}D`;
  else h1.innerHTML = `A ${humanizedInput} is static`;
  const title = document.querySelector("title");
  title.innerHTML = "HDchamber | " + h1.innerHTML;
  console.timeEnd('updateTHREE')
}

function addGuiHandlers() {
  setProjectionMode();
  setMeshSelector();
  setDimensionsHandler();
  setRotationHandler();
  setWikiHandler();
  setCrossSectionMode();
  setAxesMode();
  setColorMapMode();
  setPauseBtn();
  setZoomInBtn();
  setZoomOutBtn();
  setSliderSync();
  setCameraOptions();
  setDeveloperModeBtn();
  setCamChainSync();
  RENDER_FUNCS.setOnCameraChange(updateAndRender);
}

addWindowEvents();
addGuiHandlers();