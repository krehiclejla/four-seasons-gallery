import { useEffect, useRef, useState } from 'react'

// The Four Seasons Gallery: a Godot 4 game made in Game Studio, wrapped as its own app.
// The wrapper downloads the engine (gzip-compressed to fit the app package) and the game pack
// with a progress bar, then hands them to an inline game frame that unpacks and starts Godot.
// (App pages allow WebAssembly; the nested asset lane does not, so the game runs in srcdoc.)

const CSS = `
  .fsg-root { position: fixed; inset: 0; background: #120d0b; font-family: var(--font); }
  .fsg-frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; opacity: 0; transition: opacity .6s ease; }
  .fsg-frame.fsg-on { opacity: 1; }
  .fsg-cover { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; color: #f6ead6;
    background: radial-gradient(120% 90% at 50% 30%, #3a2618 0%, #160f0c 70%); transition: opacity .6s ease;
    padding: max(24px, var(--mobius-safe-top)) 24px max(24px, var(--mobius-safe-bottom)); }
  .fsg-cover.fsg-gone { opacity: 0; pointer-events: none; }
  .fsg-kicker { font-size: 13px; letter-spacing: .14em; color: #e9c47a; text-transform: uppercase; }
  .fsg-title { font-family: Georgia, 'Times New Roman', serif; font-size: clamp(30px, 6vw, 52px); margin: 10px 0 6px; }
  .fsg-seasons { display: flex; gap: 14px; justify-content: center; font-family: Georgia, serif; font-style: italic; font-size: 18px; }
  .fsg-bar { width: min(320px, 70vw); height: 6px; border-radius: 3px; background: rgba(255,255,255,.12); margin: 26px auto 10px; overflow: hidden; }
  .fsg-fill { height: 100%; background: linear-gradient(90deg, #f4b6c8, #f5b82e, #e07b2e, #a9d8f5); transition: width .3s ease; }
  .fsg-note { font-size: 14px; color: #cdbfae; min-height: 20px; }
  .fsg-retry { margin-top: 14px; min-height: 44px; padding: 0 22px; border-radius: 22px; border: 0; background: #e9c47a; color: #1b120c;
    font: 600 15px var(--font); cursor: pointer; }
  .fsg-retry:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { .fsg-frame, .fsg-cover, .fsg-fill { transition: none; } }
`

const SEASONS = [['Spring', '#f4b6c8'], ['Summer', '#f5b82e'], ['Autumn', '#e9864a'], ['Winter', '#a9d8f5']]

