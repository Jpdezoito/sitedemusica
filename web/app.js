(() => {
  const API_BASE = '';
  const LOCAL_MANIFEST_URL = new URL('music/tracks.json', window.location.href).toString();
  const SHOULD_USE_API = window.location.port === '3000';

  function apiUrl(path) {
    return `${API_BASE}${path}`;
  }

  async function loadLocalLibrary() {
    try {
      const localResp = await fetch(LOCAL_MANIFEST_URL, { cache: 'no-store' });
      if (!localResp.ok) {
        throw new Error(`Manifest status ${localResp.status}`);
      }
      const payload = await localResp.json();
      const list = Array.isArray(payload) ? payload : (Array.isArray(payload.tracks) ? payload.tracks : []);
      state.tracks = list
        .map((item, index) => normalizeLocalTrack(item, index))
        .filter(Boolean);
    } catch (_manifestErr) {
      state.tracks = [];
    }

    setRuntimeMode('local');
    renderLibrary();
    renderQueue();
    renderPlaylistDetail();
    updateDeleteButtonState();
  }

  const state = {
    tracks: [],
    queue: [],
    currentIndex: -1,
    currentTrackId: null,
    selectedTrackId: null,
    selectedPlaylistTrackId: null,
    libraryQuery: '',
    playlists: [],
    currentPlaylistId: null,
    isShuffle: false,
    repeatMode: 'off',
    shuffleBag: [],
    runtimeMode: 'api',
    currentView: 'queue',
    audio: new Audio()
  };

  const STORAGE_KEYS = {
    volume: 'playerVolume',
    shuffle: 'playerShuffle',
    repeat: 'playerRepeat'
  };

  const els = {
    queueTable: document.querySelector('#queueTable tbody'),
    libraryTable: document.querySelector('#libraryTable tbody'),
    nowPlaying: document.querySelector('#nowPlaying'),
    clearQueue: document.querySelector('#clearQueue'),
    addSelected: document.querySelector('#addSelected'),
    addMenu: document.querySelector('#addMenu'),
    addMenuPlaylists: document.querySelector('#addMenuPlaylists'),
    refreshLibrary: document.querySelector('#refreshLibrary'),
    librarySearch: document.querySelector('#librarySearch'),
    navItems: Array.from(document.querySelectorAll('.nav-item[data-view]')),
    queueView: document.querySelector('#queueView'),
    libraryView: document.querySelector('#libraryView'),
    playlistsView: document.querySelector('#playlistsView'),
    settingsView: document.querySelector('#settingsView'),
    playlistList: document.querySelector('#playlistList'),
    newPlaylist: document.querySelector('#newPlaylist'),
    mainTitle: document.querySelector('#mainTitle'),
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
    btnPlay: document.querySelector('#btnPlay'),
    btnStop: document.querySelector('#btnStop'),
    btnPrev: document.querySelector('#btnPrev'),
    btnNext: document.querySelector('#btnNext'),
    btnShuffle: document.querySelector('#btnShuffle'),
    btnRepeat: document.querySelector('#btnRepeat'),
    seekBar: document.querySelector('#seekBar'),
    currentTime: document.querySelector('#currentTime'),
    duration: document.querySelector('#duration'),
    volume: document.querySelector('#volume')
  };

  function formatSeconds(sec) {
    if (!sec && sec !== 0) return '—';
    const minutes = Math.floor(sec / 60);
    const seconds = Math.floor(sec % 60)
      .toString()
      .padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function getTrackById(id) {
    return state.tracks.find((track) => track.id === id) || null;
  }

  function buildLocalStreamUrl(filename) {
    const encodedPath = String(filename || '')
      .split('/')
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join('/');
    return new URL(`music/${encodedPath}`, window.location.href).toString();
  }

  function normalizeLocalTrack(item, index) {
    if (!item) return null;
    const raw = typeof item === 'string' ? { filename: item } : item;
    const filename = String(raw.filename || raw.file || '').trim();
    if (!filename) return null;

    const parsedName = filename.split('/').pop() || filename;
    const titleFromFile = parsedName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();

    return {
      id: String(raw.id || `local-${index}-${filename.toLowerCase()}`),
      filename,
      title: raw.title || titleFromFile || `Faixa ${index + 1}`,
      artist: raw.artist || 'Artista desconhecido',
      album: raw.album || 'Sem álbum',
      durationSec: Number(raw.durationSec) || 0,
      streamUrl: raw.streamUrl || buildLocalStreamUrl(filename)
    };
  }

  function setRuntimeMode(mode) {
    state.runtimeMode = mode;
    const isLocal = mode === 'local';
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
    els.btnPlay.textContent = isPlaying ? '⏸' : '▶️';
  }

  function setUploadStatus(message) {
    if (!els.uploadStatus) return;
    els.uploadStatus.textContent = message;
  }

  function updateDeleteButtonState() {
    const isTrackView = state.currentView === 'queue' || state.currentView === 'library';
    const hasSelection = !!state.selectedTrackId;
    els.deleteTrackButton.disabled = state.runtimeMode === 'local' || !(isTrackView && hasSelection);
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
      els.duration.textContent = '0:00';
      els.currentTime.textContent = '0:00';
      els.seekBar.value = 0;
      return;
    }
    els.nowPlaying.textContent = `${track.title} — ${track.artist}`;
    els.duration.textContent = formatSeconds(track.durationSec || state.audio.duration || 0);
  }

  function setQueueFromIndex(startIndex) {
    state.queue = state.tracks.map((track) => track.id);
    state.currentIndex = startIndex;
    resetShuffleBag();
  }

  function loadCurrentTrack(autoplay = true) {
    const currentId = state.queue[state.currentIndex];
    if (!currentId) return;
    state.currentTrackId = currentId;
    const currentTrack = getTrackById(currentId);
    const url = currentTrack?.streamUrl || apiUrl(`/api/stream/${encodeURIComponent(currentId)}`);
    state.audio.src = url;
    if (autoplay) {
      state.audio.play();
      setPlayButton(true);
    }
    updateNowPlaying();
    renderQueue();
    renderLibrary();
  }

  function playFromIndex(index) {
    setQueueFromIndex(index);
    loadCurrentTrack(true);
  }

  function playQueueIndex(index) {
    if (index < 0 || index >= state.queue.length) return;
    state.currentIndex = index;
    resetShuffleBag();
    loadCurrentTrack(true);
  }

  function playPlaylistTracks(trackIds) {
    const filtered = trackIds.filter((id) => getTrackById(id));
    if (filtered.length === 0) return;
    state.queue = filtered;
    state.currentIndex = 0;
    resetShuffleBag();
    loadCurrentTrack(true);
  }

  function clearQueue() {
    state.queue = [];
    state.currentIndex = -1;
    state.currentTrackId = null;
    state.shuffleBag = [];
    state.audio.pause();
    state.audio.src = '';
    setPlayButton(false);
    updateNowPlaying();
    renderQueue();
    renderLibrary();
  }

  function addSelectedToQueue() {
    if (!state.selectedTrackId) return;
    state.queue.push(state.selectedTrackId);
    if (state.currentIndex === -1) {
      state.currentIndex = 0;
      loadCurrentTrack(true);
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
          loadCurrentTrack(true);
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
    state.audio.pause();
    state.audio.currentTime = 0;
    setPlayButton(false);
  }

  function togglePlayPause() {
    if (state.currentIndex === -1) return;
    if (state.audio.paused) {
      state.audio.play();
      setPlayButton(true);
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

  function nextTrack(manual = false) {
    if (state.queue.length === 0) return;

    if (state.isShuffle) {
      const nextId = getNextShuffleId();
      if (!nextId) {
        if (state.repeatMode === 'all') {
          resetShuffleBag();
          const fallbackId = getNextShuffleId();
          if (fallbackId) {
            state.currentIndex = state.queue.indexOf(fallbackId);
            loadCurrentTrack(true);
          }
        } else if (manual) {
          stopPlayback();
        }
        return;
      }
      state.currentIndex = state.queue.indexOf(nextId);
      loadCurrentTrack(true);
      return;
    }

    if (state.currentIndex < state.queue.length - 1) {
      state.currentIndex += 1;
      loadCurrentTrack(true);
      return;
    }

    if (state.repeatMode === 'all') {
      state.currentIndex = 0;
      loadCurrentTrack(true);
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
      loadCurrentTrack(true);
    }
  }

  function toggleShuffle() {
    state.isShuffle = !state.isShuffle;
    els.btnShuffle.classList.toggle('active', state.isShuffle);
    resetShuffleBag();
    localStorage.setItem(STORAGE_KEYS.shuffle, state.isShuffle ? '1' : '0');
  }

  function toggleRepeat() {
    const order = ['off', 'one', 'all'];
    const nextIndex = (order.indexOf(state.repeatMode) + 1) % order.length;
    state.repeatMode = order[nextIndex];
    if (state.repeatMode === 'one') {
      els.btnRepeat.textContent = '🔂';
    } else {
      els.btnRepeat.textContent = '🔁';
    }
    localStorage.setItem(STORAGE_KEYS.repeat, state.repeatMode);
  }

  function handleEnded() {
    if (state.repeatMode === 'one') {
      state.audio.currentTime = 0;
      state.audio.play();
      return;
    }
    nextTrack(false);
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
    });

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
    });

    els.volume.addEventListener('input', () => {
      const value = Number(els.volume.value);
      state.audio.volume = value;
      localStorage.setItem(STORAGE_KEYS.volume, String(value));
      if (els.defaultVolume) {
        els.defaultVolume.value = value;
      }
    });

    state.audio.addEventListener('timeupdate', () => {
      if (!state.audio.duration) return;
      const pct = (state.audio.currentTime / state.audio.duration) * 100;
      els.seekBar.value = pct;
      els.currentTime.textContent = formatSeconds(state.audio.currentTime);
      els.duration.textContent = formatSeconds(state.audio.duration);
    });

    state.audio.addEventListener('ended', handleEnded);

    state.audio.addEventListener('play', () => {
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
        const response = JSON.parse(xhr.responseText || '{}');
        const added = response.added ? response.added.length : 0;
        const rejected = response.rejected ? response.rejected.length : 0;
        setUploadStatus(`Upload finalizado: ${added} adicionado(s), ${rejected} rejeitado(s)`);
        await loadLibrary(true);
        renderQueue();
      } else {
        setUploadStatus('Falha no upload');
      }
      setTimeout(() => setUploadStatus(''), 4000);
    };
    xhr.onerror = () => {
      setUploadStatus('Falha no upload');
      setTimeout(() => setUploadStatus(''), 4000);
    };
    xhr.send(formData);
  }

  function setView(view) {
    state.currentView = view;
    els.queueView.classList.toggle('hidden', view !== 'queue');
    els.libraryView.classList.toggle('hidden', view !== 'library');
    els.playlistsView.classList.toggle('hidden', view !== 'playlists');
    els.settingsView.classList.toggle('hidden', view !== 'settings');
    els.navItems.forEach((item) => {
      item.classList.toggle('active', item.dataset.view === view);
    });
    const titles = {
      queue: 'Fila de reproducao',
      library: 'Biblioteca de musicas',
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
      state.tracks = Array.isArray(data) ? data : (data.tracks || []);
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
  }

  function initPreferences() {
    const savedShuffle = localStorage.getItem(STORAGE_KEYS.shuffle);
    state.isShuffle = savedShuffle === '1';
    els.btnShuffle.classList.toggle('active', state.isShuffle);

    const savedRepeat = localStorage.getItem(STORAGE_KEYS.repeat);
    state.repeatMode = savedRepeat === 'one' || savedRepeat === 'all' ? savedRepeat : 'off';
    els.btnRepeat.textContent = state.repeatMode === 'one' ? '🔂' : '🔁';
  }

  async function init() {
    bindControls();
    initVolume();
    initPreferences();
    setView('queue');
    await loadLibrary();
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
