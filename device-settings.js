const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const NO_ROOM = '__no_room__';

// 空间与设备位置共用首页空间及设备数据；位置编辑不会发起设备控制。
export function createDeviceSettings({ page, store, getRooms, icon, setView, openSheet, toast, onBack, onAddRoom, onEditRoom, onDeleteRoom, onRecord, getConnection }) {
  const document = page.ownerDocument;
  const sheet = document.querySelector('#sheet');
  let activeTab = 'devices';
  let disposed = false;
  let lastSignature = '';
  let editorFocusReturn = null;
  const scrollByTab = { devices: 0, spaces: 0 };
  const query = (selector) => page.querySelector(selector);
  const modalQuery = (selector) => sheet.querySelector(selector);
  const rooms = () => getRooms() || [];
  const roomName = (id) => rooms().find((room) => room.id === id)?.name || '未设置空间';
  const orderedDevices = () => store.getDevices().map((device, index) => ({ ...device, originalIndex: index })).sort((a, b) => Number(b.roomId === null) - Number(a.roomId === null) || a.originalIndex - b.originalIndex);
  const closeSheet = () => sheet.close();
  const record = (label, text) => onRecord?.({ label, text });
  const status = (device) => `<span class="ds-connection${device.online ? '' : ' is-offline'}"><i aria-hidden="true"></i>${device.online ? '在线' : '离线'}</span>`;
  const image = (device) => `<img class="ds-device-image" src="${escapeHTML(device.image)}" alt="" loading="lazy">`;

  page.classList.add('device-settings-page');
  page.setAttribute('aria-labelledby', 'device-settings-title');
  page.innerHTML = `<header class="ds-page-header"><button class="icon-button" data-settings-action="back" aria-label="返回设备页">${icon('back')}</button><h1 id="device-settings-title">空间与设备</h1></header><div class="ds-tabs" role="tablist" aria-label="管理内容"><button id="ds-tab-devices" role="tab" aria-controls="ds-content" data-settings-tab="devices" aria-selected="true">设备</button><button id="ds-tab-spaces" role="tab" aria-controls="ds-content" data-settings-tab="spaces" aria-selected="false">空间</button></div><div class="ds-content" id="ds-content" role="tabpanel" aria-labelledby="ds-tab-devices"></div><div class="ds-page-footer" aria-hidden="true"><span></span></div>`;

  function restoreFocus(key) {
    const element = key?.kind === 'device' ? [...page.querySelectorAll('[data-settings-device]')].find((item) => item.dataset.settingsDevice === key.id) : key?.kind === 'room' ? [...page.querySelectorAll('[data-settings-room]')].find((item) => item.dataset.settingsRoom === key.id) : null;
    (element || query('[data-settings-action="back"]')).focus({ preventScroll: true });
  }

  function focusDevice(id) { if (page.hidden && editorFocusReturn) editorFocusReturn(); else restoreFocus({ kind: 'device', id }); }

  function renderDevices(devices) {
    const unassigned = devices.filter((device) => device.roomId === null).length;
    return `<div class="ds-list-heading"><div><h2>已接入设备</h2><p>${devices.length} 台设备${unassigned ? ` · ${unassigned} 台未设置空间` : ' · 位置已设置'}</p></div><button class="ds-text-action" data-settings-action="batch" ${devices.length ? '' : 'disabled'}>批量分配</button></div><div class="ds-device-list">${devices.length ? devices.map((device) => `<button class="ds-device-row" data-settings-device="${escapeHTML(device.id)}" aria-label="编辑${escapeHTML(device.name)}的名称与空间">${image(device)}<span class="ds-row-copy"><strong>${escapeHTML(device.name)}</strong><small${device.roomId === null ? ' class="ds-unassigned"' : ''}>${escapeHTML(device.roomName)} · ${escapeHTML(device.source)}</small></span><span class="ds-row-end">${status(device)}${icon('chevron')}</span></button>`).join('') : '<p class="ds-empty">还没有接入设备</p>'}</div><p class="ds-location-note">位置用于按空间查看和调用设备</p>`;
  }

  function renderSpaces(devices) {
    const currentRooms = rooms();
    return `<div class="ds-list-heading"><div><h2>家庭空间</h2><p>${currentRooms.length} 个空间</p></div><button class="ds-text-action ds-add-space" data-settings-action="add-room">${icon('plus')}添加空间</button></div><div class="ds-space-list">${currentRooms.map((room) => `<div class="ds-space-row"><button class="ds-space-main" data-settings-room="${escapeHTML(room.id)}" aria-label="修改${escapeHTML(room.name)}名称"><span class="ds-room-icon" style="color:${escapeHTML(room.color || '#6d94c0')}">${icon(['master', 'second'].includes(room.id) ? 'bed' : ['living', 'bathroom', 'kitchen', 'dining'].includes(room.id) ? room.id : 'room')}</span><span class="ds-row-copy"><strong>${escapeHTML(room.name)}</strong><small>${devices.filter((device) => device.roomId === room.id).length} 台设备</small></span></button><button class="ds-room-edit" data-settings-edit-room="${escapeHTML(room.id)}" aria-label="修改${escapeHTML(room.name)}名称">${icon('edit')}</button><button class="ds-room-delete" data-settings-delete-room="${escapeHTML(room.id)}" aria-label="删除${escapeHTML(room.name)}" ${currentRooms.length <= 1 ? 'disabled' : ''}>${icon('trash')}</button></div>`).join('')}</div><p class="ds-location-note">空间修改会同步到首页和设备页${currentRooms.length <= 1 ? '<br>家庭至少保留一个空间' : ''}</p>`;
  }

  function refresh(force = false) {
    if (disposed) return;
    const devices = orderedDevices();
    const signature = JSON.stringify({ tab: activeTab, rooms: rooms().map(({ id, name, color }) => ({ id, name, color })), devices: devices.map(({ id, name, roomId, source, image, online }) => ({ id, name, roomId, source, image, online })) });
    if (!force && signature === lastSignature) return;
    const content = query('.ds-content');
    const previousScroll = content.scrollTop;
    const focused = document.activeElement;
    const focusKey = page.contains(focused) && focused.dataset.settingsDevice ? { kind: 'device', id: focused.dataset.settingsDevice } : page.contains(focused) && focused.dataset.settingsRoom ? { kind: 'room', id: focused.dataset.settingsRoom } : null;
    content.innerHTML = activeTab === 'devices' ? renderDevices(devices) : renderSpaces(devices);
    content.scrollTop = previousScroll;
    if (focusKey) restoreFocus(focusKey);
    lastSignature = signature;
  }

  function chooseTab(tab) {
    if (tab === activeTab) return;
    scrollByTab[activeTab] = query('.ds-content').scrollTop;
    activeTab = tab;
    page.querySelectorAll('[data-settings-tab]').forEach((button) => { button.setAttribute('aria-selected', String(button.dataset.settingsTab === tab)); button.tabIndex = button.dataset.settingsTab === tab ? 0 : -1; });
    query('.ds-content').setAttribute('aria-labelledby', `ds-tab-${tab}`);
    refresh(true);
    query('.ds-content').scrollTop = scrollByTab[tab];
  }

  function deviceOrNotify(id) {
    const device = store.get(id);
    if (!device) { closeSheet(); refresh(); toast('设备已移除，请重新选择'); }
    return device;
  }

  function editDevice(id) {
    const device = deviceOrNotify(id);
    if (!device) return;
    openSheet('编辑设备', `<div class="ds-modal-device">${image(device)}<div><h3>${escapeHTML(device.name)}</h3><p>${escapeHTML(device.source)} · ${escapeHTML(device.roomName)}</p>${status(device)}</div></div><div class="ds-editor-actions"><button id="ds-rename-device">${icon('edit')}<span>修改名称</span>${icon('chevron')}</button><button id="ds-move-device">${icon('room')}<span>调整空间</span><small>${escapeHTML(device.roomName)}</small>${icon('chevron')}</button><button id="ds-connection-info">${icon('detail')}<span>接入信息</span>${icon('chevron')}</button></div><div class="dialog-actions"><button class="primary-button" id="ds-editor-done">完成</button></div>`, { restoreFocus: () => focusDevice(id) });
    sheet.dataset.content = 'device-editor';
    modalQuery('#ds-rename-device').onclick = () => renameDevice(id);
    modalQuery('#ds-move-device').onclick = () => assignSingle(id);
    modalQuery('#ds-connection-info').onclick = () => showConnection(id);
    modalQuery('#ds-editor-done').onclick = closeSheet;
  }

  function showConnection(id) {
    const device = deviceOrNotify(id);
    if (!device) return;
    const account = getConnection?.(device.accountId);
    const capabilities = [...(device.inputCapabilities || []), ...(device.responseCapabilities || [])];
    const native = device.providerId === 'int';
    const connection = native ? '<div><dt>接入方式</dt><dd>引元盒子自动接入</dd></div>' : `<div><dt>所属账号</dt><dd>${escapeHTML(account ? `${account.name} · ${account.identifier}` : '账号信息暂不可用')}</dd></div><div><dt>账号连接</dt><dd>${account?.status === 'expired' ? '需要重新授权' : account ? '已连接' : '暂未获取'}</dd></div>`;
    openSheet('接入信息', `<div class="ds-assignment-summary"><strong>${escapeHTML(device.name)}</strong><span>${escapeHTML(device.roomName)}</span></div><dl class="device-info-list"><div><dt>接入来源</dt><dd>${escapeHTML(device.source)}</dd></div>${connection}<div><dt>当前支持</dt><dd>${escapeHTML(capabilities.join('、') || '基础状态')}</dd></div></dl><p class="field-hint">${native ? '无需连接品牌账号，设备状态由盒子同步' : '账号连接与设备在线状态分别更新'}</p><div class="dialog-actions"><button class="primary-button" id="ds-connection-done">返回设备设置</button></div>`, { onCancel: () => editDevice(id), restoreFocus: () => focusDevice(id) });
    sheet.dataset.content = 'device-connection';
    modalQuery('#ds-connection-done').onclick = () => editDevice(id);
  }

  function renameDevice(id) {
    const device = deviceOrNotify(id);
    if (!device) return;
    const backToEditor = () => editDevice(id);
    openSheet('修改设备名称', `<form id="ds-device-name-form" novalidate><label class="form-label" for="ds-device-name">设备名称</label><input class="text-input" id="ds-device-name" type="text" maxlength="20" value="${escapeHTML(device.name)}" autocomplete="off" aria-describedby="ds-name-error ds-name-hint"><p class="form-error" id="ds-name-error" role="alert"></p><p class="field-hint" id="ds-name-hint">最多20个字，名称会同步到设备列表</p><div class="dialog-actions"><button class="secondary-button" id="ds-name-cancel" type="button">取消</button><button class="primary-button" type="submit">保存名称</button></div></form>`, { variant: 'float', onCancel: backToEditor, initialFocus: '#ds-device-name', restoreFocus: () => focusDevice(id) });
    sheet.dataset.content = 'device-rename';
    modalQuery('#ds-name-cancel').onclick = backToEditor;
    modalQuery('#ds-device-name').oninput = () => { modalQuery('#ds-name-error').textContent = ''; modalQuery('#ds-device-name').removeAttribute('aria-invalid'); };
    modalQuery('#ds-device-name-form').onsubmit = (event) => {
      event.preventDefault();
      const input = modalQuery('#ds-device-name');
      const name = input.value.trim();
      const fail = (message) => { modalQuery('#ds-name-error').textContent = message; input.setAttribute('aria-invalid', 'true'); input.focus(); };
      if (!name) { fail('请输入设备名称'); return; }
      if (name.length > 20) { fail('设备名称最多20个字'); return; }
      const current = store.get(id);
      if (!current) { fail('设备已移除，请取消后重新选择'); return; }
      const result = store.renameDevice(id, name);
      if (!result.ok) { fail(result.message); return; }
      if (current.name !== name) record('设备名称已修改', `你将${current.name}改名为${name}，设备位置与状态保留`);
      editDevice(id);
      toast(current.name === name ? '名称未变更' : '设备名称已更新');
    };
  }

  function roomOptions(selected, name = 'ds-target-room') {
    const currentRooms = rooms();
    const devices = store.getDevices();
    return [{ id: null, name: '未设置空间', detail: '清除所选设备的位置' }, ...currentRooms.map((room) => ({ id: room.id, name: room.name, detail: `${devices.filter((device) => device.roomId === room.id).length} 台设备`, color: room.color }))].map((room) => `<label class="ds-room-option"><input type="radio" name="${name}" value="${escapeHTML(room.id ?? NO_ROOM)}" ${selected === room.id ? 'checked' : ''}><span class="ds-room-option-icon">${icon(room.id === null ? 'reset' : 'room')}</span><span><strong>${escapeHTML(room.name)}</strong><small>${escapeHTML(room.detail)}</small></span><span class="ds-choice-mark" aria-hidden="true"></span></label>`).join('');
  }

  function selectedRoom(name = 'ds-target-room') {
    const input = modalQuery(`[name="${name}"]:checked`);
    return input ? input.value === NO_ROOM ? null : input.value : undefined;
  }

  function assignSingle(id) {
    const device = deviceOrNotify(id);
    if (!device) return;
    const backToEditor = () => editDevice(id);
    openSheet('调整设备空间', `<div class="ds-assignment-summary"><strong>${escapeHTML(device.name)}</strong><span>当前位置：${escapeHTML(device.roomName)}</span></div><fieldset class="ds-room-options"><legend>设备放在哪个空间</legend>${roomOptions(device.roomId)}</fieldset><p class="form-error" id="ds-assignment-error" role="alert"></p><div class="dialog-actions"><button class="secondary-button" id="ds-single-cancel">取消</button><button class="primary-button" id="ds-single-save" disabled>保存位置</button></div>`, { onCancel: backToEditor, restoreFocus: () => focusDevice(id) });
    sheet.dataset.content = 'device-assignment';
    modalQuery('#ds-single-cancel').onclick = backToEditor;
    sheet.querySelectorAll('[name="ds-target-room"]').forEach((input) => { input.onchange = () => { modalQuery('#ds-assignment-error').textContent = ''; modalQuery('#ds-single-save').disabled = selectedRoom() === store.get(id)?.roomId; }; });
    modalQuery('#ds-single-save').onclick = () => {
      const current = store.get(id);
      const target = selectedRoom();
      const fail = (message) => { modalQuery('#ds-assignment-error').textContent = message; };
      if (!current) { fail('设备已移除，请取消后重新选择'); return; }
      if (target === undefined) { fail('请选择设备的位置'); return; }
      const result = store.assignDevices([id], target);
      if (!result.ok) { fail(result.message); return; }
      if (current.roomId !== target) record('设备位置已调整', target === null ? `你清除了${current.name}的空间位置，设备仍可查看与手动控制` : `你将${current.name}从${current.roomName}移至${roomName(target)}`);
      editDevice(id);
      toast(current.roomId === target ? '位置未变更' : result.message);
    };
  }

  function startBatch() {
    const draft = { selected: new Set(), target: undefined };
    showBatchSelection(draft);
  }

  function showBatchSelection(draft) {
    const devices = orderedDevices();
    openSheet('批量分配设备', `<div class="ds-batch-intro"><p>选择需要调整位置的设备</p><button class="ds-text-action" id="ds-select-all">${devices.length && devices.every((device) => draft.selected.has(device.id)) ? '取消全选' : '全选'}</button></div><fieldset class="ds-batch-devices"><legend class="ds-visually-hidden">选择设备</legend>${devices.map((device) => `<label class="ds-batch-device">${image(device)}<span><strong>${escapeHTML(device.name)}</strong><small>${escapeHTML(device.roomName)} · ${escapeHTML(device.source)}</small></span><input type="checkbox" name="ds-batch-device" value="${escapeHTML(device.id)}" ${draft.selected.has(device.id) ? 'checked' : ''}><span class="ds-choice-mark" aria-hidden="true"></span></label>`).join('')}</fieldset><p class="form-error" id="ds-batch-error" role="alert"></p><div class="dialog-actions"><button class="secondary-button" id="ds-batch-cancel">取消</button><button class="primary-button" id="ds-batch-next" ${draft.selected.size ? '' : 'disabled'}>选择空间${draft.selected.size ? `（${draft.selected.size}）` : ''}</button></div>`, { restoreFocus: () => query('[data-settings-action="batch"]').focus({ preventScroll: true }) });
    sheet.dataset.content = 'device-batch';
    const updateSelection = () => {
      draft.selected = new Set([...sheet.querySelectorAll('[name="ds-batch-device"]:checked')].map((input) => input.value));
      modalQuery('#ds-batch-next').disabled = !draft.selected.size;
      modalQuery('#ds-batch-next').textContent = `选择空间${draft.selected.size ? `（${draft.selected.size}）` : ''}`;
      modalQuery('#ds-select-all').textContent = devices.length && draft.selected.size === devices.length ? '取消全选' : '全选';
      modalQuery('#ds-batch-error').textContent = '';
    };
    sheet.querySelectorAll('[name="ds-batch-device"]').forEach((input) => { input.onchange = updateSelection; });
    modalQuery('#ds-select-all').onclick = () => { const all = devices.every((device) => draft.selected.has(device.id)); sheet.querySelectorAll('[name="ds-batch-device"]').forEach((input) => { input.checked = !all; }); updateSelection(); };
    modalQuery('#ds-batch-cancel').onclick = closeSheet;
    modalQuery('#ds-batch-next').onclick = () => {
      if (!draft.selected.size) return;
      if ([...draft.selected].some((id) => !store.get(id))) { modalQuery('#ds-batch-error').textContent = '部分设备已移除，请重新选择'; return; }
      showBatchDestination(draft);
    };
  }

  function showBatchDestination(draft) {
    const chosen = [...draft.selected].map((id) => store.get(id)).filter(Boolean);
    openSheet('选择设备空间', `<div class="ds-assignment-summary"><strong>已选择 ${draft.selected.size} 台设备</strong><span class="ds-chosen-names">${escapeHTML(chosen.map((device) => device.name).join('、'))}</span></div><fieldset class="ds-room-options"><legend>这些设备放在哪个空间</legend>${roomOptions(draft.target)}</fieldset><p class="form-error" id="ds-batch-error" role="alert"></p><div class="dialog-actions"><button class="secondary-button" id="ds-batch-back">返回选择</button><button class="primary-button" id="ds-batch-save" ${draft.target === undefined ? 'disabled' : ''}>保存分配</button></div>`, { restoreFocus: () => query('[data-settings-action="batch"]').focus({ preventScroll: true }) });
    sheet.dataset.content = 'device-batch-target';
    modalQuery('#ds-batch-back').onclick = () => showBatchSelection(draft);
    sheet.querySelectorAll('[name="ds-target-room"]').forEach((input) => { input.onchange = () => { draft.target = selectedRoom(); modalQuery('#ds-batch-save').disabled = draft.target === undefined; modalQuery('#ds-batch-error').textContent = ''; }; });
    modalQuery('#ds-batch-save').onclick = () => {
      const ids = [...draft.selected];
      const target = selectedRoom();
      if (target === undefined) { modalQuery('#ds-batch-error').textContent = '请选择设备的位置'; return; }
      const previous = ids.map((id) => store.get(id));
      if (previous.some((device) => !device)) { modalQuery('#ds-batch-error').textContent = '部分设备已移除，请返回重新选择'; return; }
      const result = store.assignDevices(ids, target);
      if (!result.ok) { modalQuery('#ds-batch-error').textContent = result.message; return; }
      const count = previous.filter((device) => device.roomId !== target).length;
      if (count) record('设备位置已批量调整', target === null ? `你清除了${count}台设备的空间位置，设备仍可查看与手动控制` : `你将${count}台设备的位置设为${roomName(target)}`);
      closeSheet();
      toast(count ? target === null ? `已清除 ${count} 台设备的位置` : `已将 ${count} 台设备分配至${roomName(target)}` : '所选设备已在这个位置');
    };
  }

  function handleClick(event) {
    const button = event.target.closest('button');
    if (!button || !page.contains(button) || button.disabled) return;
    if (button.dataset.settingsTab) { chooseTab(button.dataset.settingsTab); return; }
    if (button.dataset.settingsDevice) { editDevice(button.dataset.settingsDevice); return; }
    if (button.dataset.settingsRoom || button.dataset.settingsEditRoom) { onEditRoom?.(button.dataset.settingsRoom || button.dataset.settingsEditRoom); return; }
    if (button.dataset.settingsDeleteRoom) { onDeleteRoom?.(button.dataset.settingsDeleteRoom); return; }
    if (button.dataset.settingsAction === 'back') { scrollByTab[activeTab] = query('.ds-content').scrollTop; onBack?.(); }
    if (button.dataset.settingsAction === 'batch') startBatch();
    if (button.dataset.settingsAction === 'add-room') onAddRoom?.();
  }

  function handleTabKeys(event) {
    const button = event.target.closest('[data-settings-tab]');
    if (!button || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tab = event.key === 'Home' ? 'devices' : event.key === 'End' ? 'spaces' : activeTab === 'devices' ? 'spaces' : 'devices';
    chooseTab(tab);
    query(`[data-settings-tab="${tab}"]`).focus({ preventScroll: true });
  }

  page.addEventListener('click', handleClick);
  page.addEventListener('keydown', handleTabKeys);
  query('[data-settings-tab="spaces"]').tabIndex = -1;
  const unsubscribe = store.subscribe(() => refresh());
  refresh(true);

  return {
    open() { if (disposed) return; editorFocusReturn = null; setView('device-settings'); refresh(); query('.ds-content').scrollTop = scrollByTab[activeTab]; query('[data-settings-action="back"]').focus({ preventScroll: true }); },
    refresh,
    editDevice(id, { restoreFocus = null } = {}) { editorFocusReturn = restoreFocus; editDevice(id); },
    onViewChange(nextView) { if (!page.hidden && nextView !== 'device-settings') scrollByTab[activeTab] = query('.ds-content').scrollTop; },
    destroy() { disposed = true; unsubscribe(); page.removeEventListener('click', handleClick); page.removeEventListener('keydown', handleTabKeys); },
  };
}
