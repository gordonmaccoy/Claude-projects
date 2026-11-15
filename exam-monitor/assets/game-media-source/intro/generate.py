"""Original geometric round cards. No third-party artwork or network inputs."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math, random, json
ROOT=Path(__file__).parent
W,H=1024,576
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
PALETTES=[('#073da4','#39139a','#38d8ff','#ffe16a'),('#7e168e','#e72677','#ffab5c','#75efff'),('#006778','#083ab5','#60f4be','#ffdb59'),('#6a22c5','#231b70','#c0a0ff','#78f8ee'),('#b73519','#bc1371','#ffdc6e','#91e9ff')]
def rgb(s):return tuple(bytes.fromhex(s[1:]))
def mix(a,b,t):return tuple(int(x*(1-t)+y*t) for x,y in zip(a,b))
def star(d,c,r,fill,points=4,rot=0):
 x,y=c; pts=[]
 for k in range(points*2):
  a=rot+k*math.pi/points; rad=r if k%2==0 else r*.33;pts.append((x+math.cos(a)*rad,y+math.sin(a)*rad))
 d.polygon(pts,fill=fill)
for n in range(1,26):
 rng=random.Random(300+n);a,b,accent,second=PALETTES[(n-1)%5];a,b=rgb(a),rgb(b);accent,second=rgb(accent),rgb(second)
 img=Image.new('RGB',(W,H));p=img.load()
 for y in range(H):
  for x in range(W):
   t=max(0,min(1,(x/W*.58+y/H*.42)));p[x,y]=mix(a,b,t)
 d=ImageDraw.Draw(img)
 # Rounded, cropped shapes establish depth beyond the card edges.
 d.ellipse((-160,-210,310,260),fill=mix(a,accent,.23));d.ellipse((785,350,1195,760),fill=mix(b,accent,.23))
 # Five distinct motif families; positions and colors vary per round.
 family=(n-1)//5
 for k in range(3):
  x=80+k*42;y=395+k*35
  if family==0:
   d.arc((x-110,y-110,x+110,y+110),35,295,fill=accent,width=9)
  elif family==1:
   d.line([(x-70,y+30),(x-15,y-25),(x+40,y+30),(x+95,y-25)],fill=accent,width=9)
  elif family==2:
   d.rounded_rectangle((x-10,y-10,x+30,y+30),radius=8,outline=accent,width=6)
  elif family==3:
   d.polygon([(x-25,y+20),(x+25,y+20),(x,y-24)],outline=accent,width=6)
  else:
   star(d,(x,y),32,accent,rot=n*.1)
 for k in range(5):
  y=80+k*22;d.line((835+k*5,y,952+k*5,y-44),fill=mix(second,b,.12),width=8)
 # Small festive sparks remain outside the numeral's safe area.
 for k,(x,y) in enumerate([(115,110),(875,280),(265,85),(785,475),(220,305),(910,435)]):
  x+=rng.randrange(-16,17);y+=rng.randrange(-16,17)
  star(d,(x,y),rng.randrange(8,20),second if k%2 else accent,rot=math.pi/4 if k%2 else 0)
 for x,y in [(325,480),(740,100),(80,285),(930,120)]:
  d.ellipse((x-5,y-5,x+5,y+5),fill=second)
 # Central pill badge is deliberately clean and consistent across all 25 cards.
 d.rounded_rectangle((315,82,731,508),radius=112,fill=mix(b,(3,12,44),.55))
 d.rounded_rectangle((299,66,715,492),radius=112,fill=mix(a,b,.5),outline=accent,width=7)
 d.arc((318,84,480,246),180,270,fill=mix(accent,(255,255,255),.5),width=5)
 text=str(n);font=ImageFont.truetype(FONT,260 if n<10 else 224)
 bounds=d.textbbox((0,0),text,font=font,stroke_width=0);tw,th=bounds[2]-bounds[0],bounds[3]-bounds[1]
 x=(W-tw)/2-bounds[0]-5;y=(H-th)/2-bounds[1]-7
 d.text((x+7,y+10),text,font=font,fill=(3,15,48),stroke_width=5,stroke_fill=(3,15,48))
 d.text((x,y),text,font=font,fill=(255,255,245),stroke_width=2,stroke_fill=(255,255,245))
 file=ROOT/f'question-{n}.webp';img.save(file,'WEBP',quality=87,method=6)
 assert file.stat().st_size<=120000
thumbs=Image.new('RGB',(1280,720),'#071f39')
for n in range(1,26):
 im=Image.open(ROOT/f'question-{n}.webp');im.thumbnail((256,144));thumbs.paste(im,(((n-1)%5)*256,((n-1)//5)*144))
thumbs.save(ROOT/'contact-sheet.jpg',quality=90)
(ROOT/'manifest.json').write_text(json.dumps([{'number':n,'file':f'question-{n}.webp','width':W,'height':H,'bytes':(ROOT/f'question-{n}.webp').stat().st_size} for n in range(1,26)],indent=2))
