/**
 * ============================================================================
 * ORB UNIVERSE - Complete Procedural 3D Galaxy Engine
 * Generates layered galaxies, nebulas, starfields, black holes, and wormholes
 * Supports deterministic random seeds, exploration framing, and 6 environments
 * ============================================================================
 */
import * as THREE from 'three';

// Deterministic Pseudo-Random Number Generator (Mulberry32)
class SeededRandom {
    constructor(seed = 123456) {
        this.seed = seed;
    }

    setSeed(seed) {
        this.seed = seed;
    }

    next() {
        let t = (this.seed += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    range(min, max) {
        return min + this.next() * (max - min);
    }
}

export class ProceduralUniverse {
    constructor(scene, camera, audio, effects) {
        this.scene = scene;
        this.camera = camera;
        this.audio = audio;
        this.effects = effects;

        this.rootGroup = new THREE.Group();
        this.scene.add(this.rootGroup);

        this.rng = new SeededRandom(Date.now() % 100000);
        this.currentSeed = this.rng.seed;
        this.isLocked = false;
        this.previousSeed = this.currentSeed;

        // Active Environment: 'spiral' | 'nebula' | 'deepspace' | 'blackhole' | 'wormhole' | 'golden'
        this.currentEnvironment = 'spiral';

        // Animated sub-components
        this.galaxies = [];
        this.starfields = [];
        this.nebulaMeshes = [];
        this.shootingStars = [];
        this.blackHoleDisk = null;
        this.wormholeRings = [];
        this.constellationLines = null;
        this.constellationStars = [];

        // Interactive selectable cosmic objects
        this.selectableObjects = [];
        this.focusedObject = null;
        this.targetCameraPos = null;

        this.buildUniverse();
    }

    setEnvironment(envName) {
        if (this.currentEnvironment === envName && this.rootGroup.children.length > 0) return;
        this.currentEnvironment = envName;
        this.buildUniverse();
    }

    randomize() {
        if (this.isLocked) return;
        this.previousSeed = this.currentSeed;
        this.currentSeed = Math.floor(Math.random() * 999999);
        this.rng.setSeed(this.currentSeed);
        this.buildUniverse();
    }

    restorePrevious() {
        this.currentSeed = this.previousSeed;
        this.rng.setSeed(this.currentSeed);
        this.buildUniverse();
    }

    lockCurrent(locked = true) {
        this.isLocked = locked;
        try {
            if (locked) {
                localStorage.setItem('airdraw_locked_universe', JSON.stringify({
                    seed: this.currentSeed,
                    env: this.currentEnvironment
                }));
            } else {
                localStorage.removeItem('airdraw_locked_universe');
            }
        } catch (e) { }
    }

    clear() {
        while (this.rootGroup.children.length > 0) {
            const child = this.rootGroup.children[0];
            this.rootGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        }
        this.galaxies = [];
        this.starfields = [];
        this.nebulaMeshes = [];
        this.shootingStars = [];
        this.blackHoleDisk = null;
        this.wormholeRings = [];
        this.constellationLines = null;
        this.constellationStars = [];
        this.selectableObjects = [];
        this.focusedObject = null;
    }

    buildUniverse() {
        this.clear();

        // 1. Deep Layered Starfield (Foreground, Midground, Background)
        this.createLayeredStarfields();

        // 2. Cosmic Nebulae & Dust Clouds
        this.createNebulaClouds();

        // 3. Environment Specific Formations
        switch (this.currentEnvironment) {
            case 'nebula':
                this.buildNebulaUniverse();
                break;
            case 'deepspace':
                this.buildDeepSpaceUniverse();
                break;
            case 'blackhole':
                this.buildBlackHoleUniverse();
                break;
            case 'wormhole':
                this.buildWormholeUniverse();
                break;
            case 'golden':
                this.buildGoldenUniverse();
                break;
            case 'spiral':
            default:
                this.buildSpiralUniverse();
                break;
        }

        // 4. Shooting Stars & Meteors
        this.initShootingStars();

        // 5. Interactive Constellations
        this.initConstellations();
    }

    // ========================================================================
    // LAYERED STARFIELDS (3 Depth Tiers)
    // ========================================================================
    createLayeredStarfields() {
        // Deep background stars (dense, subtle, far)
        const bgGeo = new THREE.BufferGeometry();
        const bgCount = 4500;
        const bgPos = new Float32Array(bgCount * 3);
        const bgCol = new Float32Array(bgCount * 3);

        for (let i = 0; i < bgCount; i++) {
            const r = this.rng.range(30, 90);
            const theta = this.rng.next() * Math.PI * 2;
            const phi = Math.acos(this.rng.range(-1, 1));

            bgPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            bgPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            bgPos[i * 3 + 2] = r * Math.cos(phi);

            const hue = this.rng.next() > 0.8 ? 0.6 : (this.rng.next() > 0.5 ? 0.1 : 0.0);
            const color = new THREE.Color().setHSL(hue, 0.4, this.rng.range(0.4, 0.9));
            bgCol[i * 3] = color.r;
            bgCol[i * 3 + 1] = color.g;
            bgCol[i * 3 + 2] = color.b;
        }

        bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
        bgGeo.setAttribute('color', new THREE.BufferAttribute(bgCol, 3));

        const bgMat = new THREE.PointsMaterial({
            size: 0.14,
            vertexColors: true,
            transparent: true,
            opacity: 0.75,
            depthWrite: false
        });
        const bgStars = new THREE.Points(bgGeo, bgMat);
        this.rootGroup.add(bgStars);
        this.starfields.push({ mesh: bgStars, rotSpeed: 0.00015 });

        // Foreground sparkling dust (close, reactive to parallax)
        const fgGeo = new THREE.BufferGeometry();
        const fgCount = 600;
        const fgPos = new Float32Array(fgCount * 3);
        const fgCol = new Float32Array(fgCount * 3);

        for (let i = 0; i < fgCount; i++) {
            fgPos[i * 3] = this.rng.range(-12, 12);
            fgPos[i * 3 + 1] = this.rng.range(-8, 8);
            fgPos[i * 3 + 2] = this.rng.range(-6, 4);

            fgCol[i * 3] = 0.8;
            fgCol[i * 3 + 1] = 0.95;
            fgCol[i * 3 + 2] = 1.0;
        }

        fgGeo.setAttribute('position', new THREE.BufferAttribute(fgPos, 3));
        fgGeo.setAttribute('color', new THREE.BufferAttribute(fgCol, 3));

        const fgMat = new THREE.PointsMaterial({
            size: 0.07,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const fgStars = new THREE.Points(fgGeo, fgMat);
        this.rootGroup.add(fgStars);
        this.starfields.push({ mesh: fgStars, rotSpeed: 0.0003 });
    }

    // ========================================================================
    // COSMIC NEBULA CLOUDS & GLOWING GAS
    // ========================================================================
    createNebulaClouds() {
        const cloudCount = 18;
        const group = new THREE.Group();

        const palette = (this.currentEnvironment === 'golden') ?
            [0xffaa00, 0xff7700, 0xffee66] :
            [0x00ffff, 0x9d00ff, 0xff007f, 0x0088ff];

        for (let i = 0; i < cloudCount; i++) {
            const geo = new THREE.SphereGeometry(this.rng.range(2.5, 6.0), 16, 16);
            const col = palette[Math.floor(this.rng.next() * palette.length)];
            const mat = new THREE.MeshBasicMaterial({
                color: col,
                transparent: true,
                opacity: this.rng.range(0.04, 0.09),
                blending: THREE.AdditiveBlending,
                side: THREE.BackSide,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(
                this.rng.range(-18, 18),
                this.rng.range(-14, 14),
                this.rng.range(-15, -4)
            );
            mesh.scale.set(this.rng.range(1, 2.5), this.rng.range(0.8, 1.8), this.rng.range(1, 2));
            group.add(mesh);
            this.nebulaMeshes.push(mesh);
        }
        this.rootGroup.add(group);
    }

    // ========================================================================
    // 1. SPIRAL GALAXY UNIVERSE (Multiple Galaxies)
    // ========================================================================
    buildSpiralUniverse() {
        // Main Spiral Galaxy (Andromeda-class)
        const mainGalaxy = this.createSpiralGalaxy({
            name: 'Cygnus Prime',
            type: 'Grand Design Spiral',
            position: new THREE.Vector3(0, 0, -1.0),
            starCount: 9500,
            radius: 8.5,
            arms: 3,
            spin: 1.4,
            coreColor: 0xffe0aa,
            armColor: 0x00c8ff,
            rotSpeed: 0.0018
        });
        this.registerSelectable(mainGalaxy, 'Cygnus Prime', 'Grand Design Spiral Galaxy', '2.5M LY', '1.2 Trillion M☉');

        // Satellite Elliptical Galaxy
        const ellipGalaxy = this.createEllipticalGalaxy({
            name: 'Kallisto Dwarf',
            type: 'Elliptical Satellite',
            position: new THREE.Vector3(-6.5, 3.5, -7.0),
            starCount: 3000,
            radius: 3.2,
            coreColor: 0xffffff,
            outerColor: 0xff00aa,
            rotSpeed: -0.001
        });
        this.registerSelectable(ellipGalaxy, 'Kallisto Dwarf', 'Dwarf Elliptical Companion', '2.7M LY', '180 Billion M☉');

        // Irregular Starburst Galaxy (Far background)
        const irregGalaxy = this.createIrregularGalaxy({
            name: 'Vortex IX',
            type: 'Irregular Starburst',
            position: new THREE.Vector3(7.0, -3.2, -10.0),
            starCount: 2200,
            radius: 2.8,
            color: 0x00ff88,
            rotSpeed: 0.0012
        });
        this.registerSelectable(irregGalaxy, 'Vortex IX', 'Starburst Star Cluster', '3.8M LY', '95 Billion M☉');

        // Interactive Exoplanet with Moon
        this.createInteractiveCosmicPlanet(new THREE.Vector3(2.8, 1.6, -1.5), 0x00aaff, 'Exo-Eden VII');
    }

    // ========================================================================
    // 2. NEBULA UNIVERSE (Star Nursery & Glowing Gas Formations)
    // ========================================================================
    buildNebulaUniverse() {
        const nebulaCore = this.createSpiralGalaxy({
            name: 'Orion Nebula Hub',
            type: 'Emission Nebula Complex',
            position: new THREE.Vector3(0, 0, -2.0),
            starCount: 11000,
            radius: 10.0,
            arms: 4,
            spin: 0.9,
            coreColor: 0xff33aa,
            armColor: 0x8800ff,
            rotSpeed: 0.0012
        });
        this.registerSelectable(nebulaCore, 'Orion Nebula Complex', 'Active Stellar Nursery', '1,344 LY', '2,000 M☉');

        // Exoplanets inside nebula
        this.createInteractiveCosmicPlanet(new THREE.Vector3(-3.2, 0.8, -2.0), 0xff00ff, 'Aethelgard (Gas Giant)');
        this.createInteractiveCosmicPlanet(new THREE.Vector3(3.6, -1.2, -2.5), 0x00ffff, 'Zephyria (Ocean World)');
    }

    // ========================================================================
    // 3. DEEP SPACE (Vast Cosmic Web & Quasars)
    // ========================================================================
    buildDeepSpaceUniverse() {
        // Deep field with multiple distant galaxies
        const coords = [
            { pos: new THREE.Vector3(-4.5, -2.5, -8), col: 0x4488ff, name: 'Deep Field Alpha' },
            { pos: new THREE.Vector3(4.8, 3.2, -9), col: 0xffaa44, name: 'Quasar 3C-273' },
            { pos: new THREE.Vector3(-1.0, 4.0, -12), col: 0x00ffaa, name: 'Cluster Hydra-A' },
            { pos: new THREE.Vector3(3.5, -3.8, -14), col: 0xaa44ff, name: 'Centaurus Supercluster' }
        ];

        coords.forEach(c => {
            const g = this.createEllipticalGalaxy({
                name: c.name,
                type: 'Deep Space Entity',
                position: c.pos,
                starCount: 2500,
                radius: 2.5,
                coreColor: 0xffffff,
                outerColor: c.col,
                rotSpeed: 0.0008
            });
            this.registerSelectable(g, c.name, 'Ultra-Deep Cosmos Object', '4.2B LY', '800 Billion M☉');
        });
    }

    // ========================================================================
    // 4. BLACK HOLE UNIVERSE (Gargantuan Singularity & Accretion Disk)
    // ========================================================================
    buildBlackHoleUniverse() {
        const centerPos = new THREE.Vector3(0, 0, -2.0);

        // 1. Black Hole Event Horizon (Pure Black Absorption Sphere)
        const holeGeo = new THREE.SphereGeometry(1.3, 32, 32);
        const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const blackHoleMesh = new THREE.Mesh(holeGeo, holeMat);
        blackHoleMesh.position.copy(centerPos);
        this.rootGroup.add(blackHoleMesh);
        this.registerSelectable(blackHoleMesh, 'Gargantua Singularity', 'Supermassive Kerr Black Hole', '26,000 LY', '4.1 Million M☉');

        // 2. Glowing Relativistic Accretion Disk
        const diskCount = 8500;
        const diskGeo = new THREE.BufferGeometry();
        const diskPos = new Float32Array(diskCount * 3);
        const diskCol = new Float32Array(diskCount * 3);

        for (let i = 0; i < diskCount; i++) {
            const r = this.rng.range(1.4, 6.2);
            const theta = this.rng.next() * Math.PI * 2;
            const thickness = Math.sin(r * 2.0) * 0.12 * (1.0 - (r - 1.4) / 4.8);

            diskPos[i * 3] = r * Math.cos(theta);
            diskPos[i * 3 + 1] = (this.rng.next() - 0.5) * thickness;
            diskPos[i * 3 + 2] = r * Math.sin(theta);

            // Gravitational Doppler shift: hot white/cyan near horizon, orange/red outer
            const heatRatio = 1.0 - (r - 1.4) / 4.8;
            const c = new THREE.Color().setHSL(0.08 + heatRatio * 0.45, 1.0, 0.45 + heatRatio * 0.45);
            diskCol[i * 3] = c.r;
            diskCol[i * 3 + 1] = c.g;
            diskCol[i * 3 + 2] = c.b;
        }

        diskGeo.setAttribute('position', new THREE.BufferAttribute(diskPos, 3));
        diskGeo.setAttribute('color', new THREE.BufferAttribute(diskCol, 3));

        const diskMat = new THREE.PointsMaterial({
            size: 0.12,
            vertexColors: true,
            transparent: true,
            opacity: 0.92,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.blackHoleDisk = new THREE.Points(diskGeo, diskMat);
        this.blackHoleDisk.position.copy(centerPos);
        this.blackHoleDisk.rotation.x = Math.PI / 3.2; // Tilted relativistic perspective
        this.rootGroup.add(this.blackHoleDisk);

        // Gravitational lensing photon ring
        const lensGeo = new THREE.RingGeometry(1.35, 1.6, 64);
        const lensMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending
        });
        const lensMesh = new THREE.Mesh(lensGeo, lensMat);
        lensMesh.position.copy(centerPos);
        this.rootGroup.add(lensMesh);
    }

    // ========================================================================
    // 5. WORMHOLE / PORTAL UNIVERSE (Hyperspace Chromatic Gateway)
    // ========================================================================
    buildWormholeUniverse() {
        const ringCount = 28;
        this.wormholeRings = [];

        for (let i = 0; i < ringCount; i++) {
            const z = -i * 1.2;
            const radius = 2.5 + Math.sin(i * 0.3) * 0.8;
            const geo = new THREE.TorusGeometry(radius, 0.04, 16, 48);
            const hue = (i * 0.06) % 1.0;
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(hue, 1.0, 0.6),
                transparent: true,
                opacity: 0.75 - (i / ringCount) * 0.45,
                blending: THREE.AdditiveBlending
            });
            const ring = new THREE.Mesh(geo, mat);
            ring.position.set(0, 0, z);
            this.rootGroup.add(ring);
            this.wormholeRings.push(ring);
        }

        // Central destination portal
        const portalGeo = new THREE.CircleGeometry(2.0, 32);
        const portalMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending
        });
        const portal = new THREE.Mesh(portalGeo, portalMat);
        portal.position.set(0, 0, -ringCount * 1.2 + 0.1);
        this.rootGroup.add(portal);
        this.registerSelectable(portal, 'Einstein-Rosen Gateway', 'Interdimensional Transit Portal', '0 LY (Instantaneous)', 'Infinite Warp Curvature');
    }

    // ========================================================================
    // 6. GOLDEN UNIVERSE (Radiant Amber Cosmic Realm)
    // ========================================================================
    buildGoldenUniverse() {
        const goldGalaxy = this.createSpiralGalaxy({
            name: 'Aurelia Solar Hub',
            type: 'Radiant Stellar Domain',
            position: new THREE.Vector3(0, 0, -1.5),
            starCount: 10500,
            radius: 8.8,
            arms: 4,
            spin: 1.5,
            coreColor: 0xfff5dd,
            armColor: 0xffaa00,
            rotSpeed: 0.002
        });
        this.registerSelectable(goldGalaxy, 'Aurelia Prime', 'Solar Harmony Supercluster', '1.8M LY', '2.4 Trillion M☉');

        // Gold Exoplanet
        this.createInteractiveCosmicPlanet(new THREE.Vector3(3.2, 0.5, -1.8), 0xffdd44, 'Midas IV (Golden World)');
    }

    // ========================================================================
    // GALAXY BUILDER HELPERS
    // ========================================================================
    createSpiralGalaxy({ name, type, position, starCount, radius, arms, spin, coreColor, armColor, rotSpeed }) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(starCount * 3);
        const col = new Float32Array(starCount * 3);

        const cCore = new THREE.Color(coreColor);
        const cArm = new THREE.Color(armColor);

        for (let i = 0; i < starCount; i++) {
            const idx = i * 3;
            const r = Math.pow(this.rng.next(), 2.0) * radius;
            const spinAngle = r * spin;
            const branchAngle = ((i % arms) / arms) * Math.PI * 2;

            const spread = Math.pow(this.rng.next(), 2.5) * (this.rng.next() < 0.5 ? 1 : -1) * 0.28 * r;
            const spreadY = (this.rng.next() - 0.5) * 0.22 * (radius - r * 0.6);

            pos[idx] = Math.cos(branchAngle + spinAngle) * r + spread;
            pos[idx + 1] = spreadY;
            pos[idx + 2] = Math.sin(branchAngle + spinAngle) * r + spread;

            const t = r / radius;
            const c = cCore.clone().lerp(cArm, t);
            col[idx] = c.r;
            col[idx + 1] = c.g;
            col[idx + 2] = c.b;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.09,
            vertexColors: true,
            transparent: true,
            opacity: 0.88,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const points = new THREE.Points(geo, mat);
        points.position.copy(position);
        this.rootGroup.add(points);
        this.galaxies.push({ mesh: points, rotSpeed });

        return points;
    }

    createEllipticalGalaxy({ name, type, position, starCount, radius, coreColor, outerColor, rotSpeed }) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(starCount * 3);
        const col = new Float32Array(starCount * 3);

        const cCore = new THREE.Color(coreColor);
        const cOuter = new THREE.Color(outerColor);

        for (let i = 0; i < starCount; i++) {
            const u = this.rng.next();
            const v = this.rng.next();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            const r = Math.pow(this.rng.next(), 1.8) * radius;

            pos[i * 3] = r * Math.sin(phi) * Math.cos(theta) * 1.3; // Ellipsoid stretch
            pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.8;
            pos[i * 3 + 2] = r * Math.cos(phi) * 0.9;

            const c = cCore.clone().lerp(cOuter, r / radius);
            col[i * 3] = c.r;
            col[i * 3 + 1] = c.g;
            col[i * 3 + 2] = c.b;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.08,
            vertexColors: true,
            transparent: true,
            opacity: 0.82,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const points = new THREE.Points(geo, mat);
        points.position.copy(position);
        this.rootGroup.add(points);
        this.galaxies.push({ mesh: points, rotSpeed });

        return points;
    }

    createIrregularGalaxy({ name, type, position, starCount, radius, color, rotSpeed }) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(starCount * 3);
        const col = new Float32Array(starCount * 3);
        const baseCol = new THREE.Color(color);

        for (let i = 0; i < starCount; i++) {
            // Chaotic cluster distributions
            const r = Math.pow(this.rng.next(), 1.5) * radius;
            const angle = this.rng.next() * Math.PI * 2;
            pos[i * 3] = Math.cos(angle) * r + (this.rng.next() - 0.5) * 1.5;
            pos[i * 3 + 1] = (this.rng.next() - 0.5) * 1.2;
            pos[i * 3 + 2] = Math.sin(angle) * r + (this.rng.next() - 0.5) * 1.5;

            col[i * 3] = baseCol.r * (0.6 + this.rng.next() * 0.4);
            col[i * 3 + 1] = baseCol.g * (0.6 + this.rng.next() * 0.4);
            col[i * 3 + 2] = baseCol.b * (0.6 + this.rng.next() * 0.4);
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.08,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const points = new THREE.Points(geo, mat);
        points.position.copy(position);
        this.rootGroup.add(points);
        this.galaxies.push({ mesh: points, rotSpeed });

        return points;
    }

    createInteractiveCosmicPlanet(position, colorHex, name) {
        const pGroup = new THREE.Group();
        pGroup.position.copy(position);

        const geo = new THREE.SphereGeometry(0.38, 32, 32);
        const mat = new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity: 0.4,
            roughness: 0.3,
            metalness: 0.4
        });
        const mesh = new THREE.Mesh(geo, mat);
        pGroup.add(mesh);

        // Orbiting Moon
        const moonGeo = new THREE.SphereGeometry(0.09, 16, 16);
        const moonMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8 });
        const moon = new THREE.Mesh(moonGeo, moonMat);
        moon.position.set(0.7, 0, 0);
        pGroup.add(moon);

        this.rootGroup.add(pGroup);
        this.registerSelectable(pGroup, name, 'Habitable Terrestrial Exoplanet', '480 LY', '1.4 Earth Masses');

        this.galaxies.push({ mesh: pGroup, rotSpeed: 0.008, isPlanet: true, moon });
        return pGroup;
    }

    // ========================================================================
    // SHOOTING STARS & METEOR SHOWERS
    // ========================================================================
    initShootingStars() {
        this.shootingStars = [];
        for (let i = 0; i < 4; i++) {
            const geo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(-1.2, -0.6, -0.4)
            ]);
            const mat = new THREE.LineBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending
            });
            const line = new THREE.Line(geo, mat);
            line.visible = false;
            this.rootGroup.add(line);

            this.shootingStars.push({
                mesh: line,
                active: false,
                speed: 0.25,
                timer: this.rng.range(30, 200)
            });
        }
    }

    // ========================================================================
    // CONSTELLATIONS SYSTEM
    // ========================================================================
    initConstellations() {
        this.constellationStars = [];
        const count = 10;
        for (let i = 0; i < count; i++) {
            this.constellationStars.push(new THREE.Vector3(
                this.rng.range(-6, 6),
                this.rng.range(-4, 4),
                this.rng.range(-4, 0)
            ));
        }

        const lines = [];
        for (let i = 0; i < count - 1; i += 2) {
            lines.push(this.constellationStars[i]);
            lines.push(this.constellationStars[i + 1]);
        }

        const geo = new THREE.BufferGeometry().setFromPoints(lines);
        const mat = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.22,
            blending: THREE.AdditiveBlending
        });
        this.constellationLines = new THREE.LineSegments(geo, mat);
        this.rootGroup.add(this.constellationLines);
    }

    // ========================================================================
    // SELECTION & EXPLORATION FRAMING
    // ========================================================================
    registerSelectable(mesh, name, type, dist, mass) {
        this.selectableObjects.push({
            mesh,
            name,
            type,
            distance: dist,
            mass,
            radius: 1.5
        });
    }

    findClosestCosmicObject(rayPoint, threshold = 2.0) {
        let closest = null;
        let minD = Infinity;

        this.selectableObjects.forEach(obj => {
            const d = obj.mesh.position.distanceTo(rayPoint);
            if (d < minD && d < threshold) {
                minD = d;
                closest = obj;
            }
        });

        return closest;
    }

    focusObject(obj) {
        if (!obj) {
            this.focusedObject = null;
            this.targetCameraPos = new THREE.Vector3(0, 0, 5.2);
            return;
        }

        this.focusedObject = obj;
        // Position camera in front of target object
        const targetPos = obj.mesh.position.clone();
        targetPos.z += 2.8;
        this.targetCameraPos = targetPos;

        if (this.audio) this.audio.playShapeMorph();
        if (this.effects) this.effects.spawnShockwave(obj.mesh.position, 0x00ffff, 3.0, 0.5);
    }

    // ========================================================================
    // PER-FRAME ANIMATION & UPDATES
    // ========================================================================
    update(time, dt) {
        // 1. Rotate Galaxies
        this.galaxies.forEach(g => {
            if (g.isPlanet) {
                g.mesh.rotation.y += g.rotSpeed;
                if (g.moon) g.moon.rotation.y += 0.03;
            } else {
                g.mesh.rotation.y += g.rotSpeed;
                g.mesh.rotation.z += g.rotSpeed * 0.3;
            }
        });

        // 2. Starfields slow cosmic drift
        this.starfields.forEach(s => {
            s.mesh.rotation.y += s.rotSpeed;
        });

        // 3. Black Hole Accretion Disk Vortex
        if (this.blackHoleDisk) {
            this.blackHoleDisk.rotation.z += 0.012; // Fast relativistic swirl
        }

        // 4. Wormhole Tunnel Rings Rotation
        this.wormholeRings.forEach((r, idx) => {
            r.rotation.z += 0.008 * (idx % 2 === 0 ? 1 : -1);
        });

        // 5. Shooting Stars Animation
        this.shootingStars.forEach(s => {
            if (!s.active) {
                s.timer--;
                if (s.timer <= 0) {
                    s.active = true;
                    s.mesh.visible = true;
                    s.mesh.position.set(
                        this.rng.range(-8, 8),
                        this.rng.range(2, 6),
                        this.rng.range(-6, -1)
                    );
                    s.mesh.material.opacity = 0.9;
                }
            } else {
                s.mesh.position.x += s.speed * 2.0;
                s.mesh.position.y -= s.speed * 1.0;
                s.mesh.material.opacity -= 0.02;

                if (s.mesh.material.opacity <= 0) {
                    s.active = false;
                    s.mesh.visible = false;
                    s.timer = this.rng.range(60, 240);
                }
            }
        });

        // 6. Camera Focus Framing Interpolation
        if (this.targetCameraPos) {
            this.camera.position.lerp(this.targetCameraPos, 0.06);
            if (this.focusedObject) {
                // Keep looking smoothly at focused object center
                this.camera.lookAt(this.focusedObject.mesh.position);
            }
        }
    }
}
