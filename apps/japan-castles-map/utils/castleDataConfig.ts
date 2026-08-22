export function getCastleDataStorageBaseUrl(): string | null {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
  if (!supabaseUrl) {
    return null;
  }

  return `${supabaseUrl}/storage/v1/object/public/castle-data`;
}

export function isCastleDataRemoteSyncConfigured(): boolean {
  return getCastleDataStorageBaseUrl() != null;
}
