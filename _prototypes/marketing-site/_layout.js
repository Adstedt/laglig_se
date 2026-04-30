// Shared nav + footer + mega-menu behavior for laglig.se marketing-site prototype.
// Each page includes <script src="_layout.js"></script> and <body data-active="produkt|branscher|lagdatabas|resurser|priser|kontakt">.
//
// IMPORTANT: only features that actually ship in the product today are referenced
// here. Post-MVP integrations (Fortnox, Slack, Power BI, etc.) are deliberately
// omitted — marketing must only sell what we actually have.

window.LAGLIG_NAV_DATA = {
  produkt: {
    columns: [
      {
        title: 'Kärnfunktioner',
        items: [
          { name: 'Laglistor', desc: 'Personlig laglista per bransch', href: '#', icon: 'list-checks' },
          { name: 'Krav & Kravpunkter', desc: 'Bryt ner lagar i åtgärder med bevis', href: '#', icon: 'check-square' },
          { name: 'Lagbevakning', desc: 'Daglig koll på SFS, AFS, EU-rätt och praxis', href: '#', icon: 'radar' },
          { name: 'Lagefterlevnadskontroll', desc: 'Formella revisioner med sigillerad rapport', href: 'produkt-lagefterlevnadskontroll.html', icon: 'shield-check' },
          { name: 'AI-assistent', desc: 'RAG-grundad i 170 000 rättskällor', href: '#', icon: 'sparkles' },
          { name: 'Uppgifter', desc: 'Kanban kopplad till lagar och kravpunkter', href: '#', icon: 'layout-kanban' },
        ],
      },
      {
        title: 'Plattform',
        items: [
          { name: 'Filer & Bevis', desc: 'Dokumentation länkad till rätt krav', href: '#', icon: 'folder-open' },
          { name: 'Styrdokument', desc: 'Levande policy med versionshantering', href: '#', icon: 'file-text' },
          { name: 'Aktivitetslogg', desc: 'Immutabel historik — varje ändring', href: '#', icon: 'history' },
          { name: 'Roller & rättigheter', desc: '5 roller, multi-workspace för konsulter', href: '#', icon: 'users' },
          { name: 'Lagdatabas', desc: 'Bolagsverket, Riksdagen, Domstolsverket, EUR-Lex', href: '#', icon: 'database' },
          { name: 'Revisionsrapport', desc: 'Sigillerad PDF i ISO 19011-stil', href: '#', icon: 'file-check-2' },
        ],
      },
      {
        title: 'För vem',
        items: [
          { name: 'Compliance Manager', desc: '', href: '#', icon: 'briefcase' },
          { name: 'HR-chef', desc: '', href: '#', icon: 'user-cog' },
          { name: 'Hållbarhets- & miljöansvarig', desc: '', href: '#', icon: 'leaf' },
          { name: 'ISO-konsult / Auditor', desc: '', href: '#', icon: 'badge-check' },
          { name: 'VD / CFO', desc: '', href: '#', icon: 'trending-up' },
          { name: 'Offentlig sektor', desc: '', href: 'branscher.html', icon: 'landmark' },
        ],
      },
    ],
    footerLinks: [
      { name: 'Alla funktioner →', href: '#', emphasized: true },
      { name: 'Produktnyheter', href: '#' },
      { name: 'Support', href: '#' },
      { name: 'Kontakt', href: '#' },
    ],
  },
  branscher: {
    columns: [
      {
        title: '',
        items: [
          { name: 'Bygg & Anläggning', desc: 'AFS, AB04, ID06, arbetsmiljöplan', href: 'branscher-bygg.html', icon: 'hard-hat' },
          { name: 'Industri & Tillverkning', desc: 'REACH, Seveso, ISO 14001 / 45001', href: 'branscher.html', icon: 'factory' },
          { name: 'Restaurang & Livsmedel', desc: 'Egenkontroll, alkohollagen, smittskydd', href: 'branscher.html', icon: 'utensils' },
          { name: 'Tech & SaaS', desc: 'GDPR, NIS2, DSA, AI-förordningen', href: 'branscher.html', icon: 'cpu' },
          { name: 'Vård & Omsorg', desc: 'HSL, SoL, IVO-redo dokumentation', href: 'branscher.html', icon: 'heart-pulse' },
          { name: 'Offentlig sektor', desc: 'Förvaltningslagen, kommunallagen, LOU', href: 'branscher.html', icon: 'landmark' },
        ],
      },
    ],
    footerLinks: [
      { name: 'Alla branscher →', href: 'branscher.html', emphasized: true },
      { name: 'Är din bransch inte med? Kontakta oss', href: '#' },
    ],
  },
  resurser: {
    columns: [
      {
        title: 'Innehåll & utbildning',
        items: [
          { name: 'Lagordlista', desc: 'Compliance-termer förklarade — A till Ö', href: 'resurser-lagordlista.html', icon: 'book-open' },
          { name: 'Blogg & Nyheter', desc: 'Lagnyheter och insikter varje vecka', href: '#', icon: 'newspaper' },
          { name: 'Kundcase / Referenser', desc: 'Hur andra compliance-team gör', href: '#', icon: 'quote' },
          { name: 'Webinars', desc: 'Inspelade och kommande sessioner', href: '#', icon: 'video' },
          { name: 'Guider & E-böcker', desc: 'Djupare läsning för team som planerar', href: '#', icon: 'book' },
          { name: 'Verktyg & Kalkylatorer', desc: 'CSRD-omfattningstest, ISO-mognadsanalys', href: '#', icon: 'calculator' },
        ],
      },
      {
        title: 'Företag & community',
        items: [
          { name: 'Om oss', desc: '', href: '#', icon: 'users-round' },
          { name: 'Karriär', desc: '', href: '#', icon: 'briefcase' },
          { name: 'Partners', desc: 'För ISO-konsulter och revisionsbyråer', href: '#', icon: 'handshake' },
          { name: 'Byt till laglig.se', desc: 'Migrera från Notisum / JP / Karnov', href: '#', icon: 'arrow-right-left' },
          { name: 'Tipsa om laglig', desc: '15 % rabatt för båda', href: '#', icon: 'gift' },
          { name: 'Kontakt & support', desc: '', href: '#', icon: 'life-buoy' },
        ],
      },
    ],
    footerLinks: [],
  },
};

