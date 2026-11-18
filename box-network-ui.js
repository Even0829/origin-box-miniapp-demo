import {esc,arrow,spinner} from './account-ui.js?v=simple-invites-20261113';
const eye=show=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>${show?'':'<path d="m4 3 16 18"/>'}</svg>`;
export function passwordVisibility(button,input,show){input.type=show?'text':'password';button.innerHTML=eye(show);button.setAttribute('aria-label',show?'隐藏密码':'显示密码');button.setAttribute('aria-pressed',String(show));}
export function wifiPage({ui,header,house}){
 const w=ui.wifi;
 const field=w.manual?`<label for="wifi-ssid">Wi-Fi 名称</label><input id="wifi-ssid" maxlength="32" autocomplete="off" placeholder="输入完整网络名称" value="${esc(w.ssid)}">`:`<span>Wi-Fi 名称</span><strong>${esc(w.ssid)}</strong><button class="fu-network-change" data-action="choose-network" aria-expanded="${w.picker}">更换</button>`;
 return `${header('为盒子连接 Wi-Fi',true)}<main class="fu-scroll fu-wifi-scroll"><div class="fu-wifi-intro">${house()}<h2>让盒子连上家中的网络</h2><p>请选择手机当前连接的家庭 Wi-Fi，<br>联网后将自动继续激活。</p></div><div class="fu-network-box-label">引元盒子 · 尾号 ${esc(ui.selected)}</div><div class="fu-wifi-fields"><div class="fu-wifi-field">${field}</div>${w.secure?`<div class="fu-wifi-field"><label for="wifi-password">Wi-Fi 密码</label><input id="wifi-password" type="${w.show?'text':'password'}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="请输入 Wi-Fi 密码" value="${esc(w.password)}"><button class="fu-password-toggle" data-action="show-password" aria-label="${w.show?'隐藏':'显示'}密码" aria-pressed="${w.show}">${eye(w.show)}</button></div>`:'<div class="fu-wifi-field fu-open-network">此网络无需密码</div>'}</div>${w.picker?`<div class="fu-network-picker" aria-label="选择 Wi-Fi"><p>选择家庭网络</p>${[{ssid:'Pandora_Home',secure:true},{ssid:'Pandora_Guest',secure:false}].map(n=>`<button data-network="${n.ssid}" data-secure="${n.secure}"><span>${n.ssid}</span><small>${n.secure?'需要密码':'开放网络'}</small>${n.ssid===w.ssid?'<span aria-label="已选择">✓</span>':''}</button>`).join('')}<button data-action="manual-network">手动输入其他网络${arrow}</button></div>`:''}<button class="fu-manual-network" data-action="${w.manual?'choose-network':'manual-network'}">${w.manual?'从网络列表选择':'手动输入网络名称'}</button>${ui.error?`<p class="fu-error" role="alert">${esc(ui.error)}</p>`:''}<p class="fu-network-footnote">连接时请保持手机靠近盒子。<br>Wi-Fi 密码仅用于本次连接。</p></main><footer class="fu-actions"><button class="primary-button" data-action="provision">连接并激活</button></footer>`;
}
function progress(ui,network){
 const stages=[['sending','发送网络信息'],['wifi-connecting','盒子连接 Wi-Fi'],['verifying-network','核验手机与盒子连接'],['activating','激活引元盒子'],['syncing','同步家庭信息']];
 const at=stages.findIndex(([key])=>key===ui.phase);
 // Keep completed Wi-Fi steps visible for this run; already-online boxes skip them.
 const visible=ui.provisioned?stages:stages.slice(2);
 return `<ol class="fu-progress">${visible.map(([key,label])=>{const i=stages.findIndex(([k])=>k===key);return `<li class="${i<at?'done':i===at?'current':''}">${label}</li>`;}).join('')}</ol>`;
}
export function connectPage({ui,network,store,header,house}){
 let body='',footer='';
 const progressing=['sending','wifi-connecting','verifying-network','activating','syncing'].includes(ui.phase);
 if(ui.phase==='searching')body=`<div class="fu-loading" role="status">${spinner}<h2>正在寻找附近的盒子</h2><p>请开启手机蓝牙，靠近已通电的引元盒子。</p></div>`;
 if(progressing){
  const title={sending:'正在发送网络信息','wifi-connecting':'盒子正在连接 Wi-Fi','verifying-network':'正在核验连接',activating:'正在激活引元盒子',syncing:'正在准备家庭信息'}[ui.phase];
  const desc={sending:'请保持手机靠近盒子。','wifi-connecting':'稍等片刻，连接完成后将自动继续。','verifying-network':'确认手机与盒子位于同一局域网。',activating:'完成后，你将成为家庭管理员。',syncing:store.snapshot().familyFresh?'即将设置家庭和你的基本信息。':'保留已有的空间、成员与记忆。'}[ui.phase];
  body=`<div class="fu-loading fu-network-loading" role="status" aria-live="polite">${spinner}<h2>${title}</h2><p>${desc}</p>${progress(ui,network)}</div>`;
 }
 if(['permission','not-found','bluetooth-off'].includes(ui.phase)){
  const title={permission:'需要允许蓝牙访问','bluetooth-off':'请先开启手机蓝牙','not-found':'暂未发现引元盒子'}[ui.phase];
  const desc={permission:'请在手机系统和微信权限设置中允许蓝牙访问，再回来重新查找。','bluetooth-off':'开启蓝牙后，靠近已通电的盒子，再次查找。','not-found':'请确认盒子已通电，并将手机靠近盒子。开启蓝牙后可重新查找。'}[ui.phase];
  body=`<div class="fu-empty-state">${house()}<h2>${title}</h2><p>${desc}</p></div>`;footer='<button class="primary-button" data-action="retry-search">重新查找</button>';
 }
 if(['found','activation-error'].includes(ui.phase)){
  const selected=network.current();
  body=`<div class="ac-connect-intro">${house()}<h2>找到家中的引元盒子</h2><p>${ui.phase==='activation-error'?'联网已完成，可以继续激活。':'连接后，让小元开始照看你的家。'}</p></div><div class="fu-box-list">${ui.boxes.map(b=>{const actual=network.snapshot().boxes[b.id];return `<button class="fu-box ${ui.selected===b.id?'selected':''}" data-box="${b.id}" aria-pressed="${ui.selected===b.id}"><span><strong>引元盒子</strong><small>设备尾号 ${b.id} · ${b.claimed?'已有管理员':actual.online?'已联网':'待联网'}</small></span><span class="fu-radio" aria-hidden="true"></span></button>`;}).join('')}</div><p class="fu-account-state">当前账号 · ${esc(store.actor().name)}</p>${selected?.claimed?'<p class="fu-error">该盒子已有管理员，请联系管理员发送邀请链接。</p>':''}${ui.error?`<p class="fu-error" role="alert">${esc(ui.error)}</p>`:''}`;
  footer=`<button class="primary-button" data-action="${ui.phase==='activation-error'?'retry-activation':'activate'}" ${!selected||selected.claimed?'disabled':''}>${ui.phase==='activation-error'?'重试激活':selected?.online?'连接并激活':'配置 Wi-Fi'}</button><button class="fu-text-button" data-action="retry-search">重新查找</button>`;
 }
 if(['lan-mismatch','lan-permission'].includes(ui.phase)){
  const ssid=network.current()?.ssid||'盒子所连接的网络';
  body=`<div class="fu-empty-state">${house()}<h2>${ui.phase==='lan-permission'?'需要允许本地网络访问':'盒子已联网，手机还需同网'}</h2><p>${ui.phase==='lan-permission'?'请在手机设置中允许微信访问本地网络，完成后返回继续。':`请将手机连接到「${esc(ssid)}」，再回来继续激活。`}</p><div class="fu-network-result"><span class="fu-result-dot"></span>盒子已连接 ${esc(ssid)}</div><p class="fu-network-footnote">联网结果已保留，无需重新配置。</p></div>`;
  footer=`<button class="primary-button" data-action="retry-network">${ui.phase==='lan-permission'?'重新验证':'我已切换，继续验证'}</button><button class="fu-text-button" data-action="configure">为盒子更换 Wi-Fi</button>`;
 }
 if(ui.phase==='sync-error'){body=`<div class="fu-empty-state">${house()}<h2>已激活，家庭信息待同步</h2><p>你的管理员身份已经建立，可以稍后继续同步。</p></div>`;footer='<button class="primary-button" data-action="sync">重新同步</button><button class="fu-text-button" data-action="enter">稍后继续</button>';}
 const caption=ui.phase==='searching'||ui.phase==='found'?'开启蓝牙，靠近已通电的盒子':progressing?'连接完成后将自动继续，请保持页面打开。':'';
 return `${header('连接引元盒子',true)}<main class="fu-scroll">${caption?`<p class="fu-page-caption">${caption}</p>`:''}${body}</main>${footer?`<footer class="fu-actions">${footer}</footer>`:''}`;
}
