import type { ParsedEpisode, ParsedFeed } from '../types/podcast';
import { maskCdata, parseAttributes, restoreCdata, xmlInnerText } from './xml';
import { parseDurationMillis } from './media';

const ITEM_PATTERN = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
const TAG_PATTERN = (name: string) =>
  new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i');

function tagText(block: string, name: string): string | null {
  const match = block.match(TAG_PATTERN(name));
  if (!match) return null;
  const text = xmlInnerText(match[1]);
  return text.length > 0 ? text : null;
}

function parseBytes(value: string | undefined): number | null {
  if (!value) return null;
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  return Math.floor(bytes);
}

function publishedAt(raw: string | null): string | null {
  if (!raw) return null;
  const time = Date.parse(raw);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString();
}

function audioSource(block: string): { url: string; type: string | null; bytes: number | null } | null {
  const enclosure = block.match(/<enclosure\b([^>]*)\/?>/i);
  if (enclosure) {
    const attributes = parseAttributes(enclosure[1]);
    if (attributes.url) {
      return {
        url: attributes.url,
        type: attributes.type ?? null,
        bytes: parseBytes(attributes.length),
      };
    }
  }

  for (const match of block.matchAll(/<media:content\b([^>]*)\/?>/gi)) {
    const attributes = parseAttributes(match[1]);
    const type = attributes.type ?? '';
    const medium = attributes.medium ?? '';
    const url = attributes.url ?? '';
    const audio =
      type.startsWith('audio/') ||
      medium === 'audio' ||
      /\.(mp3|m4a|m4b|aac)(\?|$)/i.test(url);
    if (url && audio) {
      return {
        url,
        type: type || null,
        bytes: parseBytes(attributes.filesize ?? attributes.length),
      };
    }
  }

  return null;
}

function channelPreamble(masked: string): string {
  const channelAt = masked.search(/<channel\b/i);
  const itemAt = masked.search(/<item\b/i);
  if (channelAt < 0) return masked;
  const end = itemAt > channelAt ? itemAt : masked.length;
  return masked.slice(channelAt, end);
}

function artworkUrl(preamble: string): string | null {
  const itunes = preamble.match(/<itunes:image\b([^>]*)\/?>/i);
  if (itunes) {
    const href = parseAttributes(itunes[1]).href;
    if (href) return href;
  }
  const image = preamble.match(/<image\b[^>]*>([\s\S]*?)<\/image>/i);
  if (!image) return null;
  return tagText(image[1], 'url');
}

export function parsePodcastFeed(xml: string): ParsedFeed | null {
  const source = xml.replace(/^\uFEFF/, '');
  const { masked, blocks } = maskCdata(source);
  const preamble = restoreCdata(channelPreamble(masked), blocks);
  const title = tagText(preamble, 'title') ?? '';
  const author = tagText(preamble, 'itunes:author') ?? tagText(preamble, 'author') ?? '';
  const episodes: ParsedEpisode[] = [];

  for (const match of masked.matchAll(ITEM_PATTERN)) {
    const block = restoreCdata(match[1], blocks);
    const audio = audioSource(block);
    if (!audio) continue;
    const summary = tagText(block, 'itunes:summary') ?? tagText(block, 'description') ?? '';
    episodes.push({
      title: tagText(block, 'title') ?? '未命名單集',
      guid: tagText(block, 'guid'),
      publishedAt: publishedAt(tagText(block, 'pubDate') ?? tagText(block, 'dc:date')),
      enclosureUrl: audio.url,
      enclosureType: audio.type,
      expectedBytes: audio.bytes,
      durationMillis: parseDurationMillis(tagText(block, 'itunes:duration')),
      summary: summary.slice(0, 280),
    });
  }

  if (!title && episodes.length === 0) return null;
  return {
    title: title || '未命名節目',
    author,
    artworkUrl: artworkUrl(preamble),
    episodes,
  };
}
