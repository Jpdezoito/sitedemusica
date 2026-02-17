const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const mime = require('mime');
const chokidar = require('chokidar');
const multer = require('multer');
const createMusicScanner = require('./musicScanner');
const createPlaylistsStore = require('./playlistsStore');

const PORT = process.env.PORT || 3000;
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const MUSIC_DIR = process.env.MUSIC_DIR && process.env.MUSIC_DIR.trim()
  ? (path.isAbsolute(process.env.MUSIC_DIR)
    ? process.env.MUSIC_DIR
    : path.resolve(PROJECT_ROOT, process.env.MUSIC_DIR))
  : path.resolve(PROJECT_ROOT, 'music');
const WEB_DIR = PROJECT_ROOT;
const ALLOWED_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.flac']);

const app = express();
app.use(cors());
app.use(express.json());

const musicScanner = createMusicScanner(MUSIC_DIR);
const playlistsStore = createPlaylistsStore();
let queue = [];

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
    cb(null, MUSIC_DIR);
  },
  filename: (req, file, cb) => {
    const parsed = path.parse(file.originalname);
    const baseName = parsed.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'arquivo';
    const ext = parsed.ext.toLowerCase();
    const reserved = req.uploadedNames || new Set();
    let candidate = `${baseName}${ext}`;
    let counter = 1;
    while (reserved.has(candidate) || fs.existsSync(path.join(MUSIC_DIR, candidate))) {
      candidate = `${baseName}_${counter}${ext}`;
      counter += 1;
    }
    reserved.add(candidate);
    req.uploadedNames = reserved;
    cb(null, candidate);
  }
});

const upload = multer({
  storage: uploadStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      req.rejectedFiles = req.rejectedFiles || [];
      req.rejectedFiles.push({ name: file.originalname, reason: 'Extensao nao permitida' });
      cb(null, false);
      return;
    }
    cb(null, true);
  }
});

app.use(express.static(WEB_DIR));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, tracksCount: musicScanner.getTracks().length });
});

app.get('/api/tracks', async (req, res) => {
  try {
    const refresh = req.query.refresh === '1';
    if (refresh) {
      await musicScanner.rescan();
    }
    res.json(musicScanner.getTracks());
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar músicas', details: err.message });
  }
});

app.post('/api/upload', upload.array('files'), async (req, res) => {
  try {
    const added = (req.files || []).map((file) => ({
      name: file.originalname,
      storedAs: file.filename
    }));
    const rejected = req.rejectedFiles || [];
    await musicScanner.rescan();
    res.json({ ok: true, added, rejected });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Falha no upload', details: err.message });
  }
});

app.post('/api/rescan', async (_req, res) => {
  try {
    await musicScanner.rescan();
    const tracks = musicScanner.getTracks();
    res.json({ tracks, count: tracks.length });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao reescanear', details: err.message });
  }
});

app.delete('/api/tracks/:id', async (req, res) => {
  const trackId = decodeURIComponent(req.params.id);
  const track = musicScanner.findTrackById(trackId);
  if (!track) {
    return res.status(404).json({ error: 'Faixa nao encontrada' });
  }

  const resolvedPath = musicScanner.resolvePathById(trackId);
  if (!resolvedPath) {
    return res.status(404).json({ error: 'Arquivo nao encontrado' });
  }

  const absolutePath = path.resolve(resolvedPath);
  const musicRoot = path.resolve(MUSIC_DIR);
  const isInsideMusicDir = absolutePath === musicRoot || absolutePath.startsWith(`${musicRoot}${path.sep}`);
  if (!isInsideMusicDir) {
    return res.status(403).json({ error: 'Caminho invalido para exclusao' });
  }

  try {
    await fs.promises.access(absolutePath, fs.constants.F_OK);
  } catch (err) {
    return res.status(404).json({ error: 'Arquivo nao encontrado no disco' });
  }

  try {
    await fs.promises.unlink(absolutePath);
    await musicScanner.rescan();
    return res.json({ ok: true, deletedId: track.id, filename: track.filename });
  } catch (err) {
    if (err && (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES')) {
      return res.status(409).json({ error: 'Nao foi possivel excluir: arquivo em uso ou sem permissao' });
    }
    return res.status(500).json({ error: 'Falha ao excluir arquivo', details: err.message });
  }
});

app.get('/api/queue', (_req, res) => {
  res.json({ queue });
});

app.post('/api/queue', (req, res) => {
  const { trackIds } = req.body;
  if (!Array.isArray(trackIds)) {
    return res.status(400).json({ error: 'trackIds deve ser um array' });
  }
  queue = [...queue, ...trackIds];
  res.json({ queue });
});

app.post('/api/queue/replace', (req, res) => {
  const { trackIds } = req.body;
  if (!Array.isArray(trackIds)) {
    return res.status(400).json({ error: 'trackIds deve ser um array' });
  }
  queue = [...trackIds];
  res.json({ queue });
});

app.delete('/api/queue', (_req, res) => {
  queue = [];
  res.json({ queue });
});

app.get('/api/playlists', async (_req, res) => {
  try {
    const playlists = await playlistsStore.getPlaylists();
    res.json({ playlists });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar playlists', details: err.message });
  }
});

app.post('/api/playlists', async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name deve ser uma string' });
  }
  try {
    const playlist = await playlistsStore.createPlaylist(name.trim());
    res.status(201).json({ playlist });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao criar playlist', details: err.message });
  }
});

