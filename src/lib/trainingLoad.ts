import type { ActivitySummary } from './types';

export type TrainingLoad = {
  acute: number; // km over last 7 days
  chronic: number; // km over last 28 days / 4
  ratio: number; // acute / chronic
  status: 'fresh' | 'optimal' | 'high' | 'overreaching';
};

export function trainingLoad(activities: ActivitySummary[], now: number): TrainingLoad {
  const dayMs = 86400000;
  const sevenDaysAgo = now - 7 * dayMs;
  const twentyEightDaysAgo = now - 28 * dayMs;

  const acuteM = activities
    .filter((activity) => activity.startedAt >= sevenDaysAgo)
    .reduce((sum, activity) => sum + activity.distanceM, 0);
  const chronicM = activities
    .filter((activity) => activity.startedAt >= twentyEightDaysAgo)
    .reduce((sum, activity) => sum + activity.distanceM, 0);

  const acute = acuteM / 1000;
  const chronic = chronicM / 1000 / 4;
  const ratio = chronic > 0 ? acute / chronic : acute > 0 ? 2 : 1;

  let status: TrainingLoad['status'] = 'optimal';
  if (ratio < 0.8) status = 'fresh';
  else if (ratio > 1.3) status = 'overreaching';
  else if (ratio > 1.1) status = 'high';

  return { acute, chronic, ratio, status };
}

export function trainingLoadLabel(status: TrainingLoad['status']): string {
  switch (status) {
    case 'fresh':
      return 'Nghỉ nhiều';
    case 'optimal':
      return 'Tối ưu';
    case 'high':
      return 'Tải cao';
    case 'overreaching':
      return 'Quá tải';
  }
}