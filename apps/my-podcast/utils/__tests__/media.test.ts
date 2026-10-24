import { formatPlaybackTime, isDownloadComplete, looksLikeAudio, parseDurationMillis, savedFileIsPlayable } from '../media';
import { decodeXmlEntities, parseAttributes, xmlInnerText } from '../xml';
import { canonicalMediaUrl, extensionForEpisode, normalizeFeedUrl } from '../identity';

describe('media checks', () => {
  it('parses and formats durations', () => {
    expect(parseDurationMillis('90')).toBe(90_000);
    expect(parseDurationMillis('1:02')).toBe(62_000);
    expect(parseDurationMillis('1:02:03')).toBe(3_723_000);
    expect(parseDurationMillis('nope')).toBeNull();
    expect(parseDurationMillis(null)).toBeNull();
    expect(parseDurationMillis('1:2:3:4')).toBeNull();
    expect(formatPlaybackTime(0)).toBe('0:00');
    expect(formatPlaybackTime(65_000)).toBe('1:05');
    expect(formatPlaybackTime(3_661_000)).toBe('1:01:01');
    expect(formatPlaybackTime(Number.NaN)).toBe('0:00');
  });

  it('accepts a full audio file and rejects a short or html body', () => {
    expect(isDownloadComplete(5_000_000, 5_000_000)).toBe(true);
    expect(isDownloadComplete(5_000_000, null)).toBe(true);
    expect(isDownloadComplete(100, null)).toBe(false);
    expect(isDownloadComplete(20_000, 5_000_000)).toBe(false);
    expect(isDownloadComplete(5_000_000, 100)).toBe(true);
    expect(savedFileIsPlayable({ exists: true, bytes: 5_000_000 }, 5_000_000, 80_000_000)).toBe(true);
    expect(savedFileIsPlayable({ exists: true, bytes: 20_000 }, 5_000_000, 5_000_000)).toBe(false);
    expect(savedFileIsPlayable({ exists: false, bytes: 0 }, 5_000_000, null)).toBe(false);

    expect(looksLikeAudio(Uint8Array.from([0x49, 0x44, 0x33, ...new Array(9).fill(0)]))).toBe(true);
    const m4a = new Uint8Array(16);
    m4a.set([0x66, 0x74, 0x79, 0x70], 4);
    expect(looksLikeAudio(m4a)).toBe(true);
    expect(looksLikeAudio(Uint8Array.from([0xff, 0xfb, ...new Array(10).fill(0)]))).toBe(true);
    expect(looksLikeAudio(Uint8Array.from(Buffer.from('<!DOCTYPE html>')))).toBe(false);
    expect(looksLikeAudio(Uint8Array.from([1, 2, 3]))).toBe(false);
    expect(looksLikeAudio(Uint8Array.from(Buffer.from('fLaC............')))).toBe(true);
    expect(looksLikeAudio(Uint8Array.from(Buffer.from('OggS............')))).toBe(true);
    expect(looksLikeAudio(Uint8Array.from(Buffer.from('RIFF............')))).toBe(true);
  });

  it('normalizes urls and file extensions', () => {
    expect(normalizeFeedUrl('https://example.com/feed.xml#part')).toBe('https://example.com/feed.xml');
    expect(normalizeFeedUrl('ftp://example.com/feed.xml')).toBeNull();
    expect(canonicalMediaUrl('not a url?x=1')).toBe('not a url');
    expect(extensionForEpisode('audio/mpeg', 'https://cdn.example/a')).toBe('mp3');
    expect(extensionForEpisode('audio/mp4', 'https://cdn.example/a')).toBe('m4a');
    expect(extensionForEpisode('audio/wav', 'https://cdn.example/a')).toBe('wav');
    expect(extensionForEpisode('audio/ogg', 'https://cdn.example/a')).toBe('ogg');
    expect(extensionForEpisode('audio/flac', 'https://cdn.example/a.flac')).toBe('flac');
    expect(extensionForEpisode(null, 'https://cdn.example/a.wav?x=1')).toBe('wav');
    expect(extensionForEpisode(null, 'https://cdn.example/noext')).toBe('mp3');
    expect(decodeXmlEntities('&amp;&#65;&lt;&gt;&quot;&apos;&nbsp;&#X43;&#9999999999;&#x110000;&unknown;')).toBe(
      '&A<>"\' C&#9999999999;&#x110000;&unknown;',
    );
    expect(xmlInnerText('<![CDATA[Hello <b>there</b>]]>')).toBe('Hello there');
    expect(parseAttributes(`href='https://example.com/a.jpg'`).href).toBe('https://example.com/a.jpg');
  });
});
