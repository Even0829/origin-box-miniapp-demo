import {bindAccountPickers,formatBirthday} from './account-pickers.js?v=simple-invites-20261113';
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const arrow='<span class="ac-chevron" aria-hidden="true"><img src="assets/mine-row-chevron.svg" alt=""></span>';
export const backIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
export const spinner='<span class="fu-spinner" aria-hidden="true"></span>';
export function memberForm(member={},store,{prefix='ac',nameDefault='',note=true,accountLabel=null}={}){
 const role=member.role||'',birthday=member.birthday||'';
 return `<div class="ac-form"><div class="ac-fields"><div class="ac-field"><label for="${prefix}-name">昵称</label><input id="${prefix}-name" name="nickname" maxlength="20" autocomplete="off" required placeholder="必填" value="${esc(member.name||nameDefault)}"></div><div class="ac-field"><label id="${prefix}-role-label" for="${prefix}-role-picker">家庭角色</label><input type="hidden" id="${prefix}-role" value="${esc(role)}"><button type="button" class="ac-picker-trigger" id="${prefix}-role-picker" aria-haspopup="dialog" aria-expanded="false" aria-labelledby="${prefix}-role-label ${prefix}-role-value"><span class="ac-picker-value" id="${prefix}-role-value">${esc(role||'暂无')}</span>${arrow}</button></div><div class="ac-field"><label id="${prefix}-birthday-label" for="${prefix}-birthday-picker">生日</label><input type="hidden" id="${prefix}-birthday" value="${esc(birthday)}"><button type="button" class="ac-picker-trigger" id="${prefix}-birthday-picker" aria-haspopup="dialog" aria-expanded="false" aria-labelledby="${prefix}-birthday-label ${prefix}-birthday-value"><span class="ac-picker-value" id="${prefix}-birthday-value">${formatBirthday(birthday)}</span>${arrow}</button></div>${accountLabel===null?'':`<div class="ac-field ac-readonly"><span>账号信息</span><span>${esc(accountLabel)}</span></div>`}</div>${note?'<p class="ac-note">昵称不能重复；角色与生日选填，识别资料可稍后补充。</p>':''}<p class="form-error" id="${prefix}-error" role="alert"></p></div>`;
}
export function readMemberForm(root,prefix='ac'){
 const q=id=>root.querySelector('#'+prefix+'-'+id);
 return {name:q('name').value,role:q('role').value,birthday:q('birthday').value};
}
export function memberFormError(){return '';}
export function bindRoleForm(root,prefix='ac',options={}){bindAccountPickers(root,{prefix,...options});}
export function recognitionHint(member){
 const face=typeof member.missingFace==='boolean'?member.missingFace:!member.photo;
 const voice=typeof member.missingVoice==='boolean'?member.missingVoice:!member.samples?.length;
 return face&&voice?'未录入人脸、声纹':face?'未录入人脸':voice?'未录入声纹':'';
}
export function memberRow(m,selfId){
 const permission=m.permission==='admin'?'管理员':'普通成员';
 const info=`角色：${m.role||'暂无'}${!m.accountId?' · 暂未认领':''}`,hint=recognitionHint(m);
 return `<button class="mp-row ac-member" data-ac-member="${esc(m.id)}" aria-label="${esc([m.name,permission,info,hint].filter(Boolean).join('，'))}"><span class="ac-member-avatar"><img src="assets/person-default.png" alt=""></span><span class="mp-row-copy"><strong><span class="ac-member-name">${esc(m.name)}</span><em class="ac-permission-${m.permission}">${permission}</em></strong><small title="${esc(info)}">${esc(info)}</small></span>${hint?`<span class="ac-recognition-hint">${hint}</span>`:''}${arrow}</button>`;
}
export const facts=rows=>`<dl class="ac-facts">${rows.map(([a,b])=>`<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>`;

export function installAccountKeyboard(container){
 container.addEventListener('keydown',e=>{
  const control=e.target.closest('[role=tab],[role=radio]');if(!control||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
  const list=control.closest('[role=tablist],[role=radiogroup]');if(!list)return;
  const items=[...list.querySelectorAll('[role=tab],[role=radio]')].filter(n=>!n.disabled),index=items.indexOf(control);
  const next=e.key==='Home'?0:e.key==='End'?items.length-1:(index+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+items.length)%items.length;
  if(!items[next])return;e.preventDefault();items[next].click();
  const refreshed=container.querySelectorAll('[role=tab][aria-selected=true],[role=radio][aria-checked=true]');[...refreshed].find(n=>n.textContent.trim()===items[next].textContent.trim())?.focus();
 });
}
