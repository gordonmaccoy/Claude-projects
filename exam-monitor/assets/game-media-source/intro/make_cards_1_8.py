"""Eight independent original material/prop illustrations, built from geometry and font masks.
No source artwork, external images, or network inputs. Pillow + numpy.
"""
from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageChops
import numpy as np, random, math, json
from pathlib import Path
P=Path(__file__).parent; W,H=1024,768
SANS='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';SERIF='/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
y,x=np.mgrid[0:H,0:W];rng=random.Random(781)
def gradient(a,b,vertical=True):
 t=(y/H if vertical else x/W)[...,None];return Image.fromarray(np.uint8(np.array(a)*(1-t)+np.array(b)*t))
def digit(n,size=600,font=SANS,pos=None):
 m=Image.new('L',(W,H));d=ImageDraw.Draw(m);f=ImageFont.truetype(font,size);bb=d.textbbox((0,0),str(n),font=f);xx=(W-bb[2]+bb[0])/2-bb[0];yy=(H-bb[3]+bb[1])/2-bb[1];d.text(pos or (xx,yy),str(n),font=f,fill=255);return m
def shift(m,dx,dy):
 out=Image.new('L',m.size);out.paste(m,(dx,dy));return out
def shadow(im,m,dx=18,dy=24,blur=16,color=(0,0,0),opacity=.35):
 mm=shift(m,dx,dy).filter(ImageFilter.GaussianBlur(blur)).point(lambda v:int(v*opacity));im.paste(color,(0,0),mm)
def outline(m,width):return ImageChops.subtract(m.filter(ImageFilter.MaxFilter(width*2+1)),m)
def save(n,im):
 im.save(P/f'question-{n}.webp','WEBP',quality=88,method=6)
 if (P/f'question-{n}.webp').stat().st_size>120000:im.save(P/f'question-{n}.webp','WEBP',quality=76,method=6)
 assert (P/f'question-{n}.webp').stat().st_size<=120000
# 1: folded iridescent foil. Angular metallic planes live inside a free-standing numeral.
m=digit(1,650);im=gradient((57,72,112),(93,56,106));shadow(im,m,22,30,14,(53,60,85),.35)
t=.5+.5*np.sin(x/67+y/91);c=np.stack([165+75*np.sin(x/96+y/127)**2,170+78*np.cos(x/145-y/73)**2,195+59*np.sin(x/81-y/116)**2],2);foil=Image.fromarray(np.uint8(c));fd=ImageDraw.Draw(foil)
for pts,col in [([(240,80),(590,140),(390,400)],(245,253,255)), ([(590,140),(760,380),(390,400)],(123,160,199)), ([(390,400),(760,380),(620,690)],(209,185,247)), ([(390,400),(240,680),(620,690)],(173,241,221))]:fd.polygon(pts,fill=col)
for pts in [[(240,80),(390,400),(620,690)],[(590,140),(390,400),(760,380)]]:fd.line(pts,fill=(250,255,255),width=5)
im.paste(foil,(0,0),m);im.paste((255,255,255),(0,0),outline(m,2));d=ImageDraw.Draw(im)
for cx,cy in [(780,200),(260,530)]:d.line((cx-18,cy,cx+18,cy),fill='white',width=3);d.line((cx,cy-18,cx,cy+18),fill='white',width=3)
save(1,im)
# 2: a tall lacquered theatre placard, coral enamel and brass corner hardware.
im=gradient((27,23,55),(74,29,62));d=ImageDraw.Draw(im)
for k in range(18):d.line((k*64,0,k*64-90,H),fill=(60,30,66),width=22)
plate=Image.new('L',(W,H));pd=ImageDraw.Draw(plate);pd.rounded_rectangle((268,58,756,714),radius=34,fill=255);shadow(im,plate,20,25,18,(0,0,0),.5)
d=ImageDraw.Draw(im);d.rounded_rectangle((268,58,756,714),radius=34,fill='#e26755',outline='#ffca76',width=12);d.rounded_rectangle((291,81,733,691),radius=20,outline='#9a343c',width=6)
for cx,cy in [(305,96),(719,96),(305,674),(719,674)]:d.ellipse((cx-7,cy-7,cx+7,cy+7),fill='#fce4ab');d.line((cx-4,cy,cx+4,cy),fill='#916548',width=2)
m=digit(2,560,SERIF);shadow(im,m,5,7,0,(108,42,42),.9);im.paste('#fff1c2',(0,0),m)
d=ImageDraw.Draw(im);d.arc((318,110,706,165),190,350,fill='#ffb890',width=5);d.line((335,637,689,637),fill='#ffc477',width=4);save(2,im)
# 3: chunky teal yarn loops knitted into the numeral, loose yarn at the bottom.
im=gradient((251,231,186),(237,204,155));d=ImageDraw.Draw(im)
for yy in range(0,H,9):d.line((0,yy,W,yy),fill='#efdab1',width=1)
m=digit(3,650);shadow(im,m,12,16,9,(93,93,61),.35);fabric=Image.new('RGB',(W,H),'#116d70');fd=ImageDraw.Draw(fabric)
for yy in range(0,H,21):
 for xx in range(-20,W,25):
  fd.line((xx,yy,xx+10,yy+17,xx+22,yy),fill='#58bbb0',width=7);fd.line((xx+2,yy,xx+10,yy+13),fill='#9bddd0',width=2)
