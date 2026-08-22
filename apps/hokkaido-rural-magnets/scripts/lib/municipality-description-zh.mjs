export function buildDescriptionZhLookup(records) {
  const lookup = new Map();
  for (const [id, text] of Object.entries(records)) {
    lookup.set(Number(id), text);
  }
  return lookup;
}
