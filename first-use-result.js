// Adapt the existing product pages inside the isolated completed-journey frame.
export function mountFirstUseResult({mode,app,store,toast,onRefresh,onMenu,getRooms=()=>[],onAddRoom,onAddDevice}){
  const member=mode==='member',offline=mode==='offline';
  if(member){
    app.dataset.firstUseRole='member';
    app.querySelector('#home-name').setAttribute('aria-label','查看家庭信息');
    app.querySelector('#devices-family')?.setAttribute('aria-label','查看家庭信息');
    const manage=app.querySelector('#manage-spaces');manage.hidden=true;
    app.addEventListener('click',e=>{const target=e.target.closest('#device-settings,#devices-add,#dd-settings,[data-settings-action],[data-mp="invite"],[data-mp="invite-family"],[data-mp="family-name"]');if(target){e.preventDefault();e.stopImmediatePropagation();toast('此项由管理员维护');}},{capture:true});
  }
  if(offline){
    app.dataset.boxConnection='unavailable';
    const banner=document.createElement('aside');banner.className='fu-connection-banner';banner.setAttribute('role','status');banner.innerHTML='<button type="button">重新连接</button><strong>暂时无法连接引元盒子</strong><small>保留上次信息 · 25分钟前更新，当前状态待确认</small>';app.querySelector('.home-header').after(banner);
    const button=banner.querySelector('button');let pending=false;
    button.onclick=()=>{if(pending)return;pending=true;button.disabled=true;button.textContent='连接中…';setTimeout(()=>{delete app.dataset.boxConnection;for(const d of store.getDevices())if(d.previewOnline)store.patch(d.id,{online:true});banner.remove();app.querySelector('.hc-modes')?.removeAttribute('inert');onRefresh();toast('盒子连接已恢复，正在更新家庭信息');},1200);};
    app.addEventListener('click',e=>{if(app.dataset.boxConnection!=='unavailable')return;const target=e.target.closest('#voice-entry,.hc-modes button,.hs-card [data-action],.hc-current-mode');if(target){e.preventDefault();e.stopImmediatePropagation();toast('盒子连接待恢复，暂时不能执行家庭操作');}},{capture:true});
    const context=app.querySelector('#home-context');context.querySelector('.hc-modes')?.setAttribute('inert','');context.querySelector('.hc-room-status')?.setAttribute('aria-label','空间状态待更新，查看最后已知信息');
  }
  if(mode==='admin'){
    const empty=document.createElement('section');empty.className='fu-new-family';empty.setAttribute('aria-label','新家庭尚无空间与设备');app.querySelector('#home-context').before(empty);
    let last='';const refresh=()=>{const rooms=getRooms().length,devices=store.getDevices().length,key=`${rooms}:${devices}`;if(key===last)return;last=key;empty.hidden=devices>0;app.querySelector('#home-context').classList.toggle('fu-context-empty',devices===0);empty.innerHTML=`<div class="fu-radar-stage" aria-hidden="true"><img src="assets/space-radar.png" alt=""></div><span class="fu-radar-caption">暂未接入空间建模设备</span><h2>从这里，开始了解你的家</h2><p>${rooms?`已添加${rooms}个空间，接入设备后<br>小元就能了解家中的近况`:'可以先添加空间，也可以直接接入设备'}</p><div><button class="primary-button" data-new-room>添加空间</button><button class="secondary-button" data-new-device>接入设备</button></div><small>随时可以继续，无需一次设置完成</small>`;empty.querySelector('[data-new-room]').onclick=onAddRoom;empty.querySelector('[data-new-device]').onclick=onAddDevice;};
    refresh();store.subscribe(refresh);const observer=new MutationObserver(refresh);observer.observe(app.querySelector('#home-context'),{subtree:true,childList:true});window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
  }
  // Keep the review menu reachable from My and inner product views as well.
  const menu=document.createElement('button');menu.className='capsule fu-result-capsule';menu.setAttribute('aria-label','打开体验状态菜单');menu.innerHTML='<img src="assets/miniapp-capsule.png" alt="">';menu.onclick=onMenu;app.append(menu);
}
