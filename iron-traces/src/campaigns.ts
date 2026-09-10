export type LevelId = "normandy" | "falaise" | "market-garden" | "aachen" | "ardennes" | "remagen";
export interface Point { x:number; z:number }
export interface Rect extends Point { w:number; d:number }
export interface Level {
 id:LevelId; title:string; subtitle:string; date:string; army:string; tank:string;
 objectiveText:string; theme:"summer"|"autumn"|"winter"|"river";
 forests:Rect[]; buildings:Rect[]; roadsX:number[]; roadsZ:number[];
 spawn:Point; supply:Point; objective:Point;
 swamp:Point & {rx:number;rz:number};
 enemies:(Point & {hp:number})[]; walls:(Rect & {hp:number})[];
 water:Rect[]; bridges:Rect[]; captureSeconds:number;
}
const FORESTS: Rect[] = [
  { x: -65, z: 77, w: 30, d: 36 },
  { x: 58, z: 79, w: 28, d: 32 },
  { x: -83, z: 15, w: 32, d: 43 },
  { x: 82, z: -15, w: 34, d: 42 },
  { x: -55, z: -76, w: 30, d: 28 },
  { x: 54, z: -82, w: 30, d: 32 },
  { x: -106, z: -83, w: 18, d: 45 },
  { x: 108, z: 75, w: 18, d: 45 },
  { x: -28, z: 7, w: 15, d: 23 },
  { x: 28, z: -7, w: 15, d: 25 },
  { x: -28, z: -29, w: 19, d: 13 },
  { x: 32, z: 32, w: 16, d: 17 },
];
const BUILDINGS: Rect[] = [
  { x: -15, z: 78, w: 9, d: 8 },
  { x: 19, z: 64, w: 10, d: 9 },
  { x: -57, z: 30, w: 9, d: 10 },
  { x: 57, z: 24, w: 9, d: 8 },
  { x: -18, z: -82, w: 10, d: 9 },
  { x: 20, z: -100, w: 8, d: 11 },
  { x: -13, z: -35, w: 9, d: 8 },
  { x: 27, z: -34, w: 10, d: 9 },
  { x: 36, z: 12, w: 8, d: 11 },
  { x: -39, z: -9, w: 7, d: 10 },
];
// Extend the original central village with northern and southern hamlets.
for (const z of [-192, -144, 144, 192]) {
  for (const side of [-1, 1]) {
    FORESTS.push({ x: side * 62, z, w: 44, d: 34 });
    FORESTS.push({ x: side * 178, z, w: 54, d: 38 });
    BUILDINGS.push({ x: side * 20, z: z + side * 6, w: 10, d: 9 });
    BUILDINGS.push({ x: side * 110, z: z - side * 10, w: 9, d: 11 });
  }
}
const SWAMP = { x: -10, z: 19, rx: 10, rz: 8 };
const SUPPLY = { x: 11, z: 204 };
const SPAWN = { x: 0, z: 224 };
const ROAD_Z = [-208, -144, -96, -32, 48, 96, 144, 208];
const ROAD_X = [-128, -48, 48, 128];
const OBJECTIVE = { x: 0, z: -224 };

