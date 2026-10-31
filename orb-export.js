/**
 * ============================================================================
 * ORB EXPORT - Screenshot Capture & Video Recording for Orb 3D Experience
 * Composites the webcam background with the transparent 3D WebGL canvas
 * ============================================================================
 */

export class OrbExportSystem {
    constructor(videoElement, orbCanvas) {
        this.video = videoElement;
        this.orbCanvas = orbCanvas;

        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.recordingStartTime = 0;
        this.recordingInterval = null;
    }

    captureScreenshot() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w * dpr;
        tempCanvas.height = h * dpr;
        const ctx = tempCanvas.getContext('2d');
        ctx.scale(dpr, dpr);

        // 1. Draw mirrored webcam background if available
        if (this.video && this.video.readyState >= 2) {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(this.video, -w, 0, w, h);
            ctx.restore();
        } else {
            ctx.fillStyle = '#070810';
            ctx.fillRect(0, 0, w, h);
        }

        // 2. Draw 3D WebGL Canvas over video
        if (this.orbCanvas) {
            ctx.drawImage(this.orbCanvas, 0, 0, w, h);
        }

        // 3. Trigger Download
        const link = document.createElement('a');
        link.download = `airdraw_orb_3d_${Date.now()}.png`;
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    }

    startRecording(onStatusUpdate, onComplete) {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') return;

        try {
            const stream = this.orbCanvas.captureStream(30);
            this.recordedChunks = [];

            const options = { mimeType: 'video/webm;codecs=vp9' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm';
            }

            this.mediaRecorder = new MediaRecorder(stream, options);

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.recordedChunks.push(e.data);
            };

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.download = `airdraw_orb_timelapse_${Date.now()}.webm`;
                a.href = url;
                a.click();
                URL.revokeObjectURL(url);
                if (onComplete) onComplete();
            };

            this.mediaRecorder.start();
            this.recordingStartTime = Date.now();

            this.recordingInterval = setInterval(() => {
                const elapsedSec = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                const m = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
                const s = String(elapsedSec % 60).padStart(2, '0');
                if (onStatusUpdate) onStatusUpdate(`REC ${m}:${s}`);
            }, 1000);

            return true;
        } catch (err) {
            console.error('Orb MediaRecorder error:', err);
            return false;
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            clearInterval(this.recordingInterval);
        }
    }
}
