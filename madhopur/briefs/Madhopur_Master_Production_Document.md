# Madhopur · Master production document

Five-episode vertical microdrama · Shooting script, Higgsfield shot plans, edit, VFX, colour and music in one document.

## Pilot specifications

**Setting** — Madhopur, a fictional farming town in central India. The meteor shower takes place in 2014. Teenage Veer’s story begins twelve years later.

**Format** — 9:16 vertical · 24 fps · Five episodes, approximately 1:35 to 1:50 each · Hinglish dialogue. Dialogue is written for this adaptation.

**Look** — Keep the early *Smallville* farm-town look: big skies, tall maize, a weathered red barn, an old pickup, a narrow river bridge and a warm farmhouse kitchen. Ground it in India through the bazaar, steel plates, the school bus, school uniforms and the farewell. Use bright, ordinary daylight for the meteor shower. Let the threat arrive in a place that felt safe three seconds earlier.

**Cast** — Veer Sharma at roughly five, eight, eleven, thirteen and seventeen. Suman and Devendra Sharma, with subtle aging after the jump. Meera Joshi and Yash Rathore as children and in the present. Raghav, Ananya and Nikhil in the present. Young Nikhil is the teenager in the 2014 cornfield. Kunal appears in the final teaser.

## Test cuts and reference assets

**Test A · Episode 1 into Episode 2.** Make a 12–18-second cut from the ship reveal, Devendra’s face, Suman holding the boy’s hand, and the boy’s hand reaching for गुड़. Check that the boy looks like the same child and the match cut reads clearly on a phone. The family’s reaction carries the reveal. Give the spacecraft one clear shot and let the sound fall away.

**Test B · Episode 2 kitchen.** Make a 15–20-second cut around “आज से ये हमारा बेटा है, देवेंद्र।” Use Suman’s close-up, Devendra listening and the roti insert. Record the lines before choosing shot lengths. Play it once with sound and once muted. Devendra’s response should still make sense with the sound off.

Test the same Suman close-up and ship shot in two supported reference-led video models if needed. Compare face stability, subtle eye movement and edge distortion. Pick the results that cut together. Match exposure and colour in the edit. Use the same model and references for adjacent character angles where practical.

Build references as shots need them. Start with Suman, Devendra, five-year-old Veer, the 2014 kitchen, the spacecraft, the maize field and the pickup. Then add young Meera, young Yash and young Nikhil for the rest of Episode 1. Add teenage Veer and the other age variants once the boy’s look is locked.

| Reference | What to fix in the approved image |
|---|---|
| Suman and Devendra, 2014 and present day | Front and three-quarter views, natural expressions, fixed costume for each scene. For older versions, use the 2014 likeness as the basis for believable aging. |
| Veer at 5, 8, 11, 13 and 17 | Preserve facial structure, eyes, brows and hairline across distinct age references. Establish each older age with a cut. |
| Young and present-day Meera, Yash and Nikhil | Establish both ages from a shared design. Give Nikhil a clear visual feature that survives the twelve-year jump and is visible in Ananya’s photo. |
| Maize field and post | Fix the post’s height, knots, marks and the surrounding rows. Save one repeatable angle on the post for Episodes 1 and 4. |
| Ship | Approve one three-quarter view before making the eye-level or hatch views. Fix its silhouette, hatch hinge and opening size. Match the field angle in the cellar reveal. |
| Pendant and roti scene | Save close reference stills of the green stone and chain, the child’s checked sleeve, steel plate, गुड़ and roti. Track who wears or holds the pendant in each cut. |
| Sharma kitchen, barn, bridge and farewell gate | Approve one wide reference and one reverse angle per location. Fix doors, windows, railings and major light sources so each location still looks like the same place in close-up. |

Use original cast reference art or approved casting references. Name the approved assets clearly, for example `SUMAN_2014_KITCHEN`, `VEER_05_CHECKED_SHIRT`, and `SHIP_FIELD_HATCH_A`. Mark the approved version so Claude can ask for the exact image.

**Look.** Use dusty daylight, natural colours and lived-in textures for the bazaar and maize field. Use a single warm practical and subdued shadows in the kitchen. Keep faces large and eyes readable on a phone. Give the top and bottom of frame room for the app UI. Test subtitles on an actual in-app preview. Use still or gently moving frames for the family scenes. Save abrupt camera movement for the impacts and emergencies.

