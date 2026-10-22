// Local conversation fixtures. Historical records are rendered as saved content.
export const attachmentSamples = [
  {
    id: 'sample-report',
    name: '客户方案进展简报.pdf',
    type: 'document',
    meta: 'PDF · 6页 · 428 KB',
    content: '客户方案进展简报\n\n一、客户需求\n提升接待区与会议室的使用体验，兼顾舒适度、日常管理和施工期间的正常办公\n\n二、本周进展\n已整理客户需求，完成空间分区、配置建议和分阶段实施的初版方案\n\n三、待确认事项\n客户预算范围尚未确认；实施时间和可施工时段待定；接待区是否纳入首期需要评审\n\n四、下一步\n内部评审初版方案，整理必须项和可选项；与客户确认预算及时间，再修订方案与报价\n\n五、需讨论\n哪些需求优先进入首期；哪些配置可以分阶段补充'
  },
  {
    id: 'sample-schedule',
    name: '明日事项清单.docx',
    type: 'document',
    meta: 'Word · 1页 · 24 KB',
    content: '明日事项清单\n\n09:30 在公司见客户，预计1小时\n出发到公司需要40分钟\n15:30 前完成并发出修改后的方案\n17:00 到学校接孩子，从公司出发需要30分钟\n希望中午留出时间吃饭和整理客户反馈'
  },
  {
    id: 'sample-home-image',
    name: '家里的空间布局.png',
    type: 'image',
    meta: '图片 · 1.2 MB',
    src: 'assets/space-floorplan.png',
    content: '空间布局：客厅、主卧、次卧、卫生间、厨房、餐厅'
  }
];

