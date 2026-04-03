const IDLE_SRC = '/assets/idle.mp4';
const clips = [
  { src: '/assets/coding.mp4',        mood: 'CODING',      weight: 30 },
  { src: '/assets/inspecting.mp4',    mood: 'INSPECTING',  weight: 30 },
  { src: '/assets/aha.mp4',           mood: 'AHA!',        weight: 12 },
  { src: '/assets/sleepy.mp4',        mood: 'SLEEPY',      weight: 12 },
  { src: '/assets/coffee.mp4',        mood: 'COFFEE',      weight: 12 },
  { src: '/assets/ecstatic.mp4',       mood: 'ECSTATIC',    weight: 10 },
  { src: '/assets/matrix-glitch.mp4', mood: 'GLITCH',      weight: 4  },
  { src: '/assets/monitor-logo.mp4',  mood: 'LOGO',        weight: 4  },
];

const codeSnippets = {
  IDLE: `<span class="ln">1</span><span class="cm">// waiting...</span>
<span class="ln">2</span>
<span class="ln">3</span><span class="kw">const</span> <span class="fn">mood</span> <span class="op">=</span> <span class="st">'idle'</span><span class="op">;</span>
<span class="ln">4</span><span class="fn">stare</span><span class="op">(</span><span class="st">'screen'</span><span class="op">);</span><span class="cursor-blink"></span>`,

  CODING: `<span class="ln">1</span><span class="kw">class</span> <span class="tp">VoxelEngine</span> <span class="op">{</span>
<span class="ln">2</span>  <span class="fn">render</span><span class="op">(</span><span class="fn">frame</span><span class="op">) {</span>
<span class="ln">3</span>    <span class="kw">for</span> <span class="op">(</span><span class="kw">const</span> <span class="fn">v</span> <span class="kw">of</span> <span class="kw">this</span><span class="op">.</span><span class="fn">voxels</span><span class="op">)</span>
<span class="ln">4</span>      <span class="fn">v</span><span class="op">.</span><span class="fn">shade</span><span class="op">(</span><span class="kw">this</span><span class="op">.</span><span class="fn">sun</span><span class="op">);</span>
<span class="ln">5</span>  <span class="op">}</span>
<span class="ln">6</span><span class="op">}</span><span class="cursor-blink"></span>`,

  INSPECTING: `<span class="ln">1</span><span class="cm">// something's off...</span>
<span class="ln">2</span><span class="kw">const</span> <span class="fn">bugs</span> <span class="op">=</span> <span class="fn">scan</span><span class="op">(</span><span class="fn">grid</span><span class="op">);</span>
<span class="ln">3</span><span class="fn">console</span><span class="op">.</span><span class="fn">log</span><span class="op">(</span><span class="st">\`\${bugs.length} issues\`</span><span class="op">);</span>
<span class="ln">4</span><span class="fn">bugs</span><span class="op">.</span><span class="fn">forEach</span><span class="op">(</span><span class="fn">b</span> <span class="op">=></span> <span class="fn">b</span><span class="op">.</span><span class="fn">fix</span><span class="op">());</span><span class="cursor-blink"></span>`,

  'AHA!': `<span class="ln">1</span><span class="cm">// FOUND IT!</span>
<span class="ln">2</span><span class="cm">// was: x * stride</span>
<span class="ln">3</span><span class="fn">offset</span> <span class="op">=</span> <span class="op">(</span><span class="fn">x</span> <span class="op">+</span> <span class="fn">y</span><span class="op">*</span><span class="fn">w</span><span class="op">)</span> <span class="op">*</span> <span class="fn">stride</span><span class="op">;</span>
<span class="ln">4</span><span class="cm">// 3h for one multiply</span><span class="cursor-blink"></span>`,

  SLEEPY: `<span class="ln">1</span><span class="cm">// zzz...</span>
<span class="ln">2</span><span class="kw">await</span> <span class="fn">sleep</span><span class="op">(</span><span class="nr">28800000</span><span class="op">);</span>
<span class="ln">3</span><span class="cm">// 8 hours ought</span>
<span class="ln">4</span><span class="cm">// to do it...</span><span class="cursor-blink"></span>`,

  COFFEE: `<span class="ln">1</span><span class="kw">const</span> <span class="fn">cups</span> <span class="op">=</span> <span class="nr">4</span><span class="op">;</span>
<span class="ln">2</span><span class="kw">const</span> <span class="fn">limit</span> <span class="op">=</span> <span class="nr">3</span><span class="op">;</span> <span class="cm">// oops</span>
<span class="ln">3</span><span class="kw">if</span> <span class="op">(</span><span class="fn">cups</span> <span class="op">></span> <span class="fn">limit</span><span class="op">)</span>
<span class="ln">4</span>  <span class="fn">warn</span><span class="op">(</span><span class="st">'send help'</span><span class="op">);</span><span class="cursor-blink"></span>`,

  ECSTATIC: `<span class="ln">1</span><span class="cm">// YES YES YES</span>
<span class="ln">2</span><span class="fn">ship</span><span class="op">(</span><span class="st">'NOW'</span><span class="op">);</span>
<span class="ln">3</span><span class="fn">celebrate</span><span class="op">();</span>
<span class="ln">4</span><span class="cm">// it actually works!</span><span class="cursor-blink"></span>`,

  GLITCH: `<span class="ln">1</span><span class="cm">// R̸̨E̵A̶L̸I̶T̵Y̷ ̶E̸R̵R̶O̸R̵</span>
<span class="ln">2</span><span class="fn">matrix</span><span class="op">.</span><span class="fn">stability</span> <span class="op">=</span> <span class="nr">0.02</span><span class="op">;</span>
<span class="ln">3</span><span class="cm">// SEGFAULT 0xDEAD</span>
<span class="ln">4</span><span class="fn">reality</span><span class="op">.</span><span class="fn">reboot</span><span class="op">();</span><span class="cursor-blink"></span>`,

  LOGO: `<span class="ln">1</span><span class="cm">// broadcast signal</span>
<span class="ln">2</span><span class="kw">const</span> <span class="fn">logo</span> <span class="op">=</span> <span class="fn">render</span><span class="op">(</span><span class="st">'███'</span><span class="op">);</span>
<span class="ln">3</span><span class="fn">monitor</span><span class="op">.</span><span class="fn">display</span><span class="op">(</span><span class="fn">logo</span><span class="op">);</span>
<span class="ln">4</span><span class="cm">// standby...</span><span class="cursor-blink"></span>`,
};

