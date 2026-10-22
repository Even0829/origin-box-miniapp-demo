// 本地设备数据与回执模拟；所有页面从本模块读取同一份设备状态。
// 能力表示已接入的设备接口，不等同于空间目标已达成。
const DEFAULT_ROOMS = [
  { id: 'living', name: '客厅' }, { id: 'master', name: '主卧' },
  { id: 'second', name: '次卧' }, { id: 'bathroom', name: '卫生间' },
  { id: 'kitchen', name: '厨房' }, { id: 'dining', name: '餐厅' },
];

function createSeed(stamp) {
  const reading = (key, label, value, unit = '', text = `${value}${unit}`) => ({ key, label, value, unit, text, updatedAt: stamp });
  const sensor = (device) => ({ online: true, pending: null, readings: [], inputCapabilities: [], responseCapabilities: [], permissions: { read: true, control: false }, ...device });
  const control = (device) => ({ online: true, pending: null, readings: [], inputCapabilities: [], responseCapabilities: [], permissions: { read: true, control: true }, ...device });
  return [
    sensor({ id: 'living-radar', roomId: 'living', name: '射频在场传感器', source: '涂鸦', type: 'presence', image: 'assets/device-radar.png', inputCapabilities: ['在场'], readings: [reading('presence', '在场', true, '', '检测到人在场')] }),
    sensor({ id: 'living-camera', roomId: 'living', name: '视觉在场传感器', source: '涂鸦', type: 'presence', image: 'assets/device-camera.png', inputCapabilities: ['在场'], readings: [reading('presence', '在场', true, '', '检测到人在场')] }),
    control({ id: 'living-air', roomId: 'living', name: '空气置地机', source: '涂鸦', type: 'air', image: 'assets/device-air.png', power: true, mode: '低噪', modeOptions: ['自动', '标准', '低噪'], responseCapabilities: ['净化', '净化模式'] }),
    control({ id: 'living-ac', roomId: 'living', name: '客厅空调', source: '米家', type: 'climate', image: 'assets/device-ac.png', power: true, targetTemperature: 24, targetTemperatureMin: 16, targetTemperatureMax: 30, targetTemperatureStep: 1, temperatureModes: ['制冷', '制热', '自动'], mode: '制冷', modeOptions: ['制冷', '制热', '自动', '除湿', '送风'], fanMode: '自动', fanModeOptions: ['自动', '低风', '中风', '高风'], swingMode: '关闭', swingModeOptions: ['关闭', '上下', '左右', '全向'], inputCapabilities: ['温度'], responseCapabilities: ['制冷', '制热', '温度调节', '模式', '风速', '扫风'], readings: [reading('temperature', '室内温度', 25, '℃')] }),
    control({ id: 'living-lamp', roomId: 'living', name: '客厅主灯', source: '米家', type: 'light', image: 'assets/device-pendant.png', power: true, level: 35, responseCapabilities: ['照明', '亮度'] }),
    sensor({ id: 'living-environment', roomId: 'living', name: '温湿度传感器', source: '涂鸦', type: 'environment', image: 'assets/device-temperature.png', inputCapabilities: ['温湿度'], readings: [reading('temperature', '温度', 25, '℃'), reading('humidity', '湿度', 48, '%')] }),
    control({ id: 'master-left', roomId: 'master', name: '主卧左灯', source: '米家', type: 'light', image: 'assets/lamp-device.png', power: true, level: 30, responseCapabilities: ['照明', '亮度'] }),
    control({ id: 'master-right', roomId: 'master', name: '主卧右灯', source: '涂鸦', type: 'light', image: 'assets/lamp-device.png', power: true, level: 60, responseCapabilities: ['照明', '亮度'] }),
    sensor({ id: 'master-environment', roomId: 'master', name: '温湿度传感器', source: '米家', type: 'environment', image: 'assets/device-temperature.png', inputCapabilities: ['温湿度'], readings: [reading('temperature', '温度', 24, '℃'), reading('humidity', '湿度', 51, '%')] }),
    sensor({ id: 'master-presence', roomId: 'master', name: '在场传感器', source: '涂鸦', type: 'presence', image: 'assets/device-radar.png', inputCapabilities: ['在场'], readings: [reading('presence', '在场', true, '', '检测到人在场')] }),
    sensor({ id: 'second-environment', roomId: 'second', name: '温湿度传感器', source: '米家', type: 'environment', image: 'assets/device-temperature.png', inputCapabilities: ['温湿度'], readings: [reading('temperature', '温度', 25, '℃'), reading('humidity', '湿度', 46, '%')] }),
    sensor({ id: 'bathroom-humidity', roomId: 'bathroom', name: '温湿度传感器', source: '涂鸦', type: 'environment', image: 'assets/device-temperature.png', inputCapabilities: ['温湿度'], readings: [reading('temperature', '温度', 24, '℃'), reading('humidity', '湿度', 58, '%')] }),
    sensor({ id: 'kitchen-environment', roomId: 'kitchen', name: '温湿度传感器', source: '涂鸦', type: 'environment', image: 'assets/device-temperature.png', inputCapabilities: ['温湿度'], readings: [reading('temperature', '温度', 26, '℃'), reading('humidity', '湿度', 53, '%')] }),
    control({ id: 'kitchen-plug', roomId: 'kitchen', name: '厨房辅助灯', source: '米家', type: 'light', image: 'assets/device-pendant.png', power: false, level: 45, responseCapabilities: ['照明', '亮度'] }),
    control({ id: 'dining-lamp', roomId: 'dining', name: '餐厅吊灯', source: '米家', type: 'light', image: 'assets/device-pendant.png', online: false, power: false, level: 50, responseCapabilities: ['照明', '亮度'] }),
    sensor({ id: 'dining-environment', roomId: 'dining', name: '温湿度传感器', source: '米家', type: 'environment', image: 'assets/device-temperature.png', inputCapabilities: ['温湿度'], readings: [reading('temperature', '温度', 25, '℃'), reading('humidity', '湿度', 49, '%')] }),
    control({ id: 'unassigned-plug', roomId: null, name: '备用吊灯', source: '涂鸦', type: 'light', image: 'assets/device-pendant.png', power: false, level: 60, responseCapabilities: ['照明', '亮度'] }),
    sensor({ id: 'unassigned-environment', roomId: null, name: '备用温湿度传感器', source: '米家', type: 'environment', image: 'assets/device-temperature.png', inputCapabilities: ['温湿度'], readings: [reading('temperature', '温度', 23.5, '℃'), reading('humidity', '湿度', 47, '%')] }),
    control({ id: 'unassigned-lamp', roomId: null, name: '白色吊灯', source: '米家', type: 'light', image: 'assets/lamp-device.png', power: false, level: 45, colorTemperature: 3000, colorTemperatureMin: 2700, colorTemperatureMax: 6500, responseCapabilities: ['照明', '亮度', '色温'] }),
  ];
}

