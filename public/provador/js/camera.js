window.CameraModule = {
  overlayImg: null,
  lastRect: null,
  poseEnabled: true,

  async start(videoId = 'video', canvasId = 'canvas', tipId = 'cameraTip') {
    const video = document.getElementById(videoId);
    const canvas = document.getElementById(canvasId);
    const tip = document.getElementById(tipId);

    if (!video || !canvas) {
      console.error('Video ou canvas não encontrado', { video, canvas });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 720 }, height: { ideal: 1280 }, facingMode: 'user' },
        audio: false
      });

      video.srcObject = stream;
      await video.play();

      if (tip) tip.textContent = 'Câmera ativa.';
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
      if (!this.poseEnabled || !results.poseLandmarks || !results.poseLandmarks[11] || !results.poseLandmarks[12]) {
        return;
      }

      const ls = results.poseLandmarks[11];
      const rs = results.poseLandmarks[12];

      const centerX = ((1 - ls.x) + (1 - rs.x)) / 2 * canvas.width;
      const shoulderY = ((ls.y + rs.y) / 2) * canvas.height;
      const shoulderSpan = Math.abs((1 - rs.x) - (1 - ls.x)) * canvas.width;

      const w = Math.max(canvas.width * 0.25, shoulderSpan * 1.9);
      const h = w * 1.28;

      this.lastRect = {
        x: centerX - w / 2,
        y: shoulderY - h * 0.16,
        w,
        h
      };
    });

    const mpCamera = new Camera(video, {
      onFrame: async () => {
        try {
          await pose.send({ image: video });
        } catch (e) {}
      },
      width: 720,
      height: 1280
    });

    mpCamera.start();
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

          ctx.drawImage(this.overlayImg, rect.x, rect.y, rect.w, rect.h);
        }
      }

      requestAnimationFrame(draw);
    };

    draw();
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
