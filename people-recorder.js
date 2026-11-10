// Browser-only capture. No voiceprint extraction, upload, or persistent storage.
export const VOICE_READING = '小元你好，这是我平常说话的声音，很高兴认识你。';
export const VOICE_SAMPLE = 'assets/voice-enrollment-sample.wav';
export const MAX_VOICE_SECONDS = 30;

function previewClip(buffer, seconds) {
  const source = new DataView(buffer);
  let offset = 12, format = null, audio = null;
  const tag = n => String.fromCharCode(...new Uint8Array(buffer, n, 4));
  while (offset + 8 <= buffer.byteLength) {
    const size = source.getUint32(offset + 4, true);
    if (tag(offset) === 'fmt ') format = offset + 8;
    if (tag(offset) === 'data') { audio = { offset: offset + 8, size }; break; }
    offset += 8 + size + size % 2;
  }
  if (format === null || !audio) throw new Error('朗读样音暂时无法读取');
  const rate = source.getUint32(format + 4, true), align = source.getUint16(format + 12, true);
  const length = Math.max(align, Math.round(seconds * rate * align / align) * align);
  const output = new ArrayBuffer(44 + length), view = new DataView(output);
  const write = (at, value) => [...value].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + length, true); write(8, 'WAVE');
  write(12, 'fmt '); view.setUint32(16, 16, true);
  new Uint8Array(output, 20, 16).set(new Uint8Array(buffer, format, 16));
  write(36, 'data'); view.setUint32(40, length, true);
  new Uint8Array(output, 44).set(new Uint8Array(buffer, audio.offset, Math.min(audio.size, length)));
  return new Blob([output], { type: 'audio/wav' });
}

export function createPeopleRecorder({ preview = false, onTick = () => {}, onFinish = () => {}, onError = () => {} } = {}) {
  let generation = 0, recorder = null, stream = null, context = null, analyser = null;
  let timer = null, startedAt = 0, buffer = null, cancelled = false, recording = false, requesting = false;
  const tracksOff = () => { stream?.getTracks().forEach(track => track.stop()); stream = null; };
  const dispose = () => {
    clearInterval(timer); timer = null; tracksOff();
    if (context) context.close().catch(() => {});
    context = null; analyser = null;
  };
  function cancel() {
    generation++; cancelled = true; requesting = false; recording = false;
    if (recorder && recorder.state !== 'inactive') { try { recorder.stop(); } catch {} }
    recorder = null; dispose();
  }
  function stop(reason = 'manual') {
    if (!recording) return;
    recording = false;
    const seconds = Math.min(MAX_VOICE_SECONDS, (performance.now() - startedAt) / 1000);
    clearInterval(timer); timer = null;
    if (preview) {
      try {
        const blob = previewClip(buffer, seconds);
        dispose();
        if (!cancelled) onFinish({ id: crypto.randomUUID(), url: URL.createObjectURL(blob), blob, duration: seconds, preview: true }, reason);
      } catch (error) { dispose(); onError(error.message); }
    } else if (recorder?.state !== 'inactive') {
      recorder._captureSeconds = seconds; recorder._stopReason = reason;
      try { recorder.stop(); } catch { dispose(); onError('录音已中断，请重新录制'); }
    }
  }
  async function start() {
    if (recording || requesting) return;
    cancel(); cancelled = false; requesting = true;
    const token = generation;
    try {
      if (preview) {
        const response = await fetch(VOICE_SAMPLE);
        if (!response.ok) throw new Error('朗读样音暂时无法读取');
        const data = await response.arrayBuffer();
        if (token !== generation) return;
        buffer = data;
      } else {
        if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) throw new Error('当前浏览器暂不支持录音，请使用支持录音的浏览器');
        const acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (token !== generation) { acquired.getTracks().forEach(track => track.stop()); return; }
        stream = acquired;
        const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
        const current = new MediaRecorder(stream, mime ? { mimeType: mime } : {}), chunks = [];
        recorder = current;
        current.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        current.onerror = () => { if (token === generation) { cancel(); onError('录音中断了，请重新录制'); } };
        current.onstop = () => {
          if (token !== generation || cancelled) return;
          const blob = new Blob(chunks, { type: current.mimeType || 'audio/webm' });
          const duration = current._captureSeconds ?? Math.min(MAX_VOICE_SECONDS, (performance.now() - startedAt) / 1000);
          recording = false; dispose();
          if (!blob.size) { onError('没有收到录音，可以重新录制'); return; }
          onFinish({ id: crypto.randomUUID(), url: URL.createObjectURL(blob), blob, duration, preview: false }, current._stopReason || 'interrupted');
        };
        stream.getAudioTracks().forEach(track => track.onended = () => stop('interrupted'));
        try {
          const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
          if (AudioContext) { context = new AudioContext(); analyser = context.createAnalyser(); analyser.fftSize = 256; context.createMediaStreamSource(stream).connect(analyser); }
        } catch { analyser = null; }
        current.start();
      }
      requesting = false; recording = true; startedAt = performance.now();
      const levels = new Uint8Array(128);
      timer = setInterval(() => {
        const seconds = Math.min(MAX_VOICE_SECONDS, (performance.now() - startedAt) / 1000);
        let level = 0;
        if (analyser) { analyser.getByteTimeDomainData(levels); level = Math.min(1, Math.max(...levels.map(value => Math.abs(value - 128))) / 45); }
        else if (preview) level = 0.3 + Math.abs(Math.sin(seconds * 4)) * 0.6;
        onTick(seconds, level);
        if (seconds >= MAX_VOICE_SECONDS) stop('limit');
      }, 100);
      onTick(0, 0);
      return true;
    } catch (error) {
      if (token !== generation) return;
      requesting = false; dispose();
      const message = error.name === 'NotAllowedError' ? '未获得麦克风权限。允许使用麦克风后，可重新录制。' : error.name === 'NotFoundError' ? '没有找到可用麦克风，请检查设备后重试。' : error.message || '暂时无法开始录音，请稍后重试';
      onError(message);
      return false;
    }
  }
  return { start, stop, cancel, destroy: cancel, get active() { return recording || requesting; } };
}
