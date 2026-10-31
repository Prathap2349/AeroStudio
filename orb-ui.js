/**
 * ============================================================================
 * ORB UI - Premium Futuristic Glassmorphism Controls & Mode Switcher
 * Manages Draw/Orb mode switching, submode selector, side tools & status hints
 * ============================================================================
 */

export class OrbUIController {
    constructor(engine) {
        this.engine = engine;

        // Mode switcher elements
        this.btnModeDraw = document.getElementById('btn-mode-draw');
        this.btnModeOrb = document.getElementById('btn-mode-orb');

        // Orb UI containers
        this.orbUiContainer = document.getElementById('orb-ui-container');
        this.orbGestureHint = document.getElementById('orb-gesture-hint');
        this.orbGestureText = document.getElementById('orb-gesture-text');
        this.orbHandsCount = document.getElementById('orb-hands-count');

        // Submode buttons
        this.submodeButtons = document.querySelectorAll('.orb-submode-btn');

        // Side tools
        this.btnOrbReset = document.getElementById('btn-orb-reset');
        this.btnOrbScreenshot = document.getElementById('btn-orb-screenshot');
        this.btnOrbRecord = document.getElementById('btn-orb-record');
        this.btnOrbSpawn = document.getElementById('btn-orb-spawn');
        this.btnOrbDismiss = document.getElementById('btn-orb-dismiss');
        this.qualitySelect = document.getElementById('orb-quality-select');
        this.styleSelect = document.getElementById('orb-style-select');

        this.isRecording = false;

        this.init();
    }

    init() {
        // Mode Switcher buttons
        if (this.btnModeDraw) {
            this.btnModeDraw.addEventListener('click', () => window.setAppMode('DRAW'));
        }
        if (this.btnModeOrb) {
            this.btnModeOrb.addEventListener('click', () => window.setAppMode('ORB'));
        }

        // Submodes
        this.submodeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.submodeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const submode = btn.dataset.submode;
                if (this.engine && this.engine.modesManager) {
                    this.engine.modesManager.switchMode(submode);
                }
            });
        });

        // Side Controls
        if (this.btnOrbReset) {
            this.btnOrbReset.addEventListener('click', () => {
                if (this.engine && this.engine.gestureController) {
                    this.engine.gestureController.executeReset();
                }
            });
        }

        if (this.btnOrbSpawn) {
            this.btnOrbSpawn.addEventListener('click', () => {
                if (this.engine && this.engine.sceneManager) {
                    this.engine.sceneManager.spawnOrb();
                    if (this.engine.audio) this.engine.audio.playSpawn();
                }
            });
        }

        if (this.btnOrbDismiss) {
            this.btnOrbDismiss.addEventListener('click', () => {
                if (this.engine && this.engine.gestureController) {
                    this.engine.gestureController.executeDismiss();
                }
            });
        }

        if (this.btnOrbScreenshot) {
            this.btnOrbScreenshot.addEventListener('click', () => {
                if (this.engine && this.engine.exportSystem) {
                    this.engine.exportSystem.captureScreenshot();
                }
            });
        }

        if (this.btnOrbRecord) {
            this.btnOrbRecord.addEventListener('click', () => {
                if (!this.engine || !this.engine.exportSystem) return;

                if (!this.isRecording) {
                    const started = this.engine.exportSystem.startRecording(
                        (timeStr) => {
                            this.btnOrbRecord.querySelector('.btn-label').textContent = timeStr;
                        },
                        () => {
                            this.isRecording = false;
                            this.btnOrbRecord.classList.remove('recording');
                            this.btnOrbRecord.querySelector('.btn-label').textContent = 'Record 3D';
                        }
                    );
                    if (started) {
                        this.isRecording = true;
                        this.btnOrbRecord.classList.add('recording');
                    }
                } else {
                    this.engine.exportSystem.stopRecording();
                }
            });
        }

        if (this.qualitySelect) {
            this.qualitySelect.addEventListener('change', (e) => {
                if (this.engine) {
                    this.engine.setQuality(e.target.value);
                }
            });
        }

        if (this.styleSelect) {
            this.styleSelect.addEventListener('change', (e) => {
                if (this.engine && this.engine.sceneManager) {
                    this.engine.sceneManager.setMaterialStyle(e.target.value);
                }
            });
        }
    }

    updateTrackingBadge(status) {
        if (!this.orbHandsCount || !this.orbGestureText) return;

        let handsLabel = 'No Hands Detected';
        if (status.handsCount === 1) handsLabel = '1 Hand Detected';
        else if (status.handsCount >= 2) handsLabel = '2 Hands Detected';

        this.orbHandsCount.textContent = handsLabel;
        this.orbGestureText.textContent = status.instruction;

        if (status.handsCount === 2) {
            this.orbHandsCount.className = 'status-tag tag-two-hands';
        } else if (status.handsCount === 1) {
            this.orbHandsCount.className = 'status-tag tag-one-hand';
        } else {
            this.orbHandsCount.className = 'status-tag tag-no-hands';
        }
    }

    setMode(mode) {
        const isOrb = (mode === 'ORB');
        if (this.btnModeDraw) this.btnModeDraw.classList.toggle('active', !isOrb);
        if (this.btnModeOrb) this.btnModeOrb.classList.toggle('active', isOrb);

        if (this.orbUiContainer) {
            this.orbUiContainer.classList.toggle('hidden', !isOrb);
        }

        const orbCanvas = document.getElementById('orb-canvas');
        if (orbCanvas) {
            orbCanvas.classList.toggle('hidden', !isOrb);
        }

        const skelCanvas = document.getElementById('skeleton-canvas');
        if (skelCanvas) {
            skelCanvas.classList.toggle('hidden', !isOrb);
        }
    }
}
