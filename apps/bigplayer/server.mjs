import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isAudioFilename, sortTrackNames } from "./public/player-logic.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const DEFAULT_MUSIC_DIR = path.join(__dirname, "music");
const DEFAULT_PORT = Number(process.env.PORT) || 3456;
const DEFAULT_HOST = process.env.HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".mp4": "video/mp4",
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function sendError(res, status, message) {
  json(res, status, { error: message });
}

function insideDir(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep);
}

function lanUrls(port) {
  const urls = [`http://127.0.0.1:${port}`];
  try {
    for (const addrs of Object.values(os.networkInterfaces() ?? {})) {
      for (const addr of addrs ?? []) {
        const family = addr.family === 4 || addr.family === "IPv4";
        if (family && !addr.internal) {
          urls.push(`http://${addr.address}:${port}`);
        }
      }
    }
  } catch {
    // Some environments block network interface listing.
  }
  return [...new Set(urls)];
}

function listTracks(musicDir) {
  const names = fs
    .readdirSync(musicDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isAudioFilename(entry.name))
    .map((entry) => entry.name);

  return sortTrackNames(names).map((name) => ({
    name,
    url: "/music/" + encodeURIComponent(name),
  }));
}

function sendStatic(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  if (!stat.isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.writeHead(416);
      res.end();
      return;
    }
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : stat.size - 1;
    if (start >= stat.size || end >= stat.size || start > end) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      "Content-Type": type,
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Cache-Control": MIME[ext]?.startsWith("audio/") ? "no-cache" : "public, max-age=3600",
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Content-Length": stat.size,
  });
  fs.createReadStream(filePath).pipe(res);
}

export function startServer({
  port = DEFAULT_PORT,
  host = DEFAULT_HOST,
  musicDir = process.env.MUSIC_DIR ? path.resolve(process.env.MUSIC_DIR) : DEFAULT_MUSIC_DIR,
  quiet = false,
} = {}) {
  fs.mkdirSync(musicDir, { recursive: true });

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/api/playlist") {
      json(res, 200, { tracks: listTracks(musicDir) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/info") {
      json(res, 200, { urls: lanUrls(port) });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/music/")) {
      const name = decodeURIComponent(url.pathname.slice("/music/".length));
      const base = path.basename(name);
      if (!base || !isAudioFilename(base)) {
        sendError(res, 400, "檔名不正確");
        return;
      }
      const filePath = path.join(musicDir, base);
      if (!insideDir(musicDir, filePath) || !fs.existsSync(filePath)) {
        sendError(res, 404, "找不到這首歌");
        return;
      }
      sendStatic(req, res, filePath);
      return;
    }

    if (req.method === "GET") {
      const relative = url.pathname === "/" ? "/index.html" : url.pathname;
      const filePath = path.join(PUBLIC_DIR, path.normalize(relative));
      if (!insideDir(PUBLIC_DIR, filePath)) {
        res.writeHead(403);
        res.end();
        return;
      }
      sendStatic(req, res, filePath);
      return;
    }

    res.writeHead(405);
    res.end();
  });

  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      if (!quiet) {
        console.log("大字播已啟動");
        for (const url of lanUrls(port)) {
          console.log("  " + url);
        }
        console.log("把音樂檔放到：", musicDir);
      }
      resolve(server);
    });
    server.on("error", reject);
  });
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  startServer();
}
