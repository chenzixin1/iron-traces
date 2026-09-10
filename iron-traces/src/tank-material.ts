import * as T from 'three';
/** Layered surface maps: no lighting baked into the albedo. */
export function tankMaterial(base:string,seed:number,metal=false) {
  let state=seed;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  const size=1024, color=document.createElement('canvas'),height=document.createElement('canvas'),rough=document.createElement('canvas');
  for(const c of [color,height,rough])c.width=c.height=size;
  const c=color.getContext('2d')!,h=height.getContext('2d')!,r=rough.getContext('2d')!;
  c.fillStyle=base;c.fillRect(0,0,size,size);h.fillStyle='#808080';h.fillRect(0,0,size,size);r.fillStyle=metal?'#929292':'#c4c4c4';r.fillRect(0,0,size,size);
  for(let i=0;i<1200;i++){
    const x=random()*size,y=random()*size,rad=2+random()*38;
    c.fillStyle=random()<.5?'rgba(20,25,18,.025)':'rgba(170,153,112,.025)';c.beginPath();c.ellipse(x,y,rad,rad*.7,random()*6.28,0,6.28);c.fill();
  }
  // Fine cast-metal grain, small paint chips, and worn scratches.
  for(let i=0;i<28000;i++){
    const x=random()*size,y=random()*size,v=90+random()*70;
    h.fillStyle=`rgb(${v},${v},${v})`;h.fillRect(x,y,1+random()*2,1+random()*2);
  }
  for(let i=0;i<1300;i++){
    const x=random()*size,y=random()*size,w=1+random()*5,hh=.5+random()*2;
    c.fillStyle=metal?'#79654b':'#353931';c.fillRect(x,y,w,hh);
    if(i%3===0){c.fillStyle='#a29c80';c.fillRect(x,y+hh,w*.7,.65);}
    h.fillStyle='#535353';h.fillRect(x,y,w,hh);r.fillStyle='#777777';r.fillRect(x,y,w,hh);
  }
  for(let i=0;i<95;i++){
    const x=random()*size,y=random()*size;
    c.strokeStyle='rgba(175,170,141,.25)';c.lineWidth=.5+random();c.beginPath();c.moveTo(x,y);c.lineTo(x+random()*36,y+random()*4);c.stroke();
  }
  // Mud splashes concentrate along lower panel edges, with rain streaks above.
  for(let i=0;i<1100;i++){
    const x=random()*size,y=size*(.72+random()*.28),rad=random()*9;
    c.fillStyle=`rgba(92,76,50,${.12+random()*.25})`;c.beginPath();c.arc(x,y,rad,0,6.28);c.fill();
    h.fillStyle='#b0b0b0';h.beginPath();h.arc(x,y,rad*.7,0,6.28);h.fill();r.fillStyle='#eeeeee';r.fillRect(x,y,rad,rad);
  }
  for(let i=0;i<35;i++){const x=random()*size,y=random()*size;c.fillStyle='rgba(43,37,23,.12)';c.fillRect(x,y,1+random()*3,10+random()*65);}
  const tex=(canvas:HTMLCanvasElement,srgb=false)=>{const t=new T.CanvasTexture(canvas);if(srgb)t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;t.wrapS=t.wrapT=T.RepeatWrapping;return t;};
  return new T.MeshStandardMaterial({map:tex(color,true),bumpMap:tex(height),bumpScale:metal?.018:.012,roughnessMap:tex(rough),roughness:1,metalness:metal?.65:.22});
}
