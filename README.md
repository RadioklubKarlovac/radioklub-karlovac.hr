# Radioklub Karlovac — static site

Static HTML mirror of https://radioklub-karlovac.hr/ (originally Grav CMS),
prepared for GitHub Pages. No server-side code — pure HTML/CSS/JS.

## Contents

- `index.html` — homepage
- `povijest-kluba/`, `prostorije-kluba/`, `galerija/`, `lorawan/`, `novosti/`, `kontakt/` — sections (clean URLs via `index.html`)
- `user/themes/radioklub/` — theme CSS/JS (incl. gallery lightbox)
- `user/data/media/` — images and PDFs referenced by the pages (optimized: max 2560 px, JPEG q85)
- `CNAME` — custom domain for GitHub Pages
- `404.html` — not-found page
- `.nojekyll` — disables Jekyll processing on GitHub Pages

## Deploy to GitHub Pages

1. Create an empty repository on GitHub (no README, no .gitignore).
2. From this folder:
   ```sh
   git init
   git add .
   git commit -m "Static site"
   git branch -M main
   git remote add origin https://github.com/<username>/<repo>.git
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   branch `main`, folder `/ (root)`.
4. Custom domain is preconfigured via `CNAME` (`radioklub-karlovac.hr`).
   At your DNS provider point the domain at GitHub Pages:
   - `A` records for `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` for `www`: `<username>.github.io`
   Then enable **Enforce HTTPS** in Settings → Pages once DNS propagates.

Note: until DNS is switched, the site is also reachable at
`https://<username>.github.io/<repo>/` — all internal links are relative and work there too
(the 404 page uses root-absolute links and is intended for the custom domain).

## Updating the site

The mirror was generated with `../mirror.mjs` (crawls the live Grav site, rewrites links
to relative paths). To refresh content while the old server is still running:

```sh
node ../mirror.mjs        # re-downloads into ./site (overwrites)
python ../optimize.py     # re-optimizes images
```

Then commit and push. Once the old server is retired, edit the HTML files directly.