im.paste(fabric,(0,0),m);d=ImageDraw.Draw(im);d.arc((618,571,828,717),0,210,fill='#238e8d',width=9);d.ellipse((767,644,843,720),fill='#2b9794')
for j in range(6):d.arc((768+j*5,646,841-j*3,718),40,310,fill='#81cfc0',width=3)
save(3,im)
# 4: asymmetric layered cut-paper enamel patch, no round badge.
im=gradient((237,241,240),(194,219,228));d=ImageDraw.Draw(im)
for i in range(9):d.line((i*170-380,768,i*170+200,0),fill='#dde7e9',width=22)
pts=[(230,145),(701,68),(837,493),(650,690),(215,611),(160,330)];mask=Image.new('L',(W,H));ImageDraw.Draw(mask).polygon(pts,fill=255);shadow(im,mask,17,24,7,(30,49,76),.3);d=ImageDraw.Draw(im);d.polygon(pts,fill='#152d5c');d.line(pts+[pts[0]],fill='#e8b945',width=14);d.polygon([(248,167),(686,92),(808,482),(636,663),(238,590),(186,337)],fill='#ff8554');d.polygon([(238,590),(186,337),(248,167),(288,284),(295,539)],fill='#ee6246');m=digit(4,580);shadow(im,m,6,8,0,(28,46,84),1);im.paste('#fff5cf',(0,0),m);d=ImageDraw.Draw(im);d.line((673,532,722,518),fill='#fff5cf',width=8);d.line((679,550,730,535),fill='#fff5cf',width=8);save(4,im)
# 5: raspberry jelly sweet with thick candy edge and hand-scattered sprinkles.
im=gradient((255,235,248),(233,220,255));m=digit(5,650);shadow(im,m,12,22,18,(110,36,99),.28);edge=m.filter(ImageFilter.MaxFilter(17));im.paste('#bd1e70',(0,0),shift(edge,0,10));jelly=gradient((255,139,184),(229,42,120));im.paste(jelly,(0,0),m);shine=ImageChops.subtract(m,shift(m,7,10));im.paste('#ffcee2',(0,0),shine)
d=ImageDraw.Draw(im)
for k in range(100):
 cx=rng.randint(270,755);cy=rng.randint(120,650)
 if m.getpixel((cx,cy))>250:
  col=rng.choice(['#fff8cc','#8be7ef','#c5f190','#ffe293']);ang=rng.random()*math.pi;d.line((cx,cy,cx+math.cos(ang)*12,cy+math.sin(ang)*12),fill=col,width=4)
