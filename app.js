const shelf      = document.getElementById('shelf');
const reader     = document.getElementById('reader');
let currentArticleId = null;
const grid       = document.getElementById('thumb-grid');
const page       = document.getElementById('article-content');
const toast      = document.getElementById('toast');
const btnBack    = document.getElementById('btn-back');
const btnShare   = document.getElementById('btn-share');
const btnRefresh = document.getElementById('btn-refresh');
const btnInstall = document.getElementById('btn-install');

const slugify = (t) =>
  t.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');

const escHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const inlineMarkdown = (s) =>
  escHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

const renderMarkdown = (md) => {
  const lines = md.split('\n');
  let html = '';
  let inCode = false, codeLang = '', codeLines = [];
  let inList = false, listTag = '';

  const flushList = () => {
    if (!inList) return;
    html += `</${listTag}>\n`;
    inList = false; listTag = '';
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    if (/^```/.test(raw)) {
      if (!inCode) {
        flushList();
        inCode = true;
        codeLang = raw.slice(3).trim();
        codeLines = [];
      } else {
        html += `<pre><code>${escHtml(codeLines.join('\n'))}</code></pre>\n`;
        inCode = false;
      }
      continue;
    }
    if (inCode) { codeLines.push(raw); continue; }

    const hm = raw.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      flushList();
      const depth = hm[1].length;
      const text  = hm[2].trim();
      const id    = slugify(text);
      html += `<h${depth} id="${id}">${inlineMarkdown(text)}</h${depth}>\n`;
      continue;
    }

    if (/^(---|\*\*\*)$/.test(raw.trim())) {
      flushList();
      html += '<hr>\n';
      continue;
    }

    if (/^> /.test(raw)) {
      flushList();
      html += `<blockquote><p>${inlineMarkdown(raw.slice(2))}</p></blockquote>\n`;
      continue;
    }

    const ulm = raw.match(/^[-*+]\s+(.*)/);
    if (ulm) {
      if (!inList) { inList = true; listTag = 'ul'; html += '<ul>\n'; }
      html += `<li>${inlineMarkdown(ulm[1])}</li>\n`;
      continue;
    }

    const olm = raw.match(/^\d+\.\s+(.*)/);
    if (olm) {
      if (!inList) { inList = true; listTag = 'ol'; html += '<ol>\n'; }
      html += `<li>${inlineMarkdown(olm[1])}</li>\n`;
      continue;
    }

    flushList();
    if (raw.trim() === '') continue;
    if (/^<img\b/i.test(raw.trim())) {
      html += `<figure class="md-fig">${raw.trim()}</figure>\n`;
      continue;
    }
    html += `<p>${inlineMarkdown(raw)}</p>\n`;
  }
  flushList();
  return html;
};

let toastTimer = null;
const showToast = (msg, ms = 3000) => {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
};

const parseHash = () => {
  const hash = location.hash.slice(1);
  if (!hash) return { view: 'shelf' };
  const parts = hash.split('/');
  const id = parts[0];
  if (!id) return { view: 'shelf' };
  return { view: 'article', id, section: parts[1] || null };
};

const fmtDate = (d) => {
  if (!d) return '';
  const [y, m, day] = String(d).split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(m, 10) - 1] + ' ' + day + ', ' + y;
};

const buildThumb = (article) => {
  const el = document.createElement('div');
  el.className = 'thumb';
  el.dataset.id = article.id;
  const body = article.excerpt || article.description;
  el.innerHTML = `
    <div class="thumb-body">
      <div class="thumb-header">article</div>
      <div class="thumb-title">${article.title}</div>
      <div class="thumb-date">${fmtDate(article.date)}</div>
      <div class="thumb-desc">${body}</div>
    </div>
    <div class="thumb-lines">
      <span style="width:100%"></span>
      <span></span><span></span><span></span><span></span>
    </div>
  `;
  return el;
};

const shelfHeader = grid.querySelector('.shelf-header');

const loadShelf = () =>
  fetch('/content/articles.json')
    .then((r) => r.json())
    .then((list) => { grid.replaceChildren(shelfHeader, ...list.map(buildThumb)); })
    .catch(() => showToast('offline — cached content'));

const articleMeta   = document.getElementById('article-meta');
const articleDesc   = document.getElementById('article-desc');
const articleTitle  = document.getElementById('article-title');

const stripFirstH1 = (md) => md.replace(/^#\s+.+\n?/, '');

const loadArticle = (id, section) => {
  const fillMeta = (meta) => {
    articleMeta.textContent = meta ? fmtDate(meta.date) : '';
    articleDesc.textContent = meta ? (meta.excerpt || meta.description || '') : '';
    articleTitle.textContent = meta ? meta.title : '';
  };
  return Promise.all([
    fetch('/content/articles.json').then((r) => r.ok ? r.json() : []),
    fetch(`/content/${id}.md`).then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status)))),
  ])
    .then(([list, md]) => {
      const meta = (list || []).find((a) => a.id === id) || null;
      fillMeta(meta);
      page.innerHTML = renderMarkdown(stripFirstH1(md));
      page.querySelectorAll('a[href^="#"]').forEach((a) => {
        const h = a.getAttribute('href').slice(1);
        if (!h || h.includes('/')) return;
        const target = document.getElementById(h);
        if (target && page.contains(target)) a.setAttribute('href', `#${id}/${h}`);
      });
      if (section) {
        requestAnimationFrame(() => {
          const target = document.getElementById(section);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } else {
        reader.scrollTop = 0;
      }
    })
    .catch(() => {
      fillMeta(null);
      page.innerHTML = '<p>Article not found or unavailable offline.</p>';
    });
};

