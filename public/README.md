# Static assets

Everything here is optional at build time. The application renders correctly
with all of it missing — that is deliberate, so the platform can ship before
Al-Murshid has final art direction.

## `images/products/`  — ⚙️ CONFIGURE

Product photography, named to match `products.hero_image_path` in the database
(e.g. `iphone-18-pro-max.png`). Transparent PNG or WebP, roughly 900×1900,
the device centred with generous padding.

**Missing?** `DeviceVisual` catches the load error and draws an original
abstract device instead, tinted with the selected colour. Nothing breaks and no
broken-image icon appears. Dropping the real files in upgrades every surface
with no code change.

Per-colour images are supported too: set `colors.image_path` and the colour
selector will use them.

## `models/iphone.glb`  — ⚙️ CONFIGURE

The 3D model for the 360° viewer, referenced by `products.model_3d_path`.

- Keep it under ~5 MB — it is downloaded on a phone, on Libyan mobile data.
- Draco-compress if the source is heavy.
- Name the body/frame materials with `body`, `frame`, `case`, `back` or `rail`
  so the viewer can re-tint them to the selected colour and leave glass and
  lenses alone.

**Missing?** The viewer section shows the still image and a quiet
"العرض ثلاثي الأبعاد سيتوفر قريبًا" note. The model is never fetched, so its
absence costs nothing.

## `images/og.png`

Social sharing card, 1200×630. An original branded card is included; replace it
if you have art direction. Referenced from `config/site.ts`.

## `icons/`

App icons generated from the Al-Murshid compass mark. `app/icon.svg` and
`app/apple-icon.png` are picked up automatically by Next.js.
