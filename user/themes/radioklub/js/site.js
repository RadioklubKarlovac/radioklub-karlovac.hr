(() => {
  const selector = [
    'a[data-lightbox-item]',
    '.gallery-figure a[href*="/user/data/media/"]',
    '.article div[id^="foogallery-gallery"] a[href*="/user/data/media/"]',
    '.wp-block-gallery a[href*="/user/data/media/"]',
    '.wp-block-responsive-lightbox-gallery a[href*="/user/data/media/"]'
  ].join(',');

  const links = Array.from(document.querySelectorAll(selector))
    .filter((link) => /\.(jpe?g|png|webp|avif)(\?.*)?$/i.test(link.getAttribute('href') || ''));

  if (!links.length) return;

  const items = links.map((link) => {
    const img = link.querySelector('img');
    return {
      href: link.href,
      caption: link.dataset.caption || img?.alt || '',
      thumb: img?.currentSrc || img?.src || ''
    };
  });

  document.body.insertAdjacentHTML('beforeend', `
    <div class="lightbox" hidden>
      <button class="lightbox-close" type="button" aria-label="Zatvori">&times;</button>
      <button class="lightbox-nav lightbox-prev" type="button" aria-label="Prethodna slika">&#8249;</button>
      <figure class="lightbox-stage">
        <img alt="">
        <figcaption>
          <span class="lightbox-caption"></span>
          <span class="lightbox-count"></span>
        </figcaption>
      </figure>
      <button class="lightbox-nav lightbox-next" type="button" aria-label="Sljedeća slika">&#8250;</button>
    </div>
  `);

  const overlay = document.querySelector('.lightbox');
  const image = overlay.querySelector('img');
  const caption = overlay.querySelector('.lightbox-caption');
  const count = overlay.querySelector('.lightbox-count');
  const closeButton = overlay.querySelector('.lightbox-close');
  const prevButton = overlay.querySelector('.lightbox-prev');
  const nextButton = overlay.querySelector('.lightbox-next');
  let current = 0;
  let touchStartX = 0;

  const show = (index) => {
    current = (index + items.length) % items.length;
    const item = items[current];
    image.src = item.href;
    image.alt = item.caption;
    caption.textContent = item.caption;
    count.textContent = `${current + 1} / ${items.length}`;
  };

  const open = (index) => {
    show(index);
    overlay.hidden = false;
    document.body.classList.add('lightbox-open');
    closeButton.focus();
  };

  const close = () => {
    overlay.hidden = true;
    document.body.classList.remove('lightbox-open');
    image.removeAttribute('src');
  };

  links.forEach((link, index) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      open(index);
    });
  });

  closeButton.addEventListener('click', close);
  prevButton.addEventListener('click', () => show(current - 1));
  nextButton.addEventListener('click', () => show(current + 1));
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  overlay.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });
  overlay.addEventListener('touchend', (event) => {
    const delta = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 45) show(current + (delta < 0 ? 1 : -1));
  }, { passive: true });

  document.addEventListener('keydown', (event) => {
    if (overlay.hidden) return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });
})();
