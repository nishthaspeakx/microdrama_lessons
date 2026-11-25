import json
J=json.load(open("v2jobs.json"))
LOOK="Framed on the rule of thirds, with a light anamorphic lens character: softly oval out-of-focus highlights in the background, and a fine 35mm film grain."
ST="Realism cinematic, real skin with pores and small marks, natural eyes, people and set lit only by this place's named sources: "
STYLE_B=ST+"the afternoon sun high on the left, falling hard across the street and onto the faces, the shopfronts under their awnings in shade; dusty gold highlights, warm natural colour; fine dust hanging in the air."
STYLE_F=ST+"the low golden sun behind right, backlighting the maize leaves and rimming the hair, the spaces between the rows in soft shadow; warm natural colour with saturated, believable greens; dust drifting in the air."
LANG="All speech is in Hindi. Only the words inside double quotation marks are ever spoken aloud; every voice direction and every other word of this text stays silent."
NOMUSIC="- No music of any kind: no score, no soundtrack, no background music, no melody, no drone, no pad, no sting, no swell."
RESTR=["Restrictions:",NOMUSIC,"- No added sound effects: no whoosh, no boom, no impact hit, no riser.","- Only diegetic sound: the characters' voices and the natural sounds of this place."]
BG="- Background people never copy the face or hair of any image reference; each referenced character appears once, as themselves."
LAST="- No words but the quoted lines, each only inside its own Audio window; outside them no one on screen speaks, whispers or mouths a word."
V={"meera":"a girl's voice, small, light and uncertain","devendra":"a man's voice of about 36, a dry quiet baritone, a central Indian Hindi accent, steady and low"}
ID=dict(bazaar="f14c9928-fb0a-4696-90b9-de8b00b203f2",meera="32dc90ca-b3dc-4355-8e4d-ac57536a2f60",mother="860462ac-492c-4410-843b-697870d9d7e8",father="f83e6134-1cc7-421b-aba9-a2aea9f836e0",devendra="5f1b39b6-c85d-4de3-946b-6c6bb1801537",suman="f947a93a-a190-427f-91eb-9ac0f55ebcea",boy="f0d3202d-0feb-43e1-9797-aa54d1211533")
def P(*parts):
    out=[]
    for p in parts: out += p if isinstance(p,list) else [p]
    return "\n".join(out)
def shots(L): return ["S%d %s"%(i+1,l) for i,l in enumerate(L)]
def req(prompt,seconds,refs,parent=None):
    medias=[{"value":r,"role":"image_references"} for r in refs]
    p={"model":"seedance_2_5","mode":"omni_reference","prompt":prompt,"duration":seconds,"aspect_ratio":"9:16","resolution":"480p","draft":True,"generate_audio":True,"bitrate_mode":"high","medias":medias,"count":1}
    if parent:
        p["mode"]="video_extension"; p["extension_mode"]="forward"; medias.append({"value":parent,"role":"video_references"})
    return {"requests":[{"index":0,"params":p}]}

# ---------- ship / crash-site picture
ship={"requests":[{"index":0,"params":{"model":"seedream_v5_pro","prompt":"电影剧照，印度乡村科幻剧情片的现实主义风格，画面明亮，傍晚前低角度的金色阳光从画面右后方照来，逆光勾出玉米叶和飞船的边缘，约三分之一的画面落在阴影里，空气中悬着缓缓落定的尘土。2014年印度中部农田里的一片成熟玉米地，一条约十米宽、被压平并翻出红褐色泥土的玉米带从镜头前方笔直通向远处；这条压痕的尽头，一艘巨大的深色金属飞船斜插在土里，大约五层楼高，远远高过旁边的印楝树，轮廓陌生：像一枚竖立的、不对称的弯月形巨刃，表面是哑光的炭灰色金属，布满细密的肋状板缝、凹陷的几何纹路和烧灼的条痕，没有窗户，没有灯，没有机翼；飞船底部靠近地面处有一个很小的椭圆形舱门向外敞开，只有小孩那么高，里面漆黑；飞船底部周围堆着翻起的泥土，尘土正在缓缓落定。飞船左右两侧各有两三棵印楝树，树高只到飞船的三分之一，用来显出尺度；近处是站立视高的玉米地边缘和空旷可走的压平地面。镜头是站立视高的竖幅广角定场镜头，从玉米地边缘沿着压痕望向飞船，飞船占据画面上方三分之二。冷调的中性金属对比温暖的泥土。没有人工灯光，只有日光。画面中没有任何人，没有人影。","aspect_ratio":"9:16","resolution":"2k","is_inpaint":False,"remove_bg":False,"count":1}}]}
json.dump(ship,open("req-ship.json","w"),ensure_ascii=False,indent=1)

