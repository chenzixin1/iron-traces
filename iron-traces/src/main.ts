import { LEVELS } from "./campaigns";
import { readProgress, recordWin, isUnlocked, previewAll } from "./campaign-progress";
import { createMenu } from "./menu";
import { historyMarkup } from "./briefings";
import { VIEW_LABELS, nextView, showEnemyPositions, interiorAim } from "./view";
import "./style.css";
import * as T from "three";
import {
  Simulation,
  activateLevel,
  WATER,
  BRIDGES,
  SIZE,
  ROAD_Z,
  ROAD_X,
  STEP,
  FORESTS,
  BUILDINGS,
  SWAMP,
  SUPPLY,
  SPAWN,
  OBJECTIVE,
  distance,
  terrainFactor,
  type Ammo,
  type Input,
} from "./simulation";
import { World } from "./world";
import { BattleAudio } from "./audio";
const $ = <E extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as E;
const app = $("app");
app.innerHTML = `
<canvas id="scene" aria-label="三维坦克战场"></canvas><div id="vignette"></div>
<header class="topbar"><div class="brand"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M6 20h20v7H6zM10 12h12v8H10zM15 3h2v12h-2" stroke="currentColor" stroke-width="1.5"/><path d="M3 18v11m26-11v11" stroke="currentColor" stroke-width="2"/></svg>铁迹<small>IRON TRACES</small></div><div class="top-center"><i class="live-dot"></i><span id="topLabel">法国 · 诺曼底 / 1944</span></div><div class="toolbar"><span id="fps" class="fps"></span><button class="tool" id="quality">画质：标准</button><button class="tool" id="sound" aria-pressed="true">声音：开</button><button class="tool" id="pauseBtn" hidden>暂停 <small>ESC</small></button></div></header>
<section id="briefing" class="screen dossier-screen" aria-label="作战简报">
<div class="dossier"><header class="dossier-heading"><span class="dossier-kicker">FIELD DOSSIER / N01</span><h1>作战简报</h1><p>诺曼底 · 树篱之间</p><span class="dossier-stamp">1944 / FRANCE</span></header>
<div class="dossier-grid"><section class="map-paper"><header><h2>本局示意地图</h2><span>N ↑</span></header><canvas id="briefMap" width="700" height="700" aria-label="游戏地图：从南侧集结区前往北侧路口"></canvas><p>红线：建议推进方向　★ 目标　＋ 补给<br>游戏局部地形 · ${SIZE} × ${SIZE} 米 · 非历史测绘图</p></section>
<section class="orders-paper"><div class="brief-photo"><img src="./images/cover-painted-v2.webp" alt="生成插画：诺曼底乡道上的谢尔曼坦克与装甲纵队"><span>场景插画 · 非历史照片</span></div><nav class="tabs" aria-label="战前准备"><button id="briefTab" class="tab active">任务资料</button><button id="refitTab" class="tab">查看装备 <span id="upgradeDot"></span></button></nav>
<div id="briefPane"><dl class="orders-list"><div><dt>行动时间</dt><dd>1944 年 7 月下旬</dd></div><div><dt>所属部队</dt><dd>美军第 2 装甲师 · 虚构车组 07</dd></div><div><dt>本局坦克</dt><dd>M4 Sherman · 75 毫米主炮</dd></div><div><dt>战局背景</dt><dd>诺曼底突破阶段，部队需要穿越村庄外围、保持道路畅通。</dd></div><div><dt>本局任务</dt><dd>击毁 3 辆敌车；抵达北侧路口，停留 5 秒。</dd></div></dl></div>
<div id="refitPane" hidden><p class="refit-title">36 发弹药 · 14 发穿甲 / 22 发高爆</p><button class="upgrade chosen" data-upgrade="none"><strong>标准整备</strong><p>75 毫米主炮 · 装填 5.2 秒<br>高爆弹破墙，穿甲弹对付装甲目标。</p></button><button class="upgrade" data-upgrade="AP"><strong>穿甲装填优化 <span class="lock-label">· 完成首战解锁</span></strong><p>穿甲弹装填缩短至 4.8 秒。<br>保留原有口径与单发威力。</p></button><button class="upgrade" data-upgrade="HE"><strong>高爆装填优化 <span class="lock-label">· 完成首战解锁</span></strong><p>高爆弹装填缩短至 4.8 秒。<br>适合反复开路与破坏砖墙。</p></button><p class="refit-note">每次出发选择一项整备。首次胜利后可升级，进度保存在当前浏览器。</p></div></section></div>
<section class="history-paper">${historyMarkup()}</section>
<footer class="dossier-actions"><p>基于真实历史背景改编。<br>车组、局部地图与任务为独立创作。 <a href="./audio/CREDITS.md" target="_blank" rel="noopener">音频来源</a></p><button class="start" id="start">开始行动 <span>→</span></button></footer>
</div></section>
<section id="hud" class="hud" hidden aria-label="战斗仪表"><div class="mission-panel"><div class="eyebrow">N01 / 树篱突破</div><h2>打通北侧路口</h2><p id="objectiveText">击毁敌军坦克，再夺取路口。</p><div class="progress-line"><div id="captureBar"></div></div><span class="objective-status" id="enemyCount">敌军目标 0 / 3</span></div><div id="interiorPanel" hidden><div class="interior-ident"><span>GUNNER’S STATION / 07</span><strong>炮手观察位</strong><small>舱盖关闭 · 受限视野</small></div><div class="interior-graticule"><svg viewBox="0 0 200 100" aria-hidden="true"><path d="M0 50h82m36 0h82M100 27v15m0 16v42M25 44v12m25-16v20m25-16v12m50-12v12m25-16v20m25-16v12M94 73h12m-12 14h12"/><circle cx="100" cy="50" r="2"/></svg></div><div class="interior-instruments"><span>炮塔偏角 <b id="turretBearing">0°</b></span><span>车体航向 <b id="hullBearing">000°</b></span><span id="traverseState">炮塔停止</span></div><div class="interior-help">鼠标向两侧转炮塔 · 回中停转　 /　 R 炮塔回正　 /　 C 切换视角</div></div><div class="crosshair" id="crosshair"></div><div class="aim-marker" id="aimMarker"></div><div id="tankReload" class="tank-reload" hidden role="progressbar" aria-label="主炮装填进度" aria-valuemin="0" aria-valuemax="100"><span id="tankReloadText"></span><div class="tank-reload-track"><i id="tankReloadFill"></i></div></div><div class="toast" id="toast" role="status" aria-live="polite" hidden></div><div class="status-tip" id="statusTip" hidden></div><div class="minimap-wrap"><div class="map-title"><span>战术地图</span><span>N ↑</span></div><canvas id="minimap" width="360" height="360" aria-label="战术地图：敌军、树林、沼泽和目标"></canvas><div class="map-hint">M 展开地图</div></div><div class="control-strip"><span><kbd>W S</kbd> 前进 / 倒车</span><span><kbd>A D</kbd> 车体转向</span><span><kbd>鼠标</kbd> 瞄准 · 左键开火</span><span><kbd>C</kbd> 切换视角</span><span><kbd>E</kbd> 按住补给</span></div><div class="bottom-hud"><div class="vehicle-hud"><header><span>M4 SHERMAN</span><span>07</span></header><div class="health-row"><strong id="hp">100</strong><span>% 车体完好</span></div><div class="health-bar"><i id="hpBar"></i></div><div class="vehicle-details"><span id="speed">0 km/h</span><span id="terrain">普通地面</span></div></div><div class="weapons"><button class="ammo-button" id="ap" aria-label="选择穿甲弹，快捷键1"><span class="ammo-top">穿甲弹 <kbd>1</kbd></span><strong id="apCount">14</strong><small>AP · 装甲目标</small></button><button class="ammo-button selected" id="he" aria-label="选择高爆弹，快捷键2"><span class="ammo-top">高爆弹 <kbd>2</kbd></span><strong id="heCount">22</strong><small>HE · 破坏砖墙</small></button><div class="reload-box"><strong id="reload">READY</strong><span id="reloadLabel">主炮就绪</span></div><button class="tool" id="cameraBtn">俯视 <small>C</small></button></div></div><div class="damage" id="damage"></div></section>
<section id="pauseScreen" class="screen" hidden><div class="pause-shade"></div><div class="dialog"><div class="eyebrow">FIELD PAUSE</div><h2>战场已暂停</h2><p>穿甲弹对付坦克，高爆弹用于破墙。<br>密林无法通行；进入沼泽后速度会降低。<br>补给点位于出发地东侧，停车后按住 E。</p><button class="primary" id="resume">继续战斗</button><button id="headphoneTest">耳机测试 · 先左后右</button><button id="retryPause">重新开始本局</button><button id="backBrief">返回简报与整备</button><a class="audio-credits" href="./audio/CREDITS.md" target="_blank" rel="noopener">音频与录音署名</a></div></section>
<section id="resultScreen" class="screen" hidden><div class="pause-shade"></div><div class="dialog"><div class="eyebrow" id="resultEyebrow">MISSION COMPLETE</div><h2 id="resultTitle">路口已打通</h2><p id="resultCopy"></p><div class="result-stats"><div><strong id="resultKills">3</strong><small>击毁敌车</small></div><div><strong id="resultTime">00:00</strong><small>任务用时</small></div><div><strong id="resultAccuracy">0%</strong><small>装甲命中率</small></div></div><button class="primary" id="resultAction">返回整备 · 升级战车</button><button id="nextMission" hidden>下一场战役 →</button><button id="resultMenu">返回战役选择</button><button id="retryResult">重新挑战</button></div></section>
<section id="mapScreen" class="screen" hidden><div class="pause-shade"></div><div class="dialog large-map"><h2>北侧路口 · 战术地图</h2><canvas id="largeMap" width="700" height="700" aria-label="完整战术地图"></canvas><p id="mapLegend">▲ 本车　◆ 敌军　★ 目标　＋ 补给　▧ 密林不可通行　蓝灰：沼泽</p><button id="closeMap">返回战斗 · M / ESC</button></div></section>`;
let selectedLevel = 0;
let completedLevels = readProgress();
let wins = 0,
  chosen: Ammo | null = null;
