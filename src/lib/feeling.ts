import type { Feeling } from './types';

export type FeelingOption = {
  value: Feeling;
  emoji: string;
  label: string;
};

/** 1 (mệt) … 5 (tuyệt vời), same idea as Strava's "how did it feel?". */
export const FEELINGS: FeelingOption[] = [
  { value: 1, emoji: '😮‍💨', label: 'Mệt' },
  { value: 2, emoji: '😐', label: 'Bình thường' },
  { value: 3, emoji: '🙂', label: 'Ổn' },
  { value: 4, emoji: '😄', label: 'Tốt' },
  { value: 5, emoji: '🔥', label: 'Tuyệt vời' },
];

export function feelingEmoji(value: Feeling | null | undefined): string | null {
  if (!value) return null;
  return FEELINGS.find((f) => f.value === value)?.emoji ?? null;
}

export function feelingLabel(value: Feeling | null | undefined): string | null {
  if (!value) return null;
  return FEELINGS.find((f) => f.value === value)?.label ?? null;
}
