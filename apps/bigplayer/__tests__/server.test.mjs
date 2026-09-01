import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { startServer } from "../server.mjs";
import { writeToneWav } from "../scripts/write-tone-wav.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("music server", () => {
  const dir = fs.mkdtempSync(path.join(root, ".tmp-"));
  const port = 34567;
  let server;
  const base = `http://127.0.0.1:${port}`;

  before(async () => {
    writeToneWav(path.join(dir, "2-後曲.wav"), 550);
    writeToneWav(path.join(dir, "1-前曲.wav"), 440);
    server = await startServer({
      port,
      host: "127.0.0.1",
      musicDir: dir,
      quiet: true,
    });
  });

  after(() => {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("lists audio files in natural order", async () => {
    const res = await fetch(`${base}/api/playlist`);
    const body = await res.json();
    assert.deepEqual(
      body.tracks.map((track) => track.name),
      ["1-前曲.wav", "2-後曲.wav"],
    );
  });

  it("serves an audio file with range support", async () => {
    const res = await fetch(`${base}/music/${encodeURIComponent("1-前曲.wav")}`, {
      headers: { Range: "bytes=0-43" },
    });
    assert.equal(res.status, 206);
    assert.equal((await res.arrayBuffer()).byteLength, 44);
  });
});
