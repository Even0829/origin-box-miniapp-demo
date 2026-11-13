const clean = value => String(value ?? '').trim().replace(/[。！!]+$/u,'');

// Bounded prototype rules: public-space words alone never make a memory shared.
export function inferMemoryScope(value) {
  const text=clean(value);
  if (/(?:只(?:对|针对|适用[于给]?)我|仅自己|不要共享|别共享|不要分享|别分享|不(?:要|用)?给家人看|不是全家|不是大家|我个人|我的偏好|我的习惯)/u.test(text)) return 'personal';
  if (/(?:可能|也许|假如|如果|别人家|朋友家|听说|据说)/u.test(text)) return 'personal';
  if (/(?:血糖|血压|病情|用药|吃药|工资|收入|密码|私事|私密|不想让.*知道)/u.test(text)) return 'personal';
  if (/我(?!们)/u.test(text)) return 'personal';
  const household=/(?:我们家|我们全家|全家|家庭共同|家里的共同|家里共同|所有家人|家庭成员都|大家都|家里都|所有人都)/u.test(text);
  const common=/(?:约定|规则|安排|公共|都|统一|共同|保持|尽量|以后|晚上|早上|睡前)/u.test(text);
  return household&&common?'family':'personal';
}

export function parseMemoryScopeCorrection(value) {
  const text=clean(value).replace(/[，,\s]/gu,'');
  if (/^(?:(?:不对|纠正一下|补充一下)[：:]?)?(?:(?:这条|这条记忆|这个|这个安排|刚才那条|它|这)是?)?(?:只(?:针对|对)我(?:的)?(?:偏好|习惯|适用)?|只对我适用|只适用于我|仅自己(?:可见)?|我个人的(?:偏好|习惯)|我的(?:偏好|习惯)|不是全家(?:的约定)?|不(?:要|用)?给家人看|不要共享|别共享)$/u.test(text)) return 'personal';
  if (/^(?:(?:不对|纠正一下|补充一下)[：:]?)?(?:(?:这条|这条记忆|这个|这个安排|刚才那条|它|这)是?)?(?:全家(?:的|共同的)?(?:约定|安排|规则)|我们家(?:的)?共同(?:约定|安排|规则)|家里(?:的)?共同(?:约定|安排|规则)|全家都适用|大家都(?:适用|这样)|家庭共享|家人(?:也|都)?可以(?:查看|知道))$/u.test(text)) return 'family';
  if (/^(?:把|将)?(?:这条记忆|这条|它)(?:改成|改为|设为|记为)(?:个人记忆|仅自己(?:可见)?)$/u.test(text)) return 'personal';
  if (/^(?:把|将)?(?:这条记忆|这条|它)(?:改成|改为|设为|记为)(?:家庭共享|家庭共同约定)$/u.test(text)) return 'family';
  return null;
}
