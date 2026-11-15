"""Draw a new 15 using only font outlines and original geometric lighting."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

w, h = 620, 470
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 352)
mask = Image.new('L', (w, h))
d = ImageDraw.Draw(mask)
box = d.textbbox((0, 0), "15", font=font)
d.text(((w-(box[2]-box[0]))/2, (h-(box[3]-box[1]))/2-box[1]-14), "15", fill=255, font=font)
mask = mask.transform((w, h), Image.Transform.AFFINE, (1, -.11, 22, 0, 1, 0), Image.Resampling.BICUBIC)
out = Image.new('RGBA', (w,h))
def layer(m, color, x=0, y=0):
    image = Image.new('RGBA',(w,h),color)
    alpha = Image.new('L',(w,h))
    alpha.paste(m,(x,y))
    image.putalpha(alpha)
    out.alpha_composite(image)
layer(mask.filter(ImageFilter.GaussianBlur(14)).point(lambda v: 3*v//5), '#0e2f69', 14, 20)
for depth in range(31, -1, -1):
    layer(mask,(6+depth//5,52+depth,113+depth),depth,depth*2//3)
layer(mask.filter(ImageFilter.MaxFilter(9)), '#c5fbff')
gradient=Image.new('RGBA',(w,h))
lines=ImageDraw.Draw(gradient)
for y in range(h):
    t=max(0,min(1,(y-75)/290))
    light=32 if 163<=y<=173 else 0
    lines.line((0,y,w,y), fill=(min(255,int(96*(1-t)+26*t)+light),min(255,int(226*(1-t)+91*t)+light),min(255,int(255*(1-t)+211*t)+light),255))
gradient.putalpha(mask)
out.alpha_composite(gradient)
out.crop(out.getbbox()).save(Path(__file__).resolve().parents[3] / 'public/game-intro/question-15.webp', quality=89, method=6)
