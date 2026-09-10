"""Generate the authorized H3 hero video. API key is read without echo; never persisted."""
import base64,getpass,json,time,urllib.request,urllib.error,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/asset-sources/hero-video'
API='https://openrouter.ai/api/v1'
key=getpass.getpass('OpenRouter key (hidden): ')
def call(path,data=None):
    body=json.dumps(data).encode() if data is not None else None
    req=urllib.request.Request(API+path,data=body,headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=90) as response:return json.load(response)
    except urllib.error.HTTPError as e:
        try:err=json.loads(e.read())
        except Exception:err={'error':'HTTP error'}
        print(json.dumps({'http_status':e.code,'error':err.get('error')},ensure_ascii=False),flush=True)
        sys.exit(1)
def frame(name,kind):
    data=base64.b64encode((ROOT/'public/images'/name).read_bytes()).decode()
    return {'type':'image_url','image_url':{'url':'data:image/png;base64,'+data},'frame_type':kind}
prompt='''Locked-off static camera, a single continuous 15-second shot. Animate ONLY the upper landscape of the provided game menu. Same Sherman tank begins small and distant on the lane in first frame and physically drives slowly toward the camera along the lane, naturally growing in perspective until it reaches the original large foreground position at right shown in last frame. Tracks rotate, suspension rocks gently over ruts, subtle dust at ground level. The tank turns very slightly along the curved lane to match final orientation; slow down smoothly during seconds 11-13, settle and idle in place for final 2 seconds. The whole village, walls, trees, road, horizon and framing stay fixed, NO camera movement, NO zoom, NO pan, no cuts. Soft sunlight subtly shifts through clouds, thin smoke drifts very slowly in the distance. Restrained calm after battle, no gunfire or explosions. Preserve vehicle geometry and identity, do not morph or spawn extra tanks. Keep left logo/typography and complete lower campaign menu area pixel-stable and motionless. No new words. Finish matching last reference frame exactly. No audio.'''
params={'model':'minimax/hailuo-3','prompt':prompt,'duration':15,'resolution':'2K','aspect_ratio':'16:9','generate_audio':False}
(OUT/'request.json').write_text(json.dumps({**params,'frame_images':['public/images/campaign-approach-first.png','public/images/campaign-approach-last.png']},ensure_ascii=False,indent=2))
jobfile=OUT/'job.json'
if jobfile.exists():
    job=json.loads(jobfile.read_text());print('Resuming existing job; no new generation submitted.',flush=True)
else:
    params['frame_images']=[frame('campaign-approach-first.png','first_frame'),frame('campaign-approach-last.png','last_frame')]
    job=call('/videos',params)
    jobfile.write_text(json.dumps(job,ensure_ascii=False,indent=2))
    print(json.dumps(job,ensure_ascii=False),flush=True)
job_id=job.get('id') or job.get('data',{}).get('id')
if not job_id:raise SystemExit('No job id in response; inspect job.json before any retry.')
previous=None
for _ in range(180):
    job=call('/videos/'+job_id)
    status=job.get('status') or job.get('data',{}).get('status')
    if status!=previous:print('Video status: '+str(status),flush=True);previous=status
    jobfile.write_text(json.dumps(job,ensure_ascii=False,indent=2))
    if status=='completed':break
    if status in ('failed','cancelled','canceled'):
        print(json.dumps(job,ensure_ascii=False),flush=True);sys.exit(2)
    time.sleep(10)
else:raise SystemExit('Polling limit reached. Resume saved job later.')
req=urllib.request.Request(API+'/videos/'+job_id+'/content',headers={'Authorization':'Bearer '+key})
# Strip authorization on cross-origin redirects before media download.
class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        from urllib.parse import urlsplit
        out=super().redirect_request(req,fp,code,msg,headers,newurl)
        if out and urlsplit(newurl).netloc!=urlsplit(req.full_url).netloc:out.remove_header('Authorization')
        return out
with urllib.request.build_opener(SafeRedirect()).open(req,timeout=180) as response:
    media=response.read()
(ROOT/'public/videos/campaign-approach.mp4').write_bytes(media)
print('Saved video: '+str(len(media))+' bytes',flush=True)
