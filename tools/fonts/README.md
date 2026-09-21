# Fonts

The card sets its type in **[Mona Sans](https://github.com/github/mona-sans)** —
GitHub's own typeface, so the card speaks the same typographic language as the
profile page around it.

Files here are subsets: they contain only the glyphs `charset.txt` lists, which
in turn is generated from everything the card actually prints. That keeps each
face at ~14 KB instead of ~140 KB, small enough to embed straight into the SVG
as base64 woff2 — no external font request, no CDN, and the same typography
everywhere (GitHub's own SVG renderer does not fetch remote fonts, so embedding
is the only way the file looks right there).

| file | role |
|:--|:--|
| `MonaSans-Regular.subset.ttf` / `.woff2` | weight 400 — body copy, headline, labels |
| `MonaSans-SemiBold.subset.ttf` / `.woff2` | weight 600 — the name, About/Languages headings |
| `charset.txt` | the exact character set the card prints |
| `OFL.txt` | Mona Sans licence (SIL Open Font License 1.1) |

## Rebuilding a subset

Needs `fonttools` + `brotli` (`pip install fonttools brotli`) and the upstream
static TTFs from the `github/mona-sans` repository.

```sh
python3 -m fontTools.subset MonaSans-Regular.ttf \
  --text-file=charset.txt --name-IDs='*' \
  --layout-features='kern,liga,calt' \
  --output-file=MonaSans-Regular.subset.ttf
```

`tools/build-assets.mjs` warns at build time if the card ever prints a
character that is missing from `charset.txt`, so a subset only needs a rebuild
when the copy changes.

Mona Sans is licensed under the SIL Open Font License 1.1 — see `OFL.txt`.
