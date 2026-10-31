/**
 * ============================================================================
 * ORB SCENE - 3D Energy Spheres, Materials, Tension Lines & Lighting
 * Manages Cyan, Magenta, Golden Orbs and visual styles
 * ============================================================================
 */
import * as THREE from 'three';

export class EnergyOrb {
    constructor(id, name, baseColorHex, initialPos, radius = 0.55) {
        this.id = id;
        this.name = name;
        this.baseColor = new THREE.Color(baseColorHex);
        this.radius = radius;
        this.mass = 1.0;
        this.visible = true;

        // Transform state
        this.initialPosition = initialPos.clone();
        this.targetPosition = initialPos.clone();
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.currentScale = 1.0;
        this.targetScale = 1.0;
        this.isGrabbed = false;
        this.isMerged = false;
        this.mergedWith = null;

        // Group container
        this.mesh = new THREE.Group();
        this.mesh.position.copy(initialPos);

        // Core visual components
        this.coreMesh = null;
        this.shellMesh = null;
        this.innerRingMesh = null;
        this.light = null;
        this.currentStyle = 'plasma';

        this.initMeshes();
    }

    initMeshes() {
        // 1. Core Sphere
        const coreGeo = new THREE.SphereGeometry(this.radius, 32, 32);
        this.coreMaterial = new THREE.MeshStandardMaterial({
            color: this.baseColor,
            emissive: this.baseColor,
            emissiveIntensity: 0.85,
            roughness: 0.2,
            metalness: 0.6,
            transparent: true,
            opacity: 0.92
        });
        this.coreMesh = new THREE.Mesh(coreGeo, this.coreMaterial);
        this.mesh.add(this.coreMesh);

        // 2. Outer Energy Shell (Fresnel / Rim Glow)
        const shellGeo = new THREE.SphereGeometry(this.radius * 1.25, 24, 24);
        this.shellMaterial = new THREE.MeshBasicMaterial({
            color: this.baseColor,
            wireframe: true,
            transparent: true,
            opacity: 0.25,
            blending: THREE.AdditiveBlending
        });
        this.shellMesh = new THREE.Mesh(shellGeo, this.shellMaterial);
        this.mesh.add(this.shellMesh);

        // 3. Rotating Internal Pattern (Geometric Rings)
        const ringGeo = new THREE.TorusGeometry(this.radius * 0.75, 0.02, 16, 32);
        this.ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });
        this.innerRingMesh = new THREE.Mesh(ringGeo, this.ringMaterial);
        this.mesh.add(this.innerRingMesh);

        // 4. Point Light
        this.light = new THREE.PointLight(this.baseColor, 1.8, 6.0);
        this.mesh.add(this.light);
    }

    setStyle(styleName) {
        this.currentStyle = styleName;
        switch (styleName) {
            case 'wireframe':
                this.coreMaterial.wireframe = true;
                this.coreMaterial.opacity = 0.8;
                this.shellMesh.visible = true;
                this.shellMaterial.wireframe = true;
                break;
            case 'glass':
                this.coreMaterial.wireframe = false;
                this.coreMaterial.roughness = 0.05;
                this.coreMaterial.metalness = 0.9;
                this.coreMaterial.opacity = 0.45;
                this.coreMaterial.emissiveIntensity = 0.3;
                this.shellMesh.visible = false;
                break;
            case 'core':
                this.coreMaterial.wireframe = false;
                this.coreMaterial.emissiveIntensity = 1.5;
                this.coreMaterial.opacity = 0.98;
                this.shellMesh.visible = true;
                this.shellMaterial.wireframe = false;
                this.shellMaterial.opacity = 0.2;
                break;
            case 'planet':
                this.coreMaterial.wireframe = false;
                this.coreMaterial.roughness = 0.8;
                this.coreMaterial.metalness = 0.1;
                this.coreMaterial.emissiveIntensity = 0.2;
                this.shellMesh.visible = true;
                this.shellMaterial.wireframe = true;
                this.shellMaterial.opacity = 0.15;
                break;
            case 'plasma':
            default:
                this.coreMaterial.wireframe = false;
                this.coreMaterial.roughness = 0.2;
                this.coreMaterial.metalness = 0.6;
                this.coreMaterial.emissiveIntensity = 0.85;
                this.coreMaterial.opacity = 0.92;
                this.shellMesh.visible = true;
                this.shellMaterial.wireframe = true;
                this.shellMaterial.opacity = 0.25;
                break;
        }
    }

    flashGlow(factor = 1.8) {
        if (!this.coreMaterial) return;
        const orig = this.coreMaterial.emissiveIntensity;
        this.coreMaterial.emissiveIntensity = orig * factor;
        setTimeout(() => {
            if (this.coreMaterial) this.coreMaterial.emissiveIntensity = orig;
        }, 220);
    }

    update(time, dt) {
        if (!this.visible) {
            this.mesh.visible = false;
            return;
        }
        this.mesh.visible = true;

        // Idle internal rotations
        if (this.shellMesh) {
            this.shellMesh.rotation.y += 0.008;
            this.shellMesh.rotation.x += 0.005;
        }
        if (this.innerRingMesh) {
            this.innerRingMesh.rotation.x += 0.015;
            this.innerRingMesh.rotation.z += 0.012;
        }

        // Idle floating hovering if not held
        if (!this.isGrabbed && this.velocity.lengthSq() < 0.01) {
            const floatOffset = Math.sin(time * 1.5 + this.initialPosition.x * 2) * 0.003;
            this.mesh.position.y += floatOffset;
        }
    }

    reset() {
        this.mesh.position.copy(this.initialPosition);
        this.targetPosition.copy(this.initialPosition);
        this.velocity.set(0, 0, 0);
        this.currentScale = 1.0;
        this.targetScale = 1.0;
        this.isGrabbed = false;
        this.isMerged = false;
        this.mergedWith = null;
        this.visible = true;
    }

    dispose() {
        if (this.coreMesh) {
            if (this.coreMesh.geometry) this.coreMesh.geometry.dispose();
            if (this.coreMaterial) this.coreMaterial.dispose();
        }
        if (this.shellMesh) {
            if (this.shellMesh.geometry) this.shellMesh.geometry.dispose();
            if (this.shellMaterial) this.shellMaterial.dispose();
        }
        if (this.innerRingMesh) {
            if (this.innerRingMesh.geometry) this.innerRingMesh.geometry.dispose();
            if (this.ringMaterial) this.ringMaterial.dispose();
        }
        if (this.light) {
            this.mesh.remove(this.light);
            this.light.dispose();
        }
        while (this.mesh.children.length > 0) {
            this.mesh.remove(this.mesh.children[0]);
        }
    }
}

