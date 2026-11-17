# Radioklub Karlovac — static site

Static site for **radioklub-karlovac.hr**, hosted on GitHub Pages.
No server-side code — pure HTML/CSS/JS. News posts are written in Markdown and
turned into pages by a small build script, automatically deployed by GitHub Actions.

## Dodavanje nove objave

1. Napravi datoteku `content/novosti/moj-naslov.md` (ime datoteke postaje URL, npr.
   `/novosti/moj-naslov/`).
2. Sadržaj:

   ```markdown
   ---
   title: "Naslov objave"
   date: 2026-11-20
   image: user/data/media/uploads/2026/11/foto.jpg
   ---

   Tekst objave u Markdownu. **Podebljano**, *kurziv*, [link](https://primjer.hr).

   - prva točka
   - druga točka

   ![Opis slike](user/data/media/uploads/2026/11/druga-foto.jpg)
   ```

   - `title` i `date` su obavezni (`date` u formatu `GGGG-MM-DD`).
   - `image` je naslovna slika (kartica na naslovnici). Može se izostaviti.
   - Opcionalno `excerpt: "Kratki sažetak"` — inače se automatski uzima početak teksta.
   - Opcionalno `slug: drugi-url` — ako URL treba biti drukčiji od imena datoteke.
3. Slike kopiraj u `user/data/media/uploads/GGGG/MM/` i referenciraj ih putanjom
   `user/data/media/uploads/...` (build sam doda ispravne relativne putanje).
4. Commit i push na `main` — GitHub Actions automatski generira stranicu, ažurira
   popis novosti i naslovnicu te objavi stranicu (1–2 minute).

Isto možeš napraviti i direktno na GitHubu: **Add file → Create new file**, zalijepi
sadržaj, **Commit changes**. Slike se dodaju kroz **Add file → Upload files**.

## Lokalni pregled

```sh
npm ci          # jednom
node build.mjs  # generiraj stranice iz content/
python -m http.server 8000   # pa otvori http://localhost:8000
```

## Struktura

- `content/novosti/*.md` — izvor objava (Markdown)
- `build.mjs` — generator: članci, popis novosti, kartice na naslovnici
- `novosti/<slug>/index.html`, `novosti/index.html`, `index.html` — generirani HTML
  (ne uređivati ručno; prepisat će se pri buildu)
- `povijest-kluba/`, `prostorije-kluba/`, `galerija/`, `lorawan/`, `kontakt/` — statične
  stranice (uređuju se ručno)
- `user/themes/radioklub/` — tema (CSS/JS, uključuje lightbox galerije)
- `user/data/media/` — slike i PDF-ovi (optimizirano: max 2560 px, JPEG q85)
- `CNAME` — custom domena; postavi je i u **Settings → Pages → Custom domain**
- `404.html` — stranica za nepostojeće URL-ove

## Objava (GitHub Pages)

- **Settings → Pages → Build and deployment → Source: GitHub Actions**.
- Svaki push na `main` pokreće `.github/workflows/deploy.yml` (build + deploy).
- Custom domena `radioklub-karlovac.hr`: 4 `A` zapisa za `@` →
  `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`;
  `CNAME` za `www` → `t00manysecrets.github.io`. Zatim uključi **Enforce HTTPS**.

## Povijest

Stranica je izvorno bila Grav CMS na vlastitom poslužitelju. HTML je preslikan u
statički oblik (relativne putanje, bez PHP-a), a objave su pretvorene u Markdown.
Skripte za preslikavanje (`mirror.mjs`, `optimize.py`) nalaze se izvan repozitorija.
