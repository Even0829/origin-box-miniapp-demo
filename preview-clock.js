// A shared local scenario clock keeps conversations and activity records aligned.
export const previewDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const startedAt=Date.now();
const initialTime=Date.parse(previewDate+'T18:40:00+08:00');
export const previewNow=()=>initialTime+Date.now()-startedAt;