app.put('/api/playlists/:id', async (req, res) => {
  const { name, trackIds } = req.body;
  if (trackIds !== undefined && !Array.isArray(trackIds)) {
    return res.status(400).json({ error: 'trackIds deve ser um array' });
  }
  if (name !== undefined && typeof name !== 'string') {
    return res.status(400).json({ error: 'name deve ser uma string' });
  }
  try {
    const playlist = await playlistsStore.updatePlaylist(req.params.id, { name, trackIds });
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist nao encontrada' });
    }
    res.json({ playlist });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao atualizar playlist', details: err.message });
  }
});

app.delete('/api/playlists/:id', async (req, res) => {
  try {
    const removed = await playlistsStore.deletePlaylist(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Playlist nao encontrada' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao remover playlist', details: err.message });
  }
});

app.get('/api/stream/:id', (req, res) => {
  const trackId = decodeURIComponent(req.params.id);
  const filePath = musicScanner.resolvePathById(trackId);
  if (!filePath) {
    return res.status(404).json({ error: 'Música não encontrada' });
  }

  const stat = fs.statSync(filePath);
  const range = req.headers.range;
  const mimeType = mime.getType(filePath) || 'audio/mpeg';

  if (!range) {
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': stat.size
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
  const start = parseInt(startStr, 10);
  const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start < 0) {
    res.status(416).set('Content-Range', `bytes */${stat.size}`).end();
    return;
  }
  const chunkSize = end - start + 1;

  const file = fs.createReadStream(filePath, { start, end });
  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${stat.size}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunkSize,
    'Content-Type': mimeType
  });
  file.pipe(res);
});

app.get('/api/cover/:id', async (req, res) => {
  const trackId = decodeURIComponent(req.params.id);
  const filePath = musicScanner.resolvePathById(trackId);
  if (!filePath) {
    return res.status(404).json({ error: 'Capa nao encontrada' });
  }

  try {
    const metadata = await require('music-metadata').parseFile(filePath, { duration: false });
    const picture = metadata.common.picture && metadata.common.picture[0];
    if (!picture) {
      return res.status(404).json({ error: 'Capa nao encontrada' });
    }
    res.setHeader('Content-Type', picture.format || 'image/jpeg');
    res.send(picture.data);
  } catch (err) {
    res.status(404).json({ error: 'Capa nao encontrada' });
  }
});

app.get('/api/status', (_req, res) => {
  res.json({
    musicDir: MUSIC_DIR,
    trackCount: musicScanner.getTracks().length,
    queueSize: queue.length
  });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint não encontrado' });
  }
  res.sendFile(path.join(WEB_DIR, 'index.html'));
});

async function bootstrap() {
  try {
    await musicScanner.loadCache();
    await musicScanner.rescan();
    if (fs.existsSync(MUSIC_DIR)) {
      const watcher = chokidar.watch(MUSIC_DIR, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 }
      });
      let pending = null;
      const scheduleRescan = () => {
        if (pending) return;
        pending = setTimeout(async () => {
          pending = null;
          await musicScanner.rescan();
        }, 500);
      };
      watcher.on('add', scheduleRescan);
      watcher.on('unlink', scheduleRescan);
      watcher.on('change', scheduleRescan);
      watcher.on('addDir', scheduleRescan);
      watcher.on('unlinkDir', scheduleRescan);
    }
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor iniciado em http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Falha ao iniciar servidor', err);
    process.exit(1);
  }
}

bootstrap();
