const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const startedAt = Date.now();
const observations = {
  living: { count: 2, activity: '看电视', people: [{ id: 'person-mom', methods: ['face', 'voice'], activity: '看电视', posture: '坐姿' }, { id: 'person-yu', methods: ['voice'], activity: '看电视', posture: '坐姿' }], devices: ['living-radar', 'living-camera'], postureDevices: ['living-radar'], activityDevices: ['living-camera'], age: 18000 },
  master: { count: 1, devices: ['master-presence'], postureDevices: ['master-presence'], age: 35000 },
  second: { count: 1, activity: '阅读', devices: ['second-camera'], activityDevices: ['second-camera'], age: 24000 },
  bathroom: { count: null, devices: ['bathroom-presence'], airAvailable: false, age: 12 * 60000 },
  kitchen: { count: 0, devices: ['kitchen-presence'], age: 16000 },
  dining: { count: 1, activity: '用餐', devices: ['dining-camera'], activityDevices: ['dining-camera'], age: 29000 },
};
const methodNames = { face: '人脸', voice: '声纹' };
export const spaceTime = stamp => Number.isFinite(stamp) ? new Date(stamp).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }) : '暂无时间';

// Device evidence answers presence, posture and behavior; face/voice only identify the person.
function groupDeviceEvidence(evidence) {
  const groups = new Map();
  for (const source of evidence) {
    if (!groups.has(source.id)) groups.set(source.id, { id: source.id, name: source.name, roles: [], available: false, at: source.at });
    const group = groups.get(source.id);
    if (!group.roles.some(role => role.name === source.role)) group.roles.push({ name: source.role, available: source.available });
    group.available ||= source.available;
  }
  return [...groups.values()];
}

