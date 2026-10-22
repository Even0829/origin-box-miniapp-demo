const frames = [
  { id: 'sunny', label: '晴天' },
  { id: 'cloudy', label: '多云' },
  { id: 'overcast', label: '阴天' },
  { id: 'rain', label: '下雨' },
  { id: 'snow', label: '下雪' }
].map(frame => ({ ...frame, src: `assets/weather/${frame.id}.png` }));

/** A visual preview only; the fixed sky and its pinned copy share one clock. */
export function createWeatherPreview() {
  const skies = [...document.querySelectorAll('.sky')];
  let index = 0, front = 0, timer = null, ready = false;
  const loaded = frames.map(frame => {
    const image = new Image();
    image.src = frame.src;
    return image.decode().then(() => true, () => false);
  });
  const mark = frame => skies.forEach(sky => {
    sky.dataset.weather = frame.id;
    sky.dataset.weatherLabel = frame.label;
  });
  mark(frames[0]);

  function schedule() {
    clearTimeout(timer);
    if (ready && !document.hidden) timer = setTimeout(advance, 16000);
  }

  async function advance() {
    const next = (index + 1) % frames.length;
    if (await loaded[next]) {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      skies.forEach(sky => {
        const layers = sky.querySelectorAll('.weather-layer');
        const incoming = layers[1 - front], outgoing = layers[front];
        // Reveal the new image underneath an opaque outgoing image, then fade only the latter.
        incoming.style.transition = 'none';
        incoming.src = frames[next].src;
        incoming.style.zIndex = '0';
        incoming.style.opacity = '1';
        outgoing.style.zIndex = '1';
        outgoing.style.transition = reduce ? 'none' : 'opacity 900ms ease-in-out';
        outgoing.style.opacity = '0';
      });
      front = 1 - front;
      mark(frames[next]);
    }
    index = next;
    schedule();
  }

  Promise.all(loaded).then(() => { ready = true; schedule(); });
  document.addEventListener('visibilitychange', schedule);
}
