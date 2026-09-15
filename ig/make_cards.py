"""Builds branded Instagram cards + profile pic for the RealtyReach brand account."""
from PIL import Image, ImageDraw, ImageFont

W = H = 1080
BG = (10, 10, 11)
LIME = (214, 255, 63)
TXT = (244, 244, 245)

BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

bold = ImageFont.truetype(BOLD, 68)
brand = ImageFont.truetype(BOLD, 36)


def wrap(text, font, maxw):
    out, cur = [], []
    for w in text.split():
        test = " ".join(cur + [w])
        if font.getlength(test) > maxw:
            out.append(" ".join(cur))
            cur = [w]
        else:
            cur.append(w)
    if cur:
        out.append(" ".join(cur))
    return out


def card(path, lines):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([90, 110, 230, 128], fill=LIME)

    y = 300
    for ln in lines:
        if ln == "":
            y += 40
            continue
        for chunk in wrap(ln, bold, 900):
            d.text((90, y), chunk, font=bold, fill=TXT)
            y += 92

    d.text((92, y + 40), "- RealtyReach", font=brand, fill=LIME)
    img.save(path)
    print("saved", path)


card(
    "/home/user/outreach-ai/ig/post-1.png",
    [
        "48% of real estate leads",
        "never get a follow-up.",
        "",
        "Yours won't be",
        "one of them.",
    ],
)

card(
    "/home/user/outreach-ai/ig/post-2.png",
    [
        "Your leads cost",
        "$20-$150 each.",
        "",
        "How many are sitting",
        "dead in your CRM?",
    ],
)

img = Image.new("RGB", (512, 512), LIME)
d = ImageDraw.Draw(img)
f = ImageFont.truetype(BOLD, 330)
d.text((96, 62), "R", font=f, fill=(10, 10, 11))
img.save("/home/user/outreach-ai/ig/profile.png")
print("saved profile.png")
