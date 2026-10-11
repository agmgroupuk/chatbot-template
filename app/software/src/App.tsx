import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Blocks,
  Check,
  Code2,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  MonitorSmartphone,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import { AuthModal, type AuthMode, type AuthUser } from './components/AuthModal';
import { softwareCatalog, softwareServices, type SoftwareProduct } from './data/catalog';

const mainSite = 'https://onefinsolution.online';

const productIcons = {
  agency: Blocks,
  admin: LayoutDashboard,
  commerce: ShoppingBag,
  landing: Sparkles,
  mobile: MonitorSmartphone,
  crm: BarChart3,
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

function ProductCard({ product, onEnquire }: { product: SoftwareProduct; onEnquire: (product: SoftwareProduct) => void }) {
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
          <button type="button" onClick={() => onEnquire(product)}>Ask about this <ArrowRight size={15} aria-hidden="true" /></button>
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

  const openEnquiry = (subject: string) => {
    window.location.assign(`${mainSite}/contact?category=pricing&subject=${encodeURIComponent(subject)}`);
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
          <a href="#templates" onClick={() => setMobileMenuOpen(false)}>Templates</a>
          <a href="#services" onClick={() => setMobileMenuOpen(false)}>Custom development</a>
          <a href="#process" onClick={() => setMobileMenuOpen(false)}>How it works</a>
          <a className="main-site-link" href={mainSite}>Main website <ArrowRight size={14} aria-hidden="true" /></a>
        </nav>
        <div className="ofs-account">
          {authReady && (user ? (
            <div className="account-chip">
              <span className="account-avatar" aria-hidden="true">{user.email.slice(0, 1).toUpperCase()}</span>
              <span className="account-email">{user.email}</span>
              <button type="button" onClick={handleLogout}>Sign out</button>
            </div>
          ) : (
            <button type="button" className="signin-button" onClick={() => setAuthMode('sign-in')}><LockKeyhole size={15} aria-hidden="true" /> Sign in</button>
          ))}
        </div>
      </header>
      {sessionError && <p className="service-error" role="alert">{sessionError}</p>}
      {accountError && <p className="service-error" role="alert">{accountError}</p>}

      <main>
        <section className="ofs-hero" id="home">
          <div className="hero-copy">
            <span className="ofs-eyebrow"><Sparkles size={15} aria-hidden="true" /> DIGITAL PRODUCTS &amp; DEVELOPMENT</span>
            <h1>Custom Software &amp; Digital Templates <span>for Your Business</span></h1>
            <p>Discover ready-made website templates, SaaS dashboards, e-commerce designs, and mobile UI kits—or get custom software built around your business needs.</p>
            <div className="hero-actions">
              <a className="ofs-button primary" href="#templates">Explore templates <ArrowDown size={16} aria-hidden="true" /></a>
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

        <section className="content-section" id="templates">
          <div className="section-heading">
            <div><span className="ofs-eyebrow">A SMARTER STARTING POINT</span><h2>Digital templates</h2></div>
            <p>Choose a considered starting point for your website, dashboard, store, or app.</p>
          </div>
          <div className="product-grid">
            {softwareCatalog.map((product) => (
              <ProductCard key={product.id} product={product} onEnquire={(item) => openEnquiry(`Template enquiry: ${item.name}`)} />
            ))}
          </div>
          <p className="catalog-note">For template availability and purchasing information, contact One Fin Solution. Checkout and file delivery will be added once this store’s payment setup is configured.</p>
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

      {authMode && (
        <AuthModal
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={() => setAuthMode(null)}
          onAuthenticated={(nextUser) => { setUser(nextUser); setAuthMode(null); }}
        />
      )}
    </div>
  );
}
