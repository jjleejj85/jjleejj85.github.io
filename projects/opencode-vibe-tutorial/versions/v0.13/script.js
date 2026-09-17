(function() {
    'use strict';

    const progressBar = document.getElementById('progress-bar');
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = document.querySelectorAll('section[id]');
    const nav = document.getElementById('nav');

    function updateProgressBar() {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        progressBar.value = Math.min(100, Math.max(0, progress));
    }

    function updateActiveNav() {
        const scrollPos = window.scrollY + window.innerHeight / 3;
        let activeId = '';

        sections.forEach(section => {
            const top = section.offsetTop;
            const bottom = top + section.offsetHeight;
            if (scrollPos >= top && scrollPos < bottom) {
                activeId = section.id;
            }
        });

        navLinks.forEach(link => {
            const href = link.getAttribute('href').slice(1);
            link.classList.toggle('active', href === activeId);
        });
    }

    function onScroll() {
        updateProgressBar();
        updateActiveNav();
    }

    let scrollTimeout;
    function onScrollThrottled() {
        if (scrollTimeout) return;
        scrollTimeout = requestAnimationFrame(() => {
            onScroll();
            scrollTimeout = null;
        });
    }

    window.addEventListener('scroll', onScrollThrottled, { passive: true });
    window.addEventListener('resize', onScrollThrottled);

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                const offsetTop = target.offsetTop;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    const modeButtons = document.querySelectorAll('.tab-btn[data-mode]');
    const osButtons = document.querySelectorAll('.tab-btn[data-os]');
    const installPanels = document.querySelectorAll('.install-panel');

    function renderInstallPanel() {
        const activeMode = document.querySelector('.tab-btn[data-mode].is-active')?.dataset.mode;
        const activeOs = document.querySelector('.tab-btn[data-os].is-active')?.dataset.os;

        installPanels.forEach(panel => {
            const show = panel.dataset.mode === activeMode && panel.dataset.os === activeOs;
            panel.classList.toggle('is-visible', show);
            panel.setAttribute('aria-hidden', String(!show));
        });
    }

    function bindTabButtons(buttons) {
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => {
                    b.classList.remove('is-active');
                    b.setAttribute('aria-selected', 'false');
                });
                btn.classList.add('is-active');
                btn.setAttribute('aria-selected', 'true');
                renderInstallPanel();
            });
        });
    }

    bindTabButtons(modeButtons);
    bindTabButtons(osButtons);
    renderInstallPanel();

    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const container = this.closest('.install-command, .starter-command, .prompt-box');
            const codeEl = container.querySelector('code');
            const text = codeEl.textContent.trim();
            const originalText = this.textContent;

            this.classList.add('is-copied');
            this.textContent = '已复制';

            try {
                await navigator.clipboard.writeText(text);
            } catch (err) {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }

            setTimeout(() => {
                this.classList.remove('is-copied');
                this.textContent = originalText;
            }, 1600);
        });
    });

    function init() {
        updateProgressBar();
        updateActiveNav();
        initGallery();
    }

    function initGallery() {
        const galleries = document.querySelectorAll('.gallery');
        galleries.forEach(gallery => {
            const track = gallery.querySelector('.gallery-track');
            const slides = gallery.querySelectorAll('.gallery-slide');
            const dots = gallery.querySelectorAll('.gallery-dot');
            const prevBtn = gallery.querySelector('.gallery-btn[data-dir="prev"]');
            const nextBtn = gallery.querySelector('.gallery-btn[data-dir="next"]');
            if (!track || slides.length === 0) return;

            function currentIndex() {
                return Math.round(track.scrollLeft / slides[0].getBoundingClientRect().width);
            }

            function updateState() {
                const index = currentIndex();
                dots.forEach((dot, i) => {
                    const active = i === index;
                    dot.classList.toggle('is-active', active);
                    dot.setAttribute('aria-selected', String(active));
                });
                if (prevBtn) prevBtn.disabled = index <= 0;
                if (nextBtn) nextBtn.disabled = index >= slides.length - 1;
            }

            function scrollToIndex(index) {
                const slide = slides[index];
                if (!slide) return;
                track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
            }

            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    scrollToIndex(Math.max(0, currentIndex() - 1));
                });
            }
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    scrollToIndex(Math.min(slides.length - 1, currentIndex() + 1));
                });
            }

            dots.forEach((dot) => {
                dot.addEventListener('click', () => {
                    scrollToIndex(Number(dot.dataset.index));
                });
            });

            track.addEventListener('scroll', updateState, { passive: true });
            window.addEventListener('resize', updateState);
            updateState();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();