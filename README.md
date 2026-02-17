# Player de músicas local

Projeto simples com back-end Node.js + Express e front-end HTML/CSS/JS para tocar músicas armazenadas em `./music`.

## Estrutura
```
sitedeminhasmusicas/
  music/          # Arquivos de audio
  server/         # API + streaming
    src/
      index.js
      musicScanner.js
      playlistsStore.js
    data/
      playlists.json
      tracks-cache.json
    package.json
  web/            # Front-end estático
    index.html
    styles.css
    app.js
```

## Pré-requisitos
- Node.js 18+ instalado.
- Pasta de músicas acessível em `./music`, ou configure `MUSIC_DIR`.

## Como rodar
1. Abra um terminal na pasta `server/`.
2. Instale dependências:
   ```
   npm install
   ```
3. Inicie o servidor (expõe a API e os arquivos estáticos):
   ```
   npm run dev
   ```
4. Acesse o site em: http://localhost:3000

### Usando outra pasta de músicas
No Windows (PowerShell):
```
$env:MUSIC_DIR="D:\\Musicas"
npm run dev
```

No macOS/Linux:
```
MUSIC_DIR="/Users/seuusuario/Musicas" npm run dev
```

## O que o servidor faz
- Escaneia `./music` (ou `MUSIC_DIR`) e lê metadados básicos via `music-metadata`.
- Endpoints principais:
  - `GET /api/health` — `{ ok: true, tracksCount }`.
  - `GET /api/tracks` — lista completa em JSON.
  - `GET /api/stream/:id` — streaming com suporte a Range.
- Serve os arquivos estáticos da pasta `web/`.

## Observações
- Os caminhos das músicas são resolvidos a partir do `server/src/index.js` para a pasta `./music`.
- A fila é mantida em memória; reiniciar o servidor limpa a fila.
- Layout otimizado para desktop, com barra de player fixa e tabela de fila.

## Exemplos de uso da API
Lista completa:
```
GET http://localhost:3000/api/tracks
```

Streaming (exemplo com curl):
```
curl -H "Range: bytes=0-" "http://localhost:3000/api/stream/ARTISTA%2Falbum%2Fmusica.mp3"
```

## Deploy (Render / Railway / Fly)
- Build: `npm install`
- Start: `node src/index.js`
- Variaveis de ambiente:
  - `PORT` (fornecida pela plataforma)
  - `MUSIC_DIR` (opcional, caminho absoluto ou relativo ao projeto)
