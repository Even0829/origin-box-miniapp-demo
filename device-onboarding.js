import { createNativeDeviceOnboarding } from './native-device-onboarding.js?v=native-relation-20261021';

const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const NO_ROOM = '__no_room__';
const QR_ASSET = 'assets/onboarding-qr.png';

// Provider screens are local fixtures. No credentials, User Codes or authorization tokens are persisted.
export function createDeviceOnboarding({ page, store, connections, getRooms, getFamilyName, setView, openSheet, toast, icon, onBack }) {
  const document = page.ownerDocument;
  const sheet = document.querySelector('#sheet');
  const e = escapeHTML;
  const $ = (selector) => page.querySelector(selector);
  const modal = (selector) => sheet.querySelector(selector);
  let active = false, destroyed = false, generation = 0, busy = false;
  let stage = 'sources', providerId = null, account = null, homeId = null, candidates = [];
  let selected = new Set(), assignments = new Map(), result = null;
  let connectStep = 'intro', pendingAccountId = null, previousAccount = null;
  let region = 'cn', app = 'smartlife', userCode = '08291015', loginValue = '13900000618';
  let qrExpires = 0, qrSaved = false, expiryTimer = null, error = '', progressStep = 0;
  let authorizationRequest = null, authorizationSequence = 0;
  let importedAccountId = null;
  let entryBack=onBack,directEntry=false;
  const rooms = () => getRooms() || [];
  const roomName = (id) => rooms().find((room) => room.id === id)?.name || '未设置空间';
  const provider = () => connections.getProviders().find((item) => item.id === providerId);
  const providerName = () => provider()?.name || (providerId === 'xiaomi' ? '米家' : '涂鸦智能 / Smart Life');
  const appName = () => app === 'tuya' ? '涂鸦智能' : 'Smart Life';
  const accountLabel = (item) => { const tail = String(item.identifier || '').match(/(\d{4})(?!.*\d)/)?.[1]; return `${item.name}${tail ? ` · ${tail}` : ''}`; };
  const canRender = (version = generation) => !destroyed && active && version === generation;
  const closeSheet = () => { if (sheet.open) sheet.close(); };
  const glyphPaths = {
    back: '<path d="m14 5-7 7 7 7"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    'chevron-down': '<path d="m5 9 7 7 7-7"/>',
    'location-unset': '<path d="M18 17c-2 3-6 6-6 6S4 16 4 10a8 8 0 0 1 13-6"/><path d="m3 3 18 18M10 8a3 3 0 0 0 4 4"/>',
    room: '<path d="m4 10 8-7 8 7v10H4V10Z"/><path d="M9 20v-7h6v7"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    shield: '<path d="m12 3-8 3v6c0 4 4 7 8 9 4-2 8-5 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>',
    refresh: '<path d="M4 9a8 8 0 1 1 0 7M4 4v5h5"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
    'circle-help': '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .4c0 1.8-2.5 1.8-2.5 3.6M12 16h.01"/>',
    scan: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 12h18"/>',
    link: '<path d="m9 15 6-6M7 14l-2 2a3.5 3.5 0 0 0 5 5l4-4a3.5 3.5 0 0 0 0-5M17 10l2-2a3.5 3.5 0 0 0-5-5l-4 4a3.5 3.5 0 0 0 0 5"/>',
  };
  const glyph = (name) => `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphPaths[name === 'reset' ? 'refresh' : name] || glyphPaths.room}</svg>`;
  const check = glyph('check');
  const shield = glyph('shield');
  const brand = (id = providerId) => `<span class="ob-brand is-${e(id)}" aria-hidden="true"><img src="assets/onboarding-${id === 'int' ? 'int-logo.svg' : `${id === 'xiaomi' ? 'xiaomi' : 'tuya'}-logo.png`}" alt=""></span>`;
  const image = (item) => `<img class="ob-device-image" src="${e(item.image || 'assets/device-radar.png')}" alt="" loading="lazy">`;
  const note = (text) => `<p class="ob-inline-note">${e(text)}</p>`;
  const button = (action, text, kind = 'primary', disabled = false) => `<button class="${kind}-button" data-ob-action="${action}" ${disabled ? 'disabled' : ''}>${text}</button>`;
  const stopExpiry = () => { clearInterval(expiryTimer); expiryTimer = null; };
  const eligible = (item) => item.supported !== false && !connections.isAdded(item);
  const dirty = () => selected.size > 0 || [...assignments.values()].some((value) => value !== null);
  const currentItems = () => candidates.filter((item) => selected.has(item.id) && eligible(item));
  const clearDraft = () => { selected = new Set(); assignments = new Map(); error = ''; };
  const native = createNativeDeviceOnboarding({ store, getRooms: rooms, onChange: () => { if (canRender() && stage === 'native') renderNative(); } });
  const unsubscribeNative = store.subscribe((change) => { if (canRender() && stage === 'native' && change.deviceIds.some((id) => store.get(id)?.providerId === 'int')) renderNative(); });

  page.classList.add('device-onboarding-page');
  page.setAttribute('aria-labelledby', 'ob-title');

  function layout(title, body, footer = '', step = '') {
    const scroll = $('.ob-scroll')?.scrollTop || 0;
    const accountScroll = $('.ob-account-tabs')?.scrollLeft || 0;
    const focused = document.activeElement;
    const focusKey = page.contains(focused) ? { id: focused.id, action: focused.dataset.obAction, device: focused.dataset.obDevice, space: focused.dataset.obSpace, accountTab: focused.dataset.obAccountTab } : null;
    page.dataset.stage = stage;
    page.dataset.provider = providerId || '';
    page.classList.toggle('is-provider-surface', stage === 'connect' && ['xiaomi-account', 'xiaomi-login'].includes(connectStep));
    page.innerHTML = `<header class="ob-header"><button class="icon-button" data-ob-action="back" aria-label="返回" ${busy ? 'disabled' : ''}>${glyph('back')}</button><h1 id="ob-title">${e(title)}</h1>${step ? `<span class="ob-step">${e(step)}</span>` : ''}<button class="ob-header-close icon-button" data-ob-action="close" aria-label="关闭新增设备" ${busy ? 'disabled' : ''}>${glyph('close')}</button></header><div class="ob-scroll">${body}${error ? `<p class="ob-error" role="alert">${e(error)}</p>` : ''}</div>${footer ? `<footer class="ob-footer">${footer}<span class="ob-home-indicator" aria-hidden="true"></span></footer>` : '<span class="ob-home-indicator" aria-hidden="true"></span>'}`;
    $('.ob-scroll').scrollTop = scroll;
    if ($('.ob-account-tabs')) $('.ob-account-tabs').scrollLeft = accountScroll;
    if (focusKey) {
      const replacement = [...page.querySelectorAll('button, input, select')].find((item) => focusKey.id ? item.id === focusKey.id : focusKey.device ? item.dataset.obDevice === focusKey.device : focusKey.space ? item.dataset.obSpace === focusKey.space : focusKey.accountTab ? item.dataset.obAccountTab === focusKey.accountTab : focusKey.action ? item.dataset.obAction === focusKey.action : false);
      replacement?.focus({ preventScroll: true });
    }
  }

  function renderSources() {
    const providers = connections.getProviders();
    layout('新增设备', `<div class="ob-intro"><p class="ob-eyebrow">连接你的设备</p><h2>让小元接入更多能力</h2><p>选择接入方式，连接你的家庭设备</p></div><div class="ob-family">${glyph('room')}<span>${e(getFamilyName())}</span></div><div class="ob-provider-list"><button class="ob-provider-card" data-ob-provider="int">${brand('int')}<span class="ob-provider-copy"><strong>引态</strong><small>支持引态协议的设备可自动接入，<br>并识别与盒子的位置关系</small></span>${glyph('chevron')}</button>${providers.map((item) => {
      const accounts = connections.getAccounts(item.id);
      const connected = accounts.filter((entry) => entry.status === 'connected').length;
      const detail = connected ? `已连接 ${connected} 个账号 · 选择设备` : accounts.length ? '连接已过期 · 重新授权' : item.subtitle;
      return `<button class="ob-provider-card" data-ob-provider="${e(item.id)}">${brand(item.id)}<span class="ob-provider-copy"><strong>${e(item.name)}</strong><small>${e(detail)}</small></span>${glyph('chevron')}</button>`;
    }).join('')}</div><p class="ob-source-note">引态设备无需登录账号或扫码<br>米家／涂鸦设备需先添加至对应厂商 App</p>`);
  }

  function renderNative() {
    const state = native.state();
    const visible = state.items.filter((item) => item.status !== 'waiting');
    const failed = state.items.some((item) => item.status === 'failed');
    const joining = visible.some((item) => item.status === 'joining');
    const heading = state.complete ? failed ? '有设备暂未接入' : `已自动加入 ${state.added} 台设备` : joining ? '正在连接并识别位置关系' : state.added ? '继续留意附近的设备' : '正在等待附近的设备';
    layout('引态设备', `<div class="ob-native-intro">${brand('int')}<p class="ob-eyebrow">引态 · 自动接入</p><h2>自动接入，识别位置关系</h2><p>支持引态协议的设备靠近运行中的引元盒子，即可自动接入，并识别与盒子的位置关系。<span class="ob-native-no-account">无需登录账号或扫码。</span></p></div><div class="ob-native-box"><span><strong>${e(getFamilyName())}</strong><small>引元盒子${state.boxRoomId ? ` · ${e(roomName(state.boxRoomId))}` : ''}</small></span><span class="ob-native-online"><i></i>运行中</span></div><section class="ob-native-results" aria-label="自动接入结果"><div class="ob-native-status" role="status"><i class="ob-native-indicator${state.complete ? ' is-complete' : ''}" aria-hidden="true">${state.complete ? check : ''}</i><h3>${e(heading)}</h3></div>${visible.length ? `<div class="ob-native-list">${visible.map((item) => `<article class="ob-native-device" data-ob-native-device="${e(item.id)}"><div class="ob-native-device-main">${brand('int')}<span><strong>${e(item.name)}</strong><small>${e(item.capabilities.join(' · '))}</small></span><span class="ob-native-device-status${item.status === 'added' ? ' is-added' : ''}">${item.status === 'added' ? '已加入' : item.status === 'failed' ? '暂未接入' : '接入中'}</span></div>${item.status === 'added' ? `<button class="ob-native-space" data-ob-space="${e(item.id)}" aria-label="设置${e(item.name)}的空间"><span>${item.roomId ? `${item.roomSource === 'automatic' ? '已识别' : '已设置'} · ${e(roomName(item.roomId))}` : '未设置空间'}</span><span>${item.roomId ? '调整空间' : '设置空间'}${glyph('chevron')}</span></button>` : item.status === 'failed' ? `<p class="ob-native-message">${e(item.message)}</p>` : ''}</article>`).join('')}</div>` : '<p class="ob-native-waiting">发现设备后，自动连接并识别与盒子的位置关系</p>'}</section><p class="ob-native-location-note">${state.added ? '小元可据此找到对应空间的设备，读取状态、调节灯光。识别不准确时可直接调整。' : '识别位置关系后，小元可找到对应空间的设备，读取状态、调节灯光。'}</p><button class="ob-native-help ob-link" data-ob-action="native-help">没有发现设备？${glyph('chevron')}</button>`, `<p class="ob-footer-note">离开此页，不影响盒子自动接入</p><div class="ob-footer-actions">${failed ? button('native-retry', '重新查看', 'secondary') : ''}${button('finish', '查看设备')}</div>`);
  }

  function nativeHelp() {
    openSheet('没有发现设备？', '<ol class="ob-help-steps"><li><strong>确认设备支持引态协议</strong><p>请查看设备说明，确认是否支持引态协议。米家和涂鸦设备可通过对应账号连接。</p></li><li><strong>让设备通电并靠近盒子</strong><p>设备通电并靠近运行中的盒子后，会自动连接，并识别与盒子的位置关系。</p></li><li><strong>查看识别的位置关系</strong><p>加入后可查看设备所在空间；识别不准确时，可直接调整。</p></li></ol><div class="dialog-actions"><button class="primary-button" id="ob-native-help-done">我知道了</button></div>', { restoreFocus: () => $('[data-ob-action="native-help"]')?.focus({ preventScroll: true }) });
    sheet.dataset.content = 'onboarding-native-help';
    modal('#ob-native-help-done').onclick = closeSheet;
  }

  function renderConnect() {
    if (connectStep === 'checking') {
      layout('连接账号', `<div class="ob-progress-orbit" aria-hidden="true"><i></i><i></i><i></i>${shield}</div><div class="ob-result-summary"><h2>正在核对授权</h2><p aria-live="polite">确认账号连接后，继续选择设备</p></div>`, '<p class="ob-footer-note">正在确认账号连接状态</p>', '2 / 3');
      return;
    }
    if (providerId === 'xiaomi') renderXiaomi(); else renderTuya();
  }

  function renderXiaomi() {
    if (connectStep === 'xiaomi-login') {
      layout('小米账号', `<div class="ob-provider-heading">${brand()}<h2>登录小米账号</h2><p>使用与米家一致的账号</p></div><form class="ob-form" id="ob-mi-login" novalidate><div class="ob-field"><label for="ob-mi-account">账号</label><input class="text-input" id="ob-mi-account" value="${e(loginValue)}" inputmode="numeric" autocomplete="off" maxlength="50" placeholder="手机号 / 小米账号"></div><div class="ob-field"><label for="ob-mi-code">验证码</label><div class="ob-login-code"><input class="text-input" id="ob-mi-code" value="082910" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="输入验证码"><button class="ob-link" data-ob-action="mi-code" type="button">获取验证码</button></div></div><p class="ob-official-note">登录后由你确认授权范围</p></form>`, `<div class="ob-footer-actions">${button('mi-login', '登录并继续')}</div>`, '2 / 3');
      return;
    }
    if (connectStep === 'xiaomi-account') {
      layout('小米账号', `<div class="ob-provider-heading">${brand()}<h2>授权连接米家</h2><p>小元希望访问你的米家设备</p></div><div class="ob-provider-account"><span class="ob-avatar">${e((previousAccount?.name || '阿元').slice(-1))}</span><strong>${e(previousAccount?.name || '阿元')}</strong><span>${e(previousAccount?.identifier || '139****0618')}</span><button class="ob-link" data-ob-action="mi-switch">切换账号</button></div><ul class="ob-permission-list"><li>${glyph('room')}<span><strong>读取家庭与设备</strong><small>获取设备名称、所在房间和可用功能</small></span></li><li>${shield}<span><strong>获取状态与控制设备</strong><small>在授权范围内感知变化、执行你的指令</small></span></li></ul><p class="ob-official-note">你可以在账号接入管理中断开连接</p>`, `<div class="ob-footer-actions">${button('cancel-auth', '取消', 'secondary')}${button('mi-authorize', '同意授权')}</div>`, '2 / 3');
      return;
    }
    layout('连接米家', `<div class="ob-provider-heading">${brand()}<h2>${pendingAccountId ? '重新连接米家' : '连接米家账号'}</h2><p>使用小米账号授权，获取已有设备</p></div><div class="ob-form"><div class="ob-field"><label for="ob-mi-region">账号地区</label><select class="text-input" id="ob-mi-region"><option value="cn" ${region === 'cn' ? 'selected' : ''}>中国大陆</option><option value="de" ${region === 'de' ? 'selected' : ''}>欧洲</option><option value="us" ${region === 'us' ? 'selected' : ''}>美国</option><option value="sg" ${region === 'sg' ? 'selected' : ''}>新加坡</option></select></div></div>${note('请选择与米家 App 一致的地区，避免找不到设备')}<ol class="ob-steps"><li><b>1</b><span><strong>前往小米完成授权</strong><small>账号登录与确认由小米完成</small></span></li><li><b>2</b><span><strong>返回选择设备</strong><small>可同时确认设备在家中的位置</small></span></li></ol>`, `<div class="ob-footer-actions">${button('mi-open', '前往小米授权')}</div>`, '2 / 3');
  }

  function renderTuya() {
    if (connectStep === 'tuya-qr') {
      const expired = Date.now() >= qrExpires;
      layout('连接账号', `<div class="ob-provider-heading">${brand()}<h2>用${e(appName())}确认授权</h2></div><div class="ob-qr-card"><img class="ob-qr" src="${QR_ASSET}" alt="账号授权二维码"><strong class="ob-qr-status" id="ob-qr-status">${expired ? '二维码已失效' : '等待账号授权'}</strong><span class="ob-qr-expiry" id="ob-qr-expiry"></span>${expired ? `<button class="ob-qr-expired" data-ob-action="tuya-refresh">${glyph('refresh')}重新生成</button>` : ''}</div><div class="ob-action-row"><button class="ob-soft-button" data-ob-action="tuya-save" ${expired ? 'disabled' : ''}>${glyph('download')}${qrSaved ? '再次保存' : '保存授权二维码'}</button><button class="ob-soft-button" data-ob-action="tuya-help">${glyph('circle-help')}授权帮助</button></div><ol class="ob-steps"><li><b>1</b><span><strong>保存授权二维码</strong><small>到${e(appName())}扫一扫，从相册识码并确认</small></span></li><li><b>2</b><span><strong>返回检查授权结果</strong><small>确认连接后，继续选择设备</small></span></li></ol>`, `<div class="ob-footer-actions">${button(expired ? 'tuya-refresh' : 'tuya-check', expired ? '重新生成二维码' : '检查授权结果')}</div>`, '2 / 3');
      updateExpiry();
      return;
    }
    layout('连接涂鸦账号', `<div class="ob-provider-heading">${brand()}<h2>${pendingAccountId ? '重新连接涂鸦账号' : '连接涂鸦账号'}</h2></div><div class="ob-form"><div class="ob-field"><label for="ob-tuya-app">设备使用的 App</label><select class="text-input" id="ob-tuya-app"><option value="smartlife" ${app === 'smartlife' ? 'selected' : ''}>Smart Life</option><option value="tuya" ${app === 'tuya' ? 'selected' : ''}>涂鸦智能</option></select></div><div class="ob-field"><div class="ob-field-heading"><label for="ob-user-code">用户码</label><button class="ob-link" data-ob-action="tuya-code-help">${glyph('circle-help')}在哪里找到？</button></div><input class="text-input" id="ob-user-code" value="${e(userCode)}" maxlength="32" autocomplete="off" placeholder="粘贴账号的用户码"></div></div><section class="ob-connection-guide" aria-label="连接流程"><h3>连接流程</h3><ol class="ob-steps"><li><b>1</b><span><strong>填写用户码</strong><small>从 <span data-ob-app-name>${e(appName())}</span> 的「账号与安全」复制，粘贴到上方</small></span></li><li><b>2</b><span><strong>在 <span data-ob-app-name>${e(appName())}</span> 确认授权</strong><small>下一步获取并保存二维码，再到 App 扫码确认</small></span></li><li><b>3</b><span><strong>返回选择设备</strong><small>回到小程序检查授权结果，选择要加入家庭的设备</small></span></li></ol></section>`, `<div class="ob-footer-actions">${button('tuya-generate', '获取授权二维码', 'primary', !userCode.trim())}</div>`, '2 / 3');
  }

  function updateExpiry() {
    if (!active || stage !== 'connect' || connectStep !== 'tuya-qr') return;
    const remaining = Math.max(0, Math.ceil((qrExpires - Date.now()) / 1000));
    const expiry = $('#ob-qr-expiry');
    if (expiry) expiry.textContent = remaining ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} 后失效` : '请重新生成后授权';
    if (!remaining && !$('.ob-qr-expired')) render();
  }

  function renderDevices() {
    const homes = connections.getHomes(account.id);
    const currentHome = homes.find((home) => home.id === homeId);
    const accounts = connections.getAccounts(providerId);
    const selectable = candidates.filter(eligible);
    const chosen = currentItems();
    const unassigned = chosen.filter((item) => !assignments.get(item.id)).length;
    layout('选择设备', `<div class="ob-account-tabs-row"><div class="ob-account-tabs" role="tablist" aria-label="接入账号">${accounts.map((item) => `<button class="ob-account-tab" role="tab" data-ob-account-tab="${e(item.id)}" aria-selected="${item.id === account.id}" id="ob-account-tab-${e(item.id)}" aria-controls="ob-candidates" tabindex="${item.id === account.id ? '0' : '-1'}" title="${e(item.identifier)}"><span>${e(accountLabel(item))}</span>${item.status === 'expired' ? '<i class="ob-tab-expired" aria-label="需重新授权">!</i>' : ''}</button>`).join('')}</div><button class="ob-add-account" data-ob-action="add-account">${glyph('plus')}添加账号</button></div><div class="ob-account-strip"><div class="ob-account-identity"><strong>${e(account.name || providerName())}</strong><small>${e(account.identifier || providerName())}</small></div><button class="ob-link" data-ob-action="account-options">管理</button></div>${homes.length > 1 ? `<button class="ob-home-trigger" data-ob-action="choose-home"><span class="ob-home-label">${providerId === 'xiaomi' ? '米家家庭' : '账号家庭'}</span><span class="ob-home-value"><strong>${e(currentHome?.name || '选择家庭')}</strong><small>${e(currentHome?.count || 0)} 台</small></span>${glyph('chevron-down')}</button>` : ''}<div class="ob-selection-toolbar"><strong>${candidates.length} 台设备<span class="ob-caption"> · ${selectable.length} 台可加入</span></strong><button class="ob-link" data-ob-action="select-all" ${selectable.length ? '' : 'disabled'}>${selectable.length && selectable.every((item) => selected.has(item.id)) ? '取消全选' : '全选'}</button></div><div class="ob-batch-bar"><span>选择设备，确认所在空间</span><button class="ob-link" data-ob-action="batch-space" ${chosen.length ? '' : 'disabled'}>批量设置空间</button></div><div class="ob-candidate-list" id="ob-candidates" role="tabpanel" aria-labelledby="ob-account-tab-${e(account.id)}">${candidates.length ? candidates.map(candidateMarkup).join('') : '<p class="ob-empty">这个家庭暂时没有可接入的设备</p>'}</div>`, `<p class="ob-footer-note">${chosen.length ? `已选 ${chosen.length} 台${unassigned ? ` · ${unassigned} 台未设置空间` : ' · 位置已确认'}` : '选择要加入家庭的设备'}</p><div class="ob-footer-actions">${button('import', chosen.length ? `加入家庭（${chosen.length}）` : '加入家庭', 'primary', !chosen.length)}</div>`, '3 / 3');
  }

  function candidateMarkup(item) {
    const existing = connections.isAdded(item);
    const disabled = !!existing || item.supported === false;
    const checked = selected.has(item.id) && !disabled;
    const description = item.supported === false ? item.unsupportedReason || '当前暂不支持接入' : (item.capabilities || []).join(' · ') || '读取设备状态';
    const warning = !disabled ? [item.partial || '', item.online === false ? '离线 · 可先加入' : ''].filter(Boolean).join(' · ') : '';
    return `<article class="ob-candidate${disabled ? ' is-disabled' : ''}${checked ? ' is-selected' : ''}"><div class="ob-candidate-main"><label class="ob-candidate-choice">${existing ? '' : `<input type="checkbox" data-ob-device="${e(item.id)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} aria-label="${e(item.name)}${disabled ? ` ${e(description)}` : ''}">`}${image(item)}<span class="ob-candidate-copy"><strong>${e(item.name)}</strong><small class="ob-capabilities">${e(description)}</small>${warning ? `<span class="ob-device-note${item.partial ? ' is-partial' : ''}">${e(warning)}</span>` : ''}</span>${existing ? '<span class="ob-added-label">已接入</span>' : `<span class="ob-check" aria-hidden="true">${check}</span>`}</label></div>${!disabled ? `<div class="ob-candidate-bottom"><span class="ob-origin-room">${item.manufacturerRoom ? `厂商房间：${e(item.manufacturerRoom)}` : '厂商未设置房间'}</span><button class="ob-space-choice" data-ob-space="${e(item.id)}" aria-label="设置${e(item.name)}的空间">${glyph('room')}<span>${e(roomName(assignments.get(item.id)))}</span>${glyph('chevron')}</button></div>` : ''}</article>`;
  }

  function renderProgress() {
    const labels = ['获取设备与可用功能', '将所选设备加入家庭', '确认设备连接结果'];
    layout('正在接入', `<div class="ob-progress-orbit" aria-hidden="true"><i></i><i></i><i></i>${glyph('link')}</div><div class="ob-result-summary"><h2>让设备连接到小元</h2><p class="ob-progress-label" aria-live="polite">${e(labels[progressStep])}</p></div><ul class="ob-progress-steps">${labels.map((label, index) => `<li class="${index === progressStep ? 'is-active' : index < progressStep ? 'is-done' : ''}">${index < progressStep ? check : '<i></i>'}<span>${e(label)}</span></li>`).join('')}</ul>`, '<p class="ob-footer-note">设备名称和已有位置会为你保留</p>', '3 / 3');
  }

  function renderResult() {
    const added = result?.added || [], failed = result?.failed || [], skipped = result?.skipped || [];
    const unassigned = added.filter((item) => !item.roomId).length;
    const title = failed.length ? added.length ? '部分设备已加入家庭' : '设备暂未加入' : added.length ? '设备已加入家庭' : '所选设备已在家庭中';
    layout('新增设备', `<div class="ob-result-symbol${failed.length ? ' is-partial' : ''}">${failed.length ? glyph('reset') : check}</div><div class="ob-result-summary"><h2>${e(title)}</h2><p>${e(result?.message || (failed.length ? added.length ? '已加入家庭，未完成的设备可单独重试' : '连接尚未完成，可单独重试' : '小元可以结合所在空间，感知与调用这些设备'))}</p></div><div class="ob-result-counts"><div><strong>${added.length}</strong><span>已加入</span></div><div><strong>${failed.length}</strong><span>待重试</span></div><div><strong>${unassigned}</strong><span>未设置空间</span></div></div>${failed.length ? `<h3 class="ob-result-subtitle">这些设备需要再试一次</h3><div class="ob-result-list">${failed.map((item) => `<div class="ob-result-row">${image(candidates.find((candidate) => candidate.id === item.id) || item)}<span><strong>${e(item.name)}</strong><small>${e(item.message || '连接暂未完成')}</small></span><span class="ob-pill">待重试</span></div>`).join('')}</div>` : ''}${added.length ? `<h3 class="ob-result-subtitle">已加入的设备</h3><div class="ob-result-list">${added.map((item) => `<div class="ob-result-row">${image(item)}<span><strong>${e(item.name)}</strong><small>${e(item.roomName || roomName(item.roomId))}${item.online === false ? ' · 离线，等待恢复' : ''}</small></span>${item.online === false ? '<span class="ob-pill">待上线</span>' : check}</div>`).join('')}</div>` : ''}${skipped.length ? note(`${skipped.length} 台设备已在家庭中，原有名称与位置已保留`) : ''}${unassigned ? note('未设置空间的设备仍可查看，稍后可在「设置」中分配位置') : ''}`, `<div class="ob-footer-actions">${result?.needsAuthorization ? button('reauthorize', '重新授权', 'secondary') : failed.length ? button('retry', `重试 ${failed.length} 台`, 'secondary') : ''}${button('finish', added.length || skipped.length ? '查看设备' : '完成')}</div>`, '3 / 3');
  }

  function render() {
    if (!canRender()) return;
    if (stage === 'sources') renderSources();
    else if (stage === 'native') renderNative();
    else if (stage === 'connect') renderConnect();
    else if (stage === 'devices') renderDevices();
    else if (stage === 'progress') renderProgress();
    else if (stage === 'result') renderResult();
  }

  function topRender() { render(); if ($('.ob-scroll')) $('.ob-scroll').scrollTop = 0; }

  function selectProvider(id) {
    providerId = id;
    if (id === 'int') { stage = 'native'; error = ''; native.start(); topRender(); return; }
    const accounts = connections.getAccounts(id);
    const connected = accounts.find((item) => item.status === 'connected');
    if (connected) loadDevices(connected);
    else startConnection(id, accounts[0] || null);
  }

  function loadDevices(nextAccount, nextHomeId = null) {
    stopExpiry();
    account = nextAccount;
    previousAccount = nextAccount;
    providerId = nextAccount.providerId;
    const homes = connections.getHomes(account.id);
    homeId = homes.some((home) => home.id === nextHomeId) ? nextHomeId : homes[0]?.id || null;
    candidates = (connections.getDevices(account.id, homeId) || []).sort((a, b) => Number(!eligible(a)) - Number(!eligible(b)));
    clearDraft();
    stage = 'devices';
    topRender();
  }

  function startConnection(id, existing = null) {
    stopExpiry();
    providerId = id;
    pendingAccountId = existing?.id || null;
    previousAccount = existing;
    region = existing?.region || 'cn';
    app = existing?.app === 'tuya' ? 'tuya' : 'smartlife';
    userCode = '08291015';
    qrSaved = false;
    authorizationRequest = null;
    error = '';
    connectStep = id === 'xiaomi' ? 'intro' : 'tuya-code';
    stage = 'connect';
    topRender();
  }

  function cancelConnection() {
    stopExpiry();
    error = '';
    userCode = '';
    if (account && account.providerId === providerId && account.status === 'connected') loadDevices(account, homeId);
    else if(directEntry)exit();
    else { stage = 'sources'; providerId = null; topRender(); }
  }

  function confirmDiscard(proceed, message = '未加入的设备和位置设置将不再保留') {
    if (!dirty()) { proceed(); return; }
    openSheet('放弃本次选择？', `<p class="confirm-description">${e(message)}</p><div class="dialog-actions"><button class="secondary-button" id="ob-keep-draft">继续选择</button><button class="primary-button destructive-button" id="ob-discard-draft">放弃选择</button></div>`, { variant: 'float', restoreFocus: () => $('[data-ob-action="back"]')?.focus({ preventScroll: true }) });
    sheet.dataset.content = 'onboarding-confirm';
    modal('#ob-keep-draft').onclick = closeSheet;
    modal('#ob-discard-draft').onclick = () => { closeSheet(); clearDraft(); proceed(); };
  }

  function exit({ showAll = false } = {}) {
    if (busy) return;
    const leave = () => { generation++; active = false; stopExpiry(); clearDraft(); userCode = ''; authorizationRequest = null; entryBack({ showAll }); };
    if (stage === 'devices') confirmDiscard(leave); else leave();
  }

  function back() {
    if (busy) return;
    error = '';
    if (stage === 'sources' || stage === 'result') { exit(); return; }
    if (stage === 'native') { if (directEntry) exit(); else { stage = 'sources'; providerId = null; topRender(); } return; }
    if (stage === 'devices') { if(directEntry){exit();return;}confirmDiscard(() => { stage = 'sources'; providerId = null; account = null; topRender(); }); return; }
    if (connectStep === 'xiaomi-login') connectStep = 'xiaomi-account';
    else if (connectStep === 'xiaomi-account') connectStep = 'intro';
    else if (connectStep === 'tuya-qr') { stopExpiry(); authorizationRequest = null; connectStep = 'tuya-code'; }
    else { cancelConnection(); return; }
    topRender();
  }

  function accountOptions() {
    const accounts = connections.getAccounts(providerId);
    openSheet('账号管理', `<div class="ob-connected-list">${accounts.map((item) => `<button class="ob-account-row" data-ob-account="${e(item.id)}">${brand(providerId)}<span class="ob-provider-copy"><strong>${e(item.name)}</strong><small>${e(item.identifier)}</small></span><span class="ob-status${item.status === 'expired' ? ' is-expired' : ''}">${item.status === 'expired' ? '需重新授权' : item.id === account?.id ? '当前账号' : '已连接'}</span>${glyph('chevron')}</button>`).join('')}</div><div class="dialog-actions"><button class="secondary-button" id="ob-reauthorize-current">${glyph('refresh')}重新授权</button><button class="primary-button" id="ob-connect-another">${glyph('plus')}添加账号</button></div>`, { restoreFocus: () => $('[data-ob-action="account-options"]')?.focus({ preventScroll: true }) });
    sheet.dataset.content = 'onboarding-accounts';
    sheet.querySelectorAll('[data-ob-account]').forEach((target) => { target.onclick = () => {
      const next = accounts.find((item) => item.id === target.dataset.obAccount);
      if (!next) return;
      closeSheet();
      activateAccount(next.id);
    }; });
    modal('#ob-connect-another').onclick = () => { closeSheet(); addAccount(); };
    modal('#ob-reauthorize-current').onclick = () => { const current = account; closeSheet(); confirmDiscard(() => startConnection(current.providerId, current)); };
  }

  function activateAccount(id) {
    const ownerProviderId = providerId;
    const next = connections.getAccounts(ownerProviderId).find((item) => item.id === id);
    if (!next || (next.id === account?.id && next.status === 'connected')) return;
    confirmDiscard(() => {
      const latest = connections.getAccounts(ownerProviderId).find((item) => item.id === id);
      if (!latest) { toast('账号信息已变化，请重新选择'); return; }
      if (latest.status === 'connected') loadDevices(latest);
      else startConnection(ownerProviderId, latest);
    });
  }

  function addAccount() {
    const ownerProviderId = providerId;
    confirmDiscard(() => startConnection(ownerProviderId));
  }

  function chooseHome() {
    if (!account) return;
    const sourceAccountId = account.id;
    const homes = connections.getHomes(sourceAccountId);
    if (homes.length < 2) return;
    let target = homeId;
    openSheet('选择家庭', `<fieldset class="ob-home-options"><legend class="ob-visually-hidden">选择${providerId === 'xiaomi' ? '米家' : '账号'}家庭</legend>${homes.map((home) => `<label class="ob-home-option"><input type="radio" name="ob-home-choice" value="${e(home.id)}" ${home.id === target ? 'checked' : ''}>${glyph('room')}<span><strong>${e(home.name)}</strong><small>${e(home.count)} 台设备</small></span><span class="ob-choice-mark" aria-hidden="true"></span></label>`).join('')}</fieldset><div class="dialog-actions"><button class="secondary-button" id="ob-home-cancel">取消</button><button class="primary-button" id="ob-home-confirm" disabled>确认家庭</button></div>`, { restoreFocus: () => $('[data-ob-action="choose-home"]')?.focus({ preventScroll: true }) });
    sheet.dataset.content = 'onboarding-home';
    modal('#ob-home-cancel').onclick = closeSheet;
    sheet.querySelectorAll('[name="ob-home-choice"]').forEach((input) => { input.onchange = () => { target = input.value; modal('#ob-home-confirm').disabled = target === homeId; }; });
    modal('#ob-home-confirm').onclick = () => {
      if (account?.id !== sourceAccountId) { closeSheet(); toast('账号已变化，请重新选择家庭'); return; }
      if (!connections.getHomes(sourceAccountId).some((home) => home.id === target)) { toast('家庭信息已变化，请重新选择'); return; }
      closeSheet();
      confirmDiscard(() => loadDevices(account, target), '切换家庭会清除尚未加入的设备选择和位置设置');
    };
  }

  function chooseSpace(ids) {
    const isNative = stage === 'native';
    const items = isNative ? store.getDevices().filter((item) => ids.includes(item.id) && item.providerId === 'int') : candidates.filter((item) => ids.includes(item.id) && eligible(item));
    if (!items.length) return;
    const position = (item) => isNative ? item.roomId : assignments.get(item.id) || null;
    const common = position(items[0]);
    let target = items.every((item) => position(item) === common) ? common : undefined;
    const options = [{ id: null, name: '未设置空间', detail: '稍后可在设置中调整' }, ...rooms().map((room) => ({ id: room.id, name: room.name, detail: '设备实际所在的位置' }))];
    openSheet(items.length > 1 ? '批量设置空间' : '设置设备空间', `<div class="ob-space-summary"><strong>${items.length > 1 ? `已选择 ${items.length} 台设备` : e(items[0].name)}</strong><p>${items.length > 1 ? e(items.map((item) => item.name).join('、')) : items[0].manufacturerRoom ? `厂商房间：${e(items[0].manufacturerRoom)}` : '请选择设备在家中的位置'}</p></div><fieldset class="ob-room-options"><legend class="ob-visually-hidden">选择空间</legend>${options.map((room) => `<label class="ob-room-option"><input type="radio" name="ob-room" value="${e(room.id || NO_ROOM)}" ${target === room.id ? 'checked' : ''}>${glyph(room.id ? 'room' : 'location-unset')}<span><strong>${e(room.name)}</strong><small>${e(room.detail)}</small></span><span class="ob-choice-mark" aria-hidden="true"></span></label>`).join('')}</fieldset><div class="dialog-actions"><button class="secondary-button" id="ob-space-cancel">取消</button><button class="primary-button" id="ob-space-save" ${target === undefined ? 'disabled' : ''}>确认位置</button></div>`, { restoreFocus: () => items.length === 1 ? [...page.querySelectorAll('[data-ob-space]')].find((item) => item.dataset.obSpace === items[0].id)?.focus({ preventScroll: true }) : $('[data-ob-action="batch-space"]')?.focus({ preventScroll: true }) });
    sheet.dataset.content = 'onboarding-space';
    modal('#ob-space-cancel').onclick = closeSheet;
    sheet.querySelectorAll('[name="ob-room"]').forEach((input) => { input.onchange = () => { target = input.value === NO_ROOM ? null : input.value; modal('#ob-space-save').disabled = false; }; });
    modal('#ob-space-save').onclick = () => {
      if (target !== null && !rooms().some((room) => room.id === target)) { toast('空间已发生变化，请重新选择'); return; }
      if (isNative) {
        const saved = store.assignDevices(items.map((item) => item.id), target);
        if (!saved.ok) { toast(saved.message); return; }
      } else items.forEach((item) => { assignments.set(item.id, target); });
      closeSheet();
      render();
      requestAnimationFrame(() => {
        if (!canRender() || !['devices', 'native'].includes(stage)) return;
        const targetButton = items.length > 1 ? $('[data-ob-action="batch-space"]') : [...page.querySelectorAll('[data-ob-space]')].find((element) => element.dataset.obSpace === items[0].id);
        targetButton?.focus({ preventScroll: true });
      });
      toast(items.length > 1 ? `已为 ${items.length} 台设备确认位置` : '设备位置已确认');
    };
  }

  function help(kind) {
    const body = kind === 'code' ? `<ol class="ob-help-steps"><li><strong>打开${e(appName())}</strong><p>使用已有设备的账号登录</p></li><li><strong>进入账号与安全</strong><p>我的 → 设置 → 账号与安全</p></li><li><strong>复制用户码</strong><p>返回小程序粘贴，然后继续授权</p></li></ol>` : `<ol class="ob-help-steps"><li><strong>在对应 App 中确认</strong><p>请使用生成用户码的同一个账号与 App</p></li><li><strong>尝试从相册识别</strong><p>保存二维码，在 App 的扫一扫中选择该图片</p></li><li><strong>也可以使用另一块屏幕</strong><p>将二维码展示在其他屏幕，再用${e(appName())}扫描确认</p></li></ol><div class="ob-note-card">若 App 不支持相册识别，请使用另一块屏幕完成扫码</div>`;
    openSheet(kind === 'code' ? '找到用户码' : '完成账号授权', `${body}<div class="dialog-actions"><button class="primary-button" id="ob-help-done">我知道了</button></div>`, { restoreFocus: () => $('[data-ob-action="tuya-code-help"], [data-ob-action="tuya-help"]')?.focus({ preventScroll: true }) });
    sheet.dataset.content = 'onboarding-help';
    modal('#ob-help-done').onclick = closeSheet;
  }

  function generateQR() {
    userCode = $('#ob-user-code')?.value.trim() || userCode.trim();
    if (!userCode || !/^[A-Za-z0-9_-]{4,32}$/.test(userCode)) { error = '请输入有效的用户码'; render(); $('#ob-user-code')?.focus(); return; }
    error = '';
    connectStep = 'tuya-qr';
    qrExpires = Date.now() + 180000;
    authorizationRequest = { id: ++authorizationSequence, providerId, accountId: pendingAccountId, app, userCode, expiresAt: qrExpires, fixtureResult: 'pending', fixtureReadyAt: Date.now() + 6000 };
    qrSaved = false;
    stopExpiry();
    expiryTimer = setInterval(updateExpiry, 1000);
    topRender();
  }

  async function authorizeProvider() {
    if (busy) return;
    if (providerId === 'tuya' && Date.now() >= qrExpires) { connectStep = 'tuya-qr'; error = '二维码已失效，请重新生成'; topRender(); return; }
    const version = generation;
    const priorConnectStep = connectStep;
    const request = authorizationRequest;
    if (providerId === 'tuya' && (!request || request.providerId !== providerId || request.app !== app || request.userCode !== userCode)) { error = '请重新获取授权二维码后继续'; render(); return; }
    busy = true;
    connectStep = 'checking';
    topRender();
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (!canRender(version)) return;
    busy = false;
    // The fixture becomes available independently of the check button; production must poll the provider grant.
    if (providerId === 'tuya' && request && Date.now() >= request.fixtureReadyAt) request.fixtureResult = 'authorized';
    if (providerId === 'tuya' && (authorizationRequest !== request || Date.now() >= request.expiresAt || request.fixtureResult !== 'authorized')) { connectStep = 'tuya-qr'; error = Date.now() >= request.expiresAt ? '二维码已失效，请重新生成' : '尚未收到授权，请完成后重试'; render(); return; }
    const next = connections.authorize(providerId, { accountId: pendingAccountId || undefined, region, app, userCode: providerId === 'tuya' ? userCode : undefined });
    if (!canRender(version)) return;
    if (!next || next.ok === false || !next.id) { connectStep = priorConnectStep; error = next?.message || '账号连接暂未完成，请重试'; render(); return; }
    stopExpiry();
    userCode = '';
    authorizationRequest = null;
    toast('账号已连接');
    loadDevices(next);
  }

  async function importSelection(retry = false) {
    if (busy) return;
    const failedIds = new Set(retry ? (result?.failed || []).map((item) => item.id) : []);
    const items = retry ? candidates.filter((item) => failedIds.has(item.id)).map((item) => ({ id: item.id, roomId: assignments.get(item.id) || null })) : currentItems().map((item) => ({ id: item.id, roomId: assignments.get(item.id) || null }));
    if (!items.length) { toast('请选择要加入的设备'); return; }
    const previous = retry ? result : null;
    const version = generation;
    const importingAccountId = account.id;
    importedAccountId = importingAccountId;
    busy = true;
    stage = 'progress';
    progressStep = 0;
    error = '';
    topRender();
    const progressTimer = setInterval(() => { if (!canRender(version)) return; progressStep = Math.min(2, progressStep + 1); render(); }, 350);
    try {
      const imported = await connections.importDevices({ accountId: importingAccountId, items });
      if (!canRender(version) || importedAccountId !== importingAccountId) return;
      const addedById = new Map([...(previous?.added || []), ...(imported.added || [])].map((item) => [item.id, item]));
      result = { ...imported, needsAuthorization: imported.ok === false && /账号|授权/.test(imported.message || ''), added: [...addedById.values()], failed: imported.failed || [], skipped: [...(previous?.skipped || []), ...(imported.skipped || [])] };
      if (imported.ok === false && !result.failed.length) result.failed = items.map((item) => ({ id: item.id, name: candidates.find((candidate) => candidate.id === item.id)?.name || '设备', message: imported.message || '暂时无法连接，请重试' }));
      selected.clear();
      stage = 'result';
    } catch {
      if (!canRender(version)) return;
      result = { added: previous?.added || [], skipped: previous?.skipped || [], failed: items.map((item) => ({ id: item.id, name: candidates.find((candidate) => candidate.id === item.id)?.name || '设备', message: '连接暂时中断，请重试' })) };
      stage = 'result';
    } finally {
      clearInterval(progressTimer);
      if (canRender(version)) { busy = false; topRender(); }
    }
  }

  function saveQR() {
    if (Date.now() >= qrExpires) { render(); return; }
    const link = document.createElement('a');
    link.href = QR_ASSET;
    link.download = '账号授权二维码.png';
    link.click();
    qrSaved = true;
    render();
    toast('授权二维码已保存，请到对应 App 确认');
  }

  function handleClick(event) {
    const providerButton = event.target.closest('[data-ob-provider]');
    if (providerButton) { selectProvider(providerButton.dataset.obProvider); return; }
    const accountTab = event.target.closest('[data-ob-account-tab]');
    if (accountTab) { activateAccount(accountTab.dataset.obAccountTab); return; }
    const spaceButton = event.target.closest('[data-ob-space]');
    if (spaceButton) { chooseSpace([spaceButton.dataset.obSpace]); return; }
    const target = event.target.closest('[data-ob-action]');
    if (!target || target.disabled) return;
    const action = target.dataset.obAction;
    if (action === 'back') back();
    else if (action === 'close' || action === 'finish') exit({ showAll: action === 'finish' && stage === 'native' });
    else if (action === 'native-help') nativeHelp();
    else if (action === 'native-retry') native.retry();
    else if (action === 'mi-open') { connectStep = 'xiaomi-account'; error = ''; topRender(); }
    else if (action === 'mi-switch') { previousAccount = null; pendingAccountId = null; connectStep = 'xiaomi-login'; error = ''; topRender(); }
    else if (action === 'mi-code') { $('#ob-mi-code').value = '082910'; toast('验证码已发送'); }
    else if (action === 'mi-login') {
      loginValue = $('#ob-mi-account').value.trim();
      const code = $('#ob-mi-code').value.trim();
      if (!loginValue || !/^\d{6}$/.test(code)) { error = '请填写账号与6位验证码'; render(); return; }
      // Deliberately discard entered credentials; the account identity is a predefined fixture.
      loginValue = '13900000618';
      connectStep = 'xiaomi-account';
      error = '';
      topRender();
    }
    else if (action === 'mi-authorize' || action === 'tuya-check') authorizeProvider();
    else if (action === 'cancel-auth') { connectStep = 'intro'; error = ''; topRender(); }
    else if (action === 'tuya-code-help') help('code');
    else if (action === 'tuya-help') help('qr');
    else if (action === 'tuya-generate' || action === 'tuya-refresh') generateQR();
    else if (action === 'tuya-save') saveQR();
    else if (action === 'account-options') accountOptions();
    else if (action === 'add-account') addAccount();
    else if (action === 'choose-home') chooseHome();
    else if (action === 'select-all') { const items = candidates.filter(eligible); const all = items.every((item) => selected.has(item.id)); items.forEach((item) => all ? selected.delete(item.id) : selected.add(item.id)); render(); }
    else if (action === 'batch-space') chooseSpace(currentItems().map((item) => item.id));
    else if (action === 'import') importSelection();
    else if (action === 'retry') importSelection(true);
    else if (action === 'reauthorize') startConnection(providerId, account);
  }

  function handleChange(event) {
    const target = event.target;
    if (target.matches('[data-ob-device]')) { target.checked ? selected.add(target.dataset.obDevice) : selected.delete(target.dataset.obDevice); error = ''; render(); }
    else if (target.id === 'ob-mi-region') region = target.value;
    else if (target.id === 'ob-tuya-app') {
      app = target.value;
      page.querySelectorAll('[data-ob-app-name]').forEach((label) => { label.textContent = appName(); });
    }

  }

  function handleInput(event) {
    if (event.target.id === 'ob-user-code') { userCode = event.target.value; error = ''; const next = $('[data-ob-action="tuya-generate"]'); if (next) next.disabled = !userCode.trim(); $('.ob-error')?.remove(); }
    if (event.target.id === 'ob-mi-account') loginValue = event.target.value;
  }

  function handleKeyDown(event) {
    const tab = event.target.closest('[data-ob-account-tab]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...page.querySelectorAll('[data-ob-account-tab]')];
    const index = tabs.indexOf(tab);
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs.forEach((item, position) => { item.tabIndex = position === nextIndex ? 0 : -1; });
    tabs[nextIndex]?.focus({ preventScroll: true });
    tabs[nextIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  function handleSubmit(event) { if (event.target.id === 'ob-mi-login') { event.preventDefault(); $('[data-ob-action="mi-login"]')?.click(); } }
  page.addEventListener('click', handleClick);
  page.addEventListener('change', handleChange);
  page.addEventListener('input', handleInput);
  page.addEventListener('submit', handleSubmit);
  page.addEventListener('keydown', handleKeyDown);

  return {
    back,
    open(options={}) {
      if (destroyed) return;
      generation++;
      active = true;
      busy = false;
      stage = 'sources';
      providerId = null;
      account = null;
      result = null;
      authorizationRequest = null;
      entryBack=options.onBack||onBack;
      directEntry=Boolean(options.providerId);
      clearDraft();
      stopExpiry();
      setView('device-onboarding');
      if(options.providerId==='int')selectProvider('int');else if(options.providerId){const existing=options.accountId?connections.getAccount(options.accountId):null;if(existing?.status==='connected'&&!options.reauthorize)loadDevices(existing);else startConnection(options.providerId,existing);}else topRender();
      $('[data-ob-action="back"]')?.focus({ preventScroll: true });
    },
    onViewChange(nextView) {
      if (nextView === 'device-onboarding') { active = true; return; }
      if (!active) return;
      active = false;
      generation++;
      busy = false;
      stopExpiry();
      userCode = '';
      authorizationRequest = null;
      clearDraft();
    },
    destroy() {
      destroyed = true;
      active = false;
      generation++;
      stopExpiry();
      native.destroy();
      unsubscribeNative();
      page.removeEventListener('click', handleClick);
      page.removeEventListener('change', handleChange);
      page.removeEventListener('input', handleInput);
      page.removeEventListener('submit', handleSubmit);
      page.removeEventListener('keydown', handleKeyDown);
      authorizationRequest = null;
    }
  };
}
