import {previewNow} from './preview-clock.js';

const keys=['power','level','mode','colorTemperature','targetTemperature','fanMode','swingMode'];
const primitive=value=>typeof value==='boolean'||typeof value==='string'||(typeof value==='number'&&Number.isFinite(value));
const valid=change=>change?.deviceId&&Number.isInteger(change.expectedRevision)&&Object.keys(change.before||{}).length&&Object.entries(change.before).every(([key,value])=>keys.includes(key)&&primitive(value)&&primitive(change.after?.[key]))&&!(change.before.power===false&&Object.keys(change.before).length>1);

/** Restore the recorded changed fields, guarded against later user intent. */
export function createCareRestoration({getDevices,requestControl,onChange,onRecord}={}){
  const states=new Map();
  const deviceFor=id=>(getDevices()||[]).find(device=>device.id===id);
  function changesFor(item){return Array.isArray(item.restoreChanges)&&item.restoreChanges.length&&item.restoreChanges.every(valid)?item.restoreChanges:null;}
  function describe(change){
    const device=deviceFor(change.deviceId),value=change.before,parts=[];
    if('power' in value)parts.push(value.power?'开启':'关闭');
    if('level' in value)parts.push(`亮度${value.level}%`);
    if('colorTemperature' in value)parts.push(`色温${value.colorTemperature}K`);
    if('mode' in value)parts.push(`${value.mode}模式`);
    if('targetTemperature' in value)parts.push(`设定温度${value.targetTemperature}℃`);
    if('fanMode' in value)parts.push(`风速${value.fanMode}`);
    if('swingMode' in value)parts.push(`扫风${value.swingMode}`);
    return `${device?.name||'原设备'}：${parts.join('、')}`;
  }
  function blocked(change){
    const device=deviceFor(change.deviceId);
    if(!device)return '原设备已移除，无法恢复这次操作';
    if(device.roomId!==change.roomId)return '设备所在空间已变化，请按当前位置自定义调整';
    if(device.online===false)return `${device.name}暂时离线，连接恢复后可重试`;
    if(!device.permissions?.control)return `${device.name}当前没有控制权限`;
    if(device.pending)return `${device.name}正在等待另一项操作反馈，请稍后再试`;
    if((device.controlRevision||0)!==change.expectedRevision||Object.entries({...change.after,...change.guard}).some(([key,value])=>device[key]!==value))return '设备已有后续调整，请自定义调整，避免覆盖新的设置';
    return '';
  }
  function info(item){
    const changes=changesFor(item);if(!changes||typeof requestControl!=='function')return null;
    const state=states.get(item.id),status=state?.status||'idle';
    return {label:status==='running'?'正在恢复…':status==='done'?'已恢复调整前设置':status==='failed'?'重试恢复':'恢复调整前设置',status,disabled:status==='running'||status==='done',targets:changes.map(describe),message:state?.message,at:state?.at,title:state?.title,summary:state?.summary};
  }
  async function restore(item){
    const changes=changesFor(item);if(!changes)return {ok:false,code:'missing',message:'未保留完整的调整前状态，请自定义调整'};
    let state=states.get(item.id);
    if(state?.status==='running'||state?.status==='done')return {ok:false,code:'busy',message:'本次恢复已在处理'};
    state ||= {changes:structuredClone(changes),completed:[],status:'idle'};
    const remaining=state.changes.filter(change=>!state.completed.includes(change.deviceId));
    const reason=remaining.map(blocked).find(Boolean);if(reason)return {ok:false,code:'blocked',message:reason};
    state.status='running';state.message='已发出恢复请求，等待设备反馈';states.set(item.id,state);onRecord?.({experienceId:item.id,scope:item.scope||'family',label:'发起恢复调整前设置',text:remaining.map(describe).join('；'),at:previewNow(),restoring:true});onChange?.();
    for(const change of remaining){
      let result;
      const reason=blocked(change);
      if(reason)result={ok:false,message:reason};
      else try{result=await requestControl(change.deviceId,change.before,{serviceId:item.id,expectedRevision:change.expectedRevision,expectedRoomId:change.roomId});}
      catch{result={ok:false,message:'暂未收到设备反馈，请稍后重试'};}
      if(!result?.ok){
        const current=deviceFor(change.deviceId);
        // A failed request may advance its own intent revision. Retry only while
        // that request is still latest and none of the source values changed.
        if(current&&result?.requestRevision===current.controlRevision&&Object.entries({...change.after,...change.guard}).every(([key,value])=>current[key]===value))change.expectedRevision=current.controlRevision;
        state.status='failed';state.at=previewNow();state.message=`${state.completed.length?`${state.completed.length}台设备已恢复；`:''}${result?.message||'设备暂未确认'}`;onRecord?.({experienceId:item.id,scope:item.scope||'family',label:'恢复未确认',text:state.message,at:state.at,restoring:true});onChange?.();
        return {ok:false,code:'failed',message:state.message};
      }
      state.completed.push(change.deviceId);
    }
    state.status='done';state.at=previewNow();state.title=changes.length===1?`${deviceFor(changes[0].deviceId)?.name||'设备'}已恢复调整前设置`:'相关设备已恢复调整前设置';state.summary=state.changes.map(describe).join('；');state.message=`设备已确认恢复。${state.summary}`;onChange?.();
    return {ok:true,message:state.message};
  }
  return {info,restore,reset:id=>states.delete(id)};
}
