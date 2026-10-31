/**
 * ============================================================================
 * ORB MODES - 5 Additional Interactive 3D Environments
 * Planet Mode, Galaxy Mode, Atom Mode, Shape Morph Mode, Fidget Mode
 * All running seamlessly on the shared Three.js engine
 * ============================================================================
 */
import * as THREE from 'three';

export class OrbModesManager {
    constructor(scene, camera, audio, effects) {
        this.scene = scene;
        this.camera = camera;
        this.audio = audio;
        this.effects = effects;

        this.currentMode = 'classic'; // 'classic' | 'planet' | 'galaxy' | 'atom' | 'morph' | 'fidget'
        this.modeGroup = new THREE.Group();
        this.scene.add(this.modeGroup);

        // Submode specific instances
        this.planetObjects = [];
        this.galaxyPoints = null;
        this.atomElectrons = [];
        this.morphMesh = null;
        this.fidgetSpheres = [];

        // Morph state
        this.morphShapes = ['sphere', 'cube', 'torus', 'pyramid'];
        this.currentMorphIdx = 0;
        this.morphProgress = 1.0;
        this.morphSourceGeo = null;
        this.morphTargetGeo = null;
    }

    switchMode(modeName) {
        if (this.currentMode === modeName) return;
        this.clearCurrentModeObjects();
        this.currentMode = modeName;

        if (this.audio) this.audio.playShapeMorph();
        if (this.effects) this.effects.spawnShockwave(new THREE.Vector3(0, 0, 0), 0x00ffff, 4.0, 0.5);

        switch (modeName) {
            case 'planet':
                this.initPlanetMode();
                break;
            case 'galaxy':
                this.initGalaxyMode();
                break;
            case 'atom':
                this.initAtomMode();
                break;
            case 'morph':
                this.initShapeMorphMode();
                break;
            case 'fidget':
                this.initFidgetMode();
                break;
            case 'classic':
            default:
                // Classic Orbs Mode (handled by OrbSceneManager)
                break;
        }
    }

    clearCurrentModeObjects() {
        while (this.modeGroup.children.length > 0) {
            const child = this.modeGroup.children[0];
            this.modeGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        }
        this.planetObjects = [];
        this.galaxyPoints = null;
        this.atomElectrons = [];
        this.morphMesh = null;
        this.fidgetSpheres = [];
    }