const wallLine=(x:number,z:number,count:number):Level["walls"]=>Array.from({length:count},(_,i)=>({x:x+i*3.2,z,w:3.15,d:.85,hp:120}));
const rect=(x:number,z:number,w:number,d:number):Rect=>({x,z,w,d});
const enemies=(points:number[][])=>points.map(([x,z,hp=82])=>({x,z,hp}));
export const LEVELS:Level[]=[
 {id:"normandy",title:"诺曼底",subtitle:"树篱之间",date:"1944年7月25日",army:"美军第2装甲师（虚构车组）",tank:"M4 谢尔曼 · 75毫米炮",objectiveText:"消灭守军，沿树篱推进并控制北侧路口。",theme:"summer",forests:FORESTS,buildings:BUILDINGS,roadsX:ROAD_X,roadsZ:ROAD_Z,spawn:SPAWN,supply:SUPPLY,objective:OBJECTIVE,swamp:SWAMP,enemies:enemies([[-9,150],[13,-25],[0,-212,95]]),walls:[...wallLine(-9.6,3,7),...wallLine(13,-12,3)],water:[],bridges:[],captureSeconds:5},
 {id:"falaise",title:"法莱斯",subtitle:"合围之路",date:"1944年8月19日",army:"加拿大第4装甲师（虚构车组）",tank:"M4 谢尔曼 · 75毫米炮",objectiveText:"穿越开阔农田，清除四处阻击，控制东北撤退路口。",theme:"summer",spawn:{x:-176,z:208},supply:{x:-162,z:186},objective:{x:174,z:-206},roadsX:[-176,-80,80,176],roadsZ:[-208,-96,16,112,208],forests:[rect(-215,80,42,72),rect(-112,40,38,66),rect(-20,110,56,40),rect(55,-42,48,58),rect(210,-80,44,74),rect(80,-175,50,38),rect(-100,-160,64,44)],buildings:[rect(-145,145,14,11),rect(-68,110,12,14),rect(-47,24,16,12),rect(34,48,12,14),rect(110,-112,15,12),rect(143,-173,12,14),rect(202,-180,14,16)],swamp:{x:22,z:-105,rx:25,rz:17},enemies:enemies([[-145,95],[-40,0],[124,-110],[174,-188,95]]),walls:[...wallLine(-96,62,8),...wallLine(107,-151,7)],water:[],bridges:[],captureSeconds:7},
 {id:"market-garden",title:"市场花园",subtitle:"公路突进",date:"1944年9月20日",army:"英军近卫装甲师 · 第30军（虚构车组）",tank:"谢尔曼 · 75毫米炮",objectiveText:"突破狭窄公路与桥头守军，沿中央桥梁渡河并建立北岸阵地。",theme:"autumn",spawn:{x:0,z:224},supply:{x:12,z:192},objective:{x:0,z:-224},roadsX:[-112,0,112],roadsZ:[-208,-104,96,192],forests:[rect(-46,154,48,62),rect(49,65,52,60),rect(-78,-90,65,66),rect(90,-157,60,50),rect(-182,116,65,94),rect(187,-105,60,110)],buildings:[rect(-22,90,12,18),rect(25,119,14,16),rect(-25,-81,14,15),rect(27,-112,12,18),rect(-33,-193,16,14),rect(35,-216,15,14)],swamp:{x:110,z:133,rx:30,rz:35},enemies:enemies([[0,134],[8,54],[-10,-72],[0,-175,95]]),walls:[...wallLine(-35,28,6),...wallLine(17,-55,6)],water:[rect(-136,-12,240,44),rect(136,-12,240,44)],bridges:[rect(0,-12,32,52)],captureSeconds:8},
 {id:"aachen",title:"亚琛",subtitle:"钢铁入城",date:"1944年10月16日",army:"支援美军第1步兵师的虚构车组",tank:"M4 谢尔曼 · 75毫米炮",objectiveText:"沿街巷逐段搜索五辆守军坦克，控制市中心广场。",theme:"autumn",spawn:{x:0,z:224},supply:{x:14,z:207},objective:{x:0,z:-192},roadsX:[-144,-72,0,72,144],roadsZ:[-216,-144,-72,0,72,144,216],forests:[rect(-205,30,48,82),rect(211,-112,42,72)],buildings:[-180,-108,-36,36,108,180].flatMap(x=>[-180,-108,-36,36,108,180].map(z=>rect(x,z,40,42))),swamp:{x:-143,z:-31,rx:12,rz:15},enemies:enemies([[0,140],[72,52],[-72,-30],[0,-107],[72,-200,95]]),walls:[...wallLine(-12,78,8),...wallLine(58,-58,9),...wallLine(-82,-150,7)],water:[],bridges:[],captureSeconds:8},
 {id:"ardennes",title:"阿登",subtitle:"打通走廊",date:"1944年12月26日",army:"美军第4装甲师（虚构车组）",tank:"M4 谢尔曼 · 75毫米炮",objectiveText:"从冰雪森林中的两条通道推进，击破阻击部队，与北侧守军会合。",theme:"winter",spawn:{x:-48,z:224},supply:{x:-35,z:204},objective:{x:48,z:-224},roadsX:[-48,48],roadsZ:[-208,-112,0,112,208],forests:[rect(-140,140,116,100),rect(134,140,120,108),rect(0,105,40,100),rect(-143,-15,115,124),rect(145,-22,118,128),rect(0,-112,42,112),rect(-141,-178,110,98),rect(146,-182,112,94)],buildings:[rect(-75,193,13,12),rect(-20,177,12,15),rect(73,-182,14,14),rect(23,-202,12,12),rect(-74,20,12,16)],swamp:{x:55,z:43,rx:14,rz:20},enemies:enemies([[-48,141],[48,69],[-48,-26],[48,-140],[48,-206,95]]),walls:[...wallLine(-61,70,8),...wallLine(30,-65,9)],water:[],bridges:[],captureSeconds:9},
 {id:"remagen",title:"雷马根",subtitle:"莱茵桥头",date:"1945年3月7日",army:"美军第9装甲师（虚构车组）",tank:"M4 谢尔曼 · 75毫米炮",objectiveText:"肃清西岸街区，经中央桥梁跨越莱茵河，清除东岸守军并稳固桥头堡。",theme:"river",spawn:{x:-214,z:144},supply:{x:-195,z:124},objective:{x:205,z:-82},roadsX:[-208,-120,120,208],roadsZ:[-144,-72,0,72,144],forests:[rect(-190,-150,60,70),rect(170,160,90,70),rect(188,-175,88,63),rect(100,-123,44,64)],buildings:[rect(-169,81,22,25),rect(-104,95,18,24),rect(-163,16,20,26),rect(-97,-38,20,25),rect(106,52,22,25),rect(168,35,20,24),rect(173,-109,20,24)],swamp:{x:-88,z:-112,rx:22,rz:26},enemies:enemies([[-208,68],[-90,8],[82,0],[125,-60],[204,-65,95]]),walls:[...wallLine(-175,48,9),...wallLine(95,-18,9)],water:[rect(0,-137,64,238),rect(0,137,64,238)],bridges:[rect(0,0,74,36)],captureSeconds:10}
];
