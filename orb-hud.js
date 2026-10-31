/**
 * ============================================================================
 * ORB HUD - Galaxy Navigation HUD & Cosmic Object Inspection Panel
 * Real-time telemetry, 6 environment buttons, seed randomize/lock,
 * manual zoom +/– steppers, and interactive celestial object inspector
 * ============================================================================
 */

export class OrbHUD {
    constructor(engine) {
        this.engine = engine;

        // Container references
        this.hudContainer = document.getElementById('orb-galaxy-hud');
        this.objectCard = document.getElementById('galaxy-object-card');

        // Telemetry elements
        this.txtEnvName = document.getElementById('hud-env-name');
        this.txtSeedNum = document.getElementById('hud-seed-num');
        this.txtZoomVal = document.getElementById('hud-zoom-val');
        this.txtSpeedVal = document.getElementById('hud-speed-val');
        this.txtGestureState = document.getElementById('hud-gesture-state');
        this.txtHandsCount = document.getElementById('hud-hands-count');

        // Zoom manual steppers
        this.btnZoomIn = document.getElementById('hud-zoom-in');
        this.btnZoomOut = document.getElementById('hud-zoom-out');
        this.sliderZoom = document.getElementById('hud-zoom-slider');

        // Universe action buttons
        this.btnRandomize = document.getElementById('btn-randomize-universe');
        this.btnLock = document.getElementById('btn-lock-universe');
        this.btnRestore = document.getElementById('btn-restore-universe');
        this.btnResetCam = document.getElementById('btn-reset-camera');

        // Environment pills
        this.envPills = document.querySelectorAll('.galaxy-env-pill');

        // Object info card elements
        this.objTitle = document.getElementById('obj-card-title');
        this.objType = document.getElementById('obj-card-type');
        this.objDist = document.getElementById('obj-card-dist');
        this.objMass = document.getElementById('obj-card-mass');
        this.objDesc = document.getElementById('obj-card-desc');
        this.btnObjFlyHere = document.getElementById('btn-obj-fly-here');
        this.btnObjReturn = document.getElementById('btn-obj-return');
        this.btnObjClose = document.getElementById('btn-obj-close');

        // Settings modal trigger
        this.btnOpenSettings = document.getElementById('btn-orb-settings');
        this.settingsModal = document.getElementById('orb-settings-modal');
        this.btnCloseSettings = document.getElementById('btn-close-orb-settings');

        // Practice mode trigger
        this.btnPracticeMode = document.getElementById('btn-practice-mode');

        this.currentSelectedObject = null;
        this.init();
    }