    // ========================================================================
    // A. PLANET MODE (Miniature Solar System)
    // ========================================================================
    initPlanetMode() {
        // Central Sun
        const sunGeo = new THREE.SphereGeometry(0.85, 32, 32);
        const sunMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            wireframe: false
        });
        const sun = new THREE.Mesh(sunGeo, sunMat);
        const sunLight = new THREE.PointLight(0xffaa00, 2.5, 12);
        sun.add(sunLight);
        this.modeGroup.add(sun);

        // Planets: [Name, Distance, Radius, Color, Speed, HasRing]
        const planetsData = [
            { name: 'Mercury', dist: 1.4, radius: 0.12, color: 0xaaaaaa, speed: 1.8 },
            { name: 'Earth', dist: 2.1, radius: 0.22, color: 0x00aaff, speed: 1.2 },
            { name: 'Mars', dist: 2.8, radius: 0.18, color: 0xff4422, speed: 0.9 },
            { name: 'Jupiter', dist: 3.7, radius: 0.42, color: 0xffbb77, speed: 0.6 },
            { name: 'Saturn', dist: 4.6, radius: 0.35, color: 0xddcc88, speed: 0.45, ring: true }
        ];

        this.planetObjects = planetsData.map(data => {
            // Orbital track ring
            const orbitGeo = new THREE.RingGeometry(data.dist - 0.015, data.dist + 0.015, 64);
            const orbitMat = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.2
            });
            const orbitRing = new THREE.Mesh(orbitGeo, orbitMat);
            orbitRing.rotation.x = Math.PI / 2;
            this.modeGroup.add(orbitRing);

            // Planet Mesh
            const pGeo = new THREE.SphereGeometry(data.radius, 24, 24);
            const pMat = new THREE.MeshStandardMaterial({
                color: data.color,
                emissive: data.color,
                emissiveIntensity: 0.35,
                roughness: 0.5
            });
            const pMesh = new THREE.Mesh(pGeo, pMat);

            // Saturn Ring
            if (data.ring) {
                const sRingGeo = new THREE.RingGeometry(data.radius * 1.4, data.radius * 2.2, 32);
                const sRingMat = new THREE.MeshBasicMaterial({
                    color: 0xccbb88,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.6
                });
                const sRing = new THREE.Mesh(sRingGeo, sRingMat);
                sRing.rotation.x = Math.PI / 2.3;
                pMesh.add(sRing);
            }

            this.modeGroup.add(pMesh);

            return {
                mesh: pMesh,
                dist: data.dist,
                speed: data.speed,
                angle: Math.random() * Math.PI * 2
            };
        });
    }

    // ========================================================================
    // B. GALAXY MODE (Spiral Galaxy Points System)
    // ========================================================================
    initGalaxyMode() {
        const starCount = 8000;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);

        const arms = 3;
        const colorInside = new THREE.Color(0xff6030); // Orange-hot core
        const colorOutside = new THREE.Color(0x1b3984); // Deep space blue

        for (let i = 0; i < starCount; i++) {
            const idx = i * 3;
            // Radius along spiral
            const r = Math.pow(Math.random(), 2.2) * 6.5;
            const spinAngle = r * 1.2;
            const branchAngle = ((i % arms) / arms) * Math.PI * 2;

            const randomX = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 0.3 * r;
            const randomY = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 0.3 * r;
            const randomZ = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 0.3 * r;

            positions[idx] = Math.cos(branchAngle + spinAngle) * r + randomX;
            positions[idx + 1] = randomY;
            positions[idx + 2] = Math.sin(branchAngle + spinAngle) * r + randomZ;

            // Color gradient from center to outer spiral
            const mixedColor = colorInside.clone().lerp(colorOutside, r / 6.5);
            colors[idx] = mixedColor.r;
            colors[idx + 1] = mixedColor.g;
            colors[idx + 2] = mixedColor.b;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.08,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.galaxyPoints = new THREE.Points(geo, mat);
        this.modeGroup.add(this.galaxyPoints);
    }

    // ========================================================================
    // C. ATOM MODE (Interactive Atomic Model)
    // ========================================================================
    initAtomMode() {
        // Glowing Nucleus
        const nucGroup = new THREE.Group();
        const nucGeo = new THREE.SphereGeometry(0.2, 16, 16);
        const redMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
        const blueMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

        // Cluster of nucleons
        for (let i = 0; i < 8; i++) {
            const m = new THREE.Mesh(nucGeo, (i % 2 === 0) ? redMat : blueMat);
            m.position.set(
                (Math.random() - 0.5) * 0.35,
                (Math.random() - 0.5) * 0.35,
                (Math.random() - 0.5) * 0.35
            );
            nucGroup.add(m);
        }
        this.modeGroup.add(nucGroup);

        // 3 Elliptical Electron Orbits
        const orbitTilts = [
            new THREE.Euler(0, 0, 0),
            new THREE.Euler(Math.PI / 3, Math.PI / 4, 0),
            new THREE.Euler(-Math.PI / 3, -Math.PI / 4, 0)
        ];

        this.atomElectrons = orbitTilts.map((euler, idx) => {
            // Orbital track
            const curve = new THREE.EllipseCurve(0, 0, 2.2, 1.4, 0, Math.PI * 2, false, 0);
            const points = curve.getPoints(64);
            const ringGeo = new THREE.BufferGeometry().setFromPoints(points);
            const ringMat = new THREE.LineBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.35,
                blending: THREE.AdditiveBlending
            });
            const orbitRing = new THREE.Line(ringGeo, ringMat);
            orbitRing.rotation.copy(euler);
            this.modeGroup.add(orbitRing);

            // Fast Electron Sphere
            const eleGeo = new THREE.SphereGeometry(0.12, 16, 16);
            const eleMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                blending: THREE.AdditiveBlending
            });
            const electron = new THREE.Mesh(eleGeo, eleMat);
            this.modeGroup.add(electron);

            return {
                mesh: electron,
                euler,
                a: 2.2,
                b: 1.4,
                speed: 3.5 + idx * 0.5,
                angle: idx * 2.0
            };
        });
    }

    // ========================================================================
    // D. SHAPE MORPH MODE (Sphere <-> Cube <-> Torus <-> Pyramid)
    // ========================================================================
    initShapeMorphMode() {
        const pointCount = 1800;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(pointCount * 3);
        const col = new Float32Array(pointCount * 3);

        for (let i = 0; i < pointCount; i++) {
            // Initial sphere shape
            const u = Math.random();
            const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            const r = 1.6;

            pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            pos[i * 3 + 2] = r * Math.cos(phi);

            col[i * 3] = 0.0;
            col[i * 3 + 1] = 0.9;
            col[i * 3 + 2] = 1.0;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.09,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });

        this.morphMesh = new THREE.Points(geo, mat);
        this.modeGroup.add(this.morphMesh);

        // Precompute target geometry vertices
        this.morphCache = {
            sphere: this.computeSpherePoints(pointCount),
            cube: this.computeCubePoints(pointCount),
            torus: this.computeTorusPoints(pointCount),
            pyramid: this.computePyramidPoints(pointCount)
        };

        this.currentMorphIdx = 0;
        this.morphProgress = 1.0;
    }

    computeSpherePoints(count) {
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const u = Math.random();
            const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            arr[i * 3] = 1.6 * Math.sin(phi) * Math.cos(theta);
            arr[i * 3 + 1] = 1.6 * Math.sin(phi) * Math.sin(theta);
            arr[i * 3 + 2] = 1.6 * Math.cos(phi);
        }
        return arr;
    }

    computeCubePoints(count) {
        const arr = new Float32Array(count * 3);
        const s = 1.3;
        for (let i = 0; i < count; i++) {
            // Random point on 6 cube faces
            const face = Math.floor(Math.random() * 6);
            const u = (Math.random() - 0.5) * 2 * s;
            const v = (Math.random() - 0.5) * 2 * s;
            if (face === 0) { arr[i * 3] = s; arr[i * 3 + 1] = u; arr[i * 3 + 2] = v; }
            else if (face === 1) { arr[i * 3] = -s; arr[i * 3 + 1] = u; arr[i * 3 + 2] = v; }
            else if (face === 2) { arr[i * 3] = u; arr[i * 3 + 1] = s; arr[i * 3 + 2] = v; }
            else if (face === 3) { arr[i * 3] = u; arr[i * 3 + 1] = -s; arr[i * 3 + 2] = v; }
            else if (face === 4) { arr[i * 3] = u; arr[i * 3 + 1] = v; arr[i * 3 + 2] = s; }
            else { arr[i * 3] = u; arr[i * 3 + 1] = v; arr[i * 3 + 2] = -s; }
        }
        return arr;
    }

    computeTorusPoints(count) {
        const arr = new Float32Array(count * 3);
        const R = 1.3;
        const r = 0.5;
        for (let i = 0; i < count; i++) {
            const u = Math.random() * Math.PI * 2;
            const v = Math.random() * Math.PI * 2;
            arr[i * 3] = (R + r * Math.cos(v)) * Math.cos(u);
            arr[i * 3 + 1] = (R + r * Math.cos(v)) * Math.sin(u);
            arr[i * 3 + 2] = r * Math.sin(v);
        }
        return arr;
    }

    computePyramidPoints(count) {
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const y = Math.random() * 2.2 - 1.1; // -1.1 to +1.1
            const hRatio = (1.1 - y) / 2.2;
            const spread = hRatio * 1.6;
            arr[i * 3] = (Math.random() - 0.5) * 2 * spread;
            arr[i * 3 + 1] = y;
            arr[i * 3 + 2] = (Math.random() - 0.5) * 2 * spread;
        }
        return arr;
    }

    triggerNextMorph() {
        this.currentMorphIdx = (this.currentMorphIdx + 1) % this.morphShapes.length;
        this.morphTargetShape = this.morphShapes[this.currentMorphIdx];
        this.morphProgress = 0.0;
        if (this.audio) this.audio.playShapeMorph();
        if (this.effects) this.effects.spawnShockwave(new THREE.Vector3(0, 0, 0), 0xffaa00, 3.2, 0.6);
    }

    // ========================================================================
    // E. FIDGET MODE (Zen Calming Soft Floating Orbs)
    // ========================================================================
    initFidgetMode() {
        const colors = [0x88eeff, 0xffaacc, 0xffeebb, 0xccaaff, 0xaaffcc];
        this.fidgetSpheres = colors.map((col, idx) => {
            const geo = new THREE.SphereGeometry(0.45 + Math.random() * 0.2, 32, 32);
            const mat = new THREE.MeshStandardMaterial({
                color: col,
                emissive: col,
                emissiveIntensity: 0.45,
                roughness: 0.1,
                metalness: 0.8,
                transparent: true,
                opacity: 0.85
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(
                (idx - 2) * 1.2,
                Math.sin(idx) * 0.6,
                (Math.random() - 0.5) * 1.5
            );
            this.modeGroup.add(mesh);

            return {
                mesh,
                baseY: mesh.position.y,
                phase: idx * 1.2,
                floatSpeed: 0.8 + idx * 0.2
            };
        });
    }

    update(time, dt) {
        switch (this.currentMode) {
            case 'planet':
                this.planetObjects.forEach(p => {
                    p.angle += p.speed * dt * 0.5;
                    p.mesh.position.x = Math.cos(p.angle) * p.dist;
                    p.mesh.position.z = Math.sin(p.angle) * p.dist;
                    p.mesh.rotation.y += 0.02;
                });
                break;

            case 'galaxy':
                if (this.galaxyPoints) {
                    this.galaxyPoints.rotation.y += 0.002;
                }
                break;

            case 'atom':
                this.atomElectrons.forEach(ele => {
                    ele.angle += ele.speed * dt;
                    const lx = Math.cos(ele.angle) * ele.a;
                    const ly = Math.sin(ele.angle) * ele.b;
                    const localPt = new THREE.Vector3(lx, ly, 0).applyEuler(ele.euler);
                    ele.mesh.position.copy(localPt);
                });
                break;

            case 'morph':
                if (this.morphMesh) {
                    this.morphMesh.rotation.y += 0.005;
                    this.morphMesh.rotation.x += 0.003;

                    if (this.morphProgress < 1.0) {
                        this.morphProgress = Math.min(1.0, this.morphProgress + dt * 1.5);
                        const targetArr = this.morphCache[this.morphTargetShape];
                        const posAttr = this.morphMesh.geometry.attributes.position;
                        const posArr = posAttr.array;

                        for (let i = 0; i < posArr.length; i++) {
                            posArr[i] = THREE.MathUtils.lerp(posArr[i], targetArr[i], 0.15);
                        }
                        posAttr.needsUpdate = true;
                    }
                }
                break;

            case 'fidget':
                this.fidgetSpheres.forEach(f => {
                    f.mesh.position.y = f.baseY + Math.sin(time * f.floatSpeed + f.phase) * 0.25;
                    f.mesh.rotation.y += 0.005;
                });
                break;
        }
    }
}
