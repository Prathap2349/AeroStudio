/**
 * ============================================================================
 * ORB MODES - Interactive 3D Environments & Procedural Universe Integration
 * Planet Mode (8 planets), Galaxy Mode (Procedural Universe), Atom Mode,
 * Shape Morph Mode, Fidget Mode, and Classic Orbs
 * ============================================================================
 */
import * as THREE from 'three';
import { ProceduralUniverse } from './orb-universe.js';

export class OrbModesManager {
    constructor(scene, camera, audio, effects, sceneManager = null) {
        this.scene = scene;
        this.camera = camera;
        this.audio = audio;
        this.effects = effects;
        this.sceneManager = sceneManager;

        this.currentMode = 'classic'; // 'classic' | 'planet' | 'galaxy' | 'atom' | 'morph' | 'fidget'
        this.modeGroup = new THREE.Group();
        this.scene.add(this.modeGroup);

        // Procedural Universe Engine for Galaxy Mode
        this.universe = new ProceduralUniverse(this.scene, this.camera, this.audio, this.effects);
        this.universe.rootGroup.visible = false;

        // Submode specific instances
        this.planetObjects = [];
        this.sunMesh = null;
        this.atomElectrons = [];
        this.atomNucleus = null;
        this.morphMesh = null;
        this.fidgetSpheres = [];

        // Morph state
        this.morphShapes = ['sphere', 'cube', 'torus', 'pyramid'];
        this.currentMorphIdx = 0;
        this.morphProgress = 1.0;
        this.morphTargetShape = 'sphere';
        this.morphCache = {};

        // Atom speed modifier
        this.atomSpeedFactor = 1.0;
    }

    getUniverse() {
        return this.universe;
    }

    setSceneManager(sceneManager) {
        this.sceneManager = sceneManager;
    }

    switchMode(modeName) {
        if (this.currentMode === modeName && this.modeGroup.children.length > 0) return;
        this.clearCurrentModeObjects();
        this.currentMode = modeName;

        // Classic Orbs (energy spheres) are only visible in 'classic' ("Orbs") mode
        const isClassic = (modeName === 'classic');
        if (this.sceneManager) {
            this.sceneManager.setVisible(isClassic);
        } else if (window.OrbEngine && window.OrbEngine.sceneManager) {
            window.OrbEngine.sceneManager.setVisible(isClassic);
        }

        if (this.audio) this.audio.playShapeMorph();
        if (this.effects) this.effects.spawnShockwave(new THREE.Vector3(0, 0, 0), 0x00ffff, 4.0, 0.5);

        // Handle galaxy universe visibility
        if (modeName === 'galaxy') {
            this.universe.rootGroup.visible = true;
            this.initGalaxyMode();
            this.camera.position.set(0, 3.8, 11.5);
            this.camera.lookAt(0, 0, -1.0);
            if (window.OrbEngine && window.OrbEngine.gestureController) {
                window.OrbEngine.gestureController.currentCameraZ = 11.5;
                window.OrbEngine.gestureController.targetCameraZ = 11.5;
                window.OrbEngine.gestureController.baseCameraZ = 11.5;
            }
        } else {
            this.universe.rootGroup.visible = false;
            this.camera.position.set(0, 0, 5.2);
            this.camera.lookAt(0, 0, 0);
            if (window.OrbEngine && window.OrbEngine.gestureController) {
                window.OrbEngine.gestureController.currentCameraZ = 5.2;
                window.OrbEngine.gestureController.targetCameraZ = 5.2;
                window.OrbEngine.gestureController.baseCameraZ = 5.2;
            }
        }

        switch (modeName) {
            case 'planet':
                this.initPlanetMode();
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
            case 'galaxy':
                // Handled above
                break;
            case 'classic':
            default:
                // Classic Orbs Mode is rendered by OrbSceneManager
                break;
        }

        // Notify HUD of submode change
        if (window.OrbHUD) {
            window.OrbHUD.onSubmodeChanged(modeName);
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
        this.sunMesh = null;
        this.atomElectrons = [];
        this.atomNucleus = null;
        this.morphMesh = null;
        this.fidgetSpheres = [];
    }

    // ========================================================================
    // A. PLANET MODE - Complete 8-Planet Miniature Solar System
    // ========================================================================
    initPlanetMode() {
        // Central Radiant Sun
        const sunGeo = new THREE.SphereGeometry(0.85, 36, 36);
        const sunMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            wireframe: false
        });
        this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
        const sunLight = new THREE.PointLight(0xffaa22, 3.2, 18);
        this.sunMesh.add(sunLight);