    init() {
        // Zoom Buttons
        if (this.btnZoomIn) {
            this.btnZoomIn.addEventListener('click', () => {
                if (this.engine && this.engine.gestureController) {
                    this.engine.gestureController.stepZoom(true);
                }
            });
        }

        if (this.btnZoomOut) {
            this.btnZoomOut.addEventListener('click', () => {
                if (this.engine && this.engine.gestureController) {
                    this.engine.gestureController.stepZoom(false);
                }
            });
        }

        if (this.sliderZoom) {
            this.sliderZoom.addEventListener('input', (e) => {
                if (this.engine && this.engine.gestureController) {
                    this.engine.gestureController.setManualZoom(parseFloat(e.target.value));
                }
            });
        }

        // Universe Operations
        if (this.btnRandomize) {
            this.btnRandomize.addEventListener('click', () => {
                if (this.engine && this.engine.modesManager) {
                    this.engine.modesManager.randomizeUniverse();
                    this.updateUniverseInfo();
                }
            });
        }

        if (this.btnLock) {
            this.btnLock.addEventListener('click', () => {
                if (this.engine && this.engine.modesManager) {
                    const uni = this.engine.modesManager.getUniverse();
                    if (uni) {
                        const newLockState = !uni.isLocked;
                        uni.lockCurrent(newLockState);
                        this.btnLock.classList.toggle('locked', newLockState);
                        this.btnLock.querySelector('.btn-text').textContent = newLockState ? 'Locked' : 'Lock';
                    }
                }
            });
        }

        if (this.btnRestore) {
            this.btnRestore.addEventListener('click', () => {
                if (this.engine && this.engine.modesManager) {
                    this.engine.modesManager.restorePreviousUniverse();
                    this.updateUniverseInfo();
                }
            });
        }

        if (this.btnResetCam) {
            this.btnResetCam.addEventListener('click', () => {
                if (this.engine && this.engine.gestureController) {
                    this.engine.gestureController.executeReset();
                }
            });
        }

        // Environment Selectors
        this.envPills.forEach(pill => {
            pill.addEventListener('click', () => {
                const env = pill.dataset.env;
                this.envPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');

                if (this.engine && this.engine.modesManager) {
                    this.engine.modesManager.setGalaxyEnvironment(env);
                    this.updateUniverseInfo();
                }
            });
        });

        // Object Inspection Card Actions
        if (this.btnObjFlyHere) {
            this.btnObjFlyHere.addEventListener('click', () => {
                if (this.currentSelectedObject && this.engine && this.engine.modesManager) {
                    const uni = this.engine.modesManager.getUniverse();
                    if (uni) uni.focusObject(this.currentSelectedObject);
                }
            });
        }

        if (this.btnObjReturn) {
            this.btnObjReturn.addEventListener('click', () => {
                if (this.engine && this.engine.modesManager) {
                    const uni = this.engine.modesManager.getUniverse();
                    if (uni) uni.focusObject(null);
                }
                this.hideObjectCard();
            });
        }

        if (this.btnObjClose) {
            this.btnObjClose.addEventListener('click', () => {
                this.hideObjectCard();
            });
        }

        // Settings Modal
        if (this.btnOpenSettings && this.settingsModal) {
            this.btnOpenSettings.addEventListener('click', () => {
                this.settingsModal.classList.remove('hidden');
            });
        }

        if (this.btnCloseSettings && this.settingsModal) {
            this.btnCloseSettings.addEventListener('click', () => {
                this.settingsModal.classList.add('hidden');
            });
        }

        // Practice Mode
        if (this.btnPracticeMode) {
            this.btnPracticeMode.addEventListener('click', () => {
                if (window.OrbAcademy) {
                    window.OrbAcademy.startPracticeMode();
                }
            });
        }

        this.initSettingsSliders();
    }

    initSettingsSliders() {
        const zoomSens = document.getElementById('setting-zoom-sens');
        const zoomVal = document.getElementById('setting-zoom-val');
        const rotSens = document.getElementById('setting-rot-sens');
        const rotVal = document.getElementById('setting-rot-val');
        const flightSpeed = document.getElementById('setting-flight-speed');
        const flightVal = document.getElementById('setting-flight-val');
        const pinchThresh = document.getElementById('setting-pinch-thresh');
        const pinchVal = document.getElementById('setting-pinch-val');
        const soundVol = document.getElementById('setting-sound-vol');
        const soundVal = document.getElementById('setting-sound-val');
        const toggleSkel = document.getElementById('setting-toggle-skeleton');

        // Load persisted settings
        try {
            const saved = localStorage.getItem('airdraw_orb_settings');
            if (saved) {
                const s = JSON.parse(saved);
                if (zoomSens && s.zoomSens) { zoomSens.value = s.zoomSens; zoomVal.textContent = s.zoomSens; }
                if (rotSens && s.rotSens) { rotSens.value = s.rotSens; rotVal.textContent = s.rotSens; }
                if (flightSpeed && s.flightSpeed) { flightSpeed.value = s.flightSpeed; flightVal.textContent = s.flightSpeed; }
                if (pinchThresh && s.pinchThresh) { pinchThresh.value = s.pinchThresh; pinchVal.textContent = s.pinchThresh; }
                if (soundVol && s.soundVol) { soundVol.value = s.soundVol; soundVal.textContent = s.soundVol + '%'; }
                if (toggleSkel && s.skeleton !== undefined) { toggleSkel.checked = s.skeleton; }
            }
        } catch (e) { }

        const persist = () => {
            const settings = {
                zoomSens: zoomSens ? zoomSens.value : 5.5,
                rotSens: rotSens ? rotSens.value : 1.0,
                flightSpeed: flightSpeed ? flightSpeed.value : 2.0,
                pinchThresh: pinchThresh ? pinchThresh.value : 0.35,
                soundVol: soundVol ? soundVol.value : 80,
                skeleton: toggleSkel ? toggleSkel.checked : true
            };
            try {
                localStorage.setItem('airdraw_orb_settings', JSON.stringify(settings));
            } catch (e) { }

            // Apply directly to controllers
            if (this.engine && this.engine.gestureController) {
                this.engine.gestureController.zoomSensitivity = parseFloat(settings.zoomSens);
                this.engine.gestureController.rotationSensitivity = parseFloat(settings.rotSens);
            }
            if (this.engine && this.engine.audio) {
                this.engine.audio.setMasterVolume(parseFloat(settings.soundVol) / 100);
            }
            if (this.engine && this.engine.effects) {
                this.engine.effects.setSkeletonVisible(settings.skeleton);
            }
        };

        if (zoomSens) {
            zoomSens.addEventListener('input', (e) => {
                if (zoomVal) zoomVal.textContent = e.target.value;
                persist();
            });
        }
        if (rotSens) {
            rotSens.addEventListener('input', (e) => {
                if (rotVal) rotVal.textContent = e.target.value;
                persist();
            });
        }
        if (flightSpeed) {
            flightSpeed.addEventListener('input', (e) => {
                if (flightVal) flightVal.textContent = e.target.value;
                persist();
            });
        }
        if (pinchThresh) {
            pinchThresh.addEventListener('input', (e) => {
                if (pinchVal) pinchVal.textContent = e.target.value;
                persist();
            });
        }
        if (soundVol) {
            soundVol.addEventListener('input', (e) => {
                if (soundVal) soundVal.textContent = e.target.value + '%';
                persist();
            });
        }
        if (toggleSkel) {
            toggleSkel.addEventListener('change', () => persist());
        }
    }

