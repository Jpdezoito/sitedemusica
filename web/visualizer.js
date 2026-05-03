(() => {
  const VISUALIZER_SOURCE_CACHE = new WeakMap();
  const VISUALIZER_INSTANCE_CACHE = new WeakMap();

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(from, to, amount) {
    return from + (to - from) * amount;
  }

  function smoothPeak(current, target, attack, decay) {
    return target > current
      ? lerp(current, target, attack)
      : lerp(current, target, decay);
  }

  function createCorner(className) {
    const corner = document.createElement('div');
    corner.className = `corner-glow ${className}`;
    return corner;
  }

  function createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.className = 'particle-mesh-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    return canvas;
  }

  function initVisualizer(audioEl) {
    if (!audioEl) {
      throw new Error('initVisualizer requer um elemento de áudio válido');
    }

    if (VISUALIZER_INSTANCE_CACHE.has(audioEl)) {
      return VISUALIZER_INSTANCE_CACHE.get(audioEl);
    }

    if (!audioEl.crossOrigin) {
      audioEl.crossOrigin = 'anonymous';
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const layer = document.querySelector('#cornerGlowLayer') || document.createElement('div');
    layer.id = 'cornerGlowLayer';

    if (!layer.parentElement) {
      document.body.appendChild(layer);
    }

    let canvas = layer.querySelector('.particle-mesh-canvas');
    if (!canvas) {
      canvas = createCanvas();
      layer.prepend(canvas);
    }
    const ctx = canvas.getContext('2d', { alpha: true });

    if (!layer.querySelector('.corner-glow')) {
      layer.append(
        createCorner('tl'),
        createCorner('tr'),
        createCorner('bl'),
        createCorner('br')
      );
    }

    let audioContext = null;
    let analyser = null;
    let frequencyData = null;
    let frameId = null;
    let playing = false;
    let enabled = true;
    let bassLevel = 0;
    let midsLevel = 0;
    let highsLevel = 0;
    let prevBassOut = 0;
    let prevMidsOut = 0;
    let prevHighsOut = 0;
    let beatBass = 0;
    let beatMids = 0;
    let beatHighs = 0;
    let audioGraphFailed = false;
    let canvasWidth = 0;
    let canvasHeight = 0;
    let canvasDpr = 1;
    let bottomInset = 0;
    let bassImpact = 0;
    let lastParticleBeat = 0;
    let simulatedMode = false;
    let fadeFrameId = null;
    const particles = [];
    const simulatedData = new Uint8Array(1024);
    const BASE_BAR_COUNT = 180;
    const SPRING_GREEN = '#00FF7F';

    function updateLayerInsets() {
      const player = document.querySelector('.player');
      const playerHeight = player ? Math.max(0, Math.round(player.getBoundingClientRect().height || 0)) : 0;
      const inset = playerHeight > 0 ? playerHeight : 0;
      bottomInset = inset;
      layer.style.setProperty('--vizBottomInset', `${inset}px`);
      resizeCanvas();
    }

    function resizeCanvas() {
      if (!ctx || !canvas) return;
      const width = Math.max(1, Math.floor(window.innerWidth || layer.clientWidth || 1));
      const height = Math.max(1, Math.floor(window.innerHeight || layer.clientHeight || 1));
      const dpr = clamp(window.devicePixelRatio || 1, 1, 1.25);

      if (width === canvasWidth && height === canvasHeight && dpr === canvasDpr) {
        return;
      }

      canvasWidth = width;
      canvasHeight = height;
      canvasDpr = dpr;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
    }

    function writeLevels(nextBass, nextMids, nextHighs, nextBeatBass, nextBeatMids, nextBeatHighs) {
      const topMix = clamp(nextMids * 0.65 + nextHighs * 0.35, 0, 1);
      const bottomMix = clamp(nextBass * 0.75 + nextMids * 0.25, 0, 1);
      const mix = clamp(nextBass * 0.5 + nextMids * 0.5, 0, 1);
      layer.style.setProperty('--vizBass', String(nextBass));
      layer.style.setProperty('--vizMids', String(topMix > nextMids ? topMix : nextMids));
      layer.style.setProperty('--vizHigh', String(nextHighs));
      layer.style.setProperty('--vizMix', String(Math.max(mix, bottomMix * 0.75)));
      layer.style.setProperty('--vizBeatBass', String(nextBeatBass));
      layer.style.setProperty('--vizBeatMids', String(nextBeatMids));
      layer.style.setProperty('--vizBeatHigh', String(nextBeatHighs));
    }

    function publishVuLevels(left, right, mix) {
      window.dispatchEvent(new CustomEvent('audio-visualizer-levels', {
        detail: {
          left: clamp(left, 0, 1),
          right: clamp(right, 0, 1),
          mix: clamp(mix, 0, 1)
        }
      }));
    }

    function updateLayerVisibility() {
      const isOff = !enabled || prefersReducedMotion.matches;
      layer.classList.toggle('viz-off', isOff);
    }

    function getBandEnergy(minHz, maxHz) {
      if (!frequencyData || (!simulatedMode && (!audioContext || !analyser))) {
        return 0;
      }

      const binCount = frequencyData.length;
      const sampleRate = audioContext?.sampleRate || 48000;
      const binHz = (sampleRate / 2) / binCount;
      const start = clamp(Math.floor(minHz / binHz), 0, binCount - 1);
      const end = clamp(Math.ceil(maxHz / binHz), 0, binCount - 1);

      if (end <= start) {
        return 0;
      }

      let total = 0;
      for (let index = start; index <= end; index += 1) {
        total += frequencyData[index];
      }
      const average = total / (end - start + 1);
      return clamp(average / 255, 0, 1);
    }

    function writeSimulatedFrequencyData() {
      const time = performance.now() / 1000;
      const kick = Math.max(0, Math.sin(time * Math.PI * 2 * 1.85));
      const bassPulse = Math.pow(kick, 7);
      const sweep = (Math.sin(time * 0.72) + 1) / 2;
      const shimmer = (Math.sin(time * 5.1) + 1) / 2;

      for (let i = 0; i < simulatedData.length; i += 1) {
        const t = i / simulatedData.length;
        const bass = Math.exp(-t * 18) * (62 + bassPulse * 116);
        const midCenter = 0.14 + sweep * 0.34;
        const mids = Math.exp(-Math.pow((t - midCenter) * 8, 2)) * (26 + shimmer * 62);
        const highs = Math.exp(-Math.pow((t - 0.72) * 7, 2)) * (18 + (1 - sweep) * 44);
        const noise = Math.abs((Math.sin(i * 12.989 + time * 13.37) * 43758.5453) % 1);
        simulatedData[i] = clamp(bass + mids + highs + noise * 18, 0, 255);
      }

      frequencyData = simulatedData;
    }

    function isFullscreenLayout() {
      return document.documentElement.classList.contains('layout-fullscreen');
    }

    function getMeshGeometry() {
      const usableHeight = Math.max(260, canvasHeight - bottomInset);
      const cx = canvasWidth / 2;
      const cy = usableHeight * 0.43;
      const radiusLimit = Math.min(canvasWidth, usableHeight) * 0.29;
      const baseRadius = clamp(radiusLimit, 110, 150);
      return { cx, cy, baseRadius };
    }

    function spawnParticles(cx, cy, bassOut) {
      const now = performance.now();
      if (now - lastParticleBeat < 140) return;
      lastParticleBeat = now;

      const amount = Math.round(3 + bassOut * 7);
      const { baseRadius } = getMeshGeometry();
      const emitRadius = baseRadius + bassImpact * 40 + 8;
      for (let i = 0; i < amount; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.9 + Math.random() * 2.3 + bassOut * 2.2;
        particles.push({
          x: cx + Math.cos(angle) * emitRadius,
          y: cy + Math.sin(angle) * emitRadius,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.018 + Math.random() * 0.024,
          size: 0.8 + Math.random() * 1.7 + bassOut * 0.9
        });
      }

      if (particles.length > 80) {
        particles.splice(0, particles.length - 80);
      }
    }

    function drawParticles() {
      if (!ctx || particles.length === 0) return;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.986;
        particle.vy *= 0.986;
        particle.life -= particle.decay;

        if (particle.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        const alpha = clamp(particle.life, 0, 1);
        ctx.beginPath();
        ctx.shadowColor = SPRING_GREEN;
        ctx.shadowBlur = 4 + alpha * 8;
        ctx.fillStyle = `rgba(0, 255, 127, ${0.12 + alpha * 0.46})`;
        ctx.arc(particle.x, particle.y, particle.size * (0.5 + alpha), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawParticleMesh(bassOut, midsOut, highsOut, nextBeatBass) {
      if (!ctx || !frequencyData) return;
      resizeCanvas();

      if (!isFullscreenLayout()) {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        particles.length = 0;
        return;
      }

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.restore();

      const { cx, cy, baseRadius } = getMeshGeometry();
      bassImpact = smoothPeak(bassImpact, bassOut, 0.9, 0.2);
      const pulseRadius = baseRadius + bassImpact * 40;
      const freqBins = frequencyData.length;
      const maxBin = Math.max(1, Math.floor(freqBins * 0.82));
      const avgVolume = clamp(bassOut * 0.48 + midsOut * 0.34 + highsOut * 0.18, 0, 1);
      const barCount = canvasWidth < 700 ? 96 : (canvasWidth < 1100 ? 132 : BASE_BAR_COUNT);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      ctx.shadowBlur = 0;

      for (let i = 0; i < barCount; i += 1) {
        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        const curved = Math.pow(i / barCount, 1.72);
        const bin = Math.min(maxBin - 1, Math.floor(curved * maxBin));
        const raw = frequencyData[bin] / 255;
        const energy = clamp(Math.pow(raw, 1.22), 0, 1);
        const barLength = 5 + energy * 76 + avgVolume * 8;
        const inner = pulseRadius;
        const outer = pulseRadius + barLength;
        const x1 = cx + Math.cos(angle) * inner;
        const y1 = cy + Math.sin(angle) * inner;
        const x2 = cx + Math.cos(angle) * outer;
        const y2 = cy + Math.sin(angle) * outer;

        ctx.beginPath();
        ctx.lineWidth = 0.55 + energy * 1.15;
        ctx.strokeStyle = `rgba(0, 255, 127, ${0.12 + energy * 0.58})`;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.lineWidth = 1.5 + bassOut * 3;
      ctx.strokeStyle = `rgba(0, 255, 127, ${0.32 + avgVolume * 0.32})`;
      ctx.shadowColor = SPRING_GREEN;
      ctx.shadowBlur = 10 + bassOut * 24;
      ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = `rgba(0, 255, 127, ${0.14 + highsOut * 0.26})`;
      ctx.shadowBlur = 4 + highsOut * 8;
      ctx.arc(cx, cy, pulseRadius * (0.62 + midsOut * 0.04), 0, Math.PI * 2);
      ctx.stroke();

      const gradient = ctx.createRadialGradient(cx, cy, 4, cx, cy, pulseRadius * 0.78);
      gradient.addColorStop(0, `rgba(0, 255, 127, ${0.05 + bassOut * 0.08})`);
      gradient.addColorStop(0.42, `rgba(0, 255, 127, ${0.025 + midsOut * 0.04})`);
      gradient.addColorStop(1, 'rgba(0, 255, 127, 0)');
      ctx.fillStyle = gradient;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseRadius * 0.72, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      if (nextBeatBass > 0.92 || (bassOut > 0.42 && bassOut - prevBassOut > 0.04)) {
        spawnParticles(cx, cy, bassOut);
      }
      drawParticles();
    }

    function render() {
      frameId = null;
      if (!playing || !enabled || prefersReducedMotion.matches || (!analyser && !simulatedMode)) {
        return;
      }

      if (simulatedMode) {
        writeSimulatedFrequencyData();
      } else {
        analyser.getByteFrequencyData(frequencyData);
      }

      const bassTarget = getBandEnergy(20, 160);
      const midsTarget = getBandEnergy(160, 2000);
      const highsTarget = getBandEnergy(2000, 8000);

      bassLevel = smoothPeak(bassLevel, bassTarget, 0.9, 0.22);
      midsLevel = smoothPeak(midsLevel, midsTarget, 0.76, 0.24);
      highsLevel = smoothPeak(highsLevel, highsTarget, 0.82, 0.28);

      const bassOut = clamp(Math.pow(bassLevel, 0.86), 0, 1);
      const midsOut = clamp(Math.pow(midsLevel, 0.9), 0, 1);
      const highsOut = clamp(Math.pow(highsLevel, 0.95), 0, 1);

      const bassRise = bassOut - prevBassOut;
      const midsRise = midsOut - prevMidsOut;
      const highsRise = highsOut - prevHighsOut;

      beatBass = bassOut > 0.34 && bassRise > 0.055 ? 1 : beatBass * 0.88;
      beatMids = midsOut > 0.28 && midsRise > 0.045 ? 1 : beatMids * 0.9;
      beatHighs = highsOut > 0.24 && highsRise > 0.04 ? 1 : beatHighs * 0.92;

      prevBassOut = bassOut;
      prevMidsOut = midsOut;
      prevHighsOut = highsOut;

      const leftVu = clamp(bassOut * 0.58 + midsOut * 0.30 + highsOut * 0.12 + beatBass * 0.08, 0, 1);
      const rightVu = clamp(bassOut * 0.20 + midsOut * 0.38 + highsOut * 0.42 + beatHighs * 0.08, 0, 1);
      const mixVu = clamp((leftVu + rightVu) / 2, 0, 1);

      writeLevels(
        bassOut,
        midsOut,
        highsOut,
        clamp(beatBass, 0, 1),
        clamp(beatMids, 0, 1),
        clamp(beatHighs, 0, 1)
      );
      publishVuLevels(leftVu, rightVu, mixVu);
      drawParticleMesh(bassOut, midsOut, highsOut, clamp(beatBass, 0, 1));

      frameId = requestAnimationFrame(render);
    }

    async function ensureAudioGraph() {
      if (audioGraphFailed) {
        return;
      }

      if (audioContext && analyser && frequencyData) {
        return;
      }

      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        audioGraphFailed = true;
        return;
      }

      audioContext = audioContext || new Ctx();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      analyser = analyser || audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.58;

      try {
        if (!VISUALIZER_SOURCE_CACHE.has(audioEl)) {
          const sourceNode = audioContext.createMediaElementSource(audioEl);
          sourceNode.connect(analyser);
          const turboGainNode = audioContext.createGain();
          const savedTurbo = parseFloat(document.getElementById('turboGain')?.value || '1');
          turboGainNode.gain.value = Number.isFinite(savedTurbo) ? Math.max(1, Math.min(4, savedTurbo)) : 1;
          analyser.connect(turboGainNode);
          turboGainNode.connect(audioContext.destination);
          window.__vizTurboGain = turboGainNode;
          VISUALIZER_SOURCE_CACHE.set(audioEl, sourceNode);
        }
      } catch (error) {
        audioGraphFailed = true;
        console.warn('[Visualizer] Não foi possível conectar ao elemento de áudio. Se a faixa for externa, confirme CORS e crossOrigin=anonymous.', error);
        return;
      }

      frequencyData = frequencyData || new Uint8Array(analyser.frequencyBinCount);
    }

    function fadeOutCanvas(frame = 0) {
      if (!ctx || !canvasWidth || !canvasHeight) return;
      resizeCanvas();
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.restore();

      const decay = Math.max(0, 1 - frame / 18);
      writeLevels(0.02 * decay, 0.015 * decay, 0.01 * decay, 0, 0, 0);
      publishVuLevels(0.02 * decay, 0.018 * decay, 0.019 * decay);

      if (frame < 18) {
        fadeFrameId = requestAnimationFrame(() => fadeOutCanvas(frame + 1));
      } else {
        fadeFrameId = null;
        particles.length = 0;
      }
    }

    function clearAll() {
      prevBassOut = 0;
      prevMidsOut = 0;
      prevHighsOut = 0;
      beatBass = 0;
      beatMids = 0;
      beatHighs = 0;
      bassImpact = 0;
      simulatedMode = false;
      if (fadeFrameId) {
        cancelAnimationFrame(fadeFrameId);
        fadeFrameId = null;
      }
      particles.length = 0;
      if (ctx) {
        resizeCanvas();
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      }
      writeLevels(0, 0, 0, 0, 0, 0);
      publishVuLevels(0, 0, 0);
    }

    async function start(options = {}) {
      if (!enabled || prefersReducedMotion.matches) {
        updateLayerVisibility();
        return;
      }

      if (fadeFrameId) {
        cancelAnimationFrame(fadeFrameId);
        fadeFrameId = null;
      }

      simulatedMode = Boolean(options.simulated);

      if (!simulatedMode && audioEl.currentSrc && /^https?:\/\//i.test(audioEl.currentSrc) && !audioEl.crossOrigin) {
        console.warn('[Visualizer] Fonte externa detectada. Para análise de frequência, o servidor da mídia precisa permitir CORS.');
      }

      if (!simulatedMode) {
        await ensureAudioGraph();
      }

      if (audioGraphFailed || !analyser) {
        simulatedMode = true;
        frequencyData = simulatedData;
      }
      updateLayerVisibility();

      playing = true;
      if (!frameId) {
        frameId = requestAnimationFrame(render);
      }
    }

    function stop() {
      playing = false;
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      fadeOutCanvas();
    }

    function setEnabled(nextEnabled) {
      enabled = Boolean(nextEnabled);
      updateLayerVisibility();

      if (!enabled) {
        stop();
      } else if (!audioEl.paused) {
        start();
      }
    }

    function refreshTheme() {
      // Cores são derivadas de CSS variables em runtime.
      updateLayerInsets();
      clearAll();
    }

    prefersReducedMotion.addEventListener('change', () => {
      updateLayerVisibility();
      if (prefersReducedMotion.matches) {
        stop();
      } else if (enabled && !audioEl.paused) {
        start();
      }
    });

    window.addEventListener('resize', updateLayerInsets);

    updateLayerVisibility();
    updateLayerInsets();
    clearAll();

    const api = {
      start,
      stop,
      setEnabled,
      refreshTheme
    };

    VISUALIZER_INSTANCE_CACHE.set(audioEl, api);
    return api;
  }

  window.initVisualizer = initVisualizer;
})();
