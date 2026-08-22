export function extractCastleAliases(description: string): string | null {
  const quotedMatch = description.match(/(?:別名|俗稱)((?:「[^」]+」)+(?:或「[^」]+」)*)/);
  if (quotedMatch) {
    const aliases = [...quotedMatch[1].matchAll(/「([^」]+)」/g)]
      .map(([, value]) => value.replace(/（[^）]*）/g, '').trim())
      .filter((value) => value.length > 0);

    if (aliases.length > 0) {
      return aliases.join('、');
    }
  }

  const akaMatch = description.match(/又名([^，。]+)/);
  if (akaMatch) {
    const alias = akaMatch[1].replace(/（[^）]*）/g, '').trim();
    return alias.length > 0 ? alias : null;
  }

  return null;
}

export function formatChineseSubtitleLine(
  chineseName: string,
  alias: string | null | undefined,
): string {
  const chinese = chineseName.trim();
  const trimmedAlias = alias?.trim();

  if (trimmedAlias) {
    return `${chinese} – ${trimmedAlias}`;
  }

  return chinese;
}