    onSubmodeChanged(submode) {
        const isGalaxy = (submode === 'galaxy');
        if (this.hudContainer) {
            this.hudContainer.classList.toggle('hidden', !isGalaxy);
        }
        if (!isGalaxy) {
            this.hideObjectCard();
        } else {
            this.updateUniverseInfo();
        }
    }

    updateUniverseInfo() {
        if (!this.engine || !this.engine.modesManager) return;
        const uni = this.engine.modesManager.getUniverse();
        if (!uni) return;

        if (this.txtSeedNum) {
            this.txtSeedNum.textContent = '#' + uni.currentSeed;
        }

        const envLabels = {
            spiral: 'Spiral Galaxy',
            nebula: 'Nebula Universe',
            deepspace: 'Deep Space',
            blackhole: 'Supermassive Black Hole',
            wormhole: 'Wormhole Gateway',
            golden: 'Golden Universe'
        };

        if (this.txtEnvName) {
            this.txtEnvName.textContent = envLabels[uni.currentEnvironment] || uni.currentEnvironment;
        }

        // Active pill sync
        this.envPills.forEach(pill => {
            pill.classList.toggle('active', pill.dataset.env === uni.currentEnvironment);
        });
    }

    showObjectCard(objData) {
        if (!this.objectCard) return;
        this.currentSelectedObject = objData;

        if (this.objTitle) this.objTitle.textContent = objData.name || 'Celestial Object';
        if (this.objType) this.objType.textContent = (objData.type || 'Cosmic Body').toUpperCase();
        if (this.objDist) this.objDist.textContent = (objData.distance ? objData.distance.toFixed(1) : '3.8') + ' LY';
        if (this.objMass) this.objMass.textContent = objData.mass || '1.0 M☉';
        if (this.objDesc) this.objDesc.textContent = objData.description || 'Observed celestial object in deep universe coordinates.';

        this.objectCard.classList.remove('hidden');
    }

    showObjectInfo(objData) {
        this.showObjectCard(objData);
    }

    hideObjectCard() {
        if (this.objectCard) {
            this.objectCard.classList.add('hidden');
        }
        this.currentSelectedObject = null;
    }

    update(telemetry) {
        if (!telemetry) return;

        if (this.txtZoomVal) {
            this.txtZoomVal.textContent = telemetry.zoomPercent + '%';
        }
        if (this.sliderZoom && !this.sliderZoom.matches(':active')) {
            this.sliderZoom.value = telemetry.zoomPercent;
        }

        if (this.txtSpeedVal) {
            this.txtSpeedVal.textContent = (telemetry.travelSpeed > 0 ? (telemetry.travelSpeed * 100).toFixed(0) : '0') + ' km/s';
        }

        if (this.txtGestureState) {
            this.txtGestureState.textContent = telemetry.state;
            this.txtGestureState.className = 'hud-state-pill state-' + telemetry.state.toLowerCase();
        }

        if (this.txtHandsCount) {
            this.txtHandsCount.textContent = telemetry.handsCount === 0 ? 'No Hands' :
                (telemetry.handsCount === 1 ? '1 Hand' : '2 Hands');
        }
    }
}
