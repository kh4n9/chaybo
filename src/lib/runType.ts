import type { RunType } from './types';

export type RunTypeMeta = {
  key: RunType;
  label: string;
  short: string;
};

export const RUN_TYPES: RunTypeMeta[] = [
  { key: 'easy', label: 'Nhẹ nhàng', short: 'Easy' },
  { key: 'tempo', label: 'Tempo', short: 'Tempo' },
  { key: 'long', label: 'Chạy dài', short: 'Long' },
  { key: 'race', label: 'Thi đấu', short: 'Race' },
  { key: 'recovery', label: 'Phục hồi', short: 'Recovery' },
  { key: 'interval', label: 'Interval', short: 'Interval' },
];

export function toRunType(value: unknown): RunType | null {
  if (typeof value !== 'string') return null;
  const match = RUN_TYPES.find((option) => option.key === value);
  return match ? match.key : null;
}

export function runTypeLabel(value: RunType | null | undefined): string {
  const meta = RUN_TYPES.find((option) => option.key === value);
  return meta ? meta.label : 'Chưa gán';
}

export function runTypeShort(value: RunType | null | undefined): string {
  const meta = RUN_TYPES.find((option) => option.key === value);
  return meta ? meta.short : '';
}