export class OrbSceneManager {
    constructor(scene) {
        this.scene = scene;
        this.orbs = [];
        this.tensionLines = [];
        this.lights = [];
        this.maxOrbs = 8;
        this.lastSpawnTimestamp = 0;
        this.spawnCooldownMs = 1200;
        this.visible = true;

        this.initLights();
        this.initCoreOrbs();
        this.initTensionLines();
    }

    initLights() {
        // Ambient soft light
        const ambLight = new THREE.AmbientLight(0xffffff, 0.45);
        this.scene.add(ambLight);
        this.lights.push(ambLight);

        // Directional rim lights
        const dirLight1 = new THREE.DirectionalLight(0x00ffff, 0.6);
        dirLight1.position.set(5, 5, 4);
        this.scene.add(dirLight1);
        this.lights.push(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0xff00ff, 0.4);
        dirLight2.position.set(-5, -3, 3);
        this.scene.add(dirLight2);
        this.lights.push(dirLight2);
    }

    initCoreOrbs() {
        // 1. Cyan Orb (Left)
        const cyanOrb = new EnergyOrb('orb-cyan', 'Cyan Plasma', 0x00ffff, new THREE.Vector3(-1.7, 0, 0), 0.55);

        // 2. Magenta Orb (Center Top)
        const magentaOrb = new EnergyOrb('orb-magenta', 'Magenta Pulse', 0xff00ff, new THREE.Vector3(0, 0.45, 0), 0.58);

        // 3. Golden Orb (Right)
        const goldOrb = new EnergyOrb('orb-gold', 'Golden Core', 0xffaa00, new THREE.Vector3(1.7, 0, 0), 0.55);

        this.orbs = [cyanOrb, magentaOrb, goldOrb];
        this.orbs.forEach(orb => this.scene.add(orb.mesh));
    }

