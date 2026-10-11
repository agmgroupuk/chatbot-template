import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Blocks,
  Check,
  Code2,
  Eye,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Monitor,
  MonitorSmartphone,
  Search,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tablet,
  X,
} from 'lucide-react';
import { AuthModal, type AuthMode, type AuthUser } from './components/AuthModal';
import { PurchaseHistoryModal } from './components/PurchaseHistoryModal';
import { TemplatePreviewModal } from './components/TemplatePreviewModal';
import { softwareCatalog, softwareServices, type SoftwareProduct } from './data/catalog';
import { TEMPLATES, type TemplateProduct } from './data/templatesData';

const mainSite = 'https://onefinsolution.online';

interface EnquiryItem {
  id: string;
  qty: number;
}

const formatBaht = (amount: number) => `฿${amount.toLocaleString('en-US')}`;

const productIcons = {
  agency: Blocks,
  admin: LayoutDashboard,
  commerce: ShoppingBag,
  landing: Sparkles,
  mobile: MonitorSmartphone,
  crm: BarChart3,
  finance: BarChart3,
  restaurant: ShoppingBag,
  'real-estate': Blocks,
  portfolio: Sparkles,
  booking: MonitorSmartphone,
  education: LayoutDashboard,
};

function ProductPreview({ product }: { product: SoftwareProduct }) {
  return (
    <div className={`product-preview preview-${product.id}`} aria-hidden="true">
      <div className="mock-window">
        <div className="mock-window-bar"><i /><i /><i /><span /></div>
        <div className="mock-window-body">
          <div className="mock-sidebar"><b /><i /><i /><i /><i /></div>
          <div className="mock-content">
            <div className="mock-title"><b /><i /></div>
            <div className="mock-metrics"><i /><i /><i /></div>
            <div className="mock-chart"><span /><span /><span /><span /><span /><span /><span /></div>
            <div className="mock-table"><i /><i /><i /></div>
          </div>
        </div>
      </div>
      {product.id === 'mobile' && <div className="mock-phone"><i /><b /><span /><span /><em /></div>}
    </div>
  );
}

