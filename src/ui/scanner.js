// Сканер QR-кода камерой. Используется встроенный BarcodeDetector,
// а если его нет (Safari на iPhone), — библиотека jsQR из vendor/.

let jsqrLoading = null;
function loadJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (!jsqrLoading) {
    jsqrLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/jsQR.min.js';
      s.onload = () => resolve(window.jsQR);
      s.onerror = () => reject(new Error('Не удалось загрузить сканер'));
      document.head.appendChild(s);
    });
  }
  return jsqrLoading;
}

// Запускает камеру в элементе video и вызывает onCode(text) при первом найденном коде.
// Возвращает функцию остановки.
export async function startScanner(video, onCode, accept = () => true) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Камера недоступна в этом браузере');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.setAttribute('playsinline', '');
  video.muted = true;
  video.srcObject = stream;
  await video.play().catch(() => {});

  let detector = null;
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    } catch { detector = null; }
  }
  const jsQR = detector ? null : await loadJsQR();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let stopped = false, last = 0, busy = false;

  const stop = () => {
    stopped = true;
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };

  const loop = async (t) => {
    if (stopped) return;
    requestAnimationFrame(loop);
    if (busy || t - last < 140 || video.readyState < 2) return;
    last = t;
    busy = true;
    try {
      let text = null;
      if (detector) {
        const codes = await detector.detect(video);
        if (codes && codes[0]) text = codes[0].rawValue;
      } else {
        const vw = video.videoWidth, vh = video.videoHeight;
        const scale = Math.min(1, 900 / Math.max(vw, vh));
        canvas.width = Math.round(vw * scale); canvas.height = Math.round(vh * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (res && res.data) text = res.data;
      }
      if (text && !stopped && accept(text)) { stop(); onCode(text); }
    } catch { /* следующий кадр */ }
    busy = false;
  };
  requestAnimationFrame(loop);
  return stop;
}
