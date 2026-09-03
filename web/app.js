(() => {
  const API_BASE = '';
  const LOCAL_PATH_CANDIDATES = ['', './', '../', '../../', '../../../'];
  const SHOULD_USE_API = window.location.port === '3000';
  const ROOT = document.documentElement;
  const APPEARANCE_THEMES = (window.THEMES && typeof window.THEMES === 'object') ? window.THEMES : {
    minimal: {
      '--bg': '#f6f7fb',
      '--surface': '#ffffff',
      '--surface2': '#f1f3f9',
      '--text': '#1a202c',
      '--muted': '#6b7280',
      '--accent': '#2b6cb0',
      '--accent2': '#1e4f8a',
      '--danger': '#dc2626',
      '--border': '#e2e8f0',
      '--shadow': '0 12px 30px rgba(16, 24, 40, 0.08)',
      '--radius': '12px',
      '--font': '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
      '--progressBg': '#dbe2ec',
      '--progressFill': '#2b6cb0',
      '--btnBg': '#f1f3f9',
      '--btnText': '#1a202c',
      '--hover': '#eef2f7',
      '--scrollThumb': '#cbd5e1',
      '--focus': 'rgba(43, 108, 176, 0.45)'
    }
  };
  const THEME_NAMES = Object.keys(APPEARANCE_THEMES);
  const LAYOUT_NAMES = Array.isArray(window.LAYOUTS) && window.LAYOUTS.length
    ? window.LAYOUTS
    : ['compact', 'split', 'fullscreen'];
  const THEME_LABELS = {
    minimal: 'Minimal Clean',
    darkpro: 'Dark Pro',
    neon: 'Neon Cyberpunk',
    retro: 'Retro Winamp / 2000s',
    glass: 'Glassmorphism',
    vinyl: 'Vinyl / Turntable',
    studio: 'Studio / DAW'
  };
  let neonVisualizer = null;
  let playerResizeObserver = null;
  let playerReserveFrame = 0;

  function apiUrl(path) {
    return `${API_BASE}${path}`;
  }

  const PLAYBACK_MODELS = [
    {
      id: 'pulse-ring',
      name: 'PulseRing Player',
      description: 'Pulseira com anel giratorio e controle por toque/pulso.'
    },
    {
      id: 'prism-clip',
      name: 'PrismClip',
      description: 'Clip magnetico com tela e-ink e modo stealth.'
    },
    {
      id: 'orbit-sphere',
      name: 'OrbitSphere',
      description: 'Esfera de bolso com anel externo para navegar playlists.'
    },
    {
      id: 'holo-puck-dock',
      name: 'HoloPuck Dock',
      description: 'Dock de mesa com controle por gesto/toque e visual holografico.'
    },
    {
      id: 'modu-stack',
      name: 'ModuStack',
      description: 'Sistema modular magnetico para montar bateria/armazenamento/amp.'
    },
    {
      id: 'neck-link',
      name: 'NeckLink',
      description: 'Colar com conducao ossea focado em corrida e rua.'
    },
    {
      id: 'nano-tape',
      name: 'NanoTape',
      description: 'Visual retro-futurista com chavinhas fisicas e slider de volume.'
    },
    {
      id: 'wave-card',
      name: 'WaveCard',
      description: 'Player ultrafino tamanho cartao, resistente a agua/queda.'
    }
  ];

  // EasyMusic blocks direct requests to its CDN (HTTP 403). On the static
  // GitHub Pages version we therefore use the provider's official embed.
  const EASYMUSIC_SHARE_IDS_BY_CONTENT_ID = {
    '190325c1-af88-fef6-2a34-fa35c903e42d': '4942010-190325c1-af88-fef6-2a34-fa35c903e42d',
    '1a9f27bf-bc44-f333-a75b-3f9e1880e06f': '4942409-1a9f27bf-bc44-f333-a75b-3f9e1880e06f',
    '2a0258b8-01b5-f94b-a6a8-7c853d49b6dd': '4946697-2a0258b8-01b5-f94b-a6a8-7c853d49b6dd',
    'cb615962-b172-f105-9953-c0f7b1894ece': '4954401-cb615962-b172-f105-9953-c0f7b1894ece',
    'cecd88d8-1766-f4d9-9779-bae3843a312f': '4954509-cecd88d8-1766-f4d9-9779-bae3843a312f',
    '57779799-e4dc-f181-9e70-d7717cac56ad': '4955525-57779799-e4dc-f181-9e70-d7717cac56ad',
    'dfd547b2-355e-fbfa-21a5-e03f07fe67d0': '4941973-dfd547b2-355e-fbfa-21a5-e03f07fe67d0',
    'f45ae999-0ded-ff8e-2504-a1683c541657': '4943182-f45ae999-0ded-ff8e-2504-a1683c541657',
    '6627a13c-988d-f7f3-accc-de066ea72248': '4944308-6627a13c-988d-f7f3-accc-de066ea72248',
    'c4b9a79f-067b-f2dc-6541-83e14e96f522': '4938588-c4b9a79f-067b-f2dc-6541-83e14e96f522',
    '3a6e922c-aaab-fe10-a53c-3bb86695def0': '4938493-3a6e922c-aaab-fe10-a53c-3bb86695def0',
    'd6493930-e281-f3ab-68c1-1e260233fb7a': '4946550-d6493930-e281-f3ab-68c1-1e260233fb7a',
    'c00a0555-db57-f171-68f1-43c84bb816db': '4947777-c00a0555-db57-f171-68f1-43c84bb816db',
    'bc89531a-8e6d-fd2e-9a30-5c57e1eb6924': '4947865-bc89531a-8e6d-fd2e-9a30-5c57e1eb6924',
    'a57ce8f9-3229-f4f7-6913-2ec3b2ef4342': '4958066-a57ce8f9-3229-f4f7-6913-2ec3b2ef4342',
    '173bb620-0e75-f4a2-9c70-9e2f39cffc2e': '5025163-173bb620-0e75-f4a2-9c70-9e2f39cffc2e',
    '2d18f483-8a7c-ff5f-938b-8d9fac2fe046': '4840331-2d18f483-8a7c-ff5f-938b-8d9fac2fe046'
  };
  const EASYMUSIC_TIMER_MARGIN_SECONDS = 120;

  function getEasyMusicEmbedUrl(streamUrl) {
    const match = String(streamUrl || '').match(/\/(?:audios|origin)\/([a-f0-9-]+)\.(?:mp3|m4a)/i);
    const shareId = match ? EASYMUSIC_SHARE_IDS_BY_CONTENT_ID[match[1].toLowerCase()] : '';
    return shareId ? `https://easymusic.ai/pt/music/${shareId}/embed` : '';
  }

  async function loadLocalLibrary() {
    try {
      const payload = await resolveLocalManifest();
      if (!payload) {
        throw new Error('Manifesto local nao encontrado');
      }
      const list = Array.isArray(payload) ? payload : (Array.isArray(payload.tracks) ? payload.tracks : []);
      state.tracks = sortTracksByTitle(list
        .map((item, index) => normalizeLocalTrack(item, index))
        .filter(Boolean));
    } catch (_manifestErr) {
      state.tracks = [];
    }

    setRuntimeMode('local');
    renderLibrary();
    renderQueue();
    renderPlaylistDetail();
    updateDeleteButtonState();
    state.localDurationJobId += 1;
    if (shouldHydrateLocalDurations()) {
      hydrateLocalDurations(state.localDurationJobId);
    }
  }

  const state = {
    tracks: [],
    queue: [],
    currentIndex: -1,
    currentTrackId: null,
    playRequestId: 0,
    lastPlaybackFailureKey: '',
    playbackFailureCounts: {},
    selectedTrackId: null,
    selectedPlaylistTrackId: null,
    libraryQuery: '',
    playlists: [],
    currentPlaylistId: null,
    isShuffle: false,
    repeatMode: 'off',
    shuffleBag: [],
    runtimeMode: 'api',
    localBasePath: '',
    localDurationJobId: 0,
    themeName: 'minimal',
    layoutName: 'compact',
    playbackModelId: PLAYBACK_MODELS[0].id,
    isAppearanceOpen: false,
    appearanceListenersBound: false,
    bodyOverflowBeforeAppearance: '',
    currentView: 'queue',
    youtubePlayer: null,
    youtubeApiPromise: null,
    youtubeVideoId: '',
    externalEmbedUrl: '',
    externalPlayerPanel: null,
    externalPlayerFrame: null,
    externalAdvanceTimer: null,
    externalAdvanceDeadline: 0,
    vuLevels: { left: 0, right: 0, mix: 0 },
    audio: new Audio()
  };

  state.audio.preload = 'auto';
  state.audio.playsInline = true;

  const STORAGE_KEYS = {
    volume: 'playerVolume',
    turboGain: 'playerTurboGain',
    localDurations: 'localTrackDurationsV1',
    playbackModel: 'playerPlaybackModel',
    theme: 'player_theme',
    layout: 'player_layout',
    visualizer: 'player_corner_glow',
    youtubeUrl: 'playerYouTubeUrl',
    youtubeVolume: 'playerYouTubeVolume'
  };

  const els = {
    player: document.querySelector('.player'),
    queueTable: document.querySelector('#queueTable tbody'),
    libraryTable: document.querySelector('#libraryTable tbody'),
    nowPlaying: document.querySelector('#nowPlaying'),
    vinylLabel: document.querySelector('#vinylLabel'),
    vinylLed: document.querySelector('#vinylLed'),
    playbackModelActive: document.querySelector('#playbackModelActive'),
    playbackModelQuick: document.querySelector('#playbackModelQuick'),
    clearQueue: document.querySelector('#clearQueue'),
    addSelected: document.querySelector('#addSelected'),
    addMenu: document.querySelector('#addMenu'),
    addMenuPlaylists: document.querySelector('#addMenuPlaylists'),
    refreshLibrary: document.querySelector('#refreshLibrary'),
    librarySearch: document.querySelector('#librarySearch'),
    navItems: Array.from(document.querySelectorAll('.nav-item[data-view]')),
    queueView: document.querySelector('#queueView'),
    libraryView: document.querySelector('#libraryView'),
    youtubeView: document.querySelector('#youtubeView'),
    youtubeForm: document.querySelector('#youtubeForm'),
    youtubeUrl: document.querySelector('#youtubeUrl'),
    youtubeStatus: document.querySelector('#youtubeStatus'),
    youtubePlayer: document.querySelector('#youtubePlayer'),
    youtubePlayButton: document.querySelector('#youtubePlayButton'),
    youtubePauseButton: document.querySelector('#youtubePauseButton'),
    youtubeVolume: document.querySelector('#youtubeVolume'),
    playlistsView: document.querySelector('#playlistsView'),
    settingsView: document.querySelector('#settingsView'),
    playlistList: document.querySelector('#playlistList'),
    newPlaylist: document.querySelector('#newPlaylist'),
    mainTitle: document.querySelector('#mainTitle'),
    uploadAction: document.querySelector('#uploadAction'),
    uploadButton: document.querySelector('#uploadButton'),
    deleteTrackButton: document.querySelector('#deleteTrackButton'),
    uploadInput: document.querySelector('#uploadInput'),
    uploadStatus: document.querySelector('#uploadStatus'),
    playlistName: document.querySelector('#playlistName'),
    playlistTracksTable: document.querySelector('#playlistTracksTable tbody'),
    playPlaylist: document.querySelector('#playPlaylist'),
    addToPlaylist: document.querySelector('#addToPlaylist'),
    removeFromPlaylist: document.querySelector('#removeFromPlaylist'),
    defaultVolume: document.querySelector('#defaultVolume'),
    themeMode: document.querySelector('#themeMode'),
    themeSelect: document.querySelector('#appearanceThemeSelect'),
    layoutSelect: document.querySelector('#appearanceLayoutSelect'),
    appearanceModelSelect: document.querySelector('#appearanceModelSelect'),
    themeDot: document.querySelector('#themeDot'),
    appearanceButton: document.querySelector('#appearanceButton'),
    appearanceModal: document.querySelector('#appearanceModal'),
    appearanceOverlay: document.querySelector('#appearanceOverlay'),
    appearancePanel: document.querySelector('.appearance-panel'),
    appearanceClose: document.querySelector('#appearanceClose'),
    visualizerToggle: document.querySelector('#cornerGlowToggle'),
    vuLeft: document.querySelector('#vuLeft'),
    vuRight: document.querySelector('#vuRight'),
    playbackModel: document.querySelector('#playbackModel'),
    playbackModelDescription: document.querySelector('#playbackModelDescription'),
    btnPlay: document.querySelector('#btnPlay'),
    btnStop: document.querySelector('#btnStop'),
    btnPrev: document.querySelector('#btnPrev'),
    btnNext: document.querySelector('#btnNext'),
    btnShuffle: document.querySelector('#btnShuffle'),
    btnRepeat: document.querySelector('#btnRepeat'),
    seekBar: document.querySelector('#seekBar'),
    currentTime: document.querySelector('#currentTime'),
    duration: document.querySelector('#duration'),
    volume: document.querySelector('#volume'),
    turboGain: document.querySelector('#turboGain')
  };

  function formatSeconds(sec) {
    if (!sec && sec !== 0) return '—';
    const minutes = Math.floor(sec / 60);
    const seconds = Math.floor(sec % 60)
      .toString()
      .padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function extractYouTubeVideoId(rawValue) {
    const value = String(rawValue || '').trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(value)) {
      return value;
    }

    const match = value.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    if (match) {
      return match[1];
    }

    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, '');
      if ((host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') && url.searchParams.get('v')) {
        return url.searchParams.get('v').slice(0, 11);
      }
      if (host === 'youtu.be') {
        return url.pathname.split('/').filter(Boolean)[0] || '';
      }
    } catch (_err) {
      return '';
    }

    return '';
  }

  function setYouTubeStatus(message) {
    if (els.youtubeStatus) {
      els.youtubeStatus.textContent = message;
    }
  }

  function loadYouTubeApi() {
    if (window.YT && typeof window.YT.Player === 'function') {
      return Promise.resolve(window.YT);
    }
    if (state.youtubeApiPromise) {
      return state.youtubeApiPromise;
    }

    state.youtubeApiPromise = new Promise((resolve, reject) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previousReady === 'function') {
          previousReady();
        }
        resolve(window.YT);
      };

      if (document.querySelector('script[data-youtube-api="true"]')) {
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.youtubeApi = 'true';
      script.onerror = () => reject(new Error('Falha ao carregar API do YouTube'));
      document.head.appendChild(script);
    });

    return state.youtubeApiPromise;
  }

  function applyYouTubeVolume() {
    const value = Math.max(0, Math.min(100, Number(els.youtubeVolume?.value || 100)));
    if (state.youtubePlayer && typeof state.youtubePlayer.setVolume === 'function') {
      state.youtubePlayer.setVolume(value);
    }
    localStorage.setItem(STORAGE_KEYS.youtubeVolume, String(value));
    syncRangeVisuals();
  }

  function renderYouTubeFallback(videoId) {
    if (!els.youtubePlayer) return;
    els.youtubePlayer.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&playsinline=1&rel=0`;
    iframe.title = 'Player do YouTube';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    els.youtubePlayer.appendChild(iframe);
  }

  async function loadYouTubeVideo(rawValue) {
    const videoId = extractYouTubeVideoId(rawValue);
    if (!videoId || videoId.length !== 11) {
      setYouTubeStatus('Link do YouTube invalido.');
      return;
    }

    state.youtubeVideoId = videoId;
    localStorage.setItem(STORAGE_KEYS.youtubeUrl, String(rawValue || videoId));
    setYouTubeStatus('Carregando video...');

    try {
      const YT = await loadYouTubeApi();
      if (state.youtubePlayer && typeof state.youtubePlayer.loadVideoById === 'function') {
        state.youtubePlayer.loadVideoById(videoId);
        applyYouTubeVolume();
        setYouTubeStatus('Video carregado.');
        return;
      }

      state.youtubePlayer = new YT.Player('youtubePlayer', {
        width: '100%',
        height: '100%',
        videoId,
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1
        },
        events: {
          onReady: () => {
            applyYouTubeVolume();
            setYouTubeStatus('Video carregado.');
          },
          onStateChange: (event) => {
            if (window.YT && event.data === window.YT.PlayerState.PLAYING && !state.audio.paused) {
              state.audio.pause();
            }
            if (window.YT && event.data === window.YT.PlayerState.PLAYING && neonVisualizer) {
              setPlayButton(true);
              neonVisualizer.start({ simulated: true });
            }
            if (window.YT && (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.ENDED
            ) && neonVisualizer) {
              neonVisualizer.stop();
              setPlayButton(false);
            }
          }
        }
      });
    } catch (_err) {
      renderYouTubeFallback(videoId);
      setYouTubeStatus('Video carregado. Controle de volume do YouTube indisponivel sem a API.');
    }
  }

  function initYouTube() {
    if (els.youtubeVolume) {
      const savedVolume = Number(localStorage.getItem(STORAGE_KEYS.youtubeVolume));
      els.youtubeVolume.value = Number.isFinite(savedVolume) ? Math.max(0, Math.min(100, savedVolume)) : 100;
    }
    if (els.youtubeUrl) {
      els.youtubeUrl.value = localStorage.getItem(STORAGE_KEYS.youtubeUrl) || '';
    }
    syncRangeVisuals();
  }

  function paintRangeFill(rangeElement, valuePct) {
    if (!rangeElement) return;
    const pct = Math.min(100, Math.max(0, Number(valuePct) || 0));
    const fill = `linear-gradient(to right, var(--progressFill) 0%, var(--progressFill) ${pct}%, var(--progressBg) ${pct}%, var(--progressBg) 100%)`;
    const isStudio = ROOT.classList.contains('theme-studio');

    if (!isStudio) {
      rangeElement.style.background = fill;
      return;
    }

    const isVolumeSlider = rangeElement === els.volume || rangeElement === els.defaultVolume || rangeElement === els.turboGain;
    const tickSize = isVolumeSlider ? 18 : 24;
    const ticks = `repeating-linear-gradient(90deg, transparent 0 ${tickSize}px, var(--tick) ${tickSize}px ${tickSize + 1}px)`;
    rangeElement.style.background = `${ticks}, ${fill}`;
  }

  function syncRangeVisuals() {
    paintRangeFill(els.seekBar, Number(els.seekBar?.value || 0));
    paintRangeFill(els.volume, Number(els.volume?.value || 0) * 100);
    if (els.defaultVolume) {
      paintRangeFill(els.defaultVolume, Number(els.defaultVolume.value || 0) * 100);
    }
    if (els.turboGain) {
      paintRangeFill(els.turboGain, (Number(els.turboGain.value || 1) - 1) / 3 * 100);
    }
    if (els.youtubeVolume) {
      paintRangeFill(els.youtubeVolume, Number(els.youtubeVolume.value || 0));
    }
  }

  function updatePlayerReservedHeight() {
    if (!els.player) return;
    const rect = els.player.getBoundingClientRect();
    const height = Math.ceil(rect.height || els.player.offsetHeight || 0);
    if (height > 0) {
      ROOT.style.setProperty('--player-reserved-height', `${height + 28}px`);
    }
  }

  function schedulePlayerReservedHeightUpdate() {
    if (playerReserveFrame) {
      cancelAnimationFrame(playerReserveFrame);
    }
    playerReserveFrame = requestAnimationFrame(() => {
      playerReserveFrame = 0;
      updatePlayerReservedHeight();
    });
  }

  function initPlayerReservedHeight() {
    schedulePlayerReservedHeightUpdate();
    window.addEventListener('resize', schedulePlayerReservedHeightUpdate);

    if ('ResizeObserver' in window && els.player) {
      playerResizeObserver = new ResizeObserver(schedulePlayerReservedHeightUpdate);
      playerResizeObserver.observe(els.player);
    }
  }

  function getTrackById(id) {
    return state.tracks.find((track) => track.id === id) || null;
  }

  function sortTracksByTitle(tracks) {
    return [...tracks].sort((a, b) => {
      const titleA = String(a?.title || a?.filename || '').trim();
      const titleB = String(b?.title || b?.filename || '').trim();
      return titleA.localeCompare(titleB, 'pt-BR', { sensitivity: 'base', numeric: true });
    });
  }

  function buildLocalStreamUrl(filename) {
    const encodedPath = String(filename || '')
      .split('/')
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join('/');
    const basePath = state.localBasePath || '';
    return new URL(`${basePath}music/${encodedPath}`, window.location.href).toString();
  }

  async function resolveLocalManifest() {
    for (const basePath of LOCAL_PATH_CANDIDATES) {
      const manifestUrl = new URL(`${basePath}music/tracks.json`, window.location.href).toString();
      try {
        const resp = await fetch(manifestUrl, { cache: 'no-store' });
        if (!resp.ok) continue;
        const payload = await resp.json();
        state.localBasePath = basePath;
        return payload;
      } catch (_err) {
        // tenta o próximo caminho
      }
    }

    return null;
  }

  function normalizeLocalTrack(item, index) {
    if (!item) return null;
    const raw = typeof item === 'string' ? { filename: item } : item;
    const filename = String(raw.filename || raw.file || '').trim();
    if (!filename) return null;

    const parsedName = filename.split('/').pop() || filename;
    const titleFromFile = parsedName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();

    const streamUrl = raw.streamUrl || buildLocalStreamUrl(filename);
    return {
      id: String(raw.id || `local-${index}-${filename.toLowerCase()}`),
      filename,
      title: raw.title || titleFromFile || `Faixa ${index + 1}`,
      artist: raw.artist || 'Artista desconhecido',
      album: raw.album || 'Sem álbum',
      durationSec: Number(raw.durationSec) || 0,
      streamUrl,
      embedUrl: raw.embedUrl || getEasyMusicEmbedUrl(streamUrl)
    };
  }

  function ensureExternalPlayerPanel() {
    if (state.externalPlayerPanel) return state.externalPlayerPanel;
    const panel = document.createElement('div');
    panel.className = 'external-track-modal hidden';
    panel.innerHTML = `
      <div class="external-track-backdrop" data-close-external-player></div>
      <section class="external-track-dialog" role="dialog" aria-modal="true" aria-label="Player EasyMusic">
        <div class="external-track-header">
          <strong>Player da música</strong>
          <button type="button" class="ghost" data-close-external-player>Fechar</button>
        </div>
        <iframe title="Player EasyMusic" allow="autoplay; web-share" sandbox="allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"></iframe>
      </section>`;
    document.body.appendChild(panel);
    panel.querySelectorAll('[data-close-external-player]').forEach((button) => {
      button.addEventListener('click', closeExternalPlayer);
    });
    state.externalPlayerPanel = panel;
    state.externalPlayerFrame = panel.querySelector('iframe');
    return panel;
  }

  function clearExternalAdvanceTimer() {
    if (state.externalAdvanceTimer) {
      window.clearTimeout(state.externalAdvanceTimer);
      state.externalAdvanceTimer = null;
    }
    state.externalAdvanceDeadline = 0;
  }

  function scheduleExternalAdvance(track) {
    clearExternalAdvanceTimer();
    const durationSeconds = Number(track?.durationSec) || 0;
    if (durationSeconds <= 0) {
      setUploadStatus('Toque no Play do EasyMusic. Use Próxima quando a música terminar.');
      return;
    }

    const waitSeconds = Math.ceil(durationSeconds + EASYMUSIC_TIMER_MARGIN_SECONDS);
    state.externalAdvanceDeadline = Date.now() + (waitSeconds * 1000);
    state.externalAdvanceTimer = window.setTimeout(() => {
      state.externalAdvanceTimer = null;
      state.externalAdvanceDeadline = 0;
      if (state.currentTrackId !== track.id) return;
      nextTrack(false, { reason: 'easymusic-timer', allowAutoSkip: true });
    }, waitSeconds * 1000);

    setUploadStatus(`Toque no Play do EasyMusic. A próxima faixa será aberta em aproximadamente ${formatSeconds(waitSeconds)}.`);
  }

  function openExternalPlayer(track) {
    if (!track?.embedUrl) return false;
    const panel = ensureExternalPlayerPanel();
    if (state.externalEmbedUrl !== track.embedUrl) {
      state.externalPlayerFrame.src = track.embedUrl;
      state.externalEmbedUrl = track.embedUrl;
    }
    panel.classList.remove('hidden');
    scheduleExternalAdvance(track);
    setPlayButton(true);
    return true;
  }

  function closeExternalPlayer() {
    clearExternalAdvanceTimer();
    if (!state.externalPlayerPanel) return;
    state.externalPlayerPanel.classList.add('hidden');
    setPlayButton(false);
  }

  function readLocalDurationCache() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.localDurations);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_err) {
      return {};
    }
  }

  function writeLocalDurationCache(cache) {
    try {
      localStorage.setItem(STORAGE_KEYS.localDurations, JSON.stringify(cache));
    } catch (_err) {
      return;
    }
  }

  function getDurationCacheKey(track) {
    return String(track?.filename || '').trim().toLowerCase();
  }

  function loadAudioDurationSeconds(streamUrl, timeoutMs = 12000) {
    return new Promise((resolve) => {
      const audio = new Audio();
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        window.clearTimeout(timeoutId);
        audio.onloadedmetadata = null;
        audio.onerror = null;
        audio.onabort = null;
        audio.src = '';
        resolve(Number.isFinite(value) && value > 0 ? value : 0);
      };
      const timeoutId = window.setTimeout(() => finish(0), timeoutMs);
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => finish(Math.round(audio.duration || 0));
      audio.onerror = () => finish(0);
      audio.onabort = () => finish(0);
      audio.src = streamUrl;
    });
  }

  function shouldHydrateLocalDurations() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isTouchPhone = window.matchMedia('(pointer: coarse)').matches
      && Math.min(window.screen.width, window.screen.height) < 900;
    const isLimitedConnection = Boolean(connection?.saveData)
      || ['slow-2g', '2g', '3g'].includes(String(connection?.effectiveType || '').toLowerCase());
    return !isTouchPhone && !isLimitedConnection;
  }

  async function hydrateLocalDurations(jobId) {
    if (state.runtimeMode !== 'local') return;
    if (jobId !== state.localDurationJobId) return;

    const cache = readLocalDurationCache();
    let changedFromCache = false;

    state.tracks.forEach((track) => {
      if ((track.durationSec || 0) > 0) return;
      const key = getDurationCacheKey(track);
      const cached = Number(cache[key]);
      if (Number.isFinite(cached) && cached > 0) {
        track.durationSec = cached;
        changedFromCache = true;
      }
    });

    if (changedFromCache) {
      renderLibrary();
      renderQueue();
      renderPlaylistDetail();
      updateNowPlaying();
    }

    let changed = false;
    for (const track of state.tracks) {
      if (jobId !== state.localDurationJobId) return;
      // Não disputa a conexão com a música que o usuário acabou de iniciar.
      if (!state.audio.paused) return;
      if ((track.durationSec || 0) > 0) continue;
      const duration = await loadAudioDurationSeconds(track.streamUrl);
      if (duration <= 0) continue;
      track.durationSec = duration;
      cache[getDurationCacheKey(track)] = duration;
      changed = true;
    }

    if (!changed) return;
    writeLocalDurationCache(cache);
    if (jobId !== state.localDurationJobId) return;
    renderLibrary();
    renderQueue();
    renderPlaylistDetail();
    updateNowPlaying();
  }

  function setRuntimeMode(mode) {
    state.runtimeMode = mode;
    const isLocal = mode === 'local';
    ROOT.classList.toggle('runtime-local', isLocal);
    if (els.uploadAction) {
      els.uploadAction.classList.toggle('is-local', isLocal);
      els.uploadAction.tabIndex = isLocal ? 0 : -1;
      els.uploadAction.setAttribute(
        'aria-label',
        isLocal ? 'Adicionar arquivos indisponivel: requer o servidor local ativo' : 'Adicionar arquivos'
      );
    }
    if (els.uploadButton) {
      els.uploadButton.title = isLocal
        ? 'Upload requer o servidor local ativo'
        : 'Adicionar arquivo(s)';
      if (isLocal) {
        els.uploadButton.setAttribute('aria-describedby', 'uploadLocalHint');
      } else {
        els.uploadButton.removeAttribute('aria-describedby');
      }
    }
    els.uploadButton.disabled = isLocal;
    els.deleteTrackButton.disabled = isLocal || !state.selectedTrackId;
    els.newPlaylist.disabled = isLocal;
    els.playPlaylist.disabled = isLocal;
    els.addToPlaylist.disabled = isLocal;
    els.removeFromPlaylist.disabled = isLocal;
    if (isLocal) {
      setUploadStatus('Modo local ativo (sem backend): upload/exclusão/playlists desabilitados');
    }
  }

  function createCoverElement(trackId) {
    const cover = document.createElement('div');
    cover.className = 'cover';
    const track = getTrackById(trackId);
    if (track?.coverUrl) {
      cover.style.backgroundImage = `url("${track.coverUrl}")`;
      cover.classList.add('cover-loaded');
      return cover;
    }
    if (state.runtimeMode === 'local') {
      cover.classList.add('cover-fallback');
      return cover;
    }
    const img = new Image();
    img.onload = () => {
      cover.style.backgroundImage = `url("${apiUrl(`/api/cover/${encodeURIComponent(trackId)}`)}")`;
      cover.classList.add('cover-loaded');
    };
    img.onerror = () => {
      cover.classList.add('cover-fallback');
    };
    img.src = apiUrl(`/api/cover/${encodeURIComponent(trackId)}`);
    return cover;
  }

  function setPlayButton(isPlaying) {
    els.btnPlay.textContent = isPlaying ? '❚❚' : '►';
    els.btnPlay.classList.toggle('active', isPlaying);
    document.body.classList.toggle('player-paused', !isPlaying);
    if (els.player) {
      els.player.classList.toggle('is-playing', isPlaying);
    }
    if (els.vinylLed) {
      els.vinylLed.setAttribute('aria-label', isPlaying ? 'status play' : 'status pause');
    }
    if (neonVisualizer) {
      if (isPlaying) {
        neonVisualizer.start();
      } else {
        neonVisualizer.stop();
      }
    }
    updateVuMeters();
  }

  function updateVuMeters() {
    if (!els.vuLeft && !els.vuRight) return;
    const gain = Math.max(1, Math.min(4, Number(els.turboGain?.value || 1)));
    const gainScale = 1 + (gain - 1) * 0.22;
    const idleLevel = state.audio.paused ? 0.02 : 0.04;
    const leftLevel = Math.min(1, Math.max(idleLevel, state.vuLevels.left * gainScale));
    const rightLevel = Math.min(1, Math.max(idleLevel, state.vuLevels.right * gainScale));

    if (els.vuLeft) {
      els.vuLeft.style.setProperty('--vu-level', String(leftLevel));
    }
    if (els.vuRight) {
      els.vuRight.style.setProperty('--vu-level', String(rightLevel));
    }
  }

  function updateVinylLabel(track, trackId) {
    if (!els.vinylLabel) return;

    const fallbackText = track?.title
      ? track.title.slice(0, 2).toUpperCase()
      : 'VP';

    if (!track || !trackId || state.runtimeMode === 'local') {
      els.vinylLabel.innerHTML = '';
      els.vinylLabel.textContent = fallbackText;
      return;
    }

    const coverUrl = apiUrl(`/api/cover/${encodeURIComponent(trackId)}`);
    const image = new Image();
    image.alt = track.title || 'Capa da música';
    image.loading = 'lazy';
    image.addEventListener('load', () => {
      if (!els.vinylLabel) return;
      els.vinylLabel.innerHTML = '';
      els.vinylLabel.appendChild(image);
    });
    image.addEventListener('error', () => {
      if (!els.vinylLabel) return;
      els.vinylLabel.innerHTML = '';
      els.vinylLabel.textContent = fallbackText;
    });
    image.src = coverUrl;
  }

  function setTheme(name, persist = true) {
    const normalized = THEME_NAMES.includes(name) ? name : 'minimal';
    state.themeName = normalized;

    for (const themeName of THEME_NAMES) {
      ROOT.classList.remove(`theme-${themeName}`);
    }
    ROOT.classList.add(`theme-${normalized}`);

    const tokens = APPEARANCE_THEMES[normalized] || APPEARANCE_THEMES.minimal;
    Object.entries(tokens).forEach(([token, value]) => {
      ROOT.style.setProperty(token, String(value));
    });

    if (els.themeSelect) {
      els.themeSelect.value = normalized;
    }
    if (els.themeMode) {
      els.themeMode.value = normalized;
    }
    if (els.themeDot) {
      const accent = tokens['--accent'] || '#2b6cb0';
      const accent2 = tokens['--accent2'] || accent;
      if (normalized === 'neon' || normalized === 'glass') {
        els.themeDot.style.background = `linear-gradient(90deg, ${accent2}, ${accent})`;
      } else {
        els.themeDot.style.background = String(accent);
      }
    }
    if (persist) {
      localStorage.setItem(STORAGE_KEYS.theme, normalized);
    }
    if (neonVisualizer) {
      neonVisualizer.refreshTheme();
    }
    syncRangeVisuals();
    schedulePlayerReservedHeightUpdate();
  }

  function initNeonVisualizer() {
    if (typeof window.initVisualizer !== 'function') {
      return;
    }

    neonVisualizer = window.initVisualizer(state.audio);
    const saved = localStorage.getItem(STORAGE_KEYS.visualizer);
    const isEnabled = saved !== 'off';

    if (els.visualizerToggle) {
      els.visualizerToggle.checked = isEnabled;
    }

    neonVisualizer.setEnabled(isEnabled);
    neonVisualizer.refreshTheme();

    if (!state.audio.paused && isEnabled) {
      neonVisualizer.start();
    }
  }

  function setLayout(name, persist = true) {
    const normalized = LAYOUT_NAMES.includes(name) ? name : 'compact';
    state.layoutName = normalized;

    for (const layoutName of LAYOUT_NAMES) {
      ROOT.classList.remove(`layout-${layoutName}`);
    }
    ROOT.classList.add(`layout-${normalized}`);

    if (els.layoutSelect) {
      els.layoutSelect.value = normalized;
    }
    if (persist) {
      localStorage.setItem(STORAGE_KEYS.layout, normalized);
    }
    if (neonVisualizer) {
      neonVisualizer.refreshTheme();
    }
    schedulePlayerReservedHeightUpdate();
  }

  function initAppearance() {
    if (els.themeSelect) {
      els.themeSelect.innerHTML = '';
      THEME_NAMES.forEach((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = THEME_LABELS[name] || name;
        els.themeSelect.appendChild(option);
      });
    }

    if (els.themeMode) {
      els.themeMode.innerHTML = '';
      THEME_NAMES.forEach((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = THEME_LABELS[name] || name;
        els.themeMode.appendChild(option);
      });
    }

    initTheme();
    const savedLayout = localStorage.getItem(STORAGE_KEYS.layout);
    setLayout(savedLayout || 'compact', false);
  }

  function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
    setTheme(savedTheme || 'minimal', false);
  }

  function openAppearance() {
    if (!els.appearanceModal || state.isAppearanceOpen) return;
    state.bodyOverflowBeforeAppearance = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    els.appearanceModal.classList.remove('hidden');
    els.appearanceModal.setAttribute('aria-hidden', 'false');
    state.isAppearanceOpen = true;
  }

  function closeAppearance() {
    if (!els.appearanceModal) return;
    els.appearanceModal.classList.add('hidden');
    els.appearanceModal.setAttribute('aria-hidden', 'true');
    if (state.isAppearanceOpen) {
      document.body.style.overflow = state.bodyOverflowBeforeAppearance || '';
    }
    state.isAppearanceOpen = false;
  }

  function setAppearanceModalOpen(isOpen) {
    if (isOpen) {
      openAppearance();
      return;
    }
    closeAppearance();
  }

  function bindAppearanceModalEvents() {
    if (state.appearanceListenersBound) return;

    if (els.appearanceButton) {
      els.appearanceButton.addEventListener('click', (event) => {
        event.preventDefault();
        openAppearance();
      });
    }

    if (els.appearanceClose) {
      els.appearanceClose.addEventListener('click', (event) => {
        event.preventDefault();
        closeAppearance();
      });
    }

    if (els.appearanceOverlay) {
      els.appearanceOverlay.addEventListener('click', () => {
        closeAppearance();
      });
    }

    if (els.appearancePanel) {
      els.appearancePanel.addEventListener('click', (event) => {
        event.stopPropagation();
      });
    }

    if (els.appearanceModal && !els.appearanceOverlay) {
      els.appearanceModal.addEventListener('click', (event) => {
        if (!els.appearancePanel?.contains(event.target)) {
          closeAppearance();
        }
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.isAppearanceOpen) {
        closeAppearance();
      }
    });

    state.appearanceListenersBound = true;
  }

  function setUploadStatus(message) {
    if (!els.uploadStatus) return;
    els.uploadStatus.textContent = message;
  }

  function updateDeleteButtonState() {
    const isTrackView = state.currentView === 'queue' || state.currentView === 'library';
    const hasSelection = !!state.selectedTrackId;
    const selectedTrack = hasSelection ? getTrackById(state.selectedTrackId) : null;
    els.deleteTrackButton.disabled = state.runtimeMode === 'local' || selectedTrack?.sourceType === 'easymusic' || !(isTrackView && hasSelection);
  }

  function renderQueue() {
    els.queueTable.innerHTML = '';
    if (state.queue.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td class="empty" colspan="5">Fila vazia</td>';
      els.queueTable.appendChild(row);
      return;
    }
    state.queue.forEach((trackId, idx) => {
      const track = getTrackById(trackId);
      const tr = document.createElement('tr');
      tr.dataset.index = idx;
      tr.dataset.id = trackId;
      tr.classList.toggle('row-playing', trackId === state.currentTrackId);
      tr.classList.toggle('row-selected', trackId === state.selectedTrackId);
      tr.innerHTML = `
        <td class="icon"></td>
        <td>${track ? track.title : 'Arquivo nao encontrado'}</td>
        <td>${track ? track.artist : '—'}</td>
        <td>${track ? track.album : '—'}</td>
        <td>${track ? formatSeconds(track.durationSec) : '—'}</td>
      `;
      if (track) {
        tr.querySelector('.icon').appendChild(createCoverElement(trackId));
      } else {
        const cover = document.createElement('div');
        cover.className = 'cover cover-fallback';
        tr.querySelector('.icon').appendChild(cover);
      }
      tr.addEventListener('click', () => {
        state.selectedTrackId = trackId;
        playQueueIndex(idx);
        updateDeleteButtonState();
        renderQueue();
      });
      els.queueTable.appendChild(tr);
    });
  }

  function renderLibrary() {
    els.libraryTable.innerHTML = '';
    const query = state.libraryQuery.trim().toLowerCase();
    const filtered = query
      ? state.tracks.filter((track) => (
        track.title.toLowerCase().includes(query)
        || track.artist.toLowerCase().includes(query)
        || track.album.toLowerCase().includes(query)
      ))
      : state.tracks;

    if (filtered.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td class="empty" colspan="5">Nenhuma musica encontrada</td>';
      els.libraryTable.appendChild(row);
      return;
    }

    filtered.forEach((track) => {
      const idx = state.tracks.findIndex((item) => item.id === track.id);
      const tr = document.createElement('tr');
      tr.dataset.index = idx;
      tr.dataset.id = track.id;
      tr.classList.toggle('row-playing', track.id === state.currentTrackId);
      tr.classList.toggle('row-selected', track.id === state.selectedTrackId);
      tr.innerHTML = `
        <td class="icon"></td>
        <td>${track.title}</td>
        <td>${track.artist}</td>
        <td>${track.album}</td>
        <td>${formatSeconds(track.durationSec)}</td>
      `;
      tr.querySelector('.icon').appendChild(createCoverElement(track.id));
      tr.addEventListener('click', () => {
        state.selectedTrackId = track.id;
        playFromIndex(idx);
        updateDeleteButtonState();
        renderLibrary();
      });
      els.libraryTable.appendChild(tr);
    });
  }

  function renderPlaylistList() {
    els.playlistList.innerHTML = '';
    if (state.playlists.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'Nenhuma playlist criada';
      els.playlistList.appendChild(empty);
      return;
    }
    state.playlists.forEach((playlist) => {
      const item = document.createElement('li');
      item.className = 'playlist-item';
      if (playlist.id === state.currentPlaylistId) {
        item.classList.add('active');
      }
      item.textContent = playlist.name;
      item.addEventListener('click', () => {
        state.currentPlaylistId = playlist.id;
        localStorage.setItem('lastPlaylistId', playlist.id);
        renderPlaylistList();
        renderPlaylistDetail();
        renderAddMenuPlaylists();
      });
      els.playlistList.appendChild(item);
    });
  }

  function renderPlaylistDetail() {
    const playlist = state.playlists.find((item) => item.id === state.currentPlaylistId);
    if (!playlist) {
      els.playlistName.textContent = 'Selecione uma playlist';
      els.playlistTracksTable.innerHTML = '';
      return;
    }
    els.playlistName.textContent = playlist.name;
    els.playlistTracksTable.innerHTML = '';
    if (playlist.trackIds.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td class="empty" colspan="5">Playlist vazia</td>';
      els.playlistTracksTable.appendChild(row);
      return;
    }
    playlist.trackIds.forEach((trackId) => {
      const track = getTrackById(trackId);
      const tr = document.createElement('tr');
      tr.dataset.id = trackId;
      tr.classList.toggle('row-selected', trackId === state.selectedPlaylistTrackId);
      tr.innerHTML = `
        <td class="icon"></td>
        <td>${track ? track.title : 'Arquivo nao encontrado'}</td>
        <td>${track ? track.artist : '—'}</td>
        <td>${track ? track.album : '—'}</td>
        <td>${track ? formatSeconds(track.durationSec) : '—'}</td>
      `;
      if (track) {
        tr.querySelector('.icon').appendChild(createCoverElement(trackId));
      } else {
        const cover = document.createElement('div');
        cover.className = 'cover cover-fallback';
        tr.querySelector('.icon').appendChild(cover);
      }
      tr.addEventListener('click', () => {
        state.selectedPlaylistTrackId = trackId;
        renderPlaylistDetail();
      });
      els.playlistTracksTable.appendChild(tr);
    });
  }

  function renderAddMenuPlaylists() {
    els.addMenuPlaylists.innerHTML = '';
    if (state.playlists.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'menu-title';
      empty.textContent = 'Nenhuma playlist';
      els.addMenuPlaylists.appendChild(empty);
      return;
    }
    state.playlists.forEach((playlist) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = playlist.name;
      button.addEventListener('click', () => {
        addSelectedToPlaylist(playlist.id);
        hideAddMenu();
      });
      els.addMenuPlaylists.appendChild(button);
    });
  }

  function updateNowPlaying() {
    const trackId = state.currentTrackId;
    const track = trackId ? getTrackById(trackId) : null;
    if (!track) {
      els.nowPlaying.textContent = 'Nenhuma faixa selecionada';
      updateVinylLabel(null, null);
      els.duration.textContent = '0:00';
      els.currentTime.textContent = '0:00';
      els.seekBar.value = 0;
      syncRangeVisuals();
      return;
    }
    updateVinylLabel(track, trackId);
    els.nowPlaying.textContent = `${track.title} — ${track.artist}`;
    els.duration.textContent = formatSeconds(track.durationSec || state.audio.duration || 0);
  }

  function renderPlaybackModels() {
    if (els.playbackModel) {
      els.playbackModel.innerHTML = '';
    }
    if (els.playbackModelQuick) {
      els.playbackModelQuick.innerHTML = '';
    }
    if (els.appearanceModelSelect) {
      els.appearanceModelSelect.innerHTML = '';
    }
    PLAYBACK_MODELS.forEach((model) => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      if (els.playbackModel) {
        els.playbackModel.appendChild(option);
      }
      if (els.playbackModelQuick) {
        const quickOption = document.createElement('option');
        quickOption.value = model.id;
        quickOption.textContent = model.name;
        els.playbackModelQuick.appendChild(quickOption);
      }
      if (els.appearanceModelSelect) {
        const modalOption = document.createElement('option');
        modalOption.value = model.id;
        modalOption.textContent = model.name;
        els.appearanceModelSelect.appendChild(modalOption);
      }
    });
  }

  function applyPlaybackModel(modelId, persist = true) {
    const selected = PLAYBACK_MODELS.find((model) => model.id === modelId) || PLAYBACK_MODELS[0];
    state.playbackModelId = selected.id;
    if (els.playbackModel) {
      els.playbackModel.value = selected.id;
    }
    if (els.playbackModelQuick) {
      els.playbackModelQuick.value = selected.id;
    }
    if (els.appearanceModelSelect) {
      els.appearanceModelSelect.value = selected.id;
    }
    if (els.player) {
      els.player.dataset.model = selected.id;
    }
    if (els.playbackModelActive) {
      els.playbackModelActive.textContent = `Modelo: ${selected.name}`;
    }
    if (els.playbackModelDescription) {
      els.playbackModelDescription.textContent = selected.description;
    }
    if (persist) {
      localStorage.setItem(STORAGE_KEYS.playbackModel, selected.id);
    }
    if (neonVisualizer) {
      neonVisualizer.refreshTheme();
    }
    updateNowPlaying();
    schedulePlayerReservedHeightUpdate();
  }

  function setQueueFromIndex(startIndex) {
    state.queue = state.tracks.map((track) => track.id);
    state.currentIndex = startIndex;
    resetShuffleBag();
  }

  function prepareInitialTrack() {
    if (state.currentTrackId || state.currentIndex !== -1 || state.tracks.length === 0) {
      return;
    }

    setQueueFromIndex(0);
    loadCurrentTrack(false);
  }

  function clearPlaybackErrorState() {
    state.lastPlaybackFailureKey = '';
    if (els.player) {
      els.player.classList.remove('player-error');
    }
  }

  function getPlaybackErrorMessage(error) {
    if (!error) return 'erro desconhecido';
    const code = Number(error.code);
    if (code === 1) return 'reproducao interrompida';
    if (code === 2) return 'falha de rede';
    if (code === 3) return 'arquivo corrompido ou incompleto';
    if (code === 4) return 'formato nao suportado pelo celular';
    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }
    return 'erro desconhecido';
  }

  function isAutoplayBlocked(error) {
    const name = String(error?.name || '');
    const message = String(error?.message || '').toLowerCase();
    return name === 'NotAllowedError' || message.includes('gesture') || message.includes('user activation');
  }

  function canAdvanceToAnotherTrack() {
    if (state.queue.length <= 1) return false;
    if (state.isShuffle) return true;
    if (state.currentIndex < state.queue.length - 1) return true;
    return state.repeatMode === 'all';
  }

  function handlePlaybackFailure(error, options = {}) {
    const trackId = options.trackId || state.currentTrackId;
    if (!trackId || trackId !== state.currentTrackId) return;

    const failureKey = [
      trackId,
      options.reason || 'playback',
      error?.name || '',
      Number.isFinite(Number(error?.code)) ? Number(error.code) : 'na'
    ].join(':');

    if (state.lastPlaybackFailureKey === failureKey) {
      return;
    }

    state.lastPlaybackFailureKey = failureKey;

    if (error?.name === 'AbortError') {
      return;
    }

    if (els.player) {
      els.player.classList.add('player-error');
    }
    setPlayButton(false);

    if (isAutoplayBlocked(error)) {
      setUploadStatus('O celular bloqueou a proxima faixa automaticamente. Toque em Play para continuar.');
      return;
    }

    const currentTrack = getTrackById(trackId);
    const failures = (state.playbackFailureCounts[trackId] || 0) + 1;
    state.playbackFailureCounts[trackId] = failures;
    const shouldSkip = options.allowAutoSkip && failures <= 2 && canAdvanceToAnotherTrack();

    if (shouldSkip) {
      setUploadStatus(`Falha ao tocar ${currentTrack?.title || 'a faixa atual'}. Pulando para a proxima.`);
      nextTrack(false, { userInitiated: false, allowAutoSkip: true, reason: 'playback-failure' });
      return;
    }

    setUploadStatus(`Nao foi possivel tocar ${currentTrack?.title || 'a faixa atual'}: ${getPlaybackErrorMessage(error)}.`);
  }

  async function playCurrentAudio(options = {}) {
    const trackId = options.trackId || state.currentTrackId;
    if (!trackId || trackId !== state.currentTrackId) return false;

    const currentTrack = getTrackById(trackId);
    if (currentTrack?.embedUrl) {
      return openExternalPlayer(currentTrack);
    }
    const requestId = ++state.playRequestId;

    try {
      const playResult = state.audio.play();
      if (playResult && typeof playResult.then === 'function') {
        await playResult;
      }
      if (requestId !== state.playRequestId || trackId !== state.currentTrackId) {
        return false;
      }
      delete state.playbackFailureCounts[trackId];
      clearPlaybackErrorState();
      setUploadStatus('');
      setPlayButton(true);
      return true;
    } catch (error) {
      if (requestId !== state.playRequestId || trackId !== state.currentTrackId) {
        return false;
      }
      handlePlaybackFailure(error, {
        trackId,
        reason: options.reason || 'play',
        allowAutoSkip: Boolean(options.allowAutoSkip)
      });
      return false;
    }
  }

  function loadCurrentTrack(autoplay = true, options = {}) {
    const currentId = state.queue[state.currentIndex];
    if (!currentId) return;
    state.currentTrackId = currentId;
    const currentTrack = getTrackById(currentId);
    closeExternalPlayer();
    state.playRequestId += 1;
    state.lastPlaybackFailureKey = '';

    if (currentTrack?.embedUrl) {
      state.audio.pause();
      state.audio.removeAttribute('src');
      state.audio.load();
      if (autoplay) {
        openExternalPlayer(currentTrack);
      } else {
        setPlayButton(false);
      }
      updateNowPlaying();
      renderQueue();
      renderLibrary();
      return;
    }

    const url = currentTrack?.streamUrl || apiUrl(`/api/stream/${encodeURIComponent(currentId)}`);
    state.audio.src = url;
    state.audio.load();
    if (autoplay) {
      void playCurrentAudio({
        trackId: currentId,
        reason: options.reason || 'load-track',
        allowAutoSkip: Boolean(options.allowAutoSkip)
      });
    } else {
      setPlayButton(false);
    }
    updateNowPlaying();
    renderQueue();
    renderLibrary();
  }

  function playFromIndex(index) {
    setQueueFromIndex(index);
    loadCurrentTrack(true, { reason: 'library-select', allowAutoSkip: false });
  }

  function playQueueIndex(index) {
    if (index < 0 || index >= state.queue.length) return;
    state.currentIndex = index;
    resetShuffleBag();
    loadCurrentTrack(true, { reason: 'queue-select', allowAutoSkip: false });
  }

  function playPlaylistTracks(trackIds) {
    const filtered = trackIds.filter((id) => getTrackById(id));
    if (filtered.length === 0) return;
    state.queue = filtered;
    state.currentIndex = 0;
    resetShuffleBag();
    loadCurrentTrack(true, { reason: 'playlist-play', allowAutoSkip: true });
  }

  function clearQueue() {
    state.queue = [];
    state.currentIndex = -1;
    state.currentTrackId = null;
    state.shuffleBag = [];
    state.playRequestId += 1;
    state.playbackFailureCounts = {};
    state.audio.pause();
    state.audio.src = '';
    clearPlaybackErrorState();
    setPlayButton(false);
    setUploadStatus('');
    updateNowPlaying();
    renderQueue();
    renderLibrary();
  }

  function addSelectedToQueue() {
    if (!state.selectedTrackId) return;
    state.queue.push(state.selectedTrackId);
    if (state.currentIndex === -1) {
      state.currentIndex = 0;
      loadCurrentTrack(true, { reason: 'queue-start', allowAutoSkip: true });
      return;
    }
    resetShuffleBag();
    renderQueue();
  }

  async function addSelectedToPlaylist(playlistId = state.currentPlaylistId) {
    if (!state.selectedTrackId || !playlistId) return;
    const playlist = state.playlists.find((item) => item.id === playlistId);
    if (!playlist) return;
    const next = [...playlist.trackIds, state.selectedTrackId];
    await updatePlaylist(playlistId, { trackIds: next });
  }

  async function deleteSelectedTrack() {
    if (state.runtimeMode === 'local') {
      alert('Exclusão disponível apenas com backend ativo.');
      return;
    }
    const trackId = state.selectedTrackId;
    if (!trackId) return;
    const track = getTrackById(trackId);
    const trackName = track ? track.title : 'faixa selecionada';
    const confirmDelete = window.confirm(`Excluir '${trackName}' da biblioteca? Isso apaga o arquivo da pasta music.`);
    if (!confirmDelete) return;

    try {
      const resp = await fetch(apiUrl(`/api/tracks/${encodeURIComponent(trackId)}`), {
        method: 'DELETE'
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        alert(data?.error || 'Falha ao excluir faixa');
        return;
      }

      const wasPlaying = state.currentTrackId === trackId;
      const previousIndex = state.currentIndex;

      state.tracks = state.tracks.filter((item) => item.id !== trackId);
      state.queue = state.queue.filter((id) => id !== trackId);
      state.playlists = state.playlists.map((playlist) => ({
        ...playlist,
        trackIds: playlist.trackIds.filter((id) => id !== trackId)
      }));
      state.selectedTrackId = null;

      if (wasPlaying) {
        if (state.queue.length === 0) {
          stopPlayback();
          state.audio.src = '';
          state.currentTrackId = null;
          state.currentIndex = -1;
        } else {
          const nextIndex = Math.min(previousIndex, state.queue.length - 1);
          state.currentIndex = nextIndex;
          loadCurrentTrack(true, { reason: 'delete-replace', allowAutoSkip: true });
        }
      } else if (state.currentTrackId) {
        state.currentIndex = state.queue.indexOf(state.currentTrackId);
      }

      updateNowPlaying();
      renderQueue();
      renderLibrary();
      renderPlaylistList();
      renderPlaylistDetail();
      renderAddMenuPlaylists();
      updateDeleteButtonState();
      await loadLibrary(true);
    } catch (err) {
      alert('Erro ao excluir faixa');
    }
  }

  async function removeSelectedFromPlaylist() {
    if (!state.currentPlaylistId || !state.selectedPlaylistTrackId) return;
    const playlist = state.playlists.find((item) => item.id === state.currentPlaylistId);
    if (!playlist) return;
    const next = playlist.trackIds.filter((id) => id !== state.selectedPlaylistTrackId);
    await updatePlaylist(state.currentPlaylistId, { trackIds: next });
    state.selectedPlaylistTrackId = null;
  }

  function stopPlayback() {
    state.playRequestId += 1;
    state.audio.pause();
    state.audio.currentTime = 0;
    closeExternalPlayer();
    clearPlaybackErrorState();
    setPlayButton(false);
  }

  function togglePlayPause() {
    if (state.currentIndex === -1) return;
    const currentTrack = getTrackById(state.currentTrackId);
    if (currentTrack?.embedUrl) {
      openExternalPlayer(currentTrack);
      return;
    }
    if (state.audio.paused) {
      void playCurrentAudio({
        trackId: state.currentTrackId,
        reason: 'toggle-play',
        allowAutoSkip: false
      });
    } else {
      state.audio.pause();
      setPlayButton(false);
    }
  }

  function resetShuffleBag() {
    if (!state.isShuffle) {
      state.shuffleBag = [];
      return;
    }
    const currentId = state.queue[state.currentIndex];
    const bag = state.queue.filter((id) => id !== currentId);
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    state.shuffleBag = bag;
  }

  function getNextShuffleId() {
    if (state.queue.length <= 1) return null;
    if (state.shuffleBag.length === 0) {
      resetShuffleBag();
    }
    return state.shuffleBag.shift() || null;
  }

  function nextTrack(manual = false, options = {}) {
    if (state.queue.length === 0) return;

    if (state.isShuffle) {
      const nextId = getNextShuffleId();
      if (!nextId) {
        if (state.repeatMode === 'all') {
          resetShuffleBag();
          const fallbackId = getNextShuffleId();
          if (fallbackId) {
            state.currentIndex = state.queue.indexOf(fallbackId);
            loadCurrentTrack(true, {
              reason: options.reason || (manual ? 'manual-next' : 'auto-next'),
              allowAutoSkip: true
            });
          }
        } else if (manual) {
          stopPlayback();
        }
        return;
      }
      state.currentIndex = state.queue.indexOf(nextId);
      loadCurrentTrack(true, {
        reason: options.reason || (manual ? 'manual-next' : 'auto-next'),
        allowAutoSkip: true
      });
      return;
    }

    if (state.currentIndex < state.queue.length - 1) {
      state.currentIndex += 1;
      loadCurrentTrack(true, {
        reason: options.reason || (manual ? 'manual-next' : 'auto-next'),
        allowAutoSkip: true
      });
      return;
    }

    if (state.repeatMode === 'all') {
      state.currentIndex = 0;
      loadCurrentTrack(true, {
        reason: options.reason || (manual ? 'manual-next' : 'auto-next'),
        allowAutoSkip: true
      });
      return;
    }

    if (manual) {
      stopPlayback();
    }
  }

  function prevTrack() {
    if (state.queue.length === 0) return;
    if (state.audio.currentTime > 3) {
      state.audio.currentTime = 0;
      return;
    }
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      loadCurrentTrack(true, { reason: 'manual-prev', allowAutoSkip: true });
    }
  }

  function toggleShuffle() {
    state.isShuffle = !state.isShuffle;
    updateShuffleButton();
    resetShuffleBag();
  }

  function toggleRepeat() {
    const order = ['off', 'all', 'one'];
    const nextIndex = (order.indexOf(state.repeatMode) + 1) % order.length;
    state.repeatMode = order[nextIndex];
    updateRepeatButton();
  }

  function updateShuffleButton() {
    els.btnShuffle.classList.toggle('active', state.isShuffle);
    const label = state.isShuffle ? 'Aleatorio ligado' : 'Aleatorio desligado';
    els.btnShuffle.title = label;
    els.btnShuffle.setAttribute('aria-label', label);
  }

  function updateRepeatButton() {
    els.btnRepeat.classList.toggle('active', state.repeatMode !== 'off');
    els.btnRepeat.classList.toggle('repeat-one', state.repeatMode === 'one');
    els.btnRepeat.textContent = '↻';
  }

  function handleEnded() {
    if (state.repeatMode === 'one') {
      state.audio.currentTime = 0;
      void playCurrentAudio({
        trackId: state.currentTrackId,
        reason: 'repeat-one',
        allowAutoSkip: true
      });
      return;
    }
    nextTrack(false, { reason: 'ended', allowAutoSkip: true });
  }

  function handleAudioError() {
    handlePlaybackFailure(state.audio.error, {
      trackId: state.currentTrackId,
      reason: 'audio-error',
      allowAutoSkip: true
    });
  }

  function bindControls() {
    els.uploadButton.addEventListener('click', () => {
      els.uploadInput.click();
    });

    els.uploadInput.addEventListener('change', () => {
      const files = Array.from(els.uploadInput.files || []);
      if (files.length === 0) return;
      uploadFiles(files);
      els.uploadInput.value = '';
    });
    els.deleteTrackButton.addEventListener('click', deleteSelectedTrack);
    els.clearQueue.addEventListener('click', clearQueue);
    els.addSelected.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleAddMenu();
    });
    els.refreshLibrary.addEventListener('click', () => loadLibrary(true));
    els.librarySearch.addEventListener('input', (event) => {
      state.libraryQuery = event.target.value || '';
      renderLibrary();
    });
    els.newPlaylist.addEventListener('click', createPlaylistFromPrompt);
    els.playPlaylist.addEventListener('click', () => {
      const playlist = state.playlists.find((item) => item.id === state.currentPlaylistId);
      if (playlist) {
        playPlaylistTracks(playlist.trackIds);
      }
    });
    els.addToPlaylist.addEventListener('click', () => addSelectedToPlaylist());
    els.removeFromPlaylist.addEventListener('click', removeSelectedFromPlaylist);
    els.defaultVolume.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      els.volume.value = value;
      state.audio.volume = value;
      localStorage.setItem('playerVolume', String(value));
      syncRangeVisuals();
      updateVuMeters();
    });

    if (els.playbackModel) {
      els.playbackModel.addEventListener('change', (event) => {
        const nextId = event.target.value;
        applyPlaybackModel(nextId, true);
      });
    }

    if (els.playbackModelQuick) {
      els.playbackModelQuick.addEventListener('change', (event) => {
        const nextId = event.target.value;
        applyPlaybackModel(nextId, true);
      });
    }

    if (els.appearanceModelSelect) {
      els.appearanceModelSelect.addEventListener('change', (event) => {
        const nextId = event.target.value;
        applyPlaybackModel(nextId, true);
      });
    }

    if (els.themeSelect) {
      els.themeSelect.addEventListener('change', (event) => {
        setTheme(event.target.value, true);
      });
    }

    if (els.themeMode) {
      els.themeMode.addEventListener('change', (event) => {
        setTheme(event.target.value, true);
      });
    }

    if (els.layoutSelect) {
      els.layoutSelect.addEventListener('change', (event) => {
        setLayout(event.target.value, true);
      });
    }

    if (els.visualizerToggle) {
      els.visualizerToggle.addEventListener('change', (event) => {
        const enabled = Boolean(event.target.checked);
        localStorage.setItem(STORAGE_KEYS.visualizer, enabled ? 'on' : 'off');
        if (neonVisualizer) {
          neonVisualizer.setEnabled(enabled);
          if (enabled && !state.audio.paused) {
            neonVisualizer.start();
          }
        }
      });
    }

    if (els.youtubeForm) {
      els.youtubeForm.addEventListener('submit', (event) => {
        event.preventDefault();
        loadYouTubeVideo(els.youtubeUrl?.value || '');
      });
    }

    if (els.youtubePlayButton) {
      els.youtubePlayButton.addEventListener('click', () => {
        if (state.youtubePlayer && typeof state.youtubePlayer.playVideo === 'function') {
          state.youtubePlayer.playVideo();
        } else if (els.youtubeUrl?.value) {
          loadYouTubeVideo(els.youtubeUrl.value);
        }
        if (neonVisualizer) {
          setPlayButton(true);
          neonVisualizer.start({ simulated: true });
        }
      });
    }

    if (els.youtubePauseButton) {
      els.youtubePauseButton.addEventListener('click', () => {
        if (state.youtubePlayer && typeof state.youtubePlayer.pauseVideo === 'function') {
          state.youtubePlayer.pauseVideo();
        }
        if (neonVisualizer) {
          neonVisualizer.stop();
          setPlayButton(false);
        }
      });
    }

    if (els.youtubeVolume) {
      els.youtubeVolume.addEventListener('input', applyYouTubeVolume);
    }

    bindAppearanceModalEvents();

    els.navItems.forEach((item) => {
      item.addEventListener('click', (event) => {
        event.preventDefault();
        setView(item.dataset.view || 'queue');
      });
    });

    els.btnPlay.addEventListener('click', togglePlayPause);
    els.btnStop.addEventListener('click', stopPlayback);
    els.btnNext.addEventListener('click', () => nextTrack(true));
    els.btnPrev.addEventListener('click', prevTrack);
    els.btnShuffle.addEventListener('click', toggleShuffle);
    els.btnRepeat.addEventListener('click', toggleRepeat);

    els.seekBar.addEventListener('input', () => {
      if (!state.audio.duration) return;
      const pct = Number(els.seekBar.value) / 100;
      state.audio.currentTime = pct * state.audio.duration;
      syncRangeVisuals();
    });

    els.volume.addEventListener('input', () => {
      const value = Number(els.volume.value);
      state.audio.volume = value;
      localStorage.setItem(STORAGE_KEYS.volume, String(value));
      if (els.defaultVolume) {
        els.defaultVolume.value = value;
      }
      syncRangeVisuals();
      updateVuMeters();
    });

    if (els.turboGain) {
      els.turboGain.addEventListener('input', () => {
        const value = Math.max(1, Math.min(4, Number(els.turboGain.value)));
        if (window.__vizTurboGain) {
          window.__vizTurboGain.gain.value = value;
        }
        localStorage.setItem(STORAGE_KEYS.turboGain, String(value));
        syncRangeVisuals();
        updateVuMeters();
      });
    }

    window.addEventListener('audio-visualizer-levels', (event) => {
      const detail = event.detail || {};
      state.vuLevels = {
        left: Math.max(0, Math.min(1, Number(detail.left) || 0)),
        right: Math.max(0, Math.min(1, Number(detail.right) || 0)),
        mix: Math.max(0, Math.min(1, Number(detail.mix) || 0))
      };
      updateVuMeters();
    });

    state.audio.addEventListener('timeupdate', () => {
      if (!state.audio.duration) return;
      const pct = (state.audio.currentTime / state.audio.duration) * 100;
      els.seekBar.value = pct;
      els.currentTime.textContent = formatSeconds(state.audio.currentTime);
      els.duration.textContent = formatSeconds(state.audio.duration);
      syncRangeVisuals();
      updateVuMeters();
    });

    state.audio.addEventListener('ended', handleEnded);
    state.audio.addEventListener('error', handleAudioError);

    state.audio.addEventListener('loadedmetadata', () => {
      updateNowPlaying();
    });

    state.audio.addEventListener('play', () => {
      clearPlaybackErrorState();
      setPlayButton(true);
    });

    state.audio.addEventListener('pause', () => {
      setPlayButton(false);
    });

    document.addEventListener('click', () => {
      hideAddMenu();
    });

    els.addMenu.addEventListener('click', (event) => {
      const action = event.target?.dataset?.action;
      if (action === 'queue') {
        addSelectedToQueue();
        hideAddMenu();
      }
      event.stopPropagation();
    });
  }

  function uploadFiles(files) {
    if (state.runtimeMode === 'local') {
      setUploadStatus('Upload disponível apenas com backend ativo');
      setTimeout(() => setUploadStatus(''), 3000);
      return;
    }
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    setUploadStatus('Enviando...');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl('/api/upload'));
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const pct = Math.round((event.loaded / event.total) * 100);
      setUploadStatus(`Enviando ${pct}%`);
    };
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        els.player.classList.remove('player-error');
        const response = JSON.parse(xhr.responseText || '{}');
        const added = response.added ? response.added.length : 0;
        const rejected = response.rejected ? response.rejected.length : 0;
        setUploadStatus(`Upload finalizado: ${added} adicionado(s), ${rejected} rejeitado(s)`);
        await loadLibrary(true);
        renderQueue();
      } else {
        els.player.classList.add('player-error');
        setUploadStatus('Falha no upload');
      }
      setTimeout(() => setUploadStatus(''), 4000);
    };
    xhr.onerror = () => {
      els.player.classList.add('player-error');
      setUploadStatus('Falha no upload');
      setTimeout(() => setUploadStatus(''), 4000);
    };
    xhr.send(formData);
  }

  function setView(view) {
    state.currentView = view;
    els.queueView.classList.toggle('hidden', view !== 'queue');
    els.libraryView.classList.toggle('hidden', view !== 'library');
    els.youtubeView.classList.toggle('hidden', view !== 'youtube');
    els.playlistsView.classList.toggle('hidden', view !== 'playlists');
    els.settingsView.classList.toggle('hidden', view !== 'settings');
    els.navItems.forEach((item) => {
      item.classList.toggle('active', item.dataset.view === view);
    });
    const titles = {
      queue: 'Fila de reproducao',
      library: 'Biblioteca de musicas',
      youtube: 'YouTube',
      playlists: 'Playlists',
      settings: 'Configuracoes'
    };
    els.mainTitle.textContent = titles[view] || 'Fila de reproducao';
    updateDeleteButtonState();
  }

  function toggleAddMenu() {
    els.addMenu.classList.toggle('hidden');
  }

  function hideAddMenu() {
    els.addMenu.classList.add('hidden');
  }

  async function createPlaylistFromPrompt() {
    if (state.runtimeMode === 'local') {
      alert('Playlists requerem backend ativo.');
      return;
    }
    const name = prompt('Nome da playlist');
    if (!name || !name.trim()) return;
    try {
      await fetch(apiUrl('/api/playlists'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      });
      await loadPlaylists();
    } catch (err) {
      console.error(err);
    }
  }

  async function updatePlaylist(id, payload) {
    if (state.runtimeMode === 'local') {
      return;
    }
    try {
      const resp = await fetch(apiUrl(`/api/playlists/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Erro ao atualizar playlist');
      await loadPlaylists();
    } catch (err) {
      console.error(err);
    }
  }

  async function loadLibrary(refresh = false) {
    if (!SHOULD_USE_API) {
      await loadLocalLibrary();
      return;
    }

    try {
      const resp = await fetch(apiUrl(`/api/tracks${refresh ? '?refresh=1' : ''}`));
      if (!resp.ok) {
        throw new Error(`API tracks status ${resp.status}`);
      }
      const data = await resp.json();
      state.tracks = sortTracksByTitle(Array.isArray(data) ? data : (data.tracks || []));
      setRuntimeMode('api');
      renderLibrary();
      renderQueue();
      renderPlaylistDetail();
      updateDeleteButtonState();
    } catch (err) {
      await loadLocalLibrary();
    }
  }

  async function loadPlaylists() {
    if (!SHOULD_USE_API || state.runtimeMode === 'local') {
      state.playlists = [];
      state.currentPlaylistId = null;
      renderPlaylistList();
      renderPlaylistDetail();
      renderAddMenuPlaylists();
      return;
    }
    try {
      const resp = await fetch(apiUrl('/api/playlists'));
      if (!resp.ok) {
        throw new Error(`API playlists status ${resp.status}`);
      }
      const data = await resp.json();
      state.playlists = Array.isArray(data.playlists) ? data.playlists : [];
      const saved = localStorage.getItem('lastPlaylistId');
      if (saved && state.playlists.some((item) => item.id === saved)) {
        state.currentPlaylistId = saved;
      } else if (state.playlists.length > 0 && !state.currentPlaylistId) {
        state.currentPlaylistId = state.playlists[0].id;
      }
      renderPlaylistList();
      renderPlaylistDetail();
      renderAddMenuPlaylists();
    } catch (err) {
      state.playlists = [];
      state.currentPlaylistId = null;
      renderPlaylistList();
      renderPlaylistDetail();
      renderAddMenuPlaylists();
    }
  }

  function initVolume() {
    const saved = Number(localStorage.getItem(STORAGE_KEYS.volume));
    const initial = Number.isFinite(saved) ? Math.min(Math.max(saved, 0), 1) : 0.8;
    els.volume.value = initial;
    state.audio.volume = initial;
    if (els.defaultVolume) {
      els.defaultVolume.value = initial;
    }
    if (els.turboGain) {
      const savedTurbo = Number(localStorage.getItem(STORAGE_KEYS.turboGain));
      const initialTurbo = Number.isFinite(savedTurbo) && savedTurbo >= 1 ? Math.min(4, savedTurbo) : 1;
      els.turboGain.value = initialTurbo;
    }
    syncRangeVisuals();
    updateVuMeters();
  }

  function initPreferences() {
    state.isShuffle = false;
    state.repeatMode = 'off';
    updateShuffleButton();
    updateRepeatButton();

    renderPlaybackModels();
    const savedModelId = localStorage.getItem(STORAGE_KEYS.playbackModel);
    applyPlaybackModel(savedModelId || PLAYBACK_MODELS[0].id, false);
  }

  async function init() {
    initAppearance();
    initNeonVisualizer();
    bindControls();
    initYouTube();
    initVolume();
    initPreferences();
    initPlayerReservedHeight();
    setView('queue');
    await loadLibrary();
    prepareInitialTrack();
    if (state.runtimeMode === 'local' && state.tracks.length > 0) {
      setView('library');
    }
    await loadPlaylists();
    if (state.runtimeMode !== 'local') {
      setUploadStatus('');
    }
    updateDeleteButtonState();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