d.ellipse((190,525,228,563),fill='#e67db8');d.ellipse((800,155,828,183),fill='#a09ce2');save(5,im)
# 6: luminous arcade numeral, open neon tube tracing, fading perspective grid.
im=gradient((10,14,49),(35,12,69));d=ImageDraw.Draw(im)
for yy in [550,580,620,675,745]:d.line((0,yy,W,yy),fill='#50336e',width=2)
for xx in range(-600,1700,190):d.line((512,470,xx,768),fill='#493d78',width=2)
m=digit(6,650);tube=ImageChops.subtract(m,m.filter(ImageFilter.MinFilter(23)));glow=tube.filter(ImageFilter.GaussianBlur(19));im.paste('#6450c5',(0,0),glow);im.paste('#4ca6e4',(0,0),tube.filter(ImageFilter.GaussianBlur(7)));neon=gradient((57,248,246),(255,86,217));im.paste(neon,(0,0),tube);core=ImageChops.subtract(m.filter(ImageFilter.MinFilter(7)),m.filter(ImageFilter.MinFilter(13)));im.paste('#ebfaff',(0,0),core);d=ImageDraw.Draw(im)
for cx,cy in [(215,180),(780,500),(760,140)]:d.ellipse((cx-3,cy-3,cx+3,cy+3),fill='#a2f8ff')
save(6,im)
# 7: freestanding amber marquee seven, warm bulbs, dark peacock backdrop.
im=gradient((17,65,70),(8,30,44));d=ImageDraw.Draw(im)
for k in range(12):d.line((512,760,k*140-280,0),fill='#174b52',width=6)
m=digit(7,650);shadow(im,m,19,23,10,(1,12,23),.6);im.paste('#9d461a',(0,0),shift(m.filter(ImageFilter.MaxFilter(17)),9,10));im.paste('#ed9b31',(0,0),m);inner=m.filter(ImageFilter.MinFilter(25));im.paste('#a74d1c',(0,0),inner)
bulbs=[]
for yy in range(170,620,32):
 for xx in range(300,750,32):
  if inner.getpixel((xx,yy))>250:bulbs.append((xx,yy))
glow=Image.new('L',(W,H));gd=ImageDraw.Draw(glow)
for cx,cy in bulbs:gd.ellipse((cx-9,cy-9,cx+9,cy+9),fill=220)
im.paste('#f6b642',(0,0),glow.filter(ImageFilter.GaussianBlur(8)));d=ImageDraw.Draw(im)
for cx,cy in bulbs:d.ellipse((cx-7,cy-7,cx+7,cy+7),fill='#ffe6a0');d.ellipse((cx-3,cy-4,cx+3,cy+2),fill='#fffdf0')
save(7,im)
# 8: purple lacquer game token with integral cream numeral, not a black pool ball.
im=gradient((22,95,94),(9,52,66));d=ImageDraw.Draw(im);d.ellipse((220,585,810,696),fill='#123e4d');d.ellipse((238,130,786,678),fill='#351b63');d.ellipse((230,94,778,642),fill='#9566d8',outline='#b998f1',width=10)
for r in range(258,0,-1):
 t=r/258;c=(int(138-45*(1-t)),int(85-37*(1-t)),int(207-46*(1-t)));d.ellipse((504-r,368-r,504+r,368+r),fill=c)
d.arc((253,116,755,618),185,287,fill='#dabdff',width=12);d.arc((272,135,735,598),20,93,fill='#623aa3',width=15)
m=digit(8,500);shadow(im,m,3,5,1,(51,30,87),.9);im.paste('#fff5d9',(0,0),m);d=ImageDraw.Draw(im);d.ellipse((315,170,357,187),fill='#dfcaff');save(8,im)
contact=Image.new('RGB',(1024,384),'white')
for n in range(1,9):
 pic=Image.open(P/f'question-{n}.webp');pic.thumbnail((256,192));contact.paste(pic,(((n-1)%4)*256,((n-1)//4)*192))
contact.save(P/'contact-sheet.jpg',quality=92)
(P/'manifest.json').write_text(json.dumps([{'number':n,'file':f'question-{n}.webp','bytes':(P/f'question-{n}.webp').stat().st_size,'width':W,'height':H} for n in range(1,9)],indent=2))
