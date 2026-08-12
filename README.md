# Street Map — Marketing Planner

A metro-style map of streets and shops, with commission splitting. Standalone: it shares nothing
with the AC service app beyond the database server.

- **backend/** — Express + Mongoose REST API (port 5100)
- **frontend/** — Next.js 14 map UI (port 3000)

There is no login. Anyone who can reach the URL can edit the map.

## Running it

```bash
# terminal 1
cd backend && npm install && npm run dev

# terminal 2
cd frontend && npm install && npm run dev
```

Open http://localhost:3000.

## Configuration

`backend/.env` — `PORT` and `MONGODB_URI`.
`frontend/.env.local` — `NEXT_PUBLIC_API_URL`, e.g. `http://localhost:5100/api`.

The `MONGODB_URI` may point at the same database as another app: every collection here is
prefixed `map_` (`map_streets`, `map_shops`, `map_sections`, `map_commission_settings`), so
nothing collides.

## The map

Streets are lines, shops are their stations. A shop linked to two streets is a **corner** and is
drawn with a much heavier ring, because it joins the two lines at a single point.

Each street keeps its own lane. Only a shared shop leaves that lane, and the line detours to touch
it and comes back — so a street never runs through shops that are not on it.

Colours are assigned automatically from a fixed 20-colour palette, walking it in order so
consecutive streets look distinct. You can override a street's colour from the swatch grid.

## The shop menu

Click any shop on the map:

| Action | What it does |
| --- | --- |
| View settings | Banner, proximity, street count |
| Edit shop | Opens the full shop form |
| Add a crossing street here | Two steps — name the street, then set distance (at the crossing / 5 m / 15 m) and which side |
| Mark as street ending | Flags a shop that terminates the street rather than sitting mid-run; drawn with a square |
| Add a street between 2 shops | Names a new street and picks the other end off the map |
| Add shop on the left / right | Inserts a shop beside this one, halfway to the next neighbour |

On a vertical street the side actions read "above" and "below" instead.

## Commission

Weight = **banner points × proximity percent**. Large is 2 points, medium 1, none 0. At the
crossing counts 100%, 5 m away 70%, 15 m away 20%.

Each shop takes `weight / total weight` of the amount, so the full sum is always paid out. Four
large banners and one medium splitting 50 gives 11.11 each and 5.56, from a 9-point pool. Rounding
drift lands on the largest share so the payout reconciles exactly.

Points and percentages are editable on the Commission page.

## Notes

- Deleting a street unhooks it from every shop and removes its sections; the shops survive.
- A shop that is an endpoint of a section cannot be deleted until that section is removed.
- Nothing about a commission calculation is stored — the page is a calculator, not a ledger.
