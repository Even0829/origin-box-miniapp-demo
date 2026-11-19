// Shared, fictional household records. Loading the examples performs no actions.
export const grandpa = { id: 'health-demo-grandpa', name: '爷爷' };
export const grandma = { id: 'health-demo-grandma', name: '奶奶' };

export const elderMemories = [
  { id: 'elder-night-route', careTopic: 'check', personId: grandpa.id, subject: grandpa.name, context: '夜间起身',
    text: '爷爷起夜，客厅留三成灯。原有灯光照旧，回床后本人同意、家人用完再关。',
    help: '下次爷爷起夜时，可以照他熟悉的亮度留灯，也照顾还在客厅用灯的家人。',
    basis: ['爷爷和家人一起定了起夜用灯的办法。从次卧去卫生间要经过客厅，原本关灯时三成亮度就够。大家也约好，原本亮着的灯照旧。替爷爷开的灯，等他回床说可以关、其他家人也用完了再关。'] },
  { id: 'elder-nap-agreement', formation: 'confirmed-summary', careTopic: 'environment', personId: grandpa.id, subject: grandpa.name, roomId: 'second', context: '次卧午休',
    text: '爷爷午睡时，普通家务提醒留到醒后。',
    help: '安排普通家务提醒时，可以避开爷爷正在午睡的时段。',
    basis: ['两次午休时，家人都把原本要告诉爷爷的家务事留到了醒后。小元据此向他们核对午休时的提醒习惯。', '爷爷和家人确认，以后买菜、取快递这类不着急的事都等他醒了再说，并同意记为家里的安排。'] },
  { id: 'elder-morning-agreement', careTopic: 'routine', personId: grandma.id, subject: grandma.name, context: '早餐前晨测',
    text: '奶奶晨测七点半提醒，当天空腹记录已同步就免提醒。',
    help: '下次到提醒时间，可以核对奶奶当天的测量记录，省去重复提醒。',
    basis: ['奶奶和家人一起定下每天的晨测提醒，交代小元记住七点半这个时间，并约好提醒前先查当天的空腹记录。'] },
  { id: 'elder-knitting-agreement', formation: 'confirmed-summary', careTopic: 'environment', personId: grandma.id, subject: grandma.name, roomId: 'living', context: '客厅用灯',
    text: '奶奶织毛衣时保留客厅主灯，收针后再调暗。',
    help: '下次有人想把客厅调成观影灯光时，可以先问奶奶还用不用主灯。',
    basis: ['小元留意到，家人有两次在客厅开电视时都保留了主灯亮度，于是问他们什么时候需要留灯。', '奶奶说明自己织毛衣时要借主灯看针脚。家人一起确认了织毛衣和看电视同时用灯的办法，同意以后照此安排。'] },
];

// Each historical device observation is also available in that device’s activity list.
export function elderDeviceHistory(at) {
  return {
    'living-radar': [
      { id: 'elder-living-low', at: at(0, 16, 42), title: '客厅姿态变化', detail: '有人从坐姿变为低位停留，随后仍有轻微活动。' },
    ],
    'second-environment': [
      { id: 'elder-room-temperature', at: at(0, 14, 20), title: '收到室温读数', detail: '次卧温湿度传感器记录到室温 23℃。' },
    ],
    'second-heater': [
      { id: 'elder-heater-feedback', at: at(0, 14, 12), title: '暖风设置已确认', detail: '暖风模式已开启，设定温度 24℃。' },
      { id: 'elder-heater-off', at: at(0, 14, 28), title: '暖风机已关闭', detail: '设备返回关机状态。' },
    ],
  };
}

// Align all three independent device histories with the same recorded night.
export function nightDeviceHistory(sessionEnd) {
  const dayStart = Math.floor((sessionEnd + 8 * 3600000) / 86400000) * 86400000 - 8 * 3600000;
  const at = (h, m, sec = 0) => dayStart + (h * 3600 + m * 60 + sec) * 1000;
  return {
    'second-sleep-belt': [
      {id:'night-bed-exit', at:at(2,57), title:'离床', detail:'次卧睡眠带由在床转为离床。'},
      {id:'night-bed-return', at:at(3,6), title:'回床', detail:'次卧睡眠带再次检测到在床。'},
    ],
    'living-radar': [
      {id:'night-living-entry', at:at(2,58), title:'客厅有人活动', detail:'客厅毫米波雷达检测到有人走动。'},
      {id:'night-living-clear', at:at(3,6,10), title:'客厅在场读数更新', detail:'客厅毫米波雷达当前未检测到人在场。'},
    ],
    'living-lamp': [
      {id:'night-lamp-before', at:at(2,56,59), title:'夜间照明初始状态', detail:'客厅主灯反馈关闭。'},
      {id:'night-lamp-on', at:at(2,57,2), title:'起夜留灯', detail:'客厅主灯反馈开启，亮度 30%。'},
      {id:'night-lamp-off', at:at(3,6,28), title:'起夜照明已关闭', detail:'客厅主灯反馈关闭。'},
    ],
  };
}

