// 本次运行内的自动接入演示；不扫描网络或调用真实无线协议。
// 设备名和能力均为虚构样例，不是已交付的自研硬件清单。
const FIXTURES = [
  { id: 'int-preview-environment', name: '引态环境感知器', type: 'environment', previewRoomId: 'living',
    capabilities: ['温度感知', '湿度感知'], inputCapabilities: ['温湿度'], responseCapabilities: [],
    permissions: { read: true, control: false },
    readings: [{ key: 'temperature', label: '温度', value: 24.5, unit: '℃', text: '24.5℃' }, { key: 'humidity', label: '湿度', value: 48, unit: '%', text: '48%' }] },
  { id: 'int-preview-light', name: '引态照明控制器', type: 'light', previewRoomId: 'master', power: false, level: 60,
    capabilities: ['开关', '亮度调节'], inputCapabilities: [], responseCapabilities: ['照明', '亮度'],
    permissions: { read: true, control: true }, readings: [] },
].map((item) => ({ ...item, externalId: `preview:${item.id}`, providerId: 'int', accountId: null,
  roomId: null, image: 'assets/onboarding-int-logo.svg', online: true }));

export function createNativeDeviceOnboarding({ store, getRooms = () => [], onChange }) {
  const timers = new Set();
  const discovered = new Set();
  const failures = new Map();
  let started = false, complete = false, disposed = false;

  function state() {
    const items = FIXTURES.map((fixture) => {
      const device = store.getDevices().find((item) => item.providerId === 'int' && item.externalId === fixture.externalId);
      return { ...(device || fixture), status: device ? 'added' : failures.has(fixture.id) ? 'failed' : discovered.has(fixture.id) ? 'joining' : 'waiting', message: failures.get(fixture.id) || '' };
    });
    const boxRoomId = (getRooms() || []).some((room) => room.id === 'living') ? 'living' : null;
    return { items, complete, boxRoomId, added: items.filter((item) => item.status === 'added').length };
  }
  function notify() { if (!disposed) onChange?.(state()); }
  function schedule(callback, delay) {
    const timer = setTimeout(() => { timers.delete(timer); if (!disposed) callback(); }, delay);
    timers.add(timer);
  }
  function start() {
    if (disposed || started) return;
    started = true;
    const missing = state().items.filter((item) => item.status !== 'added');
    if (!missing.length) { complete = true; notify(); return; }
    // 计时模拟盒子发现／注册；离开流程页不停止已经启动的盒子侧演示。
    missing.forEach((item, index) => {
      schedule(() => { discovered.add(item.id); notify(); }, 1800 + index * 2300);
      schedule(() => {
        const fixture = FIXTURES.find((entry) => entry.externalId === item.externalId);
        // 空间识别结果是独立Mock输入，不把接入时的距离当成同房间证据。
        const roomId = (getRooms() || []).some((room) => room.id === fixture.previewRoomId) ? fixture.previewRoomId : null;
        const result = store.addDevices([{ ...structuredClone(fixture), roomId, roomSource: roomId ? 'automatic' : null }]);
        if (!result.ok) failures.set(item.id, result.message || '暂未接入，请检查盒子连接');
        if (index === missing.length - 1) complete = true;
        notify();
      }, 3500 + index * 2300);
    });
  }
  return {
    state, start,
    retry() { if (!complete || !failures.size) return; started = false; complete = false; failures.clear(); start(); notify(); },
    destroy() { disposed = true; for (const timer of timers) clearTimeout(timer); timers.clear(); },
  };
}
