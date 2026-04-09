# Fonts

This site is set up to load a **subsetted** custom font for fast first render.

## Expected output files (committed)

- `assets/fonts/CustomSans-latin-subset.woff2` (primary)
- `assets/fonts/CustomSans-latin-subset.woff` (fallback)

These filenames are referenced by `style.css` and preloaded in `index.html`.

## How to generate the subset (Windows / PowerShell)

1) Put your source font file somewhere convenient (example: `assets/fonts/source/Inter.ttf`).

2) Install Python dependencies:

```powershell
py -m pip install -r requirements.txt
```

3) Generate subset + compressed WOFF2/WOFF:

```powershell
py tools/subset-fonts.py --input "assets/fonts/source/YourFont.ttf" --family "CustomSans"
```

### Best compression (recommended)

If you know exactly which characters you need (for example only English UI), pass `--text`:

```powershell
py tools/subset-fonts.py --input "assets/fonts/source/YourFont.ttf" --family "CustomSans" --text "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?'-"
```

## Notes

- Prefer **WOFF2** for performance; TTF/EOT are significantly larger and mainly legacy.
- `font-display: swap` is enabled to prevent invisible text while the font loads.
