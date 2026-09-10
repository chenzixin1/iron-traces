# 铁迹 · 首个可玩战场执行计划

**Goal:** 实现设计附录中的 96 米可玩切片，以诺曼底 N01 为历史背景，验证驾驶、战斗、三种地形、双视角、压痕、声音及完整任务循环。
**模板:** static；依据已确认设计采用 TypeScript / Vite / Three.js，覆盖通用模板的 Vue/CDN 限制。
**needs_dw:** false
**needs_db:** false

本轮为本地单人游戏，不进行远程注册发布。完整六局制作在代表场景画质与手感验收后继续。

- [x] Task 1: 初始化 TypeScript/Vite/Three.js 与设计上下文。文件 package.json、tsconfig.json、index.html、.impeccable.md。验证依赖与类型检查。
- [x] Task 2: 实现纯逻辑固定步长战斗、连续碰撞、墙体、沼泽、敌人行为及任务状态。文件 src/simulation.ts、tests/simulation.test.ts。验证墙体弹数、碰撞、减速、重试、补给、升级。
- [x] Task 3: 制作三维地形、坦克、树林、墙体、轨迹和双视角。文件 src/world.ts、src/main.ts。验证浏览器实际画面与视角切换。
- [x] Task 4: 实现战役简报、整备、仪表、小地图、暂停、战果及程序音效。文件 src/style.css、src/audio.ts、src/main.ts。验证键鼠、暂停与胜负重开。
- [x] Task 5: 实际浏览器试玩、截图、运行指标及修复。文件 qa/、README.md。验证构建、逻辑测试、浏览器无错误、操控与完整任务循环。
- [x] Task 6: 迭代预览。本地启动 Vite 预览并在 Codex 打开，提供可玩的版本与真实验收记录。
- [x] Task 7: 注册发布。本轮不适用，既定范围为本地原型，无远程发布与账号依赖。
