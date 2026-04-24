(function () {
    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getFooterMenuHtml() {
        const links = [
            { href: 'onlifit.html', label: 'Home' },
            { href: 'about.html', label: 'About' },
            { href: 'pricing.html', label: 'Pricing' },
            { href: 'trainers.html', label: 'Trainers' },
            { href: 'blog.html', label: 'Blog' },
            { href: 'calculators.html', label: 'Free Tools' },
            { href: 'join-us.html', label: 'Join Us' },
            { href: 'support.html', label: 'Support' }
        ];

        return links
            .map(function (item) {
                return '<a class="ofm-link" href="' + escapeHtml(item.href) + '">' + escapeHtml(item.label) + '</a>';
            })
            .join('');
    }

    function ensureStyles() {
        if (document.getElementById('ofm-footer-style')) return;

        const style = document.createElement('style');
        style.id = 'ofm-footer-style';
        style.textContent = [
            '.ofm-shell{margin-top:48px;padding:28px 20px;border-top:1px solid rgba(0,0,0,.1);background:#fff;color:#111}',
            '.ofm-wrap{max-width:1200px;margin:0 auto;display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between}',
            '.ofm-brand{font-family:Poppins,Arial,sans-serif;font-weight:800;font-size:20px;letter-spacing:-.02em;color:#111;text-decoration:none}',
            '.ofm-menu{display:flex;flex-wrap:wrap;gap:14px 18px;align-items:center}',
            '.ofm-link{font-family:Inter,Arial,sans-serif;font-size:14px;font-weight:600;color:#555;text-decoration:none;transition:color .2s ease}',
            '.ofm-link:hover{color:#000}',
            '.ofm-copy{width:100%;font-family:Inter,Arial,sans-serif;font-size:12px;color:#777;margin-top:8px}',
            '@media (max-width:640px){.ofm-wrap{flex-direction:column;align-items:flex-start}.ofm-menu{gap:10px 14px}}'
        ].join('');

        document.head.appendChild(style);
    }

    function appendToExistingFooter(existingFooter) {
        if (existingFooter.querySelector('.ofm-menu')) return;

        const menuWrap = document.createElement('div');
        menuWrap.className = 'ofm-menu';
        menuWrap.innerHTML = getFooterMenuHtml();

        const copy = document.createElement('div');
        copy.className = 'ofm-copy';
        copy.textContent = 'Copyright ' + new Date().getFullYear() + ' Onlifit. All rights reserved.';

        existingFooter.appendChild(menuWrap);
        existingFooter.appendChild(copy);
    }

    function createGlobalFooter() {
        const footer = document.createElement('footer');
        footer.className = 'ofm-shell';
        footer.innerHTML = [
            '<div class="ofm-wrap">',
            '  <a class="ofm-brand" href="onlifit.html">Onlifit</a>',
            '  <div class="ofm-menu">' + getFooterMenuHtml() + '</div>',
            '  <div class="ofm-copy">Copyright ' + new Date().getFullYear() + ' Onlifit. All rights reserved.</div>',
            '</div>'
        ].join('');
        return footer;
    }

    function init() {
        const body = document.body;
        if (!body || body.dataset.hideGlobalFooter === 'true') return;

        ensureStyles();

        const existingFooter = document.querySelector('footer');
        if (existingFooter) {
            appendToExistingFooter(existingFooter);
            return;
        }

        body.appendChild(createGlobalFooter());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
