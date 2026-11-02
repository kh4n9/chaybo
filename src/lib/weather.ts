/** Lightweight weather snapshot using Open-Meteo (no API key). */

export type WeatherSnapshot = {
  tempC: number;
  code: number;
  label: string;
};

const CODE_LABELS: Record<number, string> = {
  0: 'Trời quang',
  1: 'Chủ yếu quang',
  2: 'Mây rải rác',
  3: 'Nhiều mây',
  45: 'Sương mù',
  48: 'Sương mù đóng băng',
  51: 'Mưa phùn nhẹ',
  53: 'Mưa phùn',
  55: 'Mưa phùn dày',
  61: 'Mưa nhẹ',
  63: 'Mưa vừa',
  65: 'Mưa to',
  71: 'Tuyết nhẹ',
  73: 'Tuyết vừa',
  75: 'Tuyết to',
  80: 'Mưa rào nhẹ',
  81: 'Mưa rào',
  82: 'Mưa rào to',
  95: 'Dông',
};

export async function fetchWeather(lat: number, lng: number): Promise<WeatherSnapshot | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    const temp = data.current?.temperature_2m;
    const code = data.current?.weather_code;
    if (typeof temp !== 'number' || typeof code !== 'number') return null;
    return { tempC: Math.round(temp), code, label: CODE_LABELS[code] ?? 'Thời tiết' };
  } catch {
    return null;
  }
}

export function formatWeather(snapshot: WeatherSnapshot | null): string | null {
  if (!snapshot) return null;
  return `${snapshot.tempC}°C · ${snapshot.label}`;
}