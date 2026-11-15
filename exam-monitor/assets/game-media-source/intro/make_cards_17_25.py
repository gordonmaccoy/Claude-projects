"""Original procedural Examio question-number illustrations (17–25)."""
from pathlib import Path
from random import Random
from math import sin, cos, pi
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageColor, ImageChops
P=Path(__file__).parent
W,H=1024,576
F=Path('/usr/share/fonts/truetype/dejavu')
R=Random(7294)
def font(name,size):return ImageFont.truetype(str(F/(name+'.ttf')),size)
def rgb(c):return ImageColor.getrgb(c)
def lerp(a,b,u):return tuple(round(x+(y-x)*u) for x,y in zip(a,b))
def base(a,b):
 im=Image.new('RGB',(W,H));d=ImageDraw.Draw(im)
 for y in range(H):d.line((0,y,W,y),lerp(rgb(a),rgb(b),y/(H-1)))
 return im
def mask(t,size=344,f='DejaVuSans-Bold',xy=(512,288),stroke=0):
 m=Image.new('L',(W,H));ImageDraw.Draw(m).text(xy,str(t),font=font(f,size),fill=255,stroke_width=stroke,anchor='mm');return m
def layer(im,col,m): im.paste(col,(0,0,W,H),m)
def expand(m,n):
 if not hasattr(m,"_expanded"): m._expanded={}
 if n not in m._expanded:m._expanded[n]=m.filter(ImageFilter.MaxFilter(n))
 return m._expanded[n]
def shift(m,x,y):
 out=Image.new('L',m.size);out.paste(m,(x,y));return out
def shadow(im,m,col='#142536',x=10,y=14,r=8):layer(im,col,shift(m,x,y).filter(ImageFilter.GaussianBlur(r)))
def polys(d,n,palette,shape=None):
 for j in range(n):
  x=R.randint(-15,W+15);y=R.randint(-15,H+15);sz=R.randint(8,28);a=R.random()*2*pi
  if shape=='sprinkle':
   d.line((x,y,x+sz*cos(a),y+sz*sin(a)),R.choice(palette),R.randint(5,11));continue
  points=[(x+sz*cos(a+i*2*pi/(3+j%3)),y+sz*sin(a+i*2*pi/(3+j%3))) for i in range(3+j%3)]
  d.polygon(points,fill=R.choice(palette))
def outline_mask(im,m,col,n):layer(im,col,expand(m,n))
def sheets(im,seed,opacity=25,n=3200,area=(0,0,W,H)):
 rd=Random(seed);d=ImageDraw.Draw(im,'RGBA');a,b,c,e=area
 for _ in range(n):
  x=rd.randrange(a,c);y=rd.randrange(b,e);v=rd.choice([0,255])
  d.point((x,y),fill=(v,v,v,rd.randint(4,opacity)))
def sticker(d,pts,col,depth=9):
 d.polygon([(x+7,y+depth) for x,y in pts],fill='#200d3564')
 d.polygon(pts,fill=col)
def out(im,n):
 for q in [84,77,70,57]:
  f=P/f'question-{n}.webp';im.save(f,quality=q,method=6)
  if f.stat().st_size<=120000:break
 assert f.stat().st_size<=120000,n
 return im
def seventeen():
 im=base('#fdeaf5','#fabebb');d=ImageDraw.Draw(im)
 d.polygon([(0,42),(371,0),(170,576),(0,576)],fill='#f5a3ce')
 d.polygon([(830,0),(1024,0),(1024,576),(815,576),(933,290)],fill='#b9ddbd')
 polys(d,136,['#59275c','#ea5a71','#d99b28','#53a88b','#fef4f3'],'sprinkle')
 d.rounded_rectangle((262,102,772,479),radius=38,fill='#a54569')
 d.rounded_rectangle((245,85,759,461),radius=38,fill='#fff8ed')
 sheets(im,17,25,5200,(250,125,750,412))
 m=mask(17,328,'DejaVuSans-BoldOblique');shadow(im,m,'#db7983',0,7,1);outline_mask(im,m,'#62274a',19);layer(im,'#f586a9',m)
 return im
