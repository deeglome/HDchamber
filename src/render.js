import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Define vertices (x, y, z)
const vertices = new Float32Array([
    -1, -1, 1,
    -1, 1, -1,  
    1, -1, -1,
    -1, 1, 1   
]);

// Define linesegments links (i0, i1)
const indices = new Uint16Array([
    0, 1,
    1, 2,  
    2, 3,
    3, 0
]);

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

