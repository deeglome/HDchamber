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

    function selectObjGeometry(mesh, dimensions){
        switch(mesh){
            case "Hypercube": return new GEOLIB.Hypercube(dimensions, 1.0); break;
            case "Simplex": return new GEOLIB.Simplex(dimensions, 1.0); break;
            case "Orthoplex": return new GEOLIB.Orthoplex(dimensions, 1.0); break;
            default: throw Error("Invalid input entered:", mesh);
        }
    }

    RENDER_FUNCS.updateTHREE = (appObj, dimensions, isOrtho) => {
        cancelAnimationFrame(animationId);

        let objGeo = selectObjGeometry(appObj, dimensions);
        let indices = new Uint16Array(GEOLIB.vectorIToJs(objGeo.getBufferEdgeIndices()));

        objGeo.projectWithCam(THREE_DIMENSIONS, CAM_DIST);
        let vertices = new Float32Array(GEOLIB.vectorFToJs(objGeo.getBufferVerts())); 

        // Geometry
        const bufGeo = new THREE.BufferGeometry();
        bufGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        bufGeo.setIndex(new THREE.BufferAttribute(indices, 1));

        const material = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 1
        });

        const mesh = new THREE.LineSegments(bufGeo, material);

        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = 2;

        let camera = (isOrtho) ? new THREE.OrthographicCamera(
            -0.5 * frustumSize * aspect,
            0.5 * frustumSize * aspect,
            0.5 * frustumSize,
            -0.5 * frustumSize,
            0.1,
            5
        ) : new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5);

        camera.position.z += 2;

        const scene = new THREE.Scene();
        scene.add(mesh);

        const renderer = new THREE.WebGLRenderer();

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.update();

        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearAlpha(0);

        document.querySelector(".renderer")?.remove();
        renderer.domElement.classList.add('renderer');
        document.body.appendChild(renderer.domElement);

        function tic(){
            controls.update();
            renderer.render(scene, camera);
            animationId = requestAnimationFrame(tic);
        }
        tic();
    }
}

init();

