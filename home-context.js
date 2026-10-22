import {previewNow} from './preview-clock.js';
import {createHomeScenarios} from './home-scenarios.js?v=scene-matters-copy-20261021';
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const clock = (stamp) => new Date(stamp || previewNow()).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

export function createHomeContext({ container, getRooms = () => [], getPeople = () => [], getMemories = () => [], onRemember, store, openSheet, toast, icon, onSpaceDetail, onDeviceDetail, onService, onRecord, onServiceDetail } = {}) {
  if (!container || !store) throw new Error('首页空间概览缺少容器或设备状态');
  let selected = getRooms()[0]?.id || null;
  let scenarios = null;
  let popupOpen = false;
  let visible = true;
  let disposed = false;
  let carouselTimer = null;
  let recoveryTimer = null;
  let paused = false;
  let checking = false;
  let checkingIds = [];
  const query = (selector) => container.querySelector(selector);
  const sheetQuery = (selector) => document.querySelector(`#sheet ${selector}`);
  const roomName = (id) => getRooms().find((room) => room.id === id)?.name || '未设置空间';
  const allDevices = () => store.getDevices();
  const closeSheet = () => document.querySelector('#sheet')?.close();
  const sheetFrame = (kind) => { const dialog = document.querySelector('#sheet'); if (dialog) dialog.dataset.content = kind; return dialog; };
  const evidenceFor = (ids) => ids.map((id) => store.get(id)).filter(Boolean).map((device) => ({ title: device.name, source: `${roomName(device.roomId)} · ${device.source}`, detail: device.online ? device.statusText : '设备离线，暂时无法执行操作', at: device.updatedAt || previewNow(), deviceId: device.id }));
  const closePopup = (restoreFocus = false) => {
    if (!popupOpen) return;
    popupOpen = false;
    renderSpace();
    if (restoreFocus) query('.hc-space-select')?.focus({ preventScroll: true });
    restartCarousel();
  };

  container.classList.add('home-context');
  container.innerHTML = `<section class="hc-hero" aria-label="家庭空间概览">
    <img class="hc-house" src="assets/home-house.png" alt="家庭空间模型" draggable="false">
    <button class="hc-room-status" type="button" aria-label="查看当前空间详情"></button>
    <div class="hc-space-picker"><button class="hc-space-select" type="button" aria-haspopup="listbox" aria-expanded="false"><span></span><span class="hc-space-arrow" aria-hidden="true"><img src="assets/home-space-arrow.svg" alt=""></span></button><div class="hc-space-popup" role="listbox" aria-label="选择空间" hidden></div></div>
    <button class="hc-current-mode" type="button" hidden aria-label="查看正在进行的照料"></button>
  </section>
  <section class="hc-modes" aria-label="小元的场景照料"></section>
  <button type="button" class="hc-alert" hidden><span class="hc-alert-icon"><img src="assets/home-alert.svg" alt=""></span><span class="hc-alert-copy"></span><span class="hc-alert-count" hidden></span><span class="hc-alert-chevron"><img src="assets/home-alert-chevron.svg" alt=""></span></button>`;

  function restartCarousel() {
    clearTimeout(carouselTimer);
    if (disposed || !visible || paused || popupOpen || document.hidden) return;
    carouselTimer = setTimeout(() => {
      if (popupOpen || paused || document.querySelector('dialog[open]')) { restartCarousel(); return; }
      const rooms = getRooms();
      if (rooms.length > 1) selected = rooms[(Math.max(0, rooms.findIndex((room) => room.id === selected)) + 1) % rooms.length].id;
      renderSpace();
      restartCarousel();
    }, 10000);
  }

  function roomData(room) {
    const devices = allDevices().filter((device) => device.roomId === room.id);
    const environment = devices.filter((device) => device.type === 'environment');
    const available = environment.find((device) => device.online && device.permissions?.read !== false);
    const environmentMissing = environment.length > 0 && !available;
    const reading = (key) => available?.readings?.find((item) => item.key === key && Number.isFinite(item.value));
    const temperature = reading('temperature');
    const humidity = reading('humidity');
    const presenceDevices = devices.filter((device) => device.inputCapabilities?.includes('在场'));
    const presenceMissing = presenceDevices.length > 0 && presenceDevices.every((device) => !device.online || device.permissions?.read === false);
    const presenceUnavailable = presenceMissing || !room.observed;
    const presence = presenceUnavailable ? '在场状态待更新' : String(room.presence || '在场信息待更新');
    const activity = presenceUnavailable ? '' : String(room.activity || '').replace('暂无活动证据', '暂无活动');
    const presenceText = presence;
    const primary = [presenceText, activity && activity !== '暂无活动' ? activity : ''].filter(Boolean).join(' · ');
    const values = environmentMissing ? '温湿度待更新' : [temperature ? `${temperature.value}℃` : Number.isFinite(room.temperature) && !environment.length ? `${room.temperature}℃` : '', humidity ? `${humidity.value}%` : Number.isFinite(room.humidity) && !environment.length ? `${room.humidity}%` : ''].filter(Boolean).join(' · ') || '温湿度待更新';
    // 接入中断只影响对应的信息，不把离线解释为无人或空气异常。
    const airText = !environmentMissing && room.observed && room.airQuality ? `空气${room.airQuality}` : '空气状态待更新';
    return { primary, values, airText, missing: environmentMissing || presenceUnavailable };
  }

  function renderFamilyOverview() {
    const target = document.querySelector('.home-header .device-summary');
    if (!target) return;
    const rooms = getRooms(), covered = rooms.filter(room => room.observed);
    const waiting = covered.filter(room => {
      const state = roomData(room);
      return state.missing || state.values.includes('待更新') || state.airText.includes('待更新');
    }).length;
    const pending = rooms.length - covered.length;
    const details = [waiting ? `<strong>${waiting}处</strong>状态待更新` : '', pending ? `<strong>${pending}处</strong>待接入` : ''].filter(Boolean);
    const scope = covered.length ? `小元正在照看<strong>${covered.length}个</strong>空间` : '小元正在了解家庭空间';
    target.innerHTML = `${scope} · ${details.join('，') || (rooms.length ? '空间状态持续更新' : '添加空间，开始了解你的家')}`;
    target.setAttribute('aria-label', target.textContent);
  }

  function renderSpace() {
    const rooms = getRooms();
    if (!rooms.some((room) => room.id === selected)) selected = rooms[0]?.id || null;
    const room = rooms.find((item) => item.id === selected);
    const status = query('.hc-room-status');
    const select = query('.hc-space-select');
    const popup = query('.hc-space-popup');
    if (!room) {
      status.innerHTML = '<strong>空间信息待更新</strong><span>添加空间后查看状态</span>';
      status.disabled = true;
      select.disabled = true;
      select.querySelector('span').textContent = '选择空间';
      popup.hidden = true;
      return;
    }
    const data = roomData(room);
    status.disabled = false;
    status.dataset.sensing = data.missing ? 'pending' : 'available';
    status.setAttribute('aria-label', `${room.name}：${data.primary}，${data.values}，${data.airText}，查看详情`);
    status.innerHTML = `<strong>${escapeHTML(data.primary)}</strong><span>${escapeHTML(data.values)}<br>${escapeHTML(data.airText)}</span>`;
    select.disabled = false;
    select.querySelector('span').textContent = room.name;
    select.setAttribute('aria-expanded', String(popupOpen));
    popup.hidden = !popupOpen;
    popup.innerHTML = rooms.map((item) => `<button type="button" role="option" aria-selected="${item.id === selected}" data-select-space="${escapeHTML(item.id)}"><span>${escapeHTML(item.name)}</span>${item.id === selected ? '<span class="hc-selected-check" aria-hidden="true">✓</span>' : ''}</button>`).join('');
  }

  function alerts() {
    return allDevices().filter((device) => !device.online && device.roomId !== null).sort((a, b) => Number(b.inputCapabilities?.length > 0) - Number(a.inputCapabilities?.length > 0));
  }

  function alertTitle(device) {
    if (device.inputCapabilities?.length) return `${roomName(device.roomId)}状态待更新`;
    return `${device.name}连接中断`;
  }

  function alertDescription(device) {
    if (device.inputCapabilities?.includes('在场')) return '在场来源离线，暂不判断是否有人';
    if (device.type === 'environment') return '传感器离线，温湿度暂未更新';
    return '设备离线，暂时无法响应控制';
  }

  function renderAlert() {
    const list = alerts();
    const alert = query('.hc-alert');
    const wasHidden = alert.hidden;
    alert.hidden = list.length === 0;
    if (list.length) {
      alert.querySelector('.hc-alert-copy').innerHTML = `<strong>${escapeHTML(alertTitle(list[0]))}</strong><span>${escapeHTML(alertDescription(list[0]))}</span>`;
      const count = alert.querySelector('.hc-alert-count');
      count.hidden = list.length < 2;
      count.textContent = list.length > 1 ? `另有${list.length - 1}项` : '';
      alert.setAttribute('aria-label', `${alertTitle(list[0])}，${alertDescription(list[0])}${list.length > 1 ? `，另有${list.length - 1}项` : ''}，查看与处理`);
    }
    if (wasHidden !== alert.hidden) container.dispatchEvent(new CustomEvent('homecontext:heightchange', { bubbles: true, detail: { hasAlert: list.length > 0 } }));
  }

  function openAlerts() {
    const list = alerts();
    if (!list.length) { toast?.('当前没有待处理的设备连接问题'); return; }
    closePopup();
    openSheet(list.length > 1 ? '需要留意的变化' : alertTitle(list[0]), `<p class="sheet-description">连接中断时保留最后一次信息，不将旧读数当作当前状态</p><div class="hc-alert-list">${list.map((device) => `<article class="hc-alert-item"><div class="hc-alert-item-heading"><strong>${escapeHTML(alertTitle(device))}</strong><span>待处理</span></div><p>${escapeHTML(alertDescription(device))}</p><dl><div><dt>信息来源</dt><dd>${escapeHTML(device.name)} · ${escapeHTML(device.source)}</dd></div><div><dt>最后反馈</dt><dd>${device.updatedAt ? clock(device.updatedAt) : '暂无反馈时间'}</dd></div><div><dt>当前影响</dt><dd>${device.inputCapabilities?.length ? '相关信息待更新，不据此继续判断或执行' : '本设备暂时无法控制，其他设备照常运行'}</dd></div></dl><button class="hc-locate-device" type="button" data-hc-device="${escapeHTML(device.id)}">查看设备${icon?.('chevron') || ' ›'}</button></article>`).join('')}</div><button class="primary-button" id="hc-check-connection" ${checking ? 'disabled' : ''}>${checking ? '正在检查连接…' : list.length > 1 ? '检查设备连接' : '检查连接'}</button>`, { restoreFocus: () => query('.hc-alert')?.focus({ preventScroll: true }) });
    sheetFrame('home-alert');
    document.querySelectorAll('#sheet [data-hc-device]').forEach((button) => { button.onclick = () => { closeSheet(); onDeviceDetail?.(button.dataset.hcDevice); }; });
    const checkButton = sheetQuery('#hc-check-connection');
    if (checkButton) checkButton.onclick = () => checkConnections(list);
  }

  function checkConnections(list) {
    if (checking || disposed) return;
    checking = true;
    checkingIds = list.map((device) => device.id);
    const button = sheetQuery('#hc-check-connection');
    if (button) { button.disabled = true; button.textContent = '正在检查连接…'; }
    recoveryTimer = setTimeout(() => {
      checking = false;
      const recovered = [];
      checkingIds.forEach((id) => {
        const device = store.get(id);
        if (!device || device.online) return;
        const patch = { online: true };
        if (device.inputCapabilities?.length && device.readings?.length) patch.readings = device.readings.map((item) => ({ ...item, updatedAt: previewNow() }));
        const result = store.patch(id, patch);
        if (result.ok) recovered.push(device);
      });
      checkingIds = [];
      refresh();
      if (!recovered.length || disposed) return;
      const id = `connection-recovered-${previewNow()}`;
      const record = { id, experienceId: id, kind: 'connection', title: recovered.length > 1 ? `${recovered.length}台设备连接已恢复` : `${recovered[0].name}连接已恢复`, summary: '已重新收到设备信息，相关状态恢复更新；未自动重试此前未完成的控制', status: '已完成', state: 'completed', scope: 'family', label: '连接恢复', text: '连接已恢复，未重新执行历史控制', createdAt: previewNow(), updatedAt: previewNow(), at: previewNow(), deviceIds: recovered.map((device) => device.id), evidence: evidenceFor(recovered.map((device) => device.id)), steps: recovered.map((device) => ({ title: device.name, detail: device.inputCapabilities?.length ? '已收到新数据，恢复相关信息更新' : '连接已恢复，可重新发起控制', state: 'completed', status: '已确认', deviceId: device.id, at: previewNow() })), reason: '设备重新建立连接并返回状态，原连接提醒已解除', next: '如有尚未完成的服务，可从原服务卡仅重试未完成项', image: recovered[0].image };
      onService?.(record);
      onRecord?.({ ...record, state: 'past' });
      const activeSheet = document.querySelector('#sheet');
      if (visible && activeSheet?.open && activeSheet.dataset.content === 'home-alert') {
        openSheet('连接已恢复', `<div class="hc-recovered"><span class="hc-recovered-mark" aria-hidden="true">✓</span><p>${escapeHTML(record.title)}</p><span>空间状态已恢复更新，连接提醒已收起</span></div><p class="hc-mode-retain">此前未完成的安排不会自动重试，你可以从原服务卡继续</p><button class="primary-button" id="hc-recovered-done">完成</button>`, { restoreFocus: () => query('.hc-space-select')?.focus({ preventScroll: true }) });
        sheetFrame('home-alert');
        sheetQuery('#hc-recovered-done').onclick = closeSheet;
      } else toast?.(record.title);
    }, 700);
  }

  function refresh() {
    if (disposed) return;
    renderFamilyOverview();
    renderSpace();
    scenarios?.refresh();
    renderAlert();
  }

  function setPaused(value) {
    paused = Boolean(value);
    restartCarousel();
  }

  function onViewChange(view) {
    visible = !view || view === 'home';
    closePopup();
    if (visible) refresh();
    restartCarousel();
  }

  const onContainerClick = (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.matches('.hc-space-select')) {
      popupOpen = !popupOpen;
      renderSpace();
      if (popupOpen) { clearTimeout(carouselTimer); query('[data-select-space][aria-selected=true]')?.focus({ preventScroll: true }); }
      else restartCarousel();
    } else if (button.matches('[data-select-space]')) {
      selected = button.dataset.selectSpace;
      closePopup(true);
    } else if (button.matches('.hc-room-status')) onSpaceDetail?.(selected);
    else if (button.matches('.hc-alert')) openAlerts();
  };
  const onOutsidePointer = (event) => { if (popupOpen && !event.target.closest('.hc-space-picker')) closePopup(); };
  const onKeydown = (event) => {
    if (!popupOpen) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePopup(true); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const options = [...query('.hc-space-popup').querySelectorAll('button')];
      const index = options.indexOf(document.activeElement);
      options[(index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length]?.focus();
    }
  };
  const onVisibility = () => restartCarousel();
  container.addEventListener('click', onContainerClick);
  container.addEventListener('keydown', onKeydown);
  document.addEventListener('pointerdown', onOutsidePointer);
  document.addEventListener('visibilitychange', onVisibility);
  scenarios = createHomeScenarios({container, store, getRooms, getPeople, getMemories, onRemember, openSheet, toast, icon, onService, onRecord, onServiceDetail, onDeviceDetail});
  const unsubscribe = store.subscribe(refresh);
  // 初次呈现一个可定位、可恢复的来源离线状态，与设备页共用同一对象。
  const humiditySource = store.get('bathroom-humidity');
  if (humiditySource?.online) store.patch(humiditySource.id, { online: false });
  refresh();
  restartCarousel();

  return { refresh, onViewChange, setPaused, openScenario: id => scenarios.open(id), openAlerts, destroy() {
    disposed = true;
    clearTimeout(carouselTimer);
    clearTimeout(recoveryTimer);
    unsubscribe();
    scenarios.destroy();
    container.removeEventListener('click', onContainerClick);
    container.removeEventListener('keydown', onKeydown);
    document.removeEventListener('pointerdown', onOutsidePointer);
    document.removeEventListener('visibilitychange', onVisibility);
  } };
}
