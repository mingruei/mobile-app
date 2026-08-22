export function getStationDataStorageBaseUrl(): string | null {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
  if (!supabaseUrl) {
    return null;
  }

  return `${supabaseUrl}/storage/v1/object/public/station-data`;
}

export function isStationDataRemoteSyncConfigured(): boolean {
  return getStationDataStorageBaseUrl() != null;
}
