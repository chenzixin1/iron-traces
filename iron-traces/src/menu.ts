import { isUnlocked, CAMPAIGN_IDS } from "./campaign-progress";
import { MenuMusic } from "./menu-music";
import { MenuHeroVideo } from "./hero-video";
/** Fullscreen archive cover; only shipped missions can enter gameplay. */
export function createMenu(enter: (index:number) => void, completed: () => readonly string[], soundEnabled: () => boolean, toggleSound: () => void) {
  const names = ['诺曼底 · 树篱之间','法莱斯 · 合围之路','市场花园 · 公路突进','亚琛 · 钢铁入城','阿登 · 打通走廊','雷马根 · 莱茵桥头'];
  const root = document.createElement('section');
  root.id = 'campaignMenu'; root.setAttribute('aria-label','铁迹 · 战役选择');
  root.innerHTML = `<div class="campaign-stage"><img class="campaign-art" src="./images/campaign-menu-no-progress.png" alt="铁迹：诺曼底坦克封面与六场战役"><video class="campaign-hero-video" autoplay muted playsinline preload="none" disablepictureinpicture disableremoteplayback aria-hidden="true" tabindex="-1"></video>${names.map((n,i)=>`<button class="campaign-card" data-index="${i}" style="--card-left:${3+i*15.88}%" aria-label="第${i+1}关 ${n}"><span class="card-art" style="background-position:${(3+i*15.88)/.85}% ${50.5/.66}%"></span><span class="card-status"></span></button>`).join('')}<button class="campaign-mute" aria-label="静音" title="静音"></button><span class="music-start-hint" hidden>任意点击画面，开始配乐</span><p class="campaign-feedback" role="status" aria-live="polite"></p></div>`;
  document.body.append(root);
  const heroVideo = new MenuHeroVideo(root.querySelector<HTMLVideoElement>('.campaign-hero-video')!);
  const music = new MenuMusic();
  const musicHint=root.querySelector<HTMLElement>('.music-start-hint')!;
  const syncMusic = () => {
    if (!root.hidden && !document.hidden && soundEnabled()) {
      void music.play().then(()=>{musicHint.hidden=true;}).catch(()=>{musicHint.hidden=root.hidden || !soundEnabled();});
    } else { music.stop(); musicHint.hidden=true; }
  };
  Object.assign(window, { __menuMusic: () => music.inspect() });
  root.addEventListener('pointerdown', e=>{if(!(e.target as Element).closest('.campaign-mute'))syncMusic();});
  root.addEventListener('keydown', syncMusic);
  // Click is the activation event on touch browsers; pointerdown alone is insufficient.
  root.addEventListener('click', syncMusic);
  window.addEventListener('pageshow', syncMusic);
  window.addEventListener('focus', syncMusic);
  let ctx: AudioContext | undefined, lastHover = 0, messageTimer: ReturnType<typeof setTimeout>;
  function tone(kind: 'hover'|'click'|'locked') {
    if (!soundEnabled()) return;
    try {
      ctx ??= new AudioContext(); void ctx.resume();
      const t = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = kind === 'locked' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(kind==='hover'?640:kind==='click'?880:170,t);
      osc.frequency.exponentialRampToValueAtTime(kind==='locked'?90:400,t+.09);
      gain.gain.setValueAtTime(.0001,t); gain.gain.exponentialRampToValueAtTime(kind==='hover'?.025:.075,t+.006);
      gain.gain.exponentialRampToValueAtTime(.0001,t+.12);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(t); osc.stop(t+.13);
      osc.onended=()=>{osc.disconnect();gain.disconnect();};
    } catch { /* Audio is optional on unsupported browsers. */ }
  }
  const feedback = root.querySelector<HTMLElement>('.campaign-feedback')!;
  const mute = root.querySelector<HTMLButtonElement>('.campaign-mute')!;
  function update() {
    root.querySelectorAll<HTMLButtonElement>('.campaign-card').forEach((b,i)=>{
      const status=completed().includes(CAMPAIGN_IDS[i])?'已完成 · 重玩':isUnlocked(i,completed())?'可开始':'待解锁';
      b.classList.toggle('unlocked',isUnlocked(i,completed()));
      b.querySelector('.card-status')!.textContent=status;
      b.setAttribute('aria-label',`${names[i]}，${status}`);
      b.setAttribute('aria-disabled',String(!isUnlocked(i,completed())));
    });
    mute.innerHTML=`<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/>${soundEnabled()?'<path d="M16 8q5 4 0 8"/>':'<path d="m16 9 5 6m0-6-5 6"/>'}</svg>`;
    mute.setAttribute('aria-label',soundEnabled()?'静音':'开启声音');
    mute.title=soundEnabled()?'静音':'开启声音';
    mute.setAttribute('aria-pressed',String(!soundEnabled()));
  }
  root.querySelectorAll<HTMLButtonElement>('.campaign-card').forEach((b,i)=>{
    const hover=()=>{if(performance.now()-lastHover>90){tone('hover');lastHover=performance.now();}};
    b.onpointerenter=hover; b.onfocus=hover;
    b.onclick=()=>{
      if(isUnlocked(i,completed())){tone('click');root.hidden=true;heroVideo.hide();music.stop();document.body.classList.remove('at-campaign');enter(i);return;}
      tone('locked'); b.classList.remove('denied'); void b.offsetWidth; b.classList.add('denied');
      feedback.textContent=`完成「${names[i-1]}」后解锁本关。`;
      clearTimeout(messageTimer);messageTimer=setTimeout(()=>feedback.textContent='',4200);
    };
    b.onanimationend=()=>b.classList.remove('denied');
  });
  mute.onclick=()=>{if(!musicHint.hidden && soundEnabled()){syncMusic();return;}toggleSound();update();syncMusic();if(soundEnabled())tone('click');};
  // Shared interface click sound, never fired by combat mouse input.
  document.addEventListener('click',e=>{if((e.target as Element).closest('button')&&!root.contains(e.target as Node))tone('click');});
  function show(){update();root.hidden=false;heroVideo.show();syncMusic();document.body.classList.add('at-campaign');feedback.textContent='';root.querySelector<HTMLButtonElement>('.campaign-card')!.focus({preventScroll:true});}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void ctx?.suspend();syncMusic();});
  return {show};
}
