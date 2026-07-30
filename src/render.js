import * as THREE from 'three'
import createGeolib from './geolib.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let GEOLIB;
const THREE_DIMENSIONS = 3;
const CAM_DIST = 3;
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

async function init() {
    GEOLIB = await createGeolib();

    function selectObjGeometry(app){
        switch(app.selectedObj){
            case "Hypercube": return new GEOLIB.Hypercube(app.dimensions, 1.0); break;
            case "Simplex": return new GEOLIB.Simplex(app.dimensions, 1.0); break;
            case "Orthoplex": return new GEOLIB.Orthoplex(app.dimensions, 1.0); break;
            case "LowHypersphere": return new GEOLIB.LowHypersphere(app.dimensions, 1.0, 32); break;
            case "LowHypertorus": return new GEOLIB.LowHypertorus(app.dimensions, 1.0, 0.2, 8, 8); break;
            case "LowHyperspherinder": return new GEOLIB.LowHyperspherinder(app.dimensions, 0.5, 1.0, 16, 6); break;
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

    function createAxes(dimensions, axisLength){
        const axes = new GEOLIB.AxesND(dimensions, axisLength);
        if(dimensions >= THREE_DIMENSIONS){
            axes.projectWithCam(dimensions, CAM_DIST);
        } else {
            axes.extendIn(dimensions);
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

    let cachedObjGeo = null;
    let cachedAxesGeo = null;
    let cachedType = null;
    let cachedDimensions = null;
    let cachedIndices = null;

    const bufGeo = new THREE.BufferGeometry();
    const bufAxes = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({
        color: MAIN_COLOR,
        linewidth: 1
    });

    const axesMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        linewidth: 1
    });

    const mesh = new THREE.LineSegments(bufGeo, material);
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
    oCamera.position.z = CAM_DIST;

    const pCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5);
    pCamera.position.z = CAM_DIST;

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearAlpha(0);
    renderer.domElement.classList.add('renderer');
    document.body.appendChild(renderer.domElement);

    const oControls = new OrbitControls(oCamera, renderer.domElement);
    const pControls = new OrbitControls(pCamera, renderer.domElement);

    RENDER_FUNCS.updateTHREE = (app) => {
        console.time('cancel')
        cancelAnimationFrame(animationId);
        console.timeEnd('cancel')

        scene.clear();
        scene.add(mesh);

        // It will be computed only if dimension or type has been changed.
        if(app.selectedObj !== cachedType || app.dimensions !== cachedDimensions){
            console.time('cachedGeo')
            cachedObjGeo = selectObjGeometry(app);
            console.timeEnd('cachedGeo')
            cachedAxesGeo = new GEOLIB.AxesND(app.dimensions, AXIS_LEN);
            cachedType = app.selectedObj;
            cachedDimensions = app.dimensions;
            cachedIndices = new Uint16Array(GEOLIB.vectorIToJs(cachedObjGeo.getBufferEdgeIndices()));
        }

        console.time('selectObjGeometry')
        let objGeo = cachedObjGeo;
        console.timeEnd('selectObjGeometry')

        console.time('clone');
        let proj = objGeo.clone();
        console.timeEnd('clone');

        console.log(app.dimensions, THREE_DIMENSIONS)
        if(app.dimensions >= THREE_DIMENSIONS){
            console.time('project')
            proj.projectWithCam(THREE_DIMENSIONS, CAM_DIST);
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
        let indices = cachedIndices;
        console.timeEnd('indices')
        console.time('setIndex')
        bufGeo.setIndex(new THREE.BufferAttribute(indices, 1));
        console.timeEnd('setIndex')

        console.time('set camera and controls')
        let camera = (app.isOrtho) ? oCamera : pCamera;
        let controls = (app.isOrtho) ? oControls : pControls;

        if (app.isOrtho) {
            // Per l'ortografica, zoom nativo = property zoom (coerente con OrbitControls)
            camera.zoom = app.camera.zoom;
            camera.updateProjectionMatrix();
        } else {
            // Per la prospettiva, replica il dolly reale di OrbitControls:
            // sposta la camera lungo la retta target -> camera
            const target = controls.target;
            const direction = camera.position.clone().sub(target).normalize();
            const newDistance = CAM_DIST / app.camera.zoom;
            camera.position.copy(target).add(direction.multiplyScalar(newDistance));
        }
        console.timeEnd('set camera and controls')

        function error(val, ref){
            return Math.abs(val - ref) / ref;
        }

        let dt = 0.1;
        let d_theta = app.omega.map(o => o * dt);
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

            app.finalTime = Date.now();
            let next_dt = app.deltaTime() / 1000;

            if(error(next_dt, dt) > 0.20){
                console.log("Aggiorno dR!");
                dt = next_dt;
                d_theta = app.omega.map(o => o * dt);
                dR = R(app.dimensions, app.planes, d_theta);
            }

            objGeo.transform(dR);
            app.initialTime = app.finalTime;
        
            proj = objGeo.clone();

            if(app.dimensions >= THREE_DIMENSIONS)
                proj.projectWithCam(THREE_DIMENSIONS, CAM_DIST);
            else
                proj.extendIn(THREE_DIMENSIONS);
            vertices = new Float32Array(GEOLIB.vectorFToJs(proj.getBufferVerts()));
            
            rotatingAxes.transform(dR);

            let projAxes = rotatingAxes.clone();
            if(app.dimensions >= THREE_DIMENSIONS){
                projAxes.projectWithCam(THREE_DIMENSIONS, CAM_DIST);
            } else {
                projAxes.extendIn(THREE_DIMENSIONS);
            }

            // Geometry
            bufGeo.attributes.position.array.set(vertices);
            bufGeo.attributes.position.needsUpdate = true;

            if(app.axesMode === "rotating"){
                bufAxes.attributes.position.array.set(new Float32Array(GEOLIB.vectorFToJs(projAxes.getBufferVerts())));
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
}

init();

