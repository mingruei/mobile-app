export function decodeXmlEntities(value: string): string {
  return value.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (entity, body: string) => {
    const named: Record<string, string> = {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'",
      nbsp: ' ',
    };
    if (body in named) return named[body];
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    return entity;
  });
}

export function xmlInnerText(raw: string): string {
  const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  const text = cdata ? cdata[1] : decodeXmlEntities(raw);
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function maskCdata(xml: string): { masked: string; blocks: string[] } {
  const blocks: string[] = [];
  const masked = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, (block) => {
    const token = `___CDATA_${blocks.length}___`;
    blocks.push(block);
    return token;
  });
  return { masked, blocks };
}

export function restoreCdata(value: string, blocks: string[]): string {
  return value.replace(/___CDATA_(\d+)___/g, (_, index: string) => blocks[Number(index)] ?? '');
}

export function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const match of source.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = decodeXmlEntities(match[2] ?? match[3] ?? '');
  }
  return attributes;
}