function ProductCard({
  product,
  onPreview,
}: {
  product: SoftwareProduct;
  onPreview: (product: SoftwareProduct) => void;
}) {
  const Icon = productIcons[product.id];
  return (
    <article className="product-card">
      <ProductPreview product={product} />
      <div className="product-card-content">
        <span className="product-category"><Icon size={14} aria-hidden="true" />{product.category}</span>
        <h3>{product.name}</h3>
        <p>{product.description}</p>
        <div className="product-card-footer">
          <strong>{product.priceLabel}</strong>
          <button type="button" onClick={() => onPreview(product)} aria-label={`Preview ${product.name}`}>
            Preview template <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [accountError, setAccountError] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [checkoutAvailable, setCheckoutAvailable] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [paymentNotice, setPaymentNotice] = useState('');
  const [payingProductId, setPayingProductId] = useState('');
  const [pendingProductId, setPendingProductId] = useState('');
  const [confirmationSessionId, setConfirmationSessionId] = useState('');
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<SoftwareProduct | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<TemplateProduct | null>(null);
  const [previewTab, setPreviewTab] = useState<'preview' | 'specs'>('preview');
  const [viewportSize, setViewportSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isEnquiryOpen, setIsEnquiryOpen] = useState(false);
  const [enquiry, setEnquiry] = useState<EnquiryItem[]>(() => {
    try {
      const saved = localStorage.getItem('one-fin-template-enquiry-v1');
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is EnquiryItem =>
        typeof item?.id === 'string'
        && TEMPLATES.some((template) => template.id === item.id)
        && Number.isInteger(item.qty)
        && item.qty > 0,
      );
    } catch (error) {
      console.error('Could not load the saved template enquiry list.', error);
      return [];
    }
  });
  const closeOrders = useCallback(() => setOrdersOpen(false), []);
  const closeTemplatePreview = useCallback(() => setPreviewProduct(null), []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/session', { credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not check the sign-in session.');
        const data = await response.json() as { user: AuthUser | null };
        setUser(data.user);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Could not load software-store session.', error);
        setSessionError('Account access is temporarily unavailable. Please try again in a moment.');
      })
      .finally(() => setAuthReady(true));

    const query = new URLSearchParams(window.location.search);
    if (query.has('reset')) setAuthMode('reset');
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/checkout/status', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not check the Stripe sandbox configuration.');
        const data = await response.json() as { available: boolean };
        setCheckoutAvailable(data.available);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Could not check software-store checkout configuration.', error);
        setCheckoutError('Sandbox checkout status could not be checked. Please refresh and try again.');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('one-fin-template-enquiry-v1', JSON.stringify(enquiry));
    } catch (error) {
      console.error('Could not save the template enquiry list.', error);
    }
  }, [enquiry]);

  useEffect(() => {
    if (!previewTemplate && !isEnquiryOpen) return;
    document.body.classList.add('template-preview-open');
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewTemplate(null);
        setIsEnquiryOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('template-preview-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewTemplate, isEnquiryOpen]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('checkout') === 'cancel') {
      setPaymentNotice('Checkout was cancelled. No payment was made.');
      window.history.replaceState(null, '', window.location.pathname);
    } else if (query.get('checkout') === 'success') {
      const sessionId = query.get('session_id');
      if (sessionId) setConfirmationSessionId(sessionId);
      else setCheckoutError('The payment confirmation link is incomplete. Check your purchases or contact support.');
    }
  }, []);

  useEffect(() => {
    if (!authReady || !confirmationSessionId) return;
    if (!user) {
      setAuthMode('sign-in');
      return;
    }
    const controller = new AbortController();
    fetch(`/api/checkout/confirm?session_id=${encodeURIComponent(confirmationSessionId)}`, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json() as { status?: string; error?: string };
        if (!response.ok) throw new Error(data.error || 'The payment could not be verified.');
        if (data.status === 'paid') {
          setPaymentNotice('Stripe sandbox payment confirmed. No real charge was made. Digital file delivery is not connected yet; please contact us to arrange delivery.');
          setConfirmationSessionId('');
          window.history.replaceState(null, '', window.location.pathname);
        } else if (data.status === 'pending') {
          setPaymentNotice('Your payment is still processing. Check Purchases again shortly.');
          setConfirmationSessionId('');
          window.history.replaceState(null, '', window.location.pathname);
        } else {
          throw new Error('This checkout was not completed. No payment was recorded.');
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Could not verify storefront checkout.', error);
        setCheckoutError(error instanceof Error ? error.message : 'The payment could not be verified.');
        setConfirmationSessionId('');
      });
    return () => controller.abort();
  }, [authReady, confirmationSessionId, user]);

  const beginCheckout = async (productId: string) => {
    setCheckoutError('');
    setPaymentNotice('');
    setPayingProductId(productId);
    try {
      const response = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ productId }),
      });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'Checkout could not be started.');
      if (!data.url) throw new Error('Stripe did not provide a checkout page.');
      window.location.assign(data.url);
    } catch (error) {
      console.error('Could not start storefront checkout.', error);
      setCheckoutError(error instanceof Error ? error.message : 'Checkout could not be started.');
    } finally {
      setPayingProductId('');
    }
  };

  const requestPurchase = (product: SoftwareProduct) => {
    if (!checkoutAvailable) {
      setCheckoutError('Stripe sandbox checkout is not configured for this storefront yet.');
      return;
    }
    if (!user) {
      setPendingProductId(product.id);
      setAuthMode('sign-in');
      return;
    }
    void beginCheckout(product.id);
  };

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return TEMPLATES.filter((template) => {
      const matchesCategory = activeCategory === 'all' || template.category === activeCategory;
      const matchesQuery = !query || [
        template.name,
        template.subtitle,
        template.categoryLabel,
        template.description,
        ...template.features,
        ...template.techStack,
      ].some((value) => value.toLowerCase().includes(query));
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, searchQuery]);

  const enquiryTotalCount = enquiry.reduce((sum, item) => sum + item.qty, 0);
  const enquirySubtotal = enquiry.reduce((sum, item) => {
    const template = TEMPLATES.find((candidate) => candidate.id === item.id);
    return sum + (template ? template.price * item.qty : 0);
  }, 0);
  const enquiryDetails = enquiry.map((item) => {
    const template = TEMPLATES.find((candidate) => candidate.id === item.id);
    return template ? `${template.name} × ${item.qty}` : '';
  }).filter(Boolean).join(', ');
  const enquiryHref = `${mainSite}/contact?category=general&subject=${encodeURIComponent(`Template enquiry: ${enquiryDetails}`)}`;

  const addToEnquiry = (id: string) => {
    setEnquiry((current) => {
      const existing = current.find((item) => item.id === id);
      return existing
        ? current.map((item) => item.id === id ? { ...item, qty: item.qty + 1 } : item)
        : [...current, { id, qty: 1 }];
    });
    setIsEnquiryOpen(true);
  };

  const updateEnquiryQuantity = (id: string, change: number) => {
    setEnquiry((current) => current
      .map((item) => item.id === id ? { ...item, qty: item.qty + change } : item)
      .filter((item) => item.qty > 0));
  };

  const handleLogout = async () => {
    setAccountError('');
    const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    if (!response.ok) {
      console.error('Sign out failed:', await response.text());
      setAccountError('Sign out could not be completed. Please try again.');
      return;
    }
    setUser(null);
    setAuthMode(null);
    setOrdersOpen(false);
  };

  return (
    <div className="ofs-app">
      <header className="ofs-header">
        <a className="ofs-brand" href="#home" aria-label="One Fin Solution Software home">
          <img src="/images/one-fin-logo.png" alt="" width="42" height="42" />
          <span>One Fin <b>Software</b></span>
        </a>
        <button className="mobile-menu-toggle" type="button" aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)}>
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className={`ofs-nav${mobileMenuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
          <a href="#design-library" onClick={() => setMobileMenuOpen(false)}>Preview library</a>
          <a href="#templates" onClick={() => setMobileMenuOpen(false)}>Checkout catalog</a>
          <a href="#services" onClick={() => setMobileMenuOpen(false)}>Custom development</a>
          <a href="#process" onClick={() => setMobileMenuOpen(false)}>How it works</a>
          <a className="main-site-link" href={mainSite}>Main website <ArrowRight size={14} aria-hidden="true" /></a>
        </nav>
        <div className="ofs-account">
          {authReady && (user ? (
            <div className="account-chip">
              <span className="account-avatar" aria-hidden="true">{user.email.slice(0, 1).toUpperCase()}</span>
              <span className="account-email">{user.email}</span>
              <button type="button" onClick={() => setOrdersOpen(true)}>Purchases</button>
              <button type="button" onClick={handleLogout}>Sign out</button>
            </div>
          ) : (
            <button type="button" className="signin-button" onClick={() => setAuthMode('sign-in')}><LockKeyhole size={15} aria-hidden="true" /> Sign in</button>
          ))}
        </div>
      </header>
      {sessionError && <p className="service-error" role="alert">{sessionError}</p>}
      {accountError && <p className="service-error" role="alert">{accountError}</p>}
      {checkoutError && <p className="service-error" role="alert">{checkoutError}</p>}
      {paymentNotice && <p className="service-notice" role="status">{paymentNotice}</p>}

      <main>
        <section className="ofs-hero" id="home">
          <div className="hero-copy">
            <span className="ofs-eyebrow"><Sparkles size={15} aria-hidden="true" /> DIGITAL PRODUCTS &amp; DEVELOPMENT</span>
            <h1>Custom Software &amp; Digital Templates <span>for Your Business</span></h1>
            <p>Discover ready-made website templates, SaaS dashboards, e-commerce designs, and mobile UI kits—or get custom software built around your business needs.</p>
            <div className="hero-actions">
              <a className="ofs-button primary" href="#design-library">Explore templates <ArrowDown size={16} aria-hidden="true" /></a>
              <a className="ofs-button secondary" href="#services">Get custom software <ArrowRight size={16} aria-hidden="true" /></a>
            </div>
            <div className="hero-assurance"><span><Check size={14} aria-hidden="true" /></span> Practical digital foundations, tailored to your next idea.</div>
          </div>
          <div className="hero-art" role="img" aria-label="Stylized previews of a website, business dashboard, and mobile interface">
            <div className="hero-art-glow" />
            <div className="hero-back-window">
              <div className="hero-window-bar"><i /><i /><i /></div>
              <div className="hero-back-content"><span /><b /><i /><i /><em /></div>
            </div>
            <div className="hero-dashboard">
              <div className="hero-dashboard-top"><span className="hero-brand-mark"><Blocks size={14} /></span><i /><b /><b /></div>
              <div className="hero-dashboard-main">
                <div className="hero-dashboard-nav"><i /><i /><i /><i /><i /></div>
                <div className="hero-dashboard-content">
                  <div className="hero-dashboard-title"><b /><span /></div>
                  <div className="hero-dashboard-stats"><i /><i /><i /></div>
                  <div className="hero-chart"><div><i /><i /><i /><i /></div><svg viewBox="0 0 300 100" preserveAspectRatio="none"><path d="M0 82 C30 76 33 56 65 63 S104 84 130 51 S170 60 195 34 S235 47 260 20 S285 25 300 8" /></svg></div>
                  <div className="hero-dashboard-bottom"><i /><i /><i /></div>
                </div>
              </div>
            </div>
            <div className="hero-phone"><i /><b /><span /><span /><em /></div>
            <div className="hero-art-label"><span><Code2 size={15} /></span><b>Designed for what’s next<small>Web · software · mobile</small></b></div>
          </div>
        </section>

        <section className="design-library-section" id="design-library">
          <div className="section-heading">
            <div><span className="ofs-eyebrow">INTERACTIVE DESIGN COLLECTION</span><h2>Explore the template library</h2></div>
            <p>Search and filter the collection, inspect a live responsive preview, and send selected designs to our team as an enquiry.</p>
          </div>
          <div className="design-library-controls">
            <div className="template-category-filters" role="group" aria-label="Filter templates by category">
              {[
                { id: 'all', label: `All templates (${TEMPLATES.length})` },
                { id: 'website', label: 'Websites' },
                { id: 'dashboard', label: 'Dashboards' },
                { id: 'commerce', label: 'Commerce' },
                { id: 'saas', label: 'SaaS' },
                { id: 'mobile', label: 'Mobile UI' },
              ].map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={activeCategory === category.id ? 'is-active' : ''}
                  aria-pressed={activeCategory === category.id}
                  onClick={() => setActiveCategory(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>
            <label className="template-search">
              <Search size={16} aria-hidden="true" />
              <span className="visually-hidden">Search templates</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search templates and features"
              />
            </label>
          </div>
          {filteredTemplates.length === 0 ? (
            <div className="template-empty-state">
              <p>No templates match “{searchQuery}”.</p>
              <button type="button" onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}>Reset filters</button>
            </div>
          ) : (
            <div className="template-library-grid">
              {filteredTemplates.map((template) => (
                <article className="library-template-card" key={template.id}>
                  <button
                    className="library-template-art"
                    style={{ background: template.accentColor }}
                    type="button"
                    onClick={() => { setPreviewTemplate(template); setPreviewTab('preview'); }}
                    aria-label={`Open full preview of ${template.name}`}
                  >
                    <span className="library-template-window" aria-hidden="true"><i /><i /><i /><span /></span>
                    <strong>{template.name}</strong>
                    <small>{template.categoryLabel} · {template.pagesCount}</small>
                    <span className="library-template-preview-label"><Eye size={14} /> Live preview</span>
                  </button>
                  <div className="library-template-info">
                    <div className="library-template-title">
                      <div><h3>{template.name}</h3><p>{template.subtitle}</p></div>
                      <strong>{formatBaht(template.price)}</strong>
                    </div>
                    <p className="library-template-description">{template.description}</p>
                    <div className="library-template-meta">
                      <span>{template.format}</span><span>{template.fileSize}</span><span>Updated {template.updatedAt}</span>
                    </div>
                    <div className="library-template-actions">
                      <button type="button" className="template-preview-button" onClick={() => { setPreviewTemplate(template); setPreviewTab('preview'); }}>
                        <Eye size={15} aria-hidden="true" /> Full preview
                      </button>
                      <button type="button" className="template-enquiry-button" onClick={() => addToEnquiry(template.id)}>
                        Add to enquiry
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <p className="template-enquiry-note">Prices are indicative. This enquiry list does not take payment; our team will confirm availability and purchase details.</p>
        </section>

        <section className="content-section" id="templates">
          <div className="section-heading">
            <div><span className="ofs-eyebrow">SECURE STOREFRONT CHECKOUT</span><h2>Checkout catalog</h2></div>
            <p>These products are connected to the storefront account, Stripe checkout, and purchase history.</p>
          </div>
          {checkoutAvailable && <p className="checkout-sandbox-note">Stripe sandbox only: no real charges are made. Digital downloads are not connected yet.</p>}
          <div className="product-grid">
            {softwareCatalog.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onPreview={setPreviewProduct}
              />
            ))}
          </div>
          {!checkoutAvailable && <p className="catalog-note">Browse each design preview. Template checkout will be available after payment and digital delivery are configured.</p>}
        </section>

        <section className="content-section services-section" id="services">
          <div className="section-heading">
            <div><span className="ofs-eyebrow">BUILT AROUND YOUR BUSINESS</span><h2>Custom development</h2></div>
            <p>Get in touch to discuss scope, requirements, and a tailored approach.</p>
          </div>
          <div className="service-grid">
            {softwareServices.map(({ id, name, description, priceLabel, Icon }, index) => (
              <article className="service-card" key={id}>
                <span className="service-icon"><Icon size={20} aria-hidden="true" /></span>
                <span className="service-number">0{index + 1}</span>
                <h3>{name}</h3>
                <p>{description}</p>
                <strong>{priceLabel}</strong>
                <a href={`${mainSite}/contact?category=general&subject=${encodeURIComponent(`${name} enquiry`)}`}>Discuss your project <ArrowRight size={15} aria-hidden="true" /></a>
              </article>
            ))}
          </div>
        </section>

        <section className="benefits-section">
          <div><span className="ofs-eyebrow">WHY ONE FIN</span><h2>Good software should make work feel simpler.</h2><p>Start with a ready-made foundation or plan a custom product around your goals.</p></div>
          <ul>
            {['Responsive design for desktop, tablet, and mobile', 'Clean code and reusable components', 'Customization to fit your brand and workflow', 'Professional development focused on your needs'].map((benefit) => <li key={benefit}><span><Check size={14} /></span>{benefit}</li>)}
          </ul>
        </section>

        <section className="content-section process-section" id="process">
          <div className="section-heading"><div><span className="ofs-eyebrow">A CLEAR, SIMPLE PROCESS</span><h2>From first idea to launch</h2></div><p>Start with the right foundation, then shape it into something that works for you.</p></div>
          <ol className="process-grid">
            {[
              ['01', 'Choose a Template', 'Find a starting point that fits your project.'],
              ['02', 'Customize', 'Adapt the details to your brand and requirements.'],
              ['03', 'Develop', 'Build a cohesive and responsive experience.'],
              ['04', 'Launch', 'Prepare your finished project for its next step.'],
            ].map(([number, title, description]) => <li key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></li>)}
          </ol>
        </section>

        <section className="final-cta">
          <div><span className="ofs-eyebrow">YOUR NEXT STEP STARTS HERE</span><h2>Ready to Build Something Great?</h2><p>Explore a template or tell us about the software you need.</p></div>
          <div className="hero-actions"><a className="ofs-button light" href="#templates">Browse templates <ArrowDown size={16} /></a><a className="ofs-button outline" href="#services">Explore custom development <ArrowRight size={16} /></a></div>
        </section>
      </main>

      <footer className="ofs-footer">
        <div className="footer-main">
          <a className="ofs-brand" href="#home"><img src="/images/one-fin-logo.png" alt="" width="40" height="40" /><span>One Fin <b>Software</b></span></a>
          <p>Practical digital products and software development for your business.</p>
          <nav aria-label="Main website links"><a href={`${mainSite}/privacy`}>Privacy</a><a href={`${mainSite}/terms`}>Terms</a><a href={`${mainSite}/payment-policy`}>Payments &amp; refunds</a><a href={`${mainSite}/contact`}>Contact</a></nav>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} One Fin Solution</span><a href={mainSite}>Visit the main website <ArrowRight size={13} /></a></div>
      </footer>

      <button className="template-enquiry-fab" type="button" onClick={() => setIsEnquiryOpen(true)} aria-label={`Open template enquiry list with ${enquiryTotalCount} items`}>
        <ShoppingBag size={17} aria-hidden="true" /> Enquiry list <span>{enquiryTotalCount}</span>
      </button>
      {isEnquiryOpen && (
        <div className="template-enquiry-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsEnquiryOpen(false); }}>
          <aside className="template-enquiry-drawer" role="dialog" aria-modal="true" aria-labelledby="template-enquiry-title">
            <div className="template-enquiry-heading">
              <div><h2 id="template-enquiry-title">Template enquiry list</h2><p>Save designs to include in a message to our team.</p></div>
              <button type="button" onClick={() => setIsEnquiryOpen(false)} aria-label="Close enquiry list"><X size={19} /></button>
            </div>
            <div className="template-enquiry-items">
              {enquiry.length === 0 ? (
                <div className="template-enquiry-empty"><p>Your enquiry list is empty.</p><button type="button" onClick={() => setIsEnquiryOpen(false)}>Browse templates</button></div>
              ) : enquiry.map((item) => {
                const template = TEMPLATES.find((candidate) => candidate.id === item.id);
                if (!template) return null;
                return (
                  <div className="template-enquiry-item" key={item.id}>
                    <div><strong>{template.name}</strong><span>{template.categoryLabel}</span>
                      <div className="template-enquiry-quantity">
                        <button type="button" onClick={() => updateEnquiryQuantity(item.id, -1)} aria-label={`Remove one ${template.name}`}>−</button>
                        <span>{item.qty}</span>
                        <button type="button" onClick={() => updateEnquiryQuantity(item.id, 1)} aria-label={`Add one ${template.name}`}>+</button>
                        <button className="template-enquiry-remove" type="button" onClick={() => setEnquiry((current) => current.filter((entry) => entry.id !== item.id))}>Remove</button>
                      </div>
                    </div>
                    <strong>{formatBaht(template.price * item.qty)}</strong>
                  </div>
                );
              })}
            </div>
            <div className="template-enquiry-total">
              <div><span>Indicative total</span><strong>{formatBaht(enquirySubtotal)}</strong></div>
              <p>No payment is taken from this list. The enquiry opens the One Fin Solution contact page.</p>
              <a href={enquiryHref} aria-disabled={enquiry.length === 0} onClick={(event) => { if (enquiry.length === 0) event.preventDefault(); }}>
                Send purchase enquiry <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
          </aside>
        </div>
      )}
      {previewTemplate && (
        <div className="template-library-preview-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewTemplate(null); }}>
          <section className="template-library-preview" role="dialog" aria-modal="true" aria-label={`${previewTemplate.name} template preview`}>
            <header className="template-library-preview-toolbar">
              <div className="template-library-preview-dots" aria-hidden="true"><i /><i /><i /></div>
              <strong>{previewTemplate.name}</strong>
              <button type="button" onClick={() => setPreviewTemplate(null)} aria-label="Close template preview"><X size={19} /></button>
            </header>
            <div className="template-library-preview-controls">
              <div className="template-preview-tabs" role="tablist" aria-label="Template preview details">
                <button type="button" role="tab" aria-selected={previewTab === 'preview'} onClick={() => setPreviewTab('preview')}>Live preview</button>
                <button type="button" role="tab" aria-selected={previewTab === 'specs'} onClick={() => setPreviewTab('specs')}>Specifications</button>
              </div>
              {previewTab === 'preview' && (
                <div className="template-viewport-controls" role="group" aria-label="Preview viewport size">
                  <button type="button" className={viewportSize === 'desktop' ? 'is-active' : ''} onClick={() => setViewportSize('desktop')} aria-label="Desktop viewport"><Monitor size={16} /></button>
                  <button type="button" className={viewportSize === 'tablet' ? 'is-active' : ''} onClick={() => setViewportSize('tablet')} aria-label="Tablet viewport"><Tablet size={16} /></button>
                  <button type="button" className={viewportSize === 'mobile' ? 'is-active' : ''} onClick={() => setViewportSize('mobile')} aria-label="Mobile viewport"><Smartphone size={16} /></button>
                </div>
              )}
              <button className="template-preview-enquire" type="button" onClick={() => { addToEnquiry(previewTemplate.id); setPreviewTemplate(null); }}>Add to enquiry list</button>
            </div>
            {previewTab === 'preview' ? (
              <div className="template-library-iframe-stage">
                <div className={`template-library-iframe-frame viewport-${viewportSize}`}>
                  <iframe title={`${previewTemplate.name} live preview`} srcDoc={previewTemplate.htmlSource} sandbox="allow-scripts allow-modals" />
                </div>
              </div>
            ) : (
              <div className="template-library-specs">
                <span className="ofs-eyebrow">{previewTemplate.categoryLabel} · {previewTemplate.format}</span>
                <h2>{previewTemplate.name}</h2>
                <p>{previewTemplate.description}</p>
                <dl>
                  <div><dt>Sections</dt><dd>{previewTemplate.pagesCount}</dd></div>
                  <div><dt>File size</dt><dd>{previewTemplate.fileSize}</dd></div>
                  <div><dt>Last updated</dt><dd>{previewTemplate.updatedAt}</dd></div>
                  <div><dt>Indicative price</dt><dd>{formatBaht(previewTemplate.price)}</dd></div>
                </dl>
                <h3>Included features</h3>
                <ul>{previewTemplate.features.map((feature) => <li key={feature}><Check size={15} aria-hidden="true" />{feature}</li>)}</ul>
                <h3>Technology</h3>
                <div className="template-tech-stack">{previewTemplate.techStack.map((technology) => <span key={technology}>{technology}</span>)}</div>
                <p className="template-enquiry-note">Price and availability are confirmed by our team. The preview is not a payment or file download.</p>
              </div>
            )}
            <footer className="template-library-preview-footer">
              <span>{formatBaht(previewTemplate.price)} <small>indicative price</small></span>
              <button type="button" onClick={() => { addToEnquiry(previewTemplate.id); setPreviewTemplate(null); }}>Add to enquiry <ArrowRight size={15} /></button>
            </footer>
          </section>
        </div>
      )}

      {authMode && (
        <AuthModal
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={() => setAuthMode(null)}
          onAuthenticated={(nextUser) => {
            setUser(nextUser);
            setAuthMode(null);
            if (pendingProductId) {
              const productId = pendingProductId;
              setPendingProductId('');
              void beginCheckout(productId);
            }
          }}
        />
      )}
      {ordersOpen && user && <PurchaseHistoryModal onClose={closeOrders} />}
      {previewProduct && (
        <TemplatePreviewModal
          product={previewProduct}
          checkoutAvailable={checkoutAvailable}
          checkoutBusy={Boolean(payingProductId)}
          onClose={closeTemplatePreview}
          onPurchase={(product) => {
            closeTemplatePreview();
            requestPurchase(product);
          }}
        />
      )}
    </div>
  );
}
