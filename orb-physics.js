/**
 * ============================================================================
 * ORB PHYSICS - Dynamics, Collision, Throwing, Merge & Split
 * High-performance 3D spatial physics for interactive energy spheres
 * ============================================================================
 */
import * as THREE from 'three';

export class OrbPhysics {
    constructor(audioSystem, effectsSystem) {
        this.audio = audioSystem;
        this.effects = effectsSystem;

        // Physics parameters
        this.damping = 0.965;         // Velocity damping per frame
        this.dragSmoothing = 0.28;     // Smoothing when following hand
        this.bounceRestitution = 0.72; // Elasticity on collision
        this.bounds = {
            minX: -5.5, maxX: 5.5,
            minY: -3.8, maxY: 3.8,
            minZ: -5.0, maxZ: 1.5
        };

        // Merge & Split state
        this.mergeDistance = 0.75;
        this.splitDistance = 1.8;
    }

    update(orbs, dt) {
        for (let i = 0; i < orbs.length; i++) {
            const orb = orbs[i];
            if (!orb.visible) continue;

            // 1. If currently grabbed: smooth follow target position and track throw velocity
            if (orb.isGrabbed) {
                const targetPos = orb.targetPosition;
                const prevPos = orb.mesh.position.clone();

                // Smooth interpolation toward hand target
                orb.mesh.position.lerp(targetPos, this.dragSmoothing);

                // Track instantaneous velocity vector for throwing
                orb.velocity.subVectors(orb.mesh.position, prevPos).multiplyScalar(1 / Math.max(dt, 0.01));

                // Smooth scale towards target scale (Expand/Shrink)
                orb.currentScale = THREE.MathUtils.lerp(orb.currentScale, orb.targetScale, 0.15);
                orb.mesh.scale.set(orb.currentScale, orb.currentScale, orb.currentScale);
            } else {
                // 2. Free flight physics
                orb.mesh.position.addScaledVector(orb.velocity, dt);
                orb.velocity.multiplyScalar(this.damping);

                // Stop micro-jitters
                if (orb.velocity.lengthSq() < 0.0001) {
                    orb.velocity.set(0, 0, 0);
                }

                // Smooth scale return if needed
                orb.currentScale = THREE.MathUtils.lerp(orb.currentScale, orb.targetScale, 0.1);
                orb.mesh.scale.set(orb.currentScale, orb.currentScale, orb.currentScale);

                // Boundary bounce
                this.checkBoundaryBounce(orb);
            }

            // Emit particle trails if moving
            const speed = orb.velocity.length();
            if (speed > 0.4 && this.effects) {
                this.effects.emitTrail(orb.mesh.position, orb.baseColor, Math.min(3, Math.ceil(speed)));
            }

            // Update reactive color based on speed
            this.updateReactiveColor(orb, speed);
        }

        // 3. Sphere-to-Sphere Collisions
        this.checkOrbCollisions(orbs);
    }

    checkBoundaryBounce(orb) {
        const r = orb.radius * orb.currentScale;
        const pos = orb.mesh.position;
        const vel = orb.velocity;
        let bounced = false;

        if (pos.x - r < this.bounds.minX) {
            pos.x = this.bounds.minX + r;
            vel.x = -vel.x * this.bounceRestitution;
            bounced = true;
        } else if (pos.x + r > this.bounds.maxX) {
            pos.x = this.bounds.maxX - r;
            vel.x = -vel.x * this.bounceRestitution;
            bounced = true;
        }

        if (pos.y - r < this.bounds.minY) {
            pos.y = this.bounds.minY + r;
            vel.y = -vel.y * this.bounceRestitution;
            bounced = true;
        } else if (pos.y + r > this.bounds.maxY) {
            pos.y = this.bounds.maxY - r;
            vel.y = -vel.y * this.bounceRestitution;
            bounced = true;
        }

        if (pos.z - r < this.bounds.minZ) {
            pos.z = this.bounds.minZ + r;
            vel.z = -vel.z * this.bounceRestitution;
            bounced = true;
        } else if (pos.z + r > this.bounds.maxZ) {
            pos.z = this.bounds.maxZ - r;
            vel.z = -vel.z * this.bounceRestitution;
            bounced = true;
        }

        if (bounced && vel.length() > 0.8 && this.audio) {
            this.audio.playCollision(vel.length() * 0.5);
        }
    }

