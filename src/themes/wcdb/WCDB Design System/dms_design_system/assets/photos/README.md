# Photos — real WCDB material, for the mockups

Downloaded 2026-08-10 from the station's own picture library at
`http://wcdbfm.com/picture_library/<yyyy>/<mm>/<dd>/<file>` (the legacy site's
**Pictures** page). The thumbnails listed in that page's markup sit under a
`/Thumb/` segment; **drop that segment** and you get the full-size original.

## The five in rotation

`mockup.js` swaps the home page's on-air photo among these on every load, so the
panel is exercised against varied real content instead of one lucky crop.

| File | Source path | Album |
|---|---|---|
| `live-spring-show-2024.jpg` | `2024/04/26/DSC00805.JPG` | Spring Show 2024 |
| `live-spring-show-2023.jpg` | `2023/04/21/P4219884.JPG` | WCDB Spring Show 2023 |
| `live-fall-show-2023.jpg` | `2023/11/17/PB179940.JPG` | WCDB Fall Show 2023 |
| `live-battle-of-the-bands-2024.jpg` | `2024/03/08/DSC00372.JPG` | Battle of the Bands 2024 |
| `in-studio-thelastmiller.jpg` | `2024/04/21/DSC00731.JPG` | thelastmiller |

Chosen for one reason: they survive being a **dark, scrimmed, full-bleed
panel** with display type over the lower third. Mean luma runs 23–94 — the
brighter group portraits in the same library (Halobite, Flatwounds, the block
parties) sit at 135–171 and fight the type, so they are not in the set. If you
add one, check it at the same crop before trusting it.

To pull more, fetch `http://wcdbfm.com/Photos.aspx` and read the
`picture_library/...` paths out of the markup.

## Adding or changing the rotation

One line in the `PHOTOS` array at the top of `../../mockup.js`. Nothing else.

## Not covered here

Cover art for the now-playing track. The player's 92px slot is sized for it and
ships a placeholder. The playlist dataset it would come from is not in the
`wcdb`/`prod` DMS env — `dms dataset list` there returns only WCDB Schedule,
WCDB DJs and WCDB Schedule times — so the real source still needs locating.
