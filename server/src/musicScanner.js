const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const mm = require('music-metadata');

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.m4a',
  '.ogg',
  '.flac'
]);

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const CACHE_FILE = path.join(DATA_DIR, 'tracks-cache.json');

function resolveMusicDir() {
  const envDir = process.env.MUSIC_DIR;
  if (envDir && envDir.trim()) {
    return path.isAbsolute(envDir) ? envDir : path.resolve(PROJECT_ROOT, envDir);
  }
  return path.resolve(PROJECT_ROOT, 'music');
}

async function readWavDurationSec(filePath) {
  const handle = await fsp.open(filePath, 'r');
  try {
    const header = Buffer.alloc(65536);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const buffer = header.subarray(0, bytesRead);
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
      return null;
    }

    let offset = 12;
    let byteRate = null;
    let dataSize = null;
    while (offset + 8 <= buffer.length) {
      const chunkId = buffer.toString('ascii', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      const chunkDataStart = offset + 8;
      if (chunkId === 'fmt ' && chunkDataStart + 16 <= buffer.length) {
        byteRate = buffer.readUInt32LE(chunkDataStart + 8);
      }
      if (chunkId === 'data' && chunkDataStart + 4 <= buffer.length) {
        dataSize = buffer.readUInt32LE(chunkDataStart);
      }
      if (byteRate && dataSize) break;
      offset = chunkDataStart + chunkSize;
    }
    if (!byteRate || !dataSize) return null;
    return Math.round(dataSize / byteRate);
  } catch (err) {
    return null;
  } finally {
    await handle.close();
  }
}

async function readMetadata(filePath) {
  const fallbackTitle = path.basename(filePath, path.extname(filePath));
  let durationSec = null;
  try {
    const metadata = await mm.parseFile(filePath);
    const { common, format } = metadata;
    durationSec = format.duration ? Math.round(format.duration) : null;
    if (!durationSec && path.extname(filePath).toLowerCase() === '.wav') {
      durationSec = await readWavDurationSec(filePath);
    }
    return {
      title: common.title || fallbackTitle,
      artist: common.artist || 'Desconhecido',
      album: common.album || 'Desconhecido',
      durationSec
    };
  } catch (err) {
    if (path.extname(filePath).toLowerCase() === '.wav') {
      durationSec = await readWavDurationSec(filePath);
    }
    return {
      title: fallbackTitle,
      artist: 'Desconhecido',
      album: 'Desconhecido',
      durationSec
    };
  }
}

async function walkDirectory(currentDir, baseDir, accumulator) {
  const entries = await fsp.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(fullPath, baseDir, accumulator);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!AUDIO_EXTENSIONS.has(ext)) continue;

    const stat = await fsp.stat(fullPath);
    const relPath = path.relative(baseDir, fullPath).split(path.sep).join('/');
    const meta = await readMetadata(fullPath);
    const filename = entry.name;
    const id = crypto.createHash('sha1').update(relPath).digest('hex');
    accumulator.push({
      id,
      filename,
      relPath,
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      durationSec: meta.durationSec,
      sizeBytes: stat.size,
      absPath: fullPath
    });
  }
}

function createMusicScanner(baseDir = resolveMusicDir()) {
  let tracks = [];
  let trackById = new Map();
  let pathById = new Map();

  async function loadCache() {
    try {
      const raw = await fsp.readFile(CACHE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.tracks)) return [];
      tracks = data.tracks.map((item) => ({
        ...item,
        absPath: path.join(baseDir, item.relPath)
      }));
      trackById = new Map(tracks.map((track) => [track.id, track]));
      pathById = new Map(tracks.map((track) => [track.id, track.absPath]));
      return getTracks();
    } catch (err) {
      return [];
    }
  }

  async function saveCache(list) {
    try {
      await fsp.mkdir(DATA_DIR, { recursive: true });
      const payload = {
        updatedAt: new Date().toISOString(),
        tracks: list.map(({ absPath, ...rest }) => rest)
      };
      await fsp.writeFile(CACHE_FILE, JSON.stringify(payload, null, 2));
    } catch (err) {
      // ignore cache write errors
    }
  }

  async function rescan() {
    const exists = fs.existsSync(baseDir);
    if (!exists) {
      tracks = [];
      trackById = new Map();
      pathById = new Map();
      await saveCache(tracks);
      return tracks;
    }
    const bucket = [];
    await walkDirectory(baseDir, baseDir, bucket);
    tracks = bucket;
    trackById = new Map(tracks.map((track) => [track.id, track]));
    pathById = new Map(tracks.map((track) => [track.id, track.absPath]));
    await saveCache(tracks);
    return tracks;
  }

  function getTracks() {
    return tracks.map(({ absPath, ...rest }) => rest);
  }

  function findTrackById(id) {
    const track = trackById.get(id);
    if (!track) return null;
    const { absPath, ...rest } = track;
    return rest;
  }

  function resolvePathById(id) {
    return pathById.get(id) || null;
  }

  return {
    rescan,
    getTracks,
    findTrackById,
    resolvePathById,
    loadCache
  };
}

module.exports = createMusicScanner;
