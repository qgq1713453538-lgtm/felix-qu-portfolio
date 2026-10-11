'use strict';

(() => {
  const start = () => {
    const locale = document.body.dataset.locale === 'en' ? 'en' : 'zh';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(pointer: fine)');
    const portfolio = document.querySelector('#portfolio');
    const folio = portfolio?.matches('.folio') ? portfolio : portfolio?.querySelector('.folio');
    const pages = folio ? [...folio.querySelectorAll('section.folio-page')] : [];
    const turns = portfolio ? [...portfolio.querySelectorAll('button[data-turn]')] : [];
    const dots = portfolio ? [...portfolio.querySelectorAll('.folio-dots button[data-page]')] : [];
    const nav = [...document.querySelectorAll('.site-header nav a[href]')];
    const resumeSection = document.getElementById('resume');
    const status = portfolio?.querySelector('.folio-status');
    const dialog = document.querySelector('.lightbox');
    let current = 0;
    let transition = null;
    let scrollFrame = 0;
    let handledHash = window.location.hash;
    let resumeInView = false;
    let resetWheelForPageChange = () => {};
    let bookActive = false;
    let lockedScrollY = 0;
    const header = document.querySelector('.site-header');
    const background = [...document.querySelectorAll('.hero, #resume, .resume-bridge, footer')];
    const inertBeforeBook = new Map();
    const bookAnchor = document.createElement('div');
    bookAnchor.className = 'folio-anchor';
    const headerSpacer = document.createElement('div');
    headerSpacer.className = 'book-header-spacer';
    headerSpacer.hidden = true;
    headerSpacer.setAttribute('aria-hidden', 'true');
    if (folio) { folio.before(bookAnchor); bookAnchor.append(folio); }
    header?.after(headerSpacer);

    const isAvailable = element => Boolean(element?.isConnected && !element.closest('[hidden], [inert]') && !element.disabled);
    const sectionFor = id => {
      if (id === 'game' || id === 'game-props') return 'game';
      if (id === 'process') return 'process';
      if (id === 'contact') return 'resume';
      return 'commercial';
    };
    const decodeHash = hash => {
      try { return decodeURIComponent(String(hash).replace(/^#/, '')); }
      catch (_) { return String(hash).replace(/^#/, ''); }
    };
    const resolve = target => {
      if (typeof target === 'number') return Number.isInteger(target) && target >= 0 && target < pages.length ? target : -1;
      const id = decodeHash(target);
      let index = pages.findIndex(page => page.id === id);
      if (index < 0) {
        const element = document.getElementById(id);
        const page = element?.closest('.folio-page');
        if (page && folio?.contains(page)) index = pages.indexOf(page);
      }
      // The course article lives inside the commercial page in the DOM contract.
      if (index < 0 && id === 'course-case') index = pages.findIndex(page => page.id === 'commercial');
      return index;
    };
    const focusHeading = index => {
      const page = pages[index];
      if (!page || page.hidden) return;
      const heading = page.querySelector('h2') || page;
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    };
    const cancelTransition = () => {
      transition?.cancel();
      transition = null;
      folio?.classList.remove('is-turning');
    };
    const headerOffset = () => header ? header.getBoundingClientRect().height + 28 : 16;
    const updateBookViewport = () => {
      const height = bookActive ? header?.getBoundingClientRect().height || 0 : headerOffset();
      document.documentElement.style.setProperty('--book-header-height', `${height}px`);
    };
    const enterBook = () => {
      if (!folio || bookActive) return;
      cancelAnimationFrame(scrollFrame);
      scrollFrame = 0;
      const targetY = Math.max(0, scrollY + bookAnchor.getBoundingClientRect().top - headerOffset());
      if (header) {
        const style = getComputedStyle(header);
        headerSpacer.style.height = `${header.getBoundingClientRect().height + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0)}px`;
        headerSpacer.hidden = false;
      }
      bookActive = true;
      document.body.classList.add('book-active');
      document.documentElement.classList.add('book-locked');
      background.forEach(element => {
        inertBeforeBook.set(element, element.inert);
        element.inert = true;
      });
      updateBookViewport();
      window.scrollTo({ top: targetY, behavior: 'instant' });
      lockedScrollY = scrollY;
      resumeInView = false;
      syncNavigation();
      // The pointer may stay anywhere in the viewport throughout the book.
      if (background.some(element => element.contains(document.activeElement))) focusHeading(current);
    };
    const leaveBook = (destination, options = {}) => {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = 0;
      if (bookActive) {
        bookActive = false;
        document.body.classList.remove('book-active');
        document.documentElement.classList.remove('book-locked');
        headerSpacer.hidden = true;
        background.forEach(element => { element.inert = inertBeforeBook.get(element) || false; });
        inertBeforeBook.clear();
        updateBookViewport();
      }
      writeHash(destination, options.history || 'push');
      const target = destination === 'resume' ? resumeSection : document.getElementById('top');
      const y = destination === 'resume' && target ? scrollY + target.getBoundingClientRect().top - headerOffset() : 0;
      window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
      resumeInView = destination === 'resume';
      syncNavigation();
      if (options.focus && target) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    };
    const scrollToPortfolio = () => enterBook();
    const writeHash = (hash, mode = 'push') => {
      if (!hash || mode === 'none') return;
      const value = '#' + decodeHash(hash);
      if (window.location.hash === value) {
        handledHash = value;
        return;
      }
      try {
        const method = mode === 'replace' ? 'replaceState' : 'pushState';
        window.history[method](null, '', window.location.href.split('#')[0] + value);
      } catch (_) {
        window.location.hash = value;
      }
      handledHash = window.location.hash;
    };
    const syncNavigation = () => {
      const section = !bookActive && resumeInView ? 'resume' : sectionFor(pages[current]?.id);
      nav.forEach(link => {
        const active = decodeHash(link.hash) === section;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    const syncControls = () => {
      turns.forEach(button => {
        const disabled = button.dataset.turn === 'prev' ? current === 0 : current === pages.length - 1;
        button.disabled = disabled;
      });
      dots.forEach(button => {
        const active = Number(button.dataset.page) === current;
        button.classList.toggle('is-active', active);
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      });
      portfolio.querySelectorAll('.folio-current').forEach(node => { node.textContent = String(current + 1).padStart(2, '0'); });
      portfolio.querySelectorAll('.folio-total').forEach(node => { node.textContent = String(pages.length).padStart(2, '0'); });
      const title = pages[current].dataset.pageTitle || pages[current].querySelector('h2')?.textContent.trim() || pages[current].id;
      portfolio.querySelectorAll('.folio-current-title').forEach(node => { node.textContent = title; });
      const mode = portfolio.querySelector('.folio-mode');
      if (mode) mode.textContent = current === pages.length - 1
        ? (locale === 'en' ? 'Scroll down for my resume' : '继续下滚查看简历')
        : (locale === 'en' ? 'Scroll to turn · Select images to zoom' : '滚轮翻页 · 点击图片放大');
      syncNavigation();
      return title;
    };
    const showPage = (index, options = {}) => {
      if (!folio || !pages[index]) return false;
      const previous = current;
      const changed = index !== previous;
      const active = document.activeElement;
      const focusWouldBeHidden = pages.some((page, i) => i !== index && page.contains(active));
      cancelTransition();
      // Reveal the destination before hiding anything that may currently hold focus.
      pages[index].hidden = false;
      pages[index].inert = false;
      pages[index].removeAttribute('inert');
      pages[index].removeAttribute('aria-hidden');
      pages[index].scrollTop = 0;
      current = index;
      pages.forEach((page, i) => {
        const visible = i === index;
        page.classList.toggle('is-current', visible);
        if (!visible) {
          page.hidden = true;
          page.inert = true;
          page.setAttribute('inert', '');
          page.setAttribute('aria-hidden', 'true');
          page.querySelectorAll('video, audio').forEach(media => {
            if (!media.paused) media.pause();
          });
        }
      });
      folio.dataset.currentPage = String(index);
      folio.classList.add('is-ready');
      const title = syncControls();
      if (options.focus || focusWouldBeHidden) focusHeading(index);
      else if (turns.includes(active) && active.disabled) {
        // A native disabled button loses focus in Chromium at the first/last
        // page. Keep keyboard navigation within the same control group.
        dots.find(button => Number(button.dataset.page) === index)?.focus({ preventScroll: true });
      }
      writeHash(options.hash || pages[index].id, options.history || 'none');
      if (options.scroll) scrollToPortfolio();
      if (status && (changed || options.announce)) {
        status.textContent = locale === 'en' ? `${title}. Page ${index + 1} of ${pages.length}.` : `${title}，第 ${index + 1} 页，共 ${pages.length} 页。`;
      }
      if (changed && !reducedMotion.matches && options.animate !== false && typeof pages[index].animate === 'function') {
        const direction = index > previous ? 1 : -1;
        folio.classList.add('is-turning');
        const animation = pages[index].animate([
          { opacity: 0, transform: `perspective(1200px) translateX(${direction * 24}px) rotateY(${-direction * 6}deg)` },
          { opacity: 1, transform: 'perspective(1200px) translateX(0) rotateY(0deg)' }
        ], { duration: 240, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'none' });
        transition = animation;
        animation.finished.then(() => {
          if (transition === animation) {
            transition = null;
            folio.classList.remove('is-turning');
          }
        }).catch(() => {}); // Cancellation is normal during rapid navigation.
      }
      folio.dispatchEvent(new CustomEvent('folio:change', {
        bubbles: true, detail: { index, id: pages[index].id, title, section: sectionFor(pages[index].id), total: pages.length }
      }));
      resetWheelForPageChange(options.source === 'wheel');
      return true;
    };

    if (pages.length) {
      if (status) {
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.setAttribute('aria-atomic', 'true');
      }
      const initial = resolve(window.location.hash);
      showPage(initial < 0 ? 0 : initial, { animate: false, announce: false });
      updateBookViewport();
      if (initial >= 0) requestAnimationFrame(enterBook);
      // A resume deep link points below the book, without selecting another page.
      if (initial < 0 && decodeHash(window.location.hash) === 'resume' && resumeSection) {
        requestAnimationFrame(() => leaveBook('resume', { history: 'none' }));
      }
      turns.forEach(button => button.addEventListener('click', () => {
        if (button.disabled) return;
        const index = current + (button.dataset.turn === 'prev' ? -1 : 1);
        showPage(index, { history: 'push', scroll: true, animate: true });
      }));
      dots.forEach(button => button.addEventListener('click', () => {
        showPage(Number(button.dataset.page), { history: 'push', scroll: true, animate: true });
      }));
      document.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.target.closest('a[href]');
        if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
        let url;
        try { url = new URL(link.href, window.location.href); }
        catch (_) { return; }
        if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.search !== window.location.search) return;
        resetWheelForPageChange(false);
        const index = resolve(url.hash);
        if (index < 0) {
          const destination = decodeHash(url.hash);
          if (destination === 'resume' || destination === 'top') {
            event.preventDefault();
            leaveBook(destination, { focus: true });
          }
          return;
        }
        event.preventDefault();
        showPage(index, { hash: url.hash, history: 'push', scroll: true, focus: true, animate: true });
      });
      const onLocationChange = () => {
        if (window.location.hash === handledHash) return;
        resetWheelForPageChange(false);
        handledHash = window.location.hash;
        const index = resolve(window.location.hash);
        if (index >= 0) showPage(index, { scroll: true, animate: true });
        else if (decodeHash(window.location.hash) === 'resume' && resumeSection) {
          leaveBook('resume', { history: 'none', focus: true });
        }
        else if (!window.location.hash || decodeHash(window.location.hash) === 'top') leaveBook('top', { history: 'none', focus: true });
      };
      window.addEventListener('hashchange', onLocationChange);
      window.addEventListener('popstate', onLocationChange);
      portfolio.addEventListener('keydown', event => {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || dialog?.open) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest('input, textarea, select, video, audio, dialog, a, [contenteditable=""], [contenteditable="true"], [role="slider"], [data-image]')) return;
        const controls = Boolean(target.closest('.folio-toolbar, .folio-dots, [data-turn]'));
        const page = target.closest('.folio-page');
        const blankPage = page && folio.contains(page) && !target.closest('button, [role="button"]');
        if (!controls && !blankPage) return;
        let nextIndex;
        if (event.key === 'ArrowLeft') nextIndex = Math.max(0, current - 1);
        if (event.key === 'ArrowRight') nextIndex = Math.min(pages.length - 1, current + 1);
        if (event.key === 'PageDown' || event.key === 'ArrowDown' || (event.key === ' ' && blankPage)) {
          if (current === pages.length - 1) { event.preventDefault(); leaveBook('resume', { focus: true }); return; }
          nextIndex = current + 1;
        }
        if (event.key === 'PageUp' || event.key === 'ArrowUp') {
          if (current === 0) { event.preventDefault(); leaveBook('top', { focus: true }); return; }
          nextIndex = current - 1;
        }
        if (controls && event.key === 'Home') nextIndex = 0;
        if (controls && event.key === 'End') nextIndex = pages.length - 1;
        if (nextIndex === undefined) return;
        event.preventDefault();
        showPage(nextIndex, { history: 'push', scroll: true, animate: true });
      });
      window.FelixPortfolio = Object.freeze({
        goTo(target, options = {}) {
          const index = resolve(target);
          return index >= 0 && showPage(index, { ...options, hash: typeof target === 'string' ? target : pages[index].id, history: options.history || 'push', scroll: options.scroll !== false });
        },
        get currentIndex() { return current; },
        get currentId() { return pages[current].id; },
        get isFullscreen() { return bookActive; },
        pageIds: Object.freeze(pages.map(page => page.id))
      });

      // A non-passive viewport listener owns vertical wheel input while the
      // full-screen book is open. The document never scrolls between its pages.
      const wheel = { lastAt: -Infinity, used: false, amount: 0, direction: 0, exited: false };
      const quiet = 160;
      const normalizeWheel = event => {
        const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
        return { x: event.deltaX * scale, y: event.deltaY * scale };
      };
      const onBookWheel = event => {
        const delta = normalizeWheel(event);
        const target = event.target instanceof Element ? event.target : null;
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey
            || Math.abs(delta.y) < .5 || Math.abs(delta.x) >= Math.abs(delta.y)
            || dialog?.open || target?.closest('input, textarea, select, [contenteditable], dialog')) return;
        const now = performance.now();
        if (now - wheel.lastAt > quiet) {
          wheel.used = false;
          wheel.amount = 0;
          wheel.exited = false;
        }
        wheel.lastAt = now;
        const direction = Math.sign(delta.y);
        if (direction !== wheel.direction) wheel.amount = 0;
        wheel.direction = direction;
        if (!bookActive) {
          // Absorb the last page's momentum so the resume starts at its title.
          if (wheel.exited) { event.preventDefault(); return; }
          const top = scrollY + bookAnchor.getBoundingClientRect().top - headerOffset();
          const crossing = direction > 0 ? scrollY <= top && scrollY + delta.y >= top
            : scrollY >= top && scrollY + delta.y <= top;
          const onStage = Math.abs(scrollY - top) <= 3;
          if (!crossing && !onStage) return;
          event.preventDefault();
          enterBook();
          wheel.used = true;
          return;
        }
        event.preventDefault();
        if (wheel.used) return;
        wheel.amount += Math.abs(delta.y);
        if (wheel.amount < 32) return;
        wheel.used = true;
        wheel.amount = 0;
        const next = current + direction;
        if (next >= pages.length || next < 0) {
          leaveBook(next >= pages.length ? 'resume' : 'top', { focus: true });
          wheel.exited = true;
          return;
        }
        showPage(next, { history: 'push', animate: true, source: 'wheel' });
      };
      resetWheelForPageChange = fromWheel => {
        if (fromWheel) return;
        wheel.used = false;
        wheel.amount = 0;
        wheel.exited = false;
        wheel.lastAt = -Infinity;
      };
      window.addEventListener('wheel', onBookWheel, { passive: false, capture: true });
      window.addEventListener('resize', updateBookViewport, { passive: true });
      window.addEventListener('scroll', () => {
        if (bookActive && Math.abs(scrollY - lockedScrollY) > 1) window.scrollTo({ top: lockedScrollY, behavior: 'instant' });
      }, { passive: true });
      document.addEventListener('keydown', () => resetWheelForPageChange(false), { passive: true, capture: true });

    }

    // Scrolling updates the navigation highlight only; it never turns the book.
    if (resumeSection && typeof IntersectionObserver === 'function') {
      new IntersectionObserver(entries => {
        resumeInView = entries[0].isIntersecting;
        syncNavigation();
      }, { rootMargin: '-110px 0px -20% 0px', threshold: 0 }).observe(resumeSection);
    }

    // Galleries include every matching image in the document, including folio
    // pages that are currently hidden; closing returns to the opening page.
    const imageButtons = [...document.querySelectorAll('[data-image]')];
    const stageImage = dialog?.querySelector('.lightbox-stage img');
    const caption = dialog?.querySelector('#lightbox-caption');
    const count = dialog?.querySelector('#lightbox-count');
    const close = dialog?.querySelector('.lightbox-close');
    const previousImage = dialog?.querySelector('.lightbox-prev');
    const nextImage = dialog?.querySelector('.lightbox-next');
    let gallery = [];
    let position = 0;
    let trigger = null;
    const showImage = () => {
      const item = gallery[position];
      if (!item || !stageImage) return;
      const label = item.dataset.caption || item.querySelector('img')?.alt || '';
      stageImage.src = item.dataset.image;
      stageImage.alt = label;
      if (caption) caption.textContent = label;
      if (count) count.textContent = `${position + 1} / ${gallery.length}`;
      if (previousImage) previousImage.disabled = position === 0;
      if (nextImage) nextImage.disabled = position === gallery.length - 1;
    };
    const moveImage = delta => {
      const index = position + delta;
      if (index >= 0 && index < gallery.length) { position = index; showImage(); }
    };
    imageButtons.forEach(button => button.addEventListener('click', () => {
      if (!dialog || !stageImage || typeof dialog.showModal !== 'function') {
        window.open(button.dataset.image, '_blank', 'noopener');
        return;
      }
      const group = button.dataset.gallery;
      gallery = group ? imageButtons.filter(item => item.dataset.gallery === group) : [button];
      position = Math.max(0, gallery.indexOf(button));
      trigger = button;
      showImage();
      if (!dialog.open) dialog.showModal();
      document.body.classList.add('modal-open');
      close?.focus({ preventScroll: true });
    }));
    if (dialog && stageImage) {
      close?.addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
      dialog.addEventListener('close', () => {
        document.body.classList.remove('modal-open');
        stageImage.removeAttribute('src');
        if (isAvailable(trigger)) trigger.focus({ preventScroll: true });
        else if (pages.length && !dialog.open) focusHeading(current);
      });
      previousImage?.addEventListener('click', () => moveImage(-1));
      nextImage?.addEventListener('click', () => moveImage(1));
      dialog.addEventListener('keydown', event => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          event.stopPropagation();
          moveImage(event.key === 'ArrowLeft' ? -1 : 1);
        }
      });
    }

    document.querySelectorAll('.copy-email').forEach(button => button.addEventListener('click', async () => {
      const email = 'qgq2076778402@gmail.com';
      let copied = false;
      try {
        if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(email); copied = true; }
      } catch (_) {}
      if (!copied) {
        const focused = document.activeElement;
        const area = document.createElement('textarea');
        area.value = email;
        area.setAttribute('aria-label', locale === 'en' ? 'Email address to copy' : '待复制邮箱');
        area.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        document.body.appendChild(area);
        area.select();
        try { copied = document.execCommand('copy'); } catch (_) {}
        area.remove();
        if (isAvailable(focused)) focused.focus({ preventScroll: true });
      }
      const copyStatus = document.querySelector('#copy-status');
      if (copyStatus) {
        const success = button.dataset.success || (locale === 'en' ? 'Email copied' : '邮箱已复制');
        const fail = button.dataset.fail || (locale === 'en' ? 'Please copy the email manually' : '请手动复制邮箱');
        copyStatus.textContent = copied ? success : `${fail}: ${email}`;
      }
    }));

    const parallax = [...document.querySelectorAll('.hero-art[data-parallax]')].map(art => {
      let frame = 0;
      let visible = false;
      let x = 0;
      let y = 0;
      const reset = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        x = y = 0;
        art.style.removeProperty('transform');
        art.style.removeProperty('will-change');
      };
      const inViewport = () => {
        const bounds = art.getBoundingClientRect();
        return bounds.bottom > 0 && bounds.top < window.innerHeight && bounds.right > 0 && bounds.left < window.innerWidth;
      };
      visible = inViewport();
      const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        if (!visible) reset();
      }, { threshold: 0 }) : null;
      observer?.observe(art);
      art.addEventListener('pointermove', event => {
        if (!finePointer.matches || reducedMotion.matches || document.hidden || dialog?.open || !visible || !inViewport()) return;
        const bounds = art.getBoundingClientRect();
        x = Math.max(-1, Math.min(1, ((event.clientX-bounds.left)/bounds.width-.5)*2))*4;
        y = Math.max(-1, Math.min(1, ((event.clientY-bounds.top)/bounds.height-.5)*2))*3;
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (!visible || reducedMotion.matches || !finePointer.matches || document.hidden) return;
          art.style.willChange = 'transform';
          art.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
        });
      }, { passive: true });
      art.addEventListener('pointerleave', reset);
      return reset;
    });
    const onMotionPreferenceChange = () => {
      if (reducedMotion.matches) cancelTransition();
      parallax.forEach(reset => reset());
    };
    reducedMotion.addEventListener('change', onMotionPreferenceChange);
    finePointer.addEventListener('change', onMotionPreferenceChange);
    document.addEventListener('visibilitychange', () => { if (document.hidden) parallax.forEach(reset => reset()); });
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('app-ready')));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
