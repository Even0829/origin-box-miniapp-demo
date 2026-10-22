// Shared display rules for confirmed device readings; control targets are separate.
export function formatDeviceReading(reading) {
  if (typeof reading.value === 'number' && Number.isFinite(reading.value)) return `${Number(reading.value.toFixed(1))}${reading.unit || ''}`;
  if (reading.key === 'presence' && typeof reading.value === 'boolean') return reading.value ? '检测到人在场' : '暂未检测到人在场';
  const unknown = value => ['unknown', 'unavailable', 'nan', 'infinity', '-infinity'].includes(String(value).toLowerCase());
  if (reading.value == null || typeof reading.value === 'number' || unknown(reading.value)) return '等待更新';
  const text = String(reading.text || reading.value);
  return unknown(text) ? '等待更新' : text;
}
