"""Original number cards. Procedural geometry, DejaVu font outlines; no imported imagery."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops, ImageColor
import numpy as np
from math import sin,cos,pi
import random
N=600
OUT=Path(__file__).resolve().parent
D='/usr/share/fonts/truetype/dejavu/'
B=D+'DejaVuSans-Bold.ttf'
C=D+'DejaVuSansCondensed-Bold.ttf'
S=D+'DejaVuSerif-Bold.ttf'
R=random.Random(20261416)
YY,XX=np.mgrid[0:N,0:N]

def transparent():return Image.new('RGBA',(N,N))
def rgb(c):return tuple(ImageColor.getrgb(c)) if isinstance(c,str) else c
def blank():return Image.new('L',(N,N))
def glyph(t,font=B,w=445,h=340,x=300,y=292,spacing=None):
    font=ImageFont.truetype(font,size=480)
    im=Image.new('L',(1500,700));d=ImageDraw.Draw(im)
    if spacing is None:d.text((26,21),t,font=font,fill=255)
    else:
        pos=26
        for c in t:
            d.text((pos,21),c,font=font,fill=255);pos+=d.textlength(c,font=font)+spacing
    im=im.crop(im.getbbox());im=im.resize((w,h),Image.Resampling.LANCZOS)
    dst=blank();dst.paste(im,(x-w//2,y-h//2));return dst

def shift(m,x,y):
    o=Image.new(m.mode,m.size);o.paste(m,(x,y));return o
def dilate(m,n):return m.filter(ImageFilter.MaxFilter(n*2+1))
def erode(m,n):return m.filter(ImageFilter.MinFilter(n*2+1))
def cut(m,n):return ImageChops.subtract(m,n)
def merge(a,b):return ImageChops.lighter(a,b)
def overlay(a,b):a.alpha_composite(b)
def flat(im,color,mask,opacity=255):
    pic=Image.new('RGBA',im.size,(*rgb(color),255));pic.putalpha(mask if opacity==255 else mask.point(lambda n:n*opacity//255));overlay(im,pic)
def solid(m,c):
    im=transparent();flat(im,c,m);return im
def gradient(im,mask,stops,coord=YY):
    xp=[a for a,c in stops]
    v=np.stack([np.interp(coord,xp,[rgb(c)[i] for a,c in stops]) for i in range(3)],axis=-1).astype('uint8')
    fill=Image.fromarray(v,'RGB').convert('RGBA');fill.putalpha(mask);overlay(im,fill)
def shine(im,mask,inner='white',edge=6,alpha=220):
    rim=cut(mask,shift(erode(mask,edge),3,5))
    flat(im,inner,rim,alpha)
def shadow(im,m,x=6,y=14,r=13,opacity=200):
    flat(im,'#061027',shift(m,x,y).filter(ImageFilter.GaussianBlur(r)),opacity)
def stroke(d,pts,c,w=1):
    d.line(pts,fill=c,width=w,joint='curve')
def star(d,cx,cy,w,col):
    d.polygon([(cx+cos(pi*i/4)*w*(1 if i%2==0 else .23),cy+sin(pi*i/4)*w*(1 if i%2==0 else .23)) for i in range(8)],fill=col)
def cubic(p0,p1,p2,p3,n=66):
    return [(sum(c*q[0] for c,q in zip(((1-t)**3,3*(1-t)**2*t,3*(1-t)*t*t,t**3),(p0,p1,p2,p3))),sum(c*q[1] for c,q in zip(((1-t)**3,3*(1-t)**2*t,3*(1-t)*t*t,t**3),(p0,p1,p2,p3)))) for t in np.linspace(0,1,n)]

def card9():
    im=transparent();m=glyph('9',B,320,395,y=286);board=dilate(m,11)
    shadow(im,board,8,21,12);flat(im,'#5a478e',shift(board,10,14));flat(im,'#fff0cd',board)
    base=Image.new('RGBA',(N,N),'#433a69'); d=ImageDraw.Draw(base)
    colors=['#fca730','#f668aa','#58d9cb','#ffdc48','#735edc','#fb7659','#137db4','#cadb52','#fa91dc','#f68c30']
    cells=[[(x+R.uniform(-8,8),y+R.uniform(-8,8)) for x in range(78,554,46)] for y in range(53,558,44)]
    for row in range(len(cells)-1):
        for col in range(len(cells[row])-1):
            a,b= cells[row][col:col+2];f,e=cells[row+1][col:col+2]
            for j,p in enumerate([(a,b,e),(a,e,f)] if (row+col)%2 else [(a,b,f),(f,b,e)]):
                coords=[(x*.87+sum(q[0] for q in p)/3*.13,y*.87+sum(q[1] for q in p)/3*.13) for x,y in p]
                color=colors[(row*7+col*3+R.randrange(5))%len(colors)]
                d.polygon(coords,fill=color)
                d.line(coords[:2],fill='#fff0bb',width=1)
                q=coords[0];d.line([(q[0]+3,q[1]+3),(q[0]+6,q[1]+5)],fill='#fffae1',width=2)
    mask=ImageChops.multiply(m,base.getchannel('A'));base.putalpha(mask);overlay(im,base)
    flat(im,'#633d7d',cut(dilate(m,2),m),180)
    shine(im,m,'#fff6c3',1,165)
    d=ImageDraw.Draw(im)
    for x,y,w,c in [(100,143,18,'#ffcb59'),(102,403,10,'#47d7ce'),(486,108,12,'#fe8bd2'),(489,411,20,'#6de8d7'),(126,467,9,'#f68bae')]:
        star(d,x,y,w,c)
    return im

def card10():
    im=transparent();d=ImageDraw.Draw(im)
    # Organic string arcs and foil nozzle ties are drawn underneath the digits.
    for x,y,col,dark in [(182,454,'#8fdaff','#3c628f'),(427,458,'#fcc1ec','#8b4fac')]:
        string=cubic((x,y),(x-35,y+26),(x+37,y+54),(270 if x<300 else 359,570))
        stroke(d,string,dark,6);stroke(d,[(a-1,b) for a,b in string],col,2)
        d.polygon([(x,y-12),(x-15,y+12),(x+12,y+12)],fill=dark)
        d.line((x-11,y+12,x+9,y+12),fill=col,width=4)
    for digit,x,w,pat in [('1',183,170,['#5526ae','#964eff','#e9b5ff','#8146e1','#2e227f']),('0',399,221,['#0b6385','#2ecae4','#befff4','#25a8e0','#0c486c'])]:
        m=glyph(digit,C,w,319,x=x,y=289)
        # Smoothing the glyph's tips helps it read as welded, inflated foil.
        m=dilate(erode(dilate(m,10),6),2).filter(ImageFilter.GaussianBlur(1.0))
        shadow(im,m,4,11,9)
        outline=dilate(m,5);flat(im,pat[-1],outline)
        grad=YY+sin(x)*.15*XX+(XX-x)*.23
        gradient(im,m,[(123,pat[0]),(174,pat[1]),(196,pat[2]),(227,pat[1]),(309,pat[0]),(365,pat[1]),(393,pat[2]),(465,pat[-1])],grad)
        # Inner edge is a lighter foil crimp; soft-ended reflections follow the rounded shell.
        flat(im,'#f1e8ff',cut(dilate(m,2),erode(m,2)),132)
        refl=blank();rd=ImageDraw.Draw(refl)
        rd.ellipse((x-w*.53,157,x-w*.07,226),fill=235)
        rd.ellipse((x+w*.14,350,x+w*.57,402),fill=165)
        refl=refl.filter(ImageFilter.GaussianBlur(11))
        flat(im,'#fffbed',ImageChops.multiply(refl,erode(m,7)),170)
        unlit=cut(m,shift(erode(m,8),-2,-2))
        flat(im,pat[-1],unlit,100)
    return im

def card11():
    im=transparent();badge=blank(); bd=ImageDraw.Draw(badge)
    outer=[(108,163),(300,103),(492,163),(475,414),(300,511),(125,414)]
    bd.polygon(outer,fill=255); shadow(im,badge,0,13,10); flat(im,'#241283',badge)
    panel=blank(); ImageDraw.Draw(panel).polygon([(121,173),(300,118),(479,173),(463,405),(300,494),(137,405)],fill=255)
    gradient(im,panel,[(120,'#fcbd62'),(243,'#e98531'),(490,'#b94832')])
    d=ImageDraw.Draw(im)
    stroke(d,outer+[outer[0]],'#e8eeff',7)
    for x in range(149,470,28):
        stroke(d,[(x,184),(x,402)],'#ed984f',2)
    d.arc((165,180,435,400),205,335,fill='#ffe9c0',width=6)
    d.arc((184,281,416,471),21,148,fill='#ffe9c0',width=6)
    d.ellipse((251,215,349,312),outline='#ffecce',width=5)
    d.line((142,263,458,263),fill='#ffecce',width=4)
    # Number plate, rather than a copy of any team logotype.
    plate=blank(); ImageDraw.Draw(plate).rounded_rectangle((131,216,469,392),30,fill=255)
    flat(im,'#16265a',shift(plate,0,8)); flat(im,'#442aa3',plate);flat(im,'#ecd9ff',cut(plate,erode(plate,4)))
    m=glyph('11',B,235,132,y=300,spacing=-37)
    flat(im,'#27156d',shift(dilate(m,3),0,6));gradient(im,m,[(230,'#fffef8'),(360,'#fff0b2')])
    d=ImageDraw.Draw(im);star(d,300,160,17,'#ffecc2')
    for j in range(5):d.line((258+j*21,419,268+j*21,419),fill='#4e277e',width=4)
    return im

def card12():
    im=transparent();m=glyph('12',B,445,335,x=275,y=263,spacing=-40)
    shadow(im,shift(m,37,48),1,6,14)
    # Offset layers are solid inks with a differently colored front.
    layer_pairs=[(49,53,'#5718ae'),(44,47,'#7542e7'),(36,40,'#2b9fea'),(29,32,'#23d3c8'),(22,24,'#92de5a'),(15,16,'#ffd455'),(8,8,'#f59b61')]
    for x,y,c in layer_pairs:flat(im,'#341956',dilate(shift(m,x,y),5));flat(im,c,shift(m,x,y))
    flat(im,'#401e61',dilate(m,6))
    gradient(im,m,[(80,'#fff7fa'),(255,'#ffe7f1'),(428,'#ff9caa')],YY+XX*.07)
    shine(im,m,'#fffaf6',3,250)
    d=ImageDraw.Draw(im)
    for x,y,r in [(82,132,6),(492,100,16),(513,128,7),(125,482,12),(457,484,11)]:
        star(d,x,y,r,'#ffdf92' if x>400 else '#f9a4da')
    return im

def card13():
    im=transparent()
    panel=blank();d=ImageDraw.Draw(panel)
    d.rounded_rectangle((54,164,546,461),37,fill=255)
    d.polygon([(53,231),(78,202),(78,441),(53,413)],fill=255);d.polygon([(547,231),(522,202),(522,441),(547,413)],fill=255)
    d.ellipse((108,118,491,512), fill=255)
    shadow(im,panel,2,16,8)
    flat(im,'#173c36',shift(panel,0,11))
    gradient(im,panel,[(110,'#ffd991'),(300,'#ffe7b6'),(510,'#d79e66')])
    flat(im,'#246357',cut(erode(panel,5),erode(panel,13)))
    flat(im,'#f58070',cut(erode(panel,15),erode(panel,19)))
    m=glyph('13',S,347,232,y=315,spacing=-39)
    flat(im,'#4e3b36',dilate(shift(m,8,12),5))
    flat(im,'#116358',dilate(shift(m,5,8),4))
    flat(im,'#ffefbb',dilate(m,5))
    gradient(im,m,[(189,'#ff9477'),(280,'#f26962'),(440,'#b43343')])
    flat(im,'#fff1ba',cut(m,shift(erode(m,3),3,4)),185)
    d=ImageDraw.Draw(im)
    for x,y,sx in [(102,317,1),(498,317,-1)]:
        for j in range(3):
            d.arc((x-14-j*4,y-32-j*2,x+14+j*4,y+32+j*2),100 if sx==1 else -80,255 if sx==1 else 75,fill='#247064',width=2)
    for x,y in [(82,250),(519,250),(82,382),(519,382)]:
        d.ellipse((x-4,y-4,x+4,y+4),fill='#98694f')
        d.line((x-2,y-1,x+2,y+1),fill='#fceab4',width=1)
    star(d,300,166,20,'#2b806e');star(d,300,466,14,'#bd535a')
    return im

def led_digit(d,digit,x,y,s,on,off):
    w=115*s;h=200*s;t=17*s;b=9*s
    def hz(top):
        return [(x+t,y+top),(x+w-t,y+top),(x+w-t+b,y+top+t*.5),(x+w-t,y+top+t),(x+t,y+top+t),(x+t-b,y+top+t*.5)]
    def vt(left,top):
        return [(x+left,y+top+b),(x+left+t*.5,y+top),(x+left+t,y+top+b),(x+left+t,y+top+h*.39-b),(x+left+t*.5,y+top+h*.39),(x+left,y+top+h*.39-b)]
    paths=[hz(0),vt(w-t,17*s),vt(w-t,107*s),hz(183*s),vt(0,107*s),vt(0,17*s),hz(91*s)]
    patterns={'1':'bc','4':'bcfg'}
    for key,p in zip('abcdefg',paths): d.polygon(p,fill=on if key in patterns[digit] else off)

def card14():
    im=transparent();m=blank();d=ImageDraw.Draw(m);d.rounded_rectangle((45,122,555,472),49, fill=255)
    shadow(im,m,6,14,12)
    gradient(im,m,[(120,'#fc6a44'),(200,'#a82753'),(381,'#e0374a'),(472,'#660e33')])
    flat(im,'#ffcf64',cut(erode(m,5),erode(m,9)))
    trim=blank();ImageDraw.Draw(trim).rounded_rectangle((87,181,513,414),24,fill=255)
    flat(im,'#350e26',dilate(trim,6));flat(im,'#170c24',trim)
    glow=blank();d=ImageDraw.Draw(glow);led_digit(d,'1',150,202,.95,255,0);led_digit(d,'4',315,202,.95,255,0)
    flat(im,'#ff2549',glow.filter(ImageFilter.GaussianBlur(10)),229)
    d=ImageDraw.Draw(im);led_digit(d,'1',150,202,.95,'#ffe25b','#442537');led_digit(d,'4',315,202,.95,'#ffe25b','#442537')
    # Unbranded cabinet rails: light bulbs, and understated brushed fasteners.
    for y in [145,447]:
        for j,x in enumerate(range(92,511,33)):
            d.ellipse((x-7,y-7,x+7,y+7),fill='#75233c');d.ellipse((x-4,y-4,x+4,y+4),fill='#fff29b' if j%3!=1 else '#ff7a7c')
    for x in [62,538]:
        for y in [220,371]:
            d.ellipse((x-6,y-6,x+6,y+6),fill='#ffa683');d.line((x-3,y,x+3,y),fill='#612635',width=2)
    return im

def candle(im,digit,x,w,colors):
    m=glyph(digit,B,w,268,x=x,y=318)
    outline=dilate(m,5);shadow(im,outline,7,12,7)
    flat(im,colors[2],shift(outline,7,7));flat(im,'#8b3c67',outline)
    gradient(im,m,[(179,'#fff3bf'),(271,colors[0]),(414,colors[1]),(467,colors[2])])
    speck=transparent();d=ImageDraw.Draw(speck)
    for _ in range(135):
        a,b=R.uniform(x-w/2,x+w/2),R.uniform(174,454);r=R.uniform(1.3,5.0)
        d.ellipse((a-r,b-r,a+r,b+r),fill=R.choice(['#ffefaf','#fb589d','#6c78dc','#6affcc','#d47dd6']))
    speck.putalpha(ImageChops.multiply(speck.getchannel('A'),erode(m,4)));overlay(im,speck)
    shine(im,m,'#fff9df',3,205)

def flame(im,x,y,angle=0):
    aura=blank(); ImageDraw.Draw(aura).ellipse((x-36,y-48,x+36,y+58),fill=240)
    flat(im,'#ffc359',aura.filter(ImageFilter.GaussianBlur(19)),186)
    d=ImageDraw.Draw(im);stroke(d,[(x,y+56),(x+1,y+37),(x-3,y+26)],'#583241',5)
    path=cubic((x,y+37),(x+49,y+6),(x+12,y-32),(x+4+angle,y-38))+cubic((x+4+angle,y-38),(x+1,y-1),(x-39,y+7),(x,y+37))
    flame=blank();ImageDraw.Draw(flame).polygon(path,fill=255)
    gradient(im,flame,[(y-38,'#fffab2'),(y-8,'#ffd74c'),(y+36,'#ff721e')])
    d=ImageDraw.Draw(im);d.polygon(cubic((x+1,y+32),(x-16,y+10),(x+8,y+5),(x+5,y-10))+cubic((x+5,y-10),(x+21,y+10),(x+20,y+22),(x+1,y+32)),fill='#fff1a4')

def card16():
    im=transparent();d=ImageDraw.Draw(im)
    for x,y,r,c in [(103,180,7,'#ffd161'),(488,157,7,'#fe80b6'),(499,263,9,'#ffde59'),(107,349,9,'#6de9ca'),(507,423,8,'#a989eb'),(83,445,5,'#ee81c4')]:
        d.ellipse((x-r,y-r,x+r,y+r),fill=c)
    candle(im,'1',191,157,['#ffbce5','#f688bf','#b253a6'])
    candle(im,'6',391,224,['#b5fceb','#5bd4c5','#3298a7'])
    flame(im,197,129,4);flame(im,391,121,-2)
    d=ImageDraw.Draw(im)
    for x,y,v in [(115,216,1),(477,199,-1),(105,300,-1),(516,313,1),(122,485,1),(473,489,-1)]:
        stroke(d,[(x,y),(x+15*v,y+11)],'#ffdc59' if v==1 else '#8bf4d9',4)
    return im

def save(name,im):
    p=OUT/name
    for q in [90,86,82,77,71]:
        im.save(p,'WEBP',method=6,quality=q,alpha_quality=100)
        if p.stat().st_size<120_000:break
    assert p.stat().st_size<120_000
    print(p.name,p.stat().st_size)

if __name__=='__main__':
    cards=[(9,card9),(10,card10),(11,card11),(12,card12),(13,card13),(14,card14),(16,card16)]
    board=Image.new('RGB',(880,450),'#101e3d');t=ImageDraw.Draw(board)
    for i,(n,fn) in enumerate(cards):
        im=fn();save(f'question-{n}.webp',im)
        tile=im.resize((217,201),Image.Resampling.LANCZOS); x,y=i%4*220,i//4*225
        board.paste(tile,(x,y),tile);t.text((x+14,y+202),f'#{n}', font=ImageFont.truetype(B,13),fill='#c4d2f3')
    board.save(OUT/'contact-sheet.jpg',quality=91)