export function deriveSpaceState(room, devices = [], profiles = []) {
  const mock = observations[room.id];
  const related = devices.filter(device => device.roomId === room.id);
  const readable = device => device.online && device.permissions?.read !== false;
  const evidence = (ids, role, key) => (ids || []).flatMap(id => {
    const device = related.find(device => device.id === id);
    if (!device) return [];
    const reading = device.readings?.find(reading => reading.key === key);
    const validValue = key === 'presence' ? typeof reading?.value === 'boolean' : typeof reading?.value === 'string' && reading.value.length > 0 && reading.value !== 'unknown';
    const capability = key === 'presence' ? '在场' : key === 'posture' ? '姿态' : '行为活动';
    return [{ id, name: device.name, role, value: reading?.value, available: readable(device) && device.inputCapabilities?.includes(capability) && Boolean(validValue), at: reading?.updatedAt || device.updatedAt || null }];
  });
  const presenceEvidence = evidence(mock?.devices, '在场', 'presence');
  const postureEvidence = evidence(mock?.postureDevices, '姿态', 'posture');
  const behaviorEvidence = evidence(mock?.activityDevices, '行为', 'behavior');
  const livePresence = presenceEvidence.filter(source => source.available);
  const livePosture = postureEvidence.find(source => source.available);
  const liveBehavior = behaviorEvidence.find(source => source.available);
  const presenceMissing = !room.observed || !mock || livePresence.length === 0;
  const presenceTimes = presenceEvidence.map(source => source.at).filter(Number.isFinite);
  const presenceAt = presenceTimes.length ? Math.min(...presenceTimes) : null;
  const identityAt = mock ? startedAt - mock.age : null;
  const explicitlyEmpty = livePresence.length > 0 && livePresence.every(source => source.value === false);
  const count = presenceMissing ? null : explicitlyEmpty ? 0 : mock.count;
  const presenceLabel = count === null ? room.source === '手动创建' ? '在场感知待接入' : '在场状态待更新' : count === 0 ? '未检测到人' : `${count}人在场`;
  const posture = !presenceMissing && count > 0 ? livePosture?.value || '' : '';
  const postureDevice = livePosture && related.find(device => device.id === livePosture.id);
  const motion = posture ? postureDevice?.readings?.find(reading => reading.key === 'motion')?.value || '' : '';
  const behavior = !presenceMissing && count > 0 ? liveBehavior?.value || '' : '';
  const activityMissing = presenceMissing || (count > 0 && !posture && !behavior);
  const activity = presenceMissing ? '活动待更新' : count === 0 ? '暂无活动证据' : behavior || posture || '活动待更新';
  const sources = groupDeviceEvidence([...presenceEvidence, ...postureEvidence, ...behaviorEvidence]);
  const people = presenceMissing ? [] : (mock.people || []).flatMap(match => {
    const profile = profiles.find(profile => profile.id === match.id && profile.enabled);
    if (!profile) return [];
    const faceDevice = related.find(device => device.id === 'living-camera');
    const methods = match.methods.filter(method => profile.sources?.includes(method) && (method !== 'face' || Boolean(faceDevice && readable(faceDevice))));
    if (!methods.length) return [];
    const personPosture = posture === match.posture ? posture : '';
    const personBehavior = behavior === match.activity ? behavior : '';
    return [{ id: profile.id, name: profile.name, photo: profile.photo, methods, at: identityAt,
      activity: personBehavior || personPosture || '活动待更新', behavior: personBehavior, posture: personPosture,
      motion: personPosture ? motion : '', sources,
      behaviorMissing: !personBehavior, postureMissing: !personPosture }];
  }).slice(0, count || 0);
  const unidentified = Math.max(0, (count || 0) - people.length);
  const environment = related.filter(device => device.type === 'environment');
  const source = environment.find(readable);
  const lastSource = source || environment[0];
  const read = key => source?.readings?.find(reading => reading.key === key && Number.isFinite(reading.value));
  const temperature = read('temperature'), humidity = read('humidity');
  const environmentMissing = !source;
  const environmentAt = source ? Math.min(...[temperature?.updatedAt, humidity?.updatedAt].filter(Number.isFinite)) : null;
  const lastReadingTimes = lastSource?.readings?.filter(reading => ['temperature', 'humidity'].includes(reading.key)).map(reading => reading.updatedAt).filter(Number.isFinite) || [];
  const lastEnvironmentAt = lastReadingTimes.length ? Math.min(...lastReadingTimes) : lastSource?.updatedAt || null;
  // Independent Mock air information is not a temperature/humidity sensor capability.
  const airMissing = !room.observed || !mock || mock.airAvailable === false || !room.airQuality;
  return {
    primary: presenceLabel, presenceLabel, count, people, unidentified, presenceMissing, sources, presenceAt,
    presenceSource: presenceEvidence.map(source => `${source.name}${source.available ? '' : '（待更新）'}`).join('、') || '等待感知接入',
    activity, activityMissing, behavior, posture, motion,
    activityDescription: activityMissing ? '等待有效的活动设备依据' : count === 0 ? '未检测到人在场，暂无活动证据' : [behavior, posture, motion].filter(Boolean).join(' · '),
    activityAt: liveBehavior?.at || livePosture?.at || null,
    temperature: temperature?.value, humidity: humidity?.value,
    values: [temperature ? `${temperature.value}℃` : '温度待更新', humidity ? `${humidity.value}%` : '湿度待更新'].join(' · '),
    environmentMissing, environmentAt: Number.isFinite(environmentAt) ? environmentAt : null,
    environmentSource: source?.name || (lastSource ? `${lastSource.name} · 待更新` : '环境来源待接入'),
    lastEnvironmentAt, lastReadings: !source ? lastSource?.readings?.map(reading => reading.text).filter(Boolean).join(' · ') : '',
    airText: airMissing ? '空气状态待更新' : `空气${room.airQuality}`, airMissing, airAt: airMissing ? null : identityAt,
    missing: Boolean(presenceMissing || environmentMissing || !temperature || !humidity || airMissing),
  };
}

function avatar(person, className = '') {
  return `<span class="ss-avatar ${className}" aria-hidden="true">${person.photo ? `<img src="${esc(person.photo)}" alt="">` : esc([...person.name][0])}</span>`;
}

export function spaceCardContent(state) {
  const identities = state.people.slice(0, 2).map(person => `<span class="hc-person">${avatar(person)}<span class="hc-person-name">${esc(person.name)}</span><i class="hc-person-separator" aria-hidden="true"></i><span class="hc-person-activity">${esc(person.activity || '活动待确认')}</span></span>`).join('');
  const remaining = state.unidentified + Math.max(0, state.people.length - 2);
  const unknown = remaining ? `<span class="hc-unidentified">${state.people.length ? '另' : ''}${remaining}人${state.unidentified ? '待识别' : '在场'}</span>` : '';
  const people = identities || unknown ? `<span class="hc-people">${identities}${unknown}</span>` : '';
  const values = Number.isFinite(state.temperature) || Number.isFinite(state.humidity) ? `${Number.isFinite(state.temperature) ? state.temperature + '℃' : '—'} · ${Number.isFinite(state.humidity) ? state.humidity + '%' : '—'}` : '温湿度待更新';
  const elapsedMinutes = state.environmentAt ? Math.max(0, Math.floor((Date.now() - state.environmentAt) / 60000)) : null;
  const updated = elapsedMinutes === null ? '环境数据待更新' : elapsedMinutes === 0 ? '刚刚更新' : elapsedMinutes < 60 ? `${elapsedMinutes}分钟前更新` : `${spaceTime(state.environmentAt)} 更新`;
  return `<strong>${esc(state.presenceLabel)}</strong>${people}${!state.people.length ? `<span class="hc-activity">${esc(state.activity)}</span>` : ''}<span class="hc-environment"><span class="hc-air">${esc(state.airMissing ? '空气待更新' : state.airText)}</span><span class="hc-readings">${esc(values)}</span></span><small class="hc-state-updated">${updated}</small>`;
}

