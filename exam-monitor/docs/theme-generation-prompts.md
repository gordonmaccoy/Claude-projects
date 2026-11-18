# Clean game theme artwork

Generated on 2026-11-18 with the built-in `image_gen` tool, one call per asset (21 calls). No CLI/API fallback, image compositing, or programmatic image editing was used. The user approved recreating the backgrounds because the supplied images contained baked-in quiz UI.

Source: `C:/Users/Admin/Desktop/examio/Examio-21-Themes.zip`. Each original PNG was inspected and provided as that asset's reference image. Extracted references remain in `.tmp/theme-references/` and are not serving assets. Final PNGs are in `public/game-themes/`; all are 1672 × 941 pixels, approximately 16:9.

## Prompt set

The table records the scene-specific prompt instructions. Every call additionally requested clean wide 16:9 landscape artwork, preserving the reference's illustrated style and palette, removing **all text, logos, headers/footers, timer, icons, question panel, answer buttons and UI outlines**, and reconstructing continuous scenery behind removed overlays. No lettering, floating panels, or baked-in controls were permitted. Quiet spacious centers were requested where suitable.

| Final asset | Scene prompt |
| --- | --- |
| `summer.png` | Red and cream striped awning, palm fronds, blue sunny sky, sparkling cyan swimming pool, beach ball and hibiscus bottom left, golden inflatable ring and flowers bottom right. Vibrant polished illustration. |
| `korea.png` | Korean hanok courtyard at dusk, dark tiled roof with ornate colorful dancheong eaves, glowing warm paper lattice windows, stone paved courtyard, cherry blossoms and garden lantern left, shrubs right. |
| `tropical-beach.png` | Turquoise tropical sea, pale sandy beach, gentle foam waves, blue sky, green palm fronds framing upper corners, palm shadows on sand and distant islands. |
| `winter.png` | Serene snowy mountain panorama at twilight, cool blue snowdrifts, distant alpine peaks, violet and pink dusk sky, frosty evergreen trees framing lower sides and delicate snowflakes. |
| `cyberpunk.png` | Futuristic city on a rainy night, skyscrapers, cyan and magenta neon, overhead railway left, wet reflective plaza, violet fog and deep navy shadows. City signage uses abstract light only, no letters. |
| `christmas.png` | Korean hanok courtyard on Christmas evening, dark tiled roof, golden lattice windows, pine garlands, gold fairy lights, red bows and red/gold baubles, garden lantern left and wrapped gifts bottom right. |
| `autumn.png` | Hanok courtyard in golden autumn, curved tiled roofs, warm lattice windows, red and orange maple leaves framing upper corners and left edge, stone lantern, fallen leaves on stone paving and amber sunset. |
| `clean-professional.png` | Uninterrupted off-white subtly textured field with crisp blue and slate navy diagonal accents restricted to top-right and bottom-left corners. No central panel. |
| `retro-arcade.png` | Deep indigo pixel-art universe, magenta/cyan neon, perspective grid floor, arcade cabinets at lower sides with simple pixel alien and heart designs, spaceship and ringed planet near upper corners, tiny pixel stars and subtle scanlines. Remove giant UI border; retain physical arcade machines. |
| `deep-ocean.png` | Navy ocean with turquoise surface sunbeams, sandy seabed caustics, glowing jellyfish lower left, cyan/purple bioluminescent corals, natural rock arch left, ray right, fish schools and bubbles. |
| `desert-sunset.png` | Orange sand dunes with wind ripples, sandstone rocks and sparse yucca at foreground edges, distant mesas, low golden sun, sweeping orange/gold/plum sunset clouds. |
| `forest-cabin.png` | Cozy timber cabin in evergreen forest, warm windows and lanterns, stone chimney and thin smoke, fir branches above, ferns and mossy rocks left, logs and lantern on stump right, stone terrace and cabin steps. |
| `art-deco.png` | Symmetrical black marble and brushed gold hall, luminous cream fan-shaped sunburst ornament, geometric sconces and gold trim, reflective marble floor with gold inlay, palms in gold pots at far sides. |
| `space-mission-control.png` | Dark metallic observation bridge, curved panoramic starfield window with subtle orbital arcs, blue/amber lights, physical consoles along lower edges with abstract circles and lights only, empty chairs and polished floor. No letters or numbers on consoles. |
| `spring-garden.png` | Sunny lush garden, pink/white cherry blossoms above, green trees and lawn, hydrangeas, daisies and tulips at lower edges, stone patio with petals and dappled sunlight. Remove decorative UI crest/arch too and reconstruct natural garden. |
| `sports-arena.png` | Football stadium at night, white floodlight towers at sides, sweeping crowded stands, navy sky, striped green pitch and white midfield circle. Remove the entire metallic scoreboard-style UI frame; no scoreboard or advertisements. |
| `fireworks.png` | Navy starry sky over tranquil lake, gold/pink/electric-blue fireworks at upper sides and distant shore, low mountain silhouette, tiny gold shore lights and colored reflections. Spacious dark center. |
| `shades-of-blue.png` | Midnight navy field with translucent flowing blue ribbon waves at upper/lower edges, royal blue gradients and thin cyan highlights. Quiet dark center. |
| `shades-of-pink.png` | Burgundy-magenta field with smooth satin-like rose ribbons and highlighted sweeping curves at top/bottom. Quiet wine-colored center. |
| `shades-of-green.png` | Dark forest green field with subtle emerald organic contour waves and understated gradients. Minimal serene open center. |
| `shades-of-purple.png` | Aubergine/violet geometric room, glowing angular architectural edges receding in perspective, broad low steps below, faceted side walls, dark open center. |

## Verification

All 21 generated images were visually inspected in the tool outputs for their intended scenery and absence of quiz text/UI. File inspection confirmed 21 readable PNGs with matching 1672 × 941 dimensions. Originals in the generated-images directory were retained and selected outputs copied into this project.

These files contain backgrounds only. Application logos, questions, answer tiles, timers, score displays, and interaction must be rendered separately by the app. PNG masters are intentionally retained without lossy conversion.
