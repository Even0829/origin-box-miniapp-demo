import {seedAccountCase,saveAccountSession,ACCOUNT_BUILD} from './account-store.js?v=simple-invites-20261113';
// Review-only entry point. Each first-use run owns an independent document and data.
export function createFirstUseLauncher({app,capsule,onPause=()=>{},onSharedUpdate=()=>{}}){
  const embedded=new URLSearchParams(location.search).has('first-use-result')&&parent!==window;
  const visibleCapsule=()=>[...app.querySelectorAll('#miniapp-menu,#devices-menu,.fu-result-capsule')].find(node=>node.getClientRects().length)||capsule;
  const send=()=>parent.postMessage({type:'origin-first-use-menu',bottom:visibleCapsule().getBoundingClientRect().bottom||104},location.origin==='null'?'*':location.origin);
  document.addEventListener('visibilitychange',()=>app.classList.toggle('fu-motion-paused',document.hidden));
  if(embedded){document.addEventListener('pointerdown',e=>{if(!e.target.closest('.capsule'))parent.postMessage({type:'origin-first-use-dismiss-menu'},location.origin==='null'?'*':location.origin);});capsule.onclick=send;return {toggle:send};}
  const menu=document.createElement('div');menu.className='fu-demo-menu';menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('aria-label','切换体验状态');app.append(menu);
  const cases=[['visitor','首次使用 · 未登录'],['signed','微信已登录 · 未加入'],['local-box','盒子已本地使用 · 手机首次激活'],['admin','管理员 · 管理已有成员'],['member','普通成员 · 仅管理自己'],['invite','通用邀请 · 创建新身份'],['claim','指定邀请 · 直接认领妈妈'],['invite-expired','身份邀请 · 已过期'],['activation-failed','激活失败后重试'],['sync-failed','激活成功 · 同步待完成'],['login-failed','微信登录失败后重试'],['multiple','发现多个盒子'],['not-found','暂未发现盒子'],['permission','本地网络权限受限'],['claimed','盒子已有管理员'],['offline','已绑定 · 暂时无法连接'],['no-model','已连接 · 暂无空间模型']];
  let frame=null,active='normal',saved=[],returnFocus=null,contextActions=[],normalActions=[],previewFromNormal=false;const sessions=new Set();
  const close=()=>{menu.hidden=true;capsule.setAttribute('aria-expanded','false');if(!frame)onPause(false);};
  function draw(){menu.innerHTML=`<p>账号与成员 · 状态演示</p>${contextActions.length?contextActions.map(a=>`<button role="menuitem" data-fu-action="${a.id}">${a.label}<span aria-hidden="true">›</span></button>`).join('')+'<div class="fu-menu-divider"></div>':''}${cases.map(([key,label])=>`<button role="menuitem" data-fu-case="${key}" ${active===key?'aria-current="true"':''}>${label}<span aria-hidden="true">${active===key?'✓':''}</span></button>`).join('')}<div class="fu-menu-divider"></div><button role="menuitem" data-fu-case="normal" class="fu-reset">恢复正常状态 <span aria-hidden="true">↺</span></button>`;}
  function toggle(bottom){if(!menu.hidden){close();return;}draw();menu.style.top=`${Math.max(54,Math.min(128,bottom??visibleCapsule().getBoundingClientRect().bottom-app.getBoundingClientRect().top))+8}px`;menu.hidden=false;capsule.setAttribute('aria-expanded','true');onPause(true);menu.querySelector('button')?.focus({preventScroll:true});}
  function restore(){close();contextActions=normalActions;for(const token of sessions){sessionStorage.removeItem('origin-account:'+token);sessionStorage.removeItem('origin-account-business:'+token);sessionStorage.removeItem('origin-memory-dialogue:'+token);}sessions.clear();frame?.remove();frame=null;active='normal';for(const [node,value] of saved)if(node.isConnected)node.inert=value;saved=[];onPause(false);(returnFocus?.isConnected?returnFocus:capsule).focus({preventScroll:true});}
  function launch(key){
    if(key==='normal'){restore();return;}
    close();active=key;contextActions=[];previewFromNormal=false;
    if(!frame){returnFocus=capsule;saved=[...app.children].filter(node=>node!==menu).map(node=>[node,node.inert]);saved.forEach(([node])=>node.inert=true);frame=document.createElement('iframe');frame.className='fu-preview-frame';frame.title='首次使用交互体验';app.append(frame);}
    onPause(true);
    const direct=['admin','member','offline','no-model'].includes(key);
    const url=new URL(direct?'index.html':'first-use.html',location.href);url.search='';url.searchParams.set('voice-preview','1');url.searchParams.set('preview-build',ACCOUNT_BUILD);
    if(direct){const token='ac-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);sessions.add(token);saveAccountSession(token,seedAccountCase(key==='member'?'member':'admin'));url.searchParams.set('account-session',token);url.searchParams.set('first-use-result',key==='admin'?'admin-existing':key);if(key==='admin'||key==='member')url.searchParams.set('account-open','profile');}
    else url.searchParams.set('case',key);
    frame.src=url.href;
  }
  function previewSession(state,business,options={}){
    launch('signed');previewFromNormal=true;
    const token='ac-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);sessions.add(token);saveAccountSession(token,state);if(business)sessionStorage.setItem('origin-account-business:'+token,JSON.stringify(business));
    const url=new URL(options.invite?'first-use.html':'index.html',location.href);url.search='';url.searchParams.set('account-session',token);url.searchParams.set('voice-preview','1');url.searchParams.set('preview-build',ACCOUNT_BUILD);
    if(options.invite)url.searchParams.set('invite',options.invite);else{url.searchParams.set('first-use-result',state.actor==='admin'?'admin-existing':'member');url.searchParams.set('account-open','profile');}frame.src=url.href;
  }
  document.addEventListener('account-review-context',e=>{normalActions=e.detail;if(!frame){contextActions=normalActions;if(!menu.hidden)draw();}});
  menu.onclick=async e=>{const action=e.target.closest('[data-fu-action]');if(action){close();if(frame)frame.contentWindow.postMessage({type:'origin-account-action',id:action.dataset.fuAction},location.origin==='null'?'*':location.origin);else document.dispatchEvent(new CustomEvent('account-review-action',{detail:action.dataset.fuAction}));return;}const item=e.target.closest('[data-fu-case]');if(item)launch(item.dataset.fuCase);};
  menu.onkeydown=e=>{const items=[...menu.querySelectorAll('button')],at=items.indexOf(document.activeElement);let next;if(e.key==='ArrowDown')next=(at+1)%items.length;if(e.key==='ArrowUp')next=(at-1+items.length)%items.length;if(e.key==='Home')next=0;if(e.key==='End')next=items.length-1;if(next!==undefined){e.preventDefault();items[next].focus();}};
  document.addEventListener('click',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!capsule.contains(e.target)){close();}},{capture:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){e.preventDefault();e.stopImmediatePropagation();close();capsule.focus({preventScroll:true});}},{capture:true});
  window.addEventListener('message',e=>{if(!frame||e.source!==frame.contentWindow)return;if(location.origin!=='null'&&e.origin!==location.origin)return;if(e.data?.type==='origin-account-shared-update'&&previewFromNormal)onSharedUpdate(e.data.state,e.data.business);if(e.data?.type==='origin-account-context'){contextActions=e.data.actions||[];if(!menu.hidden)draw();}if(e.data?.type==='origin-account-session')sessions.add(e.data.token);if(e.data?.type==='origin-first-use-dismiss-menu')close();if(e.data?.type==='origin-first-use-menu')toggle(Number(e.data.bottom)||100);if(e.data?.type==='origin-first-use-reset')restore();});
  capsule.setAttribute('aria-haspopup','menu');capsule.setAttribute('aria-expanded','false');capsule.onclick=()=>toggle();
  return {toggle:()=>toggle(),restore,previewSession};
}