# ---------- CLIP 1 v2: mother simply waves, nobody speaks
c1=P("STRICT RULE: Absolutely no music, only diegetic sounds; no one speaks and no voice is heard.",STYLE_B,LOOK,
 "Image reference 1 (location Madhopur bazaar): the Madhopur bazaar 100% as in the reference.",
 "Image reference 2 (character Young Meera): Young Meera, face, hair, body and clothes 100% as in the reference.",
 "Image reference 3 (character Meera's mother): Meera's mother, face, hair, body and clothes 100% as in the reference.",
 "Image reference 4 (character Meera's father): Meera's father, face, hair, body and clothes 100% as in the reference.",
 "Continuity: Young Meera is clean and unchanged from the reference, with no stain, mark or damage; Meera's mother is clean and unchanged from the reference, with no stain, mark or damage; Meera's father is clean and unchanged from the reference, with no stain, mark or damage.",
 "In frame only: Young Meera, Meera's mother, Meera's father and the market crowd. The street runs away from the lens, the shopfronts on the left, the wooden stalls on the right. Meera stands alone in the open middle of the street, near, the glass shopfront behind her; her mother and father stand across the road by the stalls, far, the width of the street between them. Eyelines never at the camera.",
 "Opening: Meera standing in the middle of the street, her face tipping up; her mother standing by the stalls with both hands empty, her father standing a step behind her; shoppers walking.",
 "Nobody speaks in this clip: Meera, her mother, her father and the crowd never speak, call or shout; every mouth stays closed and no voice is heard.",
 "Meera is out to see what is crossing the sky; once the dust hides her parents she keeps her eyes on the place they stood, with persistence.",
 "Meera's mother is out to catch Meera's eye across the road; once she has it she waves to her, with zeal.",
 "Pace: ordinary and bright until 8.9s, then one hard turn into dust and noise; every shot opens in motion.",
 shots([
 "0.0-1.2s · full, from the near end of the street looking down it, standing eye level, static · market shoppers and vendors move between the stalls and the shopfronts, a bicycle rolls past with its bell going, dust in the sunlight; nobody we know in frame.",
 "1.2-2.6s · close, cut at the collarbones, from the front, slightly low, slow push-in · Meera in the middle of the street tips her face up to the sky, her look going up past the top edge of the frame; the glass shopfront soft behind her, shoppers passing far back.",
 "2.6-4.2s · full, a tilt up from the awning tops to the open sky, then static · a fireball with a white-orange tail crosses the sky from upper left to lower right trailing grey smoke, its roar rising at 3.0s; only sky and the awning tops in frame.",
 "4.2-5.4s · insert, the glass shopfront pane, eye level, static · the shopfront glass rattles in its frame at 4.3s, the sky's reflection shaking in it, a tin signboard buzzing above; only the glass and the painted signboard.",
 "5.4-7.4s · medium, from across the road on Meera's side, eye level, static · Meera's mother lifts her open right hand and waves it side to side in an easy, natural wave, her lips closed in a small smile, her look passing right of the lens, level; Meera's father a step behind her on the left, hands at his sides, lips closed; the wooden stalls behind them.",
 "7.4-8.8s · close, cut at the collarbones, three-quarter from the shopfront side, eye level, handheld · Meera's right hand rises beside her face to wave, her look passing left of the lens toward the stalls; shoppers soft behind her.",
 "8.8-10.2s · full, from the shopfront side looking across the road, eye level, static · a wall of pale dust rolls in from the right with a deep thud at 8.9s and swallows the stalls and the two figures by them; shoppers in the middle distance turn and run from it.",
 "10.2-11.6s · close, cut at the collarbones, from the front, slightly high, handheld · dust rolls over Meera from the right, her raised hand still up, her plaits lifting in the gust, her eyes on the place off left of the lens where the stalls stood; only dust and the shopfront behind her.",
 "11.6-13.0s · extreme_close, brows to lips, from the front, eye level, slow push-in · her eyes search the dust off left of the lens, her raised hand lowering out of the bottom of the frame, a loose shutter rattling somewhere behind her; only pale dust behind her."]),
 LANG,"No speech in S1, S2, S3, S4, S5, S6, S7, S8, S9.",RESTR,BG,LAST)
