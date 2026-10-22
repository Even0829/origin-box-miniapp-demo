import { formatDeviceReading } from './device-readings.js?v=source-data-20261019';

const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const readingTimeFormat=new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'});

/** Device browsing and capability presentation share the family's device store. */
export function createDevicesPage({page,store,getRooms,getFamilyName,setView,openSheet,toast,icon,onSettings,onAddDevice,onFamilyName,onMenu,onDeviceDetail}){
  const $=selector=>page.querySelector(selector),sheet=()=>document.querySelector('#sheet');
  const rooms=()=>getRooms(),devices=()=>store.getDevices(),roomName=id=>rooms().find(room=>room.id===id)?.name??'未设置空间';
  let filter='all',heroRoomId=rooms()[0]?.id,heroElapsed=0,lastTick=performance.now(),wasPaused=true,returnScroll=0;
  let destroyed=false,transitionVersion=0,transitionTimer=null,previewStarted=false,interactionUntil=0,contextRoomId=null,contextMode=null,heroVisible=true,popupOpen=false,pickerSignature='';
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  page.classList.add('devices-page');
  page.innerHTML=`<div class="devices-scroll" id="devices-scroll">
    <header class="home-header devices-header"><div class="header-row">
      <button class="home-name" id="devices-family" aria-label="管理家庭名称"><span id="devices-family-name"></span><span class="asset chevron-home"><img src="assets/chevron-home.svg" alt=""></span></button>
      <button class="manage-button" id="devices-add">新增设备</button>
      <button class="capsule" id="devices-menu" aria-label="小程序菜单"><img src="assets/miniapp-capsule.png" alt=""></button>
    </div><p class="device-summary" id="devices-summary"></p></header>
    <section class="device-space-hero" aria-label="设备的空间能力与调度">
      <div class="device-house" aria-hidden="true"><img src="assets/home-house.png" alt=""></div>
      <div class="device-room-picker"><button class="device-room-chip" id="device-room-chip" aria-label="选择空间能力" aria-haspopup="listbox" aria-expanded="false" aria-controls="device-room-popup"><span id="device-hero-room"></span><span class="device-room-arrow" aria-hidden="true"><img src="assets/device-space-arrow.svg" alt=""></span></button><div class="device-room-popup" id="device-room-popup" role="listbox" aria-label="选择设备空间" hidden></div></div>
      <button class="device-capability-float device-capability-input hero-dynamic" id="device-input-summary" aria-label="查看空间的信息来源"></button>
      <button class="device-capability-float device-capability-response hero-dynamic" id="device-response-summary" aria-label="查看空间的调节设备"></button>
    </section>
    <section class="devices-section" aria-labelledby="devices-section-title">
      <div class="device-browser-header" id="device-browser-header">
      <h1 id="devices-section-title" class="devices-section-title"><span class="asset device-layers-icon"><img src="assets/device-layers-sticky.svg" alt=""></span>空间设备</h1>
      <button class="capsule device-sticky-menu" id="device-sticky-menu" aria-label="小程序菜单" hidden><img src="assets/miniapp-capsule.png" alt=""></button>
      <div class="device-filter-row"><div class="device-filters" id="device-filters" role="tablist" aria-label="按空间查看设备"></div><button id="device-settings" class="device-settings-button"><span class="asset device-settings-icon"><img src="assets/device-settings.svg" alt=""></span><span>设置</span><i id="device-unassigned-dot" hidden aria-label="有设备未设置空间"></i></button></div>
      </div>
      <div class="device-grid" id="device-grid" role="tabpanel" aria-label="全部设备"></div>
    </section>
  </div>`;
  // Both sky layers use the same assets and global coordinates; scrolling only clips the copy.
  const stickySky=document.querySelector('#app > .sky').cloneNode(true);
  stickySky.classList.add('device-sticky-sky');
  $('#device-browser-header').prepend(stickySky);

  function resetHeroClock(){heroElapsed=0;lastTick=performance.now();wasPaused=false;}
  function renderPicker(){
    const focused=document.activeElement?.closest('[data-hero-room]')?.dataset.heroRoom;
    $('#device-room-chip').setAttribute('aria-expanded',String(popupOpen));
    const popup=$('#device-room-popup');popup.hidden=!popupOpen;
    const signature=JSON.stringify(rooms().map(room=>[room.id,room.name,room.id===heroRoomId]));
    if(signature!==pickerSignature){
      pickerSignature=signature;
      popup.innerHTML=rooms().map(room=>`<button type="button" role="option" aria-selected="${room.id===heroRoomId}" data-hero-room="${escapeHTML(room.id)}"><span>${escapeHTML(room.name)}</span>${room.id===heroRoomId?'<span class="device-room-check" aria-hidden="true">✓</span>':''}</button>`).join('');
      if(popupOpen&&focused)popup.querySelector(`[data-hero-room="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
    }
  }
  function closePicker(restoreFocus=false){
    if(!popupOpen)return;
    popupOpen=false;renderPicker();resetHeroClock();
    if(restoreFocus)$('#device-room-chip').focus({preventScroll:true});
  }

  function summary(){
    const list=devices(),offline=list.filter(device=>!device.online).length;
    const adjustable=list.filter(device=>device.online&&device.permissions?.control===true&&device.responseCapabilities?.length).length;
    const pending=list.filter(device=>device.pending).length;
    $('#devices-family-name').textContent=getFamilyName();
    const capability=adjustable?`小元可调节<strong>${adjustable}台</strong>设备`:list.some(device=>device.online&&device.permissions?.read!==false)?'设备正为小元提供空间信息':'小元等待设备连接';
    const status=offline?`<strong>${offline}台</strong>连接待恢复`:pending?`<strong>${pending}台</strong>正在响应`:'设备随需响应';
    $('#devices-summary').innerHTML=list.length?`${capability} · ${status}`:'连接设备，让小元感知与调节';
    $('#devices-summary').setAttribute('aria-label',$('#devices-summary').textContent);
    $('#device-unassigned-dot').hidden=!devices().some(device=>!device.roomId);
  }

  function renderFilters(){
    if(filter!=='all'&&!rooms().some(room=>room.id===filter))filter='all';
    const list=[{id:'all',name:'全部'},...rooms()];
    const scrollLeft=$('#device-filters').scrollLeft;
    $('#device-filters').innerHTML=list.map(room=>`<button role="tab" id="device-filter-${escapeHTML(room.id)}" data-filter="${escapeHTML(room.id)}" aria-controls="device-grid" aria-selected="${room.id===filter}" tabindex="${room.id===filter?0:-1}">${escapeHTML(room.name)}</button>`).join('');
    $('#device-filters').scrollLeft=scrollLeft;
    $('#device-grid').setAttribute('aria-labelledby',`device-filter-${filter}`);
  }

  function basicState(device){
    if(!device.online)return '离线 · 等待连接';
    if(device.pending)return device.statusText||'等待设备反馈';
    if(device.statusText)return device.statusText;
    if(device.readings?.length)return device.readings.slice(0,2).map(reading=>reading.text??`${reading.value??'暂无读数'}${reading.value==null?'':reading.unit??''}`).join(' · ');
    if(typeof device.power==='boolean')return device.power?'开启':'关闭';
    return '暂无读数';
  }

  function cardState(device){
    if(!device.online)return '等待连接';
    if(device.pending)return '等待设备反馈';
    return device.cardStatusText??basicState(device);
  }

  function cardMarkup(device){
    const controllable=typeof device.power==='boolean',waiting=!!device.pending;
    return `<article class="device-card${device.online?'':' is-offline'}" data-device-card="${escapeHTML(device.id)}" data-device-type="${escapeHTML(device.type)}">
      <button class="device-card-open" data-device-detail="${escapeHTML(device.id)}" aria-label="查看${escapeHTML(device.name)}信息">
        <span class="device-card-picture"><img src="${escapeHTML(device.image||'assets/device-radar.png')}" alt="" loading="lazy"></span>
        <span class="device-online-state"><i aria-hidden="true"></i>${device.online?'在线':'离线'}</span>
        <strong class="device-card-name">${escapeHTML(device.name)}</strong>
        <span class="device-card-location">${escapeHTML(roomName(device.roomId))}｜${escapeHTML(device.source)}</span>
        <span class="device-card-state${controllable?' has-control':''}${waiting?' is-pending':''}" aria-live="polite">${escapeHTML(cardState(device))}</span>
      </button>
      ${controllable?`<button class="device-power" data-device-power="${escapeHTML(device.id)}" role="switch" aria-checked="${device.power}" aria-busy="${waiting}" aria-label="${device.power?'关闭':'开启'}${escapeHTML(device.name)}" ${!device.online||waiting?'disabled':''}><span class="asset device-power-art" aria-hidden="true"><img src="assets/device-switch-${device.power?'on':'off'}.svg" alt=""></span></button>`:''}
    </article>`;
  }

  function renderCards(){
    const list=devices().filter(device=>filter==='all'||device.roomId===filter),grid=$('#device-grid');
    const scroll=$('#devices-scroll'),previousScroll=page.hidden?null:scroll.scrollTop;
    const focused=document.activeElement,focusId=focused?.dataset?.devicePower,detailId=focused?.dataset?.deviceDetail;
    grid.innerHTML=list.length?list.map(cardMarkup).join(''):`<div class="device-empty">${icon('room')}<h2>${filter==='all'?'还没有接入设备':'这个空间还没有设备'}</h2><p>${filter==='all'?'接入设备后，小元可结合空间信息提供服务':'可在设置中调整设备的位置'}</p><button class="primary-button" data-empty-action="${filter==='all'?'add':'settings'}">${filter==='all'?'新增设备':'设置设备位置'}</button></div>`;
    if(previousScroll!==null)scroll.scrollTop=previousScroll;
    if(focusId){const power=grid.querySelector(`[data-device-power="${CSS.escape(focusId)}"]`);(power?.disabled?grid.querySelector(`[data-device-detail="${CSS.escape(focusId)}"]`):power)?.focus({preventScroll:true});}
    else if(detailId)grid.querySelector(`[data-device-detail="${CSS.escape(detailId)}"]`)?.focus({preventScroll:true});
  }

  function capabilityText(values,empty){return values?.length?values.slice(0,3).join('、'):empty;}
  function responseTypes(values){return [...new Set((values??[]).map(value=>({'净化模式':'净化','亮度':'照明'}[value]??value)))];}
  function heroMarkup(){
    const availableRooms=rooms();
    if(!availableRooms.some(room=>room.id===heroRoomId))heroRoomId=availableRooms[0]?.id;
    const room=availableRooms.find(room=>room.id===heroRoomId),capability=store.getRoomCapabilities(heroRoomId),execution=store.getExecution(heroRoomId);
    const active=execution&&execution.status!=='cancelled'&&execution.status!=='failed';
    const target=execution?.target;
    const members=execution?.devices??[];
    const sameTarget=members.length&&members.every(device=>device.target===members[0].target)?members[0].target:null;
    const targetText=typeof sameTarget==='number'?`目标亮度${sameTarget}%`:typeof target==='string'?target:typeof target==='number'?`目标亮度${target}%`:target?.text??'灯光柔和一些';
    const inRoom=devices().filter(device=>device.roomId===heroRoomId),hasInput=inRoom.some(device=>device.inputCapabilities?.length),hasResponse=inRoom.some(device=>device.responseCapabilities?.length);
    const inputOffline=hasInput&&!capability?.inputDevices?.length,responseOffline=hasResponse&&!capability?.responseDevices?.length;
    const shortName=name=>name.replace(/^主卧/u,'').replace('床头灯','灯');
    const feedback=members.slice(0,2).map(device=>`${shortName(device.name)}${device.feedback||(device.status==='confirmed'?`已调至${device.current}%`:'等待反馈')}`);
    return {room,active,execution,
      input:active?`<strong>本次调度</strong><span>${escapeHTML(members.length===2?'两盏灯':members.map(device=>device.name).join('、'))}</span><small>${escapeHTML(targetText)}</small>`:`<strong>${inputOffline?'感知暂不可用':hasInput?'已接入感知':'空间感知'}</strong><span>${escapeHTML(inputOffline?'相关设备离线':capabilityText(capability?.inputCapabilities,'尚未接入感知'))}</span>`,
      response:active?`<strong>${execution.status==='completed'?'调节已完成':'执行反馈'}</strong>${feedback.map(text=>`<span>${escapeHTML(text)}</span>`).join('')}`:`<strong>${responseOffline?'调节暂不可用':hasResponse?'支持调节':'调节设备'}</strong><span>${escapeHTML(responseOffline?'相关设备离线':capabilityText(responseTypes(capability?.responseCapabilities),'尚未接入设备'))}</span>`};
  }

  function updateHero({animate=false}={}){
    const version=++transitionVersion,content=heroMarkup();
    clearTimeout(transitionTimer);
    const elements=[...page.querySelectorAll('.hero-dynamic')];
    const commit=()=>{
      if(version!==transitionVersion||destroyed)return;
      $('#device-hero-room').textContent=content.room?.name??'家庭';
      $('#device-room-chip').dataset.executing=content.active&&content.execution?.status!=='completed'?'true':'false';
      $('#device-room-chip').setAttribute('aria-label',`${content.room?.name??'家庭'}的设备能力，选择空间`);
      renderPicker();
      $('#device-input-summary').innerHTML=content.input;$('#device-response-summary').innerHTML=content.response;
      $('#device-input-summary').dataset.mode=content.active?'execution':'capabilities';$('#device-response-summary').dataset.mode=content.active?'execution':'capabilities';
      $('#device-input-summary').setAttribute('aria-label',`查看${content.room?.name??'家庭'}${content.active?'本次调度目标':'的信息来源'}`);
      $('#device-response-summary').setAttribute('aria-label',`查看${content.room?.name??'家庭'}${content.active?'执行反馈':'的调节设备'}`);
      elements.forEach(element=>{element.classList.remove('is-changing');if(animate&&!reduced())element.animate([{opacity:0,filter:'blur(4px)'},{opacity:1,filter:'blur(0px)'}],{duration:320,easing:'cubic-bezier(.23,1,.32,1)'});});
      if(content.room?.id==='master'&&!previewStarted&&!page.hidden){previewStarted=true;store.startPreviewExecution?.();}
    };
    if(animate&&!reduced()){elements.forEach(element=>element.classList.add('is-changing'));transitionTimer=setTimeout(commit,180);}
    else commit();
  }

  function nextHero(){
    const list=rooms();if(list.length<2)return;
    const index=list.findIndex(room=>room.id===heroRoomId);heroRoomId=list[(index+1)%list.length].id;heroElapsed=0;updateHero({animate:true});
  }

  function chooseFilter(id,{focus=false}={}){
    filter=id;interactionUntil=performance.now()+1000;renderFilters();renderCards();
    if(focus)$('#device-filters').querySelector(`[data-filter="${CSS.escape(id)}"]`)?.focus({preventScroll:true});
  }

  function openDeviceInfo(id){ onDeviceDetail?.(id); }

  function executionContent(execution,mode){
    const target=`<div class="device-context-target"><span>共同目标</span><h3>${escapeHTML(execution.target)}</h3></div>`;
    if(mode==='input')return target;
    return target+`<div class="device-execution-list">${execution.devices.map(member=>`<article class="device-execution-item"><header><strong>${escapeHTML(member.name)}</strong><small>${escapeHTML(member.source)}</small></header><dl><div><dt>当前亮度</dt><dd>${escapeHTML(member.current)}%</dd></div><div><dt>目标亮度</dt><dd>${escapeHTML(member.target)}%</dd></div></dl><p data-confirmed="${member.status==='confirmed'}">${escapeHTML(member.feedback||(member.status==='confirmed'?'设备已反馈':'等待设备反馈'))}</p></article>`).join('')}</div>`;
  }

  function sourcePurpose(device){
    const keys=new Set((device.readings||[]).map(reading=>reading.key)),capabilities=device.inputCapabilities||[];
    if(keys.has('presence')||capabilities.includes('在场'))return '感知空间是否有人，为空间使用判断提供参考';
    if(keys.has('temperature')&&keys.has('humidity')||capabilities.includes('温湿度'))return '提供温湿度读数，为环境调节提供参考';
    if(keys.has('temperature')||capabilities.includes('温度'))return '提供室内温度，为温度调节提供参考';
    if(keys.has('humidity')||capabilities.includes('湿度'))return '提供湿度读数，为环境调节提供参考';
    if(['co2','pm25','pm2_5','airQuality'].some(key=>keys.has(key)))return '提供空气指标，为空气环境判断提供参考';
    return `提供${capabilities.join('、')||'设备感知'}信息，作为空间理解的参考`;
  }

  function sourceReadings(device){
    if(device.permissions?.read===false)return '<p class="device-context-no-data">暂无读取权限</p>';
    if(!device.readings?.length)return `<p class="device-context-no-data">${device.online?'尚未收到设备信息':'设备离线，暂无可用读数'}</p>`;
    return `<dl class="device-context-readings" aria-label="${escapeHTML(device.name)}的感知数据">${device.readings.map(reading=>{
      const numeric=typeof reading.value==='number'&&Number.isFinite(reading.value),value=formatDeviceReading(reading),stamp=Number(reading.updatedAt||device.updatedAt),date=new Date(stamp);
      const time=value==='等待更新'?'等待更新':Number.isFinite(stamp)&&stamp>0&&Number.isFinite(date.getTime())?`${device.online?'更新于':'最后读数'} ${readingTimeFormat.format(date)}`:'更新时间未知';
      return `<div${numeric?'':' class="is-text"'}><dt>${escapeHTML(reading.label||reading.key)}</dt><dd>${escapeHTML(value)}</dd><small>${escapeHTML(time)}</small></div>`;
    }).join('')}</dl>`;
  }

  function capabilityContent(room,mode){
    if(!room)return '<p class="device-context-empty">这个空间已移除</p>';
    const input=mode==='input',list=devices().filter(device=>device.roomId===room.id&&(input?device.inputCapabilities?.length:device.responseCapabilities?.length));
    return `<p class="sheet-description">${input?`这些设备为${escapeHTML(room.name)}提供感知信息`:'这些设备可按小元的调度响应调节'}</p><div class="device-context-list">${list.map(device=>`<article class="device-context-item${input?' device-context-source':''}"><img src="${escapeHTML(device.image)}" alt=""><div><header><strong>${escapeHTML(device.name)}</strong><small data-online="${device.online}">${device.online?'在线':'离线'}</small></header>${input?`<span class="device-context-origin">${escapeHTML(device.source)}</span><p class="device-context-purpose">${escapeHTML(sourcePurpose(device))}</p>${sourceReadings(device)}`:`<p>${escapeHTML(device.responseCapabilities.join('、'))}</p><span>${escapeHTML(device.source)}${device.online?'':' · 当前不可用'}</span>`}</div></article>`).join('')}</div>${!list.length?'<p class="device-context-empty">这个空间尚未接入相关设备</p>':''}`;
  }

  function openSpaceContext(mode){
    const room=rooms().find(value=>value.id===heroRoomId);if(!room)return;
    const trigger=mode==='input'?'#device-input-summary':'#device-response-summary',execution=store.getExecution(room.id);
    const active=execution&&!['failed','cancelled'].includes(execution.status);
    const title=active?`${room.name} · ${mode==='input'?'本次调度':'执行反馈'}`:`${room.name} · ${mode==='input'?'信息来源':'调节设备'}`;
    const executionBody=active?`<div id="device-context-execution-content">${executionContent(execution,mode)}</div>`:'';
    const capabilityBody=!active?`<div id="device-context-capability-content">${capabilityContent(room,mode)}</div>`:'';
    openSheet(title,executionBody||capabilityBody,{restoreFocus:()=>$(trigger)?.focus({preventScroll:true})});sheet().dataset.content='device-context';contextRoomId=room.id;contextMode=mode;
  }

  const click=async event=>{
    const target=event.target.closest('button');if(!target)return;
    if(target.dataset.heroRoom){
      const id=target.dataset.heroRoom;if(!rooms().some(room=>room.id===id))return;
      heroRoomId=id;interactionUntil=0;closePicker(true);resetHeroClock();updateHero();return;
    }
    if(target.dataset.filter){chooseFilter(target.dataset.filter);return;}
    if(target.dataset.deviceDetail){openDeviceInfo(target.dataset.deviceDetail);return;}
    if(target.dataset.devicePower){
      const device=store.get(target.dataset.devicePower);if(!device)return;
      interactionUntil=performance.now()+1500;
      const result=await store.requestPower(device.id,!device.power);if(!result.ok)toast(result.message||'设备未能完成调节');
      if(!page.hidden&&!sheet()?.open&&(document.activeElement===document.body||document.activeElement?.dataset?.deviceDetail===device.id))page.querySelector(`[data-device-power="${CSS.escape(device.id)}"]`)?.focus({preventScroll:true});
      return;
    }
    if(target.dataset.emptyAction==='add')onAddDevice?.();
    if(target.dataset.emptyAction==='settings')onSettings?.();
  };
  page.addEventListener('click',click);
  function syncScrollState(){
    if(page.hidden)return;
    closePicker();
    const top=$('#devices-scroll').getBoundingClientRect().top;
    const stuck=$('#devices-scroll').scrollTop>0&&$('#device-browser-header').getBoundingClientRect().top<=top+.5;
    $('#device-browser-header').classList.toggle('is-stuck',stuck);
    $('#device-sticky-menu').hidden=!stuck;
    heroVisible=$('.device-space-hero').getBoundingClientRect().bottom>top;
  }
  $('#devices-scroll').addEventListener('scroll',syncScrollState,{passive:true});
  $('#devices-family').onclick=()=>onFamilyName?.();$('#devices-add').onclick=()=>onAddDevice?.();$('#devices-menu').onclick=()=>onMenu?.();
  $('#device-sticky-menu').onclick=()=>onMenu?.();
  $('#device-settings').onclick=()=>onSettings?.();$('#device-room-chip').onclick=()=>{if(popupOpen)closePicker();else{popupOpen=true;renderPicker();resetHeroClock();}};
  $('#device-input-summary').onclick=()=>openSpaceContext('input');$('#device-response-summary').onclick=()=>openSpaceContext('response');
  const filterKeys=event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const list=['all',...rooms().map(room=>room.id)],index=list.indexOf(filter);
    const next=event.key==='Home'?0:event.key==='End'?list.length-1:(index+(event.key==='ArrowRight'?1:-1)+list.length)%list.length;
    event.preventDefault();chooseFilter(list[next],{focus:true});
  };
  $('#device-filters').addEventListener('keydown',filterKeys);
  const outsidePointer=event=>{if(popupOpen&&!$('.device-room-picker').contains(event.target))closePicker();};
  const pickerKeys=event=>{
    if(event.key==='Escape'&&popupOpen){event.preventDefault();event.stopPropagation();closePicker(true);return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();
    if(!popupOpen){popupOpen=true;renderPicker();resetHeroClock();}
    const options=[...$('#device-room-popup').querySelectorAll('[data-hero-room]')];
    if(!options.length)return;
    const index=options.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?options.length-1:index<0?Math.max(0,options.findIndex(option=>option.dataset.heroRoom===heroRoomId)):(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
    options[next].focus({preventScroll:true});
  };
  $('.device-room-picker').addEventListener('keydown',pickerKeys);
  document.addEventListener('pointerdown',outsidePointer);
  const sheetObserver=new MutationObserver(()=>{if(sheet()?.open)closePicker();resetHeroClock();});
  if(sheet())sheetObserver.observe(sheet(),{attributes:true,attributeFilter:['open']});
  const visibility=()=>{heroElapsed=0;lastTick=performance.now();wasPaused=true;};
  document.addEventListener('visibilitychange',visibility);
  const tick=setInterval(()=>{
    const now=performance.now(),paused=page.hidden||document.hidden||!heroVisible||popupOpen||sheet()?.open||now<interactionUntil;
    if(paused){wasPaused=true;lastTick=now;return;}
    if(wasPaused){heroElapsed=0;wasPaused=false;lastTick=now;return;}
    heroElapsed+=Math.min(now-lastTick,500);lastTick=now;
    if(heroElapsed>=10000)nextHero();
  },200);
  const unsubscribe=store.subscribe(change=>{if(destroyed)return;summary();renderCards();updateHero();if(sheet()?.open&&sheet().dataset.content==='device-context'){const panel=sheet(),body=panel.querySelector('#sheet-body'),scroll=body.scrollTop,current=store.getExecution(contextRoomId),content=panel.querySelector('#device-context-execution-content'),capabilities=panel.querySelector('#device-context-capability-content');if(current&&content)content.innerHTML=executionContent(current,contextMode);if(capabilities){const room=rooms().find(room=>room.id===contextRoomId);capabilities.innerHTML=capabilityContent(room,contextMode);}body.scrollTop=scroll;}});
  function refresh(){summary();renderFilters();renderCards();updateHero();syncScrollState();}
  refresh();
  return {
    open({showAll=false}={}){if(!page.hidden)returnScroll=$('#devices-scroll').scrollTop;if(showAll){filter='all';returnScroll=0;}setView('devices');page.hidden=false;heroElapsed=0;lastTick=performance.now();wasPaused=true;refresh();$('#devices-scroll').scrollTop=returnScroll;syncScrollState();},
    onViewChange(nextView){if(!page.hidden&&nextView!=='devices')returnScroll=$('#devices-scroll').scrollTop;closePicker();heroElapsed=0;lastTick=performance.now();wasPaused=true;},
    refresh,
    destroy(){destroyed=true;clearInterval(tick);clearTimeout(transitionTimer);unsubscribe?.();sheetObserver.disconnect();page.removeEventListener('click',click);$('#devices-scroll').removeEventListener('scroll',syncScrollState);$('.device-room-picker').removeEventListener('keydown',pickerKeys);document.removeEventListener('pointerdown',outsidePointer);document.removeEventListener('visibilitychange',visibility);}
  };
}
