export type PainArea = 'knee' | 'shin' | 'achilles' | 'foot' | 'hip' | 'back' | 'other';

export const PAIN_AREAS: { key: PainArea; label: string }[] = [
  { key: 'knee', label: 'Đầu gối' },
  { key: 'shin', label: 'Ống đồng' },
  { key: 'achilles', label: 'Gân Achilles' },
  { key: 'foot', label: 'Bàn chân' },
  { key: 'hip', label: 'Hông' },
  { key: 'back', label: 'Lưng' },
  { key: 'other', label: 'Khác' },
];

export type RecoveryLog = {
  id: string;
  /** Epoch ms of the day the pain was felt. */
  at: number;
  area: PainArea;
  /** 1 = hơi nhức … 5 = rất đau. */
  pain: number;
  note: string;
  createdAt: number;
};

export type RecoveryAdvice = {
  level: 'ok' | 'watch' | 'rest';
  title: string;
  body: string;
};

export function painAreaLabel(area: PainArea): string {
  return PAIN_AREAS.find((item) => item.key === area)?.label ?? 'Khác';
}

export function painLabel(pain: number): string {
  if (pain >= 5) return 'Rất đau';
  if (pain >= 4) return 'Đau';
  if (pain >= 3) return 'Nhức';
  if (pain >= 2) return 'Hơi nhức';
  return 'Rất nhẹ';
}

const DAY_MS = 86400000;

/** Suggests training volume from the last two weeks of pain reports. */
export function recoveryAdvice(logs: RecoveryLog[], now: number): RecoveryAdvice {
  const recent = logs.filter((log) => now - log.at <= 14 * DAY_MS);
  if (recent.length === 0) {
    return {
      level: 'ok',
      title: 'Không có dấu hiệu chấn thương',
      body: 'Ghi lại cảm giác đau sau mỗi buổi chạy để theo dõi sớm.',
    };
  }

  const worst = recent.reduce((max, log) => Math.max(max, log.pain), 0);
  const lastWeek = recent.filter((log) => now - log.at <= 7 * DAY_MS);
  const repeated = lastWeek.length >= 3;

  if (worst >= 4) {
    return {
      level: 'rest',
      title: 'Nên nghỉ và theo dõi',
      body: 'Cơn đau mức 4–5 kéo dài có thể là chấn thương. Nghỉ 2–3 ngày, chườm lạnh và gặp bác sĩ nếu không giảm.',
    };
  }

  if (worst >= 3 || repeated) {
    return {
      level: 'watch',
      title: 'Giảm khối lượng tuần này',
      body: 'Giảm 30–40% số km, bỏ buổi biến tốc, thêm 1 ngày nghỉ và giãn cơ sau chạy.',
    };
  }

  return {
    level: 'ok',
    title: 'Đang hồi phục tốt',
    body: 'Cảm giác đau nhẹ và không lặp lại. Tiếp tục tăng km từ từ, tối đa 10% mỗi tuần.',
  };
}

/** Days since the last logged run, or `null` when there is none. */
export function daysSinceLastRun(lastRunAt: number | null, now: number): number | null {
  if (!lastRunAt) return null;
  return Math.max(0, Math.floor((now - lastRunAt) / DAY_MS));
}