function compactUpdate(stamp) {
  if (!Number.isFinite(stamp)) return '待更新';
  const minutes = Math.max(0, Math.floor((Date.now() - stamp) / 60000));
  return minutes === 0 ? '刚刚更新' : minutes < 60 ? `${minutes}分钟前更新` : `${spaceTime(stamp)} 更新`;
}

function compactDeviceSources(person, room) {
  const sources = person.sources || [];
  const hasRole = (source, name) => source.roles.some(role => role.name === name && role.available);
  const presence = sources.find(source => hasRole(source, '在场'));
  const activityRole = person.behavior ? '行为' : person.posture ? '姿态' : null;
  const activity = activityRole && sources.find(source => hasRole(source, activityRole));
  const selected = [...new Map([presence, activity].filter(Boolean).map(source => [source.id, source])).values()];
  const label = selected.map(source => source.name.startsWith(room.name) ? source.name.slice(room.name.length) : source.name).join('＋');
  return label || '设备依据待更新';
}

export function spaceDetailContent(state, room) {
  const personRow = (person, identity) => `<article class="ss-person-summary"><div class="ss-summary-top">${person.unknown ? '<span class="ss-avatar" aria-hidden="true">?</span>' : avatar(person)}<strong class="ss-summary-name">${esc(person.name)}</strong><span class="ss-summary-identity">${esc(identity)}</span></div><div class="ss-summary-bottom"><span class="ss-summary-status">在场｜${esc(person.activity || '活动待确认')}</span><span class="ss-summary-device">${esc(compactDeviceSources(person, room))}</span></div></article>`;
  const people = state.people.map(person => personRow(person, person.methods.map(method => methodNames[method]).join('＋'))).join('');
  const unknownActivity = !state.people.length && state.unidentified === 1 ? state.activity : '活动待确认';
  const unknown = state.unidentified ? personRow({ unknown: true, name: `${state.unidentified}人待识别`, activity: unknownActivity, behavior: unknownActivity === state.behavior ? state.behavior : '', posture: unknownActivity === state.posture ? state.posture : '', sources: state.sources }, '身份待确认') : '';
  const row = (label, value) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`;
  const peopleMeta = state.count === null ? state.presenceAt ? `人数待更新｜上次 ${spaceTime(state.presenceAt)}` : '待更新' : `${state.count}人｜${compactUpdate(state.presenceAt)}`;
  return `<div class="ss-detail">
    <section class="ss-section" aria-label="人物与活动"><div class="ss-section-title"><h3>人物与活动</h3><span>${esc(peopleMeta)}</span></div><div class="ss-panel"><div class="ss-person-list">${people}${unknown}${!people && !unknown ? `<p class="ss-empty-state">${esc(state.presenceMissing ? '人物与活动信息待更新' : '当前未检测到人在场')}</p>` : ''}</div></div></section>
    <section class="ss-section" aria-label="环境状态"><div class="ss-section-title"><h3>环境状态</h3><span>${state.environmentAt ? spaceTime(state.environmentAt) + ' 更新' : '待更新'}</span></div><div class="ss-panel"><div class="ss-metrics"><div><span>温度</span><strong>${Number.isFinite(state.temperature) ? `${state.temperature}<small>℃</small>` : '待更新'}</strong></div><div><span>湿度</span><strong>${Number.isFinite(state.humidity) ? `${state.humidity}<small>%</small>` : '待更新'}</strong></div><div><span>空气</span><strong class="ss-air-value">${esc(state.airMissing ? '待更新' : state.airText.replace(/^空气/, ''))}</strong></div></div><dl class="ss-facts">${row('温湿度来源', state.environmentSource)}${row('温湿度更新', spaceTime(state.environmentAt))}${row('空气来源', state.airMissing ? '等待空气信息更新' : '空间空气感知')}${row('空气更新', spaceTime(state.airAt))}</dl>${state.lastReadings ? `<p class="ss-footnote">上次读数 ${esc(state.lastReadings)} · ${spaceTime(state.lastEnvironmentAt)}，当前待更新</p>` : ''}</div></section>
    <p class="ss-detail-note">${room.devices}台关联设备 · 人物和环境按各自来源更新</p>
  </div>`;
}
