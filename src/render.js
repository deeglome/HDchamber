import * as THREE from 'three'
import createGeolib from './geolib.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let GEOLIB;
const THREE_DIMENSIONS = 3
const CAM_DIST = 3
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

    let cachedObjGeo = null;
    let cachedType = null;
    let cachedDimensions = null;

    const bufGeo = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 1
    });

    const mesh = new THREE.LineSegments(bufGeo, material);
    const scene = new THREE.Scene();
    scene.add(mesh);

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
        cancelAnimationFrame(animationId);

        // It will be computed only if dimension or type has been changed.
        if(app.selectedObj !== cachedType || app.dimensions !== cachedDimensions){
            cachedObjGeo = selectObjGeometry(app);
            cachedType = app.selectedObj;
            cachedDimensions = app.dimensions;
            
            const indices = new Uint16Array(GEOLIB.vectorIToJs(cachedObjGeo.getBufferEdgeIndices()));
            bufGeo.setIndex(new THREE.BufferAttribute(indices, 1));
        }

        console.time('selectObjGeometry')
        let objGeo = cachedObjGeo;
        console.timeEnd('selectObjGeometry')

        console.time('clone');
        let proj = objGeo.clone();
        console.timeEnd('clone');

        console.time('project')
        proj.projectWithCam(THREE_DIMENSIONS, CAM_DIST);
        console.timeEnd('project')
        let vertices = new Float32Array(GEOLIB.vectorFToJs(proj.getBufferVerts())); 
        bufGeo.setAttribute('position', new THREE.BufferAttribute(vertices, THREE_DIMENSIONS));

        const indices = new Uint16Array(GEOLIB.vectorIToJs(objGeo.getBufferEdgeIndices()));
        bufGeo.setIndex(new THREE.BufferAttribute(indices, 1));

        let camera = (app.isOrtho) ? oCamera : pCamera;
        let controls = (app.isOrtho) ? oControls : pControls;

        function error(val, ref){
            return Math.abs(val - ref) / ref;
        }

        let dt = 0.1;
        let d_theta = app.omega.map(o => o * dt);
        let dR = R(app.dimensions, app.planes, d_theta);
        app.initialTime = Date.now();

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
            proj.projectWithCam(THREE_DIMENSIONS, CAM_DIST);
            vertices = new Float32Array(GEOLIB.vectorFToJs(proj.getBufferVerts())); 

            // Geometry
            bufGeo.attributes.position.array.set(vertices);
            bufGeo.attributes.position.needsUpdate = true;

            renderer.render(scene, camera);
            animationId = requestAnimationFrame(tic);
        }
        tic();
    }
}

init();

