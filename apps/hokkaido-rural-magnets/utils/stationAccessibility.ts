import type { Station } from '../types/station';
import type { StationProgress, StationProgressField } from '../types/stationProgress';
import { getStationListSecondaryLine } from './stationName';

const PROGRESS_FIELDS: StationProgressField[] = ['visited', 'magnet', 'magnetNotSold'];

export type StationProgressLabels = {
  visited: string;
  magnet: string;
  magnetNotSold: string;
  none: string;
};

export function getStationProgressSummary(
  progress: StationProgress | undefined,
  labels: StationProgressLabels,
): string {
  const checked = PROGRESS_FIELDS.filter((field) => progress?.[field]);

  if (checked.length === 0) {
    return labels.none;
  }

  const fieldLabels: Record<StationProgressField, string> = {
    visited: labels.visited,
    magnet: labels.magnet,
    magnetNotSold: labels.magnetNotSold,
  };

  return checked.map((field) => fieldLabels[field]).join('，');
}

export function buildStationListAccessibilityLabel(
  station: Station,
  progress: StationProgress | undefined,
  labels: StationProgressLabels,
): string {
  const secondary = getStationListSecondaryLine(station);
  const progressSummary = getStationProgressSummary(progress, labels);
  const parts = [station.name];

  if (secondary) {
    parts.push(secondary);
  }

  parts.push(progressSummary);
  return parts.join('，');
}