try {
  wins = Math.max(0, Number(localStorage.getItem("iron-traces-wins")) || 0);
} catch {}
let sim = new Simulation(),
  world: World;
const audio = new BattleAudio();
const keys = new Set<string>();
let fireRequested = false;
let alignTurret = false;
let firing = false,
  mouse = { x: 0, y: 0 },
  last = performance.now(),
  acc = 0,
  toastUntil = 0,
  mapOpen = false,
  uiClock = 0,
  frames: number[] = [];
let wasPhase = sim.phase,
  awarded = false;
try {
  world = new World($<HTMLCanvasElement>("scene"));
  world.reset(sim);
  audio.reset();
} catch (error) {
  app.innerHTML = `<div class="error"><h1>战场暂时无法启动</h1><p>三维场景初始化未完成。请尝试重新加载；若提示 WebGL 错误，请检查浏览器图形加速。</p><pre></pre><button onclick="location.reload()">重新加载</button></div>`;
  document.querySelector("pre")!.textContent = String(error);
  throw error;
}
function notify(text: string, seconds = 3) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  toastUntil = performance.now() + seconds * 1000;
}
function clearInput() {
  keys.clear();
  firing = false;
  fireRequested = false;
  alignTurret = false;
  mouse.x = 0;
}
function showPhase() {
  const p = sim.phase;
  $("briefing").hidden = p !== "briefing";
  $("hud").hidden = p === "briefing";
  $("pauseScreen").hidden = p !== "paused" || mapOpen;
  $("mapScreen").hidden = !mapOpen;
  $("resultScreen").hidden = p !== "victory" && p !== "defeat";
  $("pauseBtn").hidden = p === "briefing" || p === "victory" || p === "defeat";
  document.body.className = p;
  world.cinematic = p === "briefing";
  updateViewUI();
  if (p === "victory" || p === "defeat") {
    const won = p === "victory";
    if (won && !awarded && !previewAll) {
      wins++;
      completedLevels = recordWin(sim.level.id, completedLevels);
      awarded = true;
      try {
        localStorage.setItem("iron-traces-wins", String(wins));
      } catch {}
    }
    $("resultEyebrow").textContent = won
      ? "MISSION COMPLETE"
      : "MISSION FAILED";
    $("resultTitle").textContent = won ? `${sim.level.title} · 任务完成` : "车组失去战力";
    $("nextMission").hidden = !won || selectedLevel >= LEVELS.length - 1;
    $("resultCopy").textContent = won
      ? "后续部队可以通过这条道路。装填优化已解锁，下次出发可在整备页选择升级。"
      : "可尝试利用砖墙遮挡敌军炮火，先用高爆开路，再换穿甲弹逐个消灭目标。";
    $("resultKills").textContent = String(sim.kills);
    $("resultTime").textContent = formatTime(sim.time);
    $("resultAccuracy").textContent =
      (sim.shots ? Math.round((sim.hits / sim.shots) * 100) : 0) + "%";
    $("resultAction").textContent = won
      ? "返回整备 · 升级战车"
      : "返回战役简报";
    clearInput();
  }
}
function newMission(start = false, levelIndex?: number) {
  if (levelIndex !== undefined) {
    selectedLevel = levelIndex;
    activateLevel(LEVELS[levelIndex].id);
  }
  clearInput();
  sim = new Simulation(chosen);
  if (levelIndex !== undefined) world.loadLevel(sim, sim.level.theme); else world.reset(sim);
  audio.reset();
  mapOpen = false;
  awarded = false;
  acc = 0;
  wasPhase = sim.phase;
  showPhase();
  if (start) begin();
  refreshRefit();
  refreshBriefing();
}
function begin() {
  sim.start();
  clearInput();
  mouse = { x: 0, y: 0 };
  $("crosshair").style.left = "50%";
  $("crosshair").style.top = "50%";
  acc = 0;
  last = performance.now();
  showPhase();
  void audio
    .start()
    .then(() => {
      if (audio.failed.length)
        notify("部分录音未载入，已使用备用声音。刷新可重试。");
    })
    .catch(() => notify("浏览器未能开启声音，可继续游戏或重新点击声音按钮。"));
  notify("W 前进 · 鼠标瞄准 · 左键开火。先用高爆弹打开砖墙。", 7);
}
function pause() {
  if (sim.phase === "playing") {
    sim.pause();
    clearInput();
    showPhase();
  }
}
function resume() {
  sim.resume();
  mapOpen = false;
  clearInput();
  acc = 0;
  last = performance.now();
  showPhase();
}
function updateViewUI() {
  const interior = world.mode === "interior" && sim.phase !== "briefing";
  document.body.classList.toggle("interior-view", interior);
  $("cameraBtn").innerHTML = VIEW_LABELS[world.mode] + " <small>C</small>";
  $("interiorPanel").hidden = !interior;
  $("mapLegend").textContent = interior
    ? "▲ 本车　★ 目标　＋ 补给　▧ 密林 · 车内不显示敌车位置"
    : "▲ 本车　◆ 敌军　★ 目标　＋ 补给　▧ 密林不可通行　蓝灰：沼泽";
  if (interior) {
    $("crosshair").style.left = "50%";
    $("crosshair").style.top = "50%";
  }
}
function toggleCamera() {
  if (sim.phase !== "playing") return;
  world.mode = nextView(world.mode);
  mouse.x = 0;
  mouse.y = 0;
  alignTurret = false;
  world.updateCamera(sim.player, 1, true);
  updateViewUI();
  notify(
    world.mode === "interior"
      ? "车内观察位 · 鼠标移向两侧转炮塔，回中停转 · R 回正"
      : `已切换${VIEW_LABELS[world.mode]}视角`,
    4,
  );
}
function toggleMap() {
  if (mapOpen) {
    resume();
    return;
  }
  if (sim.phase !== "playing") return;
  pause();
  mapOpen = true;
  showPhase();
  drawMap($<HTMLCanvasElement>("largeMap"));
}
function refit(open: boolean) {
  $("briefing").classList.toggle("show-refit", open);
  const photo = document.querySelector<HTMLImageElement>(".brief-photo img")!;
  photo.src = open
    ? "./images/refit-sherman.webp"
    : selectedLevel === 0 ? "./images/cover-painted-v2.webp" : `./images/briefing-${sim.level.id}.webp`;
  photo.alt = open
    ? "生成插画：野战维修棚中的谢尔曼坦克"
    : "生成插画：诺曼底乡道上的谢尔曼坦克与装甲纵队";
  $("briefPane").hidden = open;
  $("refitPane").hidden = !open;
  $("briefTab").classList.toggle("active", !open);
  $("refitTab").classList.toggle("active", open);
  $("refitTab").firstChild!.textContent = open ? "返回简报 " : "查看装备 ";
  refreshRefit();
}
function refreshRefit() {
  document
    .querySelectorAll<HTMLButtonElement>("[data-upgrade]")
    .forEach((b) => {
      const a = b.dataset.upgrade!;
      b.disabled = a !== "none" && wins === 0;
      b.classList.toggle("chosen", a === (chosen || "none"));
    });
  document
    .querySelectorAll(".lock-label")
    .forEach((e) => (e.textContent = wins ? "· 已解锁" : "· 完成首战解锁"));
  $("upgradeDot").textContent = wins ? "· 可升级" : "";
}
$("start").onclick = begin;
$("pauseBtn").onclick = () => (sim.phase === "playing" ? pause() : resume());
$("resume").onclick = resume;
$("retryPause").onclick = () => newMission(true);
$("backBrief").onclick = () => newMission();
$("retryResult").onclick = () => newMission(true);
$("resultAction").onclick = () => {
  const won = sim.phase === "victory";
  newMission();
  refit(won);
};
$("cameraBtn").onclick = toggleCamera;
$("closeMap").onclick = toggleMap;
let reader = $("historyReader");
let readingTimer: ReturnType<typeof setInterval> | undefined;
function stopReading() {
  clearInterval(readingTimer);
  readingTimer = undefined;
  $("autoRead").textContent = "自动滚动";
  $("autoRead").setAttribute("aria-pressed", "false");
}
function bindHistory() {
reader = $("historyReader");
reader.addEventListener("scroll", () => {
  const total = reader.scrollHeight - reader.clientHeight;
  $("readProgress").textContent =
    Math.round(total > 0 ? (reader.scrollTop / total) * 100 : 100) + "%";
  if (reader.scrollTop >= total - 1) stopReading();
});
for (const event of ["wheel", "touchstart", "pointerdown", "keydown"])
  reader.addEventListener(event, stopReading, { passive: true });
$("autoRead").onclick = () => {
  if (readingTimer) {
    stopReading();
    return;
  }
  if (reader.scrollTop >= reader.scrollHeight - reader.clientHeight - 1)
    reader.scrollTop = 0;
  $("autoRead").textContent = "暂停滚动";
  $("autoRead").setAttribute("aria-pressed", "true");
  readingTimer = setInterval(() => {
    if (sim.phase !== "briefing" || document.hidden) {
      stopReading();
      return;
    }
    reader.scrollTop += 1;
  }, 65);
};
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-chapter]",
))
  button.onclick = () => {
    stopReading();
    const section = $("history-" + button.dataset.chapter);
    reader.scrollTo({
      top:
        section.getBoundingClientRect().top -
        reader.getBoundingClientRect().top +
        reader.scrollTop,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
}
bindHistory();
$("briefTab").onclick = () => refit(false);
$("refitTab").onclick = () =>
  refit(!$("briefing").classList.contains("show-refit"));
$("ap").onclick = () => sim.select("AP");
$("he").onclick = () => sim.select("HE");
$("headphoneTest").onclick = () => {
  void audio
    .testHeadphones()
    .then(() => {
      $("sound").textContent = audio.enabled ? "声音：开" : "声音：关";
      $("sound").setAttribute("aria-pressed", String(audio.enabled));
    })
    .catch(() => notify("无法开启声音，请检查浏览器音频设置。"));
};
$("sound").onclick = () => {
  audio.toggle();
  $("sound").textContent = audio.enabled ? "声音：开" : "声音：关";
  $("sound").setAttribute("aria-pressed", String(audio.enabled));
  if (audio.enabled && sim.phase === "playing") void audio.start();
};
const qualityLabels = { low: "流畅", normal: "标准", high: "高" };
function updateQualityLabel() {
  $("quality").textContent = "画质：" + qualityLabels[world.quality];
  $("quality").title = "点击切换：标准 → 高 → 流畅";
}
try {
  const saved = localStorage.getItem("iron-traces-quality");
  if (saved === "low" || saved === "normal" || saved === "high")
    world.setQuality(saved);
} catch {}
updateQualityLabel();
$("quality").onclick = () => {
  world.setQuality(
    world.quality === "normal"
      ? "high"
      : world.quality === "high"
        ? "low"
        : "normal",
  );
  updateQualityLabel();
  try {
    localStorage.setItem("iron-traces-quality", world.quality);
  } catch {}
};
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-upgrade]"))
  b.onclick = () => {
    if (!b.disabled) {
      chosen =
        b.dataset.upgrade === "none" ? null : (b.dataset.upgrade as Ammo);
      sim.upgraded = chosen;
      refreshRefit();
    }
  };
window.addEventListener("keydown", (e) => {
  if (document.body.classList.contains("at-campaign")) return;
  if (
    [
      "KeyW",
      "KeyS",
      "KeyA",
      "KeyD",
      "KeyC",
      "KeyR",
      "KeyM",
      "KeyE",
      "Digit1",
      "Digit2",
      "Digit3",
      "Escape",
      "Space",
    ].includes(e.code)
  )
    e.preventDefault();
  if (e.repeat) return;
  if (e.code === "Escape") {
    if (mapOpen) toggleMap();
    else if (sim.phase === "playing") pause();
    else if (sim.phase === "paused") resume();
  } else if (e.code === "KeyM") toggleMap();
  else if (e.code === "KeyC") toggleCamera();
  else if (
    e.code === "KeyR" &&
    world.mode === "interior" &&
    sim.phase === "playing"
  ) {
    alignTurret = true;
    mouse.x = 0;
  } else if (e.code === "Digit1") sim.select("AP");
  else if (e.code === "Digit2") sim.select("HE");
  else if (sim.phase === "playing") keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("mousemove", (e) => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = 1 - (e.clientY / innerHeight) * 2;
  if (
    world.mode === "interior" &&
    (e.target as HTMLElement)?.closest?.("button")
  )
    mouse.x = 0;
  if (sim.phase === "playing" && world.mode !== "interior") {
    $("crosshair").style.left = e.clientX + "px";
    $("crosshair").style.top = e.clientY + "px";
  }
});
$("scene").addEventListener("mousedown", (e) => {
  if (e.button === 0 && sim.phase === "playing") {
    firing = true;
    fireRequested = true;
  }
});
window.addEventListener("mouseup", () => (firing = false));
window.addEventListener("blur", pause);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
window.addEventListener("resize", () => world.resize());
$("scene").addEventListener("contextmenu", (e) => e.preventDefault());
$("scene").addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  pause();
  notify("图形连接中断，请刷新页面重新进入战场。", 9999);
});
function formatTime(time: number) {
  return (
    String(Math.floor(time / 60)).padStart(2, "0") +
    ":" +
    String(Math.floor(time % 60)).padStart(2, "0")
  );
}
function drawMap(canvas: HTMLCanvasElement, briefing = false) {
  const ctx = canvas.getContext("2d")!,
    n = canvas.width,
    s = n / SIZE,
    px = (v: number) => (v + SIZE / 2) * s;
  ctx.fillStyle = "#d6ceb5";
  ctx.fillRect(0, 0, n, n);
  ctx.strokeStyle = "#a3a48870";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo((i * n) / 8, 0);
    ctx.lineTo((i * n) / 8, n);
    ctx.moveTo(0, (i * n) / 8);
    ctx.lineTo(n, (i * n) / 8);
    ctx.stroke();
  }
  ctx.strokeStyle = "#eee4cc";
  ctx.lineWidth = s * 6;
  ctx.beginPath();
  ctx.moveTo(px(0), 0);
  ctx.lineTo(px(0), n);
  for (const z of ROAD_Z) {
    ctx.moveTo(0, px(z));
    ctx.lineTo(n, px(z));
  }
  for (const x of ROAD_X) {
    ctx.moveTo(px(x), 0);
    ctx.lineTo(px(x), n);
  }
  ctx.stroke();
  ctx.fillStyle='#6c8f9b';
  for(const water of WATER)ctx.fillRect(px(water.x-water.w/2),px(water.z-water.d/2),water.w*s,water.d*s);
  ctx.fillStyle='#9e9380';
  for(const bridge of BRIDGES)ctx.fillRect(px(bridge.x-bridge.w/2),px(bridge.z-bridge.d/2),bridge.w*s,bridge.d*s);
  ctx.fillStyle = "#738062";
  for (const f of FORESTS) {
    if (briefing) {
      ctx.fillStyle = "#7b876330";
      ctx.fillRect(px(f.x - f.w / 2), px(f.z - f.d / 2), f.w * s, f.d * s);
      ctx.fillStyle = "#63714e";
      for (let z = f.z - f.d / 2 + 2; z < f.z + f.d / 2 - 1; z += 4)
        for (let x = f.x - f.w / 2 + 2; x < f.x + f.w / 2 - 1; x += 4) {
          ctx.beginPath();
          ctx.moveTo(px(x), px(z - 1.7));
          ctx.lineTo(px(x - 1.3), px(z + 1.3));
          ctx.lineTo(px(x + 1.3), px(z + 1.3));
          ctx.closePath();
          ctx.fill();
        }
      continue;
    }
    ctx.fillRect(px(f.x - f.w / 2), px(f.z - f.d / 2), f.w * s, f.d * s);
    ctx.strokeStyle = "#536444";
    for (let x = f.x - f.w / 2; x < f.x + f.w / 2; x += 3) {
      ctx.beginPath();
      ctx.moveTo(px(x), px(f.z - f.d / 2));
      ctx.lineTo(px(x), px(f.z + f.d / 2));
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#a2977c";
  for (const b of BUILDINGS)
    ctx.fillRect(px(b.x - b.w / 2), px(b.z - b.d / 2), b.w * s, b.d * s);
  ctx.fillStyle = "#899987";
  ctx.beginPath();
  ctx.ellipse(
    px(SWAMP.x),
    px(SWAMP.z),
    SWAMP.rx * s,
    SWAMP.rz * s,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = "#92674c";
  for (const w of sim.walls)
    if (w.hp > 0)
      ctx.fillRect(px(w.x - w.w / 2), px(w.z) - s * 0.5, w.w * s, s);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${n * 0.048}px sans-serif`;
  ctx.fillStyle = "#4e603b";
  ctx.fillText("+", px(SUPPLY.x), px(SUPPLY.z));
  ctx.fillStyle = sim.kills === sim.enemies.length ? "#667c32" : "#b58b39";
  ctx.fillText("★", px(OBJECTIVE.x), px(OBJECTIVE.z));
  for (const e of !briefing && showEnemyPositions(world.mode)
    ? sim.enemies
    : []) {
    ctx.fillStyle = e.alive ? "#974d3a" : "#83785f";
    ctx.save();
    ctx.translate(px(e.x), px(e.z));
    ctx.rotate(-e.angle);
    const r = Math.max(2 * s, 3);
    ctx.fillRect(-r, -r, 2 * r, 2 * r);
    ctx.restore();
  }
  if (n > 400) {
    ctx.fillStyle = "#48513d";
    ctx.font = `${n * 0.018}px sans-serif`;
    for (const [label, x, z] of [
      ["集结区", SPAWN.x, SPAWN.z],
      [sim.level.title, -180, -210],
      ["任务目标", OBJECTIVE.x, OBJECTIVE.z - 12],
      ["补给", SUPPLY.x, SUPPLY.z],
    ] as const)
      ctx.fillText(label, px(x), px(z));
    ctx.textAlign = "left";
    ctx.fillText(`${SIZE} × ${SIZE} m · 每格 ${SIZE / 8} m`, 12, n - 12);
  }
  if (briefing) {
    ctx.strokeStyle = "#934333";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 7]);
    ctx.beginPath();
    ctx.moveTo(px(SPAWN.x), px(SPAWN.z));
    ctx.lineTo(px(OBJECTIVE.x), px(OBJECTIVE.z));
    ctx.stroke();
    ctx.setLineDash([]);

  }
  const p = sim.player;
  ctx.save();
  ctx.translate(px(p.x), px(p.z));
  ctx.rotate(-p.angle);
  ctx.fillStyle = "#f7efcf";
  ctx.strokeStyle = "#394c2e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 3 * s);
  ctx.lineTo(-2.2 * s, -2.5 * s);
  ctx.lineTo(2.2 * s, -2.5 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
function ui() {
  const p = sim.player;
  $("hp").textContent = String(Math.ceil(p.hp));
  $("hpBar").style.width = p.hp + "%";
  $("hud").classList.toggle("low-health", p.hp < 35);
  $("speed").textContent = Math.round(Math.abs(p.speed) * 3.6) + " km/h";
  const wet = terrainFactor(p) < 1;
  $("terrain").textContent = wet ? "沼泽 · 减速" : "普通地面";
  $("apCount").textContent = String(sim.ammo.AP);
  $("heCount").textContent = String(sim.ammo.HE);
  $("ap").classList.toggle("selected", sim.selected === "AP");
  $("he").classList.toggle("selected", sim.selected === "HE");
  $("reload").textContent =
    p.reload > 0
      ? p.reload.toFixed(1) + " s"
      : sim.ammo[sim.selected] > 0
        ? "READY"
        : "EMPTY";
  $("reloadLabel").textContent =
    p.reload > 0
      ? "正在装填"
      : sim.ammo[sim.selected] > 0
        ? "主炮就绪"
        : "弹药耗尽";
  $("crosshair").classList.toggle("reloading", p.reload > 0);
  $("enemyCount").textContent = `敌军目标 ${sim.kills} / ${sim.enemies.length}`;
  $("objectiveText").textContent =
    sim.kills < sim.enemies.length
      ? sim.level.objectiveText
      : `敌军已清除 · 前往 ★ 停稳 ${sim.level.captureSeconds} 秒`;
  $("captureBar").style.width = (sim.capture / sim.level.captureSeconds) * 100 + "%";
  $("damage").style.opacity = sim.time - p.lastHit < 0.4 ? "0.6" : "0";
  const tip =
    sim.supplyProgress > 0
      ? `正在补给 ${sim.supplyProgress.toFixed(1)} / 8 秒 · 保持按住 E`
      : distance(p, SUPPLY) < 5
        ? sim.supplyUses >= 2
          ? "补给点已耗尽"
          : p.hp === 100 && sim.ammo.AP === 14 && sim.ammo.HE === 22
            ? "补给点 · 车辆与弹药已齐备"
            : "补给点 · 停稳后按住 E，8 秒完成补给"
        : wet
          ? "沼泽地带 · 履带阻力增大"
          : sim.kills === sim.enemies.length && distance(p, OBJECTIVE) < 6
            ? "停稳控制路口 · " + sim.capture.toFixed(1) + ` / ${sim.level.captureSeconds} 秒`
            : "";
  $("statusTip").hidden = !tip;
  $("statusTip").textContent = tip;
  if (performance.now() > toastUntil) $("toast").hidden = true;
  drawMap($<HTMLCanvasElement>("minimap"));
  if (sim.phase === "briefing") drawMap($<HTMLCanvasElement>("briefMap"), true);
  const target = new T.Vector3(
    p.x + Math.sin(p.turret) * 20,
    1.3,
    p.z + Math.cos(p.turret) * 20,
  ).project(world.camera);
  $("aimMarker").style.left = (target.x * 0.5 + 0.5) * innerWidth + "px";
  $("aimMarker").style.top = (-target.y * 0.5 + 0.5) * innerHeight + "px";
  $("aimMarker").hidden = target.z > 1 || world.mode === "interior";
  if (world.mode === "interior") {
    const delta =
      (Math.atan2(Math.sin(p.turret - p.angle), Math.cos(p.turret - p.angle)) *
        180) /
      Math.PI;
    $("turretBearing").textContent =
      (Math.abs(delta) < 1 ? "正前" : delta > 0 ? "左 " : "右 ") +
      (Math.abs(delta) < 1 ? "" : Math.round(Math.abs(delta)) + "°");
    $("hullBearing").textContent =
      String(
        Math.round((180 - (((p.angle * 180) / Math.PI) % 360) + 360) % 360),
      ).padStart(3, "0") + "°";
    $("traverseState").textContent = alignTurret
      ? "炮塔回正中"
      : Math.abs(mouse.x) > 0.14
        ? mouse.x < 0
          ? "◂ 向左转动"
          : "向右转动 ▸"
        : "炮塔停止";
  }
}
function frame(now: number) {
  const elapsed = (now - last) / 1000;
  last = now;
  const dt = Math.min(elapsed, 0.1);
  if (document.body.classList.contains("at-campaign")) { requestAnimationFrame(frame); return; }
  if (elapsed > 0.25 && sim.phase === "playing") {
    pause();
    notify("画面暂时中断，已暂停。点击继续即可恢复。", 5);
  }
  if (world.mode === "interior" && Math.abs(mouse.x) > 0.14)
    alignTurret = false;
  if (
    alignTurret &&
    Math.abs(
      Math.atan2(
        Math.sin(sim.player.turret - sim.player.angle),
        Math.cos(sim.player.turret - sim.player.angle),
      ),
    ) < 0.01
  )
    alignTurret = false;
  const input: Input = {
    forward: (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0),
    turn: (keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0),
    aim:
      world.mode === "interior"
        ? alignTurret
          ? sim.player.angle
          : interiorAim(sim.player.turret, mouse.x, dt)
        : world.aim(mouse.x, mouse.y, sim.player),
    fire: firing || fireRequested,
    supply: keys.has("KeyE"),
  };
  if (sim.phase === "playing") {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      if (world.mode === "interior")
        input.aim = alignTurret
          ? sim.player.angle
          : interiorAim(sim.player.turret, mouse.x, STEP);
      sim.step(input);
      fireRequested = false;
      input.fire = firing;
      acc -= STEP;
      steps++;
    }
    if (steps === 5) acc = 0;
  } else acc = 0;
  for (const e of sim.drain()) {
    world.emit(e);
    audio.effect(e);
    if (e.type === "supply") notify("补给完成 · 已修复车体并补充弹药");
    if (e.type === "destroy" && e.owner && e.owner > 0)
      notify("敌军坦克已被击毁");
  }
  if (wasPhase !== sim.phase) {
    wasPhase = sim.phase;
    showPhase();
  }
  world.update(sim, dt);
  const loading = $("tankReload");
  loading.hidden = sim.phase !== "playing" || !sim.player.alive || sim.player.reload <= 0;
  if (!loading.hidden) {
    const p = sim.player;
    const progress = Math.max(0, Math.min(1, 1 - p.reload / Math.max(sim.reloadDuration, .001)));
    $("tankReloadFill").style.transform = `scaleX(${progress})`;
    $("tankReloadText").textContent = `装填中　${p.reload.toFixed(1)} s`;
    loading.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
    if (world.mode === "interior") {
      loading.style.left = "50%"; loading.style.top = "65%";
    } else {
      const anchor = new T.Vector3(p.x, 4.3, p.z).project(world.camera);
      loading.hidden = anchor.z < -1 || anchor.z > 1 || Math.abs(anchor.x) > 1 || Math.abs(anchor.y) > 1;
      loading.style.left = `${(anchor.x * .5 + .5) * innerWidth}px`;
      loading.style.top = `${(-anchor.y * .5 + .5) * innerHeight}px`;
    }
  }
  audio.update(
    sim.player,
    sim.phase === "playing",
    terrainFactor(sim.player) < 1,
    world.mode === "interior" && !world.cinematic,
    sim.enemies,
    world.camera.getWorldDirection(new T.Vector3()),
    (a, b) => sim.lineClear(a, b),
    sim.time,
  );
  uiClock += dt;
  if (uiClock > 0.1) {
    ui();
    uiClock = 0;
  }
  if (elapsed > 0) {
    frames.push(elapsed * 1000);
    if (frames.length > 180) frames.shift();
  }
  if (frames.length > 0 && frames.length % 30 === 0)
    $("fps").textContent =
      Math.round(1000 / (frames.reduce((a, b) => a + b, 0) / frames.length)) +
      " FPS";
  requestAnimationFrame(frame);
}
showPhase();
refreshRefit();
ui();
requestAnimationFrame(frame);
// Read-only diagnostics are available in normal use. Controlled state injection exists only in Vite development builds.
const inspect = () => ({
  map: {
    width: SIZE,
    depth: SIZE,
    area: SIZE * SIZE,
    tankBoundingArea: world.footprintArea,
    areaRatio: (SIZE * SIZE) / world.footprintArea,
  },
  level: sim.level.id,
  phase: sim.phase,
  time: sim.time,
  player: { ...sim.player },
  enemies: sim.enemies.map((t) => ({ ...t })),
  walls: sim.walls.map((w) => ({ ...w })),
  ammo: { ...sim.ammo },
  selected: sim.selected,
  upgraded: sim.upgraded,
  kills: sim.kills,
  capture: sim.capture,
  supplyUses: sim.supplyUses,
  supplyProgress: sim.supplyProgress,
  tracks: world.tracks,
  particles: world.effects.particles.length,
  camera: world.mode,
  enemyPositionsOnMap: showEnemyPositions(world.mode),
  cabinVisible: world.mode === "interior" && !world.cinematic,
  quality: world.quality,
  audio: {
    state: audio.ctx?.state,
    enabled: audio.enabled,
    voices: audio.voices,
    diagnostics: audio.inspect(),
  },
  renderer: {
    drawingBuffer: world.renderer
      .getDrawingBufferSize(new T.Vector2())
      .toArray(),
    shadowResolution: world.sun.shadow.mapSize.x,
    shadows: world.sun.castShadow,
    calls: world.renderer.info.render.calls,
    triangles: world.renderer.info.render.triangles,
    geometries: world.renderer.info.memory.geometries,
    textures: world.renderer.info.memory.textures,
  },
  frameMs: [...frames],
});
Object.assign(window, {
  __ironTraces: {
    inspect,
    ...(import.meta.env.DEV
      ? {
          sim: () => sim,
          world: () => world,
          audio: () => audio,
          advance: (seconds: number, input: Partial<Input> = {}) => {
            for (let i = 0; i < Math.ceil(seconds / STEP); i++)
              sim.step({
                forward: 0,
                turn: 0,
                aim: sim.player.turret,
                fire: false,
                supply: false,
                ...input,
              });
          },
          restart: () => newMission(true),
        }
      : {}),
  },
});

const campaignMenu = createMenu((index) => { if (!isUnlocked(index,completedLevels)) return; newMission(false,index); $("start").focus(); }, () => completedLevels, () => audio.enabled, () => {
  audio.toggle();
  $("sound").textContent = audio.enabled ? "声音：开" : "声音：关";
  $("sound").setAttribute("aria-pressed", String(audio.enabled));
});
const campaignBack = document.createElement("button");
campaignBack.className = "campaign-back";
campaignBack.textContent = "‹ 战役选择";
campaignBack.onclick = () => { newMission(); campaignMenu.show(); };
document.body.append(campaignBack);
campaignMenu.show();

$("nextMission").onclick=()=>{if(selectedLevel+1<LEVELS.length && isUnlocked(selectedLevel+1,completedLevels))newMission(false,selectedLevel+1);};
$("resultMenu").onclick=()=>{newMission();campaignMenu.show();};
function refreshBriefing(){
  stopReading();
  const level=sim.level;
  const dossier=document.querySelector<HTMLElement>('.dossier')!;
  dossier.classList.add('multi-campaign');
  let paintedMap=dossier.querySelector<HTMLImageElement>('.painted-brief-map');
  if(!paintedMap){paintedMap=document.createElement('img');paintedMap.className='painted-brief-map';document.querySelector('.map-paper')!.append(paintedMap);}
  paintedMap.src=`./images/map-${level.id}.png`;
  paintedMap.alt=`${level.title}：手绘风格行军示意图，非历史测绘；精确位置以战斗地图为准`;

  let header=dossier.querySelector<HTMLElement>('.campaign-brief-title');
  if(!header){header=document.createElement('header');header.className='campaign-brief-title';dossier.append(header);}
  header.innerHTML=`<h1>作战简报</h1><p>${level.title} · ${level.subtitle}</p>`;
  document.querySelector('.history-paper')!.innerHTML=historyMarkup(selectedLevel);
  bindHistory();
  const meta=document.createElement('div');meta.className='campaign-brief-meta';
  meta.textContent=`${level.date} ｜ ${level.army} ｜ ${level.tank}`;
  reader.prepend(meta);
  const orders=document.createElement('p');orders.className='campaign-order';orders.textContent=`本局任务：${level.objectiveText} 清除 ${sim.enemies.length} 辆敌车后，控制目标 ${level.captureSeconds} 秒。`;
  reader.prepend(orders);
  const photo=document.querySelector<HTMLImageElement>('.brief-photo img')!;
  photo.src=selectedLevel===0?'./images/cover-painted-v2.webp':`./images/briefing-${level.id}.webp`;
  photo.alt=`生成场景插画：${level.title}，非历史照片`;
  document.querySelector('.mission-panel .eyebrow')!.textContent=`N0${selectedLevel+1} / ${level.subtitle}`;
  document.querySelector('.mission-panel h2')!.textContent=level.subtitle;
  $("topLabel").textContent=`${level.title} / ${level.date}`;
  document.querySelector('.large-map h2')!.textContent=`${level.title} · 战术地图`;
  document.title=`铁迹 — ${level.title}`;
  refit(false);
  drawMap($<HTMLCanvasElement>('briefMap'),true);
}
