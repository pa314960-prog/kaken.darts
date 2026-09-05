'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, MousePointer2, RotateCcw, Crosshair, Volume2, VolumeX } from 'lucide-react';
import { scoreAt, Gesture, SECTORS } from '../lib/darts';
type Point = { x: number; y: number };
type Hit = Point & { score: number; label: string };
type Detector = { detectForVideo: (v: HTMLVideoElement, t: number) => { landmarks: Point[][] }; close: () => void };

export default function Home() {
  const canvas = useRef<HTMLCanvasElement>(null), video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null), detector = useRef<Detector | null>(null);
  const gesture = useRef(new Gesture()), aim = useRef<Point | null>(null), held = useRef(false);
  const hitsRef = useRef<Hit[]>([]), cooldown = useRef(0), enabled = useRef(false), generation = useRef(0);
  const soundRef = useRef(true), audio = useRef<AudioContext | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [cameraState, setCameraState] = useState<'off' | 'loading' | 'on'>('off');
  const [status, setStatus] = useState('カメラを開始、または盤をクリックしてプレイ');
  const [sound, setSound] = useState(true), [result, setResult] = useState('狙いを定めよう');
  const total = hits.reduce((sum, h) => sum + h.score, 0), finished = hits.length === 24;
  const round = Math.min(8, Math.floor(hits.length / 3) + 1);
  const current = hits.slice(finished ? 21 : Math.floor(hits.length / 3) * 3);
  function unlockAudio() {
    try { audio.current ??= new AudioContext(); void audio.current.resume().catch(() => {}); } catch { /* Sound is optional. */ }
  }
  function throwDart(point: Point) {
    const now = performance.now();
    if (now < cooldown.current || hitsRef.current.length >= 24) return;
    cooldown.current = now + 850;
    const scored = scoreAt(point.x, point.y), next = [...hitsRef.current, { ...point, ...scored }];
    hitsRef.current = next; setHits(next);
    setResult(scored.label === 'MISS' ? 'MISS — 次を狙おう' : `${scored.label}  +${scored.score}`);
    if (soundRef.current && audio.current?.state === 'running') {
      const ctx = audio.current, osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(scored.score >= 25 ? 880 : 440, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start(); osc.stop(ctx.currentTime + 0.2);
    }
  }
  function stopCamera() {
    generation.current++; enabled.current = false;
    stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    detector.current?.close(); detector.current = null;
    gesture.current.reset(); aim.current = null; held.current = false;
    setCameraState('off'); setStatus('盤をクリック／タップして投げる');
  }
  async function startCamera() {
    unlockAudio();
    const request = ++generation.current;
    setCameraState('loading'); setStatus('カメラと手の認識を準備中…');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires HTTPS or localhost');
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false });
      if (request !== generation.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      media.getVideoTracks()[0].addEventListener('ended', () => { if (request === generation.current) { stopCamera(); setStatus('カメラ接続が切れました。もう一度開始してください。'); } });
      if (!video.current) { stopCamera(); return; }
      video.current.srcObject = media; await video.current.play();
      const url = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs';
      const { FilesetResolver, HandLandmarker } = await import(/* @vite-ignore */ url);
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
      const hand = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' },
        runningMode: 'VIDEO', numHands: 1, minHandDetectionConfidence: 0.65, minTrackingConfidence: 0.65,
      });
      if (request !== generation.current) { hand.close(); return; }
      detector.current = hand; enabled.current = true; gesture.current.reset(); aim.current = null;
      setCameraState('on'); setStatus('片手をカメラに映してください');
    } catch (error) {
      if (request !== generation.current) return;
      stopCamera();
      const name = error instanceof Error ? error.name : '';
      setStatus(name === 'NotAllowedError' ? 'カメラが許可されていません。ブラウザの設定で許可して再試行してください。' : name === 'NotFoundError' ? 'カメラが見つかりません。接続を確認してください。' : 'カメラを開始できませんでした。接続・通信を確認して再試行してください。マウスでも遊べます。');
    }
  }
  function reset() {
    hitsRef.current = []; setHits([]); cooldown.current = performance.now() + 500;
    gesture.current.reset(); held.current = false; setResult('狙いを定めよう');
  }
  useEffect(() => {
    let frame = 0, lastVideo = -1, lastDetect = 0;
    function draw(now: number) {
      if (enabled.current && detector.current && video.current && video.current.readyState >= 2 && video.current.currentTime !== lastVideo && now - lastDetect > 40) {
        lastVideo = video.current.currentTime; lastDetect = now;
        try {
          const hand = detector.current.detectForVideo(video.current, now).landmarks[0];
          if (hand) {
            const raw = { x: Math.max(-1.2, Math.min(1.2, (0.5 - hand[8].x) * 3.1)), y: Math.max(-1.2, Math.min(1.2, (hand[8].y - 0.5) * 3.1)) };
            const previous = aim.current;
            const next = previous ? { x: previous.x * 0.6 + raw.x * 0.4, y: previous.y * 0.6 + raw.y * 0.4 } : raw;
            // Use the last held aim to avoid release movement shifting the throw.
            const palm = Math.hypot(hand[0].x - hand[9].x, hand[0].y - hand[9].y);
            const ratio = Math.hypot(hand[4].x - hand[8].x, hand[4].y - hand[8].y) / Math.max(palm, 0.01);
            if (gesture.current.update(ratio, now) && previous) throwDart(previous);
            aim.current = next; held.current = gesture.current.armed;
            setStatus(held.current ? 'つまんでいます · 指を離して投げる' : '人差し指で狙う → つまむ → 離す');
          } else {
            gesture.current.reset(); aim.current = null; held.current = false;
            setStatus('手が見つかりません · 明るい場所で片手全体を映してください');
          }
        } catch { stopCamera(); setStatus('手の認識が停止しました。カメラを再開してください。'); }
      }
      const ctx = canvas.current?.getContext('2d');
      if (ctx) renderBoard(ctx, aim.current, held.current, hitsRef.current, now < cooldown.current);
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    const visibility = () => { gesture.current.reset(); held.current = false; aim.current = null; };
    document.addEventListener('visibilitychange', visibility);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibility); generation.current++; enabled.current = false; stream.current?.getTracks().forEach(t => t.stop()); detector.current?.close(); void audio.current?.close(); };
  }, []);
  function pointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width * 720 - 360) / 270, y: ((e.clientY - rect.top) / rect.height * 720 - 360) / 270 };
  }
  return <main>
    <header><a className="brand" href="/" aria-label="AIR DARTS ホーム"><Crosshair size={30}/><span>AIR<span className="brand-light">DARTS</span><small>HAND TRACKING GAME</small></span></a><span className="edition">PA / カメラでダーツ</span><button className="icon-button" aria-label={sound ? '音をオフ' : '音をオン'} onClick={() => { unlockAudio(); soundRef.current = !sound; setSound(!sound); }}>{sound ? <Volume2/> : <VolumeX/>}</button></header>
    <div className="game-layout">
      <section className="arena" aria-label="ダーツのプレイエリア">
        <div className="arena-top"><span className="live-dot"/>COUNT UP <span className="round-label">ROUND <b>{round.toString().padStart(2, '0')}</b> / 08</span></div>
        <div className="board-wrap"><canvas width="720" height="720" ref={canvas} tabIndex={0} aria-label="ダーツ盤。クリックで投球。キーボードは矢印で狙ってスペースで投げます。" onPointerMove={e => { if (!enabled.current) aim.current = pointer(e); }} onPointerLeave={() => { if (!enabled.current) aim.current = null; }} onPointerDown={e => { if (enabled.current) return; unlockAudio(); aim.current = pointer(e); throwDart(aim.current); }} onKeyDown={e => {
          if (enabled.current || !['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) return;
          e.preventDefault(); const p = aim.current ?? { x: 0, y: 0 };
          if (e.key === ' ') { unlockAudio(); throwDart(p); } else aim.current = { x: Math.max(-1.2, Math.min(1.2, p.x + (e.key === 'ArrowRight' ? .035 : e.key === 'ArrowLeft' ? -.035 : 0))), y: Math.max(-1.2, Math.min(1.2, p.y + (e.key === 'ArrowDown' ? .035 : e.key === 'ArrowUp' ? -.035 : 0))) };
        }}/>
          {finished && <div className="finish"><span>GAME FINISHED</span><h2>ナイススロー！</h2><strong>{total}<small> POINTS</small></strong><button className="primary" onClick={reset}><RotateCcw size={18}/>もう一度遊ぶ</button></div>}
        </div>
        <div className="throw-result" role="status" aria-live="polite" key={hits.length}>{result}</div>
        <div className="legend"><span><i className="green"/>外側の細い帯 ×2</span><span><i className="red"/>内側の細い帯 ×3</span><span>中心 50 / 外ブル 25</span></div>
      </section>
      <aside>
        <section className="score-panel"><div className="eyebrow">TOTAL SCORE</div><div className="total">{total.toString().padStart(3, '0')}<span>PT</span></div><div className="darts">{[0,1,2].map(i => <div key={i} className={current[i] ? 'used' : ''}><small>DART {i + 1}</small><b>{current[i]?.score ?? '—'}</b></div>)}</div><div className="progress">{Array.from({length:8}, (_,i) => <span key={i} className={hits.length >= (i+1)*3 ? 'complete' : i === round-1 ? 'active' : ''}/>)}</div><div className="score-footer"><span>3投 × 8ラウンド</span><button onClick={reset}><RotateCcw size={14}/>やり直す</button></div></section>
        <section className="camera-panel"><div className="panel-heading"><h2><Camera size={18}/>カメラ</h2><span className={cameraState === 'on' ? 'connected' : ''}>{cameraState === 'on' ? '接続中' : cameraState === 'loading' ? '準備中' : '未接続'}</span></div><div className="camera-view"><video ref={video} muted playsInline autoPlay className={cameraState === 'off' ? 'hidden' : ''}/>{cameraState === 'off' && <div className="camera-placeholder"><Crosshair size={34}/><span>ここに手を映そう</span></div>}<span className="view-corner top"/><span className="view-corner bottom"/></div><p className="camera-status" role="status">{status}</p><button className="primary" disabled={cameraState === 'loading'} onClick={cameraState === 'on' ? stopCamera : startCamera}><Camera size={18}/>{cameraState === 'on' ? 'カメラを停止' : cameraState === 'loading' ? '準備しています…' : 'カメラで遊ぶ'}</button>{cameraState === 'loading' && <button className="cancel" onClick={stopCamera}>キャンセル</button>}<p className="privacy">映像はこの端末内だけで処理されます。</p></section>
        <section className="howto"><h2>投げ方</h2><ol><li><span>01</span><div><b>人差し指で狙う</b><p>手を動かして照準を合わせます。</p></div></li><li><span>02</span><div><b>つまんで、離す</b><p>親指と人差し指を少しの間つまみ、離すと投げます。</p></div></li></ol><div className="mouse-note"><MousePointer2 size={17}/><span>{cameraState !== 'on' ? 'マウス・タッチでも遊べます' : 'マウスで遊ぶときはカメラを停止'}</span></div></section>
      </aside>
    </div>
    <footer><span>AIR DARTS</span><span>道具いらず。指先で、ブルを狙おう。</span></footer>
  </main>;
}
function renderBoard(ctx: CanvasRenderingContext2D, aim: Point | null, held: boolean, hits: Hit[], cooling: boolean) {
  ctx.clearRect(0, 0, 720, 720); ctx.save(); ctx.translate(360,360);
  ctx.shadowColor = '#000'; ctx.shadowBlur = 35; ctx.fillStyle = '#080e12'; ctx.beginPath(); ctx.arc(0,0,325,0,Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = '#314047'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0,0,324,0,Math.PI*2); ctx.stroke();
  const rings = [[0.0935,0.582], [0.582,0.629], [0.629,0.953], [0.953,1]];
  for (let i=0; i<20; i++) {
    const start = -Math.PI/2 - Math.PI/20 + i*Math.PI/10, end = start + Math.PI/10;
    rings.forEach(([inner,outer], r) => { ctx.beginPath(); ctx.arc(0,0,270*outer,start,end); ctx.arc(0,0,270*inner,end,start,true); ctx.closePath(); ctx.fillStyle = r%2 ? (i%2 ? '#248c7d' : '#cf514c') : (i%2 ? '#e6dfc6' : '#19252a'); ctx.fill(); ctx.strokeStyle = '#58625f'; ctx.lineWidth = .8; ctx.stroke(); });
    const angle = -Math.PI/2 + i*Math.PI/10; ctx.fillStyle = '#e4e9e7'; ctx.font = '500 24px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(SECTORS[i]),Math.cos(angle)*299,Math.sin(angle)*299);
  }
  for (const [r,color] of [[.0935,'#248c7d'],[.0374,'#cf514c']] as const) { ctx.beginPath(); ctx.arc(0,0,270*r,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); ctx.stroke(); }
  hits.slice(hits.length ? Math.floor((hits.length-1)/3)*3 : 0).forEach((h,i) => { const x=h.x*270,y=h.y*270; ctx.strokeStyle='#f2bd67';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+16,y-26);ctx.stroke();ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.fillStyle='#f2bd67';ctx.font='bold 14px Arial';ctx.fillText(String(i+1),x+24,y-31); });
  if (aim && hits.length<24) drawAimDart(ctx, aim.x*270, aim.y*270, held ? '#ffcc78' : cooling ? '#8a999e' : '#8aebd6');
  ctx.restore();
}

