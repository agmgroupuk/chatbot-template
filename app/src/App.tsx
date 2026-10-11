import { useState, useEffect, useMemo } from 'react';
import {
  TEMPLATES,
  TemplateProduct,
} from './data/templatesData';
import {
  ShoppingBag,
  Eye,
  Check,
  X,
  Monitor,
  Tablet,
  Smartphone,
  ArrowUpRight,
  Search,
  Menu,
} from 'lucide-react';

interface CartItem {
  id: string;
  qty: number;
}

const formatBaht = (amount: number) => `฿${amount.toLocaleString('en-US')}`;

export default function App() {
  const mainSite = 'https://onefinsolution.online';
  // Keep a short list of templates while the visitor prepares an enquiry.
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('one-fin-template-enquiry-v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Full-page template preview state.
  const [previewTemplate, setPreviewTemplate] = useState<TemplateProduct | null>(null);
  const [previewTab, setPreviewTab] = useState<'preview' | 'specs'>('preview');
  const [viewportSize, setViewportSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const getContactHref = (subject: string) =>
    `${mainSite}/contact?category=general&subject=${encodeURIComponent(subject)}`;
  useEffect(() => {
    try {
      localStorage.setItem('one-fin-template-enquiry-v1', JSON.stringify(cart));
    } catch {
      console.error('Could not save the template enquiry list.');
    }
  }, [cart]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewTemplate(null);
        setIsCartOpen(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  const addToCart = (id: string, openDrawer = true) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === id);
      if (existing) {
        return prev.map((item) => (item.id === id ? { ...item, qty: item.qty + 1 } : item));
      }
      return [...prev, { id, qty: 1 }];
    });
    if (openDrawer) {
      setIsCartOpen(true);
    } else {
      const prod = TEMPLATES.find((t) => t.id === id);
      if (prod) triggerToast(`Added "${prod.name}" to your enquiry list`);
    }
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0)
    );
  };

  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter((t) => {
      const matchesCat = activeCategory === 'all' || t.category === activeCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.subtitle.toLowerCase().includes(q) ||
        t.categoryLabel.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [activeCategory, searchQuery]);

  const cartTotalCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartSubtotal = cart.reduce((sum, item) => {
    const prod = TEMPLATES.find((t) => t.id === item.id);
    return sum + (prod ? prod.price * item.qty : 0);
  }, 0);
  const enquiryDetails = cart
    .map((item) => {
      const template = TEMPLATES.find((product) => product.id === item.id);
      return template ? `${template.name} × ${item.qty}` : '';
    })
    .filter(Boolean)
    .join(', ');
  const enquiryHref = getContactHref(`Template enquiry: ${enquiryDetails}`);

  // Render distinct interactive miniature visual preview for each template card
  const renderCardArt = (template: TemplateProduct) => {
    switch (template.id) {
      case 'luma':
        return (
          <div className="h-56 bg-[#e8e1d8] text-[#24231f] p-4 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between text-[10px] font-medium">
              <strong className="font-display text-sm font-bold">luma.</strong>
              <span className="opacity-75">Studio · Work · Estimator</span>
              <span className="bg-[#27241f] text-white px-2 py-0.5 rounded text-[9px]">Let&apos;s talk ↗</span>
            </div>
            <div className="relative z-10 my-auto">
              <div className="text-[9px] tracking-widest uppercase opacity-70">CREATIVE STUDIO / 2026</div>
              <div className="font-display text-3xl font-bold leading-none tracking-tight my-1.5">
                Ideas into
                <br />
                impact.
              </div>
              <div className="text-[10px] opacity-80">Brand &amp; digital experiences for the bold.</div>
            </div>
            <div className="absolute right-5 -bottom-6 w-24 h-32 rounded-t-full bg-gradient-to-br from-[#dba48a] to-[#a25d49] -rotate-12" />
          </div>
        );
      case 'nova':
        return (
          <div className="h-56 bg-[#f4f3ff] text-[#25243b] flex overflow-hidden">
            <div className="w-[30%] bg-[#1e1d36] text-[#c7c4e2] p-3 flex flex-col gap-2.5 text-[9px]">
              <strong className="text-white text-xs font-display">◈ nova</strong>
              <span>▦ Overview</span>
              <span>◷ Cohorts</span>
              <span>♙ Accounts</span>
              <span>⚙ Telemetry</span>
            </div>
            <div className="flex-1 p-3.5 flex flex-col justify-between">
              <div>
                <div className="text-[8px] text-[#8b88a5] font-semibold">EXECUTIVE TELEMETRY</div>
                <div className="text-xs font-bold mt-0.5">Net MRR · $84,920</div>
              </div>
              <div className="grid grid-cols-2 gap-2 my-2">
                <div className="bg-white p-2 rounded border border-indigo-100">
                  <div className="text-[8px] text-slate-400">Net Retention</div>
                  <div className="font-mono text-xs font-bold text-indigo-950">118.6%</div>
                </div>
                <div className="bg-white p-2 rounded border border-indigo-100">
                  <div className="text-[8px] text-slate-400">Active Seats</div>
                  <div className="font-mono text-xs font-bold text-indigo-950">14,290</div>
                </div>
              </div>
              <div className="h-14 bg-white rounded border border-indigo-100 p-2 flex items-end gap-1.5">
                {[38, 65, 52, 78, 92, 68, 85, 100].map((h, i) => (
                  <div
                    key={i}
                    style={{ height: `${h}%` }}
                    className="flex-1 bg-indigo-500 rounded-t-sm"
                  />
                ))}
              </div>
            </div>
          </div>
        );
      case 'forma':
        return (
          <div className="h-56 bg-[#f1e8da] text-[#302c24] p-4 flex flex-col justify-between relative overflow-hidden">
            <div className="flex justify-between items-center text-[9px]">
              <strong className="tracking-widest font-display text-xs">FORMA®</strong>
              <span>Shop · Materiality</span>
              <span className="font-semibold">Bag (2)</span>
            </div>
            <div className="flex justify-between items-center my-auto">
              <div>
                <div className="text-[8px] tracking-widest opacity-70">THE EVERYDAY COLLECTION</div>
                <div className="font-display text-2xl font-bold leading-tight my-1.5">
                  Objects for
                  <br />
                  better living.
                </div>
                <span className="inline-block bg-[#343027] text-white text-[9px] px-2.5 py-1 rounded">
                  Explore collection ↗
                </span>
              </div>
              <div className="w-24 h-28 bg-[#d5c4ad] rounded-t-full rotate-6 grid place-items-center">
                <div className="w-11 h-16 bg-[#a58660] rounded-t-full shadow-inner" />
              </div>
            </div>
          </div>
        );
      case 'flow':
        return (
          <div className="h-56 bg-[#dfe8db] grid place-items-center p-3">
            <div className="w-36 h-48 border-[3px] border-[#242a25] rounded-2xl bg-[#f8f8ef] p-3 flex flex-col justify-between text-[#202820] shadow-md">
              <div className="w-8 h-1 bg-[#242a25] rounded-full mx-auto" />
              <div>
                <div className="text-[7px] tracking-widest opacity-60">YOUR DAILY FLOW</div>
                <div className="font-display text-xs font-bold leading-tight mt-0.5">
                  25:00 Focus
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#c6d5b8] grid place-items-center mx-auto text-sm font-bold text-[#2d523c]">
                ◷
              </div>
              <div className="space-y-1 text-[8px]">
                <div className="bg-white px-1.5 py-1 rounded">✓ Morning sunlight</div>
                <div className="bg-white px-1.5 py-1 rounded">○ Deep work sprint</div>
              </div>
            </div>
          </div>
        );
      case 'arc':
        return (
          <div className="h-56 bg-[#e8e5df] text-[#282723] p-4 flex flex-col justify-between">
            <div className="flex justify-between text-[8px] font-semibold tracking-wider">
              <span>ARC / ARCHITECTURE</span>
              <span>ZÜRICH · TOKYO</span>
            </div>
            <div className="h-36 bg-gradient-to-br from-[#c8c7be] to-[#9b9c91] relative overflow-hidden rounded p-3 flex items-end">
              <div className="absolute right-4 top-2 w-28 h-40 bg-gradient-to-r from-[#dfdcd2] via-[#a9a99d] to-[#dedbd1] -skew-y-6 shadow-lg" />
              <div className="relative z-10 font-display text-2xl font-bold leading-none">
                Spaces
                <br />
                with soul.
              </div>
            </div>
          </div>
        );
      case 'spark':
        return (
          <div className="h-56 bg-[#171e1f] text-[#eff8f1] p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[9px]">
              <strong className="font-display text-xs">✳ spark finance</strong>
              <span className="text-emerald-400 font-mono">● LIVE</span>
            </div>
            <div>
              <div className="text-[8px] text-[#9ab0a9] tracking-wider">LIQUID PORTFOLIO VALUE</div>
              <div className="font-mono text-xl font-bold mt-0.5">$128,430.80</div>
              <div className="text-[9px] text-emerald-400">↗ +12.8% this month</div>
            </div>
            <svg viewBox="0 0 320 60" className="w-full h-12">
              <path
                d="M0 50 Q30 40 55 44 T110 28 T165 34 T220 14 T275 20 T320 4"
                fill="none"
                stroke="#34d399"
                strokeWidth="3"
              />
            </svg>
            <div className="grid grid-cols-2 gap-2 text-[9px]">
              <div className="bg-[#242e30] px-2 py-1 rounded">
                Treasury <strong className="font-mono text-white ml-1">$92k</strong>
              </div>
              <div className="bg-[#242e30] px-2 py-1 rounded">
                APY <strong className="font-mono text-emerald-400 ml-1">+8.4%</strong>
              </div>
            </div>
          </div>
        );
      case 'kinetix':
        return (
          <div className="h-56 bg-slate-950 text-white p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[9px]">
              <strong className="font-display text-xs text-indigo-400">kinetix.dev</strong>
              <span className="font-mono text-[8px] text-slate-400">CI/CD ENGINE</span>
            </div>
            <div className="my-auto">
              <div className="text-[8px] tracking-widest text-indigo-400 font-semibold">
                DETERMINISTIC PIPELINES
              </div>
              <div className="font-display text-xl font-bold leading-snug mt-1">
                Ship builds in 90 seconds.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[9px] bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <div>
                <div className="text-slate-400 text-[8px]">Starter Seat</div>
                <div className="font-mono text-sm font-bold text-white">$39/mo</div>
              </div>
              <div>
                <div className="text-slate-400 text-[8px]">Cache Hit</div>
                <div className="font-mono text-sm font-bold text-indigo-400">99.4%</div>
              </div>
            </div>
          </div>
        );
      case 'atelier':
        return (
          <div className="h-56 bg-[#241d19] text-[#f5ede6] p-4 flex flex-col justify-between">
            <div className="flex justify-between text-[9px] text-[#b8a99a]">
              <strong className="tracking-widest text-white">ATELIER SORA</strong>
              <span>7-COURSE TASTING</span>
            </div>
            <div className="my-auto">
              <div className="text-[8px] tracking-widest text-[#d97757]">WOOD-FIRED HEARTH</div>
              <div className="font-display text-2xl font-bold leading-tight mt-1">
                Autumn Harvest
                <br />
                Reservations.
              </div>
            </div>
            <div className="flex justify-between items-center bg-[#312822] px-3 py-2 rounded text-[9px]">
              <span>2 Guests · 18:30 Seating</span>
              <span className="text-[#d97757] font-bold">Book Table ↗</span>
            </div>
          </div>
        );
      default:
        return (
          <div className="h-56 bg-[#0b111e] text-slate-100 p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[9px]">
              <strong className="font-display text-xs">pulse.status</strong>
              <span className="font-mono text-emerald-400">99.994% SLA</span>
            </div>
            <div className="bg-emerald-950/60 border border-emerald-500/30 rounded px-2.5 py-1.5 text-[9px] text-emerald-300 font-medium">
              ✓ All 14 Edge Regions Operational
            </div>
            <div className="space-y-1.5">
              <div className="text-[8px] text-slate-400 flex justify-between">
                <span>Core GraphQL API</span>
                <span className="font-mono text-emerald-400">18ms p95</span>
              </div>
              <div className="grid grid-cols-24 gap-0.5 h-5">
                {Array.from({ length: 24 }).map((_, idx) => (
                  <div key={idx} className="bg-emerald-400 rounded-[1px]" />
                ))}
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#171721]">
      <header className="sticky top-0 z-30 min-h-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 lg:px-12 flex items-center justify-between gap-5">
        <a
          href="#home"
          className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          One Fin <span className="text-[#7559e8]">Software</span>
        </a>

        <nav className={`${mobileNavOpen ? 'flex' : 'hidden'} md:flex absolute md:static top-full left-0 right-0 md:top-auto md:left-auto md:right-auto flex-col md:flex-row items-stretch md:items-center gap-0 md:gap-7 border-b md:border-0 border-slate-200 bg-white md:bg-transparent px-6 md:px-0 py-2 md:py-0 shadow-lg md:shadow-none text-sm font-medium text-slate-600`}>
          <a
            href="#products"
            onClick={() => setMobileNavOpen(false)}
            className="py-3 md:py-0 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Templates
          </a>
          <a
            href="#services"
            onClick={() => setMobileNavOpen(false)}
            className="py-3 md:py-0 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Services
          </a>
          <a
            href="#pricing"
            onClick={() => setMobileNavOpen(false)}
            className="py-3 md:py-0 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Pricing
          </a>
          <a
            href="#contact"
            onClick={() => setMobileNavOpen(false)}
            className="py-3 md:py-0 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Contact
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href={getContactHref('Custom software enquiry')}
            className="hidden sm:inline-flex px-4 py-2.5 text-xs font-semibold text-white bg-[#171721] hover:bg-[#7559e8] rounded-lg transition-colors whitespace-nowrap shrink-0 items-center gap-2"
          >
            Discuss a project <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileNavOpen}
            className="md:hidden w-10 h-10 grid place-items-center rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO SECTION */}
        <section
          id="home"
          className="max-w-[1360px] mx-auto px-6 lg:px-12 pt-14 pb-20 lg:pt-20 lg:pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center"
        >
          <div className="lg:col-span-6 space-y-6">
            <div className="text-xs font-bold tracking-widest uppercase text-[#7559e8]">
              ONE FIN SOLUTION · DIGITAL TEMPLATES &amp; SOFTWARE
            </div>
            <h1
              className="font-display text-4xl sm:text-6xl font-bold tracking-tight text-slate-900 leading-[1.03]"
              style={{ textWrap: 'balance' }}
            >
              Software and templates <span className="text-[#7559e8]">for your business.</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              Explore ready-made website and software design previews, or talk with our team about
              building a solution around your business.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a
                href="#products"
                className="px-6 py-3.5 rounded-lg bg-[#7559e8] hover:bg-[#6246d3] text-white font-semibold text-sm shadow-sm transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <span>Explore {TEMPLATES.length} Templates</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>
              <a
                href={getContactHref('Custom software enquiry')}
                className="px-5 py-3.5 rounded-lg border border-slate-300 hover:border-slate-900 text-slate-800 font-semibold text-sm transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 bg-white"
              >
                <span>Discuss custom software</span>
                <ArrowUpRight className="w-4 h-4 text-[#7559e8]" />
              </a>
            </div>

            <div className="pt-6 border-t border-slate-200/80 grid grid-cols-3 gap-6 max-w-lg">
              <div>
                <div className="font-mono text-xl font-bold text-slate-900 tabular-nums">{TEMPLATES.length} Designs</div>
                <div className="text-xs text-slate-500 mt-0.5">Interactive previews</div>
              </div>
              <div>
                <div className="font-mono text-xl font-bold text-slate-900 tabular-nums">Web &amp; App</div>
                <div className="text-xs text-slate-500 mt-0.5">Different design formats</div>
              </div>
              <div>
                <div className="font-mono text-xl font-bold text-slate-900 tabular-nums">Custom</div>
                <div className="text-xs text-slate-500 mt-0.5">Development available</div>
              </div>
            </div>
          </div>

          {/* Interactive Hero Dashboard Visual Preview */}
          <div className="lg:col-span-6 relative">
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="text-xs text-slate-500 font-mono ml-2">
                    one-fin-software-template-library
                  </span>
                </div>
                <span className="text-xs font-mono text-[#7559e8] font-semibold">
                  Single-File Ready
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-white border border-slate-200/80 rounded-xl p-4">
                  <div className="text-xs text-slate-500">WEBSITE TEMPLATES</div>
                  <div className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {TEMPLATES.filter((template) => template.category === 'website').length.toString().padStart(2, '0')}
                  </div>
                  <div className="text-xs text-slate-600 font-medium mt-1">Portfolio and business layouts</div>
                </div>
                <div className="bg-white border border-slate-200/80 rounded-xl p-4">
                  <div className="text-xs text-slate-500">SOFTWARE STARTERS</div>
                  <div className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {TEMPLATES.length.toString().padStart(2, '0')}
                  </div>
                  <div className="text-xs text-slate-600 font-medium mt-1">Preview available for every design</div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span className="font-semibold text-slate-800">
                    A closer look at the template collection
                  </span>
                  <span className="font-mono">One Fin Software</span>
                </div>
                <svg
                  viewBox="0 0 340 95"
                  className="w-full h-24"
                  role="img"
                  aria-label="Growth chart"
                >
                  <defs>
                    <linearGradient id="heroAreaGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#7559e8" stopOpacity="0.28" />
                      <stop offset="1" stopColor="#7559e8" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 78 C25 72 28 54 53 60 S86 76 112 46 S155 60 176 32 S212 52 236 22 S275 38 300 15 S325 24 340 6 L340 95 L0 95Z"
                    fill="url(#heroAreaGrad)"
                  />
                  <path
                    d="M0 78 C25 72 28 54 53 60 S86 76 112 46 S155 60 176 32 S212 52 236 22 S275 38 300 15 S325 24 340 6"
                    fill="none"
                    stroke="#7559e8"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200/80 text-xs text-slate-600">
                <span>
                  Click <strong className="text-slate-900">Live Full-Page Preview</strong> on any card below to test the full app.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewTemplate(TEMPLATES[1]);
                    setPreviewTab('preview');
                  }}
                  className="text-[#7559e8] font-semibold hover:underline cursor-pointer whitespace-nowrap"
                >
                  Preview a dashboard →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <section className="border-y border-slate-200 bg-slate-50/60 py-5 px-6 lg:px-12">
          <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-6 text-xs text-slate-500">
            <span className="tracking-widest uppercase font-semibold text-slate-400">
              DESIGNED FOR TEAMS BUILDING
            </span>
            <div className="flex flex-wrap items-center gap-8 font-display font-bold tracking-wider text-slate-700">
              <span>STARTUPS</span>
              <span>CREATIVE STUDIOS</span>
              <span>SAAS FOUNDERS</span>
              <span>INDEPENDENT MAKERS</span>
              <span>DIGITAL AGENCIES</span>
            </div>
          </div>
        </section>

        {/* THE TEMPLATE LIBRARY SECTION */}
        <section id="products" className="max-w-[1360px] mx-auto px-6 lg:px-12 py-24">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-[#7559e8] mb-2">
                THE TEMPLATE LIBRARY
              </div>
              <h2
                className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900"
                style={{ textWrap: 'balance' }}
              >
                Find a starting point that fits.
              </h2>
            </div>
            <p className="text-sm text-slate-600 max-w-md leading-relaxed">
              Explore a range of editable design concepts. Open a preview to review its layout and
              features, then contact us for availability and purchase details.
            </p>
          </div>

          {/* Interactive Filter Tabs + Search Input */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 pb-6 border-b border-slate-200">
            <div
              className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl"
              role="group"
              aria-label="Filter templates by category"
            >
              {[
                { id: 'all', label: `All Templates (${TEMPLATES.length})` },
                { id: 'website', label: 'Websites & Portfolios' },
                { id: 'dashboard', label: 'Dashboards & Finance' },
                { id: 'commerce', label: 'E-Commerce & Booking' },
                { id: 'saas', label: 'SaaS & DevOps' },
                { id: 'mobile', label: 'Mobile UI' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    activeCategory === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates, features..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#7559e8]"
              />
            </div>
          </div>

          {/* Product Grid */}
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200/80">
              <p className="text-sm text-slate-600 mb-3">
                No templates matched &ldquo;{searchQuery}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredTemplates.map((template) => (
                  <article
                    key={template.id}
                    className="group border border-slate-200/90 rounded-2xl overflow-hidden bg-white flex flex-col justify-between transition-all hover:border-slate-300 hover:shadow-lg"
                  >
                    <div>
                      {/* Clickable Visual Preview Header */}
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewTemplate(template);
                          setPreviewTab('preview');
                        }}
                        aria-label={`Preview ${template.name}`}
                        className="block w-full text-left cursor-pointer relative overflow-hidden border-0 border-b border-slate-100 bg-transparent p-0"
                      >
                        {renderCardArt(template)}
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 p-4">
                          <span className="px-4 py-2 rounded-lg bg-white text-slate-900 font-semibold text-xs flex items-center gap-1.5 shadow-md">
                            <Eye className="w-3.5 h-3.5 text-[#7559e8]" />
                            Live Full-Page Preview
                          </span>
                        </div>
                        </button>

                      {/* Card Body */}
                      <div className="p-6">
                        {/* Unboxed quiet metadata line */}
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                          <span className="font-semibold text-[#7559e8]">
                            {template.categoryLabel}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{template.pagesCount}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{template.fileSize}</span>
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-display text-lg font-bold text-slate-900">
                              {template.name}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">{template.subtitle}</p>
                          </div>
                          <strong className="font-mono text-base font-bold text-slate-900 tabular-nums shrink-0">
                            {formatBaht(template.price)}
                          </strong>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed mt-3 line-clamp-2">
                          {template.description}
                        </p>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="px-6 pb-6 pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewTemplate(template);
                          setPreviewTab('preview');
                        }}
                        className="flex-1 py-2.5 px-3 rounded-lg border border-slate-200 hover:border-slate-900 text-xs font-semibold text-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#7559e8]" />
                        <span>Full Preview</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => addToCart(template.id, true)}
                        className="py-2.5 px-3.5 rounded-lg bg-[#171721] hover:bg-[#7559e8] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Enquire
                      </button>
                    </div>
                  </article>
              ))}
            </div>
          )}
        </section>

        {/* CUSTOM DEVELOPMENT SERVICES SECTION */}
        <section id="services" className="bg-[#f7f6fb] border-y border-slate-200/80 py-24 px-6 lg:px-12">
          <div className="max-w-[1360px] mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-14">
              <div>
                <div className="text-xs font-bold tracking-widest uppercase text-[#7559e8] mb-2">
                  CUSTOM ENGINEERING &amp; ADAPTATION
                </div>
                <h2
                  className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900"
                  style={{ textWrap: 'balance' }}
                >
                  Your idea, engineered to production.
                </h2>
              </div>
              <p className="text-sm text-slate-600 max-w-md leading-relaxed">
                Start with one of our single-file templates or commission our studio to architect a
                custom storefront, internal SaaS console, or mobile product.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <article className="bg-white border border-slate-200/80 rounded-2xl p-8 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono font-semibold text-[#7559e8] mb-4">
                    01. BRAND &amp; WEB ARCHITECTURE
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 mb-3">
                    Business Websites
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Fast, high-converting marketing sites and editorial flagships engineered to build
                    trust and turn visitors into qualified pipeline.
                  </p>
                </div>
                <div className="pt-6 mt-8 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Turnkey delivery from</span>
                  <strong className="font-mono text-base font-bold text-slate-900 tabular-nums">
                    ฿18,000
                  </strong>
                </div>
              </article>

              <article className="bg-white border border-slate-200/80 rounded-2xl p-8 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono font-semibold text-[#7559e8] mb-4">
                    02. FULL-STACK WEB APPLICATIONS
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 mb-3">
                    Dashboards &amp; SaaS
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Executive analytics consoles, customer portals, multi-tenant billing workflows,
                    and real-time telemetry interfaces.
                  </p>
                </div>
                <div className="pt-6 mt-8 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Turnkey delivery from</span>
                  <strong className="font-mono text-base font-bold text-slate-900 tabular-nums">
                    ฿35,000
                  </strong>
                </div>
              </article>

              <article className="bg-white border border-slate-200/80 rounded-2xl p-8 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono font-semibold text-[#7559e8] mb-4">
                    03. CROSS-PLATFORM PRODUCT UI
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 mb-3">
                    Mobile Applications
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Tactile mobile-first product experiences, installable PWAs, and native iOS/Android
                    workflows with scalable backend foundations.
                  </p>
                </div>
                <div className="pt-6 mt-8 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Turnkey delivery from</span>
                  <strong className="font-mono text-base font-bold text-slate-900 tabular-nums">
                    ฿60,000
                  </strong>
                </div>
              </article>
            </div>

            <div className="mt-8 bg-[#232038] text-white rounded-2xl p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="text-xs font-bold tracking-widest text-indigo-300 uppercase">
                  NEED CUSTOM TEMPLATE CUSTOMIZATION?
                </div>
                <h3 className="font-display text-2xl font-bold mt-2">
                  Tell us what you&apos;re building.
                </h3>
                <p className="text-sm text-slate-300 mt-1">
                  We can re-skin any template above with your brand identity, connect Stripe checkout,
                  and deploy to your domain within 5 business days.
                </p>
              </div>
              <a
                href="#contact"
                className="px-6 py-3.5 rounded-lg bg-white text-slate-900 font-semibold text-xs hover:bg-indigo-50 transition-colors whitespace-nowrap shrink-0"
              >
                Discuss Your Project ↗
              </a>
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-[#f7f6fb] border-y border-slate-200/80 py-20 px-6 lg:px-12">
          <div className="max-w-[1120px] mx-auto">
            <div className="max-w-2xl mb-10">
              <div className="text-xs font-bold tracking-widest uppercase text-[#7559e8] mb-2">CLEAR STARTING POINTS</div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">Choose a design or plan a custom build.</h2>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">Template prices are shown on each product. Custom project pricing depends on scope and requirements.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <article className="bg-white border border-slate-200/90 rounded-2xl p-7 sm:p-9 flex flex-col">
                <div className="text-xs font-bold tracking-widest text-[#7559e8] uppercase">DIGITAL TEMPLATES</div>
                <h3 className="font-display text-2xl font-bold text-slate-900 mt-3">Browse the library</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">Review each design preview and its listed price before contacting us about availability.</p>
                <div className="font-mono text-2xl font-bold text-slate-900 my-5 pb-5 border-b border-slate-200 tabular-nums">From {formatBaht(Math.min(...TEMPLATES.map((template) => template.price)))}</div>
                <ul className="space-y-3 text-xs text-slate-600 mb-7">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0" />Interactive design previews</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0" />Product-specific prices in the catalog</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0" />Purchase details available by enquiry</li>
                </ul>
                <a href="#products" className="mt-auto inline-flex justify-center rounded-lg border border-slate-300 px-4 py-3 text-xs font-semibold text-slate-900 hover:border-slate-900">Browse templates</a>
              </article>
              <article className="bg-[#232038] text-white border border-[#232038] rounded-2xl p-7 sm:p-9 flex flex-col">
                <div className="text-xs font-bold tracking-widest text-indigo-200 uppercase">CUSTOM DEVELOPMENT</div>
                <h3 className="font-display text-2xl font-bold mt-3">Built around your business</h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">Discuss a website, dashboard, or mobile application with our team. Final pricing is scoped to your project.</p>
                <div className="font-mono text-2xl font-bold my-5 pb-5 border-b border-white/20">From ?18,000</div>
                <ul className="space-y-3 text-xs text-slate-200 mb-7">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-200 shrink-0" />Business websites</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-200 shrink-0" />Dashboards and business software</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-200 shrink-0" />Mobile application development</li>
                </ul>
                <a href={getContactHref('Custom software enquiry')} className="mt-auto inline-flex justify-center rounded-lg bg-white px-4 py-3 text-xs font-semibold text-slate-900 hover:bg-indigo-50">Discuss a project</a>
              </article>
            </div>
            <p className="mt-5 text-center text-xs text-slate-500">Online checkout and digital delivery are not configured here yet. Contact us for current availability.</p>
          </div>
        </section>

        <section id="contact" className="max-w-[1120px] mx-auto px-6 lg:px-12 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] items-center gap-8 rounded-2xl border border-slate-200 bg-white p-7 sm:p-10 shadow-sm">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-[#7559e8]">LET&apos;S TALK</div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-2">Have a project in mind?</h2>
              <p className="text-sm text-slate-600 mt-3 max-w-2xl leading-relaxed">For template availability, customization, or a new software project, continue to the One Fin Solution contact page.</p>
            </div>
            <a href={getContactHref('Software or template enquiry')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#7559e8] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#6246d3] whitespace-nowrap">Contact One Fin Solution <ArrowUpRight className="w-4 h-4" /></a>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-10 px-6 lg:px-12 bg-white">
        <div className="max-w-[1360px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-7">
          <div>
            <a href="#home" className="font-display text-lg font-bold text-slate-900">One Fin <span className="text-[#7559e8]">Software</span></a>
            <p className="text-xs text-slate-500 mt-1">Digital templates and custom software for your business.</p>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs font-medium text-slate-600">
            <a href="#products" className="hover:text-slate-900">Templates</a>
            <a href="#services" className="hover:text-slate-900">Services</a>
            <a href="#pricing" className="hover:text-slate-900">Pricing</a>
            <a href="https://onefinsolution.online/privacy" className="hover:text-slate-900">Privacy</a>
            <a href="https://onefinsolution.online/terms" className="hover:text-slate-900">Terms</a>
            <a href="https://onefinsolution.online/payment-policy" className="hover:text-slate-900">Payments &amp; refunds</a>
          </nav>
        </div>
        <div className="max-w-[1360px] mx-auto mt-7 pt-5 border-t border-slate-100 flex flex-wrap justify-between gap-3 text-xs text-slate-400">
          <span>? {new Date().getFullYear()} One Fin Solution</span>
          <a href="https://onefinsolution.online" className="hover:text-slate-600">Visit the main website ?</a>
        </div>
      </footer>

      <button type="button" onClick={() => setIsCartOpen(true)} aria-label="Open template enquiry list" className="fixed right-6 bottom-6 z-30 rounded-full bg-[#171721] hover:bg-[#7559e8] text-white px-5 py-3.5 shadow-xl flex items-center gap-2.5 text-xs font-semibold transition-all">
        <ShoppingBag className="w-4 h-4" />
        <span>Enquiry list</span>
        <span className="w-5 h-5 rounded-full bg-[#7559e8] text-white grid place-items-center font-mono text-[11px] tabular-nums">{cartTotalCount}</span>
      </button>

      {toastMessage && <div role="status" className="fixed bottom-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 text-xs font-medium flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 shrink-0" /><span>{toastMessage}</span></div>}

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsCartOpen(false); }}>
          <aside role="dialog" aria-modal="true" aria-label="Template enquiry list" className="w-full max-w-md bg-white h-full shadow-2xl p-6 sm:p-8 flex flex-col">
            <div className="flex items-center justify-between pb-5 border-b border-slate-200">
              <div><h3 className="font-display text-xl font-bold text-slate-900">Template enquiry list</h3><p className="text-xs text-slate-500 mt-0.5">Save designs to include in your enquiry.</p></div>
              <button type="button" onClick={() => setIsCartOpen(false)} aria-label="Close enquiry list" className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 grid place-items-center text-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto py-4 divide-y divide-slate-100">
              {cart.length === 0 ? (
                <div className="py-16 text-center space-y-3"><p className="text-xs text-slate-500">Your list is empty.</p><button type="button" onClick={() => setIsCartOpen(false)} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold">Browse templates</button></div>
              ) : cart.map((item) => {
                const product = TEMPLATES.find((template) => template.id === item.id);
                if (!product) return null;
                return (
                  <div key={item.id} className="py-4 flex items-start justify-between gap-4">
                    <div>
                      <strong className="text-sm font-bold text-slate-900 block">{product.name}</strong><span className="text-xs text-slate-500 block mt-0.5">{product.categoryLabel}</span>
                      <div className="flex items-center gap-2 mt-2">
                        <button type="button" onClick={() => updateCartQty(item.id, -1)} aria-label={'Remove one ' + product.name} className="w-7 h-7 rounded border border-slate-200 text-xs font-bold">?</button>
                        <span className="font-mono text-xs tabular-nums">{item.qty}</span>
                        <button type="button" onClick={() => updateCartQty(item.id, 1)} aria-label={'Add one ' + product.name} className="w-7 h-7 rounded border border-slate-200 text-xs font-bold">+</button>
                        <button type="button" onClick={() => removeFromCart(item.id)} className="text-[11px] text-slate-400 hover:text-rose-600 ml-2">Remove</button>
                      </div>
                    </div>
                    <strong className="font-mono text-sm font-bold text-slate-900 tabular-nums">{formatBaht(product.price * item.qty)}</strong>
                  </div>
                );
              })}
            </div>
            <div className="pt-5 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-sm"><span className="text-slate-600 font-medium">Listed price estimate</span><strong className="font-mono text-lg font-bold text-slate-900 tabular-nums">{formatBaht(cartSubtotal)}</strong></div>
              <p className="text-[11px] leading-relaxed text-slate-500">No payment is taken here. The enquiry link opens the One Fin Solution contact page.</p>
              <a href={enquiryHref} aria-disabled={cart.length === 0} onClick={(event) => { if (cart.length === 0) event.preventDefault(); }} className={cart.length ? 'w-full py-3.5 px-4 rounded-xl bg-[#7559e8] hover:bg-[#6246d3] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2' : 'w-full py-3.5 px-4 rounded-xl bg-slate-300 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-not-allowed'}>Send purchase enquiry <ArrowUpRight className="w-4 h-4" /></a>
            </div>
          </aside>
        </div>
      )}

      {/* FULL-PAGE INTERACTIVE TEMPLATE PREVIEW */}
      {previewTemplate && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex flex-col p-2 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label={`${previewTemplate.name} Full Page Preview`}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex-1 flex flex-col overflow-hidden">
            {/* Modal Top Studio Bar */}
            <div className="min-h-16 px-4 py-2 sm:px-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(null)}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 grid place-items-center text-slate-700 cursor-pointer"
                  title="Close full-page preview"
                >
                  <X className="w-4 h-4" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="font-display text-sm font-bold text-slate-900">
                      {previewTemplate.name}
                    </strong>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="font-mono text-xs text-[#7559e8] font-semibold">
                      {formatBaht(previewTemplate.price)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {previewTemplate.categoryLabel} · Design preview
                  </div>
                </div>
              </div>

              {/* Center Mode & Viewport Switcher */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-200/80 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('preview')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                      previewTab === 'preview'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Live Full Page</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('specs')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                      previewTab === 'specs'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Features &amp; details</span>
                  </button>
                </div>

                {previewTab === 'preview' && (
                  <div className="hidden lg:flex items-center bg-slate-200/80 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setViewportSize('desktop')}
                      className={`p-1.5 rounded ${
                        viewportSize === 'desktop' ? 'bg-white text-slate-900' : 'text-slate-500'
                      } cursor-pointer`}
                      title="Desktop viewport"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewportSize('tablet')}
                      className={`p-1.5 rounded ${
                        viewportSize === 'tablet' ? 'bg-white text-slate-900' : 'text-slate-500'
                      } cursor-pointer`}
                      title="Tablet viewport"
                    >
                      <Tablet className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewportSize('mobile')}
                      className={`p-1.5 rounded ${
                        viewportSize === 'mobile' ? 'bg-white text-slate-900' : 'text-slate-500'
                      } cursor-pointer`}
                      title="Mobile viewport"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Add the preview to an enquiry, without simulating checkout. */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    addToCart(previewTemplate.id, true);
                    setPreviewTemplate(null);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[#171721] hover:bg-[#7559e8] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  Add to enquiry list
                </button>
              </div>
            </div>

            {/* Modal Content Area */}
            <div className="flex-1 bg-slate-100 overflow-hidden flex flex-col items-center justify-center">
              {previewTab === 'preview' && (
                <div
                  className={`h-full bg-white shadow-xl transition-all duration-200 overflow-hidden ${
                    viewportSize === 'desktop'
                      ? 'w-full'
                      : viewportSize === 'tablet'
                        ? 'w-[768px] max-w-full my-3 rounded-xl border border-slate-300'
                        : 'w-[390px] max-w-full my-3 rounded-2xl border-4 border-slate-800'
                  }`}
                >
                  <iframe
                    title={`${previewTemplate.name} Live Sandbox`}
                    srcDoc={previewTemplate.htmlSource}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-modals"
                  />
                </div>
              )}

              {previewTab === 'specs' && (
                <div className="w-full h-full bg-white p-8 sm:p-12 overflow-y-auto">
                  <div className="max-w-3xl mx-auto space-y-8">
                    <div>
                      <div className="text-xs font-bold tracking-widest uppercase text-[#7559e8]">
                        {previewTemplate.categoryLabel} · {previewTemplate.format}
                      </div>
                      <h3 className="font-display text-3xl font-bold text-slate-900 mt-2">
                        {previewTemplate.name}
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed mt-3">
                        {previewTemplate.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {previewTemplate.features.map((feat, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3"
                        >
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="text-xs text-slate-700 leading-relaxed">{feat}</span>
                        </div>
                      ))}
                    </div>

                    <div className="p-6 rounded-2xl bg-[#f5f3ff] border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <strong className="font-display text-base font-bold text-slate-900 block">
                          Ready to launch with {previewTemplate.name}?
                        </strong>
                        <span className="text-xs text-slate-600">
                          Contact us to confirm availability and purchase details.
                        </span>
                      </div>
                      <a
                        href={getContactHref(`${previewTemplate.name} template enquiry`)}
                        className="px-5 py-3 rounded-lg bg-[#7559e8] hover:bg-[#6246d3] text-white text-xs font-semibold flex items-center gap-2 shrink-0"
                      >
                        <span>Ask about this template</span>
                        <ArrowUpRight className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
