import * as T from 'three';
type Surface='plaster'|'brick'|'roof'|'wood'|'bark'|'grass'|'gravel'|'mud';
export function surfaceMaterial(kind:Surface,seed=42){
  let state=seed;const rand=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  const n=512,canvas=document.createElement('canvas');canvas.width=canvas.height=n;
  const c=canvas.getContext('2d')!;
  const colors={plaster:'#afa48d',brick:'#8c6e56',roof:'#696657',wood:'#66533b',bark:'#655d4b',grass:'#78805a',gravel:'#a6997c',mud:'#635740'};
  c.fillStyle=colors[kind];c.fillRect(0,0,n,n);
  for(let i=0;i<22000;i++){const v=rand();c.fillStyle=v>.5?'rgba(240,226,197,.09)':'rgba(25,24,17,.12)';c.fillRect(rand()*n,rand()*n,1+rand()*4,1+rand()*3);}
  if(kind==='brick'||kind==='roof'){
    const w=kind==='brick'?100:48,h=kind==='brick'?38:80;
    c.strokeStyle=kind==='brick'?'#494437':'#393b32';c.lineWidth=3;
    for(let y=-h;y<n;y+=h)for(let x=-w;x<n+w;x+=w){const xx=x+((y/h)%2)*w/2;c.strokeRect(xx,y,w,h);c.fillStyle='rgba(215,199,164,.14)';c.fillRect(xx+3,y+3,w-6,2);}
  }
  if(kind==='wood'||kind==='bark')for(let i=0;i<200;i++){
    const x=rand()*n;c.strokeStyle=i%3?'rgba(26,25,18,.4)':'rgba(174,154,107,.3)';c.lineWidth=1+rand()*3;c.beginPath();c.moveTo(x,0);
    for(let y=0;y<=n;y+=16)c.lineTo(x+Math.sin(y*.04+i)*5,y);c.stroke();
  }
  if(kind==='grass')for(let i=0;i<12000;i++){const x=rand()*n,y=rand()*n;c.strokeStyle=i%2?'#92926780':'#3f512f80';c.lineWidth=.6;c.beginPath();c.moveTo(x,y);c.lineTo(x+rand()*5-2,y-3-rand()*12);c.stroke();}
  if(kind==='gravel'||kind==='mud')for(let i=0;i<2500;i++){
    const x=rand()*n,y=rand()*n,r=1+rand()*(kind==='gravel'?5:12);c.fillStyle=kind==='gravel'?(i%2?'#c2b79c':'#706d5b'):'rgba(44,39,28,.18)';c.beginPath();c.ellipse(x,y,r,r*.55,rand()*6,0,6.28);c.fill();
  }
  if(kind==='plaster'){
    // Old impact scars and cracks are environmental decoration, not new damage events.
    for(let i=0;i<12;i++){let x=rand()*n,y=rand()*n;c.strokeStyle='#5d584c88';c.lineWidth=.7;c.beginPath();c.moveTo(x,y);for(let j=0;j<7;j++){x+=rand()*20-10;y+=rand()*14;c.lineTo(x,y);}c.stroke();}
    for(let i=0;i<7;i++){const x=rand()*n,y=rand()*n,g=c.createRadialGradient(x,y,1,x,y,12);g.addColorStop(0,'#25251fe0');g.addColorStop(.2,'#50453599');g.addColorStop(1,'#61564700');c.fillStyle=g;c.fillRect(x-12,y-12,24,24);}
    const soot=c.createLinearGradient(0,512,0,330);soot.addColorStop(0,'#24282088');soot.addColorStop(1,'#24282000');c.fillStyle=soot;c.fillRect(0,330,512,182);
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=8;
  const bump=texture.clone();bump.colorSpace=T.NoColorSpace;
  const roughCanvas=document.createElement('canvas');roughCanvas.width=roughCanvas.height=64;const rc=roughCanvas.getContext('2d')!;rc.fillStyle=kind==='mud'?'#686868':'#dddddd';rc.fillRect(0,0,64,64);
  for(let i=0;i<300;i++){rc.fillStyle=kind==='mud'?'#b0b0b0':'#bcbcbc';rc.fillRect(rand()*64,rand()*64,3,3);}
  const rough=new T.CanvasTexture(roughCanvas);rough.wrapS=rough.wrapT=T.RepeatWrapping;
  return new T.MeshStandardMaterial({map:texture,bumpMap:bump,bumpScale:kind==='bark'?.1:.04,roughnessMap:rough,roughness:1});
}
