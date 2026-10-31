/**
 * ============================================================================
 * ORB EFFECTS - Particle Systems, Shockwaves, Trails & Hand Visualization
 * Uses Three.js for 3D particles & Canvas 2D for holographic hand skeleton
 * ============================================================================
 */
import * as THREE from 'three';

export class OrbEffects {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        // Ambient Particles
        this.ambientParticles = null;
        this.particleCount = 500;
        this.particleVelocities = [];

        // Shockwave rings
        this.shockwaves = [];

        // Trails
        this.trailParticles = null;
        this.trailData = [];
        this.maxTrails = 300;

        // Skeleton overlay canvas
        this.skeletonCanvas = document.getElementById('skeleton-canvas');
        this.skeletonCtx = this.skeletonCanvas ? this.skeletonCanvas.getContext('2d') : null;
        this.skeletonVisible = true;

        this.initAmbientParticles();
        this.initTrailSystem();
    }

    setQuality(quality) {
        // High: 700 particles, Balanced: 450, Performance: 200
        if (quality === 'HIGH') {
            this.particleCount = 700;
        } else if (quality === 'BALANCED') {
            this.particleCount = 450;
        } else {
            this.particleCount = 200;
        }
        this.initAmbientParticles();
    }

    createGlowTexture(colorHex = '#ffffff') {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, colorHex);
        grad.addColorStop(0.3, colorHex);
        grad.addColorStop(0.7, 'rgba(0, 200, 255, 0.2)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }

    initAmbientParticles() {
        if (this.ambientParticles) {
            this.scene.remove(this.ambientParticles);
            this.ambientParticles.geometry.dispose();
            this.ambientParticles.material.dispose();
        }

        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const colors = new Float32Array(this.particleCount * 3);
        this.particleVelocities = [];

        const colorPalette = [
            new THREE.Color(0x00ffff), // Cyan
            new THREE.Color(0xff00ff), // Magenta
            new THREE.Color(0xffd700), // Gold
            new THREE.Color(0x7000ff)  // Violet
        ];

        for (let i = 0; i < this.particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 16;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;

            const c = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;

            this.particleVelocities.push({
                x: (Math.random() - 0.5) * 0.006,
                y: (Math.random() - 0.5) * 0.006,
                z: (Math.random() - 0.5) * 0.004
            });
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.12,
            vertexColors: true,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            map: this.createGlowTexture('#ffffff')
        });

        this.ambientParticles = new THREE.Points(geo, mat);
        this.scene.add(this.ambientParticles);
    }

    initTrailSystem() {
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(this.maxTrails * 3);
        const colors = new Float32Array(this.maxTrails * 3);
        const sizes = new Float32Array(this.maxTrails);

        this.trailData = [];
        for (let i = 0; i < this.maxTrails; i++) {
            this.trailData.push({
                pos: new THREE.Vector3(0, -999, 0),
                color: new THREE.Color(0x00ffff),
                alpha: 0,
                size: 0.1
            });
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.18,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            map: this.createGlowTexture('#ffffff')
        });

        this.trailParticles = new THREE.Points(geo, mat);
        this.scene.add(this.trailParticles);
    }

    emitTrail(position, color, count = 2) {
        let emitted = 0;
        for (let i = 0; i < this.maxTrails; i++) {
            if (this.trailData[i].alpha <= 0) {
                this.trailData[i].pos.copy(position).add(
                    new THREE.Vector3(
                        (Math.random() - 0.5) * 0.1,
                        (Math.random() - 0.5) * 0.1,
                        (Math.random() - 0.5) * 0.1
                    )
                );
                this.trailData[i].color.copy(color);
                this.trailData[i].alpha = 1.0;
                this.trailData[i].size = Math.random() * 0.15 + 0.08;
                emitted++;
                if (emitted >= count) break;
            }
        }
    }

    // Shockwave Ring: Expanding luminous energy torus
    spawnShockwave(position, colorHex = 0x00ffff, maxRadius = 3.5, duration = 0.8) {
        const geo = new THREE.RingGeometry(0.1, 0.25, 32);
        const mat = new THREE.MeshBasicMaterial({
            color: colorHex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position);
        mesh.lookAt(this.camera.position);

        this.scene.add(mesh);
        this.shockwaves.push({
            mesh,
            startTime: performance.now(),
            duration: duration * 1000,
            maxRadius
        });
    }

    update(dt, orbs, fingertips = []) {
        // 1. Update Ambient Particles & Finger Attraction
        if (this.ambientParticles) {
            const posAttr = this.ambientParticles.geometry.attributes.position;
            const posArr = posAttr.array;

            for (let i = 0; i < this.particleCount; i++) {
                const idx = i * 3;
                posArr[idx] += this.particleVelocities[i].x;
                posArr[idx + 1] += this.particleVelocities[i].y;
                posArr[idx + 2] += this.particleVelocities[i].z;

                // Gentle attraction toward detected fingertips
                if (fingertips && fingertips.length > 0) {
                    fingertips.forEach(ft => {
                        const dx = ft.x - posArr[idx];
                        const dy = ft.y - posArr[idx + 1];
                        const dz = ft.z - posArr[idx + 2];
                        const distSq = dx * dx + dy * dy + dz * dz;

                        if (distSq < 4.0 && distSq > 0.04) {
                            const force = 0.003 / Math.sqrt(distSq);
                            posArr[idx] += dx * force;
                            posArr[idx + 1] += dy * force;
                            posArr[idx + 2] += dz * force;
                        }
                    });
                }

                // Wrap-around bounds
                if (posArr[idx] > 8) posArr[idx] = -8;
                if (posArr[idx] < -8) posArr[idx] = 8;
                if (posArr[idx + 1] > 6) posArr[idx + 1] = -6;
                if (posArr[idx + 1] < -6) posArr[idx + 1] = 6;
                if (posArr[idx + 2] > 3) posArr[idx + 2] = -7;
                if (posArr[idx + 2] < -7) posArr[idx + 2] = 3;
            }
            posAttr.needsUpdate = true;
        }

        // 2. Update Trail Particles
        if (this.trailParticles) {
            const posAttr = this.trailParticles.geometry.attributes.position;
            const colAttr = this.trailParticles.geometry.attributes.color;
            const posArr = posAttr.array;
            const colArr = colAttr.array;

            for (let i = 0; i < this.maxTrails; i++) {
                const t = this.trailData[i];
                if (t.alpha > 0) {
                    t.alpha -= dt * 1.8;
                    t.pos.y += 0.003; // Drift up slightly
                    if (t.alpha <= 0) {
                        t.alpha = 0;
                        t.pos.set(0, -999, 0);
                    }
                }

                const idx = i * 3;
                posArr[idx] = t.pos.x;
                posArr[idx + 1] = t.pos.y;
                posArr[idx + 2] = t.pos.z;

                colArr[idx] = t.color.r * t.alpha;
                colArr[idx + 1] = t.color.g * t.alpha;
                colArr[idx + 2] = t.color.b * t.alpha;
            }
            posAttr.needsUpdate = true;
            colAttr.needsUpdate = true;
        }

        // 3. Update Shockwaves
        const now = performance.now();
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            const elapsed = now - sw.startTime;
            const progress = elapsed / sw.duration;

            if (progress >= 1.0) {
                this.scene.remove(sw.mesh);
                sw.mesh.geometry.dispose();
                sw.mesh.material.dispose();
                this.shockwaves.splice(i, 1);
            } else {
                const scale = 0.2 + progress * sw.maxRadius;
                sw.mesh.scale.set(scale, scale, scale);
                sw.mesh.material.opacity = (1.0 - progress) * 0.85;
                sw.mesh.lookAt(this.camera.position);
            }
        }
    }

    setSkeletonVisible(visible) {
        this.skeletonVisible = !!visible;
        if (!this.skeletonVisible) {
            this.clearSkeleton();
        }
    }

    // Holographic Hand Skeleton Visualizer (Draws subtle glowing joints & connections)
    drawHandSkeleton(handsData, activePinchHand = null, selectedOrbPos = null) {
        if (!this.skeletonCtx || !this.skeletonCanvas || !this.skeletonVisible) return;
        const ctx = this.skeletonCtx;
        const w = this.skeletonCanvas.width;
        const h = this.skeletonCanvas.height;

        ctx.clearRect(0, 0, w, h);

        if (!handsData || handsData.length === 0) return;

        // Connections: Hand landmark bone pairs
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8],       // Index
            [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
            [0, 13], [13, 14], [14, 15], [15, 16],// Ring
            [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
            [5, 9], [9, 13], [13, 17]             // Palm knuckles
        ];

        handsData.forEach((hand, handIdx) => {
            const pts = hand.screenPoints;
            if (!pts || pts.length < 21) return;

            const isLeft = (hand.handedness === 'Left');
            const baseColor = isLeft ? '#00ffff' : '#ff00ff';

            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Draw holographic bones
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.45;
            ctx.shadowBlur = 8;
            ctx.shadowColor = baseColor;

            connections.forEach(([p1, p2]) => {
                ctx.beginPath();
                ctx.moveTo(pts[p1].x, pts[p1].y);
                ctx.lineTo(pts[p2].x, pts[p2].y);
                ctx.stroke();
            });

            // Draw glowing joint points
            pts.forEach((pt, idx) => {
                const isTip = [4, 8, 12, 16, 20].includes(idx);
                const isIndexTip = (idx === 8);
                const radius = isIndexTip ? 6 : (isTip ? 4 : 2.5);

                ctx.beginPath();
                ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = isIndexTip ? '#ffffff' : baseColor;
                ctx.globalAlpha = isIndexTip ? 0.9 : 0.65;
                ctx.shadowBlur = isIndexTip ? 12 : 6;
                ctx.shadowColor = baseColor;
                ctx.fill();

                // Targeting reticle for index fingertip
                if (isIndexTip) {
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
                    ctx.strokeStyle = '#00ffff';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            });

            // Highlight active pinch
            if (hand.isPinching) {
                const pinchMidX = (pts[4].x + pts[8].x) / 2;
                const pinchMidY = (pts[4].y + pts[8].y) / 2;

                ctx.beginPath();
                ctx.arc(pinchMidX, pinchMidY, 18, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = 2.5;
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#ffaa00';
                ctx.globalAlpha = 0.9;
                ctx.stroke();

                // If an orb is selected, draw subtle tractor beam to it
                if (selectedOrbPos) {
                    ctx.beginPath();
                    ctx.moveTo(pinchMidX, pinchMidY);
                    ctx.lineTo(selectedOrbPos.x, selectedOrbPos.y);
                    ctx.strokeStyle = 'rgba(255, 170, 0, 0.4)';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([6, 4]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }

            ctx.restore();
        });
    }

    clearSkeleton() {
        if (this.skeletonCtx && this.skeletonCanvas) {
            this.skeletonCtx.clearRect(0, 0, this.skeletonCanvas.width, this.skeletonCanvas.height);
        }
    }

    dispose() {
        if (this.ambientParticles) {
            this.scene.remove(this.ambientParticles);
            this.ambientParticles.geometry.dispose();
            this.ambientParticles.material.dispose();
        }
        if (this.trailParticles) {
            this.scene.remove(this.trailParticles);
            this.trailParticles.geometry.dispose();
            this.trailParticles.material.dispose();
        }
        this.shockwaves.forEach(sw => {
            this.scene.remove(sw.mesh);
            sw.mesh.geometry.dispose();
            sw.mesh.material.dispose();
        });
        this.shockwaves = [];
        this.clearSkeleton();
    }
}