json.dump(req(c1,13,[ID["bazaar"],ID["meera"],ID["mother"],ID["father"]]),open("req-c1.json","w"),ensure_ascii=False,indent=1)

# ---------- CLIP 2 v2: "Mummy? ... Kahan ho?"
c2=P("STRICT RULE: Absolutely no music, only diegetic sounds.",STYLE_B,LOOK,
 "Image reference 1 (location Madhopur bazaar): the Madhopur bazaar 100% as in the reference.",
 "Image reference 2 (character Young Meera): Young Meera, face, hair, body and clothes 100% as in the reference.",
 "Continuity: Young Meera is clean and unchanged from the reference, with no stain, mark or damage.",
 "In frame only: Young Meera and the market crowd. The street runs away from the lens, the shopfronts on the left, the stalls on the right under thinning dust. Meera stands alone in the open middle of the street, near, the glass shopfront behind her; the stalls stand empty across the road, far. Eyelines never at the camera.",
 "Opening: Meera standing in the middle of the street in thinning dust, her hand lowered at her side, her eyes on the empty stalls across the road.",
 "Meera speaks aloud 2 times, between 2.2s and 3.0s and between 5.0s and 6.0s, and never again; silent before 2.2s, from 3.0s to 5.0s while she listens, and from 6.0s to the end.",
 "The crowd never speaks in this clip.",
 "Meera is out to find her mother in the dust; once nothing answers her first call she calls again and keeps looking, with persistence.",
 "Pace: quiet and slow after the noise; every shot opens in motion, a listening beat between her two calls.",
 shots([
 "0.0-2.0s · medium_wide, from behind Meera over her shoulder, eye level, slow push-in · Meera's back near centre, her hand down at her side; across the street the dust thins and the stall frames emerge empty, a shop shutter on the left half down and rattling; two shoppers far off stumbling out of the dust.",
 "2.0-3.4s · close, cut at the collarbones, from the front, slightly high, slow push-in · Meera's voice begins at 2.2s and ends at 3.0s, her look passing right of the lens into the thinning dust, her hands loose at her sides; only pale dust behind her.",
 "3.4-4.8s · close, cut at the collarbones, three-quarter from the shopfront side, eye level, static · her lips closed, her head tilts a little as her eyes search off left of the lens, only the rattle of a loose shutter in the quiet; the dusty street soft behind her.",
 "4.8-6.4s · close, cut at the collarbones, from the front, slightly high, handheld · Meera turns her head toward the stalls, her voice begins at 5.0s and ends at 6.0s, her look passing left of the lens; only pale dust behind her.",
 "6.4-8.0s · medium, from the stalls side, eye level, handheld · Meera takes one slow step forward into the thinning dust, her eyes fixed on the empty stalls off left of the lens; the glass shopfront soft behind her.",
 "8.0-10.0s · extreme_close, brows to lips, from the front, eye level, slow push-in · her eyes stay on the empty place off left of the lens, her lips closed, dust settling on her plaits; only pale dust behind her."]),
 LANG,
 'S2 (2.2-3.0s) Meera to her mother, %s, small and questioning: "मम्मी?"'%V["meera"],
 'S4 (5.0-6.0s) Meera to her mother, louder and searching: "कहाँ हो?"',
 "No speech in S1, S3, S5, S6.",RESTR,BG,LAST)
