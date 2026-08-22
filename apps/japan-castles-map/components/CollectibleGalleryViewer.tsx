import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../constants/theme';
import { useI18n } from '../i18n';
import type { CastleCollectible } from '../types/castleCollectible';
import { isImageCollectible } from '../utils/castleCollectibleStorage';
import { getCollectibleDisplayUri } from '../utils/castleCollectibleStorage';

type CollectibleGalleryViewerProps = {
  items: CastleCollectible[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
};

type GestureAxis = 'none' | 'x' | 'y';

const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 0.6;
const PAGE_SWIPE_DISTANCE = 50;
const AXIS_LOCK_THRESHOLD = 8;

export function CollectibleGalleryViewer({
  items,
  initialIndex,
  visible,
  onClose,
}: CollectibleGalleryViewerProps) {
  const { t } = useI18n();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const gestureAxis = useRef<GestureAxis>('none');
  const translateY = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(1)).current;
  const contentHeight = height - insets.top - insets.bottom;
  const currentItem = items[currentIndex];

  const resetAnimation = useCallback(() => {
    translateY.setValue(0);
    backdropOpacity.setValue(1);
    gestureAxis.current = 'none';
  }, [backdropOpacity, translateY]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    resetAnimation();
    setCurrentIndex(initialIndex);
  }, [initialIndex, resetAnimation, visible]);

  const dismissViewer = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: height,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      resetAnimation();
    });
  }, [backdropOpacity, height, onClose, resetAnimation, translateY]);

  const snapBack = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }),
      Animated.spring(backdropOpacity, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 0,
      }),
    ]).start();
  }, [backdropOpacity, translateY]);

  const onGestureEvent = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      const { translationX, translationY } = event.nativeEvent;

      if (gestureAxis.current === 'none') {
        if (Math.abs(translationX) < AXIS_LOCK_THRESHOLD && Math.abs(translationY) < AXIS_LOCK_THRESHOLD) {
          return;
        }
        gestureAxis.current = Math.abs(translationY) >= Math.abs(translationX) ? 'y' : 'x';
      }

      if (gestureAxis.current === 'y' && translationY > 0) {
        translateY.setValue(translationY);
        backdropOpacity.setValue(Math.max(0.35, 1 - translationY / (height * 0.75)));
      }
    },
    [backdropOpacity, height, translateY],
  );

  const onHandlerStateChange = useCallback(
    (event: PanGestureHandlerStateChangeEvent) => {
      const { state, translationX, translationY, velocityY } = event.nativeEvent;

      if (state === State.BEGAN) {
        gestureAxis.current = 'none';
        return;
      }

      if (state !== State.END && state !== State.CANCELLED && state !== State.FAILED) {
        return;
      }

      if (gestureAxis.current === 'y') {
        if (translationY > DISMISS_DISTANCE || velocityY > DISMISS_VELOCITY) {
          dismissViewer();
        } else {
          snapBack();
        }
      } else if (gestureAxis.current === 'x' && items.length > 1) {
        if (translationX <= -PAGE_SWIPE_DISTANCE && currentIndex < items.length - 1) {
          setCurrentIndex(currentIndex + 1);
        } else if (translationX >= PAGE_SWIPE_DISTANCE && currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
        }
        snapBack();
      } else {
        snapBack();
      }

      gestureAxis.current = 'none';
    },
    [currentIndex, dismissViewer, items.length, snapBack],
  );

  const openPdf = async (uri: string) => {
    const canOpen = await Linking.canOpenURL(uri);
    if (canOpen) {
      await Linking.openURL(uri);
    }
  };

  if (!visible || items.length === 0 || !currentItem) {
    return null;
  }

  const isImage = isImageCollectible(currentItem);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <Animated.View
          style={[styles.container, { opacity: backdropOpacity, transform: [{ translateY }] }]}
        >
          <View pointerEvents="none" style={[styles.page, { height: contentHeight }]}>
            {isImage ? (
              <Image
                key={`${currentItem.id}-${currentItem.createdAt}`}
                source={{ uri: getCollectibleDisplayUri(currentItem) }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.pdfPage}>
                <Text style={styles.pdfTitle}>PDF</Text>
                <Text style={styles.pdfFilename}>{currentItem.filename}</Text>
              </View>
            )}
          </View>

          <PanGestureHandler
            minDist={AXIS_LOCK_THRESHOLD}
            onGestureEvent={onGestureEvent}
            onHandlerStateChange={onHandlerStateChange}
          >
            <View style={styles.gestureLayer}>
              {!isImage ? (
                <View pointerEvents="box-none" style={styles.pdfInteractive}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void openPdf(currentItem.uri)}
                    style={styles.openPdfButton}
                  >
                    <Text style={styles.openPdfLabel}>{t('castle.collectibleOpenPdf')}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </PanGestureHandler>

          <View
            pointerEvents="box-none"
            style={[styles.topBarOverlay, { paddingTop: insets.top + 8, paddingBottom: 12 }]}
          >
            <View pointerEvents="auto" style={styles.topBar}>
              <Text style={styles.counter}>
                {t('castle.collectibleViewerCounter', {
                  current: currentIndex + 1,
                  total: items.length,
                })}
              </Text>
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={onClose}
                style={styles.closeButton}
              >
                <Text style={styles.closeLabel}>{t('common.close')}</Text>
              </Pressable>
            </View>
          </View>

          <View
            pointerEvents="none"
            style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}
          >
            <Text style={styles.swipeHint}>
              {items.length > 1
                ? t('castle.collectibleViewerSwipeHint')
                : t('castle.collectibleViewerDismissHint')}
            </Text>
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
  },
  gestureLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
    elevation: 5,
  },
  topBarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  counter: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.surface,
  },
  closeButton: {
    minHeight: 40,
    minWidth: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  closeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surface,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  pdfPage: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  pdfInteractive: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.surface,
  },
  pdfFilename: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
  },
  openPdfButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.original,
  },
  openPdfLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.surface,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    elevation: 10,
  },
  swipeHint: {
    textAlign: 'center',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.65)',
  },
});