def eighteen():
 im=base('#130f3e','#453157');d=ImageDraw.Draw(im,'RGBA')
 for l in range(12):
  a=(l*30+3)*pi/180;b=a+.24
  d.polygon([(510,295),(512+1050*cos(a),288+1050*sin(a)),(512+1050*cos(b),288+1050*sin(b))],fill=(255,250,237,10+l%2*17))
 for pts,c in [([(0,0),(227,0),(330,150),(0,219)],'#ee4054'), ([(810,0),(1024,0),(1024,210),(872,164)],'#0fc5aa'), ([(0,403),(237,468),(161,576),(0,576)],'#ffd42b'), ([(740,496),(1024,322),(1024,576),(670,576)],'#a368fe')]:sticker(d,pts,c)
 polys(d,92,['#f487c8','#72f4cb','#fff7d0','#24b4fd','#ffd642','#ff5c77'])
 m=mask(18,343,'DejaVuSans-BoldOblique');shadow(im,m);outline_mask(im,m,'#170f30',35);outline_mask(im,m,'#faf1e4',15);layer(im,'#ffcc22',m)
 return im
def nineteen():
 im=base('#384751','#182530');d=ImageDraw.Draw(im)
 d.rounded_rectangle((-176,20,1200,556),radius=175,outline='#242d35',width=143)
 d.rounded_rectangle((-176,20,1200,556),radius=175,outline='#f1eddb',width=4)
 d.rounded_rectangle((-93,94,1117,482),radius=103,outline='#f1eddb',width=4)
 for row in range(2):
  for j in range(27):
   x=92+j*32
   for y in (39,474):
    d.rectangle((x,y+row*32,x+31,y+row*32+31),fill=('#101720','#efeee7')[(row+j)%2])
 d.polygon([(239,114),(841,114),(805,472),(194,472)],fill='#050c17')
 d.polygon([(224,103),(827,103),(791,452),(181,452)],fill='#f5f3e8')
 d.polygon([(235,115),(813,115),(779,439),(194,439)],outline='#d32e42',width=13)
 for x,y in [(248,133),(794,133),(217,420),(765,420)]: d.ellipse((x-5,y-5,x+5,y+5),fill='#344254')
 m=mask(19,321,'DejaVuSans-BoldOblique',(500,288));layer(im,'#171c23',m)
 return im