if J.get("c1"): json.dump(req(c2,10,[ID["bazaar"],ID["meera"]],parent=J["c1"]),open("req-c2.json","w"),ensure_ascii=False,indent=1)

# ---------- CLIP 3 v2: villagers, the blazing object, distant destruction, the landing felt
c3=P("STRICT RULE: Absolutely no music, only diegetic sounds; nobody speaks a line, the crowd only shouts and cries out without words.",STYLE_B,LOOK,
 "Image reference 1 (location Madhopur bazaar): the Madhopur bazaar 100% as in the reference.",
 "In frame only: the market crowd of villagers, all adults: men in cotton kurtas and gamchhas, women in sarees, shopkeepers in aprons. The bazaar street runs away from the lens, shopfronts on the left, wooden stalls on the right, thin dust still hanging in the air; beyond the far end of the street lie open fields, and far off a road lined with small shops. Eyelines never at the camera.",
 "Opening: villagers walking and standing in the dusty street among the stalls, some brushing dust from their clothes.",
 "Nobody speaks a line in this clip: the villagers only shout and cry out without words.",
 "The villagers are out to see what is crossing the sky; once it tears through the far fields they brace and hold on to the stalls, with resilience.",
 "Pace: fast and rising, reactions cut against wide shots of the destruction far away, then one heavy landing and a long shaking settle.",
 shots([
 "0.0-1.6s · medium, from street level among the stalls, slightly low, handheld · a knot of villagers stop mid-step and tip their heads back, hands coming up to shade their eyes, a rushing roar rising from 0.3s; the shopfronts behind them.",
 "1.6-3.6s · full, a tilt up from the awning tops to the open sky, then static · a huge blazing object wrapped in fire and black smoke tears low across the sky from upper left to lower right, its true shape hidden inside the flames, the roar peaking at 2.6s; only sky, smoke and awning tops.",
 "3.6-5.0s · close, cut at the collarbones, three-quarter, slightly low, handheld · an old shopkeeper with a grey moustache tracks it across the sky, orange light sweeping over his face, his look passing right of the lens and up; panicked wordless shouts around him; a woman in a yellow saree soft behind him.",
 "5.0-7.4s · full, from the end of the street looking out over open farmland, eye level, static · far away the burning object ploughs through distant fields, ripping a long burning furrow through the crops, a wall of dust and debris climbing behind it, its shape lost in fire and smoke; small trees on the horizon; nobody in frame.",
 "7.4-8.8s · medium, from the front, eye level, handheld · three villagers duck and throw their arms over their heads as a shop window shatters behind them at 7.6s, glass falling onto the stall boards; panicked wordless cries.",
 "8.8-11.2s · full, a long-lens view down a distant road lined with small shops, eye level, static · far off the blazing object smashes low through the row of shops, tin roofs peeling away, shutters buckling and collapsing with a clatter, a plume of dust and debris rolling up behind it; nobody near enough to see.",
 "11.2-12.4s · close, cut at the collarbones, from the front, slightly low, static · a young man with a checked gamchha on his shoulder stares toward the horizon off left of the lens as the roar cuts out and a white-orange glow drops behind the far tree line; the dusty street behind him.",
 "12.4-16.0s · medium, from street level, eye level, handheld · one deep, heavy ground impact lands from far away at 12.6s and the picture jolts; the villagers stagger and brace against the stalls, windows rattle in their frames, dust shakes loose from the awnings and tin roofs, a loose shutter bangs; a low rumble rolls through the street and dies away by 15.5s; only villagers, stalls and shopfronts in frame."]),
 LANG,"No speech in S1, S2, S3, S4, S5, S6, S7, S8.",
 "Restrictions:",NOMUSIC,
 "- Only diegetic sound: the roar of the object, the crowd's wordless shouts and cries, shattering glass, collapsing shop shutters, one deep heavy ground impact and its low rolling rumble.",
 "- The object's true shape stays hidden by fire, smoke and distance in every shot; no spacecraft or machine is ever seen.",
 "- No readable words are spoken: no one on screen speaks, whispers or mouths a sentence.")
json.dump(req(c3,16,[ID["bazaar"]]),open("req-c3.json","w"),ensure_ascii=False,indent=1)

