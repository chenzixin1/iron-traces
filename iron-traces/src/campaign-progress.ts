/** URL-only preview access; never changes the saved campaign. */
export const previewAll = typeof location !== 'undefined' && new URLSearchParams(location.search).get('cheat') === '1';
const KEY='iron-traces-campaign-v1';
export const CAMPAIGN_IDS=['normandy','falaise','market-garden','aachen','ardennes','remagen'] as const;
export function normalizeProgress(raw:unknown):string[]{
  if(!Array.isArray(raw))return [];
  // Only accept a completed prefix, never skip a prerequisite through stale data.
  const result:string[]=[];
  for(const id of CAMPAIGN_IDS){if(!raw.includes(id))break;result.push(id);}return result;
}
export function readProgress():string[]{
  try {const raw=localStorage.getItem(KEY);if(raw!==null)return normalizeProgress(JSON.parse(raw));
    return Number(localStorage.getItem('iron-traces-wins'))>0?['normandy']:[];
  }catch{return [];}
}
export function isUnlocked(index:number,completed:readonly string[]){return index>=0&&index<CAMPAIGN_IDS.length&&(previewAll||index===0||completed.includes(CAMPAIGN_IDS[index-1]));}
export function recordWin(id:string,completed:readonly string[]){
  if(previewAll)return [...completed];
  const index=CAMPAIGN_IDS.indexOf(id as typeof CAMPAIGN_IDS[number]);
  if(!isUnlocked(index,completed))return [...completed];
  const next=normalizeProgress([...completed,id]);
  try {localStorage.setItem(KEY,JSON.stringify(next));}catch{}
  return next;
}
