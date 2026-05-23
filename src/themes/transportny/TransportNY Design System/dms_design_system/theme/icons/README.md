# TransportNY · icon SVG sources

The icon set is delivered as React components in `../icons.js`. Each
icon is on a 24×24 grid, stroke="currentColor", strokeWidth=1.5, rounded
caps and joins.

If you need standalone `.svg` files (e.g. for a CMS asset library or a
non-React consumer), generate them from `icons.js` by extracting each
component's path attributes — every icon is a single `svg(...)` call so
the conversion is mechanical.

The full set:

| Name           | Use                                                |
|----------------|----------------------------------------------------|
| Pages          | Sidebar "Home" / pages nav                         |
| Sections       | Sections / page tree                               |
| Settings       | Settings / admin                                   |
| History        | Schedules / history                                |
| Search         | Sidebar search button                              |
| Database       | Data sources                                       |
| Menu           | Mobile nav toggle                                  |
| CaretDown/Up   | Dropdown carets                                    |
| ChevronL/R/U/D | Page navigation, expand/collapse                   |
| ArrowL/R/U/D   | "Continue", breadcrumb home, in-content arrows     |
| User           | User block in sidenav, sign-in pill                |
| Logo           | NYS shield placeholder                             |
| PencilEdit     | Edit affordance                                    |
| View           | View / preview                                     |
| Plus           | Add section / chart / route                        |
| Minus          | Remove                                             |
| XMark          | Close / remove pill                                |
| Check          | Selected option                                    |
| CircleCheck    | Confirmed / passing                                |
| Filter         | Filter chrome                                      |
| Download       | Export                                             |
| More           | Section / column menu (3-dot)                      |
| Drag           | Drag handles                                       |
| MapLayers      | Map / route analysis                               |
| MapPin         | Macro / location                                   |
| Activity       | PM3 / metrics                                      |
| Grid           | Grid view toggle                                   |
| SortAsc        | Sort column                                        |
| Bell           | Notifications                                      |
| Play / Pause   | Stream control (where applicable)                  |

Add brand-specific icons by registering them in `icons.js` and
referencing them by name in your theme — the registry is open.
