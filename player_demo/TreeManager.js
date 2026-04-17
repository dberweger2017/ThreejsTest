import * as THREE from 'https://esm.sh/three@0.165.0';
import { GLTFLoader } from 'https://esm.sh/three@0.165.0/examples/jsm/loaders/GLTFLoader.js';

export class TreeManager {
    constructor(scene) {
        this.scene = scene;
        this.treeModel = null;
        this.treeYOffset = 0;
        this.trees = new Map(); // chunkKey -> tree objects
        this.chunksPopulated = new Set();
        
        // Settings
        this.chunkSize = 30;
        this.spawnRadius = 100; // Increased due to larger trees
        this.removeRadius = 150; 
        this.baseScale = 6.66; // 2x the previous 3.33x

        this._loadModel();
    }

    _loadModel() {
        const loader = new GLTFLoader();
        loader.load('../loading/minecraft_tree.glb', (gltf) => {
            this.treeModel = gltf.scene;
            
            // Calculate vertical offset to make tree sit on the floor
            const box = new THREE.Box3().setFromObject(this.treeModel);
            this.treeYOffset = -box.min.y;

            this.treeModel.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        });
    }

    update(playerPos) {
        if (!this.treeModel) return;

        const px = playerPos.x;
        const pz = playerPos.z;

        const startX = Math.floor((px - this.spawnRadius) / this.chunkSize);
        const endX = Math.floor((px + this.spawnRadius) / this.chunkSize);
        const startZ = Math.floor((pz - this.spawnRadius) / this.chunkSize);
        const endZ = Math.floor((pz + this.spawnRadius) / this.chunkSize);

        for (let x = startX; x <= endX; x++) {
            for (let z = startZ; z <= endZ; z++) {
                const key = `${x},${z}`;
                if (!this.chunksPopulated.has(key)) {
                    this.chunksPopulated.add(key);
                    this._spawnChunk(x, z);
                }
            }
        }

        this._cleanup(px, pz);
    }

    _spawnChunk(cx, cz) {
        // Spawn 0 to 4 trees in this chunk
        const count = Math.floor(Math.random() * 5);
        const chunkTrees = [];
        
        for (let i = 0; i < count; i++) {
            const tree = this.treeModel.clone();
            
            // Re-verify shadow casting on the clone
            tree.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            const ox = (Math.random() - 0.5) * this.chunkSize;
            const oz = (Math.random() - 0.5) * this.chunkSize;
            
            const s = (0.8 + Math.random() * 0.4) * this.baseScale;
            tree.scale.set(s, s, s);
            tree.position.set(cx * this.chunkSize + ox, this.treeYOffset * s, cz * this.chunkSize + oz);
            tree.rotation.y = Math.random() * Math.PI * 2;
            
            this.scene.add(tree);
            chunkTrees.push(tree);
        }
        this.trees.set(`${cx},${cz}`, chunkTrees);
    }

    _cleanup(px, pz) {
        for (const key of this.chunksPopulated) {
            const [cx, cz] = key.split(',').map(Number);
            const distSq = Math.pow(cx * this.chunkSize - px, 2) + Math.pow(cz * this.chunkSize - pz, 2);
            
            if (distSq > Math.pow(this.removeRadius, 2)) {
                const chunkTrees = this.trees.get(key);
                if (chunkTrees) {
                    chunkTrees.forEach(t => this.scene.remove(t));
                    this.trees.delete(key);
                }
                this.chunksPopulated.delete(key);
            }
        }
    }
}
