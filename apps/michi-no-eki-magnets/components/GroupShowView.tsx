import { lazy, Suspense, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';

import { colors } from '../constants/theme';
import { useI18n } from '../i18n';
import type { Station } from '../types/station';
import type { StationGroup } from '../types/stationGroup';
import {
  MEDIA_COLLECTIBLE_KINDS,
  type StationCollectible,
  type MediaCollectibleKind,
} from '../types/stationCollectible';
import { groupCollectiblesByRegionAndPrefecture } from '../utils/groupCollectiblesByLocation';
import {
  getCollectibleDisplayUri,
  isImageCollectible,
  listCollectiblesForCastleIds,
} from '../utils/stationCollectibleStorage';
import { captureViewAsJpg, waitForCaptureRef, waitForExportLayout } from '../utils/exportGroupShowImage';

const CollectibleGalleryViewer = lazy(async () => {
  const module = await import('./CollectibleGalleryViewer');
  return { default: module.CollectibleGalleryViewer };
});

type GroupShowViewProps = {
  group: StationGroup;
  castleById: Map<number, Station>;
};

export type GroupShowViewHandle = {
  exportJpg: () => Promise<string>;
};

const CAPTURE_HORIZONTAL_PADDING = 16;
const SECTION_HORIZONTAL_PADDING = 14;
const THUMBNAIL_GAP = 10;
const THUMBNAIL_COLUMNS = 4;

function computeThumbnailSize(galleryWidth: number): number {
  if (galleryWidth <= 0) {
    return 0;
  }

  return Math.floor(
    (galleryWidth - THUMBNAIL_GAP * (THUMBNAIL_COLUMNS - 1)) / THUMBNAIL_COLUMNS,
  );
}

function estimateGalleryWidth(screenWidth: number): number {
  const contentWidth = screenWidth - CAPTURE_HORIZONTAL_PADDING * 2;
  return contentWidth - SECTION_HORIZONTAL_PADDING * 2;
}

function getKindLabel(kind: MediaCollectibleKind, t: (key: string) => string): string {
  switch (kind) {
    case 'magnet':
      return t('station.magnetUploadTitle');
  }
}

function buildCollectiblesByKind(
  stationIds: readonly number[],
  items: readonly StationCollectible[],
): Map<MediaCollectibleKind, StationCollectible[]> {
  const byKind = new Map<MediaCollectibleKind, StationCollectible[]>();

  for (const kind of MEDIA_COLLECTIBLE_KINDS) {
    const kindItems: StationCollectible[] = [];

    for (const stationId of stationIds) {
      kindItems.push(
        ...items
          .filter((item) => item.stationId === stationId && item.kind === kind)
          .sort((left, right) => right.createdAt - left.createdAt),
      );
    }

    if (kindItems.length > 0) {
      byKind.set(kind, kindItems);
    }
  }

  return byKind;
}

function CollectibleThumbnailGrid({
  items,
  thumbnailSize,
  onOpen,
  onGalleryLayout,
}: {
  items: readonly StationCollectible[];
  thumbnailSize: number;
  onOpen: (item: StationCollectible, galleryItems: readonly StationCollectible[]) => void;
  onGalleryLayout?: (width: number) => void;
}) {
  return (
    <View
      style={styles.gallery}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (width > 0) {
          onGalleryLayout?.(width);
        }
      }}
    >
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          onPress={() => onOpen(item, items)}
          style={[
            styles.thumbnailCard,
            { width: thumbnailSize, height: thumbnailSize },
          ]}
        >
          {isImageCollectible(item) ? (
            <Image
              key={`${item.id}-${item.createdAt}`}
              source={{ uri: getCollectibleDisplayUri(item) }}
              style={styles.thumbnailImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.pdfThumbnail}>
              <Text style={styles.pdfLabel}>PDF</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

export const GroupShowView = forwardRef<GroupShowViewHandle, GroupShowViewProps>(
  function GroupShowView({ group, castleById }, ref) {
  const { t, getRegionLabel, getPrefectureLabel } = useI18n();
  const { width: screenWidth } = useWindowDimensions();
  const [galleryWidth, setGalleryWidth] = useState<number | null>(null);
  const thumbnailSize = useMemo(
    () => computeThumbnailSize(galleryWidth ?? estimateGalleryWidth(screenWidth)),
    [galleryWidth, screenWidth],
  );
  const handleGalleryLayout = useCallback((width: number) => {
    setGalleryWidth((current) => (current === width ? current : width));
  }, []);
  const shotRef = useRef<ViewShot>(null);
  const [items, setItems] = useState<StationCollectible[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerItems, setViewerItems] = useState<StationCollectible[]>([]);

  useImperativeHandle(ref, () => ({
    exportJpg: async () => {
      if (loading) {
        throw new Error('export-not-ready');
      }

      setIsCapturing(true);
      try {
        await waitForCaptureRef(shotRef);
        return await captureViewAsJpg(shotRef);
      } finally {
        setIsCapturing(false);
      }
    },
  }), [loading]);

  useEffect(() => {
    setLoading(true);
    setItems(listCollectiblesForCastleIds(group.stationIds));
    setLoading(false);
  }, [group.stationIds, group.id]);

  const groupCastles = useMemo(
    () =>
      group.stationIds
        .map((id) => castleById.get(id))
        .filter((station): station is Station => station != null),
    [castleById, group.stationIds],
  );

  const collectiblesByKind = useMemo(
    () => buildCollectiblesByKind(group.stationIds, items),
    [group.stationIds, items],
  );

  const openViewer = (
    item: StationCollectible,
    galleryItems: readonly StationCollectible[],
  ) => {
    const index = galleryItems.findIndex((candidate) => candidate.id === item.id);
    if (index < 0) {
      return;
    }

    setViewerItems([...galleryItems]);
    setViewerIndex(index);
    setViewerVisible(true);
  };

  const showBody = (
    <>
      {groupCastles.length === 0 ? (
        <Text style={styles.emptyText}>{t('group.showNoStations')}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator size="small" color={colors.original} style={styles.loader} />
      ) : (
        <>
          {MEDIA_COLLECTIBLE_KINDS.map((kind) => {
            const kindItems = collectiblesByKind.get(kind);
            if (!kindItems || kindItems.length === 0) {
              return null;
            }

            const locationSections = groupCollectiblesByRegionAndPrefecture(
              kindItems,
              castleById,
            );

            return (
              <View key={kind} style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>{getKindLabel(kind, t)}</Text>
                {locationSections.map((regionSection) => (
                  <View key={regionSection.regionId} style={styles.regionSection}>
                    <Text style={styles.regionTitle}>
                      {getRegionLabel(regionSection.regionId)}
                    </Text>
                    {regionSection.prefectureGroups.map((prefectureGroup) => (
                      <View
                        key={`${regionSection.regionId}-${prefectureGroup.prefectureKey}`}
                        style={styles.prefectureSection}
                      >
                        <Text style={styles.prefectureTitle}>
                          {getPrefectureLabel(prefectureGroup.prefectureKey)}
                        </Text>
                        <CollectibleThumbnailGrid
                          items={prefectureGroup.items}
                          thumbnailSize={thumbnailSize}
                          onOpen={openViewer}
                          onGalleryLayout={handleGalleryLayout}
                        />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          })}
        </>
      )}
    </>
  );

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { width: screenWidth, paddingHorizontal: CAPTURE_HORIZONTAL_PADDING },
        ]}
        collapsable={false}
      >
        <View style={styles.captureRoot} collapsable={false}>
          {showBody}
        </View>
      </ScrollView>

      {isCapturing ? (
        <View style={styles.captureLayer} pointerEvents="none" collapsable={false}>
          <ViewShot
            ref={shotRef}
            style={[
              styles.captureRoot,
              {
                width: screenWidth,
                paddingHorizontal: CAPTURE_HORIZONTAL_PADDING,
              },
            ]}
          >
            {showBody}
          </ViewShot>
        </View>
      ) : null}

      {viewerVisible ? (
        <Suspense fallback={null}>
          <CollectibleGalleryViewer
            items={viewerItems}
            initialIndex={viewerIndex}
            visible={viewerVisible}
            onClose={() => setViewerVisible(false)}
          />
        </Suspense>
      ) : null}
    </>
  );
},
);

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 12,
    paddingBottom: 32,
  },
  captureRoot: {
    gap: 12,
    backgroundColor: colors.background,
  },
  captureLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: 0,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  regionSection: {
    gap: 10,
    marginTop: 4,
  },
  regionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.original,
  },
  prefectureSection: {
    gap: 8,
    paddingLeft: 4,
  },
  prefectureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  loader: {
    marginTop: 8,
  },
  gallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THUMBNAIL_GAP,
    paddingVertical: 2,
  },
  thumbnailCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  pdfThumbnail: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.originalLight,
  },
  pdfLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.original,
  },
});