function buildMegaMenu(key) {
  const data = window.LAGLIG_NAV_DATA[key];
  if (!data) return '';
  const cols = data.columns
    .map((col) => {
      const items = col.items
        .map(
          (it) => `
          <a href="${it.href}" class="group flex items-start gap-3.5 rounded-lg px-2 py-2.5 transition hover:bg-stone-100/70">
            <span class="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-stone-900/95 text-stone-50 transition group-hover:bg-amber-700">
              <i data-lucide="${it.icon}" class="h-3.5 w-3.5"></i>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[15px] font-semibold leading-tight text-stone-900 group-hover:text-amber-900">${it.name}</span>
              ${it.desc ? `<span class="mt-1 block text-xs leading-snug text-stone-500">${it.desc}</span>` : ''}
            </span>
          </a>`,
        )
        .join('');
      const isSingleColBranscher = key === 'branscher';
      const colClass = isSingleColBranscher
        ? 'grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1'
        : 'space-y-0.5';
      const headerHTML = col.title
        ? `<div class="mb-3 border-b border-stone-200/80 pb-2 text-[13px] font-semibold tracking-wide text-stone-900">${col.title}</div>`
        : '';
      return `
      <div>
        ${headerHTML}
        <div class="${colClass}">${items}</div>
      </div>`;
    })
    .join('');
  const colCountClass =
    data.columns.length === 1 ? 'grid-cols-1' : data.columns.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3';
  let footerHTML = '';
  if (data.footerLinks.length) {
    const lefts = data.footerLinks.filter((l) => l.emphasized);
    const rights = data.footerLinks.filter((l) => !l.emphasized);
    const leftsHTML = lefts
      .map(
        (l) =>
          `<a href="${l.href}" class="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-900 transition hover:text-amber-800">${l.name}</a>`,
      )
      .join('<span class="mx-3 text-stone-300">·</span>');
    const rightsHTML = rights
      .map(
        (l) =>
          `<a href="${l.href}" class="text-sm text-stone-600 transition hover:text-amber-800">${l.name}</a>`,
      )
      .join('<span class="mx-3 text-stone-300">|</span>');
    footerHTML = `
      <div class="mt-6 flex flex-col gap-3 border-t border-stone-200/80 pt-5 md:flex-row md:items-center md:justify-between">
        <div>${leftsHTML}</div>
        <div class="flex flex-wrap items-center">${rightsHTML}</div>
      </div>`;
  }
  return `
    <div class="grid gap-x-10 gap-y-2 ${colCountClass}">${cols}</div>
    ${footerHTML}
  `;
}