const BOOT = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>html,body{margin:0;height:100%;overflow:hidden;background:#120d0b;touch-action:none}canvas{display:block;width:100%;height:100%;outline:none}</style></head>
<body><canvas id="canvas" tabindex="0"></canvas><script>
(() => {
  const say = (type, extra) => parent.postMessage(Object.assign({ type }, extra || {}), '*');
  addEventListener('message', async (e) => {
    const d = e.data; if (!d || d.type !== 'fsg:files') return;
    try {
      const wasm = await new Response(d.wasmGz.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      const pck = await d.pck.arrayBuffer();
      const files = { 'index.wasm': [wasm, 'application/wasm'], 'index.pck': [pck, 'application/octet-stream'] };
      const realFetch = window.fetch.bind(window);
      window.fetch = (url, init) => { const f = files[String(url).split('?')[0].split('/').pop()]; return f ? Promise.resolve(new Response(f[0], { headers: { 'Content-Type': f[1] } })) : realFetch(url, init); };
      if (window.AudioWorklet && d.assetBase) {
        const add = AudioWorklet.prototype.addModule;
        AudioWorklet.prototype.addModule = function (path, opts) {
          const m = String(path).match(/index[.](audio(?:[.]position)?[.]worklet[.]js)$/);
          return add.call(this, m ? d.assetBase + 'index.' + m[1] : path, opts);
        };
      }
      try { Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistration: () => Promise.resolve(undefined), register: () => Promise.reject(new Error('none')) }, configurable: true }); } catch (_) {}
      (0, eval)(d.engineJs);
      const engine = new Engine({ executable: 'index', mainPack: 'index.pck', canvasResizePolicy: 2, focusCanvas: true, args: [],
        fileSizes: { 'index.pck': pck.byteLength, 'index.wasm': wasm.byteLength } });
      await engine.startGame();
      files['index.wasm'] = null; files['index.pck'] = null;
      say('fsg:ready');
    } catch (err) { say('fsg:error', { message: String(err && err.message || err) }); }
  });
  addEventListener('pointerdown', () => {
    if (!document.fullscreenElement && !matchMedia('(display-mode: fullscreen)').matches) document.documentElement.requestFullscreen?.().catch(() => {});
  }, { passive: true, once: true });
  say('fsg:boot');
})();
<\/script></body></html>`

export default function App({ appId }) {
  const frame = useRef(null)
  const files = useRef(null)
  const booted = useRef(false)
  const [state, setState] = useState('loading')   // loading | ready | error
  const [pct, setPct] = useState(0)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const post = (value) => window.parent.postMessage({ type: 'moebius:immersive', value, appId }, '*')
    post(true)
    return () => post(false)
  }, [appId])

  useEffect(() => {
    let alive = true
    setState('loading'); setPct(0)
    const base = `/app-assets/by-id/${appId}/`
    const got = {}
    const send = () => {
      const w = frame.current?.contentWindow
      if (w && booted.current && files.current) {
        w.postMessage({ type: 'fsg:files', ...files.current, assetBase: new URL(base, window.location.href).href }, '*')
      }
    }
    // fetch one file, counting its bytes toward the progress bar
    const fetchCounted = async (name) => {
      const res = await fetch(base + name)
      if (!res.ok) throw new Error(name + ' ' + res.status)
      const reader = res.body.getReader()
      const chunks = []
      got[name] = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        got[name] += value.length
        const have = Object.values(got).reduce((a, b) => a + b, 0)
        if (alive) setPct(Math.min(99, Math.round((have / total) * 100)))
      }
      return new Blob(chunks)
    }
    // the engine and the game pack are stored as 1 MB parts; fetch a few at a time, join in order
    const loadParts = async (kind, count) => {
      const names = Array.from({ length: count }, (_, i) => `${kind}/part-${String(i).padStart(3, '0')}.bin`)
      const blobs = new Array(count)
      let next = 0
      const worker = async () => { while (next < count) { const i = next++; blobs[i] = await fetchCounted(names[i]) } }
      await Promise.all([worker(), worker(), worker(), worker()])
      return new Blob(blobs)
    }
    let total = 45335665
    ;(async () => {
      try {
        if (!files.current) {
          const parts = await (await fetch(base + 'parts.json')).json()
          total = parts.wasm.bytes + parts.pck.bytes + 279815
          const [js, wasmGz, pck] = await Promise.all([fetchCounted('godot.js'), loadParts('wasm', parts.wasm.count), loadParts('pck', parts.pck.count)])
          files.current = { engineJs: await js.text(), wasmGz, pck }
        }
        if (alive) setPct(100)
        send()
      } catch {
        if (alive) setState('error')
      }
    })()
    const onMsg = (e) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return
      const d = e.data || {}
      if (d.type === 'fsg:boot') { booted.current = true; send() }
      else if (d.type === 'fsg:ready') setState('ready')
      else if (d.type === 'fsg:error') setState('error')
    }
    window.addEventListener('message', onMsg)
    const timer = setTimeout(() => setState((s) => (s === 'loading' ? 'error' : s)), 240000)
    return () => { alive = false; window.removeEventListener('message', onMsg); clearTimeout(timer) }
  }, [attempt, appId])

  const retry = () => { booted.current = false; setAttempt((a) => a + 1) }

  return (
    <div className="fsg-root">
      <style>{CSS}</style>
      <iframe
        key={attempt}
        ref={frame}
        className={'fsg-frame' + (state === 'ready' ? ' fsg-on' : '')}
        title="The Four Seasons Gallery"
        srcDoc={BOOT}
        sandbox="allow-scripts allow-pointer-lock"
        allow="fullscreen *; gamepad *; autoplay *"
      />
      <div className={'fsg-cover' + (state === 'ready' ? ' fsg-gone' : '')} aria-hidden={state === 'ready'}>
        <div>
          <div className="fsg-kicker">Antonio Vivaldi · Le quattro stagioni</div>
          <div className="fsg-title">The Four Seasons Gallery</div>
          <div className="fsg-seasons">{SEASONS.map(([n, c]) => <span key={n} style={{ color: c }}>{n}</span>)}</div>
          {state !== 'error' ? (
            <>
              <div className="fsg-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                <div className="fsg-fill" style={{ width: `${Math.max(4, pct)}%` }} />
              </div>
              <div className="fsg-note">{pct < 100 ? `Opening the gallery… ${pct}%` : 'Lighting the lamps…'}</div>
            </>
          ) : (
            <>
              <div className="fsg-note" style={{ marginTop: 24 }}>The gallery could not open. Check your connection and try again.</div>
              <button className="fsg-retry" onClick={retry}>Try again</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
