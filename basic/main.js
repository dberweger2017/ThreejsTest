import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

// 1. Scene
const canvas = document.querySelector('#bg');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0); // light gray

// 2. Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 6);
camera.lookAt(0, 0, 0);

// 3. Renderer
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// 4. Lighting

// Ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// Directional light
const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(5, 8, 5);
directionalLight.castShadow = true;
// Optimize shadow quality
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.left = -10;
directionalLight.shadow.camera.right = 10;
directionalLight.shadow.camera.top = 10;
directionalLight.shadow.camera.bottom = -10;
scene.add(directionalLight);

// Geometry

// Floor
const floorGeometry = new THREE.PlaneGeometry(20, 20);
const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2; // Rotate flat
floor.position.y = -1; // Move slightly down
floor.receiveShadow = true;
scene.add(floor);

// 3D Square (Cube)
const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x0077ff });
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.position.y = 1.5;
cube.castShadow = true;
scene.add(cube);

// UI Slider Interaction
document.getElementById('cubeX').addEventListener('input', (event) => {
    cube.position.x = parseFloat(event.target.value);
});
document.getElementById('cubeY').addEventListener('input', (event) => {
    cube.position.y = parseFloat(event.target.value);
});
document.getElementById('cubeZ').addEventListener('input', (event) => {
    cube.position.z = parseFloat(event.target.value);
});

// Mouse Interaction
let mouseX = 0;
let mouseY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;
const lookTarget = new THREE.Vector3(0, 0, 0);
let isCtrlPressed = false;

document.addEventListener('mousemove', (event) => {
    // Normalize to range [-1, 1]
    mouseX = (event.clientX - windowHalfX) / windowHalfX;
    mouseY = (event.clientY - windowHalfY) / windowHalfY;
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Control') isCtrlPressed = true;
});

document.addEventListener('keyup', (event) => {
    if (event.key === 'Control') isCtrlPressed = false;
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Rotate the cube on two axes to clearly see its 3D shape
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    // Calculate target position based on mouse offsets (only if Control is held)
    const targetX = isCtrlPressed ? mouseX * 5 : 0;
    const targetY = isCtrlPressed ? -mouseY * 5 : 0;

    // Smoothly move the camera's look target
    lookTarget.x += (targetX - lookTarget.x) * 0.05;
    lookTarget.y += (targetY - lookTarget.y) * 0.05;
    camera.lookAt(lookTarget);

    renderer.render(scene, camera);
}

animate();