    checkOrbCollisions(orbs) {
        for (let i = 0; i < orbs.length; i++) {
            for (let j = i + 1; j < orbs.length; j++) {
                const o1 = orbs[i];
                const o2 = orbs[j];
                if (!o1.visible || !o2.visible) continue;

                const pos1 = o1.mesh.position;
                const pos2 = o2.mesh.position;
                const delta = new THREE.Vector3().subVectors(pos1, pos2);
                const dist = delta.length();
                const r1 = o1.radius * o1.currentScale;
                const r2 = o2.radius * o2.currentScale;
                const minDist = r1 + r2;

                if (dist < minDist && dist > 0.0001) {
                    // Collision Normal
                    const normal = delta.clone().normalize();
                    const overlap = minDist - dist;

                    // Push apart to prevent overlap
                    pos1.addScaledVector(normal, overlap * 0.5);
                    pos2.addScaledVector(normal, -overlap * 0.5);

                    // Elastic momentum exchange
                    const v1 = o1.velocity;
                    const v2 = o2.velocity;
                    const vRel = new THREE.Vector3().subVectors(v1, v2);
                    const speedAlongNormal = vRel.dot(normal);

                    if (speedAlongNormal < 0) {
                        const impulse = -(1 + this.bounceRestitution) * speedAlongNormal / (o1.mass + o2.mass);
                        v1.addScaledVector(normal, impulse * o2.mass);
                        v2.addScaledVector(normal, -impulse * o1.mass);

                        // Visual & Audio Collision Shockwave
                        const impactSpeed = Math.abs(speedAlongNormal);
                        const midPoint = new THREE.Vector3().addVectors(pos1, pos2).multiplyScalar(0.5);

                        if (this.effects && impactSpeed > 0.4) {
                            this.effects.spawnShockwave(midPoint, 0xffffff, 1.8, 0.4);
                        }
                        if (this.audio && impactSpeed > 0.25) {
                            this.audio.playCollision(impactSpeed);
                        }

                        // Temporary glow flash
                        o1.flashGlow(1.6);
                        o2.flashGlow(1.6);
                    }
                }
            }
        }
    }

    updateReactiveColor(orb, speed) {
        // Slow movement: base calm color; Medium: violet/magenta shift; Fast: golden/orange glow
        if (!orb.coreMaterial) return;

        if (speed > 2.0) {
            // Fast: High energy amber/orange
            orb.coreMaterial.color.lerp(new THREE.Color(0xff8800), 0.12);
        } else if (speed > 0.8) {
            // Medium: Electric violet
            orb.coreMaterial.color.lerp(new THREE.Color(0x9d00ff), 0.08);
        } else {
            // Calm: Restore original color
            orb.coreMaterial.color.lerp(orb.baseColor, 0.05);
        }
    }

    // Merge two orbs into one
    attemptMerge(orb1, orb2) {
        if (!orb1.visible || !orb2.visible) return null;
        if (orb1.isMerged || orb2.isMerged) return null;

        const dist = orb1.mesh.position.distanceTo(orb2.mesh.position);
        if (dist < this.mergeDistance) {
            orb2.visible = false;
            orb1.isMerged = true;
            orb1.targetScale = 1.6;
            orb1.mergedWith = orb2;

            if (this.effects) {
                this.effects.spawnShockwave(orb1.mesh.position, 0xff00ff, 3.0, 0.7);
            }
            if (this.audio) {
                this.audio.playMerge();
            }
            return orb1;
        }
        return null;
    }

    // Split a merged orb back into two
    attemptSplit(mergedOrb) {
        if (!mergedOrb || !mergedOrb.isMerged || !mergedOrb.mergedWith) return false;

        const other = mergedOrb.mergedWith;
        other.visible = true;
        other.mesh.position.copy(mergedOrb.mesh.position).add(new THREE.Vector3(1.2, 0, 0));
        other.velocity.set(1.5, 0, 0);
        mergedOrb.velocity.set(-1.5, 0, 0);

        mergedOrb.targetScale = 1.0;
        other.targetScale = 1.0;
        mergedOrb.isMerged = false;
        mergedOrb.mergedWith = null;

        if (this.effects) {
            this.effects.spawnShockwave(mergedOrb.mesh.position, 0x00ffff, 2.5, 0.5);
        }
        if (this.audio) {
            this.audio.playSplit();
        }
        return true;
    }
}