export function createDeviceStore({ getRooms = () => DEFAULT_ROOMS, onChange, onRecord, onReceipt } = {}) {
  const seededAt = Date.now();
  const devices = createSeed(seededAt).map((device) => ({
    ...device,
    controlRevision: 0,
    updatedAt: device.online ? seededAt : seededAt - 25 * 60 * 1000,
    providerId: device.source === '米家' ? 'xiaomi' : 'tuya',
    accountId: device.source === '米家' ? 'mi-main' : 'ty-main',
    externalId: `cn:seed:${device.id}`,
  }));
  const listeners = new Set();
  const requestTimers = new Map();
  const history = new Map();
  let previewStarted = false;
  let previewTimer = null;
  let completionTimer = null;
  let disposed = false;
  let controlSerial = 0;
  let execution = {
    id: 'master-soft-light', roomId: 'master', title: '主卧照明调节', target: '两盏灯调至30%',
    status: 'running', source: 'user', startedAt: Date.now() - 5000, updatedAt: Date.now(),
    devices: [
      { id: 'master-left', name: '主卧左灯', source: '米家', current: 30, target: 30, status: 'confirmed', feedback: '已调至30%' },
      { id: 'master-right', name: '主卧右灯', source: '涂鸦', current: 60, target: 30, status: 'waiting', feedback: '等待反馈' },
    ],
  };

  const clone = (value) => value == null ? value : structuredClone(value);
  const find = (id) => devices.find((device) => device.id === id);
  const rooms = () => getRooms() || [];
  const hasRoom = (id) => id === null || rooms().some((room) => room.id === id);
  const roomName = (id) => rooms().find((room) => room.id === id)?.name || '未设置空间';
  const summary = () => ({ total: devices.length, online: devices.filter((device) => device.online).length, running: devices.filter((device) => device.online && device.power === true).length });

  function stopExecution() {
    clearTimeout(previewTimer);
    clearTimeout(completionTimer);
    previewTimer = null;
    completionTimer = null;
    execution = null;
  }

  function reconcileRooms() {
    for (const device of devices) {
      if (device.roomId !== null && !hasRoom(device.roomId)) device.roomId = null;
    }
    if (execution && (!hasRoom(execution.roomId) || execution.devices.some((item) => find(item.id)?.roomId !== execution.roomId))) stopExecution();
  }

  function snapshot(device) {
    if (!device) return null;
    const value = clone(device);
    value.controlRevision = device.controlRevision || 0;
    value.roomName = roomName(device.roomId);
    value.supportsPower = typeof device.power === 'boolean';
    value.updatedAt = device.updatedAt || device.readings[0]?.updatedAt || null;
    if (device.pending) {
      const target = device.pending.target || { power: device.pending.desired };
      value.statusText = device.pending.kind === 'power' ? (target.power ? '正在开启' : '正在关闭') : '正在调节 · 等待反馈';
    }
    else if (!device.online) value.statusText = '离线';
    else if (typeof device.power === 'boolean') {
      value.statusText = !device.power ? '关闭' : device.type === 'light' && Number.isFinite(device.level) ? `开启 · ${device.level}%` : device.type === 'air' ? `开启 · ${device.mode}模式` : device.type === 'climate' ? climateStatus(device) : '开启';
    } else value.statusText = device.readings.map((item) => item.text).join(' · ') || '暂无读数';
    // 卡片优先表达读数、模式和设定；电源由开关呈现，详情保留明确的状态文案。
    if (device.pending) value.cardStatusText = '等待设备反馈';
    else if (!device.online) value.cardStatusText = '等待连接';
    else if (device.type === 'light' && Number.isFinite(device.level)) value.cardStatusText = `${device.power ? '亮度' : '亮度设定'}${device.level}%`;
    else if (device.type === 'air') value.cardStatusText = device.power ? `${device.mode}模式` : `模式设定 · ${device.mode}`;
    else if (device.type === 'climate') value.cardStatusText = climateStatus(device);
    else value.cardStatusText = device.readings.map((item) => item.text).join(' · ') || '暂无读数';
    return value;
  }

  function emit(type, changedDevices = [], changedRooms = []) {
    if (disposed) return;
    const change = { type, deviceIds: [...new Set(changedDevices)], roomIds: [...new Set(changedRooms.filter((id) => id !== null))], summary: summary(), at: Date.now() };
    onChange?.(clone(change));
    for (const listener of listeners) listener(clone(change));
  }

  function result(ok, code, message, device = null, extras = {}) {
    return { ok, code, message, deviceId: device?.id || null, requestId: null, device: snapshot(device), receipt: null, record: null, ...extras };
  }

  function receiptFor(device, summaryText, target = null) {
    const receipt = { deviceId: device.id, roomId: device.roomId, name: device.name, kind: device.type === 'light' ? 'lamp' : device.type === 'air' ? 'air' : 'device', summary: summaryText, image: device.image };
    if (device.type === 'light' && device.power && Number.isFinite(device.level) && (!target || !('colorTemperature' in target) || 'level' in target)) receipt.percentage = device.level;
    if (target && 'colorTemperature' in target) receipt.colorTemperature = device.colorTemperature;
    if (target && 'targetTemperature' in target) receipt.targetTemperature = device.targetTemperature;
    return receipt;
  }

  function recordFor(device, summaryText, requestId, title = `${device.name}${device.power ? '开启' : '关闭'}`) {
    return { experienceId: requestId, deviceId: device.id, title, summary: summaryText, status: '已完成', state: 'past', scope: 'family', label: '设备状态反馈', text: `${roomName(device.roomId)} · ${summaryText}` };
  }

  function getDevices() { reconcileRooms(); return devices.map(snapshot); }
  function get(id) { reconcileRooms(); return snapshot(find(id)); }
  function getSummary() { reconcileRooms(); return summary(); }

  function getRoomCapabilities(roomId) {
    reconcileRooms();
    const inRoom = devices.filter((device) => device.roomId === roomId);
    const inputDevices = inRoom.filter((device) => device.online && device.permissions.read && device.inputCapabilities.length);
    const responseDevices = inRoom.filter((device) => device.online && device.permissions.control && device.responseCapabilities.length);
    return {
      roomId, roomName: roomName(roomId), total: inRoom.length, online: inRoom.filter((device) => device.online).length,
      inputCapabilities: [...new Set(inputDevices.flatMap((device) => device.inputCapabilities))],
      responseCapabilities: [...new Set(responseDevices.flatMap((device) => device.responseCapabilities))],
      inputDevices: inputDevices.map(snapshot), responseDevices: responseDevices.map(snapshot),
    };
  }

  function getExecution(roomId) {
    reconcileRooms();
    if (!execution || roomId !== execution.roomId) return null;
    const value = clone(execution);
    value.devices = value.devices.map((item) => ({ ...item, name: find(item.id)?.name || item.name, source: find(item.id)?.source || item.source }));
    return value;
  }

  function temperatureEnabled(device, mode = device.mode) {
    return !Array.isArray(device.temperatureModes) || device.temperatureModes.includes(mode);
  }

  function climateStatus(device) {
    const parts = [device.mode || '模式待同步'];
    if (temperatureEnabled(device)) parts.push(Number.isFinite(device.targetTemperature) ? `${device.targetTemperature}℃` : '设定待同步');
    return parts.join(' · ');
  }

  function selectOptions(supplied) {
    return (Array.isArray(supplied) ? supplied : []).map((item) => typeof item === 'string' ? { value: item, label: item } : { value: item?.value, label: item?.label || item?.value, ...(item?.icon ? { icon: item.icon } : {}) })
      .filter((item) => typeof item.value === 'string' && item.value && typeof item.label === 'string');
  }

  function modeOptions(device) {
    const options = selectOptions(device.modeOptions);
    const supportsMode = device.responseCapabilities.includes('净化模式') || options.length > 0;
    if (!supportsMode || typeof device.mode !== 'string') return [];
    // 本地接入能力示例；保留厂商返回值，不用界面标签替换来源值。
    if (!options.length) options.push(...['自动', '标准', '睡眠'].map((value) => ({ value, label: value })));
    if (device.mode && !options.some((item) => item.value === device.mode)) options.unshift({ value: device.mode, label: device.mode });
    return [...new Map(options.map((item) => [item.value, item])).values()];
  }

  function getControls(id) {
    reconcileRooms();
    const device = find(id);
    if (!device) return [];
    const controls = [];
    const reason = disposed ? '设备连接已关闭' : !device.permissions.control ? '没有设备控制权限' : !device.online ? '设备离线，暂时无法操作' : device.pending ? '正在等待设备反馈' : '';
    const create = (key, type, label, value, extra = {}) => ({ key, type, label, value, disabled: Boolean(reason), disabledReason: reason, ...extra });
    if (typeof device.power === 'boolean') controls.push(create('power', 'toggle', '电源', device.power));
    if (device.responseCapabilities.includes('亮度') && Number.isFinite(device.level)) {
      const disabledReason = reason || (device.power === false ? '请先开启设备' : '');
      controls.push(create('level', 'range', '亮度', device.level, { min: 1, max: 100, step: 1, unit: '%', disabled: Boolean(disabledReason), disabledReason }));
    }
    if (device.responseCapabilities.includes('色温') && Number.isFinite(device.colorTemperature)) {
      const min = Number.isFinite(device.colorTemperatureMin) ? device.colorTemperatureMin : 2700;
      const max = Number.isFinite(device.colorTemperatureMax) ? device.colorTemperatureMax : 6500;
      const disabledReason = reason || (device.power === false ? '请先开启设备' : '');
      if (min < max) controls.push(create('colorTemperature', 'range', '色温', device.colorTemperature, { min, max, step: 100, unit: 'K', tone: 'temperature', disabled: Boolean(disabledReason), disabledReason }));
    }
    if (device.responseCapabilities.includes('温度调节') && Number.isFinite(device.targetTemperature)) {
      const min = Number.isFinite(device.targetTemperatureMin) ? device.targetTemperatureMin : 16;
      const max = Number.isFinite(device.targetTemperatureMax) ? device.targetTemperatureMax : 30;
      const step = Number.isFinite(device.targetTemperatureStep) && device.targetTemperatureStep > 0 ? device.targetTemperatureStep : 1;
      const disabledReason = reason || (device.power === false ? '请先开启设备' : '') || (!temperatureEnabled(device) ? '当前模式无需设置温度' : '');
      if (min < max) controls.push(create('targetTemperature', 'range', '设定温度', device.targetTemperature, { min, max, step, unit: '℃', presentation: 'stepper', disabled: Boolean(disabledReason), disabledReason }));
    }
    const options = modeOptions(device);
    if (options.length) {
      const disabledReason = reason || (device.power === false ? '请先开启设备' : '');
      controls.push(create('mode', 'select', '运行模式', device.mode, { options, ...(device.type === 'climate' ? { presentation: 'icon-grid' } : {}), disabled: Boolean(disabledReason), disabledReason }));
    }
    for (const [key, capability, label] of [['fanMode', '风速', '风速'], ['swingMode', '扫风', '扫风']]) {
      if (!device.responseCapabilities.includes(capability) || typeof device[key] !== 'string') continue;
      const items = selectOptions(device[`${key}Options`]);
      if (!items.length) continue;
      const disabledReason = reason || (device.power === false ? '请先开启设备' : '');
      controls.push(create(key, 'select', label, device[key], { options: items, layout: 'half', group: 'airflow', disabled: Boolean(disabledReason), disabledReason }));
    }
    return clone(controls);
  }

  function addHistory(device, { id, at = Date.now(), title, detail, source = '设备', status = 'confirmed' }) {
    const items = history.get(device.id) || [];
    items.unshift({ id: id || `event-${device.id}-${at}`, at, title, detail, source, status });
    history.set(device.id, items.slice(0, 60));
  }

  function stateDescription(device) {
    if (typeof device.power === 'boolean') {
      if (!device.power) return '设备已关闭';
      const settings = [];
      if (device.type === 'climate') {
        if (device.mode) settings.push(`${device.mode}模式`);
        if (Number.isFinite(device.targetTemperature) && temperatureEnabled(device)) settings.push(`设定${device.targetTemperature}℃`);
        if (device.fanMode) settings.push(`风速${device.fanMode}`);
        if (device.swingMode) settings.push(`扫风${device.swingMode}`);
      }
      if (Number.isFinite(device.level) && device.responseCapabilities.includes('亮度')) settings.push(`亮度${device.level}%`);
      if (Number.isFinite(device.colorTemperature) && device.responseCapabilities.includes('色温')) settings.push(`色温${device.colorTemperature}K`);
      if (settings.length) return settings.join(' · ');
      if (typeof device.mode === 'string') return `${device.mode}模式`;
      return '设备已开启';
    }
    return device.readings.map((reading) => reading.text).filter(Boolean).join(' · ') || '尚未收到设备读数';
  }

  function seedHistory(device, imported = false) {
    const at = device.updatedAt || device.readings.find((reading) => Number.isFinite(reading.updatedAt))?.updatedAt || null;
    // 初始历史只表现这台设备已有的能力与状态，不推导人数、活动或空间结论。
    if (at) addHistory(device, { id: `state-${device.id}`, at, title: typeof device.power === 'boolean' ? '设备状态已同步' : '收到感知信息', detail: stateDescription(device) });
    if (imported) addHistory(device, { id: `connected-${device.id}`, at: Date.now(), title: '设备已接入', detail: device.providerId === 'int' ? '通过引元盒子自动加入家庭' : `通过${device.source}账号加入家庭`, source: device.providerId === 'int' ? '引元盒子' : '用户' });
    else if (at && device.type === 'presence' && device.readings.some((reading) => reading.key === 'presence' && typeof reading.value === 'boolean')) {
      addHistory(device, { id: `presence-${device.id}`, at: at - 38 * 60 * 1000, title: '在场状态变化', detail: '暂未检测到人在场' });
    }
    if (!device.online) addHistory(device, { id: `offline-${device.id}`, at: imported ? Date.now() : seededAt - 10 * 60 * 1000, title: '设备暂时离线', detail: '保留最近一次确认的设备状态', status: 'failed' });
  }

  function getHistory(id) {
    const device = find(id);
    if (!device) return [];
    return clone([...(history.get(id) || [])].sort((a, b) => b.at - a.at));
  }

  function getTrend(id, key, period = '24h') {
    const device = find(id);
    if (!device || period !== '24h' || !device.permissions.read) return null;
    const reading = device.readings.find((item) => item.key === key);
    // null、unknown 和布尔感知不当作零点绘制；趋势终点固定于最后确认的该项读数。
    if (!reading || typeof reading.value !== 'number' || !Number.isFinite(reading.value)) return null;
    const endAt = reading.updatedAt || device.updatedAt;
    if (!Number.isFinite(endAt)) return null;
    const seed = [...`${id}:${key}`].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const amplitude = key === 'humidity' ? 3.2 : key === 'temperature' ? 1.1 : Math.max(Math.abs(reading.value) * .035, .1);
    const points = Array.from({ length: 25 }, (_, index) => {
      const offset = amplitude * Math.sin((index - 24) * .41) + amplitude * .35 * Math.sin((index - 24) * .93 + seed % 7) * (24 - index) / 24;
      let value = index === 24 ? reading.value : Math.round((reading.value + offset) * 10) / 10;
      if (key === 'humidity') value = Math.max(0, Math.min(100, value));
      return { at: endAt - (24 - index) * 60 * 60 * 1000, value };
    });
    return { key, label: reading.label, unit: reading.unit || '', points, min: Math.min(...points.map((point) => point.value)), max: Math.max(...points.map((point) => point.value)) };
  }

  function requestControl(id, changes, options = {}) {
    reconcileRooms();
    const device = find(id);
    if (disposed) return Promise.resolve(result(false, 'disposed', '设备连接已关闭', device));
    if (!device) return Promise.resolve(result(false, 'not-found', '设备已移除'));
    if ((options.expectedRevision != null && (device.controlRevision || 0) !== options.expectedRevision) || (options.expectedRoomId !== undefined && device.roomId !== options.expectedRoomId)) return Promise.resolve(result(false, 'changed', '设备已有后续调整，请按当前状态自定义调整', device));
    if (!changes || typeof changes !== 'object' || Array.isArray(changes) || !Object.keys(changes).length || Object.keys(changes).some((key) => !['power', 'level', 'mode', 'colorTemperature', 'targetTemperature', 'fanMode', 'swingMode'].includes(key))) return Promise.resolve(result(false, 'invalid', '请选择有效的设备操作', device));
    if (!device.permissions.control) return Promise.resolve(result(false, 'readonly', '此设备只提供感知信息', device));
    if (!device.online) return Promise.resolve(result(false, 'offline', '设备离线，请检查设备连接', device));
    if (device.pending) return Promise.resolve(result(false, 'busy', '正在等待设备反馈', device, { requestId: device.pending.id }));
    const controls = getControls(id);
    const target = clone(changes);
    for (const [key, value] of Object.entries(target)) {
      const control = controls.find((item) => item.key === key);
      if (!control) return Promise.resolve(result(false, 'unsupported', '设备暂不支持此操作', device));
      if (key === 'power' && typeof value !== 'boolean') return Promise.resolve(result(false, 'invalid', '请选择开启或关闭', device));
      if (key === 'level' && (typeof value !== 'number' || !Number.isFinite(value) || value < control.min || value > control.max || !Number.isInteger(value))) return Promise.resolve(result(false, 'invalid', '亮度范围为1%至100%', device));
      if (key === 'colorTemperature' && (typeof value !== 'number' || !Number.isFinite(value) || value < control.min || value > control.max || Math.abs((value - control.min) / control.step - Math.round((value - control.min) / control.step)) > 1e-7)) return Promise.resolve(result(false, 'invalid', `色温范围为${control.min}K至${control.max}K，每次调节${control.step}K`, device));
      if (key === 'targetTemperature' && (typeof value !== 'number' || !Number.isFinite(value) || value < control.min || value > control.max || Math.abs((value - control.min) / control.step - Math.round((value - control.min) / control.step)) > 1e-7)) return Promise.resolve(result(false, 'invalid', `设定温度范围为${control.min}℃至${control.max}℃`, device));
      if (key === 'targetTemperature' && !temperatureEnabled(device, target.mode ?? device.mode)) return Promise.resolve(result(false, 'mode-restricted', '当前模式无需设置温度', device));
      if (control.type === 'select' && !control.options.some((item) => item.value === value)) return Promise.resolve(result(false, 'invalid', `请选择设备支持的${control.label}`, device));
      if (key !== 'power' && device.power === false && target.power !== true) return Promise.resolve(result(false, 'power-off', '请先开启设备', device));
    }
    if (target.power === false && Object.keys(target).some((key) => key !== 'power')) return Promise.resolve(result(false, 'invalid', '请开启设备后再调节', device));
    // 有效的手动意图优先于之前的调度，包含“保留当前值”，避免旧定时器稍后改回。
    if (execution?.devices.some((item) => item.id === id)) {
      const ids = execution.devices.map((item) => item.id), previousRoom = execution.roomId;
      stopExecution();
      emit('execution-ended', ids, [previousRoom]);
    }
    const keys = Object.keys(target);
    const changedKeys = keys.filter(key => device[key] !== target[key]);
    const before = Object.fromEntries(changedKeys.map(key => [key, clone(device[key])]));
    const after = Object.fromEntries(changedKeys.map(key => [key, clone(target[key])]));
    const requestRevision = (device.controlRevision || 0) + 1;
    device.controlRevision = requestRevision;
    if (!changedKeys.length) { emit('control-intent', [id], [device.roomId]); return Promise.resolve(result(true, 'unchanged', keys.length === 1 && keys[0] === 'power' ? (target.power ? '设备已开启' : '设备已关闭') : '设备已是当前设定', device, { requestRevision })); }
    const kind = keys.length === 1 ? keys[0] : 'control';
    const requestId = `${kind}-${id}-${Date.now()}-${++controlSerial}`;
    const requestedRoom = device.roomId;
    device.pending = { id: requestId, kind, desired: keys.length === 1 ? target[keys[0]] : clone(target), target: clone(target), startedAt: Date.now() };
    emit(`${kind}-requested`, [id], [device.roomId]);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        requestTimers.delete(id);
        if (device.pending?.id !== requestId) { resolve(result(false, 'cancelled', '本次操作已取消', device, { requestId })); return; }
        device.pending = null;
        if (device.controlRevision !== requestRevision || device.roomId !== requestedRoom) {
          emit(`${kind}-failed`, [id], [device.roomId]);
          resolve(result(false, 'changed', '设备已有更新，本次操作未覆盖新状态', device, { requestId, requestRevision })); return;
        }
        if (!device.online || !device.permissions.control) {
          const message = !device.online ? '设备未回应，请检查设备连接' : '设备控制权限已变更';
          addHistory(device, { id: requestId, title: '设备操作未完成', detail: message, source: '用户', status: 'failed' });
          emit(`${kind}-failed`, [id], [device.roomId]);
          resolve(result(false, !device.online ? 'offline' : 'readonly', message, device, { requestId, requestRevision }));
          return;
        }
        Object.assign(device, target);
        device.updatedAt = Date.now();
        const descriptions = [];
        if ('power' in target) descriptions.push(`已${target.power ? '开启' : '关闭'}`);
        if ('level' in target) descriptions.push(`亮度已调至${target.level}%`);
        if ('colorTemperature' in target) descriptions.push(`色温已调至${target.colorTemperature}K`);
        if ('targetTemperature' in target) descriptions.push(`设定温度已调至${target.targetTemperature}℃`);
        if ('fanMode' in target) descriptions.push(`风速已设为${getControls(id).find((control) => control.key === 'fanMode')?.options.find((option) => option.value === target.fanMode)?.label || target.fanMode}`);
        if ('swingMode' in target) descriptions.push(`扫风已设为${getControls(id).find((control) => control.key === 'swingMode')?.options.find((option) => option.value === target.swingMode)?.label || target.swingMode}`);
        if ('mode' in target) descriptions.push(`已切换${modeOptions(device).find((item) => item.value === target.mode)?.label || target.mode}模式`);
        const summaryText = `${device.name}${descriptions.join('，')}`;
        const title = kind === 'power' ? `${device.name}${target.power ? '开启' : '关闭'}` : kind === 'level' ? '亮度已调整' : kind === 'colorTemperature' ? '色温已调整' : kind === 'mode' ? '运行模式已切换' : kind === 'targetTemperature' ? '设定温度已调整' : kind === 'fanMode' ? '风速已调整' : kind === 'swingMode' ? '扫风已调整' : '设备设定已调整';
        const receipt = receiptFor(device, summaryText, target);
        const record = recordFor(device, summaryText, requestId, title);
        record.controlChange = { deviceId: id, roomId: requestedRoom, before, after, expectedRevision: requestRevision, guard: 'power' in before ? {} : typeof device.power === 'boolean' ? { power: device.power } : {} };
        addHistory(device, { id: requestId, at: device.updatedAt, title, detail: summaryText, source: '用户' });
        onRecord?.(clone(record));
        onReceipt?.(clone(receipt));
        emit(`${kind}-confirmed`, [id], [device.roomId]);
        resolve(result(true, 'confirmed', summaryText, device, { requestId, requestRevision, controlChange: clone(record.controlChange), receipt: clone(receipt), record: clone(record) }));
      }, 900);
      requestTimers.set(id, { timer, resolve, requestId });
    });
  }

  function requestPower(id, desired) { return requestControl(id, { power: desired }); }

  function patch(id, changes, { silent = true } = {}) {
    reconcileRooms();
    const device = find(id);
    if (!device) return result(false, 'not-found', '设备已移除');
    if (!changes || typeof changes !== 'object') return result(false, 'invalid', '设备信息无效', device);
    if ('roomId' in changes && !hasRoom(changes.roomId)) return result(false, 'room-not-found', '空间已移除', device);
    const previousRoom = device.roomId;
    const previousState = stateDescription(device);
    const controlKeys = ['power', 'level', 'mode', 'colorTemperature', 'targetTemperature', 'fanMode', 'swingMode'];
    const previousControlValues = controlKeys.map((key) => device[key]);
    const now = Date.now();
    const allowed = ['roomId', 'name', 'online', 'mode', 'modeOptions', 'fanMode', 'fanModeOptions', 'swingMode', 'swingModeOptions', 'targetTemperatureMin', 'targetTemperatureMax', 'targetTemperatureStep', 'temperatureModes', 'colorTemperatureMin', 'colorTemperatureMax'];
    for (const key of allowed) if (key in changes) device[key] = clone(changes[key]);
    if (device.providerId === 'int' && 'roomId' in changes && previousRoom !== device.roomId) device.roomSource = 'user';
    if (changes.permissions && typeof changes.permissions === 'object') device.permissions = { ...device.permissions, ...clone(changes.permissions) };
    if (Array.isArray(changes.readings)) {
      device.readings = clone(changes.readings).map((reading) => ({ ...reading, updatedAt: reading.updatedAt || (device.online && reading.value != null && reading.value !== 'unknown' ? now : device.readings.find((old) => old.key === reading.key)?.updatedAt || null) }));
    }
    if (typeof device.power === 'boolean' && typeof changes.power === 'boolean') device.power = changes.power;
    if (device.type === 'light' && Number.isFinite(changes.level)) device.level = Math.max(0, Math.min(100, changes.level));
    if (device.responseCapabilities.includes('色温') && Number.isFinite(changes.colorTemperature)) device.colorTemperature = changes.colorTemperature;
    if (device.responseCapabilities.includes('温度调节') && Number.isFinite(changes.targetTemperature)) device.targetTemperature = changes.targetTemperature;
    const controlChanged = controlKeys.some((key, index) => device[key] !== previousControlValues[index]);
    if (controlChanged) device.controlRevision = (device.controlRevision || 0) + 1;
    const stateChanged = controlChanged || previousState !== stateDescription(device);
    // 名称、归属与连接元数据不代表设备重新反馈，离线也保留最后确认时间。
    if (device.online && controlKeys.some((key) => key in changes) && stateChanged) device.updatedAt = now;
    if (device.online && Array.isArray(changes.readings)) {
      const stamps = device.readings.filter((reading) => reading.value != null && reading.value !== 'unknown').map((reading) => reading.updatedAt).filter(Number.isFinite);
      if (stamps.length) device.updatedAt = Math.max(...stamps);
    }
    if (stateChanged && device.online) addHistory(device, { title: '设备状态变化', detail: stateDescription(device) });
    if ('online' in changes && changes.online === false) addHistory(device, { title: '设备暂时离线', detail: '保留最近一次确认的设备状态', status: 'failed' });
    if (execution?.devices.some((item) => item.id === id) && (device.roomId !== previousRoom || controlKeys.some((key) => key in changes) || changes.online === false)) stopExecution();
    if (!silent) {
      const updated = snapshot(device), summaryText = `${device.name}状态已更新`;
      const record = recordFor(device, summaryText, `device-${id}-${Date.now()}`);
      const receipt = receiptFor(device, summaryText);
      onRecord?.(clone(record)); onReceipt?.(clone(receipt));
      emit('device-updated', [id], [previousRoom, device.roomId]);
      return result(true, 'updated', summaryText, device, { receipt, record, updated });
    }
    emit('device-updated', [id], [previousRoom, device.roomId]);
    return result(true, 'updated', '设备状态已更新', device);
  }

  function assignDevices(ids, roomId) {
    reconcileRooms();
    if (!Array.isArray(ids) || !ids.length) return result(false, 'empty', '请选择设备');
    if (!hasRoom(roomId)) return result(false, 'room-not-found', '空间已移除');
    const chosen = [...new Set(ids)].map(find);
    if (chosen.some((device) => !device)) return result(false, 'not-found', '部分设备已移除');
    const oldRooms = chosen.map((device) => device.roomId);
    const changed = chosen.filter((device) => device.roomId !== roomId);
    if (execution && changed.some((device) => execution.devices.some((item) => item.id === device.id))) stopExecution();
    changed.forEach((device) => { device.roomId = roomId; if (device.providerId === 'int') device.roomSource = 'user'; });
    if (changed.length) emit('devices-assigned', changed.map((device) => device.id), [...oldRooms, roomId]);
    return { ok: true, code: 'assigned', message: roomId === null ? '设备位置已清除' : `已移至${roomName(roomId)}`, deviceIds: chosen.map((device) => device.id), roomId, devices: chosen.map(snapshot) };
  }

  function moveRoomDevices(from, to) {
    // 在空间移除前调用，先完成位置迁移，再由空间模块删除空间。
    const ids = devices.filter((device) => device.roomId === from).map((device) => device.id);
    if (!hasRoom(to)) return result(false, 'room-not-found', '目标空间已移除');
    if (!ids.length) { if (execution?.roomId === from) stopExecution(); return { ok: true, code: 'assigned', message: '没有需要移动的设备', deviceIds: [], roomId: to, devices: [] }; }
    return assignDevices(ids, to);
  }

  function renameDevice(id, name) {
    const value = String(name ?? '').trim();
    if (!value) return result(false, 'invalid-name', '请输入设备名称', find(id));
    if (value.length > 20) return result(false, 'invalid-name', '名称最多20个字', find(id));
    return patch(id, { name: value });
  }

  // 接入是设备注册，不会发送控制指令；稳定来源标识用于重复接入去重。
  function addDevices(items) {
    if (disposed) return { ok: false, message: '设备连接已关闭', added: [], skipped: [] };
    if (!Array.isArray(items) || !items.length) return { ok: false, message: '请选择设备', added: [], skipped: [] };
    if (items.some((item) => !item?.id || !item.externalId || !['int', 'xiaomi', 'tuya'].includes(item.providerId) || !hasRoom(item.roomId) || !String(item.name || '').trim())) {
      return { ok: false, message: '设备或空间信息已变化，请重新确认', added: [], skipped: [] };
    }
    const added = [], skipped = [];
    for (const item of items) {
      const existing = devices.find((device) => device.id === item.id || device.providerId === item.providerId && device.externalId === item.externalId);
      if (existing) { skipped.push(snapshot(existing)); continue; }
      const device = {
        id: item.id, externalId: item.externalId, providerId: item.providerId,
        accountId: item.accountId, roomId: item.roomId, name: String(item.name).trim().slice(0, 20),
        source: { int: '引态', xiaomi: '米家', tuya: '涂鸦' }[item.providerId], type: item.type,
        image: item.image, online: item.online !== false, pending: null,
        readings: clone(item.readings || []), inputCapabilities: clone(item.inputCapabilities || []),
        responseCapabilities: clone(item.responseCapabilities || []),
        capabilities: clone(item.capabilities || []), partial: item.partial || '',
        permissions: { read: item.permissions?.read !== false, control: item.permissions?.control === true },
        updatedAt: item.updatedAt || (item.online !== false ? Date.now() : null),
      };
      device.readings = device.readings.map((reading) => ({ ...reading, updatedAt: reading.updatedAt || device.updatedAt }));
      if (device.providerId === 'int') device.roomSource = device.roomId ? item.roomSource === 'automatic' ? 'automatic' : 'user' : null;
      if (typeof item.power === 'boolean' && device.permissions.control) device.power = item.power;
      if (Number.isFinite(item.level)) device.level = Math.max(0, Math.min(100, item.level));
      if (item.mode) device.mode = item.mode;
      for (const key of ['colorTemperature', 'colorTemperatureMin', 'colorTemperatureMax', 'targetTemperature', 'targetTemperatureMin', 'targetTemperatureMax', 'targetTemperatureStep']) if (Number.isFinite(item[key])) device[key] = item[key];
      for (const key of ['modeOptions', 'fanModeOptions', 'swingModeOptions', 'temperatureModes']) if (Array.isArray(item[key])) device[key] = clone(item[key]);
      for (const key of ['fanMode', 'swingMode']) if (typeof item[key] === 'string') device[key] = item[key];
      devices.push(device); added.push(device); seedHistory(device, true);
    }
    if (added.length) {
      onRecord?.({ experienceId: `devices-added-${Date.now()}`, title: `${added.length}台设备已加入家庭`, summary: added.map((device) => device.name).join('、'), status: '已完成', state: 'past', scope: 'family', label: '设备接入', text: '设备已加入家庭，空间位置以确认结果为准' });
      emit('devices-added', added.map((device) => device.id), added.map((device) => device.roomId));
    }
    return { ok: true, added: added.map(snapshot), skipped };
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function startPreviewExecution() {
    if (previewStarted || disposed) return false;
    previewStarted = true;
    reconcileRooms();
    if (!execution) return false;
    // 这是此前用户委托的快照，只继续等待既有设备反馈，不发起新任务。
    previewTimer = setTimeout(() => {
      previewTimer = null;
      reconcileRooms();
      if (!execution) return;
      const right = find('master-right');
      if (!right?.online || right.pending || right.roomId !== execution.roomId || !right.power) {
        stopExecution();
        emit('execution-ended', ['master-left', 'master-right'], ['master']);
        return;
      }
      right.level = 30;
      right.updatedAt = Date.now();
      addHistory(right, { title: '亮度已调整', detail: '亮度已调至30%，设备反馈已确认', source: '小元' });
      execution.devices[1] = { ...execution.devices[1], current: 30, status: 'confirmed', feedback: '已调至30%' };
      execution.status = 'completed';
      execution.updatedAt = Date.now();
      const record = { experienceId: execution.id, title: '主卧灯光柔和了一些', summary: '两盏灯均已反馈30%亮度', status: '已完成', state: 'past', scope: 'family', label: '设备反馈已齐', text: '米家主卧左灯、涂鸦主卧右灯均已调至30%，已确认设备状态' };
      onRecord?.(clone(record));
      onReceipt?.(receiptFor(right, '两盏灯已调至30%'));
      emit('execution-confirmed', ['master-left', 'master-right'], ['master']);
      completionTimer = setTimeout(() => {
        completionTimer = null;
        execution = null;
        emit('execution-ended', ['master-left', 'master-right'], ['master']);
      }, 8000);
    }, 5000);
    return true;
  }

  function destroy() {
    disposed = true;
    stopExecution();
    for (const [id, request] of requestTimers) {
      clearTimeout(request.timer);
      const device = find(id);
      if (device) device.pending = null;
      request.resolve(result(false, 'cancelled', '本次操作已取消', device, { requestId: request.requestId }));
    }
    requestTimers.clear();
    listeners.clear();
  }

  devices.forEach((device) => seedHistory(device));

  return { getDevices, get, getSummary, getRoomCapabilities, getExecution, getControls, requestControl, requestPower, getHistory, getTrend, patch, moveRoomDevices, assignDevices, renameDevice, addDevices, subscribe, startPreviewExecution, destroy };
}
