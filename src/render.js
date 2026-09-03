import * as THREE from 'three'
import { MathUtils } from 'three';
import createGeolib from './geolib.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { degToRad, lerp, radToDeg } from 'three/src/math/MathUtils.js';

let GEOLIB;
export const THREE_DIMENSIONS = 3;
const CAM_DIST = 3;
const DFT_THETA = 30;
const DFT_PHI = 60 /* Math.atan(Math.SQRT2);
/* const THETA = Math.PI / 6;
const PHI = Math.PI/3 /* Math.atan(Math.SQRT2);
const hypersphericals = [THETA, PHI, 0, 0, 0]; // Vettore delle coordinate ipersferiche (salvo rho) che descrivono univocamente la posizione della camera nello spazio nD.
*/
const MAIN_COLOR = 0x88ffdd;
const AXIS_LEN = 2;
const AXES_PALETTE = [
    0x0000ff,
    0xff0000,
    0x00ff00,
    0xff00ff,
    0xf0f000,
    0xffbbaa
];
export const RENDER_FUNCS = {};
let animationId;

let onCameraChange = () => {}; // no-op di default

RENDER_FUNCS.setOnCameraChange = (callback) => {
    onCameraChange = callback;
};

async function init() {
    GEOLIB = await createGeolib();

    function selectObjGeometry(app){
        switch(app.selectedObj){
            case "Hypercube": return new GEOLIB.Hypercube(app.dimensions, 1.0); break;
            case "Simplex": return new GEOLIB.Simplex(app.dimensions, 1.0); break;
            case "Orthoplex": return new GEOLIB.Orthoplex(app.dimensions, 1.0); break;
            case "Hypersphere": return new GEOLIB.Hypersphere(app.dimensions, GEOLIB.JsToVectorF(Array(app.dimensions).fill(0/*.5*/)), 1.0, Math.pow(2, 7-app.dimensions)); break;
            case "LowHypersphere": return new GEOLIB.LowHypersphere(app.dimensions, 1.0, 32); break;
            case "Hypertorus": return GEOLIB.hypertorus(app.dimensions, 1.5, 0.5, Math.pow(2, 7-app.dimensions), Math.pow(2, 6-app.dimensions));
            case "LowHypertorus": return new GEOLIB.LowHypertorus(app.dimensions, 1.0, 0.2, 8, 8); break;
            case "Hyperspherinder": return GEOLIB.hyperspherinder(app.dimensions, 0.5, 1.0, Math.pow(2, 7-app.dimensions)); break;
            case "LowHyperspherinder": return new GEOLIB.LowHyperspherinder(app.dimensions, 0.5, 1.0, 16, 6); break;
            case "Hypercone": return GEOLIB.hypercone(app.dimensions, 0.5, 1.0, Math.pow(2, 7-app.dimensions)); break;
            case "LowHypercone": return new GEOLIB.LowHypercone(app.dimensions, 0.5, 1.0, 16, 6); break;
            default: throw Error("Invalid input entered:", app.selectedObj); break;
        }
    }

    function R(dimensions, planes, angles){
        return GEOLIB.createRotationMatrix(
            dimensions,
            GEOLIB.JsToVectorS(planes),
            GEOLIB.JsToVectorF(angles)
        );
    }

    function toVectorVectorFloat(GEOLIB, arr2d) {
        const outer = new GEOLIB.VectorVectorFloat();
        arr2d.forEach(row => {
            const inner = new GEOLIB.VectorFloat();
            row.forEach(v => inner.push_back(v));
            outer.push_back(inner);
            inner.delete(); // push_back di un vector<T> per valore ne fa una copia in C++: l'oggetto JS temporaneo va liberato manualmente
        });
        return outer;
    }

    function initCamChain(app){
        // Costruisce la catena di camere intermedie da app.dimensions fino a
        // THREE_DIMENSIONS + 1 (4D): l'ultimo passaggio 4D -> 3D resta escluso
        // di proposito, perché è già gestito da app.camera / hypercamR / OrbitControls.
        const hyperspherical_pos_list_js = [];
        app.camChain.forEach(cam => {
            const rad_hyperspherical_pos = cam.hyperspherical_pos.map((t, i) => i!==0 ? degToRad(t) : t);
            hyperspherical_pos_list_js.push(rad_hyperspherical_pos);
        });

        const hyperspherical_pos_list = toVectorVectorFloat(GEOLIB, hyperspherical_pos_list_js);

        console.log("app.dimensions: ", app.dimensions, "THREE_DIMENSIONS", THREE_DIMENSIONS);
        const camChain = GEOLIB.getCamChain(app.dimensions, THREE_DIMENSIONS, hyperspherical_pos_list);

        return camChain;
    }

    const hypersphericalsSlice = (app) => app.camera.hypersphericals.slice(0, app.dimensions - 1);

    function createAxes(dimensions, axisLength){
        const axes = new GEOLIB.AxesND(dimensions, axisLength);
        if(dimensions > THREE_DIMENSIONS){
            axes.renderWithCamChain(cachedCamChain, 0, undefined);
        } else {
            axes.extendIn(THREE_DIMENSIONS);
        }

        let indices = new Uint16Array(GEOLIB.vectorIToJs(axes.getBufferEdgeIndices()));
        let vertices = new Float32Array(GEOLIB.vectorFToJs(axes.getBufferVerts()));
        let colors = generateAxesColors(dimensions);
        return {cppObj: axes, indices, vertices, colors};
    }

    function generateAxesColors(dimensions) {
        const colors = [];
        for (let i = 0; i < dimensions; i++) {
            const color = new THREE.Color().setHex(AXES_PALETTE[i]);
            // ogni asse ha 2 vertici (origine_i, versore_i) → stesso colore per entrambi
            colors.push(color.r, color.g, color.b);
            colors.push(color.r, color.g, color.b);
        }
        return new Float32Array(colors);
    }

    function generateLerpColor(value, col1, col2, col3, min, mid, max) {
        const c1 = new THREE.Color(col1);
        const c2 = new THREE.Color(col2);
        const c3 = new THREE.Color(col3);

        let t;
        let lerpColor = new THREE.Color();

        if (value <= mid && value >= min) {
            t = (mid - min) > 0 ? (value - min) / (mid - min) : 0;
            lerpColor.copy(c1).lerp(c2, t);
        } else {
            t = (max - mid) > 0 ? (value - mid) / (max - mid) : 0;
            lerpColor.copy(c2).lerp(c3, t);
        }
        return lerpColor;
    }

    function generateColorMap(dimensions, ndVerticesRaw, col1, col2, col3, min, mid, max){
        const coord = dimensions - 1;
        const vertexCount = ndVerticesRaw.length / dimensions;
        const colorMap = new Float32Array(vertexCount * 3); // <-- dimensionato correttamente

        for (let i = 0; i < vertexCount; i++) {
            const value = ndVerticesRaw[i * dimensions + coord];
            const c = generateLerpColor(value, col1, col2, col3, min, mid, max);
            colorMap[i * 3]     = c.r;
            colorMap[i * 3 + 1] = c.g;
            colorMap[i * 3 + 2] = c.b;
        }

        return colorMap; // <-- restituisce il buffer, non modifica direttamente bufGeo qui dentro
    }

    function setCameraOnSphere(camera, radius, theta, phi) {
        camera.position.setFromSphericalCoords(radius, phi, theta);
        // camera.lookAt(0, 0, 0); ridondante se poi chiami controls.update()
    }

    RENDER_FUNCS.setCameraSpherical = (app, radius, theta, phi) => {
        const camera = app.isOrtho ? oCamera : pCamera;
        const controls = app.isOrtho ? oControls : pControls;

        app.camChain.at(-1).hyperspherical_pos[0] = radius;
        app.camera.zoom = CAM_DIST / radius;
        app.camChain.at(-1).hyperspherical_pos[1] = theta;
        app.camChain.at(-1).hyperspherical_pos[2] = phi;

        setCameraOnSphere(camera, radius, theta, phi);
        controls.update();

        onCameraChange(); // notifica chi ha registrato il callback, senza sapere chi è
    };

    let cachedObjGeo = null;
    let pristineObjGeo = null;
    let cachedAxesGeo = null;
    let pristineAxesGeo = null;
    let cachedType = null;
    let cachedDimensions = null;
    let cachedIndices = null;
    let cachedCamChain = null;
    let cachedCamChainDimensions = null; 

    const bufGeo = new THREE.BufferGeometry();
    const bufAxes = new THREE.BufferGeometry();

    const monochromaticMaterial = new THREE.LineBasicMaterial({
        color: MAIN_COLOR,
        linewidth: 1
    });

    const axesMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        linewidth: 1
    });

    const colorMapMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        linewidth: 1
    });

    const monochromaticMesh = new THREE.LineSegments(bufGeo, monochromaticMaterial);
    const colorMappedMesh = new THREE.LineSegments(bufGeo, colorMapMaterial);
    const scene = new THREE.Scene();

    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 2;
    const oCamera = new THREE.OrthographicCamera(
        -0.5 * frustumSize * aspect,
        0.5 * frustumSize * aspect,
        0.5 * frustumSize,
        -0.5 * frustumSize,
        0.1,
        5
    );
    const pCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 15);

    setCameraOnSphere(oCamera, CAM_DIST, degToRad(DFT_THETA), degToRad(DFT_PHI));
    setCameraOnSphere(pCamera, CAM_DIST, degToRad(DFT_THETA), degToRad(DFT_PHI));

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearAlpha(0);
    renderer.domElement.classList.add('renderer');
    document.body.appendChild(renderer.domElement);

    const oControls = new OrbitControls(oCamera, renderer.domElement);
    const pControls = new OrbitControls(pCamera, renderer.domElement);

    RENDER_FUNCS.setAbsoluteTheta = (app, thetaArray) => {
        if (!pristineObjGeo) return;

        const R0 = R(app.dimensions, app.planes, thetaArray); // usa la stessa R() già esistente
        cachedObjGeo = pristineObjGeo.clone();
        cachedObjGeo.transform(R0);

        // stesso trattamento per gli assi, se vuoi che seguano lo slider
        if (pristineAxesGeo) {
            cachedAxesGeo = pristineAxesGeo.clone();
            cachedAxesGeo.transform(R0);
        }
    };

    RENDER_FUNCS.applyZoom = (app) => {
        const camera = app.isOrtho ? oCamera : pCamera;
        const controls = app.isOrtho ? oControls : pControls;

        if (app.isOrtho) {
            camera.zoom = app.camera.zoom;
            camera.updateProjectionMatrix();
        } else {
            const target = controls.target;
            const direction = camera.position.clone().sub(target).normalize();
            const newDistance = CAM_DIST / app.camera.zoom;
            camera.position.copy(target).add(direction.multiplyScalar(newDistance));
        }
        controls.update();
    };

    RENDER_FUNCS.updateTHREE = (app) => {
        console.time('cancel')
        cancelAnimationFrame(animationId);
        console.timeEnd('cancel')

        scene.clear();

        if(app.dimensions > THREE_DIMENSIONS && app.colorMapMode === "on")
            scene.add(colorMappedMesh);
        else
            scene.add(monochromaticMesh);

        // Ricostruisce la camchain SOLO quando cambia il numero di dimensioni
        // (indipendente dal tipo di mesh selezionato).
        if(app.dimensions > THREE_DIMENSIONS){
            cachedCamChain = initCamChain(app);
            cachedCamChainDimensions = app.dimensions;
            app.camChain.forEach(stage => stage.dirty = true); 
        }

        // It will be computed only if dimension or type has been changed.
        if(app.selectedObj !== cachedType || app.dimensions !== cachedDimensions){
            console.time('cachedGeo')
            pristineObjGeo = selectObjGeometry(app);
            cachedObjGeo = pristineObjGeo.clone();
            console.timeEnd('cachedGeo')
            pristineAxesGeo = new GEOLIB.AxesND(app.dimensions, AXIS_LEN);
            cachedAxesGeo = pristineAxesGeo.clone();
            cachedType = app.selectedObj;
            cachedDimensions = app.dimensions;
            cachedIndices = new Uint16Array(GEOLIB.vectorIToJs(cachedObjGeo.getBufferEdgeIndices()));
        }

        console.time('selectObjGeometry')
        let objGeo = cachedObjGeo;
        console.timeEnd('selectObjGeometry')

        let maxLegendValue;
        if(app.dimensions > THREE_DIMENSIONS){
            maxLegendValue = Math.round(objGeo.maxVertexDist() * 1e3) / 1e3;
            let minLegendSpan = document.querySelector("#min-legend-value");
            let maxLegendSpan = document.querySelector("#max-legend-value");

            minLegendSpan.innerHTML = -maxLegendValue;
            maxLegendSpan.innerHTML = maxLegendValue; 
        }   

        console.time('clone');
        let proj = objGeo.clone();
        let indices = cachedIndices;
        console.timeEnd('clone');

        if(app.crossSectionMode.status !== "off"){
            console.log("Normal vector:", app.crossSectionMode.hyperplaneNormal);
            const nVector = GEOLIB.JsToVectorF(app.crossSectionMode.hyperplaneNormal);
            const d = app.crossSectionMode.hyperplaneOffset;
            if(app.crossSectionMode.status === "absolute")
                proj = proj.getAbsoluteCrossSection(nVector, d);
            else if(app.crossSectionMode.status === "relative")
                proj = proj.getRelativeCrossSection(nVector, d);
            indices = new Uint16Array(GEOLIB.vectorIToJs(proj.getBufferEdgeIndices()));
        }

        console.log(app.dimensions, THREE_DIMENSIONS)
        if(app.dimensions > THREE_DIMENSIONS){
            console.time('project')
            proj.renderWithCamChain(cachedCamChain, 0, undefined);
            console.timeEnd('project')
        } else {
            proj.extendIn(THREE_DIMENSIONS);
        }

        console.time('vertices')
        let vertices = new Float32Array(GEOLIB.vectorFToJs(proj.getBufferVerts())); 
        console.timeEnd('vertices')
        console.time('setVertices')
        bufGeo.setAttribute('position', new THREE.BufferAttribute(vertices, THREE_DIMENSIONS));
        console.timeEnd('setVertices')

        console.time('indices')
        
        console.timeEnd('indices')
        console.time('setIndex')
        bufGeo.setIndex(new THREE.BufferAttribute(indices, 1));
        console.timeEnd('setIndex')

        console.time('set camera and controls')
        let camera = (app.isOrtho) ? oCamera : pCamera;
        let controls = (app.isOrtho) ? oControls : pControls;

        if (app.isOrtho) {
            // Per l'ortografica, zoom nativo = property zoom (coerente con OrbitControls)
             // sincronizza prima lo stato con lo zoom reale impostato da OrbitControls
            app.camera.zoom = camera.zoom;
            camera.updateProjectionMatrix();
        } else {
            const target = controls.target;
            const currentDistance = camera.position.distanceTo(target);
            app.camera.zoom = CAM_DIST / currentDistance; // solo sync, camera resta dov'è
        }
        console.timeEnd('set camera and controls')

        function error(val, ref){
            return Math.abs(val - ref) / ref;
        }

        function getCameraSpherical(camera) {
            const spherical = new THREE.Spherical();
            spherical.setFromVector3(camera.position);
            return spherical; // { radius, phi, theta }
        }

        let dt = 0.1;
        let d_theta = app.omega().map(o => degToRad(o * dt));
        let dR = R(app.dimensions, app.planes, d_theta);
        app.initialTime = Date.now();

        let fixedAxes = createAxes(app.dimensions, AXIS_LEN);
        bufAxes.setAttribute('position', new THREE.BufferAttribute(fixedAxes.vertices, THREE_DIMENSIONS));
        bufAxes.setAttribute('color', new THREE.BufferAttribute(fixedAxes.colors, 3));
        bufAxes.setIndex(new THREE.BufferAttribute(fixedAxes.indices, 1));
        let rotatingAxes = cachedAxesGeo;

        if(app.axesMode !== "off"){    
            const axesMesh = new THREE.LineSegments(bufAxes, axesMaterial);
            scene.add(axesMesh);
        }

        console.time('declare tic()')
        function tic(){
            controls.update();
            const liveSpherical = getCameraSpherical(camera);
            app.camChain.at(-1).hyperspherical_pos[0] = liveSpherical.radius;
            app.camChain.at(-1).hyperspherical_pos[1] = liveSpherical.theta > 0 ? radToDeg(liveSpherical.theta) : radToDeg(liveSpherical.theta) + 360;
            app.camChain.at(-1).hyperspherical_pos[2] = radToDeg(liveSpherical.phi);

            app.finalTime = Date.now();
            let next_dt = app.deltaTime() / 1000;

            if(error(next_dt, dt) > 0.20){
                console.log("Aggiorno dR!");
                dt = next_dt;
                d_theta = app.omega().map(o => degToRad(o * dt));
                dR = R(app.dimensions, app.planes, d_theta);
            }

            // --- SYNC: aggiorna l'angolo assoluto accumulato per ogni piano ---
            const omegas = app.omega();
            for (let i = 0; i < app.theta.length; i++) {
                const updated = (app.theta[i] + omegas[i] * next_dt) % 360;
                app.theta[i] = Math.round((updated < 0 ? updated + 360 : updated) * 1000) / 1000;
            }
            // -----------------------------------------------------------------

            objGeo.transform(dR);
            app.initialTime = app.finalTime;

            if(app.dimensions > THREE_DIMENSIONS) {
                let ndVerticesRaw = new Float32Array(GEOLIB.vectorFToJs(objGeo.getBufferVerts())); // dopo objGeo.transform(dR)
                const colorMap = generateColorMap(app.dimensions, ndVerticesRaw, 0x0000cc, 0xcc00cc, 0xcc0000, -maxLegendValue, 0, maxLegendValue);
                bufGeo.setAttribute('color', new THREE.BufferAttribute(colorMap, 3));
            }
               
            proj = objGeo.clone();

            if(app.crossSectionMode.status !== "off"){
                const nVector = GEOLIB.JsToVectorF(app.crossSectionMode.hyperplaneNormal);
                const d = app.crossSectionMode.hyperplaneOffset;
                if(app.crossSectionMode.status === "absolute")
                    proj = proj.getAbsoluteCrossSection(nVector, d);
                else if(app.crossSectionMode.status === "relative")
                    proj = proj.getRelativeCrossSection(nVector, d);
            }

            const ndRawVertices = new Float32Array(GEOLIB.vectorFToJs(proj.getBufferVerts()));

            if(app.dimensions > THREE_DIMENSIONS)
                proj.renderWithCamChain(cachedCamChain, 0, undefined);
            else
                proj.extendIn(THREE_DIMENSIONS);

            vertices = new Float32Array(GEOLIB.vectorFToJs(proj.getBufferVerts()));

            if(app.crossSectionMode.status !== "off"){
                const newIndices = new Uint16Array(GEOLIB.vectorIToJs(proj.getBufferEdgeIndices()));
                const colorMap = generateColorMap(app.dimensions, ndRawVertices, 0x0000cc, 0xcc00cc, 0xcc0000, -maxLegendValue, 0, maxLegendValue);
                bufGeo.setAttribute('color', new THREE.BufferAttribute(colorMap, 3));
                bufGeo.setAttribute('position', new THREE.BufferAttribute(vertices, THREE_DIMENSIONS));
                bufGeo.setIndex(new THREE.BufferAttribute(newIndices, 1));
            } else {
                bufGeo.setAttribute('position', new THREE.BufferAttribute(vertices, THREE_DIMENSIONS));
                bufGeo.attributes.position.needsUpdate = true;
            }
            
            rotatingAxes.transform(dR);

            let projAxes = rotatingAxes.clone();
            if(app.dimensions > THREE_DIMENSIONS){
                projAxes.renderWithCamChain(cachedCamChain, 0, undefined);
            } else {
                projAxes.extendIn(THREE_DIMENSIONS);
            }

            // Geometry
            bufGeo.setAttribute('position', new THREE.BufferAttribute(vertices, THREE_DIMENSIONS));
            bufGeo.attributes.position.needsUpdate = true;

            if(app.axesMode === "rotating"){
                bufAxes.setAttribute('position', new THREE.BufferAttribute(new Float32Array(GEOLIB.vectorFToJs(projAxes.getBufferVerts())), THREE_DIMENSIONS));
                bufAxes.attributes.position.needsUpdate = true;
            }

            renderer.render(scene, camera);
            animationId = requestAnimationFrame(tic);
        }
        console.timeEnd('declare tic()')
        console.time('tic()')
        tic();
        console.timeEnd('tic()')
    }

    RENDER_FUNCS.resizeRenderer = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        const aspect = window.innerWidth / window.innerHeight;
        const frustumHeight = oCamera.top - oCamera.bottom; // o un valore fisso a tua scelta
        oCamera.left = -frustumHeight * aspect / 2;
        oCamera.right = frustumHeight * aspect / 2;
        oCamera.updateProjectionMatrix();
        pCamera.aspect = aspect;
        pCamera.updateProjectionMatrix();
    }
}

init();

