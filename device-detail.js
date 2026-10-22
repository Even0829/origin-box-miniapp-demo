import { formatDeviceReading as readingText } from './device-readings.js?v=source-data-20261019';

const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const timeFormat = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' });
const dateFormat = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Shanghai' });
const timeText = (value) => Number.isFinite(Number(value)) && Number(value) > 0 ? timeFormat.format(new Date(Number(value))) : '等待更新';
const fullTime = (value) => Number.isFinite(Number(value)) && Number(value) > 0 ? `${dateFormat.format(new Date(Number(value)))} ${timeText(value)}` : '等待更新';
const numberText = (value) => typeof value === 'number' ? String(Number(value.toFixed(1))) : String(value ?? '—');

function glyph(name) {
  const paths = {
    back: '<path d="m14.5 5-7 7 7 7"/>',
    gear: '<path d="m9.1 3.5.5-1h4.8l.5 1 .6 1.6 1.6.9 1.7-.3 1.1.1 2.4 4.2-.5.9-1.1 1.3v1.8l1.1 1.3.5.9-2.4 4.2-1.1.1-1.7-.3-1.6.9-.6 1.6-.5 1H9.6l-.5-1-.6-1.6-1.6-.9-1.7.3-1.1-.1-2.4-4.2.5-.9 1.1-1.3v-1.8L2.2 11l-.5-.9 2.4-4.2 1.1-.1 1.7.3 1.6-.9.6-1.7Z" transform="translate(1.6 1.5) scale(.86)"/><circle cx="12" cy="12" r="3.1"/>',
    power: '<path d="M12 3v9M6.3 5.8a8 8 0 1 0 11.4 0"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    room: '<path d="m4 10 8-6 8 6v10H4V10ZM9 20v-7h6v7"/>',
    sensing: '<circle cx="12" cy="12" r="2"/><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    presence: '<circle cx="12" cy="7" r="3"/><path d="M6 20v-3a6 6 0 0 1 12 0v3M3 8a10 10 0 0 0 0 8M21 8a10 10 0 0 1 0 8"/>',
    empty: '<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>',
    device: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 7h6M9 11h6"/><circle cx="12" cy="17" r="1"/>',
    auto: '<path d="M5 9a7 7 0 0 1 12-3l2 2M19 4v4h-4M19 15a7 7 0 0 1-12 3l-2-2M5 20v-4h4"/>',
    standard: '<path d="M5 6h14M5 12h14M5 18h14"/><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="10" cy="18" r="2" fill="currentColor" stroke="none"/>',
    sleep: '<path d="M19.5 14A8 8 0 0 1 10 4.5 8 8 0 1 0 19.5 14Z"/>',
    minus: '<path d="M5 12h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    cool: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9 5l3 3 3-3M9 19l3-3 3 3M4.5 10.5l4.1-1.1L7.5 5.3M16.5 18.7l-1.1-4.1 4.1-1.1M4.5 13.5l4.1 1.1-1.1 4.1M16.5 5.3l-1.1 4.1 4.1 1.1"/>',
    heat: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    dry: '<path d="M12 3c-2.6 3.7-6 7.5-6 11a6 6 0 0 0 12 0c0-3.5-3.4-7.3-6-11Z"/><path d="M9 14a3 3 0 0 0 3 3"/>',
    fan: '<circle cx="12" cy="12" r="2"/><path d="M10.2 10.5C6.1 6.5 9.5 2.4 12 4.7c1.7 1.6 1.4 3.7.8 5.5M14 11.5c5.5-1.6 7.4 3.4 4.2 4.5-2.2.8-3.8-.5-5-2M11.5 14c-1.4 5.5-6.8 4.6-6.1 1.3.5-2.2 2.4-3 4.4-3.2"/>',
  };
  return `<svg class="dd-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.sensing}</svg>`;
}

