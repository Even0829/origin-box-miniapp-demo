import {grandpa, grandma} from './elder-care-demo.js';
import {previewNow} from './preview-clock.js';

export const RADAR_IMAGE = 'assets/device-radar-product.png';

export const ADDITIONAL_DEVICE_SOURCES = {
  'second-sleep-belt': '涂鸦',
  'second-blood-pressure': '米家',
  'second-blood-glucose': '涂鸦',
  'second-pillbox': '涂鸦',
  'grandma-health-band': '米家',
  'bathroom-body-scale': '米家',
  'second-heater': '涂鸦',
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const dayStart = (stamp) => Math.floor((stamp + 8 * HOUR) / DAY) * DAY - 8 * HOUR;

function reading(key, label, value, unit, updatedAt) {
  return { key, label, value, unit, text: `${value}${unit}`, updatedAt };
}

export function nextMedicationReminder(reminder, now = previewNow()) {
  if (!reminder.enabled) return '';
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const times = Object.values(reminder.times).sort();
  const next = times.find((entry) => entry > time);
  return next ? `今天 ${next}` : `明天 ${times[0]}`;
}

export function createAdditionalDevices(stamp, elderExamples = false) {
  const device = { online: true, pending: null, readings: [], inputCapabilities: [], responseCapabilities: [] };
  const personal = { ...device, permissions: { read: true, control: false } };
  const morning = dayStart(stamp) + 7 * HOUR;
  const wakeAt = morning > stamp ? morning - DAY : morning;
  const sleepStart = wakeAt - 8.25 * HOUR;
  const sleepSegments = [
    { state: '清醒', minutes: 15 }, { state: '睡眠', minutes: 235 },
    { state: '清醒', minutes: 20 }, { state: '睡眠', minutes: 225 },
  ];
  const measurement = ({ subject, fields, entries, ...props }) => {
    const measurements = entries.map(({ at, values, context }) => ({
      id: `${props.id}-${at}`, at, context,
      ...(props.id === 'second-blood-glucose' ? {subjectId: subject.id, receivedAt: at + 60000} : {}),
      readings: fields.map(([key, label, unit], index) => reading(key, label, values[index], unit, at)),
    }));
    return { ...personal, ...props, readings: measurements[0].readings, inputCapabilities: fields.map(([, label]) => label), health: { kind: 'measurement', subject, measurements,
      ...(elderExamples && props.id === 'second-blood-glucose' ? { morningCheck: { measurementId: measurements[0].id, dueAt: wakeAt + HOUR / 2 } } : {}) } };
  };
  const bandAt = stamp - 4 * 60 * 1000;
  const bandSeries = [
    ['heartRate', '心率', '次/分', [69, 64, 62, 77, 80, 73, 72]],
    ['respiration', '呼吸频率', '次/分', [16, 15, 15, 17, 16, 17, 16]],
    ['oxygen', '血氧饱和度', '%', [97, 96, 97, 98, 97, 98, 98]],
    ['stress', '压力指数', '/100', [28, 22, 21, 40, 45, 37, 34]],
  ];
  const bandReadings = bandSeries.map(([key, label, unit, values]) => reading(key, label, values.at(-1), unit, bandAt));
  const trends = Object.fromEntries(bandSeries.map(([key, , , values]) => [key, values.map((value, index) => ({ at: bandAt - (values.length - 1 - index) * 4 * HOUR, value }))]));
  const pillPlan = [{ id: 'morning', label: '早间用药', time: '08:00' }, { id: 'evening', label: '晚间用药', time: '20:00' }];
  const yesterday = dayStart(stamp) - DAY;

  return [
    { ...personal, id: 'second-sleep-belt', roomId: 'second', name: '睡眠带', type: 'health', image: 'assets/device-sleep-belt.png',
      inputCapabilities: ['睡眠状态', '在床／离床', '呼吸频率', '心率'],
      readings: [reading('sleepDuration', '睡眠时长', '7小时40分', '', wakeAt), reading('respiration', '平均呼吸频率', 15, '次/分', wakeAt), reading('heartRate', '平均心率', 62, '次/分', wakeAt)],
      health: { kind: 'sleep', subject: grandpa, session: { id: `sleep-${wakeAt}`, start: sleepStart, end: wakeAt, segments: sleepSegments } } },
    measurement({ subject: grandpa, id: 'second-blood-pressure', roomId: 'second', name: '血压仪', type: 'health', image: 'assets/device-blood-pressure.png',
      fields: [['systolic', '收缩压', 'mmHg'], ['diastolic', '舒张压', 'mmHg'], ['pulse', '脉搏', '次/分']],
      entries: [
        { at: wakeAt + Math.min(stamp - wakeAt, 0.5 * HOUR), values: [126, 78, 68] },
        { at: wakeAt - 11 * HOUR, values: [129, 80, 71] }, { at: wakeAt - DAY + 0.5 * HOUR, values: [124, 77, 66] },
      ] }),
    measurement({ subject: grandma, id: 'second-blood-glucose', roomId: 'second', name: '血糖仪', type: 'health', image: 'assets/device-blood-glucose.png',
      fields: [['glucose', '血糖', 'mmol/L']], entries: [
        { at: wakeAt, values: [5.8], context: '空腹' }, { at: wakeAt - 9 * HOUR, values: [7.2], context: '餐后2小时' },
        { at: wakeAt - DAY, values: [6.1], context: '空腹' },
      ] }),
    { ...personal, id: 'second-pillbox', roomId: 'second', name: '智能药盒', type: 'health', image: 'assets/device-pillbox.png',
      health: { kind: 'medication', subject: grandpa, plan: pillPlan,
        reminder: { enabled: true, times: Object.fromEntries(pillPlan.map(({ id, time }) => [id, time])) },
        records: [
          { id: 'pill-evening-open', doseId: 'yesterday-evening', kind: 'opened', at: yesterday + 20 * HOUR + 7 * 60 * 1000, title: '晚间用药 · 已开盒', source: '药盒' },
          ...(elderExamples ? [{ id: 'pill-evening-reminder', doseId: 'yesterday-evening', kind: 'reminder', at: yesterday + 20 * HOUR, title: '晚间用药 · 药盒已提醒', source: '药盒' }] : []),
          { id: 'pill-morning-confirm', doseId: 'yesterday-morning', kind: 'confirmed', at: yesterday + 8 * HOUR + 5 * 60 * 1000, title: '早间用药 · 本人确认已服用', source: '爷爷确认' },
        ] } },
    { ...personal, id: 'grandma-health-band', roomId: null, name: '智能手环', type: 'health', image: 'assets/device-health-band.png',
      inputCapabilities: ['心率', '呼吸频率', '血氧', '血压估测', '睡眠', '压力'],
      readings: [...bandReadings, reading('estimatedPressure', '血压估测', '122/76', ' mmHg', bandAt - HOUR), reading('sleepDuration', '最近一晚睡眠', '7小时12分', '', wakeAt)],
      health: { kind: 'wearable', subject: grandma, trends } },
    measurement({ subject: grandma, id: 'bathroom-body-scale', roomId: 'bathroom', name: '智能体脂秤', type: 'health', image: 'assets/device-body-scale.png',
      fields: [['weight', '体重', 'kg'], ['bodyFat', '体脂率', '%']], entries: [
        { at: wakeAt, values: [58.4, 29.2] }, { at: wakeAt - DAY, values: [58.6, 29.4] }, { at: wakeAt - 3 * DAY, values: [58.5, 29.3] },
      ] }),
    { ...device, id: 'second-heater', roomId: 'second', name: '暖风机', type: 'heater', image: 'assets/device-heater.png', permissions: { read: true, control: true },
      power: false, mode: '暖风', modeOptions: ['自然风', '暖风', '热风'], temperatureModes: ['暖风', '热风'],
      targetTemperature: 24, targetTemperatureMin: 22, targetTemperatureMax: 28, targetTemperatureStep: 1,
      oscillation: false, oscillationAngle: 70, responseCapabilities: ['暖风', '温度调节', '摆头'] },
  ].map((entry) => ({ ...entry, source: ADDITIONAL_DEVICE_SOURCES[entry.id] }));
}
