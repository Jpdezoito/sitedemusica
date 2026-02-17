const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'playlists.json');

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch (err) {
    const initial = { playlists: [] };
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2));
  }
}

async function loadStore() {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.playlists)) {
    return { playlists: [] };
  }
  return data;
}

async function saveStore(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

function createPlaylistsStore() {
  async function getPlaylists() {
    const data = await loadStore();
    return data.playlists;
  }

  async function createPlaylist(name) {
    const data = await loadStore();
    const now = new Date().toISOString();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const playlist = {
      id,
      name,
      trackIds: [],
      createdAt: now,
      updatedAt: now
    };
    data.playlists.push(playlist);
    await saveStore(data);
    return playlist;
  }

  async function updatePlaylist(id, updates) {
    const data = await loadStore();
    const playlist = data.playlists.find((item) => item.id === id);
    if (!playlist) return null;

    if (typeof updates.name === 'string' && updates.name.trim()) {
      playlist.name = updates.name.trim();
    }
    if (Array.isArray(updates.trackIds)) {
      playlist.trackIds = [...updates.trackIds];
    }
    playlist.updatedAt = new Date().toISOString();
    await saveStore(data);
    return playlist;
  }

  async function deletePlaylist(id) {
    const data = await loadStore();
    const next = data.playlists.filter((item) => item.id !== id);
    if (next.length === data.playlists.length) return false;
    data.playlists = next;
    await saveStore(data);
    return true;
  }

  return {
    getPlaylists,
    createPlaylist,
    updatePlaylist,
    deletePlaylist
  };
}

module.exports = createPlaylistsStore;
