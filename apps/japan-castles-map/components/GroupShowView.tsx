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
import type { Castle } from '../types/castle';
import type { CastleGroup } from '../types/castleGroup';
import {
  MEDIA_COLLECTIBLE_KINDS,
  type CastleCollectible,
  type MediaCollectibleKind,
} from '../types/castleCollectible';
import {
  getCollectibleDisplayUri,
  isImageCollectible,
  listCollectiblesForCastleIds,
} from '../utils/castleCollectibleStorage';
import { captureViewAsJpg, waitForCaptureRef, waitForExportLayout } from '../utils/exportGroupShowImage';

const CollectibleGalleryViewer = lazy(async () => {
  const module = await import('./CollectibleGalleryViewer');
  return { default: module.CollectibleGalleryViewer };
});

type GroupShowViewProps = {
  group: CastleGroup;
  castleById: Map<number, Castle>;
};

export type GroupShowViewHandle = {
  exportJpg: () => Promise<string>;
};

type VisitRecordGroup = {
  castle: Castle;
  items: CastleCollectible[];
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
    case 'meijo-stamp':
      return t('castle.meijoStampUploadTitle');
    case 'goshuin':
      return t('castle.goshuinUploadTitle');
    case 'castle-card':
      return t('castle.castleCardUploadTitle');
  }
}

function buildCollectiblesByKind(
  castleIds: readonly number[],
  items: readonly CastleCollectible[],
): Map<MediaCollectibleKind, CastleCollectible[]> {
  const byKind = new Map<MediaCollectibleKind, CastleCollectible[]>();

  for (const kind of MEDIA_COLLECTIBLE_KINDS) {
    const kindItems: CastleCollectible[] = [];

    for (const castleId of castleIds) {
      kindItems.push(
        ...items
          .filter((item) => item.castleId === castleId && item.kind === kind)
          .sort((left, right) => right.createdAt - left.createdAt),
      );
    }

    if (kindItems.length > 0) {
      byKind.set(kind, kindItems);
    }
  }

  return byKind;
}

function buildVisitRecordsByCastle(
  castleIds: readonly number[],
  items: readonly CastleCollectible[],
  castleById: Map<number, Castle>,
): VisitRecordGroup[] {
  return castleIds
    .map((castleId) => {
      const castle = castleById.get(castleId);
      if (!castle) {
        return null;
      }

      const visitItems = items
        .filter((item) => item.castleId === castleId && item.kind === 'visit-record')
        .sort((left, right) => right.createdAt - left.createdAt);

      if (visitItems.length === 0) {
        return null;
      }

      return { castle, items: visitItems };
    })
    .filter((entry): entry is VisitRecordGroup => entry != null);
}

function CollectibleThumbnailGrid({
  items,
  thumbnailSize,
  onOpen,
  onGalleryLayout,
}: {
  items: readonly CastleCollectible[];
  thumbnailSize: number;
  onOpen: (item: CastleCollectible, galleryItems: readonly CastleCollectible[]) => void;
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
  const { t } = useI18n();
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
  const [items, setItems] = useState<CastleCollectible[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerItems, setViewerItems] = useState<CastleCollectible[]>([]);

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
    setItems(listCollectiblesForCastleIds(group.castleIds));
    setLoading(false);
  }, [group.castleIds, group.id]);

  const groupCastles = useMemo(
    () =>
      group.castleIds
        .map((id) => castleById.get(id))
        .filter((castle): castle is Castle => castle != null),
    [castleById, group.castleIds],
  );

  const castlesBySeries = useMemo(() => {
    const original: Castle[] = [];
    const continued: Castle[] = [];

    for (const castleId of group.castleIds) {
      const castle = castleById.get(castleId);
      if (!castle) {
        continue;
      }

      if (castle.series === 'original') {
        original.push(castle);
      } else {
        continued.push(castle);
      }
    }

    return { original, continued };
  }, [castleById, group.castleIds]);

  const collectiblesByKind = useMemo(
    () => buildCollectiblesByKind(group.castleIds, items),
    [group.castleIds, items],
  );

  const visitRecordsByCastle = useMemo(
    () => buildVisitRecordsByCastle(group.castleIds, items, castleById),
    [castleById, group.castleIds, items],
  );

  const openViewer = (
    item: CastleCollectible,
    galleryItems: readonly CastleCollectible[],
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
      {groupCastles.length > 0 ? (
        <View style={styles.castleNamesSection}>
          {castlesBySeries.original.length > 0 ? (
            <View style={styles.castleNamesGroup}>
              <Text style={styles.castleNamesLabel}>{t('stats.rowOriginal')}</Text>
              <Text style={styles.castleNamesInline}>
                {castlesBySeries.original.map((castle) => castle.name).join('，')}
              </Text>
            </View>
          ) : null}
          {castlesBySeries.continued.length > 0 ? (
            <View style={styles.castleNamesGroup}>
              <Text style={styles.castleNamesLabel}>{t('stats.rowContinued')}</Text>
              <Text style={styles.castleNamesInline}>
                {castlesBySeries.continued.map((castle) => castle.name).join('，')}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.emptyText}>{t('group.showNoCastles')}</Text>
      )}

      {loading ? (
        <ActivityIndicator size="small" color={colors.original} style={styles.loader} />
      ) : (
        <>
          {visitRecordsByCastle.length > 0 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t('group.visitRecordTitle')}</Text>
              {visitRecordsByCastle.map(({ castle, items: visitItems }) => (
                <View key={castle.id} style={styles.visitCastleSection}>
                  <Text style={styles.visitCastleName}>{castle.name}</Text>
                  <CollectibleThumbnailGrid
                    items={visitItems}
                    thumbnailSize={thumbnailSize}
                    onOpen={openViewer}
                    onGalleryLayout={handleGalleryLayout}
                  />
                </View>
              ))}
            </View>
          ) : null}

          {MEDIA_COLLECTIBLE_KINDS.map((kind) => {
            const kindItems = collectiblesByKind.get(kind);
            if (!kindItems || kindItems.length === 0) {
              return null;
            }

            return (
              <View key={kind} style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>{getKindLabel(kind, t)}</Text>
                <CollectibleThumbnailGrid
                  items={kindItems}
                  thumbnailSize={thumbnailSize}
                  onOpen={openViewer}
                  onGalleryLayout={handleGalleryLayout}
                />
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
  visitCastleSection: {
    gap: 8,
  },
  visitCastleName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  castleNamesSection: {
    gap: 10,
  },
  castleNamesGroup: {
    gap: 4,
  },
  castleNamesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  castleNamesInline: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
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
