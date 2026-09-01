import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampPlaybackTime,
  clampVolume,
  displayName,
  filenameFromUri,
  findResumeIndex,
  formatClock,
  isAudioFilename,
  isVideoContainerFilename,
  nextIndex,
  parseSavedState,
  prevIndex,
  sanitizeFilename,
  serializeState,
  shouldShowVideoSurface,
  shouldUseVideoPlayer,
  isLandscapeLayout,
  filesFolderLabel,
  isCompactPhoneLayout,
  sortTrackNames,
  stepVolume,
  tracksFromListing,
  uniqueFilename,
  volumePercent,
} from "../public/player-logic.mjs";

describe("sortTrackNames", () => {
  it("orders numbered files naturally", () => {
    assert.deepEqual(sortTrackNames(["10.mp3", "2.mp3", "1.mp3"]), [
      "1.mp3",
      "2.mp3",
      "10.mp3",
    ]);
  });

  it("keeps Chinese titles stable", () => {
    const sorted = sortTrackNames(["老歌乙.mp3", "老歌甲.mp3"]);
    assert.equal(sorted.length, 2);
    assert.ok(sorted.includes("老歌乙.mp3"));
    assert.ok(sorted.includes("老歌甲.mp3"));
  });
});

describe("sanitizeFilename", () => {
  it("accepts audio files and strips path parts", () => {
    assert.equal(sanitizeFilename("../../folder/夜來香.mp3"), "夜來香.mp3");
  });

  it("rejects non-audio and hidden files", () => {
    assert.equal(sanitizeFilename("notes.txt"), null);
    assert.equal(sanitizeFilename(".hidden.mp3"), null);
    assert.equal(sanitizeFilename("../"), null);
  });
});

describe("isAudioFilename", () => {
  it("allows iPhone-friendly formats, including MP4 soundtrack", () => {
    assert.equal(isAudioFilename("a.mp3"), true);
    assert.equal(isAudioFilename("a.m4a"), true);
    assert.equal(isAudioFilename("演唱會.MP4"), true);
    assert.equal(isAudioFilename("a.ogg"), false);
  });
});

describe("playlist navigation", () => {
  it("wraps around the playlist", () => {
    assert.equal(nextIndex(2, 3), 0);
    assert.equal(prevIndex(0, 3), 2);
  });

  it("resumes the saved file when it still exists", () => {
    const tracks = [{ name: "a.mp3" }, { name: "b.mp3" }];
    assert.equal(findResumeIndex(tracks, "b.mp3"), 1);
    assert.equal(findResumeIndex(tracks, "missing.mp3"), 0);
  });
});

describe("volume and time", () => {
  it("steps volume in 10% increments", () => {
    assert.equal(stepVolume(0.8, 1), 0.9);
    assert.equal(stepVolume(0.05, -1), 0);
    assert.equal(volumePercent(0.8), "80%");
  });

  it("clamps resume time so it does not hit the end", () => {
    assert.equal(clampPlaybackTime(12, 10), 9.75);
    assert.equal(clampPlaybackTime(-3, 10), 0);
    assert.equal(clampVolume(2), 1);
  });

  it("formats clock time for the LCD", () => {
    assert.equal(formatClock(75), "1:15");
    assert.equal(formatClock(3661), "1:01:01");
  });
});

describe("saved state", () => {
  it("round-trips resume data", () => {
    const json = serializeState({
      file: "老歌.mp3",
      time: 32.4,
      volume: 0.7,
      playing: true,
    });
    assert.deepEqual(parseSavedState(json), {
      file: "老歌.mp3",
      time: 32.4,
      volume: 0.7,
      playing: true,
    });
  });

  it("ignores broken storage values", () => {
    assert.equal(parseSavedState("{"), null);
    assert.equal(parseSavedState(""), null);
  });
});

describe("displayName", () => {
  it("hides the file extension in the song title", () => {
    assert.equal(displayName("鄧麗君-月亮代表我的心.mp3"), "鄧麗君-月亮代表我的心");
  });
});

describe("iPhone Files helpers", () => {
  it("avoids overwriting an existing song name", () => {
    assert.equal(uniqueFilename(["夜來香.mp3"], "夜來香.mp3"), "夜來香 2.mp3");
    assert.equal(uniqueFilename(["夜來香.mp3", "夜來香 2.mp3"], "夜來香.mp3"), "夜來香 3.mp3");
    assert.equal(uniqueFilename(["a.mp3"], "b.mp3"), "b.mp3");
  });

  it("lists audio files from the Files app folder, including MP4", () => {
    assert.deepEqual(
      tracksFromListing("file:///docs/", [
        "Inbox",
        ".DS_Store",
        "2.mp4",
        "1.mp3",
        "notes.txt",
      ]),
      [
        { name: "1.mp3", uri: "file:///docs/1.mp3" },
        { name: "2.mp4", uri: "file:///docs/2.mp4" },
      ],
    );
  });

  it("reads the filename from an AirDrop file URL", () => {
    assert.equal(
      filenameFromUri("file:///private/var/Inbox/%E5%A4%9C%E4%BE%86%E9%A6%99.mp3"),
      "夜來香.mp3",
    );
  });
});

describe("MP4 playback surface", () => {
  it("keeps MP4 as soundtrack-only on phone, and shows video on tablet", () => {
    assert.equal(isVideoContainerFilename("家庭錄影.mp4"), true);
    assert.equal(isVideoContainerFilename("老歌.mp3"), false);
    assert.equal(shouldShowVideoSurface(), false);
    assert.equal(shouldShowVideoSurface(true), true);
    assert.equal(shouldUseVideoPlayer("家庭錄影.mp4", false), false);
    assert.equal(shouldUseVideoPlayer("家庭錄影.mp4", true), true);
    assert.equal(shouldUseVideoPlayer("老歌.mp3", true), false);
  });

  it("puts controls beside the picture in landscape", () => {
    assert.equal(isLandscapeLayout(1024, 768), true);
    assert.equal(isLandscapeLayout(768, 1024), false);
  });

  it("names the Files folder for the current device", () => {
    assert.equal(filesFolderLabel(false), "我的 iPhone");
    assert.equal(filesFolderLabel(true), "我的 iPad");
  });

  it("uses a compact phone layout on iPhone SE-sized screens", () => {
    assert.equal(isCompactPhoneLayout(375, 667, false), true);
    assert.equal(isCompactPhoneLayout(320, 568, false), true);
    assert.equal(isCompactPhoneLayout(390, 844, false), false);
    assert.equal(isCompactPhoneLayout(768, 1024, true), false);
  });
});
