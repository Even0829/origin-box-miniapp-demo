import {FAMILY_ROLES} from './account-store.js?v=simple-invites-20261113';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const closeIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
function picker(root,title){
 const doc=root.ownerDocument,app=root.closest('.app'),trigger=doc.activeElement;
 doc.querySelector('#account-picker')?.close();
 const dialog=doc.createElement('dialog');dialog.id='account-picker';dialog.className='ac-picker-sheet';dialog.setAttribute('aria-labelledby','account-picker-title');
 dialog.innerHTML=`<div class="ac-picker-handle" aria-hidden="true"></div><header class="ac-picker-header"><h2 id="account-picker-title">${esc(title)}</h2><button type="button" class="icon-button" aria-label="关闭选择器">${closeIcon}</button></header><div class="ac-picker-body"></div><footer class="ac-picker-footer" hidden></footer><span class="ac-picker-indicator" aria-hidden="true"></span>`;
 app.append(dialog);
 const position=()=>{const r=app.getBoundingClientRect();dialog.style.left=r.left+'px';dialog.style.top=r.bottom+'px';dialog.style.width=r.width+'px';dialog.style.maxHeight=Math.min(720,r.height-90)+'px';};
 position();window.addEventListener('resize',position);
 const cleanups=[];trigger?.setAttribute('aria-expanded','true');
 dialog.addEventListener('close',()=>{cleanups.forEach(fn=>fn());window.removeEventListener('resize',position);dialog.remove();trigger?.setAttribute('aria-expanded','false');if(trigger?.isConnected)trigger.focus({preventScroll:true});},{once:true});
 dialog.querySelector('.ac-picker-header button').onclick=()=>dialog.close();
 dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close();});
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dialog.close();}});
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
 dialog.showModal();
 return {dialog,body:dialog.querySelector('.ac-picker-body'),footer:dialog.querySelector('.ac-picker-footer'),title:dialog.querySelector('h2'),close:()=>dialog.close(),cleanups};
}
function commit(root,prefix,field,value,label){
 const input=root.querySelector(`#${prefix}-${field}`),button=root.querySelector(`#${prefix}-${field}-picker`);
 if(!input||!button)return;
 input.value=value;button.querySelector('.ac-picker-value').textContent=label;
 input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
}
function openRole(root,{prefix,store,memberId}){
 const selected=root.querySelector(`#${prefix}-role`).value;
 const view=picker(root,'家庭角色');
 const taken=value=>Boolean(value&&store?.roleTaken(value,memberId));
 view.body.innerHTML=`<div class="ac-role-options" role="radiogroup" aria-label="选择家庭角色">${['',...FAMILY_ROLES].map(value=>{const disabled=taken(value),checked=selected===value;return `<button type="button" role="radio" aria-checked="${checked}" data-role-value="${value}" ${disabled?'disabled':''}><span>${value||'暂无'}</span><span class="ac-role-option-state">${disabled?'已使用':checked?'✓':''}</span></button>`;}).join('')}<button type="button" data-custom-role><span>自定义</span><span class="ac-role-option-state">${selected&&!FAMILY_ROLES.includes(selected)?esc(selected):'›'}</span></button></div><p class="ac-picker-note">同一家庭的角色不能重复，未设置时显示“暂无”。</p>`;
 view.body.addEventListener('click',e=>{
  const button=e.target.closest('[data-role-value]');if(button&&!button.disabled){commit(root,prefix,'role',button.dataset.roleValue,button.dataset.roleValue||'暂无');view.close();return;}
  if(!e.target.closest('[data-custom-role]'))return;
  view.title.textContent='自定义角色';
  view.body.innerHTML=`<label class="ac-custom-role-label" for="ac-custom-role">角色名称</label><input class="text-input" id="ac-custom-role" maxlength="12" placeholder="例如：阿姨" value="${esc(selected&&!FAMILY_ROLES.includes(selected)?selected:'')}"><p class="form-error" id="ac-custom-role-error" role="alert"></p>`;
  view.footer.hidden=false;view.footer.innerHTML='<button type="button" class="secondary-button" data-picker-cancel>取消</button><button type="button" class="primary-button" data-picker-confirm>确定</button>';
  const input=view.body.querySelector('input');input.focus();
  const save=()=>{let value=input.value.normalize('NFKC').trim();const error=view.body.querySelector('#ac-custom-role-error');if(!value){error.textContent='请填写角色名称';return;}if([...value].length>12){error.textContent='角色名称最多12个字';return;}if(value==='暂无')value='';if(taken(value)){error.textContent='该角色已使用，请换一个';return;}commit(root,prefix,'role',value,value||'暂无');view.close();};
  view.footer.querySelector('[data-picker-cancel]').onclick=view.close;view.footer.querySelector('[data-picker-confirm]').onclick=save;input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();save();}};
 });
 view.body.addEventListener('keydown',e=>{const item=e.target.closest('[role=radio]');if(!item||!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const items=[...view.body.querySelectorAll('[role=radio]:not(:disabled)')],at=items.indexOf(item);items[e.key==='Home'?0:e.key==='End'?items.length-1:(at+(e.key==='ArrowUp'?-1:1)+items.length)%items.length]?.focus();});
}
export function formatBirthday(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return '暂无';return value.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$1年$2月$3日');}
function openBirthday(root,{prefix}){
 const stored=root.querySelector(`#${prefix}-birthday`).value,now=new Date(),today=[now.getFullYear(),now.getMonth()+1,now.getDate()];
 let parts=stored?stored.split('-').map(Number):[Math.min(1990,today[0]),1,1];
 const minYear=Math.min(1900,parts[0]);
 const view=picker(root,'选择生日');let scrollTimer=null;
 const pad=value=>String(value).padStart(2,'0');
 const value=()=>`${parts[0]}-${pad(parts[1])}-${pad(parts[2])}`;
 function normalize(){parts[0]=Math.max(minYear,Math.min(today[0],parts[0]));const months=parts[0]===today[0]?today[1]:12;parts[1]=Math.max(1,Math.min(months,parts[1]));const maxDay=Math.min(new Date(parts[0],parts[1],0).getDate(),parts[0]===today[0]&&parts[1]===today[1]?today[2]:31);parts[2]=Math.max(1,Math.min(maxDay,parts[2]));}
 function options(){return [Array.from({length:today[0]-minYear+1},(_,i)=>minYear+i),Array.from({length:parts[0]===today[0]?today[1]:12},(_,i)=>i+1),Array.from({length:Math.min(new Date(parts[0],parts[1],0).getDate(),parts[0]===today[0]&&parts[1]===today[1]?today[2]:31)},(_,i)=>i+1)];}
 function render(focusPart=null){
  clearTimeout(scrollTimer);normalize();const values=options();
  view.body.innerHTML=`<div class="ac-date-labels" aria-hidden="true"><span>年</span><span>月</span><span>日</span></div><div class="ac-date-wheels">${values.map((list,index)=>`<div class="ac-date-column" role="listbox" tabindex="0" aria-label="${['年','月','日'][index]}" aria-activedescendant="ac-date-${index}-${parts[index]}" data-date-part="${index}">${list.map(n=>`<button type="button" tabindex="-1" role="option" id="ac-date-${index}-${n}" aria-selected="${parts[index]===n}" data-date-value="${n}">${n}${['年','月','日'][index]}</button>`).join('')}</div>`).join('')}</div>`;
  view.body.querySelectorAll('[data-date-part]').forEach(column=>{
   const index=Number(column.dataset.datePart),list=values[index];column.scrollTop=list.indexOf(parts[index])*44;
   const choose=number=>{[...view.body.querySelectorAll('[data-date-part]')].forEach((c,i)=>{parts[i]=values[i][Math.max(0,Math.min(values[i].length-1,Math.round(c.scrollTop/44)))];});parts[index]=number;render(index);};
   column.addEventListener('click',e=>{const option=e.target.closest('[data-date-value]');if(option)choose(Number(option.dataset.dateValue));});
   column.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{const at=Math.max(0,Math.min(list.length-1,Math.round(column.scrollTop/44)));const changed=[...view.body.querySelectorAll('[data-date-part]')].some((c,i)=>values[i][Math.max(0,Math.min(values[i].length-1,Math.round(c.scrollTop/44)))]!==parts[i]);if(changed)choose(list[at]);},140);});
   column.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key))return;e.preventDefault();const at=list.indexOf(parts[index]),step=e.key==='PageUp'?-10:e.key==='PageDown'?10:e.key==='ArrowUp'?-1:1;choose(list[e.key==='Home'?0:e.key==='End'?list.length-1:Math.max(0,Math.min(list.length-1,at+step))]);});
  });
  if(focusPart!==null)view.body.querySelector(`[data-date-part="${focusPart}"]`).focus({preventScroll:true});
 }
 render();view.footer.hidden=false;
 view.footer.innerHTML='<button type="button" class="secondary-button" data-clear-birthday>清除生日</button><button type="button" class="primary-button" data-confirm-birthday>确定</button>';
 view.footer.querySelector('[data-clear-birthday]').onclick=()=>{commit(root,prefix,'birthday','','暂无');view.close();};
 view.footer.querySelector('[data-confirm-birthday]').onclick=()=>{const columns=[...view.body.querySelectorAll('[data-date-part]')],values=options();columns.forEach((column,index)=>{parts[index]=values[index][Math.max(0,Math.min(values[index].length-1,Math.round(column.scrollTop/44)))];});normalize();commit(root,prefix,'birthday',value(),formatBirthday(value()));view.close();};
 view.cleanups.push(()=>clearTimeout(scrollTimer));
}
export function bindAccountPickers(root,{prefix='ac',store=null,memberId=null}={}){
 root.querySelector(`#${prefix}-role-picker`)?.addEventListener('click',()=>openRole(root,{prefix,store,memberId}));
 root.querySelector(`#${prefix}-birthday-picker`)?.addEventListener('click',()=>openBirthday(root,{prefix}));
}
