(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isEn = document.body.dataset.locale === 'en';

  // 1. Progressive image loading (guarantee cached images are immediately visible)
  function initImages() {
    document.querySelectorAll('img.reveal-img').forEach((img) => {
      const mark = () => img.classList.add('is-loaded');
      if (img.complete && img.naturalWidth > 0) {
        mark();
      } else {
        img.addEventListener('load', mark, { once: true });
        img.addEventListener('error', mark, { once: true });
      }
    });
  }

  // 2. Scroll progress bar + adaptive header theme + active nav spy
  function initScrollChrome() {
    const progressEl = document.querySelector('#scroll-progress span');
    const header = document.querySelector('.site-header');
    const lightZone = document.querySelector('.zone-light');
    const navLinks = Array.from(document.querySelectorAll('.site-nav a[href^="#"]'));
    const sections = navLinks
      .map((a) => document.querySelector(a.getAttribute('href')))
      .filter(Boolean);

    let ticking = false;
    function update() {
      ticking = false;
      const doc = document.documentElement;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      const ratio = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      if (progressEl) {
        progressEl.style.transform = `scaleX(${ratio.toFixed(4)})`;
      }

      if (header && lightZone) {
        const rect = lightZone.getBoundingClientRect();
        const theme = rect.top <= 48 ? 'light' : 'dark';
        if (header.dataset.headerTheme !== theme) {
          header.dataset.headerTheme = theme;
        }
      }

      const probe = 150;
      let activeId = sections[0]?.id || '';
      for (const sec of sections) {
        if (sec.getBoundingClientRect().top <= probe) {
          activeId = sec.id;
        }
      }
      navLinks.forEach((link) => {
        const match = link.getAttribute('href') === `#${activeId}`;
        link.classList.toggle('is-active', match);
      });
    }

    const requestTick = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    window.addEventListener('scroll', requestTick, { passive: true });
    window.addEventListener('resize', requestTick, { passive: true });
    update();
  }

  // 3. Scroll-triggered stagger reveal
  function initReveal() {
    const nodes = Array.from(document.querySelectorAll('[data-reveal]'));
    if (reducedMotion || !('IntersectionObserver' in window)) {
      nodes.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    nodes.forEach((el) => observer.observe(el));
  }

  // 4. Magnetic hover micro-interaction on primary CTAs
  function initMagnetic() {
    if (reducedMotion || window.matchMedia('(pointer: coarse)').matches) return;
    document.querySelectorAll('.btn-magnetic').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const rect = btn.getBoundingClientRect();
        const dx = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
        const dy = ((e.clientY - rect.top) / rect.height - 0.5) * 8;
        btn.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
      });
      btn.addEventListener('pointerleave', () => {
        btn.style.transform = '';
      });
    });
  }

  // 5. Interactive Hero Before/After Drag-to-Compare Slider
  function initCompare() {
    document.querySelectorAll('[data-compare]').forEach((frame) => {
      const handle = frame.querySelector('.compare-handle');
      const readout = document.querySelector('#compare-percent');
      let dragging = false;

      const setPos = (pct) => {
        const clamped = Math.min(94, Math.max(6, pct));
        frame.style.setProperty('--pos', `${clamped.toFixed(1)}%`);
        if (handle) {
          handle.setAttribute('aria-valuenow', String(Math.round(clamped)));
        }
        if (readout) {
          readout.textContent = `${Math.round(clamped)}%`;
        }
      };

      const updateFromClientX = (clientX) => {
        const rect = frame.getBoundingClientRect();
        const pct = ((clientX - rect.left) / rect.width) * 100;
        setPos(pct);
      };

      frame.addEventListener('pointerdown', (e) => {
        dragging = true;
        frame.classList.add('is-dragging');
        if (frame.setPointerCapture) {
          try { frame.setPointerCapture(e.pointerId); } catch (_) {}
        }
        updateFromClientX(e.clientX);
      });

      frame.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        updateFromClientX(e.clientX);
      });

      const stopDrag = () => {
        dragging = false;
        frame.classList.remove('is-dragging');
      };
      frame.addEventListener('pointerup', stopDrag);
      frame.addEventListener('pointercancel', stopDrag);

      if (handle) {
        handle.addEventListener('keydown', (e) => {
          const cur = parseFloat(handle.getAttribute('aria-valuenow') || '52');
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setPos(cur - 5);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            setPos(cur + 5);
          }
        });
      }

      setPos(52);
    });
  }

  // 6. Short-Drama Node Workflow Tabs
  function initNodeTabs() {
    const btns = Array.from(document.querySelectorAll('[data-node-tab]'));
    const panels = Array.from(document.querySelectorAll('[data-node-panel]'));
    const cards = Array.from(document.querySelectorAll('[data-node-card]'));
    if (!btns.length) return;

    function select(key) {
      btns.forEach((b) => {
        const active = b.dataset.nodeTab === key;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', String(active));
      });
      cards.forEach((c) => {
        c.classList.toggle('is-active', c.dataset.nodeCard === key);
      });
      panels.forEach((p) => {
        p.hidden = p.dataset.nodePanel !== key;
      });
    }

    btns.forEach((b) => b.addEventListener('click', () => select(b.dataset.nodeTab)));
    cards.forEach((c) => c.addEventListener('click', () => select(c.dataset.nodeCard)));
  }

  // 7. Interactive Agent & ComfyUI Pipeline Selector
  function initPipeline() {
    const nodes = Array.from(document.querySelectorAll('[data-pipe-node]'));
    const titleEl = document.querySelector('#pipe-readout-title');
    const descEl = document.querySelector('#pipe-readout-desc');
    if (!nodes.length || !titleEl || !descEl) return;

    function activate(node) {
      nodes.forEach((n) => {
        const active = n === node;
        n.classList.toggle('is-active', active);
        n.setAttribute('aria-pressed', String(active));
      });
      titleEl.textContent = node.dataset.title || '';
      descEl.textContent = node.dataset.desc || '';
    }

    nodes.forEach((n) => {
      n.addEventListener('click', () => activate(n));
      n.addEventListener('mouseenter', () => activate(n));
    });
  }

  // 8. Dafengshou Mini-Program Screen Switcher
  function initPhoneSwitcher() {
    const pills = Array.from(document.querySelectorAll('[data-phone-screen]'));
    const centerImg = document.querySelector('#dfs-center-img');
    const centerBtn = document.querySelector('#dfs-center-btn');
    const centerTitle = document.querySelector('#dfs-center-title');
    const centerSub = document.querySelector('#dfs-center-sub');
    if (!pills.length || !centerImg || !centerBtn) return;

    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        pills.forEach((p) => p.classList.toggle('is-active', p === pill));
        const src = pill.dataset.src;
        const title = pill.dataset.title;
        const sub = pill.dataset.sub;
        const caption = pill.dataset.caption;
        if (src) {
          centerImg.src = src;
          centerImg.alt = caption || title || '';
          centerBtn.dataset.image = src;
          centerBtn.dataset.caption = caption || title || '';
        }
        if (centerTitle && title) centerTitle.textContent = title;
        if (centerSub && sub) centerSub.textContent = sub;
      });
    });
  }

  // 9. Commercial Gallery Filter Tabs
  function initCommercialFilter() {
    const buttons = Array.from(document.querySelectorAll('[data-filter]'));
    const blocks = Array.from(document.querySelectorAll('[data-category]'));
    if (!buttons.length || !blocks.length) return;

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        buttons.forEach((b) => {
          const active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', String(active));
        });
        blocks.forEach((block) => {
          const show = filter === 'all' || block.dataset.category === filter;
          block.classList.toggle('is-filtered-out', !show);
        });
      });
    });
  }

  // 10. Auto-play muted showcase videos only while visible in viewport
  function initViewportVideos() {
    const videos = Array.from(document.querySelectorAll('video[data-autoplay-visible]'));
    if (!videos.length || reducedMotion || !('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const v = entry.target;
          if (entry.isIntersecting) {
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        });
      },
      { threshold: 0.25 }
    );
    videos.forEach((v) => io.observe(v));
  }

  // 11. Enhanced Lightbox with Gallery Navigation & 1.8x Detail Zoom
  function initLightbox() {
    const dialog = document.querySelector('dialog.lightbox');
    if (!dialog) return;

    const stage = dialog.querySelector('.lightbox-stage');
    const imgEl = dialog.querySelector('.lightbox-stage img');
    const captionEl = dialog.querySelector('.lightbox-caption');
    const countEl = dialog.querySelector('.lightbox-count');
    const closeBtn = dialog.querySelector('.lightbox-close');
    const zoomBtn = dialog.querySelector('.lightbox-zoom');
    const prevBtn = dialog.querySelector('.lightbox-prev');
    const nextBtn = dialog.querySelector('.lightbox-next');

    let items = [];
    let index = 0;
    let lastFocus = null;

    function setZoom(zoomed) {
      stage.classList.toggle('is-zoomed', zoomed);
      if (zoomBtn) {
        zoomBtn.textContent = zoomed
          ? (isEn ? '1× Fit' : '1× 适应窗口')
          : (isEn ? '1.8× Zoom' : '1.8× 放大细节');
      }
    }

    function render() {
      const item = items[index];
      if (!item) return;
      setZoom(false);
      imgEl.src = item.src;
      imgEl.alt = item.caption || '';
      captionEl.textContent = item.caption || '';
      countEl.textContent = `${String(index + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
      prevBtn.disabled = items.length <= 1;
      nextBtn.disabled = items.length <= 1;
    }

    function openForTrigger(trigger) {
      const group = trigger.dataset.gallery || 'default';
      const groupTriggers = Array.from(document.querySelectorAll(`[data-gallery="${group}"][data-image]`));
      items = groupTriggers.map((el) => ({
        src: el.dataset.image,
        caption: el.dataset.caption || el.getAttribute('aria-label') || '',
      }));
      index = Math.max(0, groupTriggers.indexOf(trigger));
      lastFocus = document.activeElement;
      render();
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
      closeBtn?.focus();
    }

    function close() {
      setZoom(false);
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
      lastFocus?.focus();
    }

    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-image]');
      if (trigger) {
        e.preventDefault();
        openForTrigger(trigger);
      }
    });

    closeBtn?.addEventListener('click', close);
    zoomBtn?.addEventListener('click', () => setZoom(!stage.classList.contains('is-zoomed')));
    imgEl?.addEventListener('click', () => setZoom(!stage.classList.contains('is-zoomed')));
    prevBtn?.addEventListener('click', () => {
      index = (index - 1 + items.length) % items.length;
      render();
    });
    nextBtn?.addEventListener('click', () => {
      index = (index + 1) % items.length;
      render();
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target === stage) {
        close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (!dialog.open) return;
      if (e.key === 'ArrowLeft') {
        index = (index - 1 + items.length) % items.length;
        render();
      } else if (e.key === 'ArrowRight') {
        index = (index + 1) % items.length;
        render();
      } else if (e.key === 'Escape') {
        close();
      }
    });
  }

  // 12. Copy Email with Live Status Feedback
  function initCopyEmail() {
    const btn = document.querySelector('.copy-email');
    const status = document.querySelector('#copy-status');
    if (!btn || !status) return;

    btn.addEventListener('click', async () => {
      const email = 'qgq2076778402@gmail.com';
      try {
        await navigator.clipboard.writeText(email);
        status.textContent = btn.dataset.success || 'Copied';
      } catch (_) {
        status.textContent = btn.dataset.fail || email;
      }
      window.setTimeout(() => {
        status.textContent = '';
      }, 3200);
    });
  }

  initImages();
  initScrollChrome();
  initReveal();
  initMagnetic();
  initCompare();
  initNodeTabs();
  initPipeline();
  initPhoneSwitcher();
  initCommercialFilter();
  initViewportVideos();
  initLightbox();
  initCopyEmail();
})();