const correctionSamples = {
  'elder-night-lighting': ['补充记录：爷爷回床后才说可以关灯', '客厅主灯保持现在这样'],
  'elder-nap-warmth': ['补充记录：是爷爷醒了以后自己要开暖风的', '暖风机保持现在这样'],
  'elder-evening-pill': ['补充记录：家人问的是昨晚那一格药盒'],
  'elder-morning-check': ['补充记录：奶奶说这次测量是在早餐前'],
  'elder-yarn-check': ['补充记录：是奶奶自己说已经坐好了'],
};

export function elderCareServices(store, members) {
  const services = [];
  const has = person => members.some(member => member.id === person.id);
  const minute = 60000;
  const observation = (device, id) => store.getHistory(device).find(entry => entry.id === id);
  function add(id, title, summary, status, state, deviceIds, reason, next, entries) {
    services.push({ id, kind: 'event', operationKind: 'event', careEvent: true, elderExample: true, correctionSamples: correctionSamples[id],
      previewPriority: id === 'elder-night-lighting' ? -2 : -1, scope: 'family', title, summary, status, state, deviceIds, reason, next,
      entries, evidence: entries.map(([at, source, value]) => ({ at, source, value })) });
  }
  const heater = observation('second-heater', 'elder-heater-feedback');
  const roomTemperature = observation('second-environment', 'elder-room-temperature');
  if (has(grandpa) && heater && roomTemperature) {
    const off = observation('second-heater', 'elder-heater-off');
    const entries = [[heater.at - minute, '爷爷提出需要', '“我午觉醒了，有点冷，把次卧暖风开到 24℃吧。”'], [heater.at, '暖风机反馈', heater.detail],
      [roomTemperature.at, '温湿度传感器', roomTemperature.detail]];
    if (off) entries.push([off.at - minute, '爷爷本人反馈', '“暖和了，帮我把暖风关了吧。”'], [off.at, '暖风机反馈', off.detail]);
    add('elder-nap-warmth', off ? '爷爷说暖和了，次卧暖风已关' : '爷爷午休醒后开了暖风',
      off ? '午休醒后按爷爷的要求开了暖风。爷爷说已经暖和，小元关机后收到了设备反馈。' : '设备已反馈暖风设定 24℃，还没有爷爷的体感反馈。',
      off ? '已完成' : '持续观察', off ? 'past' : 'active', ['second-heater', 'second-environment'],
      '爷爷醒来后主动提出这次取暖要求。', off ? '本次取暖已结束。' : '继续看室温，舒不舒服由爷爷自己说。', entries);
  }
  const pill = store.get('second-pillbox')?.health;
  if (has(grandpa) && pill?.subject?.id === grandpa.id) {
    const reminder = pill.records.find(r => r.id === 'pill-evening-reminder');
    if (reminder?.doseId) {
      const entries = pill.records.filter(r => r.doseId === reminder.doseId).sort((a, b) => a.at - b.at);
      const confirmed = entries.some(r => r.kind === 'confirmed');
      const opened = entries.some(r => r.kind === 'opened');
      const summary = confirmed ? '这次晚间用药已有本人确认。' : opened ? '药盒已提醒，随后记录到开盒。这次是否服用，还没有本人确认。' : '药盒已提醒，本次还没有开盒或服用记录。';
      const lastAt = entries.at(-1).at;
      add('elder-evening-pill', '帮家人核对了爷爷晚间的药盒记录', summary, confirmed ? '本人已确认' : '已核对药盒', 'past', ['second-pillbox'],
        '家人问起这次晚药，小元调出了对应时段的药盒记录。', confirmed ? '本次记录已齐。' : '这次是否服用，家人还可以向爷爷核实。',
        [...entries.map(r => [r.at, r.kind === 'confirmed' ? '本人确认' : '药盒记录', r.title]),
         [lastAt + minute, '家人询问', '“爷爷这次晚上的药，有记录吗？”'],
         [lastAt + minute + 3000, '小元核对后回复', summary]]);
    }
  }
  const glucose = store.get('second-blood-glucose')?.health;
  const morning = glucose?.measurements?.find(row => row.id === glucose.morningCheck?.measurementId);
  const due = glucose?.morningCheck?.dueAt;
  const shanghaiDay = time => Math.floor((time + 8 * 3600000) / 86400000);
  if (has(grandma) && (morning?.subjectId ?? glucose?.subject?.id) === grandma.id && morning?.context === '空腹' &&
      shanghaiDay(morning.at) === shanghaiDay(due) && morning.at <= morning.receivedAt && morning.receivedAt <= due) {
    add('elder-morning-check', '奶奶晨测过了，早餐前少一次提醒', '血糖仪已有这次晨测记录，小元按家里的约定跳过了七点半的提醒。', '已完成', 'past', ['second-blood-glucose'],
      '家里约定，早餐前测过就不用再提醒。', '本次安排已结束。测量时间和数值可在血糖仪里查看。',
      [[morning.receivedAt, '血糖仪同步', '已收到这次早餐前的测量记录。'], [glucose.morningCheck.dueAt, '跳过本次提醒', '核对到同一次晨测记录，没有另发提醒。']]);
  } else if (has(grandma) && glucose?.subject?.id === grandma.id && Number.isFinite(due)) {
    add('elder-morning-check', '奶奶的晨测提醒记录待核对', '七点半有一次晨测提醒安排，现有记录还不能确认当时是否已收到奶奶这次的测量结果。',
      '待核对', 'active', ['second-blood-glucose'], '跳过提醒需要核对本人、测量日期、空腹标记和读数同步时间。',
      '先核对这次晨测及提醒记录，补齐后再更新。',
      [[due, '原定提醒时间', '家人安排在七点半提醒奶奶晨测，本次提醒的执行结果待核对。']]);
  }
  const low = observation('living-radar', 'elder-living-low');
  if (has(grandma) && low) {
    add('elder-yarn-check', '奶奶捡起了毛线，回应说不用帮忙', '客厅雷达发现有人低身停了一会儿。小元问了一声，奶奶说毛线团滚到了椅子底下，自己已经坐好了。', '本人已回应', 'past', ['living-radar'],
      '低位停留既可能是弯腰取东西，也可能是起身有困难，小元先问屋里的人要不要帮忙。', '奶奶已回应并说明自己坐好了，本次问候结束。',
      [[low.at, '客厅雷达', low.detail], [low.at + 4 * 1000, '小元问候', '“要帮忙吗？”'],
       [low.at + 13 * 1000, '奶奶本人回应', '“毛线团掉了，我捡起来啦，已经坐好了，不用帮忙。”']]);
  }
  const belt = store.get('second-sleep-belt')?.health;
  const session = belt?.session;
  // These two replies belong to the scripted conversation on the night of this report.
  const dayStart = shanghaiDay(session?.end) * 86400000 - 8 * 3600000;
  const leaveAt = dayStart + (2 * 60 + 57) * minute;
  const requestAt = dayStart + (3 * 60 + 6) * minute + 24000;
  function nightReading(device, id, earliest, latest) {
    const row = observation(device, id);
    return row?.status === 'confirmed' && row.at >= earliest && row.at <= latest ? row : null;
  }
  const exit = nightReading('second-sleep-belt', 'night-bed-exit', leaveAt, leaveAt + 12000);
  if (has(grandpa) && belt?.subject?.id === grandpa.id && exit && session.start <= exit.at && requestAt < session.end) {
    const initial = nightReading('living-lamp', 'night-lamp-before', exit.at - minute, exit.at);
    const on = nightReading('living-lamp', 'night-lamp-on', exit.at, leaveAt + minute);
    const motion = nightReading('living-radar', 'night-living-entry', exit.at, requestAt);
    const back = nightReading('second-sleep-belt', 'night-bed-return', exit.at, requestAt);
    const clear = nightReading('living-radar', 'night-living-clear', motion?.at, requestAt);
    const off = nightReading('living-lamp', 'night-lamp-off', requestAt, Math.min(requestAt + minute, session.end));
    const closed = initial && on && motion && back && clear && off && on.at <= motion.at && motion.at < back.at;
    const entries = [[exit.at, '次卧睡眠带', exit.detail],
      [leaveAt + 12000, '爷爷本人说明', '“我去趟卫生间，路上的灯给我留着。”'],
      [requestAt, '爷爷本人回应', '“我回床了，客厅的灯可以关了。”']];
    for (const [row, source] of [[initial, '客厅主灯'], [on, '客厅主灯'], [motion, '客厅毫米波雷达'],
      [back, '次卧睡眠带'], [clear, '客厅毫米波雷达'], [off, '客厅主灯']]) {
      if (row) entries.push([row.at, source, row.detail]);
    }
    entries.sort((a,b) => a[0]-b[0]);
    const openSummary = [on ? '客厅主灯已反馈三成亮度。' : '客厅留灯尚缺开启回执。', back ? '睡眠带已有回床记录。' : '睡眠带尚缺回床记录。', '本次经过仍待核对。'].join('');
    add('elder-night-lighting', closed ? '爷爷夜里起身，客厅为他留了灯' : '爷爷起夜，留灯经过待核对',
      closed ? '次卧睡眠带记录到离床，小元按约点亮客厅。雷达随后检测到客厅有人走动。睡眠带记录到回床，爷爷也说可以关灯了。' : openSummary,
      closed ? '已完成' : '等待反馈', closed ? 'past' : 'active', ['second-sleep-belt','living-radar','living-lamp'].filter(id=>store.get(id)),
      '爷爷从次卧去卫生间会经过客厅，家人提前约定了这段路的留灯方式。起夜的用途来自爷爷本人说明，雷达提供客厅范围内的在场线索。',
      closed ? '爷爷回床后要求关灯，客厅雷达当时未检测到人在场，主灯随后反馈关闭。' : '保留已有反馈，继续核对缺少的环节。', entries);
  }
  return services;
}