function injectNav() {
  const active = document.body.getAttribute('data-active') || '';
  const items = [
    { key: 'produkt', label: 'Produkt', hasMenu: true },
    { key: 'branscher', label: 'Branscher', hasMenu: true },
    { key: 'lagdatabas', label: 'Lagdatabas', hasMenu: false, href: '#' },
    { key: 'priser', label: 'Priser', hasMenu: false, href: '#' },
    { key: 'resurser', label: 'Resurser', hasMenu: true },
    { key: 'kontakt', label: 'Kontakt', hasMenu: false, href: '#' },
  ];
  const navItems = items
    .map((it) => {
      const isActive = it.key === active;
      const baseCls =
        'inline-flex items-center gap-1 px-3 py-5 text-sm font-medium transition-colors ' +
        (isActive ? 'text-amber-900' : 'text-stone-700 hover:text-stone-900');
      if (it.hasMenu) {
        return `
        <div class="nav-trigger relative" data-menu="${it.key}">
          <button class="${baseCls}">
            ${it.label}
            <i data-lucide="chevron-down" class="h-3.5 w-3.5 opacity-60"></i>
          </button>
        </div>`;
      }
      return `<a href="${it.href}" class="${baseCls}">${it.label}</a>`;
    })
    .join('');

  const html = `
    <header class="sticky top-0 z-50 border-b border-stone-200/70 bg-stone-50/80 backdrop-blur supports-[backdrop-filter]:bg-stone-50/70">
      <div class="mx-auto flex h-16 max-w-7xl items-center gap-8 px-6">
        <a href="index.html" class="flex items-center gap-2.5 font-semibold tracking-tight text-stone-900">
          <span class="grid h-7 w-7 place-items-center rounded-md bg-stone-900 text-stone-50">
            <i data-lucide="scale" class="h-4 w-4"></i>
          </span>
          <span class="text-base">laglig.se</span>
        </a>
        <nav class="hidden lg:flex items-stretch">
          ${navItems}
        </nav>
        <div class="ml-auto flex items-center gap-2">
          <a href="#" class="hidden rounded-md px-3 py-2 text-sm font-medium text-stone-700 hover:text-stone-900 sm:inline-flex">Logga in</a>
          <a href="#" class="inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 shadow-sm transition hover:bg-stone-800">
            Kom igång gratis
            <i data-lucide="arrow-right" class="h-3.5 w-3.5"></i>
          </a>
        </div>
      </div>

      <!-- Mega-menu panel: positioned full-width below the nav -->
      <div id="mega-panel" class="absolute inset-x-0 top-full hidden border-b border-stone-200/70 bg-white shadow-[0_24px_48px_-12px_rgba(15,12,8,0.12)]">
        <div id="mega-content" class="mx-auto max-w-7xl px-8 py-10"></div>
      </div>
    </header>
  `;
  const slot = document.getElementById('site-nav');
  if (slot) slot.outerHTML = html;

  // Wire mega-menu behavior
  const triggers = document.querySelectorAll('.nav-trigger');
  const panel = document.getElementById('mega-panel');
  const content = document.getElementById('mega-content');
  let openKey = null;
  let closeTimer = null;

  function openMenu(key) {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    if (openKey === key) return;
    openKey = key;
    content.innerHTML = buildMegaMenu(key);
    panel.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
    triggers.forEach((t) => {
      const isActive = t.getAttribute('data-menu') === key;
      const btn = t.querySelector('button');
      if (btn) btn.classList.toggle('text-amber-900', isActive);
    });
  }
  function closeMenu(immediate) {
    const doClose = () => {
      panel.classList.add('hidden');
      openKey = null;
      triggers.forEach((t) => {
        const btn = t.querySelector('button');
        const k = t.getAttribute('data-menu');
        if (btn) btn.classList.toggle('text-amber-900', k === document.body.getAttribute('data-active'));
      });
    };
    if (immediate) {
      doClose();
    } else {
      closeTimer = setTimeout(doClose, 120);
    }
  }

  triggers.forEach((t) => {
    const key = t.getAttribute('data-menu');
    t.addEventListener('mouseenter', () => openMenu(key));
    t.addEventListener('mouseleave', () => closeMenu(false));
    t.addEventListener('click', (e) => {
      e.preventDefault();
      if (openKey === key) closeMenu(true);
      else openMenu(key);
    });
  });
  panel.addEventListener('mouseenter', () => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  });
  panel.addEventListener('mouseleave', () => closeMenu(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu(true);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('header')) closeMenu(true);
  });
}

