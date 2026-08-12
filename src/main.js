import { RENDER_FUNCS, THREE_DIMENSIONS} from "./render.js";

// VARIABILI GLOBALI PER L'APPLICAZIONE
const MIN_DIMENSION = 2;
const MAX_DIMENSION = 6;
const OMEGA0 = Math.PI / 4; // rad/s
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
  camera: {position: null, zoom: 1.00},
  isOrtho: false,
  axesMode: "off",
  colorMapMode: "off",
  angleMeasurement: "radian"
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

/*
*
* ZOOM IN/OUT BUTTON
*
*/

function setZoomInBtn(){
  const zoomInBtn = document.querySelector(".zoom-in-btn");
  zoomInBtn.addEventListener("click", ()=>{
    APP.camera.zoom = Math.min(MAX_ZOOM, APP.camera.zoom + THRESHOLD);
    updateAndRender();
  });
}

function setZoomOutBtn(){
  const zoomOutBtn = document.querySelector(".zoom-out-btn");
  zoomOutBtn.addEventListener("click", ()=>{
    APP.camera.zoom = Math.max(MIN_ZOOM, APP.camera.zoom - THRESHOLD);
    updateAndRender();
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
    "LowHyperspherinder",
    "LowHypercone",
    "And so on..."
  ];

  meshes.forEach((meshLabel) => {
    const mesh = document.createElement("li");
    mesh.classList.add("button", "mesh");
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

function initKInput(value){
  const kInput = document.createElement("input");
  kInput.setAttribute("type", "number");
  let max = evenlyDistributedMaxK();
  kInput.setAttribute("max", max);
  kInput.setAttribute("min", -max);
  kInput.setAttribute("value", value);
  kInput.classList.add("k-input");
  return kInput;
}

const THETA_STEP = Math.PI / 10;

function initThetaInput(value){
  const slider = document.createElement("input");
  slider.classList.add("theta-input");
  slider.setAttribute("type", "number");
  slider.setAttribute("max", APP.angleMeasurement === "radian" ? 2*Math.PI : 360);
  slider.setAttribute("min", 0);
  slider.setAttribute("value", value);
  slider.setAttribute("step", THETA_STEP * (APP.angleMeasurement === "radian" ? 1 : 180 / Math.PI));
  return slider;
}

function initThetaSlider(value){
  const slider = document.createElement("input");
  slider.classList.add("theta-slider", "slider");
  slider.setAttribute("type", "range");
  slider.setAttribute("max", APP.angleMeasurement === "radian" ? 2*Math.PI : 360);
  slider.setAttribute("min", 0);
  slider.setAttribute("value", value);
  slider.setAttribute("step", THETA_STEP * (APP.angleMeasurement === "radian" ? 1 : 180 / Math.PI));
  return slider;
}

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
    rotationPlane.classList.add("rotation-plane", plane);

    const planeHeader = document.createElement("div");
    planeHeader.classList.add("plane-header");

    const planeSpan = document.createElement("span");
    planeSpan.innerHTML = `${plane.toUpperCase()}`;
    planeHeader.appendChild(planeSpan);

    const thetaInput = initThetaInput(rotationState.angle);
    planeHeader.appendChild(thetaInput);

    const kInput = initKInput(rotationState.k);
    planeHeader.appendChild(kInput);

    rotationPlane.appendChild(planeHeader);
    
    // let omegaSymbol = "\u03C9";
    // kBtn.innerHTML = `${plane.toUpperCase()} | x${rotationState.k} | `;

    const slider = initThetaSlider(rotationState.angle);
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
  while(value < 0) value += 2*Math.PI;
  while(value > 2*Math.PI) value -= 2*Math.PI;
  return value;
}

function updateThetaValue(input, index, theta){
  let angle = arg(APP.angleMeasurement === "radian" ? input.value*1 : input.value * Math.PI / 180);
  input.value = APP.angleMeasurement === "radian" ? angle : angle * 180 / Math.PI;
  theta[index] = angle;
  APP.theta = theta;
  APP.initialTime = Date.now();

  RENDER_FUNCS.setAbsoluteTheta(APP, APP.theta); // R0 · v0
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
        sliderEl.value = APP.angleMeasurement === "radian" ? APP.theta[i] : APP.theta[i] * 180 / Math.PI;
      }
      if (inputEl && document.activeElement !== inputEl) {
        inputEl.value = APP.angleMeasurement === "radian" ? APP.theta[i] : APP.theta[i] * 180 / Math.PI; 
      }
    });
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

function convertToDisplay(radians) {
  return APP.angleMeasurement === "degree" ? radians * 180 / Math.PI : radians;
}

function refreshThetaControlsForUnit() {
  const isDegree = APP.angleMeasurement === "degree";
  const max = isDegree ? 360 : 2 * Math.PI;
  const step = isDegree ? 18 : THETA_STEP; // step coerente con l'unità

  APP.planes.forEach((plane, i) => {
    const sliderEl = document.querySelector(`.rotation-plane.${plane} .theta-slider`);
    if (sliderEl) {
      sliderEl.max = max;
      sliderEl.step = step;
      sliderEl.value = convertToDisplay(APP.theta[i]);
    }

    const inputEl = document.querySelector(`.rotation-plane.${plane} .theta-input`);
    if (inputEl) {
      inputEl.step = step;
      inputEl.value = convertToDisplay(APP.theta[i]);
    }
  });
}

function setRadianBtn(handler){
  const radianBtn = handler.dropmenu.querySelector(".radian-btn");
  const degreeBtn = handler.dropmenu.querySelector(".degree-btn");

  radianBtn.addEventListener("click", ()=>{
    radianBtn.classList.add("active");
    degreeBtn.classList.remove("active");
    
    APP.angleMeasurement = "radian";

    refreshThetaControlsForUnit()
  });
}

function setDegreeBtn(handler){
  const radianBtn = handler.dropmenu.querySelector(".radian-btn");
  const degreeBtn = handler.dropmenu.querySelector(".degree-btn");

  degreeBtn.addEventListener("click", ()=>{
    radianBtn.classList.remove("active");
    degreeBtn.classList.add("active");

    APP.angleMeasurement = "degree";

    refreshThetaControlsForUnit();
  });
}

function setTools(handler){
  setRandomRotationBtn(handler);
  setClearRotationsBtn(handler);
  setRadianBtn(handler);
  setDegreeBtn(handler);
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
function setCrossSectionHyperplane(dropmenu){
  APP.crossSectionMode.hyperplaneNormal = new Array(APP.dimensions).fill(1.0);
  APP.crossSectionMode.hyperplaneOffset = 0.0;
  const hyperplane = dropmenu.querySelector(".cross-section-mode .hyperplane");
  hyperplane.innerHTML = "";
  for(let i = 0; i < APP.dimensions; i++){
      const input = document.createElement("input");
      input.type = "number";
      input.value = 1.00;
      input.step = 0.01;
      input.addEventListener("input", () => {
          const inputs = hyperplane.querySelectorAll("input:not(.offset)");
          const normal = Array.from(inputs).map((input) => parseFloat(input.value));
          APP.crossSectionMode.hyperplaneNormal = normal;
          updateAndRender();
      });
      hyperplane.appendChild(input);
      const span = document.createElement("span");
      span.innerHTML = AXIS_IDENTIFIERS[i] + " + ";
      hyperplane.appendChild(span);
  }
  const offsetInput = document.createElement("input");
  offsetInput.classList.add("offset");
  offsetInput.type = "number";
  offsetInput.value = 0.00;
  offsetInput.step = 0.01;
  offsetInput.addEventListener("input", () => {
      APP.crossSectionMode.hyperplaneOffset = parseFloat(offsetInput.value);
      updateAndRender();
  });
  hyperplane.appendChild(offsetInput);
  const offsetSpan = document.createElement("span");
  offsetSpan.innerHTML = " = 0";
  hyperplane.appendChild(offsetSpan);
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
}

addWindowEvents();
addGuiHandlers();
