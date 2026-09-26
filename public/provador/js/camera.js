window.CameraModule = {
  overlayImg: null,
  lastRect: null,
  poseEnabled: true,
  poseLoopStarted: false,
  poseFrameBusy: false,
  autoFramingEnabled: true,
  autoFramingStorageKey: 'provador_camera_auto_framing_v1',
  cameraTrack: null,
  cameraFocusSupported: false,
  cameraFocusReady: false,
  cameraFocusAutoEnabled: true,
  cameraFocusModes: [],
  cameraFocusStorageKey: 'provador_camera_physical_focus_auto_v1',

  loadCameraFocusPreference() {
    try {
      const saved = localStorage.getItem(this.cameraFocusStorageKey);
      this.cameraFocusAutoEnabled = saved === null ? true : saved !== 'false';
    } catch (e) {
      this.cameraFocusAutoEnabled = true;
    }
    return this.cameraFocusAutoEnabled;
  },

  getCameraFocusState() {
    const settings = this.cameraTrack?.getSettings?.() || {};
    return {
      ready: !!this.cameraFocusReady,
      supported: !!this.cameraFocusSupported,
      auto: this.cameraFocusAutoEnabled !== false,
      modes: Array.isArray(this.cameraFocusModes) ? [...this.cameraFocusModes] : [],
      actualMode: settings.focusMode || null,
      focusDistance: settings.focusDistance ?? null
    };
  },

  emitCameraFocusStatus(extra = {}) {
    window.dispatchEvent(new CustomEvent('provador:camera-focus-status', {
      detail: { ...this.getCameraFocusState(), ...extra }
    }));
  },

  async initPhysicalCameraFocus(stream) {
    this.cameraTrack = stream?.getVideoTracks?.()[0] || null;
    this.cameraFocusReady = true;
    this.loadCameraFocusPreference();

    if (!this.cameraTrack || typeof this.cameraTrack.getCapabilities !== 'function') {
      this.cameraFocusSupported = false;
      this.cameraFocusModes = [];
      this.emitCameraFocusStatus({ reason: 'capabilities-unavailable' });
      return this.getCameraFocusState();
    }

    let capabilities = {};
    try {
      capabilities = this.cameraTrack.getCapabilities() || {};
    } catch (e) {}

    this.cameraFocusModes = Array.isArray(capabilities.focusMode)
      ? capabilities.focusMode.map(String)
      : [];

    const hasContinuous = this.cameraFocusModes.includes('continuous');
    const hasManual = this.cameraFocusModes.includes('manual');
    this.cameraFocusSupported = hasContinuous && hasManual;

    if (!this.cameraFocusSupported) {
      this.emitCameraFocusStatus({ reason: 'focus-mode-unsupported' });
      return this.getCameraFocusState();
    }

    try {
      await this.setCameraFocusAuto(this.cameraFocusAutoEnabled, { persist: false });
    } catch (error) {
      console.warn('Foco físico detectado, mas não pôde ser controlado:', error);
      this.cameraFocusSupported = false;
      this.emitCameraFocusStatus({
        reason: 'apply-failed',
        error: String(error?.message || error)
      });
    }

    return this.getCameraFocusState();
  },

  async setCameraFocusAuto(enabled, { persist = true } = {}) {
    if (!this.cameraTrack || !this.cameraFocusSupported) {
      this.emitCameraFocusStatus({ reason: 'unsupported' });
      return this.getCameraFocusState();
    }

    const useAuto = !!enabled;

    if (useAuto) {
      await this.cameraTrack.applyConstraints({
        advanced: [{ focusMode: 'continuous' }]
      });
    } else {
      const capabilities = this.cameraTrack.getCapabilities?.() || {};
      const settings = this.cameraTrack.getSettings?.() || {};
      const manual = { focusMode: 'manual' };

      const caps = capabilities.focusDistance;
      if (
        caps &&
        Number.isFinite(Number(caps.min)) &&
        Number.isFinite(Number(caps.max))
      ) {
        let distance = Number(settings.focusDistance);
        if (!Number.isFinite(distance)) {
          distance = (Number(caps.min) + Number(caps.max)) / 2;
        }
        distance = Math.max(Number(caps.min), Math.min(Number(caps.max), distance));
        manual.focusDistance = distance;
      }

      await this.cameraTrack.applyConstraints({
        advanced: [manual]
      });
    }

    this.cameraFocusAutoEnabled = useAuto;

    if (persist) {
      try {
        localStorage.setItem(this.cameraFocusStorageKey, String(useAuto));
      } catch (e) {}
    }

    this.emitCameraFocusStatus({ applied: true });
    return this.getCameraFocusState();
  },

  async toggleCameraFocusAuto() {
    return this.setCameraFocusAuto(!this.cameraFocusAutoEnabled);
  },

  loadAutoFramingPreference() {
    try {
      const saved = localStorage.getItem(this.autoFramingStorageKey);
      this.autoFramingEnabled = saved === null ? true : saved !== 'false';
    } catch (e) {
      this.autoFramingEnabled = true;
    }
    this.applyAutoFramingMode();
    return this.autoFramingEnabled;
  },

  applyAutoFramingMode() {
    const body = document.body;
    if (body) {
      body.classList.toggle('camera-auto-framing-off', !this.autoFramingEnabled);
    }
  },

  getAutoFraming() {
    return this.autoFramingEnabled !== false;
  },

  setAutoFraming(enabled) {
    this.autoFramingEnabled = !!enabled;
    this.applyAutoFramingMode();
    try {
      localStorage.setItem(this.autoFramingStorageKey, String(this.autoFramingEnabled));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('provador:camera-framing-status', {
      detail: { enabled: this.autoFramingEnabled }
    }));
    return this.autoFramingEnabled;
  },

  toggleAutoFraming() {
    return this.setAutoFraming(!this.getAutoFraming());
  },

  async start(videoId = 'video', canvasId = 'canvas', tipId = 'cameraTip') {
    const video = document.getElementById(videoId);
    const canvas = document.getElementById(canvasId);
    const tip = document.getElementById(tipId);

    if (!video || !canvas) {
      console.error('Video ou canvas não encontrado', { video, canvas });
      return;
    }

    this.loadAutoFramingPreference();

    try {
     const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: 'user'
  },
 
        audio: false
      });

      video.srcObject = stream;
      await video.play();

      await this.initPhysicalCameraFocus(stream);

      if (tip) {
        tip.textContent = 'Câmera ativa.';
        tip.classList.remove('is-idle');
        setTimeout(()=>{
          if (tip.textContent === 'Câmera ativa.') {
            tip.classList.add('is-idle');
          }
        }, 1800);
      }
      this.drawLoop(video, canvas);
      this.initPose(video, canvas, tip);

    } catch (e) {
      console.error('Erro ao abrir câmera:', e);
      if (tip) tip.textContent = 'Permita a câmera no Chrome e recarregue.';
    }
  },

  setLook(src) {
    this.overlayImg = new Image();
    this.overlayImg.src = src;
  },

  toggleTracking() {
    this.poseEnabled = !this.poseEnabled;
  },

  initPose(video, canvas, tip) {
    if (!window.Pose || !window.Camera) {
      if (tip) tip.textContent = 'Câmera ativa. Tracking indisponível.';
      return;
    }

    const pose = new Pose({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    pose.setOptions({
      modelComplexity: 0,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    pose.onResults(results => {

    if (
        !this.poseEnabled ||
        !results.poseLandmarks ||
        !results.poseLandmarks[11] ||
        !results.poseLandmarks[12] ||
        !results.poseLandmarks[23] ||
        !results.poseLandmarks[24]
    ) return;

    const ls = results.poseLandmarks[11];
    const rs = results.poseLandmarks[12];
    const lh = results.poseLandmarks[23];
    const rh = results.poseLandmarks[24];

    const leftShoulderX = (1 - ls.x) * canvas.width;
    const rightShoulderX = (1 - rs.x) * canvas.width;

    const shoulderCenterX = (leftShoulderX + rightShoulderX) / 2;

    const shoulderCenterY =
        ((ls.y + rs.y) / 2) * canvas.height;

    const hipCenterY =
        ((lh.y + rh.y) / 2) * canvas.height;

    const shoulderWidth =
        Math.abs(rightShoulderX - leftShoulderX);

    const torsoHeight =
        Math.abs(hipCenterY - shoulderCenterY);

    const angle =
        Math.atan2(
            rs.y - ls.y,
            (1 - rs.x) - (1 - ls.x)
        );

    this.lastRect = {

    x: shoulderCenterX,

    y: shoulderCenterY + torsoHeight * 0.18,

    w: shoulderWidth * 2.15,

    h: torsoHeight * 2.55,

    angle: angle

};
});


    // Usa o MESMO stream já aberto por getUserMedia.
    // Não abre/reconfigura a webcam novamente em 640x480.
    if (this.poseLoopStarted) return;

    this.poseLoopStarted = true;
    this.poseFrameBusy = false;

    const processPoseFrame = async () => {
      if (!this.poseLoopStarted) return;

      if (
        this.poseEnabled &&
        video.readyState >= 2 &&
        !this.poseFrameBusy
      ) {
        this.poseFrameBusy = true;
        try {
          await pose.send({ image: video });
        } catch (e) {
        } finally {
          this.poseFrameBusy = false;
        }
      }

      requestAnimationFrame(processPoseFrame);
    };

    requestAnimationFrame(processPoseFrame);
  },

  drawLoop(video, canvas) {
    const ctx = canvas.getContext('2d');

    const draw = () => {
      if (video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();

        if (this.overlayImg && this.overlayImg.complete) {
          const rect = this.lastRect || {
            x: canvas.width * 0.29,
            y: canvas.height * 0.18,
            w: canvas.width * 0.42,
            h: canvas.height * 0.46
          };

         ctx.save();

ctx.translate(rect.x, rect.y);

ctx.rotate((rect.angle || 0) * 0.45);
ctx.drawImage(

    this.overlayImg,

    -rect.w / 2,

    -rect.h * 0.20,

    rect.w,

    rect.h

);
ctx.restore();
        }
      }

      requestAnimationFrame(draw);
    };

    draw();
  },

  capturePhotoDataUrl(canvasId = 'canvas') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  },

  savePhoto(canvasId = 'canvas') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      alert('Tela do provador não encontrada.');
      return;
    }

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'foto-look.png';
    a.click();
  }
};

window.iniciarCamera = function () {
  return window.CameraModule.start();
};