**Generation settings.** Start with a 9:16 approved frame. Where the tool lets you, turn off generated audio for scenes you will dub and mix. Test shorter clips first and trim to the beat you need. For example, the documented Seedance 2.0 reference-to-video API supports 4–15 seconds and 9:16. A two-second insert can come from a four-second clip. Confirm what the selected connector tool exposes before submitting. Deliver a 1080 × 1920, 24 fps edit after checking motion and captions on a phone.

[Seedance 2.0 reference-to-video API parameters](https://open.higgsfield.ai/models/bytedance/seedance-2.0/reference-to-video/api-reference)

## Edit, colour, VFX and music for the whole pilot

1. **Record and cut the dialogue.** Create a simple timeline with still frames, the Hinglish performances and the script’s cliffhanger timings. Listen to the full scene before deciding which lines need visible lips. Use an actor’s reaction, an object or a location insert to cover the rest.
2. **Build the picture edit.** Generate matched shot plates in Higgsfield. Edit them together in Resolve, Premiere or your editor of choice. Hold the first readable image long enough to establish where we are. During the action, cut on physical beats: a head turn, brake pedal, rail breaking or splash. Return to a held face after the action.
3. **Add effects to the selected takes.** Split the meteor, car crash and electrical scenes into discrete shots. The reference frame sets identity and camera; add the flashes, reflected light, dust and similar effects once the shot is chosen. Keep opening and closing frames from linked episodes together in the edit project.
4. **Build sound before score.** Place dialogue, ambience, Foley, effects and score on separate tracks. Put farewell music on its own track because it is heard by the characters. If you use it outside the gate, make it quieter and more muffled. Send the composer or music generator a rough cut with dialogue and the cue points below. Ask for versions with separate instrument groups where available, plus clean endings. Pull score down through dialogue and audition on a phone speaker.
5. **Match colour and finish.** Start with skin and exposure across each scene. Then move the scene toward the target palette. Review the cut at phone size before adding subtitles and exporting a 9:16, 1080 × 1920, 24 fps master. Keep a clean master and an app-ready captioned version.

### Music palette

| Cue | Brief | Where it returns |
|---|---|---|
| **Home** | Felt piano, clean electric guitar, restrained soft bass. Leave space between notes and keep percussion out of the kitchen scene. | Suman chooses Veer. A light drum pulse joins during the growing-up montage. Bring back the piano, now sparse, when Devendra reveals the ship. |
| **The fall** | Low strings or a soft synth pulse, one metallic texture, room for silence. | Ship and storm cellar. At the bridge, use a short rise and cut it at impact. |
| **Veer and Meera** | An original, early-2000s guitar-led slow build: clean guitar first, bass and restrained live drums later. Keep the opening instrumental; any vocal can enter after the last line. | A brief hint at the memorial. Give the melody room in the imagined barn dance, then stop it on the horn. |
| **Farewell** | Diegetic school-party track with a steady beat. Keep an unobtrusive instrumental stretch for the gate sequence. | Play the same track inside the school and from outside the gate in Episodes 4 and 5. |
| **Cliffhanger** | A short cue shaped by the scene sound. End it cleanly on black. | Use different sounds for the ship tick, submerged car, metal gate and insect teaser. |

### Paste-ready brief for the barn-dance cue

> Write an original 30-second instrumental for a rural coming-of-age drama. Intimate early-2000s alternative-rock ballad. Start with a close, clean electric guitar and a little room sound. Add soft bass and restrained live drums halfway through. Keep the first 12 seconds sparse under two spoken lines. Let the melody swell only after the couple begins to dance. Include a clean abrupt ending point for a car horn. Supply a guitar-only version and separate drums/bass if available. Use an original melody and progression.

### Colour and VFX by location

| Scene | Grade and framing | Animation and effects |
|---|---|---|
| **Bazaar and farmland** | Warm daylight, saturated but believable maize greens, dusty gold highlights and natural skin. Give the sky depth. Keep daylight readable during the disaster. | Shoot or generate the sky and impact separately. Composite a brief streak, a motivated flash on faces and dust that moves in the correct direction. |
| **Sharma kitchen** | Amber practical light, warm wood and soft shadows. Straight eye-level singles; save the close detail for hands, plates and roti. | Keep the source faces and lighting stable. Let breath, blinks and hand movements carry the scene. |
| **Bridge and underwater** | Start in normal late-afternoon light. Let the water move toward blue-green with soft contrast and visible headlight falloff. | Make the swerve, broken rail, splash and underwater shots individually. For super-speed, use a stable frame, an exit cut and a short directional blur or dust trail. |
| **Ship and cellar** | Cool neutral metal against warm earth or lamplight. Expose enough of the dark hatch to make the shape readable on a phone. | Use one spacecraft design and hatch angle. Move dust or reflected light. Keep the hull fixed. |
| **Night post and school farewell** | Cool night exteriors with detail in the maize. Warm strands of practical lights over the courtyard. Match the cold/warm split when cutting across the gate. | Use a small, local arc at Nikhil’s fingers. Time the gate crackle, lamp flicker and Meera’s reaction together so the effect has a visible consequence. |
| **Barn dance and return to reality** | Soft amber edge light and a gentle move during the dance. Return to the steadier, less warm barn shot after the horn. | Keep the transition as a cut motivated by the horn. Match Veer’s position across the cut so the audience immediately sees that he is alone. |

## Episode 1 · आसमान से क्या गिरा? · 1:35

### 00:00–00:22 · EXT. MADHOPUR BAZAAR · DAY · 2014

**Opening shot.** Tight on young Meera as she looks up. Tilt just enough to catch a fireball crossing the sky. By the third second, glass is rattling in the shopfront behind her.

Across the road, Meera’s mother holds up a paper bag and waves. Her father stands beside her. Meera starts to wave back. An impact sends dust across the street. Keep the camera with Meera as she loses sight of them.

**MEERA**  
मम्मी? … पापा?

**Sound.** Drop the market chatter at the impact. Bring back only Meera’s voice and the rattle of a loose shop shutter.

### 00:22–00:40 · EXT. MAIZE FIELD · DAY

Young Yash pushes through the maize. Through a gap, he sees a teenage boy tied to a wooden post. A red S is painted on the boy’s shirt.

**BOY**  
रुको! मेरी रस्सी खोल दो!

Yash moves toward him. The maize bends in a wave. Yash throws up his arm as a flash wipes out the picture.

### 00:40–01:10 · INT./EXT. SHARMAS’ PICKUP · DAY

Devendra and Suman are driving home. Something streaks low across the road. Devendra hits the brakes. The pickup drops nose-first into a ditch.

Hold inside the cab. Suman lifts her head. A small boy peers at her through the cracked window. He looks as startled as she is.

Suman gets out, kneels and offers her hand.

**SUMAN**  
डरो मत। तुम्हें चोट लगी है?

He takes her hand. Devendra climbs out behind her.

### 01:10–01:35 · EXT. MAIZE FIELD · CONTINUOUS

Devendra looks past the boy. A trail of flattened maize ends at a dark metal craft, half-buried in the earth. The open hatch is low enough for the child to have climbed out.

**DEVENDRA**  
सुमन…

**Final shots.** The spacecraft. Devendra’s face as he takes it in. Suman looks from the hatch to the boy, who wraps both hands around hers. Hold on their faces for two beats. A faint metallic tick comes from the cooling hull.

**Cut to black.**

### Post-production cues for Episode 1

| Time and scene | Edit, music and sound |
|---|---|
| **1 · 00:00–00:22 · Bazaar** | Start dry with bicycle and market ambience. Put the first fireball on screen by 00:03. Use a brief low swell into impact, then drop the music and most street sound. Leave Meera’s “मम्मी? … पापा?” and a rattling shutter. |
| **1 · 00:22–01:10 · Field and pickup** | Let wind carry into Yash’s first shot. Use the flash as one cut point and the brake as another. Keep the boy’s first look through the window quiet enough to hear the pickup settling. |
| **1 · 01:10–01:35 · Spacecraft** | Devendra looks up → ship → Devendra’s face → Suman and Veer. Start a low sustained note only when the ship enters frame. Under “सुमन…” reduce it to near silence. Hold Suman’s face for about two seconds, then use the metal tick and a hard cut to black. |

### Higgsfield coverage for Episode 1

Read durations as the edited time on screen. For a long coverage slot, split the action into the indicated angles. Generate the meteor and dust separately from the close-ups wherever possible.

| ID | Edit time | Generate and cut |
|---|---|---|
| E1-01 | 00:00–00:03 | Young Meera close-up, then the meteor in a separate sky insert. The fireball is visible within three seconds. |
| E1-02 | 00:03–00:08 | Across the bazaar, her mother lifts the paper bag and waves. Her father is beside her. |
| E1-03 | 00:08–00:13 | Meera raises her hand to wave. Cut to a locked storefront plate as dust crosses it. Put the blast in the sound edit. |
| E1-04 | 00:13–00:22 | Back on Meera. Hold long enough for “मम्मी? … पापा?” Let the rattling shutter outlast the impact. |
| E1-05 | 00:22–00:27 | Follow young Yash’s shoulder between the maize rows, keeping screen direction stable. |
| E1-06 | 00:27–00:35 | Yash’s view of the boy at the post. Cut to Yash on “रुको! मेरी रस्सी खोल दो!” if the mouth performance is unconvincing. |
| E1-07 | 00:35–00:40 | Empty maize-row shot bending in wind, then Yash shielding his face. Add the flash in the edit. |
| E1-08 | 00:40–00:47 | Pickup interior with Devendra driving. Separate the low streak and his reaction. |
| E1-09 | 00:47–00:54 | Brake insert, then wheel/ditch shot. End on a cab jolt. Match which way the pickup tilts in the next shot. |
| E1-10 | 00:54–01:02 | Suman opens her eyes. Reverse through the cracked glass to the boy waiting outside. |
| E1-11 | 01:02–01:10 | Suman kneels. Cut to the offered hand for “डरो मत। तुम्हें चोट लगी है?” Use Devendra’s approach as a separate angle. |
| E1-12 | 01:10–01:16 | Devendra follows the flattened maize with his eyes. Cut along his sightline. |
| E1-13 | 01:16–01:22 | Reveal the ship. Use the approved hatch angle and a near-static camera. |
| E1-14 | 01:22–01:28 | Close on Devendra holding his gaze. “सुमन…” barely above a whisper. |
| E1-15 | 01:28–01:35 | Suman looks from the ship to the boy. Hold on her reaction and insert the boy’s hand gripping hers. End on her face. Metallic tick, then black. |

### Three prompts to test first

Replace the reference names with the uploaded assets. Set the duration using the tool where available.

**E1-13 · Ship reveal · Target trim 6 s**

> Animate the approved SHIP_FIELD_HATCH_A still. Photoreal 9:16, rural central India, late-afternoon sun diffused by dust. Child-eye-level view across flattened maize toward the half-buried dark metal craft. Maintain its exact outline, panels and open hatch. Locked camera. Fine dust drifts slowly past the opening. The ship is completely still. No people in frame. Preserve realistic metal and maize textures. Use the clip without dialogue.

**E1-15A · Suman’s reaction · Target trim 4–5 s**

> Animate SUMAN_2014_FIELD_CU. Portrait close-up, camera at eye level, dusty natural daylight. Suman first looks toward the spacecraft off right of camera. After a beat, her gaze drops toward the child below her. She draws one small breath. Her lips stay closed. Match the reference face, hair and costume. Keep the shot locked and her expression restrained.

**E2-01A · Match-cut to गुड़ · Target trim 3–4 s**

> Animate VEER_05_KITCHEN_HAND_APPROVED. Locked vertical close-up of the boy’s hand in Devendra’s oversized checked sleeve. Use the same screen position and hand orientation as the Episode 1 hand insert. In warm practical light, his fingers reach for one small piece of jaggery on the steel plate and lift it. The hand exits in one clean movement. Use separate shots for offering the piece and for the smile.

## Episode 2 · आज से ये हमारा बेटा है · 1:50

### 00:00–00:29 · INT. SHARMA FARMHOUSE, KITCHEN · NIGHT · 2014

**Opening shot.** The same little hand that held Suman’s in the field now reaches for one piece of गुड़. The boy is wrapped in Devendra’s checked shirt, sleeves rolled up twice. He offers the piece to Devendra before taking one for himself. Devendra accepts. The boy smiles at him, then at Suman.

At the sink, Devendra lowers his voice.

**DEVENDRA**  
सुबह लोग पूछेंगे, ये बच्चा कहाँ से आया।

**SUMAN**  
हम कहेंगे, हमें खेत में मिला।

**DEVENDRA**  
और जो खेत में उसके पीछे था?

Suman looks back. The boy has quietly put a piece of गुड़ beside her plate too.

**SUMAN**  
आज से ये हमारा बेटा है, देवेंद्र।

Devendra takes that in. He goes back to the table, tears a roti in half and gives the boy the bigger piece.

**DEVENDRA**  
वीर नाम कैसा रहेगा?

Suman tries the name out loud. The boy looks up when she says it.

**SUMAN**  
वीर।

### 00:29–01:00 · INT./EXT. SHARMA FARM · GROWING-UP MONTAGE

**Age eight. Kitchen.** A steel tumbler slips off the table. Veer catches it so fast that Suman is still reaching for it when he places it upright. The water barely spills. He goes back to eating.

**Age eleven. Field.** An irrigation pump starts rattling. Devendra calls for a spanner. Before he finishes asking, Veer is back from the barn with it. Devendra looks down the full length of the field, then at Veer.

**Age thirteen. Barn.** Devendra kneels to retrieve a dropped bolt by the tractor. Veer grabs the back of the tractor and lifts it a few inches to help. Devendra freezes. Veer sets it down as gently as he can.

**DEVENDRA**  
वीर। स्कूल में ऐसा कुछ किया है?

Veer shakes his head. Devendra nods once. Suman has seen the whole thing from the doorway.

**Age seventeen. Farm road.** Suman calls from the same kitchen door. The yellow school bus is already well past the gate.

**SUMAN**  
वीर! Bus निकल गई!

**VEER**  
मिलते हैं शाम को, माँ।

Veer takes off. At the school gate, he smooths his hair down just as the bus pulls in behind him.

**Edit.** Let the steel tumbler, pump rattle and tractor settling mark the montage beats. Keep the camera on the parents long enough to see surprise turn into concern.

### 01:00–01:22 · EXT. SCHOOL GATE · MORNING

Meera catches up with Veer. A green stone hangs from her necklace.

**MEERA**  
आज भी bus छूट गई?

**VEER**  
हाँ। पहुँच तो गया।

She leans in to hand him the notebook he left in class. His grip gives out. The notebook drops. Raghav calls her over from the gate. As she moves away, Veer can close his hand again.

### 01:22–01:50 · EXT. RIVER BRIDGE · LATE AFTERNOON

Veer pauses at the railing on his way home. Cut to Yash in a sports car approaching the bridge. A coil of wire lies in his lane. He swerves. The car slides toward Veer.

**Final shots.** Veer turns into the headlights. A hard impact. The railing breaks. The car and Veer go over the edge. Underwater, the headlights reveal Veer floating motionless as the car sinks past him.

**Cut to black.**

### Post-production cues for Episode 2

| Time and scene | Edit, music and sound |
|---|---|
| **2 · 00:00–00:29 · Kitchen** | Match the child’s hand from the field to the checked sleeve reaching for गुड़. Use the sound of fingers on the steel plate. Keep the adoption line dry. Let the Home cue enter when Devendra gives Veer the bigger half of his roti. |
| **2 · 00:29–01:22 · Growing up and school gate** | Use the tumbler, pump and tractor as edit accents. Cut between ages on actions and matching eyelines. Introduce a gentle guitar/drum build. Pull it back at school when Meera’s pendant weakens Veer. Use a short, low pressure sound under his reaction. |
| **2 · 01:22–01:50 · Bridge** | Intercut the car, wire and Veer with progressively shorter shots. At impact, cut the music. Give the plunge one distinct splash, then muffle the sound underwater. Hold the floating shot through black. |

### Higgsfield coverage for Episode 2

| Scene | Build the scene from these shots | Continuity |
|---|---|---|
| E2 · 00:00–00:29 · Kitchen | Hand match cut, boy smiles, Devendra receives गुड़, two separate adult close-ups, roti insert, boy at the name. Record the exchange first. Keep Suman on screen through the whole adoption line. | The sleeves, table layout and actors’ eyelines match. Give Devendra time to absorb the line. If the read runs long, let kitchen dialogue carry over reaction shots. |
| E2 · 00:29–01:00 · Growing up | Tumbler fall → catch → Suman; Devendra calls → spanner arrives → Devendra looks out at the field; tractor wheel shifts → Devendra reacts → Veer answers; bus pulls away → dust at Veer’s feet → arrival at school. Use approved stills at each age. | For the tractor, a low crop on the wheel lifting slightly and a cut to Devendra can sell the event. The parents’ reactions should move from surprise to concern. |
| E2 · 01:00–01:50 · Pendant and crash | Meera approaches → pendant insert → notebook drops → Veer steadies as she leaves. Bridge sequence: driver sees wire → Veer in headlights → railing breaks → splash → underwater silhouette. | Establish which direction the car is coming from. Save the same underwater frame for E3’s opening. |

## Episode 3 · तू उस जहाज़ में था · 1:38

### 00:00–00:13 · EXT. UNDERWATER · CONTINUOUS

Open on Veer’s face in the same position. His eyes open. He swims to the car, wrenches the damaged door open and pulls Yash out.

### 00:13–00:39 · EXT. RIVERBANK · LATE AFTERNOON

Veer drags Yash onto the bank. Yash coughs, rolls over and sees Veer beside him.

**YASH**  
तुम पुल पर थे।

**VEER**  
हाँ।

**YASH**  
मुझे याद है… गाड़ी तुम्हें लगी थी।

Veer looks back at the water. Yash catches the look.

**YASH**  
तुम्हें भी याद है, है ना?

### 00:39–01:06 · INT. SHARMA FARMHOUSE, KITCHEN · EVENING

Veer sets his soaked schoolbag on the floor. Suman grabs a towel. Veer stays by the door.

**VEER**  
गाड़ी मुझसे टकराई, माँ। मैंने शीशा टूटते देखा।

Devendra puts down his cup. Veer waits for him to say something.

**VEER**  
आप पूछेंगे भी नहीं कि मुझे चोट लगी या नहीं?

Devendra looks at Suman.

**SUMAN**  
उसे दिखा दो, देवेंद्र।

### 01:06–01:38 · INT. STORM CELLAR BENEATH THE BARN · EVENING

Devendra opens a wooden hatch and leads Veer downstairs. He pulls a canvas cover off the spacecraft. Frame the hatch at the same angle as in Episode 1.

**DEVENDRA**  
जिस दिन पत्थर गिरे थे, हम तुम्हें खेत से घर लाए थे।

**VEER**  
ये भी वहीं था?

**DEVENDRA**  
हाँ। तुम इसी में आए थे, वीर।

Veer looks at the little space inside the open hatch, then back at Devendra.

**VEER**  
आप दोनों को शुरू से पता था?

Devendra takes a breath to answer. Veer is already backing toward the stairs.

**Cut to black.**

### Post-production cues for Episode 3

| Time and scene | Edit, music and sound |
|---|---|
| **3 · 00:00–00:39 · Underwater and riverbank** | Start on the same underwater framing and sound. Veer’s eyes open. Cut to a submerged door creak, then let the full sound of air and river return when Yash coughs on the bank. |
| **3 · 00:39–01:38 · Home and ship** | Use separate singles and breath between questions. In the cellar, match the Episode 1 hatch angle. Bring back the metallic texture at the reveal. Leave a beat after “तुम इसी में आए थे, वीर।” Hold Veer’s face as he backs away. |

### Higgsfield coverage for Episode 3

| Scene | Build the scene from these shots | Continuity |
|---|---|---|
| E3 · 00:00–01:38 · Rescue and reveal | Underwater opening frame → eyes open → door insert → Yash on the bank → two singles. In the kitchen, use the wet bag and untouched towel between lines. In the cellar, reuse the hatch angle and cut between Veer and Devendra. | Match damp clothes, the damage on the car and the ship design. Leave room after “तुम इसी में आए थे, वीर।” |

## Episode 4 · खेत में अकेला · 1:47

### 00:00–00:11 · EXT. SHARMA BARN · EVENING

Veer comes up out of the cellar. Devendra follows.

**DEVENDRA**  
तुम कुछ भी पूछ सकते हो।

**VEER**  
पहले बता देते तो पूछ लेता।

He leaves. Devendra lets him go.

### 00:11–00:43 · EXT. MEMORIAL GARDEN / MEERA’S GATE · EVENING

Meera sets a few marigolds below two plaques bearing her parents’ names.

**MEERA**  
माँ, आज farewell है। आपकी बालियाँ पहनूँगी।

She sees Veer hanging back.

**MEERA**  
बैठोगे?

He sits beside her. Their shoulders almost touch. Her necklace is gone and Veer feels fine.

Later, at her gate, Raghav is waiting on the veranda. Meera notices Veer looking at him.

**MEERA**  
उसका match था। मेरा pendant ले गया था, lucky बोलता है।

**VEER**  
और farewell में भी तुम उसी के साथ हो?

**MEERA**  
हाँ। तुम्हारे लिए एक dance बचा लूँगी।

She kisses Veer on the cheek. Behind her, Raghav has seen it all. The green pendant hangs around his neck.

### 00:43–01:02 · EXT. SCHOOL COURTYARD · NIGHT

Students cross under strings of lights. Ananya catches Veer by the gate and shows him an archived photo on her phone. The teenager in the photo is the boy from the field.

**ANANYA**  
निखिल। इसे meteor वाले दिन खेत में बाँध दिया था। बारह साल coma में था।

She swipes through three photos.

**ANANYA**  
जिन तीन लोगों ने बाँधा था, आज तीनों hospital में हैं।

### 01:02–01:35 · EXT. SCHOOL LANE / MAIZE FIELD · NIGHT

Raghav and two teammates intercept Veer as he walks toward the courtyard.

**RAGHAV**  
मीरा से क्या बात कर रहे थे?

Veer tries to walk around him. Raghav steps closer. The green stone slips out from under his collar. Veer drops to his knees.

Cut to Veer tied to the same post from Episode 1. A red S is painted on his shirt. Raghav has left the pendant around Veer’s neck. Veer pulls at the rope. His fingers barely move.

Nikhil steps into the gap between the stalks. Veer recognises him from Ananya’s photo.

**VEER**  
निखिल… रस्सी खोल दो।

Nikhil looks up at the painted S.

**NIKHIL**  
मैंने भी यही बोला था।

Nikhil walks toward the music.

### 01:35–01:47 · EXT./INT. SCHOOL FAREWELL · NIGHT

Meera looks toward the courtyard entrance, searching for Veer. Outside, Nikhil puts his hand on the metal gate. Blue sparks jump between his fingers. The lights over the dance floor flicker. Meera looks up.

**Cut to black.**

### Post-production cues for Episode 4

| Time and scene | Edit, music and sound |
|---|---|
| **4 · 00:00–01:02 · Memorial and school** | Begin with footsteps as Veer leaves the cellar. At the memorial, keep one hint of the guitar melody under Meera and Veer. Let the farewell’s music become audible before Ananya shows the old photo. |
| **4 · 01:02–01:47 · Post and metal gate** | Match the framing of the 2014 post. Hold for “मैंने भी यही बोला था।” Cut between the courtyard and the gate. Let the same music bridge both spaces. End on the lights flickering above Meera and a short electrical crackle. |

### Higgsfield coverage for Episode 4

| Scene | Build the scene from these shots | Continuity |
|---|---|---|
| E4 · 00:00–01:47 · Meera, post, gate | Veer leaves Devendra behind → marigolds and earrings → Meera’s gate → pendant on Raghav → Ananya’s phone photo → repeated maize-post framing → sparks at the gate → Meera under flickering lights. Use a static phone graphic in the edit. | On Meera the pendant is absent, on Raghav it is visible, and on Veer it causes the weakness. The 2014 and present post shots should match at a glance. |

## Episode 5 · एक Dance बाकी है · 1:48

### 00:00–00:08 · EXT. SCHOOL FAREWELL · NIGHT

Open on the same flickering lights. Nikhil pulls his hand off the gate when a teacher approaches. The lights come back. He waits for the teacher to walk away.

### 00:08–00:25 · EXT. MAIZE FIELD · NIGHT

Yash walks into the field with his phone light on. Veer hears him and manages to call out. Yash supports Veer while he loosens the ropes. The necklace falls clear. Veer straightens almost at once.

**YASH**  
वीर… तुम खड़े भी नहीं हो पा रहे थे।

**VEER**  
स्कूल में सब हैं। मुझे जाना होगा।

Yash bends to pick up the green stone. When he looks up, the corn is moving where Veer stood.

### 00:25–01:03 · EXT. SCHOOL SERVICE LANE · NIGHT

Nikhil reaches for the gate again. Veer grabs his wrist and pulls him away.

**NIKHIL**  
तुम्हें लेने कोई आ गया। मुझे लेने कोई नहीं आया था।

**VEER**  
आज तुमने मुझे वहाँ देखा। अंदर के बच्चों ने हम दोनों में से किसी को नहीं देखा। उन्हें जाने दो।

Nikhil sends a surge through Veer. Veer takes it and stays on his feet. Nikhil scrambles into a delivery pickup and drives at him. The pickup crashes through a low wall and bursts a water pipe. Water floods the cab. There’s a final flash, then Nikhil goes limp.

Veer tears open the door and pulls him clear. Nikhil comes to on the ground.

**NIKHIL**  
मैं यहाँ कैसे आया?

Veer looks toward the farewell. The lights are still on.

### 01:03–01:34 · INT. SHARMA BARN LOFT · NIGHT

Veer sits at the loft window. He hears a board creak. Meera is there in her farewell dress, wearing her mother’s earrings.

**MEERA**  
तुम आए नहीं।

**VEER**  
आया था। थोड़ी देर हो गई।

She holds out a hand.

**MEERA**  
मेरे वाले dance के लिए नहीं।

They dance. A car horn cuts across the music. Veer is alone in the loft. Outside, the real Meera has just been dropped off. She pauses at her gate before going in.

### 01:34–01:48 · EXT./INT. KUNAL’S CAR · NIGHT · NEXT-EPISODE TEASER

On the same country road, Kunal’s car crashes into a ditch. The small glass tanks on the back seat shatter. Kunal comes around and reaches for the door handle. An insect crawls over his knuckle. Another lands next to it.

Hold on Kunal as the buzzing swells.

**Cut to black.**

### Post-production cues for Episode 5

| Time and scene | Edit, music and sound |
|---|---|
| **5 · 00:00–01:03 · Rescue and confrontation** | Resume the same flicker and track position. Cut from the pendant hitting soil to Veer standing. Use effects and shorter cuts for the confrontation. Return to fuller courtyard ambience when Veer gets Nikhil clear. |
| **5 · 01:03–01:34 · Barn dance** | Warm the loft slightly for the imagined dance. Start the clean guitar when Meera offers her hand and bring in the wider arrangement once they move. The car horn cuts the score and returns us to the ordinary night. |
| **5 · 01:34–01:48 · Kunal teaser** | Use two or three angles: broken tank, Kunal waking and insect on wrist. Build the buzz with sound over a single visible insect. End before the swarm fills the frame. |

### Higgsfield coverage for Episode 5

| Scene | Build the scene from these shots | Continuity |
|---|---|---|
| E5 · 00:00–01:48 · Rescue, dance and teaser | Reuse the flicker → rope slackens → pendant hits soil → Veer stands. For the confrontation: contact → Veer holds his ground → headlights → burst water → Yash’s earlier rescue echoed by Veer dragging Nikhil clear. Return to the barn for the dance. End on the horn, then show Kunal waking in the crashed car and the insect on his hand. | Plot the gate, lane and barn eyelines. Use the horn to make the dream-to-reality cut clear. Save one clean shot of the insect and let sound suggest the swarm. |

## Final checks before export

1. **Story.** Watch once without captions. Can you tell what Meera loses, what the Sharmas find, and that the same boy grows up to become Veer? At the start of Episodes 2–5, check that viewers can place the new image or sound against the previous ending.
2. **Continuity.** Scrub in order for face drift, age changes, costume changes, the pendant’s location, car damage, and the angle of the ship hatch. Check any overlapping action frame by frame.
3. **Performance.** Record or cast one voice per character and preserve the natural Hinglish timing. Lip-sync the visible speaking angles with the final audio where supported. If the sync draws attention, cut to the listener or a motivated insert while keeping the original line.
4. **Sound.** Build location ambience first. Add distinct sounds for the market impact, metal hull, pickup, underwater cut, and farewell electricity. Use music selectively. Test dialogue and quiet cues on a phone speaker.
5. **Finalise.** Watch at 9:16 with subtitles on and off. Check spelling, subtitle placement, final black and episode length. Refine or upscale only the shots used in the locked cut. Preserve reference names, model, selected take and final trim so shots can be revised later.

## Reference

[Television Academy interview on the original pilot and opening theme](https://www.televisionacademy.com/features/online-originals/smallville-tom-welling-michael-rosenbaum)
