// 账号、授权和厂商设备清单均为本次运行内的本地数据；不发起厂商请求。
// 厂商授权范围与加入引元家庭的设备集合分别维护。
const PROVIDERS = [
  { id: 'xiaomi', name: '米家', subtitle: '连接米家账号，接入家庭设备' },
  { id: 'tuya', name: '涂鸦智能 / Smart Life', subtitle: '连接厂商 App 中的账号与设备' },
];
const clone = (value) => structuredClone(value);

export function createDeviceConnections({ store, getRooms }) {
  const accounts = [
    { id: 'mi-main', providerId: 'xiaomi', name: '小雨', identifier: '138****0829', status: 'connected', region: 'cn', app: 'mijia' },
    { id: 'mi-family', providerId: 'xiaomi', name: '家人的账号', identifier: '136****0921', status: 'connected', region: 'cn', app: 'mijia' },
    { id: 'mi-old', providerId: 'xiaomi', name: '旧的米家账号', identifier: '135****0516', status: 'expired', region: 'cn', app: 'mijia' },
    { id: 'ty-main', providerId: 'tuya', name: '小雨', identifier: '家庭账号 · 0829', status: 'connected', region: 'cn', app: 'smartlife', userCode: 'CN8Q7X9A' },
    { id: 'ty-previous', providerId: 'tuya', name: '旧的家庭账号', identifier: '家庭账号 · 0618', status: 'expired', region: 'cn', app: 'tuya', userCode: 'CN6H2M8B' },
  ];
  const attempts = new Map();
  const byAccount = new Map();
  const reading = (key, label, value, unit) => ({ key, label, value, unit, text: `${value}${unit}`, updatedAt: Date.now() });
  const originalDevices = store.getDevices();
  let destroyed = false;

  function account(id) { return accounts.find((item) => item.id === id); }
  function candidate(providerId, accountId, homeId, fields) {
    const value = {
      providerId, accountId, homeId, homeName: homeId.endsWith('parents') ? '父母的家' : '常住的家',
      supported: true, partial: '', online: true, manufacturerRoom: '客厅',
      capabilities: [], readings: [], inputCapabilities: [], responseCapabilities: [],
      permissions: { read: true, control: false }, ...fields,
    };
    value.source = providerId === 'xiaomi' ? '米家' : '涂鸦';
    value.externalId ||= `cn:${value.id}`;
    return value;
  }
  function light(providerId, accountId, homeId, fields) {
    return candidate(providerId, accountId, homeId, {
      type: 'light', image: 'assets/lamp-device.png', power: false, level: 60,
      capabilities: ['开关', '亮度调节'], responseCapabilities: ['照明', '亮度'],
      permissions: { read: true, control: true }, ...fields,
    });
  }
  function environment(providerId, accountId, homeId, fields) {
    return candidate(providerId, accountId, homeId, {
      type: 'environment', image: 'assets/device-temperature.png',
      capabilities: ['温度感知', '湿度感知'], inputCapabilities: ['温湿度'],
      readings: [reading('temperature', '温度', 24.5, '℃'), reading('humidity', '湿度', 48, '%')], ...fields,
    });
  }
  function buildInventory(value) {
    const { id: accountId, providerId } = value, homeId = `${providerId}-home`;
    const seed = (accountId === 'mi-main' || accountId === 'ty-main') ? originalDevices
      .filter((device) => device.providerId === providerId)
      .map((device) => candidate(providerId, accountId, homeId, {
        ...device, existingId: device.id, manufacturerRoom: device.roomId ? device.roomName : '未设置房间',
        capabilities: [...device.inputCapabilities, ...device.responseCapabilities],
      })) : [];
    const suffix = accountId === 'mi-main' || accountId === 'ty-main' ? '' : `-${accountId}`;
    if (providerId === 'xiaomi') return [
      ...seed,
      light(providerId, accountId, homeId, { id: `mi-reading-light${suffix}`, name: '书桌阅读灯', manufacturerRoom: '次卧' }),
      environment(providerId, accountId, homeId, { id: `mi-study-climate${suffix}`, name: '书房温湿度传感器', manufacturerRoom: '书房' }),
      candidate(providerId, accountId, homeId, {
        id: `mi-air-purifier${suffix}`, name: '卧室空气净化器', manufacturerRoom: '主卧', type: 'air', image: 'assets/device-air.png',
        power: false, mode: '自动', modeOptions: ['自动', '标准', '睡眠', '强力'], capabilities: ['开关', '净化模式'], responseCapabilities: ['净化', '净化模式'],
        permissions: { read: true, control: true }, partial: '支持开关与模式，暂不支持滤芯寿命', failOnce: true,
      }),
      environment(providerId, accountId, homeId, { id: `mi-balcony-climate${suffix}`, name: '阳台温湿度传感器', manufacturerRoom: '阳台', online: false, readings: [] }),
      environment(providerId, accountId, homeId, { id: `mi-bluetooth-climate${suffix}`, name: '蓝牙温湿度计', manufacturerRoom: '餐厅', supported: false, unsupportedReason: '当前接入方式暂不支持此型号', capabilities: [], readings: [] }),
      light(providerId, accountId, `${providerId}-parents`, { id: `mi-parents-light${suffix}`, name: '床头阅读灯', manufacturerRoom: '父母卧室' }),
      environment(providerId, accountId, `${providerId}-parents`, { id: `mi-parents-climate${suffix}`, name: '卧室温湿度传感器', manufacturerRoom: '父母卧室' }),
    ];
    return [
      ...seed,
      light(providerId, accountId, homeId, { id: `ty-side-light${suffix}`, name: '餐边柜台灯', manufacturerRoom: '餐厅', level: 50 }),
      environment(providerId, accountId, homeId, { id: `ty-study-climate${suffix}`, name: '书房温湿度传感器', manufacturerRoom: '书房' }),
      candidate(providerId, accountId, homeId, {
        id: `ty-second-presence${suffix}`, name: '次卧在场传感器', manufacturerRoom: '次卧', type: 'presence',
        image: 'assets/device-radar.png', online: false, capabilities: ['在场感知'], inputCapabilities: ['在场'],
      }),
      candidate(providerId, accountId, homeId, {
        id: `ty-bedroom-air${suffix}`, name: '卧室空气置地机', manufacturerRoom: '主卧', type: 'air', image: 'assets/device-air.png',
        power: false, mode: '标准', capabilities: ['开关', '净化模式'], responseCapabilities: ['净化', '净化模式'],
        permissions: { read: true, control: true }, partial: '支持开关与模式，暂不支持定时', failOnce: true,
      }),
    ];
  }
  function inventory(id) {
    if (!account(id)) return [];
    if (!byAccount.has(id)) byAccount.set(id, buildInventory(account(id)));
    return byAccount.get(id);
  }
  function getProviders() { return clone(PROVIDERS); }
  function getAccounts(providerId) { return clone(accounts.filter((item) => item.providerId === providerId)); }
  function authorize(providerId, { accountId, region = 'cn', app = 'smartlife' } = {}) {
    if (!PROVIDERS.some((item) => item.id === providerId) || destroyed) return null;
    let value = accountId ? account(accountId) : account(`${providerId}-additional`);
    if (value && value.providerId !== providerId) return null;
    if (!value) {
      value = {
        id: `${providerId}-additional`, providerId, name: '阿元',
        identifier: providerId === 'xiaomi' ? '139****0618' : '家庭账号 · 0618',
        region, app: providerId === 'xiaomi' ? 'mijia' : app,
        ...(providerId === 'tuya' ? { userCode: 'CN6H2M8B' } : {}),
      };
      accounts.push(value);
    }
    value.status = 'connected'; value.region = region; value.app = providerId === 'xiaomi' ? 'mijia' : app;
    return clone(value);
  }
  function getHomes(accountId) {
    const value = account(accountId);
    if (!value) return [];
    const homes = new Map();
    for (const device of inventory(accountId)) {
      const home = homes.get(device.homeId) || { id: device.homeId, name: device.homeName, count: 0 };
      home.count++; homes.set(home.id, home);
    }
    return clone([...homes.values()]);
  }
  function isAdded(item) {
    return store.getDevices().find((device) => device.providerId === item.providerId && device.externalId === item.externalId) || (item.existingId ? store.get(item.existingId) : null);
  }
  function getDevices(accountId, homeId) {
    return clone(inventory(accountId).filter((item) => !homeId || item.homeId === homeId));
  }
  async function importDevices({ accountId, items } = {}) {
    const value = account(accountId);
    if (destroyed || value?.status !== 'connected') return { ok: false, message: '账号连接已失效，请重新授权', added: [], failed: [], skipped: [] };
    if (!Array.isArray(items) || !items.length) return { ok: false, message: '请选择需要接入的设备', added: [], failed: [], skipped: [] };
    // 先校验整份提交，再写入任何设备；无效空间不会导致部分归属悄悄落库。
    const selected = [...new Map(items.map((item) => [item.id, item])).values()];
    const list = inventory(accountId), knownRooms = getRooms();
    const chosen = selected.map((item) => ({ draft: item, device: list.find((device) => device.id === item.id) }));
    if (chosen.some(({ draft, device }) => !device?.supported || !(draft.roomId === null || knownRooms.some((room) => room.id === draft.roomId)))) {
      return { ok: false, message: '设备或空间信息已变化，请重新确认', added: [], failed: [], skipped: [] };
    }
    await new Promise((resolve) => setTimeout(resolve, 850));
    if (destroyed) return { ok: false, message: '本次接入已停止', added: [], failed: [], skipped: [] };
    const ready = [], failed = [], skipped = [];
    for (const { draft, device } of chosen) {
      const existing = isAdded(device);
      if (existing) { skipped.push({ id: device.id, name: device.name }); continue; }
      if (draft.roomId !== null && !getRooms().some((room) => room.id === draft.roomId)) {
        failed.push({ id: device.id, name: device.name, message: '空间已移除，请重新设置位置' }); continue;
      }
      const count = (attempts.get(device.id) || 0) + 1; attempts.set(device.id, count);
      if (device.failOnce && count === 1) {
        failed.push({ id: device.id, name: device.name, message: '设备信息暂未获取完整，请重试' }); continue;
      }
      ready.push({ ...clone(device), roomId: draft.roomId, accountId });
    }
    const saved = ready.length ? store.addDevices(ready) : { ok: true, added: [], skipped: [] };
    if (!saved.ok) return { ok: false, message: saved.message, added: [], failed: [...failed, ...ready.map((device) => ({ id: device.id, name: device.name, message: saved.message }))], skipped };
    return { ok: true, added: saved.added, failed, skipped: [...skipped, ...saved.skipped.map((device) => ({ id: device.id, name: device.name }))] };
  }
  function disconnect(id) {
    const index=accounts.findIndex(item=>item.id===id);
    if(index<0||destroyed)return {ok:false,message:'账号连接已变化，请重新查看'};
    if(store.getDevices().some(device=>device.accountId===id))return {ok:false,message:'请先处理关联设备，再断开连接'};
    accounts.splice(index,1);byAccount.delete(id);return {ok:true};
  }
  return { getProviders, getAccounts, getAccount: id => clone(account(id) || null), authorize, getHomes, getDevices, isAdded, importDevices, disconnect, destroy() { destroyed = true; } };
}
