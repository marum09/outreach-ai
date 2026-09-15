"""Generates a 2-week batch of branded stat cards for the RealtyReach IG account.

Every stat below is verified (sources in outreach-ai/zero-budget-plan.md and
the sales research): Dealmachine/First Page Sage 2026, HBR, NAR, Leadsuite 2026.
Run: python3 make_batch.py
"""
from PIL import Image, ImageDraw, ImageFont

W = H = 1080
BG = (10, 10, 11)
LIME = (214, 255, 63)
TXT = (244, 244, 245)

BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
bold = ImageFont.truetype(BOLD, 66)
brand = ImageFont.truetype(BOLD, 36)


def wrap(text, font, maxw):
    out, cur = [], []
    for w in text.split():
        t = " ".join(cur + [w])
        if font.getlength(t) > maxw:
            out.append(" ".join(cur))
            cur = [w]
        else:
            cur.append(w)
    if cur:
        out.append(" ".join(cur))
    return out


def card(idx, lines, punch=None):
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
            y += 90

    if punch:
        y += 20
        for chunk in wrap(punch, bold, 900):
            d.text((90, y), chunk, font=bold, fill=LIME)
            y += 90

    d.text((92, 960), "- RealtyReach", font=brand, fill=LIME)
    img.save(f"/home/user/outreach-ai/ig/batch/post-{idx:02d}.png")
    print(f"post-{idx:02d}.png")


CARDS = [
    (["Leads contacted within", "5 minutes are", "21x more likely to qualify."], "Your speed is your commission."),
    (["78% of buyers work with", "the FIRST agent", "who responds."], None),
    (["The average agent takes", "15+ hours to answer", "a web lead."], "Be the 5-minute agent."),
    (["5 touches in 10 days", "converts 40% of the leads", "who never replied."], None),
    (["The median agent spends", "$8,010 a year", "on marketing."], "Follow-up is the free half."),
    (["67% of homebuyers now", "start their search", "with an AI tool."], None),
    (["Portal leads close", "at 0.4 - 1.2%."], "Follow-up is the difference."),
    (["Referrals close", "at 14 - 20%."], "Old leads are referrals you haven't made yet."),
    (["CRM users convert", "29 - 41% better."], "If they actually follow up."),
    (["Expired listings sell", "at a 20.7% rate."], "The follow-up market is wide open."),
    (["Renters become buyers.", "Buyers become sellers.", "Sellers refer friends."], "One follow-up starts all of it."),
    (["One lead's details in.", "Three emails out.", "Ten seconds."], "That's the whole product."),
]

import os
os.makedirs("/home/user/outreach-ai/ig/batch", exist_ok=True)
for i, (lines, punch) in enumerate(CARDS, start=3):  # 01-02 already exist
    card(i, lines, punch)
print("batch done:", len(CARDS), "cards")