// 设备详情只呈现已接入的能力；控制结果由共享设备数据中的回执确认。
export function createDeviceDetail({ page, store, connections, getRooms, setView, openSheet, toast, icon, onBack, onSettings }) {
  const document = page.ownerDocument;
  const sheet = document.querySelector('#sheet');
  const e = escapeHTML;
  let deviceId = null;
  let visible = false;
  let disposed = false;
  let trendKey = 'temperature';
  let lastSignature = '';
  let draggingKey = null;
  let renderQueued = false;
  let sheetKind = null;
  let modeDraft = null;
  let controlFocus = null;
  const stepperDrafts = new Map();
  const stepperDraftKey = (id, key) => JSON.stringify([id, key]);
  const query = (selector) => page.querySelector(selector);
  const findControl = (key, option, direction) => [...page.querySelectorAll('[data-dd-control]')].find((element) => element.dataset.ddControl === key && (option === undefined || element.dataset.ddOption === option) && (direction === undefined || element.dataset.ddDirection === direction));
  const sheetQuery = (selector) => sheet?.querySelector(selector);
  const roomName = (device) => getRooms?.().find((room) => room.id === device.roomId)?.name || device.roomName || '未设置空间';
  const accountExpired = (device) => connections?.getAccount?.(device.accountId)?.status === 'expired';
  const closeSheet = () => sheet?.close();
  const focusAction = (action) => { if (visible) query(`[data-dd-action="${action}"]`)?.focus({ preventScroll: true }); };

  page.classList.add('dd-page');
  page.setAttribute('aria-labelledby', 'dd-device-title');
  page.innerHTML = `<header class="dd-header"><button class="dd-back icon-button" data-dd-action="back" aria-label="返回设备列表">${glyph('back')}</button><h1 class="dd-heading" id="dd-device-title">设备详情</h1><button class="dd-settings icon-button" id="dd-settings" data-dd-action="settings" aria-label="设备设置">${glyph('gear')}</button></header><main class="dd-scroll"></main><div class="dd-home-indicator" aria-hidden="true"><span></span></div>`;

  function currentControls(device) {
    return (store.getControls?.(device.id) || []).map((control) => ({ ...control, disabled: Boolean(control.disabled || !device.online || accountExpired(device) || device.pending) }));
  }

  function pendingValue(device, key) {
    if (!device.pending) return undefined;
    if (device.pending.target && typeof device.pending.target === 'object') return device.pending.target[key];
    return device.pending.kind === key ? key === 'power' ? device.pending.desired : device.pending.target ?? device.pending.desired : undefined;
  }

  function valueText(control, value) {
    if (control.type === 'toggle') return value ? '开启' : '关闭';
    if (control.type === 'select') return control.options?.find((option) => option.value === value)?.label || numberText(value);
    return `${numberText(value)}${control.unit || ''}`;
  }

  function capabilityDescription(device) {
    const labels = { '温湿度': '温湿度信息', '在场': '在场信息', '照明': '照明', '亮度': '亮度调节', '色温': '色温调节', '净化': '空气净化', '净化模式': '净化模式调节', '开关': '开关控制' };
    const capabilities = [...new Set([...(device.inputCapabilities || []), ...(device.responseCapabilities || [])])];
    if (!capabilities.length && typeof device.power === 'boolean') return '开关控制';
    return capabilities.map((capability) => labels[capability] || capability).join('、') || '设备状态信息';
  }

  function renderIdentity(device) {
    const expired = accountExpired(device);
    const health = expired ? '账号授权失效' : device.online ? '在线' : '离线';
    const state = expired ? ' is-expired' : device.online ? '' : ' is-offline';
    const supportNote = device.supportNote || device.partial || (device.partiallySupported ? `当前接入支持${capabilityDescription(device)}` : '');
    const source = !device.source || ['unknown', 'unavailable'].includes(String(device.source).toLowerCase()) ? '已接入设备' : device.source;
    return `<section class="dd-identity" aria-label="设备信息"><div class="dd-product-image">${device.image ? `<img src="${e(device.image)}" alt="${e(device.name || '设备')}">` : `<span class="dd-product-placeholder">${glyph('device')}</span>`}</div><div class="dd-identity-copy"><div class="dd-meta"><span class="dd-health${state}">${health}</span><span class="dd-meta-space">${e(roomName(device))}</span><span class="dd-meta-source">${e(source)}</span></div><p class="dd-updated">${device.updatedAt ? `${device.online ? '更新于' : '最后更新'} ${fullTime(device.updatedAt)}` : '等待设备更新'}</p></div></section>${expired ? '<p class="dd-notice is-warning">账号授权已失效，重新连接后可继续查看和控制</p>' : !device.online ? `<p class="dd-notice is-warning">${device.updatedAt ? '设备离线，以下为最后确认的信息' : '设备离线，连接恢复后将继续更新'}</p>` : ''}${supportNote ? `<p class="dd-notice">${e(supportNote)}</p>` : ''}`;
  }

  function renderToggle(device, control) {
    const desired = pendingValue(device, control.key);
    const pending = desired !== undefined;
    const status = pending ? `当前${control.value ? '开启' : '关闭'} · 等待${desired ? '开启' : '关闭'}反馈` : control.value ? '已开启' : '已关闭';
    return `<div class="dd-power-row"><div class="dd-power-copy"><span>${e(control.label || '电源')}</span><strong>${status}</strong></div><button class="dd-power-button${control.value ? ' is-on' : ''}${pending ? ' is-pending' : ''}" role="switch" data-dd-control="${e(control.key)}" data-dd-type="toggle" aria-checked="${Boolean(control.value)}" aria-label="${e(device.name)}${e(control.label || '电源')}" ${control.disabled ? 'disabled' : ''}><span class="dd-power-knob" aria-hidden="true"></span></button></div>`;
  }

  function renderRange(device, control) {
    const target = pendingValue(device, control.key);
    const min = Number(control.min ?? 0), max = Number(control.max ?? 100);
    const value = Number(control.value ?? min);
    const percentage = ((value - min) / (max - min || 1)) * 100;
    const tone = control.tone === 'temperature' || control.key === 'colorTemperature' ? 'temperature' : control.tone === 'brightness' || ['level', 'brightness'].includes(control.key) ? 'brightness' : 'default';
    const message = target !== undefined ? `当前 ${valueText(control, value)} · 目标 ${valueText(control, target)}，等待反馈` : accountExpired(device) ? '账号授权已失效，重新连接后可调节' : !device.online ? '设备离线，连接恢复后可调节' : device.pending ? '' : control.disabledReason && control.disabledReason !== '请先开启设备' ? control.disabledReason : !device.power && typeof device.power === 'boolean' ? '开启后可调节，当前设定会保留' : control.disabledReason || '';
    return `<div class="dd-range-block${tone === 'temperature' ? ' is-temperature' : ''}" data-tone="${tone}"><div class="dd-range-top"><label for="dd-range-${e(control.key)}">${e(control.label)}</label><span class="dd-range-value" data-dd-value="${e(control.key)}">${e(valueText(control, value))}</span></div><input class="dd-range" id="dd-range-${e(control.key)}" type="range" min="${min}" max="${max}" step="${Number(control.step || 1)}" value="${value}" style="--dd-progress:${percentage}%" data-tone="${tone}" data-dd-control="${e(control.key)}" data-dd-type="range" aria-valuetext="${e(valueText(control, value))}" aria-describedby="dd-note-${e(control.key)}" ${control.disabled ? 'disabled' : ''}><div class="dd-range-endpoints"><span>${tone === 'temperature' ? '暖光 ' : ''}${e(valueText(control, min))}</span><span>${tone === 'temperature' ? '冷光 ' : ''}${e(valueText(control, max))}</span></div><p class="dd-control-note" id="dd-note-${e(control.key)}" data-dd-note="${e(control.key)}">${e(message)}</p></div>`;
  }

  function renderStepper(device, control) {
    const min = Number(control.min ?? 0), max = Number(control.max ?? 100);
    const target = pendingValue(device, control.key);
    const draft = stepperDrafts.get(stepperDraftKey(device.id, control.key));
    const value = draft?.value ?? target ?? control.value;
    const note = target !== undefined ? `当前设定 ${valueText(control, control.value)} · 目标 ${valueText(control, target)}，等待反馈` : draft ? `当前设定 ${valueText(control, control.value)} · 目标 ${valueText(control, draft.value)}，待提交` : accountExpired(device) ? '账号授权已失效' : !device.online ? '设备离线，连接恢复后可调节' : device.pending ? '' : control.disabledReason || '';
    return `<div class="dd-stepper-block"><div class="dd-range-top"><label>${e(control.label)}</label></div><div class="dd-stepper"><button class="dd-stepper-minus" data-dd-control="${e(control.key)}" data-dd-type="stepper" data-dd-direction="-1" aria-label="降低${e(control.label)}" aria-disabled="${Number(value) <= min}" ${control.disabled ? 'disabled' : ''}>${glyph('minus')}</button><div class="dd-stepper-value" data-dd-stepper-value="${e(control.key)}"><strong>${e(numberText(value))}</strong><small>${e(control.unit)}</small></div><button class="dd-stepper-plus" data-dd-control="${e(control.key)}" data-dd-type="stepper" data-dd-direction="1" aria-label="提高${e(control.label)}" aria-disabled="${Number(value) >= max}" ${control.disabled ? 'disabled' : ''}>${glyph('plus')}</button></div><p class="dd-stepper-note dd-control-note" data-dd-note="${e(control.key)}">${e(note)}</p></div>`;
  }

  function renderSelect(device, control) {
    const options = control.options || [], target = pendingValue(device, control.key);
    const note = target !== undefined ? `当前${valueText(control, control.value)} · 目标${valueText(control, target)}，等待反馈` : accountExpired(device) ? '账号授权已失效，重新连接后可选择模式' : !device.online ? '设备离线，连接恢复后可选择模式' : control.disabledReason || '';
    const inline = control.layout !== 'half' && (options.length <= 3 || control.presentation === 'icon-grid');
    return `<div class="dd-mode-block"><label>${e(control.label)}</label>${inline ? `<div class="dd-mode-options${control.presentation === 'icon-grid' ? ' is-icon-grid' : ''}" role="group" aria-label="${e(control.label)}">${options.map((option) => `<button class="dd-mode-option${option.value === control.value ? ' is-selected' : ''}" data-mode="${e(option.value)}" data-dd-control="${e(control.key)}" data-dd-type="select" data-dd-option="${e(option.value)}" aria-pressed="${option.value === control.value}" ${control.disabled ? 'disabled' : ''}>${modeGlyph(option)}<span>${e(option.label)}</span></button>`).join('')}</div>` : `<button class="dd-mode-trigger" data-dd-action="mode" data-dd-key="${e(control.key)}" aria-label="选择${e(control.label)}，当前${e(valueText(control, control.value))}" ${control.disabled ? 'disabled' : ''}><span>${e(valueText(control, control.value))}</span>${glyph('chevron')}</button>`}${note ? `<p class="dd-control-note">${e(note)}</p>` : ''}</div>`;
  }

  function modeGlyph(option) {
    const name = String(option.label || option.value).toLowerCase();
    const known = { '自动': 'auto', auto: 'auto', '标准': 'standard', standard: 'standard', '睡眠': 'sleep', sleep: 'sleep', '制冷': 'cool', cool: 'cool', '制热': 'heat', heat: 'heat', '除湿': 'dry', dry: 'dry', '送风': 'fan', fan: 'fan' };
    return known[name] ? glyph(known[name]) : '';
  }

  function renderCompactReadings(device) {
    const readings = device.readings || [];
    if (!readings.length) return '';
    return `<section class="dd-compact-metrics" aria-label="设备感知指标"><div class="dd-compact-metrics-row">${readings.slice(0, 2).map((reading) => `<div class="dd-compact-metric" data-key="${e(reading.key)}"><span>${e(reading.label)}</span><strong>${e(readingText(reading))}</strong></div>`).join('')}</div>${readings.length > 2 ? '<button class="dd-text-button" data-dd-action="metrics">全部指标' + glyph('chevron') + '</button>' : ''}</section>`;
  }

  function renderControls(device, controls) {
    const renderers = { toggle: renderToggle, range: (value, control) => control.presentation === 'stepper' ? renderStepper(value, control) : renderRange(value, control), select: renderSelect };
    const supported = controls.filter((control) => renderers[control.type]);
    const modules = [];
    for (let index = 0; index < supported.length; index += 1) {
      const control = supported[index];
      if (control.layout === 'half' && control.group) {
        const grouped = [control];
        while (supported[index + 1]?.layout === 'half' && supported[index + 1]?.group === control.group) grouped.push(supported[++index]);
        const content = grouped.map((entry) => renderers[entry.type](device, entry)).join('');
        modules.push(grouped.length > 1 ? `<div class="dd-control-row">${content}</div>` : content);
      } else modules.push(renderers[control.type](device, control));
    }
    if (!modules.length) return renderReadings(device);
    return `${renderCompactReadings(device)}<section class="dd-control-card${modules.length > 2 ? ' is-multi-control' : ''}" aria-label="设备控制" aria-busy="${Boolean(device.pending)}">${modules.join('')}</section>`;
  }

  function renderReadings(device) {
    const readings = device.readings || [];
    if (!readings.length) return device.online ? '<p class="dd-notice">尚未收到设备信息，收到后会自动更新</p>' : '';
    if (device.type === 'presence') {
      const presence = readings.find((reading) => reading.key === 'presence');
      const valid = typeof presence?.value === 'boolean';
      return `<section class="dd-presence${valid && presence.value ? ' is-present' : ''}" aria-label="在场信息"><div class="dd-presence-symbol">${glyph(valid && presence.value ? 'presence' : 'empty')}</div><strong>${valid ? presence.value ? '检测到人在场' : '暂未检测到人在场' : '等待在场信息'}</strong><p>${valid ? `${device.online ? '更新于' : '最后感知于'} ${fullTime(presence.updatedAt || device.updatedAt)}` : '连接恢复后将继续感知'}</p></section>`;
    }
    return `<section class="dd-metrics" aria-label="设备读数">${readings.map((reading) => `<div class="dd-metric${Number.isFinite(reading.value) ? '' : ' is-text'}" data-key="${e(reading.key)}"><span>${e(reading.label)}</span><strong>${e(Number.isFinite(reading.value) ? numberText(reading.value) : readingText(reading))}<small>${Number.isFinite(reading.value) ? e(reading.unit) : ''}</small></strong><small>${device.online ? '当前读数' : '最后读数'}</small></div>`).join('')}</section>`;
  }

  function executionFor(device) {
    const execution = store.getExecution?.(device.roomId);
    return execution?.devices?.some((item) => item.id === device.id) ? execution : null;
  }

  function renderContext(device, execution) {
    if (execution) {
      const item = execution.devices.find((entry) => entry.id === device.id);
      const ended = ['completed', 'confirmed', 'cancelled', 'failed'].includes(execution.status);
      return `<section class="dd-context"><div class="dd-context-top"><span class="dd-context-label">${ended ? '最近参与' : '正在参与'}</span><button class="dd-text-button" data-dd-action="execution">查看进展${glyph('chevron')}</button></div><h3 class="dd-context-title">${e(execution.title)}</h3><p class="dd-context-copy">${e(execution.target)}</p><div class="dd-execution-row"><span>${e(item.name)}</span><strong>${e(item.feedback || (item.status === 'confirmed' ? '已确认' : '等待反馈'))}</strong></div></section>`;
    }
    const meaning = capabilityDescription(device);
    const availability = !device.online ? '连接恢复后，' : accountExpired(device) ? '账号重新连接后，' : '';
    return `<div class="dd-capability">${glyph('sensing')}<p>${availability}${device.roomId ? `可为${e(roomName(device))}提供${e(meaning)}` : `可提供${e(meaning)}，设置空间后可按位置调用`}</p></div>`;
  }

  function chartMarkup(trend) {
    const points = (trend.points || []).filter((point) => Number.isFinite(point.value) && Number.isFinite(Number(point.at))).sort((a, b) => a.at - b.at);
    if (points.length < 2) return '<p class="dd-trend-empty">历史数据还在积累中</p>';
    const low = Math.min(...points.map((point) => point.value)), high = Math.max(...points.map((point) => point.value));
    const margin = Math.max((high - low) * 0.3, trend.unit === '%' ? 2 : 0.5);
    const bottom = Math.floor((low - margin) * 10) / 10, top = Math.ceil((high + margin) * 10) / 10;
    const width = 334, height = 128, left = 30, right = 10, startY = 14, endY = 104;
    const first = Number(points[0].at), last = Number(points.at(-1).at);
    const coords = points.map((point) => [left + (Number(point.at) - first) / (last - first || 1) * (width - left - right), endY - (point.value - bottom) / (top - bottom || 1) * (endY - startY)]);
    const line = coords.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
    const area = `${line} L${coords.at(-1)[0].toFixed(2)} ${endY} L${coords[0][0].toFixed(2)} ${endY}Z`;
    const levels = [top, (top + bottom) / 2, bottom];
    return `<svg class="dd-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="过去24小时${e(trend.label)}趋势，最低${numberText(low)}${e(trend.unit)}，最高${numberText(high)}${e(trend.unit)}">${levels.map((value, index) => { const y = startY + (endY - startY) * index / 2; return `<line class="dd-chart-grid" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"/><text class="dd-chart-label" x="0" y="${y + 3}">${numberText(value)}</text>`; }).join('')}<path class="dd-chart-area" d="${area}"/><path class="dd-chart-line" d="${line}" fill="none"/><circle class="dd-chart-end" cx="${coords.at(-1)[0]}" cy="${coords.at(-1)[1]}" r="3.5"/></svg><div class="dd-chart-times"><span>${fullTime(first)}</span><span>${timeText((first + last) / 2)}</span><span>${timeText(last)}</span></div>`;
  }

  function renderTrend(device) {
    const keys = (device.readings || []).filter((reading) => Number.isFinite(reading.value)).map((reading) => reading.key);
    if (!keys.length || !store.getTrend) return '';
    if (!keys.includes(trendKey)) trendKey = keys[0];
    const trend = store.getTrend(device.id, trendKey, '24h');
    if (!trend) return '';
    const points = trend.points || [];
    return `<section class="dd-section dd-trend" data-metric="${e(trendKey)}" data-key="${e(trendKey)}"><div class="dd-section-heading"><h2>变化趋势</h2><span>近24小时</span></div>${keys.length > 1 ? `<div class="dd-trend-tabs" role="tablist" aria-label="趋势指标">${keys.map((key) => `<button class="dd-trend-tab${key === trendKey ? ' is-selected' : ''}" role="tab" aria-selected="${key === trendKey}" tabindex="${key === trendKey ? 0 : -1}" data-dd-trend="${e(key)}">${e(device.readings.find((reading) => reading.key === key)?.label || key)}</button>`).join('')}</div>` : ''}<div class="dd-trend-summary"><strong>${points.length ? `${e(numberText(Math.min(...points.map((point) => point.value))))}–${e(numberText(Math.max(...points.map((point) => point.value))))}<small>${e(trend.unit)}</small>` : '—'}</strong><span>最低至最高</span></div>${chartMarkup(trend)}</section>`;
  }

  function historyEntries() {
    return (store.getHistory?.(deviceId) || []).slice().sort((a, b) => Number(b.at) - Number(a.at));
  }

  function historyMarkup(entries, full = false) {
    return `<div class="dd-history-list${full ? ' dd-full-history' : ''}">${entries.map((entry) => `<article class="dd-history-item"><i class="dd-history-dot${entry.status === 'failed' || entry.status === 'unconfirmed' ? ' is-warning' : ''}" aria-hidden="true"></i><div class="dd-history-copy"><strong>${e(entry.title)}</strong>${entry.detail ? `<p>${e(entry.detail)}</p>` : ''}<time datetime="${new Date(entry.at).toISOString()}">${fullTime(entry.at)}${entry.source ? ` · ${e(entry.source)}` : ''}</time></div></article>`).join('')}</div>`;
  }

  function renderHistory() {
    const entries = historyEntries();
    return `<section class="dd-section dd-history"><div class="dd-section-heading"><h2>最近动态</h2>${entries.length ? '<button class="dd-text-button" data-dd-action="history">查看全部' + glyph('chevron') + '</button>' : ''}</div>${entries.length ? historyMarkup(entries.slice(0, 3)) : '<p class="dd-history-empty">还没有新的设备动态</p>'}</section>`;
  }

  function refresh(force = false) {
    if (disposed || !deviceId) return;
    if (draggingKey) { renderQueued = true; return; }
    const device = store.get(deviceId);
    if (!device) { if (visible) { toast('设备已移除'); back(); } return; }
    const controls = currentControls(device), execution = executionFor(device), history = historyEntries();
    const signature = JSON.stringify({ device, controls, execution, history, trendKey, expired: accountExpired(device) });
    if (!force && lastSignature === signature) return;
    const scroll = query('.dd-scroll'), top = scroll.scrollTop;
    const focused = document.activeElement;
    const ownFocus = page.contains(focused);
    const continuesControl = controlFocus && visible && controlFocus.deviceId === deviceId && !sheet?.open && (focused === controlFocus.anchor || focused.dataset?.ddControl === controlFocus.key && (controlFocus.option === undefined || focused.dataset.ddOption === controlFocus.option) && (controlFocus.direction === undefined || focused.dataset.ddDirection === controlFocus.direction));
    if (controlFocus && !continuesControl) controlFocus = null;
    const focusKey = ownFocus ? focused.dataset.ddControl ? ['control', focused.dataset.ddControl, focused.dataset.ddOption, focused.dataset.ddDirection] : focused.dataset.ddTrend ? ['trend', focused.dataset.ddTrend] : focused.dataset.ddAction ? ['action', focused.dataset.ddAction, focused.dataset.ddKey] : null : null;
    query('.dd-heading').textContent = device.name;
    page.dataset.deviceType = device.type || 'device';
    query('[data-dd-action="settings"]').setAttribute('aria-label', `${device.name}设置`);
    scroll.innerHTML = `${renderIdentity(device)}${renderControls(device, controls)}${renderContext(device, execution)}${renderTrend(device)}${renderHistory()}`;
    scroll.scrollTop = top;
    lastSignature = signature;
    if (continuesControl && controlFocus) {
      if (device.pending) {
        // 禁用控件不能接收焦点；等待期间临时停在同一控制区，回执后接续操作。
        const anchor = query('.dd-control-card');
        if (anchor) {
          anchor.tabIndex = -1;
          anchor.style.outline = 'none';
          controlFocus.anchor = anchor;
          anchor.focus({ preventScroll: true });
        } else controlFocus = null;
      } else {
        const previousControl = controlFocus;
        controlFocus = null;
        const target = findControl(previousControl.key, previousControl.option, previousControl.direction);
        if (target && !target.disabled) target.focus({ preventScroll: true });
      }
    } else if (ownFocus && visible && focusKey) {
      const selected = focusKey[0] === 'control' ? findControl(focusKey[1], focusKey[2], focusKey[3]) : focusKey[0] === 'trend' ? [...page.querySelectorAll('[data-dd-trend]')].find((element) => element.dataset.ddTrend === focusKey[1]) : [...page.querySelectorAll('[data-dd-action]')].find((element) => element.dataset.ddAction === focusKey[1] && (focusKey[2] === undefined || element.dataset.ddKey === focusKey[2]));
      selected?.focus({ preventScroll: true });
    }
    if (sheet?.open && sheetKind === 'history' && sheet.dataset.content === 'device-detail-history') {
      const target = sheetQuery('.dd-sheet-history-content');
      if (target) target.innerHTML = historyMarkup(history, true);
    }
    if (sheet?.open && sheetKind === 'execution' && sheet.dataset.content === 'device-detail-execution') {
      const target = sheetQuery('.dd-sheet-execution-content');
      if (target) target.innerHTML = executionMarkup(device, execution);
    }
    if (sheet?.open && sheetKind === 'metrics' && sheet.dataset.content === 'device-detail-metrics') {
      const target = sheetQuery('.dd-all-metrics-list');
      if (target) target.innerHTML = allMetricsMarkup(device);
    }
  }

  async function requestControl(key, value, id = deviceId) {
    const device = store.get(id);
    const control = currentControls(device || {}).find((item) => item.key === key);
    if (!device || !control || control.disabled) { refresh(true); return; }
    const focused = document.activeElement;
    const focusRequest = visible && id === deviceId && page.contains(focused) && focused.dataset.ddControl === key ? { deviceId: id, key, option: focused.dataset.ddOption, direction: focused.dataset.ddDirection, anchor: null } : null;
    if (id === deviceId) controlFocus = focusRequest;
    let result;
    try { result = await store.requestControl(id, { [key]: value }); }
    catch { result = { ok: false, message: '暂未确认设备状态，请稍后重试' }; }
    if (!disposed && visible && id === deviceId) {
      // 未产生pending的同值/校验请求不需要改变焦点。
      if (controlFocus === focusRequest && !store.get(id)?.pending && !focusRequest?.anchor) controlFocus = null;
      refresh();
      if (!result?.ok) toast(result?.message || '暂未确认设备状态');
    }
  }

  function commitStepperDraft(draft) {
    draft.timer = null;
    if (disposed) return;
    const device = store.get(draft.deviceId);
    if (device?.pending) { draft.timer = setTimeout(() => commitStepperDraft(draft), 150); return; }
    stepperDrafts.delete(stepperDraftKey(draft.deviceId, draft.key));
    const control = device && currentControls(device).find((entry) => entry.key === draft.key);
    if (!control || control.disabled) { if (visible && deviceId === draft.deviceId) refresh(true); return; }
    requestControl(draft.key, draft.value, draft.deviceId).then(() => { if (!disposed && visible && deviceId === draft.deviceId) refresh(true); });
  }

  function adjustStepper(button) {
    const device = store.get(deviceId);
    const control = device && currentControls(device).find((entry) => entry.key === button.dataset.ddControl);
    if (!control || control.disabled) return;
    const draftKey = stepperDraftKey(device.id, control.key);
    const previous = stepperDrafts.get(draftKey);
    const min = Number(control.min ?? 0), max = Number(control.max ?? 100), step = Number(control.step || 1);
    const value = Math.max(min, Math.min(max, Number((Number(previous?.value ?? control.value) + Number(button.dataset.ddDirection) * step).toFixed(4))));
    if (value === Number(previous?.value ?? control.value)) return;
    if (previous?.timer) clearTimeout(previous.timer);
    const draft = { deviceId: device.id, key: control.key, value, timer: null };
    stepperDrafts.set(draftKey, draft);
    query(`[data-dd-stepper-value="${control.key}"] strong`).textContent = numberText(value);
    query(`[data-dd-note="${control.key}"]`).textContent = `当前设定 ${valueText(control, control.value)} · 目标 ${valueText(control, value)}，待提交`;
    for (const element of page.querySelectorAll('[data-dd-type="stepper"]')) if (element.dataset.ddControl === control.key) element.setAttribute('aria-disabled', String(Number(element.dataset.ddDirection) < 0 ? value <= min : value >= max));
    draft.timer = setTimeout(() => commitStepperDraft(draft), 350);
  }

  function showHistory() {
    const device = store.get(deviceId);
    if (!device) return;
    sheetKind = 'history';
    openSheet('设备动态', `<div class="dd-sheet-body"><p class="dd-sheet-device">${e(device.name)} · ${e(roomName(device))}</p><div class="dd-sheet-history-content">${historyMarkup(historyEntries(), true)}</div></div>`, { restoreFocus: () => focusAction('history') });
    sheet.dataset.content = 'device-detail-history';
  }

  function allMetricsMarkup(device) {
    return (device.readings || []).map((reading) => `<div class="dd-all-metric" data-key="${e(reading.key)}"><span>${e(reading.label)}</span><strong>${e(readingText(reading))}</strong><small>${device.online ? '更新于' : '最后读数'} ${fullTime(reading.updatedAt || device.updatedAt)}</small></div>`).join('');
  }

  function showMetrics() {
    const device = store.get(deviceId);
    if (!device || !device.readings?.length) return;
    sheetKind = 'metrics';
    openSheet('全部指标', `<div class="dd-sheet-body"><p class="dd-sheet-device">${e(device.name)} · ${e(roomName(device))}</p><div class="dd-all-metrics-list">${allMetricsMarkup(device)}</div></div>`, { restoreFocus: () => focusAction('metrics') });
    sheet.dataset.content = 'device-detail-metrics';
  }

  function executionMarkup(device, execution) {
    if (!execution) return '<p class="dd-notice">本次设备调节已结束，最新状态已同步</p>';
    const item = execution.devices.find((entry) => entry.id === device.id);
    const status = item?.status === 'confirmed' ? '已确认' : item?.status === 'failed' ? '暂未确认' : '等待设备反馈';
    return `<span class="dd-context-label">${e(roomName(device))}</span><h3 class="dd-sheet-execution-title">${e(execution.title)}</h3><p class="dd-context-copy">${e(execution.target)}</p><div class="dd-execution-steps"><div><span>设备</span><strong>${e(device.name)}</strong></div><div><span>当前亮度</span><strong>${e(numberText(device.level ?? item?.current))}%</strong></div><div><span>目标亮度</span><strong>${e(numberText(item?.target))}%</strong></div><div><span>执行反馈</span><strong>${e(item?.feedback || status)}</strong></div></div><p class="dd-control-note">${item?.status === 'confirmed' ? '设备已返回状态反馈' : '以设备返回的状态确认本次调节结果'}</p>`;
  }

  function showExecution() {
    const device = store.get(deviceId);
    if (!device) return;
    sheetKind = 'execution';
    openSheet('设备参与进展', `<div class="dd-sheet-body dd-sheet-execution-content">${executionMarkup(device, executionFor(device))}</div><div class="dialog-actions"><button class="primary-button" id="dd-execution-done">完成</button></div>`, { restoreFocus: () => focusAction('execution') });
    sheet.dataset.content = 'device-detail-execution';
    sheetQuery('#dd-execution-done').onclick = closeSheet;
  }

  function showModes(key) {
    const device = store.get(deviceId);
    const control = currentControls(device).find((entry) => entry.key === key);
    if (!control || control.disabled) return;
    modeDraft = control.value;
    sheetKind = 'mode';
    openSheet(control.label, `<div class="dd-sheet-body"><p class="dd-sheet-device">${e(device.name)}</p><fieldset class="dd-mode-choices"><legend class="dd-visually-hidden">${e(control.label)}</legend>${control.options.map((option) => `<label><input type="radio" name="dd-mode" value="${e(option.value)}" ${option.value === modeDraft ? 'checked' : ''}><span>${e(option.label)}</span><i aria-hidden="true">${glyph('check')}</i></label>`).join('')}</fieldset></div><div class="dialog-actions"><button class="secondary-button" id="dd-mode-cancel">取消</button><button class="primary-button" id="dd-mode-save" disabled>确认${e(control.label)}</button></div>`, { restoreFocus: () => { if (visible) [...page.querySelectorAll('[data-dd-action="mode"]')].find((element) => element.dataset.ddKey === key)?.focus({ preventScroll: true }); } });
    sheet.dataset.content = 'device-detail-mode';
    sheetQuery('.dd-mode-choices').onchange = (event) => { modeDraft = control.options.find((option) => String(option.value) === event.target.value)?.value; sheetQuery('#dd-mode-save').disabled = modeDraft === control.value; };
    sheetQuery('#dd-mode-cancel').onclick = closeSheet;
    sheetQuery('#dd-mode-save').onclick = () => { closeSheet(); requestControl(key, modeDraft); };
  }

  function click(event) {
    const trend = event.target.closest('[data-dd-trend]');
    if (trend) { trendKey = trend.dataset.ddTrend; refresh(true); return; }
    const control = event.target.closest('button[data-dd-control]');
    if (control && !control.disabled) {
      if (control.dataset.ddType === 'stepper') { adjustStepper(control); return; }
      const device = store.get(deviceId);
      const descriptor = currentControls(device).find((entry) => entry.key === control.dataset.ddControl);
      if (descriptor) requestControl(descriptor.key, control.dataset.ddType === 'toggle' ? !descriptor.value : descriptor.options.find((option) => String(option.value) === control.dataset.ddOption)?.value);
      return;
    }
    const action = event.target.closest('[data-dd-action]');
    if (!action || action.disabled) return;
    if (action.dataset.ddAction === 'back') back();
    if (action.dataset.ddAction === 'settings') onSettings?.(deviceId);
    if (action.dataset.ddAction === 'history') showHistory();
    if (action.dataset.ddAction === 'metrics') showMetrics();
    if (action.dataset.ddAction === 'execution') showExecution();
    if (action.dataset.ddAction === 'mode') showModes(action.dataset.ddKey);
  }

  function input(event) {
    const input = event.target.closest('input[data-dd-type="range"]');
    if (!input || input.disabled) return;
    const device = store.get(deviceId), control = currentControls(device).find((entry) => entry.key === input.dataset.ddControl);
    if (!control) return;
    const value = Number(input.value), label = valueText(control, value);
    input.style.setProperty('--dd-progress', `${(value - Number(input.min)) / (Number(input.max) - Number(input.min) || 1) * 100}%`);
    input.setAttribute('aria-valuetext', label);
    query(`[data-dd-value="${control.key}"]`).textContent = label;
    query(`[data-dd-note="${control.key}"]`).textContent = `目标 ${label} · 松手提交`;
  }

  function change(event) {
    const input = event.target.closest('input[data-dd-type="range"]');
    if (!input || input.disabled) return;
    draggingKey = null;
    renderQueued = false;
    requestControl(input.dataset.ddControl, Number(input.value));
  }

  function pointerDown(event) {
    const range = event.target.closest('input[data-dd-type="range"]');
    if (range && !range.disabled) draggingKey = range.dataset.ddControl;
  }

  function imageError(event) {
    const image = event.target;
    if (image.tagName === 'IMG' && image.parentElement?.classList.contains('dd-product-image')) image.parentElement.innerHTML = `<span class="dd-product-placeholder">${glyph('device')}</span>`;
  }

  function trackControlFocus(event) {
    if (controlFocus?.anchor && event.target !== controlFocus.anchor) controlFocus = null;
  }

  function leaveControlArea(event) {
    if (controlFocus?.anchor && !controlFocus.anchor.contains(event.target)) controlFocus = null;
  }

  function finishPointer() {
    if (!draggingKey) return;
    // 原生range的change在释放指针时提交；让提交先完成，避免更新替换仍在交互的节点。
    const key = draggingKey;
    requestAnimationFrame(() => {
      if (disposed || draggingKey !== key) return;
      draggingKey = null;
      if (renderQueued) { renderQueued = false; refresh(); }
    });
  }

  function keyDown(event) {
    const tab = event.target.closest('[data-dd-trend]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...page.querySelectorAll('[data-dd-trend]')], index = tabs.indexOf(tab);
    const target = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    trendKey = target.dataset.ddTrend;
    refresh(true);
    [...page.querySelectorAll('[data-dd-trend]')].find((entry) => entry.dataset.ddTrend === trendKey)?.focus({ preventScroll: true });
  }

  function open(id) {
    const device = store.get(id);
    if (!device) { toast('设备已移除，请重新选择'); return; }
    deviceId = id;
    trendKey = 'temperature';
    draggingKey = null;
    renderQueued = false;
    controlFocus = null;
    lastSignature = '';
    visible = true;
    refresh(true);
    query('.dd-scroll').scrollTop = 0;
    setView('device-detail');
    // Continue the existing mock acknowledgement once; entering details never creates a new command.
    if (executionFor(device)?.status === 'running') store.startPreviewExecution?.();
    query('.dd-back').focus({ preventScroll: true });
  }

  function back() { draggingKey = null; renderQueued = false; controlFocus = null; visible = false; onBack?.(deviceId); }
  function onViewChange(view) { visible = view === 'device-detail'; if (visible) refresh(); else { draggingKey = null; renderQueued = false; controlFocus = null; } }
  const unsubscribe = store.subscribe?.((change) => { if (deviceId && (!change.deviceIds?.length || change.deviceIds.includes(deviceId) || change.roomIds?.includes(store.get(deviceId)?.roomId))) refresh(); });
  const sheetClosed = () => { sheetKind = null; modeDraft = null; };
  page.addEventListener('click', click);
  page.addEventListener('input', input);
  page.addEventListener('change', change);
  page.addEventListener('pointerdown', pointerDown);
  page.addEventListener('keydown', keyDown);
  page.addEventListener('error', imageError, true);
  document.addEventListener('pointerup', finishPointer);
  document.addEventListener('pointercancel', finishPointer);
  document.addEventListener('focusin', trackControlFocus);
  document.addEventListener('pointerdown', leaveControlArea, true);
  sheet?.addEventListener('close', sheetClosed);

  return { open, back, onViewChange, refresh, destroy() { disposed = true; controlFocus = null; for (const draft of stepperDrafts.values()) clearTimeout(draft.timer); stepperDrafts.clear(); unsubscribe?.(); page.removeEventListener('click', click); page.removeEventListener('input', input); page.removeEventListener('change', change); page.removeEventListener('pointerdown', pointerDown); page.removeEventListener('keydown', keyDown); page.removeEventListener('error', imageError, true); document.removeEventListener('pointerup', finishPointer); document.removeEventListener('pointercancel', finishPointer); document.removeEventListener('focusin', trackControlFocus); document.removeEventListener('pointerdown', leaveControlArea, true); sheet?.removeEventListener('close', sheetClosed); } };
}