def twenty():
 im=base('#0e9674','#174a52');d=ImageDraw.Draw(im,'RGBA')
 for k in range(24):
  x=R.randrange(W);y=R.randrange(H);r=R.randint(13,73)
  d.ellipse((x-r,y-r,x+r,y+r),fill=(123,253,183,29),outline=(145,255,194,90),width=3)
  d.arc((x-r+4,y-r+4,x+r-4,y+r-4),217,287,fill=(227,255,205,156),width=3)
 m=mask(20,337);shadow(im,expand(m,29),'#082b3e',3,21,15)
 for k in range(20,0,-1):layer(im,'#104e49',shift(expand(m,31),0,k))
 outline_mask(im,m,'#1a6f54',39);outline_mask(im,m,'#7ef4a0',29);outline_mask(im,m,'#38a875',13)
 gloss=base('#efffc0','#16ae54');gd=ImageDraw.Draw(gloss,'RGBA')
 for y in range(122,421):
  a=max(0,99-int(abs(y-222)*2.2));gd.line((0,y,W,y),fill=(240,255,226,a))
 layer(im,gloss,m)
 layer(im,'#d3ffdb',ImageChops.subtract(expand(m,9),shift(expand(m,7),0,2)).point(lambda v:v//3))
 return im
def twentyone():
 im=base('#151b20','#282d31');d=ImageDraw.Draw(im)
 for y in range(-18,H,34):d.line((0,y,W,y+7),fill='#343637',width=2)
 for x in range(-186,1024,62):
  d.polygon([(x,13),(x+27,13),(x+73,57),(x+46,57)],fill='#e6a426')
  d.polygon([(x,519),(x+27,519),(x+73,563),(x+46,563)],fill='#e6a426')
 d.rounded_rectangle((173,102,862,485),radius=24,fill='#0f141a')
 d.rounded_rectangle((157,86,846,465),radius=24,fill='#ffcb31')
 d.rounded_rectangle((171,100,832,451),radius=16,outline='#172121',width=7)
 for x in (194,809):
  for y in (125,427):
   d.ellipse((x-7,y-7,x+7,y+7),fill='#253128');d.line((x-4,y+3,x+4,y-3),fill='#f5d262',width=1)
 sheets(im,21,70,9400,(171,100,832,450))
 m=mask(21,329,'DejaVuSansMono-Bold',(507,288));layer(im,'#171c1b',m)
 d=ImageDraw.Draw(im)
 for y,w in [(224,11),(347,6)]:d.rectangle((288,y,719,y+w),fill='#ffca30')
 return im
def twentytwo():
 im=base('#adc9c8','#ecd29f');d=ImageDraw.Draw(im)
 d.ellipse((733,62,842,171),fill='#f2b96c')
 d.polygon([(0,339),(58,267),(180,222),(271,137),(421,264),(547,241),(693,152),(797,216),(881,279),(1024,221),(1024,576),(0,576)],fill='#78928c')
 d.polygon([(0,370),(231,302),(399,355),(600,207),(798,316),(1024,313),(1024,576),(0,576)],fill='#506962')
 d.polygon([(381,576),(509,365),(559,371),(701,576)],fill='#444b4a')
 for p in [[(523,383),(530,382),(533,407),(525,407)],[(523,476),(541,476),(549,528),(520,529)]]:d.polygon(p,fill='#e6c77b')
 d.rectangle((301,313,328,510),fill='#58635b');d.rectangle((701,313,728,510),fill='#58635b')
 d.polygon([(243,106),(767,106),(818,164),(818,410),(767,455),(243,455),(207,410),(207,164)],fill='#344542')
 d.polygon([(238,95),(760,95),(806,154),(806,399),(760,443),(238,443),(193,399),(193,154)],fill='#f1e6bd')
 d.polygon([(246,107),(755,107),(793,159),(793,390),(752,430),(246,430),(208,390),(208,159)],fill='#385149')
 for x in (236,767):
  for y in (154,378):d.ellipse((x-5,y-5,x+5,y+5),fill='#d5d09e')
 m=mask(22,304,'DejaVuSerif-Bold',(500,272));layer(im,'#fbebac',m)
 return im
def twentythree():
 im=base('#682a22','#321b21');d=ImageDraw.Draw(im,'RGBA')
 for p in [[(0,520),(454,0),(598,0),(110,576),(0,576)],[(692,576),(1024,142),(1024,311),(835,576)]]:
  d.polygon(p,fill=(255,152,94,52))
 d.rounded_rectangle((204,106,847,490),radius=8,fill='#211821')
 d.polygon([(213,93),(843,111),(821,476),(195,453)],fill='#e8a361')
 for k in range(4):
  off=k*4
  d.line((228+off,114+off,823-off,130+off,803-off,452-off,216+off,432-off,228+off,114+off),fill='#bd6b42',width=1)
 sheets(im,23,155,27000,(218,120,802,424))
 m=mask(23,333,'DejaVuSans-BoldOblique')
 shadow(im,m,'#9b4d2d',2,6,1)
 layer(im,'#6b2525',m)
 d=ImageDraw.Draw(im)
 d.line((314,229,720,219),fill='#e0a36f',width=8)
 d.line((298,368,702,363),fill='#e7a361',width=8)
 for i in range(200):
  x=R.randrange(255,765);y=R.randrange(150,420)
  if m.getpixel((x,y))>100:d.line((x,y,x+R.randint(1,9),y+1),fill=R.choice(['#d48b52','#f6b674','#b6673a']),width=R.randint(1,3))
 return im
def twentyfour():
 im=base('#342321','#110f16');d=ImageDraw.Draw(im)
 d.rounded_rectangle((151,74,873,503),radius=38,fill='#533c2f',outline='#966642',width=2)
 d.rounded_rectangle((165,89,858,487),radius=27,fill='#181616',outline='#a0704e',width=3)
 for y in range(108,466,7):d.line((192,y,832,y),fill='#231d19')
 for x in [180,844]:
  for y in [107,469]:d.ellipse((x-4,y-4,x+4,y+4),fill='#a78360')
 m=Image.new('L',(W,H));md=ImageDraw.Draw(m)
 def bars(cx,idx):
  top=126;w=148;ht=135;t=25;l=cx-w//2;r=cx+w//2;mid=top+ht+20;bot=top+2*ht+40
  hor=lambda y:[(l+15,y),(r-15,y),(r,y+t//2),(r-15,y+t),(l+15,y+t),(l,y+t//2)]
  vert=lambda x,y:[(x,y+14),(x+t//2,y),(x+t,y+14),(x+t,y+ht-14),(x+t//2,y+ht),(x,y+ht-14)]
  shapes=[hor(top),vert(r-3,top+18),vert(r-3,mid+14),hor(bot),vert(l-t+4,mid+14),vert(l-t+4,top+18),hor(mid)]
  for k,shape in enumerate(shapes):
   d.polygon(shape,fill='#3a2e26')
   if k in idx:md.polygon(shape,fill=255)
 bars(403,[0,1,6,4,3]);bars(622,[5,1,6,2])
 layer(im,'#4d2918',expand(m,43).filter(ImageFilter.GaussianBlur(15)))
 layer(im,'#a24f1c',expand(m,19).filter(ImageFilter.GaussianBlur(6)))
 layer(im,'#f79a32',expand(m,5));layer(im,base('#fff9cc','#ff921e'),m)
 return im
def twentyfive():
 im=base('#122e3a','#071d2b');d=ImageDraw.Draw(im,'RGBA')
 for r in range(113,630,24):
  d.arc((512-r,288-r*.69,512+r,288+r*.69),201,355,fill=(78,214,173,29),width=2)
  d.arc((512-r,288-r*.69,512+r,288+r*.69),18,162,fill=(78,214,173,34),width=1)
 for x,y,sz in [(142,190,47),(865,361,64),(882,107,24),(178,441,22),(841,181,10),(249,110,12)]:
  d.polygon([(x,y-sz),(x+sz*.13,y-sz*.13),(x+sz,y),(x+sz*.13,y+sz*.13),(x,y+sz),(x-sz*.13,y+sz*.13),(x-sz,y),(x-sz*.13,y-sz*.13)],fill='#befbe4')
 m=mask(25,335,'DejaVuSans-BoldOblique');shadow(im,expand(m,27),'#030f24',7,20,10)
 for j in range(20,0,-1):layer(im,'#0c5148',shift(expand(m,29),j//2,j))
 outline_mask(im,m,'#04392e',33);outline_mask(im,m,'#61f6b4',27);outline_mask(im,m,'#074f49',15)
 chrome=Image.new('RGB',(W,H));gd=ImageDraw.Draw(chrome)
 stops=[(0,'#0e855c'),(168,'#30aa74'),(207,'#e1fff3'),(223,'#48ce98'),(273,'#149464'),(282,'#064732'),(293,'#89ffca'),(313,'#238a66'),(405,'#05392f'),(432,'#8ef8b3'),(H,'#11403b')]
 for i in range(len(stops)-1):
  (y,a),(yy,b)=stops[i:i+2]
  for z in range(y,yy):gd.line((0,z,W,z),fill=lerp(rgb(a),rgb(b),(z-y)/(yy-y)))
 layer(im,chrome,m)
 return im
images=[out(fn(),i) for i,fn in enumerate([seventeen,eighteen,nineteen,twenty,twentyone,twentytwo,twentythree,twentyfour,twentyfive],17)]
preview=Image.new('RGB',(930,565),'#152237')
for i,img in enumerate(images):
 img.thumbnail((300,169),Image.Resampling.LANCZOS);preview.paste(img,(10+i%3*307,10+i//3*182))
preview.save(P/'contact-sheet.jpg',quality=87)
