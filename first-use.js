import {wifiPage,connectPage,passwordVisibility} from './box-network-ui.js?v=box-wifi-20261117';
import {createBoxNetwork,NETWORK_KEY,NETWORK_BUILD} from './box-network.js?v=box-wifi-20261117';
import {installAccountReviewBridge} from './account-review.js?v=simple-invites-20261113';
import {createAccountStore,loadAccountSession,saveAccountSession,JOIN_INVITE,CLAIM_INVITE} from './account-store.js?v=simple-invites-20261113';
import {esc,arrow,backIcon,spinner,memberForm,readMemberForm,memberFormError,bindRoleForm,installAccountKeyboard} from './account-ui.js?v=simple-invites-20261113';
const params=new URLSearchParams(location.search),scenario=params.get('case')||'visitor';
const token=params.get('account-session')||'ac-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
const stored=loadAccountSession(token);const store=createAccountStore({scenario:params.has('account-session')&&!stored?'visitor':scenario,initial:stored,persist:value=>{saveAccountSession(token,value);if(parent!==window)parent.postMessage({type:'origin-account-shared-update',state:value},location.origin==='null'?'*':location.origin);}});
if(stored&&params.get('recipient')==='1'){const inv=store.invitation(params.get('invite'));store.switchActor(inv.ok&&inv.invite.kind==='claim'?'mom':store.snapshot().members.some(m=>m.accountId==='wx-receiver')?'guest':'receiver');}
saveAccountSession(token,store.snapshot());
if(!params.has('account-session')){const url=new URL(location.href);url.searchParams.set('account-session',token);history.replaceState(null,'',url);}
if(parent!==window)parent.postMessage({type:'origin-account-session',token},location.origin==='null'?'*':location.origin);
let savedNetwork=null;try{savedNetwork=JSON.parse(sessionStorage.getItem(NETWORK_KEY+token));}catch{}
const network=createBoxNetwork({initial:savedNetwork,persist:value=>sessionStorage.setItem(NETWORK_KEY+token,JSON.stringify(value))});
const root=document.querySelector('#fu-root'),app=document.querySelector('#app'),dialog=document.querySelector('#fu-login'),loginBody=document.querySelector('#fu-login-body');
let ui={page:'home',tab:'home',phase:'',error:'',intent:'',login:false,busy:false,inviteId:params.get('invite')||(['claim','invite-expired','invite-cancelled'].includes(store.snapshot().scenario)?CLAIM_INVITE:store.snapshot().scenario==='invite'?JOIN_INVITE:''),invitation:null,selected:null,boxes:[],draft:{name:'',role:'',birthday:''},setup:null};
ui.wifi={ssid:'Pandora_Home',password:'',secure:true,manual:false,show:false,picker:false};ui.attempt=null;
let generation=0,timers=new Set(),toastTimer;
const guest=cls=>`<span class="fu-guest-avatar ${cls}"><img src="assets/guest-avatar.svg" alt="未登录头像"></span>`;
const capsule=()=>'<button class="capsule" data-action="menu" aria-label="小程序菜单"><img src="assets/miniapp-capsule.png" alt=""></button>';
const header=(title,back=false)=>`<header class="fu-header">${back?`<button class="icon-button fu-back" data-action="back" aria-label="返回">${backIcon}</button>`:''}<h1>${title}</h1>${capsule()}</header>`;
const house=()=>'<div class="fu-house-art"><img src="assets/mine-family-house.png" alt=""></div>';
function notify(text){clearTimeout(toastTimer);const t=document.querySelector('#fu-toast');t.textContent=text;t.hidden=false;toastTimer=setTimeout(()=>t.hidden=true,2600);}
function cancel(){generation++;network.cancel();timers.forEach(clearTimeout);timers.clear();ui.busy=false;}
function later(fn,ms=800){const v=generation;const id=setTimeout(()=>{timers.delete(id);if(v===generation)fn();},ms);timers.add(id);}
function needsSetup(){return store.current()?.permission==='admin'&&store.snapshot().setupComplete===false;}
function enter(open=''){cancel();const me=store.current();if(!me)return;if(needsSetup()){showSetup();return;}const state=store.snapshot();saveAccountSession(token,state);const url=new URL('index.html',location.href);url.search='';url.searchParams.set('voice-preview','1');url.searchParams.set('account-session',token);url.searchParams.set('first-use-result',me.permission==='admin'?(state.familyFresh?'admin':'admin-existing'):'member');if(open)url.searchParams.set('account-open',open);url.searchParams.set('preview-build',NETWORK_BUILD);location.replace(url.href);}
function start(){cancel();ui.error='';ui.intent='connect';if(needsSetup()){showSetup();return;}if(!store.snapshot().loggedIn){ui.login=true;render();}else proceed();}
function proceed(){ui.login=false;if(ui.intent==='connect')search();else if(ui.intent==='join-submit'){render();submit();}else render();}
function login(){if(ui.busy)return;ui.busy=true;ui.error='';render();later(()=>{if(scenario==='login-failed'&&!ui.failedLogin){ui.failedLogin=true;ui.busy=false;ui.error='微信登录暂未完成，请重试';render();return;}store.login();ui.busy=false;proceed();});}
function search(){
 cancel();ui.page='connect';ui.phase='searching';ui.error='';ui.busy=true;render();
 later(()=>{
  ui.busy=false;
  if(['not-found','permission','bluetooth-off'].includes(scenario)&&!ui.retriedSearch){ui.phase=scenario;render();return;}
  ui.boxes=network.discover([{id:'0829',claimed:scenario==='claimed',online:['already-online','local-box','claimed'].includes(scenario)},...(scenario==='multiple'?[{id:'0618',claimed:false,online:true}]:[])]);
  ui.selected=network.current()?.id||null;ui.phase='found';render();
 },1100);
}
function readWifi(){const ssid=root.querySelector('#wifi-ssid'),password=root.querySelector('#wifi-password');if(ssid)ui.wifi.ssid=ssid.value;if(password)ui.wifi.password=password.value;}
function configure(){
 if(ui.busy||!network.current()||network.current().claimed)return;
 cancel();ui.page='wifi';ui.error='';ui.wifi.picker=false;
 if(network.current().ssid)ui.wifi.ssid=network.current().ssid;
 render();
}
function connectSelected(){if(ui.busy)return;const box=network.current();if(!box||box.claimed)return;if(!box.online){configure();return;}verifyNetwork();}
function provision(){
 if(ui.busy||ui.page!=='wifi')return;readWifi();
 if(!ui.wifi.ssid.trim()){ui.error='请填写 Wi-Fi 名称';render();return;}
 if(ui.wifi.secure&&!ui.wifi.password){ui.error='请输入 Wi-Fi 密码';render();return;}
 cancel();ui.attempt=network.begin();if(!ui.attempt)return;
 ui.provisioned=true;ui.page='connect';ui.busy=true;ui.error='';ui.phase='sending';render();
 later(()=>{
  ui.phase='wifi-connecting';render();
  later(()=>{
   if(['wifi-password','wifi-failed'].includes(scenario)&&!ui.failedWifi){
    ui.failedWifi=true;ui.busy=false;ui.page='wifi';ui.error=scenario==='wifi-password'?'Wi-Fi 密码不正确，请检查后重新连接。':'盒子暂未连接到 Wi-Fi，请确认网络可用，并将盒子靠近路由器后重试。';render();return;
   }
   if(!network.connected(ui.attempt,ui.wifi.ssid.trim()))return;
   ui.wifi.password='';verifyNetwork(true);
  },1600);
 },850);
}
function verifyNetwork(fromWifi=false){
 if(!fromWifi){cancel();ui.attempt=network.begin();}
 if(!network.canActivate(ui.attempt))return;
 ui.page='connect';ui.phase='verifying-network';ui.busy=true;ui.error='';render();
 later(()=>{
  if(['lan-mismatch','lan-permission'].includes(scenario)&&!ui.failedLan){ui.failedLan=true;ui.busy=false;ui.phase=scenario;render();return;}
  activate();
 },1150);
}
function activate(){
 if(!network.canActivate(ui.attempt))return;
 ui.busy=true;ui.phase='activating';ui.error='';render();
 later(()=>{
  if(scenario==='activation-failed'&&!ui.failedActivation){ui.failedActivation=true;ui.busy=false;ui.phase='activation-error';ui.error='盒子已联网，激活暂未完成。请重试，无需重新配置 Wi-Fi。';render();return;}
  if(!network.canActivate(ui.attempt))return;
  const r=store.activate();if(!r.ok){ui.busy=false;ui.phase='activation-error';ui.error=r.message;render();return;}
  sync();
 },1200);
}
function retryActivation(){if(ui.busy)return;cancel();ui.attempt=network.begin();activate();}
function sync(){cancel();ui.phase='syncing';ui.busy=true;render();later(()=>{if(scenario==='sync-failed'&&!ui.failedSync){ui.failedSync=true;ui.busy=false;ui.phase='sync-error';render();return;}enter();},1000);}
function showSetup(){cancel();ui.page='setup';ui.error='';if(!ui.setup){const m=store.current(),s=store.snapshot();ui.setup={familyName:s.familyFresh?'':s.familyName,name:m.name,role:m.role,birthday:m.birthday};}render();}
function setup(){const form=memberForm(ui.setup,store,{prefix:'setup',note:false}).replace('<div class="ac-fields">',`<div class="ac-fields"><div class="ac-field"><label for="setup-family-name">家庭名称</label><input id="setup-family-name" maxlength="20" required placeholder="必填" value="${esc(ui.setup.familyName)}"></div>`).replace('>昵称</label>','>管理员昵称</label>');return `${header('设置基本信息',true)}<main class="fu-scroll"><p class="fu-page-caption">盒子已连接，补充家庭和你的基本信息即可开始使用。</p>${form}<p class="ac-note">家庭名称、管理员昵称必填；家庭角色和生日选填。</p></main><footer class="fu-actions"><button class="primary-button" data-action="save-setup" ${ui.busy?'disabled':''}>${ui.busy?spinner+'正在创建…':'完成并进入家庭'}</button></footer>`;}
function saveSetup(){if(ui.busy)return;ui.setup={...readMemberForm(root,'setup'),familyName:root.querySelector('#setup-family-name').value};const result=store.completeSetup(ui.setup);if(!result.ok){root.querySelector('#setup-error').textContent=result.message;return;}ui.busy=true;render();later(()=>enter(),650);}
function verifyInvite(){cancel();ui.error='';ui.invitation=null;ui.page='join';ui.phase='verifying';ui.busy=true;render();later(()=>{const r=store.inviteTarget(ui.inviteId);ui.busy=false;if(!r.ok){ui.phase='invalid-invite';ui.error=r.message;}else{ui.invitation=r;ui.phase='invitation';}render();},650);}
function submit(){
 if(ui.busy)return;
 const inv=ui.invitation?.invite;if(!inv)return;
 if(ui.invitation.alreadyJoined){enter();return;}
 if(inv.kind==='new'){
  if(root.querySelector('#join-name'))ui.draft=readMemberForm(root,'join');
  const local=memberFormError(root,'join'),check=store.validate(ui.draft);
  if(local||!check.ok){root.querySelector('#join-error').textContent=local||check.message;return;}
 }
 if(!store.snapshot().loggedIn){ui.intent='join-submit';ui.login=true;ui.error='';render();return;}
 ui.busy=true;ui.error='';const button=root.querySelector('[data-action=submit-join]');button.disabled=true;button.innerHTML=spinner+(inv.kind==='claim'?'正在认领…':'正在加入…');
 later(()=>{const result=inv.kind==='claim'?store.acceptClaim(ui.inviteId):store.join(ui.inviteId,ui.draft);ui.busy=false;if(!result.ok){ui.error=result.message;render();return;}enter();},800);
}
function home(){const signed=store.snapshot().loggedIn,local=store.snapshot().localUsed;
 if(ui.tab==='profile'){const r=(action,title,note)=>`<button class="mp-menu-row" data-action="${action}"><span><strong>${title}</strong><small>${note}</small></span>${arrow}</button>`;return `<section class="fu-profile-page"><header class="mp-header"><h1>个人中心</h1><div class="mp-header-decoration" aria-hidden="true"><img class="mp-header-art" src="assets/mine-header-art.png" alt=""><span class="mp-header-overlay"><img src="assets/mine-header-overlay.svg" alt=""></span></div>${capsule()}<button class="mp-profile" data-action="connect">${signed?'<img class="mp-profile-avatar" src="assets/mine-avatar.png" alt="个人头像">':guest('mp-profile-avatar')}<span class="mp-profile-copy"><strong>${signed?esc(store.actor().name):'尚未登录'}</strong><small>${needsSetup()?'盒子已连接，待完善资料':signed?'尚未连接盒子':'登录后连接你的盒子'}</small></span></button></header><main class="mp-scroll"><div class="mp-menu-group">${r('connect','连接我的盒子','首次连接并激活后，成为管理员')}</div><div class="mp-menu-group">${r('help','帮助与关于','连接、加入与使用说明')}${r('privacy','隐私与数据','隐私政策与数据相关协议')}</div></main></section>`;}
 if(ui.tab!=='home')return `${header(ui.tab==='devices'?'设备':'记忆')}<main class="fu-home-body"><h2 class="fu-home-title">${ui.tab==='devices'?'让小元连接家中的设备':'让小元慢慢了解你'}</h2><p class="fu-home-description">连接盒子后，${ui.tab==='devices'?'查看设备状态并使用日常控制':'查看家庭共享记忆与自己的个人记忆'}。</p><div class="fu-home-choices"><button class="fu-choice" data-action="connect"><span><strong>连接我的盒子</strong><small>建立家庭连接</small></span>${arrow}</button></div></main>`;
 return `${header('你好，主人～')}<main class="fu-home-body"><h2 class="fu-home-title">从这里，创建你的家</h2><p class="fu-home-description">${needsSetup()?'盒子已连接，继续完善家庭和你的基本信息。':local?'连接后延续已有空间、成员和记忆。':'连接引元盒子，让小元开始照看你的家。'}</p><div class="fu-home-visual"><span class="mp-house-art"><img src="assets/mine-family-house.png" alt="家庭房屋"></span></div><div class="fu-home-choices"><button class="fu-choice" data-action="connect"><span class="fu-choice-art" aria-hidden="true"><img src="assets/nav-devices.svg" alt=""></span><span><strong>${needsSetup()?'继续设置':'连接我的盒子'}</strong><small>${needsSetup()?'保留连接结果，无需再次激活':'首次激活，你将成为管理员'}</small></span>${arrow}</button></div><p class="fu-note">盒子无需登录也可本地使用；手机连接后可随身查看与操作。</p></main>`;
}
function connect(){return connectPage({ui,network,store,header,house});}
function wifi(){return wifiPage({ui,header,house});}
function invitationAccount(){return `<p class="fu-account-state">${store.snapshot().loggedIn?'当前账号 · '+esc(store.actor().name):'登录后继续使用这份邀请'}</p>`;}
function join(){
 if(ui.phase==='declined')return `${header('加入家庭',true)}<main class="fu-scroll"><div class="ac-empty"><h2>你尚未加入家庭</h2><p>家庭资料和身份保持不变。需要时可继续接受这份邀请。</p></div></main><footer class="fu-actions"><button class="primary-button" data-action="resume-invite">返回邀请</button></footer>`;
 const data=ui.invitation;
 if(!data)return `${header('加入家庭',true)}<main class="fu-scroll"><div class="ac-empty" role="${ui.phase==='verifying'?'status':'region'}">${ui.phase==='verifying'?spinner:''}<h2>${ui.phase==='verifying'?'正在打开邀请':'邀请链接无法使用'}</h2><p>${ui.phase==='verifying'?'正在核对邀请信息…':esc(ui.error||'请从管理员发送的邀请链接进入。')}</p>${ui.phase==='verifying'?'':'<p>请联系管理员重新发送邀请链接。</p>'}</div></main>`;
 const inv=data.invite;
 const intro=`<div class="ac-join-intro"><h2>${esc(data.familyName)}</h2><p>${inv.kind==='claim'?'邀请你认领已建立的成员身份':'创建自己的身份，一起使用小元'}</p></div>`;
 if(data.alreadyJoined)return `${header('加入家庭',true)}<main class="fu-scroll">${intro}<p class="ac-note">你已使用「${esc(store.current().name)}」身份加入这个家庭。</p>${invitationAccount()}</main><footer class="fu-actions"><button class="primary-button" data-action="enter">进入家庭</button></footer>`;
 if(inv.kind==='claim')return `${header('接受身份邀请',true)}<main class="fu-scroll">${intro}<div class="ac-target"><span class="ac-member-avatar"><img src="assets/person-default.png" alt=""></span><strong>${esc(data.target.name)}</strong><small>${data.target.role&&data.target.role!==data.target.name?esc(data.target.role)+' · ':''}暂未认领身份</small></div><p class="ac-note">管理员已为你指定身份，确认认领后即可延续原有资料与个人记忆。</p>${invitationAccount()}${ui.error?`<p class="fu-error" role="alert">${esc(ui.error)}</p>`:''}</main><footer class="fu-actions"><button class="primary-button" data-action="submit-join">${store.snapshot().loggedIn?'确认认领':'登录并认领'}</button><button class="fu-text-button" data-action="decline">暂不接受</button></footer>`;
 const content='<p class="mp-section-caption">昵称必填，家庭角色和生日选填。</p>'+memberForm(ui.draft,store,{prefix:'join',note:false});
 return `${header('加入家庭',true)}<main class="fu-scroll">${intro}${content}${invitationAccount()}${ui.error?`<p class="fu-error" role="alert">${esc(ui.error)}</p>`:''}</main><footer class="fu-actions"><button class="primary-button" data-action="submit-join">${store.snapshot().loggedIn?'创建并加入':'登录并加入'}</button><button class="fu-text-button" data-action="decline">暂不加入</button></footer>`;
}
function render(){root.innerHTML=ui.page==='wifi'?wifi():ui.page==='connect'?connect():ui.page==='join'?join():ui.page==='setup'?setup():home();app.dataset.fuPage=ui.page;app.dataset.fuTab=ui.tab;document.querySelector('.tabbar').hidden=ui.page!=='home';document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-current',b.dataset.tab===ui.tab?'page':'false'));if(ui.page==='setup')bindRoleForm(root,'setup',{store,memberId:store.current()?.id});else bindRoleForm(root,'join',{store});
 if(ui.login){loginBody.innerHTML=`<button class="fu-login-close" data-action="cancel-login" aria-label="取消登录">×</button>${guest('fu-login-avatar')}<h2>微信登录引元</h2><p>登录后继续${ui.intent==='connect'?'连接盒子':'加入家庭'}<br>首次登录自动创建账号</p>${ui.error?`<p class="fu-error" role="alert">${esc(ui.error)}</p>`:''}<button class="primary-button fu-wechat-login" data-action="login" ${ui.busy?'disabled':''}>${ui.busy?'正在登录…':'微信登录'}</button><button class="fu-text-button" data-action="cancel-login">暂不登录</button><p class="fu-login-privacy"><button data-action="privacy">隐私政策与数据相关协议</button></p>`;if(!dialog.open)dialog.showModal();}else if(dialog.open)dialog.close();}