export const conversationSeeds = [
  {
    id: 'report-preparation',
    title: '明天汇报前的准备',
    date: '2026-10-13',
    time: '18:32',
    scope: 'personal',
    messages: [
      {
        id: 'report-01', role: 'user', time: '18:10',
        text: '明天要汇报，帮我把这份材料整理一下',
        attachments: [{ ...attachmentSamples[0], id: 'report-file' }]
      },
      {
        id: 'report-02', role: 'assistant', time: '18:10',
        text: '是内部进展汇报，还是面向客户？预计讲多久',
        blocks: [{
          type: 'choices', id: 'report-format', prompt: '确认汇报场景',
          options: [
            { label: '内部 · 3分钟', text: '内部进展汇报，控制在三分钟' },
            { label: '客户 · 5分钟', text: '面向客户，控制在五分钟' }
          ]
        }]
      },
      {
        id: 'report-03', role: 'user', time: '18:11',
        text: '内部汇报，三分钟。重点说进展、问题和下一步'
      },
      {
        id: 'report-04', role: 'assistant', time: '18:11',
        text: '这份材料可以收成三条主线，先把重点给你',
        blocks: [{
          type: 'artifact', id: 'report-summary', title: '汇报重点', kind: '资料摘要', version: 1,
          summary: '已完成什么、还缺什么、接下来怎么做',
          body: '进展\n客户需求已整理，空间分区、配置建议和分阶段实施的初版方案已完成\n\n待确认\n预算范围、实施时间和可施工时段尚未明确，接待区是否纳入首期需要评审\n\n下一步\n先内部评审，区分必须项与可选项；再与客户确认预算和时间，修订方案与报价\n\n需讨论\n首期优先满足哪些需求，哪些配置可以分阶段补充\n\n待核实\n材料未提供预算金额和具体实施日期，汇报时先不作承诺'
        }]
      },
      {
        id: 'report-05', role: 'user', time: '18:12',
        text: '按这个写成能直接讲的三分钟稿，语气自然些'
      },
      {
        id: 'report-06', role: 'assistant', time: '18:13',
        text: '我按“进展—问题—下一步”整理好了，约三分钟，正常语速即可',
        blocks: [{
          type: 'artifact', id: 'report-script', title: '明日进展汇报', kind: '汇报稿', version: 1,
          summary: '约三分钟 · 内部汇报',
          body: '今天主要同步客户方案的进展、待确认事项，以及下一步安排\n\n先说进展。客户希望提升接待区和会议室的使用体验，同时兼顾舒适度、日常管理，以及施工期间的正常办公。我们已经整理了这些需求，并完成了空间分区、配置建议和分阶段实施的初版方案。目前这版方案可以用于内部讨论，但还需要结合预算和实施时间进一步收敛\n\n接下来有三件事需要确认。第一是预算范围，这会影响配置选择，也决定哪些内容放在首期。第二是实施时间和可施工时段，尤其需要提前考虑如何减少对日常办公的影响。第三是接待区是否纳入首期，这一点要和会议室的需求一起比较优先级\n\n下一步，我们建议先做内部评审，把需求和配置分成必须项与可选项，明确哪些内容需要一次完成，哪些可以分阶段补充。完成内部评审后，再与客户确认预算和时间，修订方案与报价。这样可以减少反复修改，也让客户更容易理解每项选择对应的投入和效果\n\n最后希望集中讨论两个问题：首期优先满足哪些需求，以及哪些配置可以后续补充。预算金额和具体实施日期目前都还没有确认，这次先明确方案方向，暂时不作承诺'
        }]
      },
      {
        id: 'report-07', role: 'user', time: '18:15',
        text: '再简短些，我想留一分钟讨论问题'
      },
      {
        id: 'report-08', role: 'assistant', time: '18:15',
        text: '压到约两分钟，保留结论和需要讨论的两件事',
        blocks: [{
          type: 'artifact', id: 'report-script-short', title: '明日进展汇报', kind: '汇报稿', version: 2,
          summary: '约两分钟 · 留出讨论时间',
          body: '这次主要同步客户方案的进展、待确认事项和下一步\n\n客户希望改善接待区与会议室的使用体验，同时减少施工对正常办公的影响。目前需求已整理，空间分区、配置建议和分阶段实施的初版方案已完成\n\n还有三件事待确认：预算范围、实施时间和可施工时段，以及接待区是否纳入首期。这些信息会影响配置选择与实施顺序，暂时不承诺具体金额和日期\n\n下一步先做内部评审，区分必须项与可选项；再与客户确认预算和时间，修订方案与报价\n\n接下来希望讨论：首期优先满足哪些需求，哪些配置可以分阶段补充'
        }]
      },
      {
        id: 'report-09', role: 'user', time: '18:17',
        text: '就这个。另外客厅灯有点亮，调柔和些，我继续看材料'
      },
      {
        id: 'report-10', role: 'assistant', time: '18:17',
        text: '客厅灯光已调柔和，保留看材料需要的亮度',
        blocks: [{
          type: 'device', id: 'report-lamp', name: '客厅主灯', image: 'assets/receipt-lamp.png',
          summary: '亮度降至60%，色温调至暖白', status: '已调整', value: '60%',
          detail: '18:17 收到设备反馈：亮度60%，色温3500 K。需要再亮或再暗一点，可以继续调整',
          metricLabel: '亮度', level: 60
        }]
      },
      {
        id: 'report-11', role: 'user', time: '18:20',
        text: '还有点闷，换换气，尽量安静。好了告诉我'
      },
      {
        id: 'report-12', role: 'assistant', time: '18:20',
        text: '新风已切换到低噪运行。我会继续留意客厅空气的变化',
        blocks: [{
          type: 'progress', id: 'report-air-start', title: '留意客厅空气', status: '持续观察',
          summary: '新风已回应，等待空气改善',
          steps: [
            { label: '查看近况', detail: '客厅 CO₂ 1180 ppm，有人在场', status: 'done' },
            { label: '低噪换气', detail: '新风设备已反馈低噪运行', status: 'done' },
            { label: '观察变化', detail: '继续查看 CO₂ 是否回落并保持平稳', status: 'active' }
          ]
        }]
      },
      {
        id: 'report-13', role: 'assistant', time: '18:32',
        text: '客厅空气回稳了，CO₂ 已降到790 ppm。我又留意了三分钟，没有明显回升',
        blocks: [
          {
            type: 'device', id: 'report-air-result', name: '客厅新风', image: 'assets/air-device.png',
            summary: '低噪换气后，客厅 CO₂ 从1180降至790 ppm', status: '已调整', value: '790 ppm',
            detail: '环境传感器连续反馈 CO₂ 回落。新风保持低噪运行，本次空气变化观察已完成',
            metricLabel: 'CO₂',
            chart: [1180, 1090, 960, 850, 790, 795, 790],
            chartLabels: ['18:20', '18:22', '18:24', '18:26', '18:29', '18:30', '18:32'],
            chartUnit: 'ppm'
          },
          {
            type: 'progress', id: 'report-air-complete', title: '客厅空气回稳', status: '已完成',
            summary: '换气和后续观察均已完成',
            steps: [
              { label: '新风回应', detail: '18:20 · 已切换低噪运行', status: 'done' },
              { label: '空气改善', detail: '18:29 · CO₂ 降至790 ppm', status: 'done' },
              { label: '继续观察', detail: '18:32 · 三分钟内没有明显回升', status: 'done' }
            ]
          }
        ]
      },
      {
        id: 'report-14', role: 'user', time: '18:32',
        text: '好，灯光也合适。汇报稿我晚点再看'
      },
      {
        id: 'report-15', role: 'assistant', time: '18:32',
        text: '好，两分钟版本留在这里。晚点需要调整，接着这段聊就可以'
      }
    ]
  },
  {
    id: 'tomorrow-plan',
    title: '安排明天的事情',
    date: '2026-10-12',
    time: '20:46',
    scope: 'personal',
    messages: [
      {
        id: 'plan-01', role: 'user', time: '20:40',
        text: '明天见客户，还要接孩子，帮我排一下',
        attachments: [{ ...attachmentSamples[1], id: 'plan-file' }]
      },
      {
        id: 'plan-02', role: 'assistant', time: '20:40',
        text: '我看到客户约在9:30，接孩子是17:00。方案修改大概需要多久'
      },
      {
        id: 'plan-03', role: 'user', time: '20:41',
        text: '两小时左右，最好午饭后集中做'
      },
      {
        id: 'plan-04', role: 'assistant', time: '20:42',
        text: '把修改安排在午饭后，出行各留一点余量。先整理成这份安排',
        blocks: [{
          type: 'artifact', id: 'plan-day', title: '明日安排', kind: '日程安排', version: 1,
          summary: '见客户、改方案、接孩子，时间已错开',
          body: '08:40 出发去公司\n通勤约40分钟，留10分钟余量\n\n09:30—10:30 见客户\n\n10:30—11:00 整理客户反馈\n把需要修改的内容先列清楚\n\n12:00—13:00 午饭与休息\n\n13:00—15:00 修改方案\n\n15:00—15:30 检查并发出方案\n\n16:20 出发去学校\n路程约30分钟，留10分钟余量\n\n17:00 接孩子\n\n需留意\n客户会面如果延长，优先保留方案检查时间；16:20 后不再安排新的工作事项'
        }]
      },
      {
        id: 'plan-05', role: 'user', time: '20:45',
        text: '可以，出发去学校再提前十分钟，放学有点堵'
      },
      {
        id: 'plan-06', role: 'assistant', time: '20:46',
        text: '改成16:10出发，其他安排保持。路上多留十分钟',
        blocks: [{
          type: 'artifact', id: 'plan-day-updated', title: '明日安排', kind: '日程安排', version: 2,
          summary: '16:10出发接孩子，其余安排不变',
          body: '08:40 出发去公司\n09:30—10:30 见客户\n10:30—11:00 整理反馈\n12:00—13:00 午饭与休息\n13:00—15:00 修改方案\n15:00—15:30 检查并发出方案\n16:10 出发去学校\n17:00 接孩子\n\n调整说明\n去学校的路程留出20分钟余量，工作事项尽量在16:10前收尾'
        }]
      }
    ]
  },
  {
    id: 'bedroom-light-response',
    title: '主卧灯暂未回应',
    date: '2026-10-11',
    time: '22:07',
    scope: 'personal',
    messages: [
      {
        id: 'bedroom-01', role: 'user', time: '22:05',
        text: '把主卧灯关了吧'
      },
      {
        id: 'bedroom-02', role: 'assistant', time: '22:05',
        text: '关灯请求已发出，正在等主卧灯回应',
        blocks: [{
          type: 'progress', id: 'bedroom-request', title: '关闭主卧灯', status: '未完成',
          summary: '请求已发出，暂未收到设备反馈',
          steps: [
            { label: '发送请求', detail: '已请求关闭主卧灯', status: 'done' },
            { label: '等待回应', detail: '设备没有返回新的状态', status: 'waiting' }
          ]
        }]
      },
      {
        id: 'bedroom-03', role: 'assistant', time: '22:06',
        text: '主卧灯暂未回应，还不能确认已经关灯。可以重新尝试，或查看设备连接',
        blocks: [{
          type: 'choices', id: 'bedroom-next', prompt: '接下来怎么处理',
          options: [
            { label: '再试一次', text: '再试一次关闭主卧灯' },
            { label: '查看设备', text: '查看主卧灯的连接状态' }
          ]
        }]
      },
      {
        id: 'bedroom-04', role: 'user', time: '22:07',
        text: '先不用，我手动关了'
      },
      {
        id: 'bedroom-05', role: 'assistant', time: '22:07',
        text: '好，按你的反馈记下这次手动关灯。设备连接恢复后，再核对它的状态'
      }
    ]
  }
];
