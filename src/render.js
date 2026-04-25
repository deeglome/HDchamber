import * as THREE from 'three'
import createGeolib from './geolib.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let GEOLIB;
const THREE_DIMENSIONS = 3
const CAM_DIST = 3

async function init() {
    GEOLIB = await createGeolib();
    let cube = new GEOLIB.Hypercube(4, 1.0);
    let indices = new Uint16Array(GEOLIB.vectorIToJs(cube.getBufferEdgeIndices()));

    cube.projectWithCam(THREE_DIMENSIONS, CAM_DIST);
    let vertices = new Float32Array(GEOLIB.vectorFToJs(cube.getBufferVerts())); 

    console.log(vertices, indices)

    // Geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    const material = new THREE.LineBasicMaterial({
        color: 0x00ff00,
        linewidth: 1
    });

    const mesh = new THREE.LineSegments(geometry, material);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10);
    camera.position.set(2, 3, -1);
    camera.lookAt(mesh.position);

    const scene = new THREE.Scene();
    scene.add(mesh);

    const renderer = new THREE.WebGLRenderer();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.update();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearAlpha(0);
    renderer.domElement.classList.add('renderer');
    document.body.appendChild(renderer.domElement);

    function tic(){
        renderer.render(scene, camera);
        requestAnimationFrame(tic);
    }
    tic();
}

init();

