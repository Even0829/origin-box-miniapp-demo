const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const glyph = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({back:'<path d="m14 5-7 7 7 7"/>',plus:'<path d="M12 5v14M5 12h14"/>',camera:'<path d="M4 7h4l2-3h4l2 3h4v13H4Z"/><circle cx="12" cy="13" r="4"/>',image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',chevron:'<path d="m9 5 7 7-7 7"/>',person:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>'})[name] || ''}</svg>`;

// 仅管理本次运行的人物资料；图像解码不是人脸检测或身份识别。
export function createPeoplePage({page,setView,openSheet,toast,onBack,onChange=()=>{},onRecord=()=>{}}) {
  const doc=page.ownerDocument, sheet=doc.querySelector('#sheet');
  let people=[{id:'person-yu',name:'小雨',photo:'assets/person-default.png',enabled:true},{id:'person-mom',name:'妈妈',photo:'assets/person-default.png',enabled:true},{id:'person-dad',name:'爸爸',photo:'assets/person-default.png',enabled:false}];
  let session=null,serial=0,scroll=0,lastId=null,view='',destroyed=false;
  const q=s=>sheet.querySelector(s), normal=s=>s.normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
  const isBlob=s=>s?.startsWith('blob:');
  const release=s=>{if(isBlob(s))URL.revokeObjectURL(s);};
  const focusRow=()=>{(page.querySelector(`[data-person="${lastId}"]`)||page.querySelector('[data-pp="add"]'))?.focus({preventScroll:true});};
  page.classList.add('pp-page');
  function render() {
    const top=page.querySelector('.pp-scroll')?.scrollTop??scroll;
    page.innerHTML=`<header class="pp-header"><button class="icon-button" data-pp="back" aria-label="返回我的">${glyph('back')}</button><h1>人物识别</h1><span aria-hidden="true"></span></header><main class="pp-scroll"><div class="pp-intro"><span class="pp-intro-visual"><img src="assets/person-default.png" alt=""></span><h2>让小元认识家里的人</h2><p>添加照片和名称，为家人建立人物资料</p></div><div class="pp-list-heading"><h3>家庭人物</h3><span>${people.length} 位已录入</span></div><div class="pp-list">${people.length?people.map(p=>`<button class="pp-person" data-person="${p.id}"><span class="pp-person-info"><strong>${esc(p.name)}</strong><small>${p.enabled?'资料已录入':'已停用'}</small></span><span class="pp-status" data-enabled="${p.enabled}" aria-label="${p.enabled?'使用中':'已停用'}"></span>${glyph('chevron')}</button>`).join(''):`<div class="pp-empty"><h3>还没有人物资料</h3><p>拍一张照片，告诉小元该怎么称呼</p></div>`}</div><p class="pp-note">人物资料用于身份识别，不授予家庭账号权限</p></main><footer class="pp-actions"><button class="primary-button" data-pp="add">添加人物</button></footer><div class="pp-indicator" aria-hidden="true"></div>`;
    page.querySelector('.pp-scroll').scrollTop=top;
  }
  const dirty=()=>session && (session.name.trim()!==session.base.name || session.photo!==session.base.photo || session.enabled!==session.base.enabled);
  function updateSave(){const b=q('#pp-save');if(b)b.disabled=!dirty()||session?.loading;}
  function cleanup(){if(session?.photo!==session?.base.photo)release(session?.photo);session=null;serial++;}
  function closeEditor(){cleanup();sheet.close();focusRow();}
  function cancelEditor(){
    if(session?.loading){serial++;session.loading=false;}
    if(!dirty()){closeEditor();return;}
    openSheet('放弃修改？','<p class="sheet-description">尚未保存的照片和信息将不会保留。</p><div class="dialog-actions"><button class="secondary-button" id="pp-continue">继续编辑</button><button class="primary-button" id="pp-discard">放弃修改</button></div>',{variant:'float',onCancel:renderEditor,restoreFocus:focusRow});
    q('#pp-continue').onclick=renderEditor;q('#pp-discard').onclick=closeEditor;
  }
  function renderEditor(){
    if(!session)return;
    const s=session;
    openSheet(s.id?'人物资料':'添加人物',`<div class="pp-editor"><div class="pp-photo-preview${!s.photo||s.photo==='assets/person-default.png'?' is-default':''}">${s.photo&&s.photo!=='assets/person-default.png'?`<img src="${esc(s.photo)}" alt="人物照片预览">`:`<img class="pp-default-photo" src="assets/person-default.png" alt="${s.photo?'人物默认头像':'默认人物头像，尚未选择照片'}">`}</div><div class="pp-photo-actions"><button class="pp-photo-choice" type="button" data-photo="camera">${glyph('camera')}拍摄照片</button><button class="pp-photo-choice" type="button" data-photo="album">${glyph('image')}从相册选择</button></div><input type="file" id="pp-camera" accept="image/*" capture="user" hidden><input type="file" id="pp-album" accept="image/*" hidden><p class="pp-photo-hint">请选择清晰、无遮挡的单人照片</p><label class="form-label" for="pp-name">名称</label><input class="text-input" id="pp-name" value="${esc(s.name)}" maxlength="20" placeholder="姓名或家庭常用称呼" autocomplete="off"><p id="pp-error" class="form-error" role="alert"></p>${s.id?`<label class="pp-use"><span><strong>用于人物识别</strong><small>停用后保留资料，可随时恢复</small></span><input type="checkbox" id="pp-enabled" ${s.enabled?'checked':''}><span class="pp-switch" aria-hidden="true"></span></label><button class="pp-delete" id="pp-delete" type="button">删除人物资料</button>`:''}</div><div class="dialog-actions"><button class="secondary-button" id="pp-cancel">取消</button><button class="primary-button" id="pp-save" disabled>保存</button></div>`,{onCancel:cancelEditor,restoreFocus:focusRow});
    sheet.dataset.content='people-editor';
    q('#pp-name').oninput=e=>{s.name=e.target.value;q('#pp-error').textContent='';e.target.removeAttribute('aria-invalid');updateSave();};
    q('#pp-enabled')?.addEventListener('change',e=>{s.enabled=e.target.checked;updateSave();});
    sheet.querySelectorAll('[data-photo]').forEach(b=>b.onclick=()=>q(`#pp-${b.dataset.photo==='camera'?'camera':'album'}`).click());
    ['#pp-camera','#pp-album'].forEach(id=>q(id).onchange=e=>readPhoto(e.target.files?.[0]));
    q('#pp-cancel').onclick=cancelEditor;q('#pp-save').onclick=save;
    if(q('#pp-delete'))q('#pp-delete').onclick=confirmDelete;
    updateSave();
  }
  async function readPhoto(file){
    if(!file||!session)return;
    const s=session,token=++serial;
    const fail=m=>{if(session===s){s.loading=false;q('#pp-error').textContent=m;updateSave();}};
    if(!file.type.startsWith('image/')||file.type==='image/svg+xml'){fail('请选择 JPG、PNG 或其他常用照片格式');return;}
    if(file.size>10*1024*1024){fail('照片不能超过10MB，请选择较小的照片');return;}
    const url=URL.createObjectURL(file);s.loading=true;updateSave();q('#pp-error').textContent='正在读取照片';
    const image=new Image();image.src=url;
    try{await image.decode();if(!image.naturalWidth||!image.naturalHeight)throw new Error('empty');}catch{release(url);if(token===serial)fail('这张照片无法读取，请重新选择');return;}
    if(destroyed||session!==s||serial!==token){release(url);return;}
    if(s.photo!==s.base.photo)release(s.photo);s.photo=url;s.loading=false;renderEditor();
  }
  function edit(id){
    cleanup();lastId=id||null;
    const base=people.find(p=>p.id===id)||{name:'',photo:'',enabled:true};
    session={...base,id:base.id||null,base:{...base},loading:false};renderEditor();
  }
  function save(){
    if(!session||session.loading)return;
    const s=session,name=s.name.trim();
    const fail=m=>{q('#pp-error').textContent=m;q('#pp-name').setAttribute('aria-invalid','true');};
    if(!name){fail('请填写人物名称');return;}
    if([...name].length>20){fail('名称不能超过20个字');return;}
    if(people.some(p=>p.id!==s.id&&normal(p.name)===normal(name))){fail('已有同名人物，请使用不同的名称');return;}
    if(!s.photo){fail('请拍摄或选择一张照片');return;}
    const old=people.find(p=>p.id===s.id),p={id:s.id||crypto.randomUUID(),name,photo:s.photo,enabled:s.enabled};
    if(old){if(old.photo!==p.photo)release(old.photo);people[people.indexOf(old)]=p;}else people.push(p);
    lastId=p.id;session=null;serial++;sheet.close();render();onChange();
    onRecord({scope:'family',label:old?'人物资料已更新':'人物资料已添加',text:`${name}的人物资料已${old?'更新':'保存'}${p.enabled?'':'，已停用'}，账号权限保持不变`});
    toast('人物资料已保存');focusRow();
  }
  function confirmDelete(){
    const s=session;if(!s?.id)return;
    openSheet(`删除${s.base.name}的资料？`,`<p class="sheet-description">将移除该人物的照片与档案。已有记忆和历史记录会保留。</p><div class="dialog-actions"><button class="secondary-button" id="pp-keep">取消</button><button class="primary-button destructive-button" id="pp-confirm-delete">删除资料</button></div>`,{variant:'float',onCancel:renderEditor,restoreFocus:focusRow});
    q('#pp-keep').onclick=renderEditor;
    q('#pp-confirm-delete').onclick=()=>{const old=people.find(p=>p.id===s.id);if(!old)return;release(old.photo);cleanup();people=people.filter(p=>p.id!==old.id);sheet.close();render();onChange();onRecord({scope:'family',label:'人物资料已删除',text:`${old.name}的照片与人物档案已移除，已有记忆和历史记录保留`});toast('人物资料已删除');focusRow();};
  }
  page.addEventListener('click',e=>{const row=e.target.closest('[data-person]');if(row){edit(row.dataset.person);return;}const action=e.target.closest('[data-pp]')?.dataset.pp;if(action==='back')onBack();if(action==='add')edit();});
  render();
  return {open(){setView('people');render();page.querySelector('[data-pp="back"]').focus({preventScroll:true});},back:onBack,onViewChange(next){if(view==='people')scroll=page.querySelector('.pp-scroll').scrollTop;view=next;},getSummary(){return {total:people.length,enabled:people.filter(p=>p.enabled).length};},getParticipants(){return people.map(({id,name,enabled})=>({id,name,enabled}));},destroy(){destroyed=true;cleanup();people.forEach(p=>release(p.photo));}};
}
