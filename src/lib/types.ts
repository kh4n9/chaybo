export type TrackPoint = {
  lat: number;
  lng: number;
  /** Altitude in meters, null when the device didn't report it. */
  alt: number | null;
  /** Epoch milliseconds. */
  t: number;
};

export type Split = {
  /** 1-based kilometer index. The last split can be shorter than 1 km. */
  km: number;
  distanceM: number;
  durationS: number;
  paceSPerKm: number;
  elevGainM: number;
};

/** 1 (mệt) … 5 (tuyệt vời). `null` when the runner skipped the question. */
export type Feeling = 1 | 2 | 3 | 4 | 5;

/** Training intent of a run. `null` when the runner did not tag it. */
export type RunType = 'easy' | 'tempo' | 'long' | 'race' | 'recovery' | 'interval';

/** Row shape stored in SQLite. `route`, `preview` and `splits` are JSON strings. */
export type ActivityRow = {
  id: string;
  title: string;
  started_at: number;
  ended_at: number;
  duration_s: number;
  elapsed_s: number;
  distance_m: number;
  avg_pace_s: number | null;
  best_pace_s: number | null;
  elev_gain_m: number;
  calories: number;
  route: string;
  preview: string;
  splits: string;
  notes: string;
  feeling: number | null;
  run_type: string | null;
  weather: string | null;
  gear_id: string | null;
  favorite: number;
  photos: string;
  tags: string;
  cadence: number | null;
  avg_hr: number | null;
  treadmill: number;
  created_at: number;
};

export type ActivitySummary = {
  id: string;
  title: string;
  startedAt: number;
  durationS: number;
  distanceM: number;
  avgPaceS: number | null;
  elevGainM: number;
  feeling: Feeling | null;
  runType: RunType | null;
  /** Kept on the summary so the history search can match notes too. */
  notes: string;
  /** Tags for filtering and search. */
  tags: string;
  /** Heavily downsampled route, cheap to draw in lists. */
  preview: TrackPoint[];
};

export type Activity = ActivitySummary & {
  endedAt: number;
  elapsedS: number;
  bestPaceS: number | null;
  calories: number;
  notes: string;
  weather: string | null;
  gearId: string | null;
  favorite: boolean;
  photos: string[];
  tags: string;
  cadence: number | null;
  avgHr: number | null;
  treadmill: boolean;
  route: TrackPoint[];
  splits: Split[];
};
