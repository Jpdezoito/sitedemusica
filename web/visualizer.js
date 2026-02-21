(() => {
  const VISUALIZER_SOURCE_CACHE = new WeakMap();
  const VISUALIZER_INSTANCE_CACHE = new WeakMap();

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(from, to, amount) {
    return from + (to - from) * amount;
  }

  function createCorner(className) {
    const corner = document.createElement('div');
    corner.className = `corner-glow ${className}`;
    return corner;
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

    if (!layer.children.length) {
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

    function updateLayerVisibility() {
      const isOff = !enabled || prefersReducedMotion.matches;
      layer.classList.toggle('viz-off', isOff);
    }

    function getBandEnergy(minHz, maxHz) {
      if (!audioContext || !analyser || !frequencyData) {
        return 0;
      }

      const binHz = (audioContext.sampleRate / 2) / analyser.frequencyBinCount;
      const start = clamp(Math.floor(minHz / binHz), 0, analyser.frequencyBinCount - 1);
      const end = clamp(Math.ceil(maxHz / binHz), 0, analyser.frequencyBinCount - 1);

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

    function render() {
      frameId = null;
      if (!playing || !enabled || prefersReducedMotion.matches || !analyser) {
        return;
      }

      analyser.getByteFrequencyData(frequencyData);

      const bassTarget = getBandEnergy(20, 160);
      const midsTarget = getBandEnergy(160, 2000);
      const highsTarget = getBandEnergy(2000, 8000);

      bassLevel = lerp(bassLevel, bassTarget, 0.2);
      midsLevel = lerp(midsLevel, midsTarget, 0.28);
      highsLevel = lerp(highsLevel, highsTarget, 0.35);

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

      writeLevels(
        bassOut,
        midsOut,
        highsOut,
        clamp(beatBass, 0, 1),
        clamp(beatMids, 0, 1),
        clamp(beatHighs, 0, 1)
      );

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
        return;
      }

      audioContext = audioContext || new Ctx();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      analyser = analyser || audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.82;

      try {
        if (!VISUALIZER_SOURCE_CACHE.has(audioEl)) {
          const sourceNode = audioContext.createMediaElementSource(audioEl);
          sourceNode.connect(analyser);
          analyser.connect(audioContext.destination);
          VISUALIZER_SOURCE_CACHE.set(audioEl, sourceNode);
        }
      } catch (error) {
        audioGraphFailed = true;
        console.warn('[Visualizer] Não foi possível conectar ao elemento de áudio. Se a faixa for externa, confirme CORS e crossOrigin=anonymous.', error);
        return;
      }

      frequencyData = frequencyData || new Uint8Array(analyser.frequencyBinCount);
    }

    function clearAll() {
      prevBassOut = 0;
      prevMidsOut = 0;
      prevHighsOut = 0;
      beatBass = 0;
      beatMids = 0;
      beatHighs = 0;
      writeLevels(0, 0, 0, 0, 0, 0);
    }

    async function start() {
      if (!enabled || prefersReducedMotion.matches) {
        updateLayerVisibility();
        return;
      }

      if (audioEl.currentSrc && /^https?:\/\//i.test(audioEl.currentSrc) && !audioEl.crossOrigin) {
        console.warn('[Visualizer] Fonte externa detectada. Para análise de frequência, o servidor da mídia precisa permitir CORS.');
      }

      await ensureAudioGraph();
      if (audioGraphFailed) {
        updateLayerVisibility();
        return;
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
      clearAll();
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

    updateLayerVisibility();
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
