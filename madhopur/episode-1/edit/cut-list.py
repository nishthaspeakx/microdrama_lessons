import os, sys
sys.path.insert(0, os.environ["DRAMA_SKILL_SCRIPTS"])
from edlkit import Run, save

R = "edit"
r = Run(R)
seg = lambda c, a, b, **kw: dict(clip=c, **{"in": a, "out": b}, **kw)

card_style = dict(
    font="Cormorant Garamond", weight=600, italic=False, size=100, upper=True, track=8,
    fill=[246, 238, 220], shadow="soft",
    caption_font="Cormorant Garamond", caption_weight=500, caption_size=76, caption_fill=[226, 190, 120],
    caption_upper=True, caption_track=10,
    rule="accent", rule_width=0.35, rule_size=4, rule_color=[226, 190, 120],
    align="left", y=0.74, shade=0.25,
)

segments = [
    seg("c1", r.start("c1"), 1.25, note="air: the market street reads in a second; out at 1.25 so the fireball is on screen before the third second, as the brief asks; picture 07b3: a still wide of the street with walkers, read at 1.1 s, kept short on purpose for the three-second fireball"),
    seg("c1", 1.875, r.dur("c1"), note="Meera looks up, the fireball, the rattling glass, her parents' wave, her wave, the dust wall, her face in the dust: each short shot is one step of the impact, all whole"),
    seg("c2", r.start("c2"), 7.0, note="join: c2 opens behind Meera on the thinning dust, a new angle on the empty stalls and not a repeat of c1's dust wall, both kept; her line and the rattling shutter whole; air: her walk along the shopfront has read by 7.0; picture 424e: one step of her walk in profile, 1.46 s is the step, the next shot is her close"),
    seg("c2", 7.708, r.dur("c2"), note="the close on her eyes ends the bazaar"),
    seg("c3", r.start("c3"), 1.6, note="air: the still maize and the post read in a second and a half"),
    seg("c3", 2.667, 13.5, note="Yash through the maize, the boy at the post, his line, Yash's walk to him, all whole; air: the wide on the post is still after 13.5"),
    seg("c3", 13.875, 17.3, note="Yash's arm comes up and the light wipes the picture: the flash is the cut point; out at 17.3 on the near-white frame, before the roar's last burst at 17.5-17.8, so the cut does not chop it; picture 9e15: the boy shielding his face as the light washes out, 1.3 s to near white is the whole beat"),
    seg("c4", r.start("c4"), 1.75, trans="flash", note="join: a scene change out of the white-out, entered through the flash; the road's first second is still, so the pickup's approach is kept to 1.6 s"),
    seg("c4", 2.542, r.dur("c4"), note="the cab, the streak, the brake, the ditch, the jolt, Suman slumped: short shots, all whole so the crash stays clear"),
    seg("c5", r.start("c5"), 14.25, note="join: c5 opened on c4's last frame again, starts after the repeat at 0.167; the truck in the ditch from outside is a new angle with the dust settled, not the crash again, kept; Suman's line whole; air: the boy's look up has read by 14.25; join: the 0.21 s sliver of Devendra climbing out at 14.54 is cut on its shot change"),
    seg("c6", r.start("c6"), 2.0, note="air: Devendra's look past the boy has read by 2.0"),
    seg("c6", 2.875, r.dur("c6"), note="the trail, the craft, Devendra, the open hatch, Suman's look: the reveal, whole"),
    seg("c7", r.start("c7"), 1.7, note="join: c7 opens from the craft's side looking back at the three, a new angle; air: nothing moves after 1.7"),
    seg("c7", 2.9, r.dur("c7"), note="join: Devendra's close is the shot of his line, not c6's look again, entered 0.6 s before the word; Suman, the boy's two hands, her look down, his look up and her face held whole: the episode ends on her face"),
    dict(black=1.0, note="the script's Cut to black"),
]
cards = [
    dict(type="time", at=["c1", 0.2], dur=1.0, text="2014", pos="high"),
    dict(type="name", at=["c1", 1.95], dur=1.4, name="Young Meera"),
    dict(type="name", at=["c4", 2.6], dur=1.05, name="Devendra", align="left"),
    dict(type="name", at=["c4", 3.78], dur=1.15, name="Suman", align="right"),
]
edl = dict(run=R, card_style=card_style, pace="breathing", ending="cut", segments=segments, cards=cards, sfx=[], subtitles=True)
if __name__ == "__main__":
    print(save(edl))
