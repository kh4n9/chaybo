import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { Activity, TrackPoint } from './types';

export type ExportKind = 'gpx' | 'json' | 'tcx';

const FILE_META: Record<ExportKind, { ext: string; mimeType: string; uti: string }> = {
  gpx: { ext: 'gpx', mimeType: 'application/gpx+xml', uti: 'com.topografix.gpx' },
  json: { ext: 'json', mimeType: 'application/json', uti: 'public.json' },
  tcx: { ext: 'tcx', mimeType: 'application/vnd.garmin.tcx+xml', uti: 'com.garmin.tcx' },
};

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);
}

function isoTime(ms: number): string {
  return new Date(ms).toISOString();
}

function trackPointXml(point: TrackPoint): string {
  const ele =
    point.alt != null && Number.isFinite(point.alt) ? `<ele>${point.alt.toFixed(1)}</ele>` : '';
  return `        <trkpt lat="${point.lat.toFixed(7)}" lon="${point.lng.toFixed(7)}">${ele}<time>${isoTime(point.t)}</time></trkpt>`;
}

/**
 * GPX 1.1 with one `<trk>` per activity, so a whole history can live in a
 * single file that Strava, Garmin Connect and Google Earth all accept.
 */
export function buildGpx(activities: Activity[]): string {
  const tracks = activities
    .filter((activity) => activity.route.length > 1)
    .map((activity) => {
      const points = activity.route.map(trackPointXml).join('\n');
      return `  <trk>
    <name>${escapeXml(activity.title)}</name>
    <type>running</type>
    <trkseg>
${points}
    </trkseg>
  </trk>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="chaybo" xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
${tracks}
</gpx>
`;
}

/**
 * TCX 1.0 (Garmin) with one activity per file-friendly structure; multiple
 * activities are emitted as separate `<Activity>` blocks inside one training
 * center database.
 */
export function buildTcx(activities: Activity[]): string {
  const blocks = activities
    .filter((activity) => activity.route.length > 1)
    .map((activity) => {
      const laps = activity.splits.length > 0 ? activity.splits : [];
      const trackpoints = activity.route
        .map((point) => {
          return `          <Trackpoint>
            <Time>${new Date(point.t).toISOString()}</Time>
            <Position>
              <LatitudeDegrees>${point.lat.toFixed(7)}</LatitudeDegrees>
              <LongitudeDegrees>${point.lng.toFixed(7)}</LongitudeDegrees>
            </Position>
            ${point.alt != null ? `<AltitudeMeters>${point.alt.toFixed(1)}</AltitudeMeters>` : ''}
            <DistanceMeters>${0}</DistanceMeters>
          </Trackpoint>`;
        })
        .join('\n');

      const lapXml =
        laps.length > 0
          ? laps
              .map(
                (split) => `        <Lap StartTime="${new Date(activity.startedAt).toISOString()}">
          <TotalTimeSeconds>${split.durationS.toFixed(1)}</TotalTimeSeconds>
          <DistanceMeters>${split.distanceM.toFixed(1)}</DistanceMeters>
          <Intensity>Active</Intensity>
          <TriggerMethod>Manual</TriggerMethod>
          <Track>
${trackpoints}
          </Track>
        </Lap>`,
              )
              .join('\n')
          : `        <Lap StartTime="${new Date(activity.startedAt).toISOString()}">
          <TotalTimeSeconds>${activity.durationS.toFixed(1)}</TotalTimeSeconds>
          <DistanceMeters>${activity.distanceM.toFixed(1)}</DistanceMeters>
          <Intensity>Active</Intensity>
          <TriggerMethod>Manual</TriggerMethod>
          <Track>
${trackpoints}
          </Track>
        </Lap>`;

      return `    <Activity Sport="Running">
      <Id>${new Date(activity.startedAt).toISOString()}</Id>
      <Lap>
${lapXml}
      </Lap>
    </Activity>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
${blocks}
  </Activities>
</TrainingCenterDatabase>
`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** `2026-11-02` in local time, for filenames. */
export function fileStamp(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function exportFileName(prefix: string, kind: ExportKind, ms = Date.now()): string {
  return `${prefix}-${fileStamp(ms)}.${FILE_META[kind].ext}`;
}

/**
 * Writes `content` to a cache file and opens the iOS share sheet.
 * Throws `Error('sharing-unavailable')` when the platform cannot share files.
 */
export async function shareTextFile(
  fileName: string,
  content: string,
  kind: ExportKind,
): Promise<void> {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  await file.write(content);

  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('sharing-unavailable');

  await Sharing.shareAsync(file.uri, {
    mimeType: FILE_META[kind].mimeType,
    UTI: FILE_META[kind].uti,
    dialogTitle: 'Xuất dữ liệu chaybo',
  });
}
