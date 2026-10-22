/** A negative sensor reading alone does not verify an empty home. */
export function evaluateHomePresence(rooms = [], devices = []) {
  const ids = new Set(rooms.map(room => room.id));
  const sources = devices.filter(device => ids.has(device.roomId) && device.inputCapabilities?.includes('在场'));
  const readable = device => device.online && device.permissions?.read !== false;
  const positive = room => {
    const local = sources.filter(device => device.roomId === room.id);
    if (local.some(device => readable(device) && device.readings?.some(reading => reading.key === 'presence' && reading.value === true))) return true;
    const valid = room.observed && (!local.length || local.some(readable));
    return valid && /^(?:[1-9]\d*人在场|有人在场|检测到人在场)/u.test(room.presence || '');
  };
  const occupied = rooms.filter(positive);
  const vacant = rooms.length > 0 && rooms.every(room => room.observed && room.presence === '已确认无人' && (!sources.some(device => device.roomId === room.id) || sources.some(device => device.roomId === room.id && readable(device))));
  return {
    state: occupied.length ? 'occupied' : vacant ? 'vacant' : 'unknown',
    names: occupied.map(room => room.name),
    key: JSON.stringify([rooms.map(room => [room.id, room.observed, room.presence]), sources.map(device => [device.id, device.online, device.permissions?.read, (device.readings || []).filter(reading => reading.key === 'presence').map(reading => [reading.value, reading.updatedAt ?? device.updatedAt])])]),
  };
}