function back(){if(ui.page==='wifi'){readWifi();cancel();ui.page='connect';ui.phase='found';ui.error='';render();return;}if(ui.page==='setup'){cancel();ui.page='home';ui.tab='home';render();return;}if(store.current()){enter();return;}cancel();ui.login=false;ui.error='';if(ui.page==='join'){ui.phase='declined';render();return;}ui.page='home';render();}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const action=b.dataset.action;if(action==='menu'){parent.postMessage({type:'origin-first-use-menu',bottom:b.getBoundingClientRect().bottom},location.origin);return;}if(action==='decline'){ui.phase='declined';render();return;}if(action==='resume-invite'){verifyInvite();return;}if(action==='connect')start();else if(action==='login')login();else if(action==='cancel-login'){cancel();ui.login=false;ui.error='';render();}else if(action==='back')back();else if(action==='retry-search'){ui.retriedSearch=true;search();}else if(action==='activate')connectSelected();else if(action==='provision')provision();else if(action==='configure')configure();else if(action==='retry-network')verifyNetwork();else if(action==='retry-activation')retryActivation();else if(action==='show-password'){readWifi();ui.wifi.show=!ui.wifi.show;passwordVisibility(b,root.querySelector('#wifi-password'),ui.wifi.show);}else if(action==='choose-network'){readWifi();ui.wifi.manual=false;ui.wifi.picker=!ui.wifi.picker;render();}else if(action==='manual-network'){readWifi();ui.wifi.manual=true;ui.wifi.secure=true;ui.wifi.picker=false;ui.wifi.ssid='';ui.wifi.password='';ui.error='';render();root.querySelector('#wifi-ssid')?.focus();}else if(action==='sync')sync();else if(action==='enter')enter();else if(action==='submit-join')submit();else if(action==='save-setup')saveSetup();else if(action==='privacy')notify('相关协议内容待补充');else if(action==='help')notify('开启蓝牙靠近盒子，按提示配置 Wi-Fi 并激活；家人通过管理员发送的邀请链接加入');});
root.addEventListener('click',e=>{const b=e.target.closest('[data-box]');if(b&&!ui.busy){if(ui.selected!==b.dataset.box)ui.wifi={ssid:'Pandora_Home',password:'',secure:true,manual:false,show:false,picker:false};network.select(b.dataset.box);ui.selected=b.dataset.box;ui.error='';ui.phase='found';render();}const n=e.target.closest('[data-network]');if(n&&!ui.busy){ui.wifi={...ui.wifi,ssid:n.dataset.network,secure:n.dataset.secure==='true',password:'',manual:false,picker:false};ui.error='';render();}});root.addEventListener('input',e=>{if(ui.page==='wifi'){readWifi();ui.error='';root.querySelector('.fu-error')?.remove();}if(e.target.closest('.ac-form')){if(ui.page==='setup'){ui.setup={...readMemberForm(root,'setup'),familyName:root.querySelector('#setup-family-name').value};root.querySelector('#setup-error').textContent='';}else ui.draft=readMemberForm(root,'join');}});
root.addEventListener('keydown',e=>{if(ui.page==='wifi'&&e.key==='Enter'&&e.target.matches('input')){e.preventDefault();provision();}});
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{cancel();ui.tab=b.dataset.tab;ui.page='home';render();});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('[data-action=menu]'))parent.postMessage({type:'origin-first-use-dismiss-menu'},location.origin);});
dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();ui.login=false;render();});window.addEventListener('pagehide',cancel);
if(ui.inviteId){ui.page='join';ui.intent='join';verifyInvite();}else if(store.current())enter();else render();

installAccountKeyboard(root);
installAccountReviewBridge(app);
