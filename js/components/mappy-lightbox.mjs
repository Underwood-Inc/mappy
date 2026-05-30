/**
 * `<mappy-lightbox>` — singleton overlay that enlarges any image tagged with
 * `data-lightbox` when clicked.
 *
 * Usage: just place `<mappy-lightbox></mappy-lightbox>` once in the document.
 * Any `<img data-lightbox>` (or its closest `.showcase__shot` wrapper) will
 * open it on click.
 *
 * CLAD tier: Atom (pure DOM behaviour, no external deps)
 */

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

class MappyLightbox extends HTMLElement {
  /** @type {HTMLImageElement | null} */ #img = null;
  /** @type {HTMLElement | null} */ #caption = null;
  /** @type {((e: Event) => void) | null} */ #onClick = null;
  /** @type {((e: KeyboardEvent) => void) | null} */ #onKeydown = null;

  connectedCallback() {
    this.innerHTML = `
      <div class="lightbox__backdrop" aria-hidden="true"></div>
      <div class="lightbox__dialog" role="dialog" aria-modal="true" aria-label="Image preview">
        <button class="lightbox__close" aria-label="Close preview" type="button">&#x2715;</button>
        <img class="lightbox__img" alt="" />
        <p class="lightbox__caption"></p>
      </div>`;

    this.#img      = this.querySelector('.lightbox__img');
    this.#caption  = this.querySelector('.lightbox__caption');

    this.#onClick = (e) => {
      const target = /** @type {HTMLElement} */ (e.target);

      // Close on backdrop or close button click
      if (target.closest('.lightbox__backdrop') || target.closest('.lightbox__close')) {
        this.#close();
        return;
      }

      // Open on data-lightbox image click (or click inside its shot wrapper)
      const img = target.closest('[data-lightbox]') ?? target.closest('.showcase__shot')?.querySelector('[data-lightbox]');
      if (img instanceof HTMLImageElement) {
        this.#open(img);
      }
    };

    this.#onKeydown = (e) => {
      if (this.hasAttribute('open') && (e.key === 'Escape' || e.key === 'Esc')) {
        this.#close();
      }
    };

    document.addEventListener('click', this.#onClick);
    document.addEventListener('keydown', this.#onKeydown);
  }

  disconnectedCallback() {
    if (this.#onClick)   document.removeEventListener('click', this.#onClick);
    if (this.#onKeydown) document.removeEventListener('keydown', this.#onKeydown);
    document.body.classList.remove('lightbox-open');
  }

  /** @param {HTMLImageElement} img */
  #open(img) {
    if (!this.#img || !this.#caption) return;
    // If mid-close animation, snap close immediately then open fresh.
    if (this.hasAttribute('data-closing')) {
      this.removeAttribute('data-closing');
      this.removeAttribute('open');
      document.body.classList.remove('lightbox-open');
    }
    this.#img.src = img.src;
    this.#img.alt = img.alt;
    const fig = img.closest('figure');
    const captionText = fig?.querySelector('figcaption')?.textContent?.trim() ?? '';
    this.#caption.textContent = captionText;
    this.#caption.hidden = !captionText;

    const instant = REDUCED_MOTION.matches;
    if (instant) this.setAttribute('data-instant', '');
    else this.removeAttribute('data-instant');

    this.setAttribute('open', '');
    document.body.classList.add('lightbox-open');

    // Return focus to close button
    /** @type {HTMLElement | null} */ (this.querySelector('.lightbox__close'))?.focus();
  }

  #close() {
    if (!this.hasAttribute('open')) return;
    if (this.hasAttribute('data-closing')) return; // already animating out

    if (REDUCED_MOTION.matches) {
      this.removeAttribute('open');
      document.body.classList.remove('lightbox-open');
      return;
    }

    // Animate out: add data-closing → CSS plays fade-out, then we remove [open].
    this.setAttribute('data-closing', '');
    const backdrop = this.querySelector('.lightbox__backdrop');
    const onEnd = () => {
      this.removeAttribute('data-closing');
      this.removeAttribute('open');
      document.body.classList.remove('lightbox-open');
    };
    if (backdrop) {
      backdrop.addEventListener('animationend', onEnd, { once: true });
      // Safety: if animationend never fires, close after the declared duration.
      const dur = parseFloat(getComputedStyle(backdrop).animationDuration) * 1000 || 0;
      setTimeout(onEnd, dur + 60);
    } else {
      onEnd();
    }
  }
}

customElements.define('mappy-lightbox', MappyLightbox);
