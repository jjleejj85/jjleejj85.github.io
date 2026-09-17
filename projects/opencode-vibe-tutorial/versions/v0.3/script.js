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

    function init() {
        updateProgressBar();
        updateActiveNav();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();