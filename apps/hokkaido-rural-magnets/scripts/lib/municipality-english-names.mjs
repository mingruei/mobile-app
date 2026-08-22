/** Strip GSI-style suffixes from romaji municipality names. */
export function toEnglishMunicipalityName(romaji) {
  const trimmed = romaji.trim();
  const withoutSuffix = trimmed.replace(/\s+(Shi|Ku|Cho|Machi|Mura)$/i, '');
  return withoutSuffix.trim();
}

export function buildEnglishNameLookup(records) {
  const lookup = new Map();

  for (const record of records) {
    const code = record.code?.trim();
    const romaji = record.name_romaji?.trim();
    if (!code || !romaji) {
      continue;
    }

    lookup.set(code, toEnglishMunicipalityName(romaji));
  }

  return lookup;
}