const totalWeight = clips.reduce((s, c) => s + c.weight, 0);

let player, codeEl, btnDebug;
let idleTimer = null;
let isIdle = true;
let allLoaded = false;
const blobUrls = {};
let loadCount = 0;

function weightedRandom() {
  let r = Math.random() * totalWeight;
  for (const c of clips) { r -= c.weight; if (r <= 0) return c; }
  return clips[0];
}

function setCode(mood) {
  if (!codeEl) return;
  codeEl.innerHTML = codeSnippets[mood] || codeSnippets['IDLE'];
}

function preloadClips() {
  const allSrcs = [IDLE_SRC, ...clips.map(c => c.src)];
  allSrcs.forEach(src => {
    fetch(src)
      .then(r => r.blob())
      .then(blob => {
        blobUrls[src] = URL.createObjectURL(blob);
        loadCount++;
        if (loadCount >= allSrcs.length) {
          allLoaded = true;
          player.src = blobUrls[IDLE_SRC];
          player.loop = true;
          player.play();
          scheduleRandom();
        }
      })
      .catch(err => console.warn('[player] preload failed:', src, err));
  });
}

function playIdle() {
  isIdle = true;
  player.src = blobUrls[IDLE_SRC] || IDLE_SRC;
  player.loop = true;
  player.play();
  setCode('IDLE');
  if (allLoaded) scheduleRandom();
}

function playClip(clip) {
  if (!allLoaded) return;
  clearTimeout(idleTimer);
  isIdle = false;
  player.loop = false;
  player.src = blobUrls[clip.src] || clip.src;
  player.play();
  setCode(clip.mood);
}

function scheduleRandom() {
  clearTimeout(idleTimer);
  const delay = (2 + Math.floor(Math.random() * 4)) * 5000;
  idleTimer = setTimeout(() => playClip(weightedRandom()), delay);
}

export function playMood(mood) {
  const clip = clips.find(c => c.mood.toLowerCase() === mood.toLowerCase());
  if (clip) playClip(clip);
}

export function playRandom() {
  clearTimeout(idleTimer);
  playClip(weightedRandom());
}

export function initPlayer() {
  player = document.getElementById('player');
  codeEl = document.getElementById('codeContent');
  btnDebug = document.getElementById('btnDebug');

  player.addEventListener('ended', () => { if (!isIdle) playIdle(); });
  btnDebug.addEventListener('click', () => playRandom());

  player.src = IDLE_SRC;
  player.loop = true;
  player.muted = true;
  setCode('IDLE');
  isIdle = true;
  player.addEventListener('canplaythrough', () => {
    player.play();
    preloadClips();
  }, { once: true });
  player.load();
}
