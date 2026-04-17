import * as THREE from 'https://esm.sh/three@0.165.0';
import { GLTFLoader } from 'https://esm.sh/three@0.165.0/examples/jsm/loaders/GLTFLoader.js';
import { TreeManager } from './TreeManager.js';

const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0);
scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);

// Lighting
const dirLight = new THREE.DirectionalLight(0xffffff, 3);
dirLight.position.set(-50, 100, -50); // High and to the side
dirLight.castShadow = true;

// Shadow Camera Configuration
dirLight.shadow.camera.top = 100;
dirLight.shadow.camera.bottom = -100;
dirLight.shadow.camera.left = -100;
dirLight.shadow.camera.right = 100;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 500;
dirLight.shadow.mapSize.set(2048, 2048); // High res for large trees
dirLight.shadow.bias = -0.0005;

scene.add(dirLight);
scene.add(dirLight.target); // The light needs its target in the scene to move it later

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

// Plane
const planeGeometry = new THREE.PlaneGeometry(100, 100);
const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x55aa55, depthWrite: false });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
scene.add(plane);

// Grid
const grid = new THREE.GridHelper(100, 100, 0x000000, 0x000000);
grid.material.opacity = 0.2;
grid.material.transparent = true;
scene.add(grid);

// Main Camera (Third Person)
const thirdPersonCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
thirdPersonCamera.position.set(0, 5, 10);

// First Person Camera
const firstPersonCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

let player, mixer;
let idleAction, walkAction;
const clock = new THREE.Clock();

const treeManager = new TreeManager(scene);

const loader = new GLTFLoader();

// Load Player
loader.load('../loading/minecraft_player_wide_rigged_with_outer_layer.glb', (gltf) => {
    player = gltf.scene;
    scene.add(player);
    player.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    player.add(firstPersonCamera);
    // Move to approximate head height and slight forward displacement to avoid seeing inside the head mesh.
    firstPersonCamera.position.set(0, 1.6, 0.3);
    firstPersonCamera.rotation.y = Math.PI; // Face the direction of the face.

    if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(player);
        const animations = gltf.animations;

        const idleAnim = animations.find(a => a.name === 'Skeleton|Idle');
        const walkAnim = animations.find(a => a.name === 'Skeleton|Walking');

        if (idleAnim) {
            idleAction = mixer.clipAction(idleAnim);
            idleAction.play();
        }
        if (walkAnim) {
            walkAction = mixer.clipAction(walkAnim);
        }
    }
});

const keys = { w: false, a: false, s: false, d: false, ' ': false };
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase() === ' ' ? ' ' : e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) {
        keys[key] = true;
    }
});
window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase() === ' ' ? ' ' : e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) {
        keys[key] = false;
    }
});

let isWalking = false;
const moveSpeed = 5;
const rotationSpeed = 10;
const jumpStrength = 8;
const gravity = -20;
let velocityY = 0;
let isGrounded = true;

// We define what direction the character should face locally.
let visualOffsetRotation = 0;

function updatePlayer(delta) {
    if (!player) return;

    let moveZ = 0;
    let moveX = 0;

    if (keys.w) moveZ -= 1;
    if (keys.s) moveZ += 1;
    if (keys.a) moveX -= 1;
    if (keys.d) moveX += 1;

    const moving = moveX !== 0 || moveZ !== 0;

    // Animation Logic
    if (moving !== isWalking) {
        isWalking = moving;
        if (isWalking) {
            if (walkAction && idleAction) {
                walkAction.reset().fadeIn(0.2).play();
                idleAction.fadeOut(0.2);
            }
        } else {
            if (walkAction && idleAction) {
                idleAction.reset().fadeIn(0.2).play();
                walkAction.fadeOut(0.2);
            }
        }
    }

    // Horizontal Movement & Rotation
    if (moving) {
        const direction = new THREE.Vector3(moveX, 0, moveZ).normalize();
        const angle = Math.atan2(direction.x, direction.z) + visualOffsetRotation;

        const targetQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        player.quaternion.slerp(targetQ, rotationSpeed * delta);

        const velocity = direction.multiplyScalar(moveSpeed * delta);
        player.position.add(velocity);
    }

    // Vertical Movement (Jump & Gravity)
    if (keys[' '] && isGrounded) {
        velocityY = jumpStrength;
        isGrounded = false;
    }

    velocityY += gravity * delta;
    player.position.y += velocityY * delta;

    // Ground Collision
    if (player.position.y <= 0) {
        player.position.y = 0;
        velocityY = 0;
        isGrounded = true;
    }

    // Third Person Camera behavior
    const cameraTargetPos = new THREE.Vector3(player.position.x, player.position.y + 5, player.position.z + 10);
    thirdPersonCamera.position.lerp(cameraTargetPos, 0.1);
    thirdPersonCamera.lookAt(player.position.x, player.position.y + 1, player.position.z);
}



function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    updatePlayer(delta);
    if (player) {
        treeManager.update(player.position);
        
        // Make the light follow the player for infinite shadows
        const lightOffset = new THREE.Vector3(-50, 100, -50);
        dirLight.position.copy(player.position).add(lightOffset);
        dirLight.target.position.copy(player.position);

        // Make the plane follow the player too
        plane.position.x = player.position.x;
        plane.position.z = player.position.z;
    }

    renderer.setScissorTest(true);

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Viewport 1: Fullscreen Third Person
    renderer.setViewport(0, 0, width, height);
    renderer.setScissor(0, 0, width, height);
    thirdPersonCamera.aspect = width / height;
    thirdPersonCamera.updateProjectionMatrix();
    renderer.render(scene, thirdPersonCamera);

    // Viewport 2: Top-right minimap / First Person Perspective
    const pipWidth = Math.max(200, width * 0.20);
    const pipHeight = pipWidth;
    const padding = 20;

    const pipX = width - pipWidth - padding;
    const pipY = height - pipHeight - padding;

    renderer.setViewport(pipX, pipY, pipWidth, pipHeight);
    renderer.setScissor(pipX, pipY, pipWidth, pipHeight);
    renderer.clearDepth();

    firstPersonCamera.aspect = pipWidth / pipHeight;
    firstPersonCamera.updateProjectionMatrix();
    renderer.render(scene, firstPersonCamera);

    renderer.setScissorTest(false);
}

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