/** The needle tip stays exactly on the scoring coordinate. */
function drawAimDart(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  // Point down-left, with the flight above/right of the intended hit.
  ctx.rotate(Math.PI / 5);
  ctx.shadowColor = '#000b'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#eef6fa';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-2, -18); ctx.lineTo(2, -18); ctx.closePath(); ctx.fill();
  const metal = ctx.createLinearGradient(-4, 0, 4, 0);
  metal.addColorStop(0, '#6a8592'); metal.addColorStop(.45, '#f0f7fb'); metal.addColorStop(1, '#829ca8');
  ctx.fillStyle = metal; ctx.beginPath(); ctx.roundRect(-4, -39, 8, 23, 3); ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = '#516975'; ctx.lineWidth = 1;
  for (let groove = -20; groove >= -35; groove -= 4) { ctx.beginPath(); ctx.moveTo(-3, groove); ctx.lineTo(3, groove); ctx.stroke(); }
  ctx.fillStyle = '#d1dfe6'; ctx.fillRect(-1.5, -58, 3, 20);
  ctx.fillStyle = color; ctx.strokeStyle = '#e6fff5'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -45); ctx.lineTo(-13, -55); ctx.lineTo(-10, -72); ctx.lineTo(0, -64); ctx.lineTo(10, -72); ctx.lineTo(13, -55); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#183c47'; ctx.beginPath(); ctx.moveTo(0, -45); ctx.lineTo(0, -64); ctx.stroke();
  ctx.restore();
}