# ---------- CLIP 6 v2: the scale of the craft
REF6=["Image reference 1 (location Crash site): the Crash site, its flattened maize, its neem trees and the towering craft 100% as in the reference.",
 "Image reference 2 (character Devendra): Devendra, face, hair, body and clothes 100% as in the reference.",
 "Image reference 3 (character Suman): Suman, face, hair, body and clothes 100% as in the reference."]
c6=P("STRICT RULE: Absolutely no music, only diegetic sounds; no one speaks.",STYLE_F,LOOK,REF6,
 "Image reference 4 (character The boy): The boy, face, hair, body and clothes 100% as in the reference.",
 "Continuity: Devendra is clean and unchanged from the reference, with no stain, mark or damage; Suman is clean and unchanged from the reference, with no stain, mark or damage; The boy is clean and unchanged from the reference, with no stain, mark or damage.",
 "In frame only: Devendra, Suman and the boy. The edge of the maize field. Suman kneels at the field's edge, screen centre, near; the boy stands before her at arm's length with his back to the field, a broad swathe of flattened maize and torn red earth running from behind him into the field; Devendra stands a step behind Suman, screen left, near; the massive craft stands at the end of the swathe sixty steps in, far, towering over the neem trees beside it. Eyelines never at the camera.",
 "Opening: Suman kneeling with the boy's hand in hers; the boy standing before her; Devendra standing a step behind her, his eyes on the boy.",
 "Nobody speaks in this clip: Devendra, Suman and the boy never speak.",
 "Devendra is out to understand where the child came from; once he sees the torn field he follows it with his eyes up the whole height of the craft, with resilience.",
 "Suman is out to keep the child's hand in hers; once Devendra looks up she looks where he looks, with perseverance.",
 "The boy is out to stay beside Suman; once she holds his hand he keeps it there, with persistence.",
 "Pace: slow and hushed, one long tilt up the craft that takes its time; every shot opens in motion.",
 shots([
 "0.0-1.8s · close, cut at the collarbones, three-quarter from the field side, slightly low, slow push-in · Devendra's eyes lift from the boy and travel past him and upward, his look going off right of the lens and up; Suman's plait and shoulder soft in the right foreground.",
 "1.8-3.4s · medium, from behind Devendra over his shoulder, slightly high, static · a broad swathe of flattened maize and torn red earth runs from the boy's back into the field; Suman kneeling and the boy standing near centre with their hands joined, Devendra's shoulder soft in the left foreground.",
 "3.4-9.4s · full, from behind the three at their eye level, one slow continuous tilt up · the three small in the lower third with their backs to the lens, Devendra standing, Suman kneeling, the boy beside her; the tilt climbs past the neem trees and on up the dark ribbed hull of the massive craft towering over them, its top edge entering frame at 8.0s; dust settling around its base, a low wind.",
 "9.4-11.0s · close, cut at the collarbones, from the front, low, handheld · Devendra's head tips back, his eyes climbing the hull off right of the lens and up, his hands open at his sides; only maize behind him.",
 "11.0-12.4s · insert, the foot of the craft from low in the flattened maize, static · settling dust rolls around heaped earth at the base of the hull; one small oval hatch stands open low to the ground, dark inside, just big enough for a small child; nobody in frame.",
 "12.4-14.0s · close, cut at the collarbones, three-quarter from Devendra's side, slightly high, slow push-in · Suman's eyes come up from the boy's hand in hers and climb the hull off right of the lens; the boy's shoulder soft in the right foreground."]),
 LANG,"No speech in S1, S2, S3, S4, S5, S6.",RESTR,LAST)
if J.get("ship"): json.dump(req(c6,14,[J["ship"],ID["devendra"],ID["suman"],ID["boy"]]),open("req-c6.json","w"),ensure_ascii=False,indent=1)