        // Solar Corona Glow
        const coronaGeo = new THREE.SphereGeometry(1.05, 24, 24);
        const coronaMat = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.28,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide
        });
        const corona = new THREE.Mesh(coronaGeo, coronaMat);
        this.sunMesh.add(corona);
        this.modeGroup.add(this.sunMesh);

        // Full 8 Planets with astronomical properties
        const planetsData = [
            { name: 'Mercury', dist: 1.45, radius: 0.10, color: 0x999999, speed: 1.8, emissive: 0x222222 },
            { name: 'Venus', dist: 2.0, radius: 0.18, color: 0xe3bb76, speed: 1.4, emissive: 0x443311 },
            { name: 'Earth', dist: 2.65, radius: 0.22, color: 0x2277ff, speed: 1.0, emissive: 0x002255, hasMoon: true },
            { name: 'Mars', dist: 3.3, radius: 0.16, color: 0xdd4422, speed: 0.82, emissive: 0x441100 },
            { name: 'Jupiter', dist: 4.25, radius: 0.46, color: 0xd4a373, speed: 0.55, emissive: 0x332211, bands: true },
            { name: 'Saturn', dist: 5.3, radius: 0.38, color: 0xfaedcd, speed: 0.42, emissive: 0x332b1a, ring: true },
            { name: 'Uranus', dist: 6.25, radius: 0.28, color: 0x80ed99, speed: 0.32, emissive: 0x113322, thinRing: true },
            { name: 'Neptune', dist: 7.15, radius: 0.27, color: 0x4361ee, speed: 0.25, emissive: 0x001144 }
        ];

        this.planetObjects = planetsData.map(data => {
            // Orbital track ring
            const orbitGeo = new THREE.RingGeometry(data.dist - 0.012, data.dist + 0.012, 72);
            const orbitMat = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.18
            });
            const orbitRing = new THREE.Mesh(orbitGeo, orbitMat);
            orbitRing.rotation.x = Math.PI / 2;
            this.modeGroup.add(orbitRing);

            // Planet Mesh
            const pGeo = new THREE.SphereGeometry(data.radius, 28, 28);
            const pMat = new THREE.MeshStandardMaterial({
                color: data.color,
                emissive: data.emissive,
                emissiveIntensity: 0.45,
                roughness: 0.45,
                metalness: 0.2
            });
            const pMesh = new THREE.Mesh(pGeo, pMat);

            let moonMesh = null;
            // Earth's Moon
            if (data.hasMoon) {
                const moonGeo = new THREE.SphereGeometry(data.radius * 0.32, 16, 16);
                const moonMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9 });
                moonMesh = new THREE.Mesh(moonGeo, moonMat);
                pMesh.add(moonMesh);
            }

            // Saturn's Majestic Double Rings
            if (data.ring) {
                const sRingGeo = new THREE.RingGeometry(data.radius * 1.45, data.radius * 2.4, 48);
                const sRingMat = new THREE.MeshBasicMaterial({
                    color: 0xddcc99,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.72
                });
                const sRing = new THREE.Mesh(sRingGeo, sRingMat);
                sRing.rotation.x = Math.PI / 2.3;
                pMesh.add(sRing);
            }

            // Uranus Thin Vertical Ring
            if (data.thinRing) {
                const uRingGeo = new THREE.RingGeometry(data.radius * 1.3, data.radius * 1.65, 32);
                const uRingMat = new THREE.MeshBasicMaterial({
                    color: 0x88eedd,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.45
                });
                const uRing = new THREE.Mesh(uRingGeo, uRingMat);
                uRing.rotation.y = Math.PI / 2;
                pMesh.add(uRing);
            }

            this.modeGroup.add(pMesh);

            return {
                name: data.name,
                mesh: pMesh,
                moon: moonMesh,
                dist: data.dist,
                speed: data.speed,
                angle: Math.random() * Math.PI * 2,
                rotSpeed: 0.015 + Math.random() * 0.015
            };
        });
    }

    // ========================================================================
    // B. GALAXY MODE - Procedural Universe Engine
    // ========================================================================
    initGalaxyMode() {
        if (!this.universe) {
            this.universe = new ProceduralUniverse(this.scene, this.camera, this.audio, this.effects);
        }
        this.universe.rootGroup.visible = true;
    }

    setGalaxyEnvironment(envName) {
        if (this.universe) {
            this.universe.setEnvironment(envName);
        }
    }

    randomizeUniverse() {
        if (this.universe) {
            this.universe.randomize();
        }
    }

    restorePreviousUniverse() {
        if (this.universe) {
            this.universe.restorePrevious();
        }
    }

    lockUniverse(locked = true) {
        if (this.universe) {
            this.universe.lockCurrent(locked);
        }
    }

    // ========================================================================
    // C. ATOM MODE - Dynamic Quantum Atomic Model
    // ========================================================================
    initAtomMode() {
        // Glowing Nucleus Cluster (Protons & Neutrons)
        this.atomNucleus = new THREE.Group();
        const nucGeo = new THREE.SphereGeometry(0.18, 16, 16);
        const protonMat = new THREE.MeshStandardMaterial({
            color: 0xff0055,
            emissive: 0xff0044,
            emissiveIntensity: 0.8
        });
        const neutronMat = new THREE.MeshStandardMaterial({
            color: 0x00d4ff,
            emissive: 0x0088cc,
            emissiveIntensity: 0.8
        });

        for (let i = 0; i < 12; i++) {
            const m = new THREE.Mesh(nucGeo, (i % 2 === 0) ? protonMat : neutronMat);
            const radius = 0.28;
            const phi = Math.acos(-1 + (2 * i) / 12);
            const theta = Math.sqrt(12 * Math.PI) * phi;
            m.position.set(
                radius * Math.cos(theta) * Math.sin(phi),
                radius * Math.sin(theta) * Math.sin(phi),
                radius * Math.cos(phi)
            );
            this.atomNucleus.add(m);
        }

        // Nucleus Energy Field Shell
        const shellGeo = new THREE.SphereGeometry(0.58, 24, 24);
        const shellMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.15,
            wireframe: true
        });
        this.atomNucleus.add(new THREE.Mesh(shellGeo, shellMat));
        this.modeGroup.add(this.atomNucleus);

        // 4 Elliptical Electron Orbits with Quantum Trails
        const orbitConfigs = [
            { euler: new THREE.Euler(0, 0, 0), color: 0x00ffff, a: 2.4, b: 1.5, speed: 4.0 },
            { euler: new THREE.Euler(Math.PI / 3, Math.PI / 4, 0), color: 0xff00ff, a: 2.2, b: 1.3, speed: 4.8 },
            { euler: new THREE.Euler(-Math.PI / 3, -Math.PI / 4, 0), color: 0x00ff88, a: 2.6, b: 1.6, speed: 3.6 },
            { euler: new THREE.Euler(Math.PI / 2, 0, Math.PI / 6), color: 0xffaa00, a: 2.0, b: 1.2, speed: 5.2 }
        ];

        this.atomElectrons = orbitConfigs.map((cfg, idx) => {
            // Orbital track
            const curve = new THREE.EllipseCurve(0, 0, cfg.a, cfg.b, 0, Math.PI * 2, false, 0);
            const points = curve.getPoints(72);
            const ringGeo = new THREE.BufferGeometry().setFromPoints(points);
            const ringMat = new THREE.LineBasicMaterial({
                color: cfg.color,
                transparent: true,
                opacity: 0.38,
                blending: THREE.AdditiveBlending
            });
            const orbitRing = new THREE.Line(ringGeo, ringMat);
            orbitRing.rotation.copy(cfg.euler);
            this.modeGroup.add(orbitRing);

            // Fast Electron Particle
            const eleGeo = new THREE.SphereGeometry(0.12, 16, 16);
            const eleMat = new THREE.MeshBasicMaterial({
                color: cfg.color,
                blending: THREE.AdditiveBlending
            });
            const electron = new THREE.Mesh(eleGeo, eleMat);
            const eleLight = new THREE.PointLight(cfg.color, 1.2, 3);
            electron.add(eleLight);
            this.modeGroup.add(electron);

            return {
                mesh: electron,
                euler: cfg.euler,
                a: cfg.a,
                b: cfg.b,
                speed: cfg.speed,
                angle: idx * 1.5
            };
        });
    }

    setAtomSpeed(factor) {
        this.atomSpeedFactor = Math.max(0.2, Math.min(3.0, factor));
    }

    // ========================================================================
    // D. SHAPE MORPH MODE - High-Density Geometry Morphing
    // ========================================================================
    initShapeMorphMode() {
        const pointCount = 2400;
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
            col[i * 3 + 1] = 0.95;
            col[i * 3 + 2] = 1.0;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.08,
            vertexColors: true,
            transparent: true,
            opacity: 0.92,
            blending: THREE.AdditiveBlending
        });

        this.morphMesh = new THREE.Points(geo, mat);
        this.modeGroup.add(this.morphMesh);

        // Precompute target geometry coordinates
        this.morphCache = {
            sphere: this.computeSpherePoints(pointCount),
            cube: this.computeCubePoints(pointCount),
            torus: this.computeTorusPoints(pointCount),
            pyramid: this.computePyramidPoints(pointCount)
        };

        this.currentMorphIdx = 0;
        this.morphProgress = 1.0;
        this.morphTargetShape = 'sphere';
    }

    computeSpherePoints(count) {
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const u = Math.random();
            const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            arr[i * 3] = 1.65 * Math.sin(phi) * Math.cos(theta);
            arr[i * 3 + 1] = 1.65 * Math.sin(phi) * Math.sin(theta);
            arr[i * 3 + 2] = 1.65 * Math.cos(phi);
        }
        return arr;
    }

    computeCubePoints(count) {
        const arr = new Float32Array(count * 3);
        const s = 1.35;
        for (let i = 0; i < count; i++) {
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
        const R = 1.35;
        const r = 0.52;
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
            const y = Math.random() * 2.4 - 1.2;
            const hRatio = (1.2 - y) / 2.4;
            const spread = hRatio * 1.7;
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
        if (this.effects) this.effects.spawnShockwave(new THREE.Vector3(0, 0, 0), 0xffaa00, 3.5, 0.6);
    }

    // ========================================================================
    // E. FIDGET MODE - Calming Pastel Floating Spheres
    // ========================================================================
    initFidgetMode() {
        const colors = [0x88eeff, 0xffaacc, 0xffeebb, 0xccaaff, 0xaaffcc];
        this.fidgetSpheres = colors.map((col, idx) => {
            const geo = new THREE.SphereGeometry(0.48 + Math.random() * 0.18, 32, 32);
            const mat = new THREE.MeshStandardMaterial({
                color: col,
                emissive: col,
                emissiveIntensity: 0.5,
                roughness: 0.12,
                metalness: 0.85,
                transparent: true,
                opacity: 0.88
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(
                (idx - 2) * 1.25,
                Math.sin(idx) * 0.6,
                (Math.random() - 0.5) * 1.2
            );
            this.modeGroup.add(mesh);

            return {
                mesh,
                baseY: mesh.position.y,
                phase: idx * 1.25,
                floatSpeed: 0.75 + idx * 0.18
            };
        });
    }

    // ========================================================================
    // PER-FRAME UPDATE LOOP
    // ========================================================================
    update(time, dt) {
        switch (this.currentMode) {
            case 'planet':
                if (this.sunMesh) {
                    this.sunMesh.rotation.y += 0.004;
                }
                this.planetObjects.forEach(p => {
                    p.angle += p.speed * dt * 0.45;
                    p.mesh.position.x = Math.cos(p.angle) * p.dist;
                    p.mesh.position.z = Math.sin(p.angle) * p.dist;
                    p.mesh.rotation.y += p.rotSpeed;

                    if (p.moon) {
                        p.moon.position.x = Math.cos(time * 3.0) * 0.45;
                        p.moon.position.z = Math.sin(time * 3.0) * 0.45;
                    }
                });
                break;

            case 'galaxy':
                if (this.universe) {
                    this.universe.update(time, dt);
                }
                break;

            case 'atom':
                if (this.atomNucleus) {
                    this.atomNucleus.rotation.y += 0.015;
                    this.atomNucleus.rotation.x += 0.008;
                }
                this.atomElectrons.forEach(ele => {
                    ele.angle += ele.speed * this.atomSpeedFactor * dt;
                    const lx = Math.cos(ele.angle) * ele.a;
                    const ly = Math.sin(ele.angle) * ele.b;
                    const localPt = new THREE.Vector3(lx, ly, 0).applyEuler(ele.euler);
                    ele.mesh.position.copy(localPt);
                });
                break;

            case 'morph':
                if (this.morphMesh) {
                    this.morphMesh.rotation.y += 0.006;
                    this.morphMesh.rotation.x += 0.003;

                    if (this.morphProgress < 1.0) {
                        this.morphProgress = Math.min(1.0, this.morphProgress + dt * 1.6);
                        const targetArr = this.morphCache[this.morphTargetShape];
                        const posAttr = this.morphMesh.geometry.attributes.position;
                        const posArr = posAttr.array;

                        for (let i = 0; i < posArr.length; i++) {
                            posArr[i] = THREE.MathUtils.lerp(posArr[i], targetArr[i], 0.16);
                        }
                        posAttr.needsUpdate = true;
                    }
                }
                break;

            case 'fidget':
                this.fidgetSpheres.forEach(f => {
                    f.mesh.position.y = f.baseY + Math.sin(time * f.floatSpeed + f.phase) * 0.28;
                    f.mesh.rotation.y += 0.006;
                });
                break;
        }
    }
}
