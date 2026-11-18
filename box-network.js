// Browser-only provisioning model. Passwords never enter this model or its snapshot.
export const NETWORK_BUILD='box-wifi-20261117';
export const NETWORK_KEY='origin-box-network:';
export function createBoxNetwork({initial=null,persist=()=>{}}={}){
  const boxes={};
  for(const [id,b] of Object.entries(initial?.boxes||{})){
    boxes[id]={id,claimed:!!b.claimed,online:!!b.online,ssid:b.online?String(b.ssid||''):''};
  }
  let selected=boxes[initial?.selected]?initial.selected:null,epoch=0;
  const snapshot=()=>({version:1,selected,boxes:structuredClone(boxes)});
  const save=()=>persist(snapshot());
  const usable=id=>!!boxes[id]&&!boxes[id].claimed;
  return {
    snapshot,
    discover(items){for(const b of items)boxes[b.id]={id:b.id,claimed:!!b.claimed,online:!!(boxes[b.id]?.online||b.online),ssid:boxes[b.id]?.ssid||(b.online?'Pandora_Home':'')};if(!selected&&items.length===1)selected=items[0].id;save();return items.map(b=>({...boxes[b.id]}));},
    select(id){if(!boxes[id])return false;selected=id;epoch++;save();return true;},
    current(){return selected?structuredClone(boxes[selected]):null;},
    begin(){epoch++;return usable(selected)?{id:selected,epoch}:null;},
    cancel(){epoch++;},
    valid(attempt){return !!attempt&&attempt.epoch===epoch&&attempt.id===selected&&usable(attempt.id);},
    connected(attempt,ssid){if(!this.valid(attempt))return false;boxes[selected].online=true;boxes[selected].ssid=String(ssid);save();return true;},
    canActivate(attempt){return this.valid(attempt)&&boxes[selected].online;}
  };
}