    initTensionLines() {
        // 3 connecting dynamic lines between:
        // [0, 1] Cyan - Magenta
        // [1, 2] Magenta - Golden
        // [2, 0] Golden - Cyan
        const pairs = [[0, 1], [1, 2], [2, 0]];

        this.tensionLines = pairs.map(([idx1, idx2]) => {
            const geo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(),
                new THREE.Vector3()
            ]);
            const mat = new THREE.LineBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.65,
                blending: THREE.AdditiveBlending,
                linewidth: 2
            });
            const line = new THREE.Line(geo, mat);
            this.scene.add(line);
            return { line, idx1, idx2, mat };
        });
    }

    updateTensionLines() {
        this.tensionLines.forEach(({ line, idx1, idx2, mat }) => {
            const o1 = this.orbs[idx1];
            const o2 = this.orbs[idx2];

            if (!o1 || !o2 || !o1.visible || !o2.visible) {
                line.visible = false;
                return;
            }
            line.visible = true;

            const p1 = o1.mesh.position;
            const p2 = o2.mesh.position;
            const dist = p1.distanceTo(p2);

            // Update vertices
            const posAttr = line.geometry.attributes.position;
            posAttr.setXYZ(0, p1.x, p1.y, p1.z);
            posAttr.setXYZ(1, p2.x, p2.y, p2.z);
            posAttr.needsUpdate = true;

            // Tension: glow brighter and shift color under tension
            const tension = Math.min(1.0, dist / 4.0);
            mat.opacity = 0.25 + tension * 0.7;
            mat.color.setHSL(0.5 - tension * 0.45, 1.0, 0.6); // Cyan -> Violet -> Red/Gold
        });
    }

    setMaterialStyle(styleName) {
        this.orbs.forEach(orb => orb.setStyle(styleName));
    }

    spawnOrb(position = null, colorHex = null) {
        const now = performance.now();
        // Prevent accidental repeated spawning with cooldown
        if (now - this.lastSpawnTimestamp < this.spawnCooldownMs) {
            return null;
        }

        // Enforce max orbs cap to avoid performance degradation
        if (this.orbs.length >= this.maxOrbs) {
            // Flash newest spawned orb to indicate cap reached
            const last = this.orbs[this.orbs.length - 1];
            if (last) last.flashGlow(2.0);
            return null;
        }

        this.lastSpawnTimestamp = now;
        const id = 'orb-spawned-' + Date.now();
        const color = colorHex || (Math.random() > 0.5 ? 0x00ff88 : 0x9d00ff);
        const spawnPos = position ? position.clone() : new THREE.Vector3((Math.random() - 0.5) * 2, 0, 0);

        const newOrb = new EnergyOrb(id, 'Energy Sphere', color, spawnPos, 0.48);
        newOrb.visible = this.visible;
        if (newOrb.mesh) newOrb.mesh.visible = this.visible;
        this.orbs.push(newOrb);
        this.scene.add(newOrb.mesh);

        return newOrb;
    }

    setVisible(visible) {
        this.visible = visible;
        this.orbs.forEach(orb => {
            orb.visible = visible;
            if (orb.mesh) orb.mesh.visible = visible;
        });
        this.tensionLines.forEach(({ line }) => {
            if (line) line.visible = visible;
        });
    }

    dismissOrbs() {
        // Keep default 3 orbs, properly dispose all dynamically spawned orbs
        for (let i = this.orbs.length - 1; i >= 3; i--) {
            const orb = this.orbs[i];
            this.scene.remove(orb.mesh);
            orb.dispose();
            this.orbs.splice(i, 1);
        }

        // Animate default 3 orbs with flash glow and reset
        this.orbs.forEach(o => {
            o.flashGlow(2.5);
            o.targetScale = 0.1;
            setTimeout(() => {
                o.reset();
            }, 300);
        });
    }

    reset() {
        this.orbs.forEach(orb => orb.reset());
        if (this.visible) {
            this.updateTensionLines();
        }
    }

    update(time, dt) {
        if (!this.visible) return;
        this.orbs.forEach(orb => orb.update(time, dt));
        this.updateTensionLines();
    }
}
