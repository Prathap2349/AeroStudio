/**
 * ============================================================================
 * ORB UNIVERSE - Procedural 3D Galaxy Engine (AeroStudio)
 * Generates layered galaxies, volumetric nebulae, starfields, black holes,
 * and wormhole gateways with deterministic Mulberry32 PRNG seeds.
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
        this.nebulaPoints = null;
        this.shootingStars = [];
        this.blackHoleDisk = null;
        this.blackHoleCore = null;
        this.wormholeRings = [];
        this.constellationLines = null;
        this.constellationStars = [];

        // Interactive selectable cosmic objects
        this.selectableObjects = [];
        this.focusedObject = null;
        this.targetCameraPos = null;

        // Reusable soft puff texture for nebulae
        this.softPuffTexture = this.createSoftPuffTexture();

        this.buildUniverse();
    }

    createSoftPuffTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
        grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.60)');
        grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.22)');
        grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.05)');
        grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);

        const tex = new THREE.CanvasTexture(canvas);
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        return tex;
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
            const data = JSON.stringify({ seed: this.currentSeed, env: this.currentEnvironment });
            if (locked) {
                localStorage.setItem('aerostudio_locked_universe', data);
                localStorage.setItem('airdraw_locked_universe', data);
            } else {
                localStorage.removeItem('aerostudio_locked_universe');
                localStorage.removeItem('airdraw_locked_universe');
            }
        } catch (e) { }
    }

    // Comprehensive recursive resource disposal to eliminate memory leaks
    disposeHierarchy(obj) {
        if (!obj) return;
        if (obj.children) {
            while (obj.children.length > 0) {
                const child = obj.children[0];
                obj.remove(child);
                this.disposeHierarchy(child);
            }
        }
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m.dispose());
            } else {
                obj.material.dispose();
            }
        }
    }

    clear() {
        while (this.rootGroup.children.length > 0) {
            const child = this.rootGroup.children[0];
            this.rootGroup.remove(child);
            this.disposeHierarchy(child);
        }

        this.galaxies = [];
        this.starfields = [];
        this.nebulaPoints = null;
        this.shootingStars = [];
        this.blackHoleDisk = null;
        this.blackHoleCore = null;
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

        // 2. Cosmic Nebulae & Dust Clouds (Procedural soft particle gas formations)
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
        // Deep background stars (dense, subtle, far away)
        const bgGeo = new THREE.BufferGeometry();
        const bgCount = 4200;
        const bgPos = new Float32Array(bgCount * 3);
        const bgCol = new Float32Array(bgCount * 3);

        for (let i = 0; i < bgCount; i++) {
            const r = this.rng.range(32, 95);
            const theta = this.rng.next() * Math.PI * 2;
            const phi = Math.acos(this.rng.range(-1, 1));

            bgPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            bgPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            bgPos[i * 3 + 2] = r * Math.cos(phi);

            const hue = this.rng.next() > 0.8 ? 0.6 : (this.rng.next() > 0.5 ? 0.12 : 0.0);
            const color = new THREE.Color().setHSL(hue, 0.45, this.rng.range(0.35, 0.85));
            bgCol[i * 3] = color.r;
            bgCol[i * 3 + 1] = color.g;
            bgCol[i * 3 + 2] = color.b;
        }

        bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
        bgGeo.setAttribute('color', new THREE.BufferAttribute(bgCol, 3));

        const bgMat = new THREE.PointsMaterial({
            size: 0.13,
            vertexColors: true,
            transparent: true,
            opacity: 0.72,
            depthWrite: false
        });
        const bgStars = new THREE.Points(bgGeo, bgMat);
        this.rootGroup.add(bgStars);
        this.starfields.push({ mesh: bgStars, rotSpeed: 0.00012 });

        // Foreground sparkling dust (close, responsive to subtle parallax)
        const fgGeo = new THREE.BufferGeometry();
        const fgCount = 500;
        const fgPos = new Float32Array(fgCount * 3);
        const fgCol = new Float32Array(fgCount * 3);

        for (let i = 0; i < fgCount; i++) {
            fgPos[i * 3] = this.rng.range(-14, 14);
            fgPos[i * 3 + 1] = this.rng.range(-9, 9);
            fgPos[i * 3 + 2] = this.rng.range(-7, 5);

            fgCol[i * 3] = 0.85;
            fgCol[i * 3 + 1] = 0.95;
            fgCol[i * 3 + 2] = 1.0;
        }

        fgGeo.setAttribute('position', new THREE.BufferAttribute(fgPos, 3));
        fgGeo.setAttribute('color', new THREE.BufferAttribute(fgCol, 3));

        const fgMat = new THREE.PointsMaterial({
            size: 0.07,
            vertexColors: true,
            transparent: true,
            opacity: 0.82,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const fgStars = new THREE.Points(fgGeo, fgMat);
        this.rootGroup.add(fgStars);
        this.starfields.push({ mesh: fgStars, rotSpeed: 0.00025 });
    }

    // ========================================================================
    // PROCEDURAL COSMIC NEBULA CLOUDS (Soft Gaseous Particulate Formations)
    // Completely replaces old sphere bubbles with authentic organic gas clouds
    // ========================================================================
    createNebulaClouds() {
        // Environment-specific cloud parameters
        let clusterCount = 6;
        let particlesPerCluster = 180;
        let palettes = [];
        let baseOpacity = 0.22;
        let particleSize = 2.4;

        switch (this.currentEnvironment) {
            case 'nebula':
                clusterCount = 8;
                particlesPerCluster = 220;
                baseOpacity = 0.28;
                particleSize = 2.8;
                palettes = [
                    new THREE.Color(0xff0077), // Hot magenta
                    new THREE.Color(0x7928ca), // Deep violet
                    new THREE.Color(0x00d4ff), // Electric cyan
                    new THREE.Color(0x00ffaa)  // Emerald gas
                ];
                break;
            case 'golden':
                clusterCount = 7;
                particlesPerCluster = 190;
                baseOpacity = 0.24;
                particleSize = 2.5;
                palettes = [
                    new THREE.Color(0xffaa00), // Amber gold
                    new THREE.Color(0xff6600), // Solar orange
                    new THREE.Color(0xffee55), // Warm yellow
                    new THREE.Color(0x8b4513)  // Cosmic bronze
                ];
                break;
            case 'deepspace':
                clusterCount = 4;
                particlesPerCluster = 90;
                baseOpacity = 0.12;
                particleSize = 2.0;
                palettes = [
                    new THREE.Color(0x101b3b), // Deep midnight blue
                    new THREE.Color(0x221133), // Dark interstellar violet
                    new THREE.Color(0x004466)  // Cold cyan wisp
                ];
                break;
            case 'blackhole':
                clusterCount = 5;
                particlesPerCluster = 160;
                baseOpacity = 0.20;
                particleSize = 2.2;
                palettes = [
                    new THREE.Color(0xff4400), // Accretion red
                    new THREE.Color(0xff8800), // Doppler orange
                    new THREE.Color(0x0088cc), // Polar jet blue
                    new THREE.Color(0x1a0933)  // Singularity purple
                ];
                break;
            case 'wormhole':
                clusterCount = 6;
                particlesPerCluster = 150;
                baseOpacity = 0.22;
                particleSize = 2.2;
                palettes = [
                    new THREE.Color(0x00ffff), // Hyperspace cyan
                    new THREE.Color(0x8800ff), // Warp violet
                    new THREE.Color(0x00ff88)  // Quantum green
                ];
                break;
            case 'spiral':
            default:
                clusterCount = 6;
                particlesPerCluster = 170;
                baseOpacity = 0.18;
                particleSize = 2.3;
                palettes = [
                    new THREE.Color(0x0b2545), // Deep space blue
                    new THREE.Color(0x0099cc), // Spiral arm cyan
                    new THREE.Color(0x5e239d), // Interstellar purple
                    new THREE.Color(0xcc2277)  // Starburst pink
                ];
                break;
        }

        const totalParticles = clusterCount * particlesPerCluster;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(totalParticles * 3);
        const col = new Float32Array(totalParticles * 3);

        let pIdx = 0;
        for (let c = 0; c < clusterCount; c++) {
            // Cluster center distributed along broad space coordinates
            const cx = this.rng.range(-16, 16);
            const cy = this.rng.range(-10, 10);
            const cz = this.rng.range(-14, -3);

            const clusterCol = palettes[c % palettes.length];
            const clusterSpread = this.rng.range(3.0, 6.5);

            for (let i = 0; i < particlesPerCluster; i++) {
                // Organic Gaussian / exponential scatter around cluster center
                const rad = Math.pow(this.rng.next(), 1.6) * clusterSpread;
                const theta = this.rng.next() * Math.PI * 2;
                const phi = Math.acos(this.rng.range(-1, 1));

                pos[pIdx * 3] = cx + rad * Math.sin(phi) * Math.cos(theta);
                pos[pIdx * 3 + 1] = cy + rad * Math.sin(phi) * Math.sin(theta) * 0.7; // Slightly flattened
                pos[pIdx * 3 + 2] = cz + rad * Math.cos(phi);

                // Organic color nuance within cluster
                const nuance = (this.rng.next() - 0.5) * 0.15;
                col[pIdx * 3] = THREE.MathUtils.clamp(clusterCol.r + nuance, 0, 1);
                col[pIdx * 3 + 1] = THREE.MathUtils.clamp(clusterCol.g + nuance, 0, 1);
                col[pIdx * 3 + 2] = THREE.MathUtils.clamp(clusterCol.b + nuance, 0, 1);

                pIdx++;
            }
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

        const mat = new THREE.PointsMaterial({
            size: particleSize,
            map: this.softPuffTexture,
            vertexColors: true,
            transparent: true,
            opacity: baseOpacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.nebulaPoints = new THREE.Points(geo, mat);
        this.rootGroup.add(this.nebulaPoints);
    }

    // ========================================================================
    // 1. SPIRAL GALAXY UNIVERSE (3D Tilted Cinematic Grand Design Spiral)
    // ========================================================================
    buildSpiralUniverse() {
        // Main Spiral Galaxy (Tilted in 3D space with dark dust lanes)
        const mainGalaxy = this.createSpiralGalaxy({
            name: 'Cygnus Prime',
            type: 'Grand Design Spiral',
            position: new THREE.Vector3(0, 0, -1.0),
            starCount: 9500,
            radius: 8.2,
            arms: 3,
            spin: 1.4,
            tiltX: -Math.PI / 3.4,
            tiltZ: Math.PI / 7,
            coreColor: 0xffe2b8,
            armColor: 0x00c8ff,
            rotSpeed: 0.0016
        });
        this.registerSelectable(mainGalaxy, 'Cygnus Prime', 'Grand Design Spiral Galaxy', '2.5M LY', '1.2 Trillion M☉',
            'Spectacular grand-design spiral galaxy with three luminous arms, dense dark dust lanes, and a vibrant stellar core.');

        // Satellite Elliptical Galaxy
        const ellipGalaxy = this.createEllipticalGalaxy({
            name: 'Kallisto Dwarf',
            type: 'Elliptical Satellite',
            position: new THREE.Vector3(-6.5, 3.5, -7.0),
            starCount: 2800,
            radius: 3.0,
            coreColor: 0xffffff,
            outerColor: 0xff00aa,
            rotSpeed: -0.001
        });
        this.registerSelectable(ellipGalaxy, 'Kallisto Dwarf', 'Dwarf Elliptical Companion', '2.7M LY', '180 Billion M☉',
            'Close companion dwarf galaxy orbiting the primary halo in gravitational resonance.');

        // Irregular Starburst Galaxy (Far background)
        const irregGalaxy = this.createIrregularGalaxy({
            name: 'Vortex IX',
            type: 'Irregular Starburst',
            position: new THREE.Vector3(7.0, -3.2, -10.0),
            starCount: 2000,
            radius: 2.8,
            color: 0x00ff88,
            rotSpeed: 0.0012
        });
        this.registerSelectable(irregGalaxy, 'Vortex IX', 'Starburst Star Cluster', '3.8M LY', '95 Billion M☉',
            'High-velocity starburst cluster experiencing intense proto-star formation.');

        // Interactive Exoplanet with Moon
        this.createInteractiveCosmicPlanet(new THREE.Vector3(2.8, 1.6, -1.5), 0x00aaff, 'Exo-Eden VII');
    }

    // ========================================================================
    // 2. NEBULA UNIVERSE (Star Nursery & Layered Gas Cloud Complex)
    // ========================================================================
    buildNebulaUniverse() {
        const nebulaCore = this.createSpiralGalaxy({
            name: 'Orion Nebula Hub',
            type: 'Emission Nebula Complex',
            position: new THREE.Vector3(0, 0, -2.0),
            starCount: 10500,
            radius: 9.5,
            arms: 4,
            spin: 0.85,
            tiltX: -Math.PI / 4,
            tiltZ: 0.2,
            coreColor: 0xff33aa,
            armColor: 0x7928ca,
            rotSpeed: 0.0011
        });
        this.registerSelectable(nebulaCore, 'Orion Nebula Complex', 'Active Stellar Nursery', '1,344 LY', '2,000 M☉',
            'Vast turbulent emission cloud of ionized interstellar gas giving birth to luminous young open star clusters.');

        // Exoplanets inside nebula
        this.createInteractiveCosmicPlanet(new THREE.Vector3(-3.2, 0.8, -2.0), 0xff00ff, 'Aethelgard (Gas Giant)');
        this.createInteractiveCosmicPlanet(new THREE.Vector3(3.6, -1.2, -2.5), 0x00ffff, 'Zephyria (Ocean World)');
    }

    // ========================================================================
    // 3. DEEP SPACE (Vast Cosmic Web & Quasars)
    // ========================================================================
    buildDeepSpaceUniverse() {
        const coords = [
            { pos: new THREE.Vector3(-4.5, -2.5, -8), col: 0x4488ff, name: 'Deep Field Alpha', desc: 'Distant massive galaxy cluster at high cosmic redshift.' },
            { pos: new THREE.Vector3(4.8, 3.2, -9), col: 0xffaa44, name: 'Quasar 3C-273', desc: 'Extremely luminous active galactic nucleus powered by a supermassive black hole.' },
            { pos: new THREE.Vector3(-1.0, 4.0, -12), col: 0x00ffaa, name: 'Cluster Hydra-A', desc: 'Galaxy cluster situated deep in the cosmic filamentary web.' },
            { pos: new THREE.Vector3(3.5, -3.8, -14), col: 0xaa44ff, name: 'Centaurus Supercluster', desc: 'Massive gravitational anomaly drawing surrounding galactic groups.' }
        ];

        coords.forEach(c => {
            const g = this.createEllipticalGalaxy({
                name: c.name,
                type: 'Deep Space Entity',
                position: c.pos,
                starCount: 2200,
                radius: 2.4,
                coreColor: 0xffffff,
                outerColor: c.col,
                rotSpeed: 0.0007
            });
            this.registerSelectable(g, c.name, 'Ultra-Deep Cosmos Object', '4.2B LY', '800 Billion M☉', c.desc);
        });
    }

    // ========================================================================
    // 4. BLACK HOLE UNIVERSE (Gargantuan Singularity & Relativistic Swirl)
    // ========================================================================
    buildBlackHoleUniverse() {
        const centerPos = new THREE.Vector3(0, 0, -2.2);

        // 1. Black Hole Event Horizon (Pure absorption sphere with subtle rim)
        const holeGeo = new THREE.SphereGeometry(1.25, 36, 36);
        const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        this.blackHoleCore = new THREE.Mesh(holeGeo, holeMat);
        this.blackHoleCore.position.copy(centerPos);
        this.rootGroup.add(this.blackHoleCore);
        this.registerSelectable(this.blackHoleCore, 'Gargantua Singularity', 'Supermassive Kerr Black Hole', '26,000 LY', '4.1 Million M☉',
            'Rapidly spinning Kerr black hole with a sharply defined event horizon and extreme gravitational spacetime curvature.');

        // 2. High-speed Relativistic Accretion Disk (Doppler shifted)
        const diskCount = 8000;
        const diskGeo = new THREE.BufferGeometry();
        const diskPos = new Float32Array(diskCount * 3);
        const diskCol = new Float32Array(diskCount * 3);

        for (let i = 0; i < diskCount; i++) {
            const r = this.rng.range(1.35, 6.0);
            const theta = this.rng.next() * Math.PI * 2;
            const thickness = Math.sin(r * 2.2) * 0.10 * (1.0 - (r - 1.35) / 4.65);

            diskPos[i * 3] = r * Math.cos(theta);
            diskPos[i * 3 + 1] = (this.rng.next() - 0.5) * thickness;
            diskPos[i * 3 + 2] = r * Math.sin(theta);

            // Gravitational Doppler shift: blue-hot inner ring to redshifted amber outer edge
            const heat = 1.0 - (r - 1.35) / 4.65;
            const c = new THREE.Color().setHSL(0.08 + heat * 0.48, 1.0, 0.45 + heat * 0.48);
            diskCol[i * 3] = c.r;
            diskCol[i * 3 + 1] = c.g;
            diskCol[i * 3 + 2] = c.b;
        }

        diskGeo.setAttribute('position', new THREE.BufferAttribute(diskPos, 3));
        diskGeo.setAttribute('color', new THREE.BufferAttribute(diskCol, 3));

        const diskMat = new THREE.PointsMaterial({
            size: 0.11,
            vertexColors: true,
            transparent: true,
            opacity: 0.90,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.blackHoleDisk = new THREE.Points(diskGeo, diskMat);
        this.blackHoleDisk.position.copy(centerPos);
        this.blackHoleDisk.rotation.x = Math.PI / 3.3; // Relativistic tilt
        this.rootGroup.add(this.blackHoleDisk);

        // Gravitational lensing photon ring
        const lensGeo = new THREE.RingGeometry(1.30, 1.55, 64);
        const lensMat = new THREE.MeshBasicMaterial({
            color: 0x00e5ff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.60,
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
        const ringCount = 26;
        this.wormholeRings = [];

        for (let i = 0; i < ringCount; i++) {
            const z = -i * 1.25;
            const radius = 2.4 + Math.sin(i * 0.32) * 0.75;
            const geo = new THREE.TorusGeometry(radius, 0.035, 16, 40);
            const hue = (i * 0.07) % 1.0;
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(hue, 1.0, 0.62),
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
        const portalGeo = new THREE.CircleGeometry(2.1, 32);
        const portalMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending
        });
        const portal = new THREE.Mesh(portalGeo, portalMat);
        portal.position.set(0, 0, -ringCount * 1.25 + 0.1);
        this.rootGroup.add(portal);
        this.registerSelectable(portal, 'Einstein-Rosen Gateway', 'Interdimensional Transit Portal', '0 LY (Instantaneous)', 'Infinite Warp Curvature',
            'Folded spacetime bridge connecting two distant regions of the cosmos through a traversable throat.');
    }

    // ========================================================================
    // 6. GOLDEN UNIVERSE (Radiant Amber Cosmic Realm)
    // ========================================================================
    buildGoldenUniverse() {
        const goldGalaxy = this.createSpiralGalaxy({
            name: 'Aurelia Solar Hub',
            type: 'Radiant Stellar Domain',
            position: new THREE.Vector3(0, 0, -1.5),
            starCount: 10000,
            radius: 8.5,
            arms: 4,
            spin: 1.45,
            tiltX: -Math.PI / 3.6,
            tiltZ: 0.3,
            coreColor: 0xfff6e0,
            armColor: 0xffaa00,
            rotSpeed: 0.0018
        });
        this.registerSelectable(goldGalaxy, 'Aurelia Prime', 'Solar Harmony Supercluster', '1.8M LY', '2.4 Trillion M☉',
            'Ancient, high-metallicity stellar supercluster bathed in warm amber and gold radiation from densely clustered stars.');

        // Golden Exoplanet
        this.createInteractiveCosmicPlanet(new THREE.Vector3(3.2, 0.5, -1.8), 0xffdd44, 'Midas IV (Golden World)');
    }

    // ========================================================================
    // GALAXY BUILDER HELPERS
    // ========================================================================
    createSpiralGalaxy({ name, type, position, starCount, radius, arms, spin, tiltX = 0, tiltZ = 0, coreColor, armColor, rotSpeed }) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(starCount * 3);
        const col = new Float32Array(starCount * 3);

        const cCore = new THREE.Color(coreColor);
        const cArm = new THREE.Color(armColor);

        for (let i = 0; i < starCount; i++) {
            const idx = i * 3;
            // Radial distribution with balanced core density (not oversaturated)
            const r = Math.pow(this.rng.next(), 2.1) * radius;
            const spinAngle = r * spin;
            const branchAngle = ((i % arms) / arms) * Math.PI * 2;

            const spread = Math.pow(this.rng.next(), 2.6) * (this.rng.next() < 0.5 ? 1 : -1) * 0.28 * r;
            const spreadY = (this.rng.next() - 0.5) * 0.20 * (radius - r * 0.55);

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
            size: 0.085,
            vertexColors: true,
            transparent: true,
            opacity: 0.88,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const points = new THREE.Points(geo, mat);
        points.position.copy(position);
        if (tiltX !== 0) points.rotation.x = tiltX;
        if (tiltZ !== 0) points.rotation.z = tiltZ;

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
            const r = Math.pow(this.rng.next(), 1.7) * radius;

            pos[i * 3] = r * Math.sin(phi) * Math.cos(theta) * 1.3;
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
            opacity: 0.80,
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
            const r = Math.pow(this.rng.next(), 1.5) * radius;
            const angle = this.rng.next() * Math.PI * 2;
            pos[i * 3] = Math.cos(angle) * r + (this.rng.next() - 0.5) * 1.4;
            pos[i * 3 + 1] = (this.rng.next() - 0.5) * 1.1;
            pos[i * 3 + 2] = Math.sin(angle) * r + (this.rng.next() - 0.5) * 1.4;

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
            opacity: 0.78,
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

        const geo = new THREE.SphereGeometry(0.36, 32, 32);
        const mat = new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity: 0.4,
            roughness: 0.35,
            metalness: 0.35
        });
        const mesh = new THREE.Mesh(geo, mat);
        pGroup.add(mesh);

        // Orbiting Moon
        const moonGeo = new THREE.SphereGeometry(0.08, 16, 16);
        const moonMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8 });
        const moon = new THREE.Mesh(moonGeo, moonMat);
        moon.position.set(0.65, 0.1, 0);
        pGroup.add(moon);

        this.rootGroup.add(pGroup);
        this.galaxies.push({ mesh: pGroup, moon, rotSpeed: 0.015, isPlanet: true });

        this.registerSelectable(pGroup, name, 'Exoplanetary System', '45.2 LY', '3.2 Earth Masses',
            `Terrestrial exoplanet with an active orbiting natural satellite within the habitable zone.`);
    }

    // ========================================================================
    // SHOOTING STARS / METEORS
    // ========================================================================
    initShootingStars() {
        const count = 4;
        this.shootingStars = [];

        for (let i = 0; i < count; i++) {
            const geo = new THREE.BufferGeometry();
            const pos = new Float32Array([0, 0, 0, -1.8, 0.9, 0]);
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

            const mat = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending
            });
            const star = new THREE.Line(geo, mat);
            star.visible = false;
            this.rootGroup.add(star);

            this.shootingStars.push({
                mesh: star,
                active: false,
                speed: 0.4 + this.rng.next() * 0.3,
                timer: this.rng.range(30, 180)
            });
        }
    }

    // ========================================================================
    // CONSTELLATIONS
    // ========================================================================
    initConstellations() {
        const starCount = 7;
        const pts = [];

        for (let i = 0; i < starCount; i++) {
            pts.push(new THREE.Vector3(
                this.rng.range(-6, 6),
                this.rng.range(-4, 4),
                this.rng.range(-7, -4)
            ));
        }

        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.16,
            blending: THREE.AdditiveBlending
        });

        this.constellationLines = new THREE.Line(lineGeo, lineMat);
        this.rootGroup.add(this.constellationLines);
    }

    registerSelectable(mesh, name, type, distance, mass, description = '') {
        this.selectableObjects.push({
            mesh,
            name,
            type,
            distance,
            mass,
            description,
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
            // Return to optimal overview camera vantage point
            this.targetCameraPos = new THREE.Vector3(0, 3.8, 11.5);
            return;
        }

        this.focusedObject = obj;
        // Position camera in front of target object with comfortable padding
        const targetPos = obj.mesh.position.clone();
        targetPos.z += 2.8;
        targetPos.y += 0.5;
        this.targetCameraPos = targetPos;

        if (this.audio) this.audio.playShapeMorph();
        if (this.effects) this.effects.spawnShockwave(obj.mesh.position, 0x00ffff, 3.0, 0.5);
    }

    // ========================================================================
    // PER-FRAME ANIMATION & UPDATES
    // ========================================================================
    update(time, dt) {
        const safeDt = Math.min(Math.max(dt, 0.001), 0.1);
        const timeFactor = safeDt * 60;

        // 1. Rotate Galaxies
        this.galaxies.forEach(g => {
            if (g.isPlanet) {
                g.mesh.rotation.y += g.rotSpeed * timeFactor;
                if (g.moon) g.moon.rotation.y += 0.03 * timeFactor;
            } else {
                g.mesh.rotation.y += g.rotSpeed * timeFactor;
                g.mesh.rotation.z += g.rotSpeed * 0.3 * timeFactor;
            }
        });

        // 2. Starfields slow cosmic drift
        this.starfields.forEach(s => {
            s.mesh.rotation.y += s.rotSpeed * timeFactor;
        });

        // 3. Black Hole Accretion Disk Vortex
        if (this.blackHoleDisk) {
            this.blackHoleDisk.rotation.z += 0.014 * timeFactor;
        }

        // 4. Wormhole Tunnel Rings Rotation
        this.wormholeRings.forEach((r, idx) => {
            r.rotation.z += 0.008 * (idx % 2 === 0 ? 1 : -1) * timeFactor;
        });

        // 5. Shooting Stars Animation
        this.shootingStars.forEach(s => {
            if (!s.active) {
                s.timer -= timeFactor;
                if (s.timer <= 0) {
                    s.active = true;
                    s.mesh.visible = true;
                    s.mesh.position.set(
                        this.rng.range(-9, 9),
                        this.rng.range(3, 7),
                        this.rng.range(-6, -1)
                    );
                    s.mesh.material.opacity = 0.95;
                }
            } else {
                s.mesh.position.x += s.speed * 2.0 * timeFactor;
                s.mesh.position.y -= s.speed * 1.0 * timeFactor;
                s.mesh.material.opacity -= 0.025 * timeFactor;

                if (s.mesh.material.opacity <= 0) {
                    s.active = false;
                    s.mesh.visible = false;
                    s.timer = this.rng.range(60, 240);
                }
            }
        });

        // 6. Camera Focus Framing Interpolation with auto-release
        if (this.targetCameraPos) {
            this.camera.position.lerp(this.targetCameraPos, 0.07);
            if (this.focusedObject) {
                this.camera.lookAt(this.focusedObject.mesh.position);
            }

            // Once arrived close to target position, release target lock so user can freely navigate
            if (this.camera.position.distanceTo(this.targetCameraPos) < 0.08) {
                this.targetCameraPos = null;
            }
        }
    }
}
