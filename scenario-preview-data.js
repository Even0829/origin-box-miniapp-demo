// Fictional recent exchanges for this standalone review Demo. No live learning.
export const scenarioInsightExamples = [
  {
    scenarioId: 'away', kind: '照料方式',
    text: '离家检查时优先核对客厅空调，其他设备和空间继续检查。',
    source: '前次离家交流中，你补充：“以后出门先检查客厅空调有没有忘关，其他设备和空间也继续看。”',
    effect: '下次外出照看会优先呈现客厅空调的运行情况，其他设备与空间照常检查；不据此自动关停设备。',
    patch: { priorityDeviceIds: ['living-ac'] },
  },
  {
    scenarioId: 'sleep', kind: '照料偏好',
    text: '休息时不安排喝水等生活提醒，环境照料继续。',
    source: '前次睡前交流中，你说：“休息时别加喝水等生活提醒，安静一点就好。”',
    effect: '下次睡眠守护会暂停生活提醒，继续留意休息环境；需要提醒时可单独补充。',
    patch: { quiet: true },
  },
  {
    scenarioId: 'elder', personId: 'person-mom', kind: '生活习惯',
    text: '妈妈习惯自己安排生活节奏，不需要固定的生活提醒。',
    source: '前次关怀交流中，你补充：“妈妈习惯自己安排，别固定提醒她，必要时我再告诉你。”',
    effect: '下次关怀妈妈会以环境照料为主，具体生活提醒等你补充后再安排。',
    patch: { quiet: true },
  },
];
