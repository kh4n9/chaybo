export type IntervalPhaseKind = 'warmup' | 'work' | 'rest' | 'cooldown';

export type IntervalStep = {
  kind: IntervalPhaseKind;
  durationS: number;
  label: string;
};

export type IntervalWorkout = {
  name: string;
  steps: IntervalStep[];
};

export type IntervalPreset = {
  key: string;
  name: string;
  hint: string;
  build: () => IntervalWorkout;
};

export const INTERVAL_PRESETS: IntervalPreset[] = [
  {
    key: '400',
    name: '6 × 400 m',
    hint: 'Nhanh 90 giây · nghỉ 90 giây',
    build: () => buildIntervals(6, 90, 90, 300, 300, '6 × 400 m'),
  },
  {
    key: '800',
    name: '5 × 800 m',
    hint: 'Nhanh 3 phút · nghỉ 2 phút',
    build: () => buildIntervals(5, 180, 120, 300, 300, '5 × 800 m'),
  },
  {
    key: '1k',
    name: '4 × 1 km',
    hint: 'Nhanh 4 phút · nghỉ 2 phút',
    build: () => buildIntervals(4, 240, 120, 360, 300, '4 × 1 km'),
  },
  {
    key: 'pyramid',
    name: 'Kim tự tháp',
    hint: '1–2–3–2–1 phút',
    build: () => buildPyramid(),
  },
  {
    key: 'fartlek',
    name: 'Fartlek 20 phút',
    hint: 'Nhanh/chậm luân phiên',
    build: () => buildFartlek(),
  },
];

/** Warmup + reps × (work + rest) + cooldown. */
export function buildIntervals(
  reps: number,
  workS: number,
  restS: number,
  warmupS = 300,
  cooldownS = 300,
  name = 'Biến tốc',
): IntervalWorkout {
  const steps: IntervalStep[] = [];
  if (warmupS > 0) steps.push({ kind: 'warmup', durationS: warmupS, label: 'Khởi động' });

  const safeReps = Math.max(1, Math.round(reps));
  for (let i = 1; i <= safeReps; i++) {
    steps.push({ kind: 'work', durationS: Math.max(10, workS), label: `Nhanh ${i}/${safeReps}` });
    if (i < safeReps && restS > 0) {
      steps.push({ kind: 'rest', durationS: restS, label: `Nghỉ ${i}/${safeReps}` });
    }
  }

  if (cooldownS > 0) steps.push({ kind: 'cooldown', durationS: cooldownS, label: 'Thả lỏng' });
  return { name, steps };
}

function buildPyramid(): IntervalWorkout {
  const minutes = [1, 2, 3, 2, 1];
  const steps: IntervalStep[] = [
    { kind: 'warmup', durationS: 300, label: 'Khởi động' },
  ];
  minutes.forEach((minute, index) => {
    steps.push({ kind: 'work', durationS: minute * 60, label: `Nhanh ${minute} phút` });
    if (index < minutes.length - 1) {
      steps.push({ kind: 'rest', durationS: 60, label: 'Nghỉ 1 phút' });
    }
  });
  steps.push({ kind: 'cooldown', durationS: 300, label: 'Thả lỏng' });
  return { name: 'Kim tự tháp', steps };
}

function buildFartlek(): IntervalWorkout {
  const steps: IntervalStep[] = [
    { kind: 'warmup', durationS: 300, label: 'Khởi động' },
  ];
  for (let i = 1; i <= 5; i++) {
    steps.push({ kind: 'work', durationS: 120, label: `Nhanh ${i}/5` });
    steps.push({ kind: 'rest', durationS: 120, label: `Chậm ${i}/5` });
  }
  steps.push({ kind: 'cooldown', durationS: 300, label: 'Thả lỏng' });
  return { name: 'Fartlek 20 phút', steps };
}

export function totalDurationS(steps: IntervalStep[]): number {
  return steps.reduce((sum, step) => sum + step.durationS, 0);
}

export function stepStartS(steps: IntervalStep[], index: number): number {
  let total = 0;
  for (let i = 0; i < index && i < steps.length; i++) total += steps[i].durationS;
  return total;
}

export type IntervalPhase = {
  index: number;
  step: IntervalStep;
  elapsedS: number;
  remainingS: number;
  done: boolean;
};

/** Current phase for a workout clock measured in whole seconds. */
export function phaseAt(steps: IntervalStep[], elapsedS: number): IntervalPhase | null {
  if (steps.length === 0) return null;

  let cursor = 0;
  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    const end = cursor + step.durationS;
    if (elapsedS < end) {
      return {
        index,
        step,
        elapsedS: elapsedS - cursor,
        remainingS: end - elapsedS,
        done: false,
      };
    }
    cursor = end;
  }

  const last = steps[steps.length - 1];
  return {
    index: steps.length - 1,
    step: last,
    elapsedS: last.durationS,
    remainingS: 0,
    done: true,
  };
}

export function phaseColorKind(kind: IntervalPhaseKind): 'accent' | 'danger' | 'dim' {
  if (kind === 'work') return 'accent';
  if (kind === 'rest') return 'danger';
  return 'dim';
}