const showShelf = (animated = false) => {
  currentArticleId = null;
  if (animated) {
    reader.classList.remove('visible');
    setTimeout(() => { shelf.classList.remove('hidden'); loadShelf(); }, 360);
  } else {
    reader.classList.remove('visible');
    shelf.classList.remove('hidden');
    loadShelf();
  }
};

const openArticle = (id, section, fromEl) => {
  currentArticleId = id;
  loadArticle(id, section);
  shelf.classList.add('hidden');
  setTimeout(() => {
    reader.classList.add('visible');
    if (fromEl) animateFromThumb(fromEl);
  }, fromEl ? 0 : 10);
};

const animateFromThumb = (el) => {
  const rect = el.getBoundingClientRect();
  const stack = reader.querySelector('.paper-stack');
  stack.style.transition = 'none';
  stack.style.transformOrigin = `${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px`;
  stack.style.transform = `scale(${rect.width / 680})`;
  stack.style.opacity = '0';
  stack.getBoundingClientRect();
  stack.style.transition = 'transform 0.42s cubic-bezier(0.22,1,0.36,1), opacity 0.28s';
  stack.style.transform = 'scale(1)';
  stack.style.opacity = '1';
  const done = () => {
    stack.style.transition = '';
    stack.style.transform  = '';
    stack.style.transformOrigin = '';
    stack.style.opacity = '';
    stack.removeEventListener('transitionend', done);
  };
  stack.addEventListener('transitionend', done);
};

const doShare = async () => {
  const url   = location.href;
  const title = articleTitle?.textContent?.trim() || 'VoxDei';
  try {
    if (navigator.share) await navigator.share({ title, url });
    else { await navigator.clipboard.writeText(url); showToast('link copied'); }
  } catch {}
};

const doRefresh = () => {
  const sw = navigator.serviceWorker?.controller;
  if (!sw) { location.reload(); return; }
  btnRefresh.classList.add('spinning');
  sw.postMessage({ type: 'REFRESH' });
};

navigator.serviceWorker?.addEventListener('message', (ev) => {
  if (ev.data?.type === 'REFRESHED') {
    location.reload();
  } else if (ev.data?.type === 'OFFLINE') {
    btnRefresh.classList.remove('spinning');
    showToast('server unreachable — using cached content', 4000);
  }
});

let installPrompt = null;
const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  if (!isInstalled()) btnInstall.style.display = 'flex';
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  btnInstall.style.display = 'none';
});

btnInstall.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  if (outcome === 'accepted') btnInstall.style.display = 'none';
  installPrompt = null;
});

grid.addEventListener('click', (e) => {
  const thumb = e.target.closest('.thumb[data-id]');
  if (!thumb) return;
  const id = thumb.dataset.id;
  history.pushState(null, '', `#${id}`);
  openArticle(id, null, thumb);
});

btnBack.addEventListener('click', () => { history.pushState(null, '', '#'); showShelf(true); });
btnShare.addEventListener('click', doShare);
btnRefresh.addEventListener('click', doRefresh);

window.addEventListener('hashchange', () => {
  const { view, id, section } = parseHash();
  if (view === 'shelf') showShelf(true);
  else if (currentArticleId === id && reader.classList.contains('visible')) {
    if (section) {
      const target = document.getElementById(section);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } else {
    openArticle(id, section, null);
  }
});

const { view, id, section } = parseHash();
if (view === 'article') openArticle(id, section, null);
else showShelf(false);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service.js').catch(() => {});
}
