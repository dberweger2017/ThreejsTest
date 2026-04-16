import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

const canvas = document.querySelector('#bg');
const scene = new THREE.Scene();
scene.background = new THREE.Color('lightblue');

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.z = 8;
camera.position.y = 1;

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 2.5);
light.position.set(5, 5, 5);
light.castShadow = true;
light.shadow.mapSize.width = 1024;
light.shadow.mapSize.height = 1024;
light.shadow.camera.top = 5;
light.shadow.camera.bottom = -5;
light.shadow.camera.left = -5;
light.shadow.camera.right = 5;
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

// Big wireframe cube
const cubeSize = 5;
const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
// Make the cube faces solid but highly transparent so they can catch shadows
const cubeMaterial = new THREE.MeshStandardMaterial({
    color: 0x88ccff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.15
});
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.receiveShadow = true;
scene.add(cube);

// Re-add the crisp wireframe lines as a separate object attached to the cube
const edges = new THREE.EdgesGeometry(cubeGeometry);
const lineMaterial = new THREE.LineBasicMaterial({ color: 0x66bbdd });
const cubeLines = new THREE.LineSegments(edges, lineMaterial);
cube.add(cubeLines);

// 3 Balls inside the cube
const ballRadius = 0.5;
const ballGeometry = new THREE.SphereGeometry(ballRadius, 32, 32);
const colors = [0xff4444, 0x44ff44, 0x4444ff]; // Red, Green, Blue
const balls = [];

for (let i = 0; i < 3; i++) {
    const material = new THREE.MeshStandardMaterial({
        color: colors[i],
        roughness: 0.2,
        metalness: 0.8
    });
    const ball = new THREE.Mesh(ballGeometry, material);
    ball.castShadow = true;
    ball.receiveShadow = true;

    // Start at a random position within the boundary
    const boundary = cubeSize / 2 - ballRadius;
    ball.position.set(
        (Math.random() - 0.5) * boundary * 2,
        (Math.random() - 0.5) * boundary * 2,
        (Math.random() - 0.5) * boundary * 2
    );

    // Initial random velocity
    ball.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1
    );

    // CRITICAL: We make the balls children of the cube!
    // This allows them to inherit the cube's rotation visually,
    // while keeping our collision physics math incredibly simple inside the cube's local space.
    cube.add(ball);
    balls.push(ball);
}

// Physics variables
const worldGravity = new THREE.Vector3(0, -0.015, 0); // Downward force in the world
const bounceFactor = 0.85; // Energy retained after a bounce
const boundary = cubeSize / 2 - ballRadius;

// Mouse Controls
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let angularVelocity = { x: 0.005, y: 0.008 }; // Initial slight spin

window.addEventListener('mousedown', (e) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

window.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        // Convert mouse movement to angular velocity
        angularVelocity.y = deltaX * 0.005;
        angularVelocity.x = deltaY * 0.005;

        previousMousePosition = { x: e.clientX, y: e.clientY };
    }
});

function animate() {
    requestAnimationFrame(animate);

    // Rotate the exterior cube using mouse momentum
    if (!isDragging) {
        // Dampen angular velocity slightly so it naturally slows down if untouched
        angularVelocity.x *= 0.95;
        angularVelocity.y *= 0.95;
    }

    const q = new THREE.Quaternion();
    // Rotate visually in world space around Y and X axes
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angularVelocity.y);
    cube.quaternion.premultiply(q);
    q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), angularVelocity.x);
    cube.quaternion.premultiply(q);

    // Convert world gravity downward vector into the rotating cube's local space.
    // This ensures gravity always pulls "down" relative to the screen, 
    // even though our balls are living in a rotating coordinate system!
    const localGravity = worldGravity.clone().applyQuaternion(cube.quaternion.clone().invert());

    for (const ball of balls) {
        // Apply gravity and velocity in local space
        ball.velocity.add(localGravity);
        ball.position.add(ball.velocity);

        // Simple Axis-Aligned Bounding Box (AABB) collision checks
        ['x', 'y', 'z'].forEach(axis => {
            if (ball.position[axis] > boundary) {
                ball.position[axis] = boundary;
                ball.velocity[axis] *= -bounceFactor;
            } else if (ball.position[axis] < -boundary) {
                ball.position[axis] = -boundary;
                ball.velocity[axis] *= -bounceFactor;
            }
        });
    }

    // Ball-to-ball collision checks
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            const b1 = balls[i];
            const b2 = balls[j];
            const distance = b1.position.distanceTo(b2.position);
            const minDistance = ballRadius * 2;
            
            if (distance < minDistance) {
                // Determine direction of collision between centers
                const normal = b2.position.clone().sub(b1.position).normalize();
                
                // 1. Separate them by resolving overlap so they don't stick
                const overlap = minDistance - distance;
                const separation = normal.clone().multiplyScalar(overlap / 2);
                b1.position.sub(separation);
                b2.position.add(separation);
                
                // 2. Exchange velocity (elastic collision)
                const relVel = b1.velocity.clone().sub(b2.velocity);
                const velAlongNormal = relVel.dot(normal);
                
                // Only resolve if objects are heading toward each other
                if (velAlongNormal > 0) {
                    const restitution = 0.9; // Bounciness between balls
                    const jForce = -(1 + restitution) * velAlongNormal / 2; // Divided by 2 for equal masses
                    
                    const impulse = normal.clone().multiplyScalar(jForce);
                    b1.velocity.add(impulse);
                    b2.velocity.sub(impulse);
                }
            }
        }
    }

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