# ---------- CLIP 7 v2: the final reaction, ends on the child (fully dressed)
c7=P("STRICT RULE: Absolutely no music, only diegetic sounds.",STYLE_F,LOOK,REF6,
 "Image reference 4 (character The boy): The boy, face, hair, body and clothes 100% as in the reference; in S6 only, his eye colour brightens from dark to blue.",
 "Continuity: Devendra is clean and unchanged from the reference, with no stain, mark or damage; Suman is clean and unchanged from the reference, with no stain, mark or damage; The boy is clean and fully dressed in his kurta, buttoned at the neck, as in the reference.",
 "In frame only: Devendra, Suman and the boy. The edge of the maize field, the massive craft towering at the end of the flattened swathe, far. Devendra stands one step ahead of Suman toward the field, screen left, middle; Suman kneels at the field's edge, screen centre, near; the boy stands before her at arm's length with his back to the craft. Eyelines never at the camera.",
 "Opening: Devendra standing one step ahead of Suman with his head tipped back, his eyes high on the craft; Suman kneeling with her eyes on the craft; the boy standing before her with his hand in hers.",
 "Devendra speaks aloud 1 time between 1.8s and 2.6s and never again; silent before 1.8s and from 2.6s to the end.",
 "Suman and the boy never speak in this clip.",
 "Devendra is out to make Suman see the craft; once she looks he holds his ground before it, with resilience.",
 "Suman is out to take in what Devendra sees; once she has seen it she looks back down to the child, with perseverance.",
 "The boy is out to keep hold of Suman; once her eyes come down to him he holds her hand with both of his and looks up at her, with persistence.",
 "Pace: slow and hushed, one beat where his line lands; the last shot pushes in slowly on the child and takes its time.",
 shots([
 "0.0-1.6s · full, from low behind the three, slightly low, static · the three small at the bottom of the frame with their backs to the lens, the dark ribbed hull filling the frame above them and the neem trees, dust drifting at its base.",
 "1.6-4.0s · close, cut at the collarbones, three-quarter from Suman's side, slightly low, slow push-in · Devendra's eyes hold high on the craft off right of the lens, his throat moving as his voice begins at 1.8s and ends at 2.6s, his hands still at his sides; the dark hull soft behind him.",
 "4.0-5.6s · close, cut at the collarbones, from the front, slightly high, handheld · Suman's eyes come down from the top of the craft off left of the lens to its small open hatch, dust drifting between them; the boy's hair at the bottom edge of the frame, pale maize behind her.",
 "5.6-7.0s · insert, the hands from above, static · the boy's second hand comes in from the left and closes over Suman's hand so both his small hands wrap around hers; the dry earth below.",
 "7.0-8.4s · close, cut at the collarbones, three-quarter from the craft side, slightly high, static · Suman's eyes drop from the craft down to the boy below the bottom edge of the frame, her lips closed, her plait over her shoulder; maize soft behind her.",
 "8.4-13.0s · close, framed from the chest up, from the front at the boy's eye level, slow push-in · the boy in his cream kurta, buttoned at the neck, an ordinary familiar child's face, looks up past the top of the lens at Suman; from 9.6s his dark eyes brighten to a striking clear blue with a faint inner glow; at 11.0s a faint geometric marking of pale light pulses once, softly, through the thin cotton at the centre of his chest and fades; one soft metallic tick from the cooling hull at 12.2s; the dark hull soft behind him."]),
 LANG,
 'S2 (1.8-2.6s) Devendra to Suman, %s, barely above a whisper: "सुमन…"'%V["devendra"],
 "No speech in S1, S3, S4, S5, S6.",
 "Restrictions:",NOMUSIC,
 "- Only diegetic sound: the characters' voices, the wind in the maize, settling dust and one soft metallic tick from the hull.",
 "- The boy stays fully dressed in his kurta in every shot; the glow in his eyes and the single pulse of light at his chest are faint and understated, so he looks like an ordinary child at first glance.",LAST)
if J.get("ship") and J.get("c6"): json.dump(req(c7,13,[J["ship"],ID["devendra"],ID["suman"],ID["boy"]],parent=J["c6"]),open("req-c7.json","w"),ensure_ascii=False,indent=1)
for n,t in (("c1",c1),("c2",c2),("c3",c3),("c6",c6),("c7",c7)): print(n,len(t),"chars")
import glob; print(sorted(glob.glob("req-*.json")))