// Renders a static, non-collapsible mega-menu panel inside an arbitrary container.
// Used by the prototype index page so the menus are always visible.
function renderStaticMegaMenu(targetEl, key) {
  if (!targetEl) return;
  targetEl.innerHTML = `<div class="mx-auto max-w-7xl px-8 py-10">${buildMegaMenu(key)}</div>`;
  if (window.lucide) window.lucide.createIcons();
}
window.renderStaticMegaMenu = renderStaticMegaMenu;

function injectFooter() {
  const html = `
    <footer class="border-t border-stone-200/70 bg-stone-100/60">
      <div class="mx-auto max-w-7xl px-6 py-12">
        <div class="grid gap-10 md:grid-cols-5">
          <div class="md:col-span-2">
            <div class="flex items-center gap-2.5 font-semibold tracking-tight text-stone-900">
              <span class="grid h-7 w-7 place-items-center rounded-md bg-stone-900 text-stone-50">
                <i data-lucide="scale" class="h-4 w-4"></i>
              </span>
              <span>laglig.se</span>
            </div>
            <p class="mt-3 max-w-sm text-sm text-stone-600">Sveriges mest kompletta plattform för lagbevakning, kravstyrning och lagefterlevnadskontroll. För compliance som sover gott.</p>
            <div class="mt-4 flex gap-3 text-stone-500">
              <a href="#" class="hover:text-stone-800"><i data-lucide="linkedin" class="h-4 w-4"></i></a>
              <a href="#" class="hover:text-stone-800"><i data-lucide="youtube" class="h-4 w-4"></i></a>
              <a href="#" class="hover:text-stone-800"><i data-lucide="rss" class="h-4 w-4"></i></a>
            </div>
          </div>
          <div>
            <div class="text-xs font-semibold uppercase tracking-wider text-stone-500">Produkt</div>
            <ul class="mt-3 space-y-2 text-sm text-stone-700">
              <li><a href="produkt-lagefterlevnadskontroll.html" class="hover:text-amber-800">Lagefterlevnadskontroll</a></li>
              <li><a href="#" class="hover:text-amber-800">Laglistor</a></li>
              <li><a href="#" class="hover:text-amber-800">Lagbevakning</a></li>
              <li><a href="#" class="hover:text-amber-800">AI-assistent</a></li>
              <li><a href="#" class="hover:text-amber-800">Uppgifter</a></li>
            </ul>
          </div>
          <div>
            <div class="text-xs font-semibold uppercase tracking-wider text-stone-500">Branscher</div>
            <ul class="mt-3 space-y-2 text-sm text-stone-700">
              <li><a href="branscher-bygg.html" class="hover:text-amber-800">Bygg & Anläggning</a></li>
              <li><a href="branscher.html" class="hover:text-amber-800">Industri</a></li>
              <li><a href="branscher.html" class="hover:text-amber-800">Tech & SaaS</a></li>
              <li><a href="branscher.html" class="hover:text-amber-800">Vård & Omsorg</a></li>
              <li><a href="branscher.html" class="hover:text-amber-800">Offentlig sektor</a></li>
            </ul>
          </div>
          <div>
            <div class="text-xs font-semibold uppercase tracking-wider text-stone-500">Resurser</div>
            <ul class="mt-3 space-y-2 text-sm text-stone-700">
              <li><a href="resurser-lagordlista.html" class="hover:text-amber-800">Lagordlista</a></li>
              <li><a href="#" class="hover:text-amber-800">Blogg</a></li>
              <li><a href="#" class="hover:text-amber-800">Kundcase</a></li>
              <li><a href="#" class="hover:text-amber-800">Verktyg</a></li>
              <li><a href="#" class="hover:text-amber-800">Byt till laglig.se</a></li>
            </ul>
          </div>
        </div>
        <div class="mt-12 flex flex-col gap-3 border-t border-stone-200/70 pt-6 text-xs text-stone-500 md:flex-row md:items-center md:justify-between">
          <div>© 2026 laglig.se AB · Org.nr 559XXX-XXXX</div>
          <div class="flex gap-5">
            <a href="#" class="hover:text-stone-700">Integritet</a>
            <a href="#" class="hover:text-stone-700">Användarvillkor</a>
            <a href="#" class="hover:text-stone-700">Säkerhet</a>
            <a href="#" class="hover:text-stone-700">Status</a>
          </div>
        </div>
      </div>
    </footer>
  `;
  const slot = document.getElementById('site-footer');
  if (slot) slot.outerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
  injectNav();
  injectFooter();
  // Render any static mega-menus declared on the page
  document.querySelectorAll('[data-static-mega]').forEach((el) => {
    renderStaticMegaMenu(el, el.getAttribute('data-static-mega'));
  });
  if (window.lucide) window.lucide.createIcons();
});
