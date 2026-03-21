import { useNavigate } from "react-router-dom";

// ── NAV ───────────────────────────────────────────────────────────────────────
function Nav({ onGetStarted }) {
  return (
    <nav className="glass fixed top-0 left-0 right-0 z-50 px-6 md:px-10" style={{ height: 68 }}>
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: "linear-gradient(135deg,#3A7D2C,#5AAD40)" }}>
            <span className="font-manrope font-black text-white" style={{ fontSize: 16 }}>L</span>
          </div>
          <span className="font-manrope font-black text-white" style={{ fontSize: 20, letterSpacing: "-0.03em" }}>Lumina</span>
        </div>

        {/* Links */}
        <div className="hidden md:flex items-center gap-8">
          {["Solutions", "Intelligence", "Pricing", "About"].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`}
              className="font-manrope font-medium transition-colors duration-200"
              style={{ color: "#8A9E80", fontSize: 14 }}
              onMouseEnter={e => e.target.style.color = "#90D87B"}
              onMouseLeave={e => e.target.style.color = "#8A9E80"}
            >{l}</a>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3">
          <button onClick={onGetStarted} className="btn-ghost hidden md:block" style={{ padding: "8px 18px", fontSize: 13 }}>Sign In</button>
          <button onClick={onGetStarted} className="btn-primary" style={{ padding: "9px 22px", fontSize: 13 }}>Get Started →</button>
        </div>
      </div>
    </nav>
  );
}

// ── HERO ──────────────────────────────────────────────────────────────────────
function Hero({ onGetStarted }) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center overflow-hidden" style={{ padding: "120px 24px 80px" }}>
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute pulse-glow" style={{ top: "20%", left: "50%", transform: "translateX(-50%)", width: 700, height: 700, background: "radial-gradient(circle, rgba(58,125,44,0.18) 0%, transparent 70%)", borderRadius: "50%" }} />
        <div className="absolute" style={{ top: "60%", left: "15%", width: 300, height: 300, background: "radial-gradient(circle, rgba(144,216,123,0.06) 0%, transparent 70%)", borderRadius: "50%" }} />
        <div className="absolute" style={{ top: "40%", right: "10%", width: 250, height: 250, background: "radial-gradient(circle, rgba(58,125,44,0.08) 0%, transparent 70%)", borderRadius: "50%" }} />
        {/* Grid overlay */}
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(58,125,44,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(58,125,44,0.04) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Badge */}
      <div className="relative flex items-center gap-2 mb-8 px-4 py-2 rounded-full" style={{ background: "rgba(58,125,44,0.12)", border: "1px solid rgba(144,216,123,0.25)" }}>
        <div className="w-2 h-2 rounded-full pulse-glow" style={{ background: "#90D87B" }} />
        <span className="font-manrope font-semibold" style={{ color: "#90D87B", fontSize: 12, letterSpacing: "0.08em" }}>NOW IN BETA · $50 / MONTH</span>
      </div>

      {/* Headline */}
      <h1 className="relative font-manrope font-black mb-6" style={{ fontSize: "clamp(42px, 7vw, 84px)", lineHeight: 1.02, letterSpacing: "-0.04em", maxWidth: 860 }}>
        <span style={{ color: "#F4F0E6" }}>Turn any data into</span><br />
        <span className="text-gradient">financial intelligence</span>
      </h1>

      {/* Sub */}
      <p className="relative mb-10" style={{ color: "#8A9E80", fontSize: "clamp(16px, 2vw, 19px)", lineHeight: 1.75, maxWidth: 560, fontFamily: "Inter" }}>
        Upload any spreadsheet — CSV, Excel, any format — and Lumina instantly generates professional dashboards, forecasts, and insights. No setup. No formulas.
      </p>

      {/* CTAs */}
      <div className="relative flex flex-wrap gap-4 justify-center mb-20">
        <button onClick={onGetStarted} className="btn-primary" style={{ padding: "16px 36px", fontSize: 16 }}>Start for Free →</button>
        <button onClick={onGetStarted} className="btn-ghost" style={{ padding: "16px 30px", fontSize: 15 }}>See the Dashboard</button>
      </div>

      {/* Stats */}
      <div className="relative flex flex-wrap gap-12 justify-center">
        {[
          { value: "Any file", label: "CSV · Excel · ODS" },
          { value: "< 60s", label: "From upload to insights" },
          { value: "7 views", label: "Analysis modes" },
          { value: "2,000+", label: "Monte Carlo simulations" },
        ].map(s => (
          <div key={s.label} className="text-center">
            <p className="font-manrope font-black mb-1" style={{ color: "#F4F0E6", fontSize: 26, letterSpacing: "-0.03em" }}>{s.value}</p>
            <p style={{ color: "#8A9E80", fontSize: 12, letterSpacing: "0.04em" }}>{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── DASHBOARD PREVIEW ────────────────────────────────────────────────────────
function DashboardPreview() {
  const bars = [19, 53, 49, 53, 69, 81];
  const years = ["2025","2026","2027","2028","2029","2030"];
  return (
    <section className="relative px-6 pb-24" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="glass-card glow-green p-6 md:p-8 float" style={{ border: "1px solid rgba(58,125,44,0.25)" }}>
        {/* Fake tab bar */}
        <div className="flex items-center gap-2 mb-6 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {["Overview","Scenario Analysis","Monte Carlo","CAPEX Detail"].map((t, i) => (
            <span key={t} className="font-manrope font-semibold px-3 py-1 rounded-md text-xs"
              style={{ background: i === 0 ? "rgba(58,125,44,0.25)" : "transparent", color: i === 0 ? "#90D87B" : "#8A9E80", border: i === 0 ? "1px solid rgba(144,216,123,0.3)" : "none", cursor: "pointer" }}>{t}</span>
          ))}
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Revenue", value: "$11.68M", color: "#90D87B" },
            { label: "Total CAPEX", value: "$3.12M", color: "#C8A04A" },
            { label: "Peak Margin", value: "81%", color: "#5AAD40" },
            { label: "CPO Production", value: "11.7K T", color: "#8A9E80" },
          ].map(k => (
            <div key={k.label} className="glass-card p-4" style={{ border: "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{ color: "#8A9E80", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{k.label}</p>
              <p className="font-manrope font-black" style={{ color: k.color, fontSize: 22, letterSpacing: "-0.02em" }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Bar chart mockup */}
        <div className="glass-card p-5" style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
          <p className="font-manrope font-bold mb-4" style={{ color: "#F4F0E6", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase" }}>Operating Margin Trend — 2025 to 2030</p>
          <div className="flex items-end gap-3" style={{ height: 100 }}>
            {bars.map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <span style={{ color: "#8A9E80", fontSize: 9 }}>{h}%</span>
                <div className="w-full rounded-t-md transition-all" style={{ height: `${h}%`, background: h >= 60 ? "linear-gradient(to top, #3A7D2C, #90D87B)" : h >= 40 ? "linear-gradient(to top, #2C5F1A, #5AAD40)" : "linear-gradient(to top, #1E3A14, #3A7D2C)" }} />
                <span style={{ color: "#8A9E80", fontSize: 9 }}>{years[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── FEATURES ─────────────────────────────────────────────────────────────────
function Features() {
  const features = [
    { icon: "◈", title: "Drop any file", body: "CSV, Excel, ODS — clean or messy, any language, any layout. Lumina reads it all and extracts the data automatically." },
    { icon: "⟳", title: "Auto data cleaning", body: "Broken formulas, merged cells, currency symbols, monthly rows — cleaned automatically before a single chart renders." },
    { icon: "▦", title: "Instant dashboard", body: "Revenue trends, margin analysis, CAPEX planning, Monte Carlo simulation — a full dashboard generated from your numbers." },
    { icon: "⟠", title: "Scenario modeling", body: "Run Bear, Base, and Bull scenarios side by side. Adjust levers in real time and see how projections change instantly." },
    { icon: "⊙", title: "Monte Carlo simulation", body: "Understand the probability of different outcomes. Run 2,000 simulations across your key financial variables in seconds." },
    { icon: "⬡", title: "Private by default", body: "Your data never leaves your account. Every project is isolated — only you can see it. Enterprise-grade security." },
  ];

  return (
    <section id="solutions" style={{ padding: "100px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <div className="text-center mb-16">
        <p className="font-manrope font-semibold mb-3" style={{ color: "#90D87B", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>Intelligence Layer</p>
        <h2 className="font-manrope font-black mb-4" style={{ color: "#F4F0E6", fontSize: "clamp(28px, 4vw, 46px)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          Everything you need to<br />understand your business
        </h2>
        <p style={{ color: "#8A9E80", fontSize: 17, lineHeight: 1.7 }}>From raw data to boardroom-ready insights in under a minute.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((f, i) => (
          <div key={f.title} className="glass-card p-7 group transition-all duration-300"
            style={{ cursor: "default" }}
            onMouseEnter={e => { e.currentTarget.style.border = "1px solid rgba(144,216,123,0.2)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <div className="mb-5 font-manrope font-black" style={{ color: "#90D87B", fontSize: 24 }}>{f.icon}</div>
            <h3 className="font-manrope font-bold mb-3" style={{ color: "#F4F0E6", fontSize: 17, letterSpacing: "-0.01em" }}>{f.title}</h3>
            <p style={{ color: "#8A9E80", fontSize: 14, lineHeight: 1.75 }}>{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── WHO IT'S FOR ─────────────────────────────────────────────────────────────
function WhoItsFor({ onGetStarted }) {
  const segments = [
    { icon: "🌿", title: "Agribusiness Operators", body: "Track plantation development, CPO production, FFB yields, and operational costs across multiple years and sites." },
    { icon: "💼", title: "Investors & Analysts", body: "Upload any financial model and instantly get scenario analysis, margin trends, and risk simulations to support investment decisions." },
    { icon: "📋", title: "Financial Analysts", body: "Stop rebuilding charts in Excel. Upload your data and get a live, interactive dashboard you can explore and present." },
    { icon: "🍽️", title: "Restaurants & F&B", body: "Track revenue per location, food costs, labor costs, and profitability trends across months and years." },
  ];

  return (
    <section id="intelligence" className="relative" style={{ padding: "100px 24px", borderTop: "1px solid rgba(58,125,44,0.12)", borderBottom: "1px solid rgba(58,125,44,0.12)" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(58,125,44,0.06) 0%, transparent 70%)" }} />
      <div className="relative max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="font-manrope font-semibold mb-3" style={{ color: "#90D87B", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>Who It's For</p>
          <h2 className="font-manrope font-black mb-4" style={{ color: "#F4F0E6", fontSize: "clamp(28px, 4vw, 46px)", letterSpacing: "-0.03em" }}>Built for people who run things</h2>
          <p style={{ color: "#8A9E80", fontSize: 17 }}>Lumina works for any business that has financial data and needs clarity.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {segments.map(s => (
            <div key={s.title} className="glass-card p-6 transition-all duration-300"
              onMouseEnter={e => { e.currentTarget.style.border = "1px solid rgba(144,216,123,0.2)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{s.icon}</div>
              <h3 className="font-manrope font-bold mb-2" style={{ color: "#F4F0E6", fontSize: 15, letterSpacing: "-0.01em" }}>{s.title}</h3>
              <p style={{ color: "#8A9E80", fontSize: 13, lineHeight: 1.7 }}>{s.body}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button onClick={onGetStarted} className="btn-primary" style={{ padding: "15px 36px", fontSize: 15 }}>Get Started →</button>
        </div>
      </div>
    </section>
  );
}

// ── PRICING ──────────────────────────────────────────────────────────────────
function Pricing({ onGetStarted }) {
  return (
    <section id="pricing" style={{ padding: "100px 24px", maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
      <p className="font-manrope font-semibold mb-3" style={{ color: "#90D87B", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>Pricing</p>
      <h2 className="font-manrope font-black mb-4" style={{ color: "#F4F0E6", fontSize: "clamp(28px, 4vw, 46px)", letterSpacing: "-0.03em" }}>Simple pricing</h2>
      <p style={{ color: "#8A9E80", fontSize: 17, marginBottom: 48 }}>One plan. Everything included. Cancel anytime.</p>

      <div className="glass-card glow-green relative overflow-hidden" style={{ padding: "48px 44px", border: "1px solid rgba(58,125,44,0.3)" }}>
        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0" style={{ height: 2, background: "linear-gradient(90deg, transparent, #90D87B, transparent)" }} />

        <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full mb-6" style={{ background: "rgba(58,125,44,0.15)", border: "1px solid rgba(144,216,123,0.25)" }}>
          <span className="font-manrope font-bold" style={{ color: "#90D87B", fontSize: 11, letterSpacing: "0.08em" }}>BETA PRICING</span>
        </div>

        <div className="mb-2">
          <span className="font-manrope font-black" style={{ color: "#F4F0E6", fontSize: 72, letterSpacing: "-0.05em" }}>$50</span>
          <span style={{ color: "#8A9E80", fontSize: 20 }}> / month</span>
        </div>
        <p style={{ color: "#8A9E80", fontSize: 14, marginBottom: 40 }}>per workspace · billed monthly</p>

        <div className="flex flex-col gap-3 mb-10 text-left">
          {[
            "Unlimited file uploads (CSV, Excel, ODS)",
            "Full financial dashboard — 7 analysis views",
            "Scenario modeling (Bear / Base / Bull)",
            "Monte Carlo risk simulation",
            "Multiple projects per account",
            "Private, secure data storage",
            "Priority support",
          ].map(f => (
            <div key={f} className="flex items-center gap-3">
              <div className="flex-shrink-0 flex items-center justify-center rounded-full" style={{ width: 20, height: 20, background: "rgba(58,125,44,0.2)", border: "1px solid rgba(144,216,123,0.3)" }}>
                <span style={{ color: "#90D87B", fontSize: 11 }}>✓</span>
              </div>
              <span style={{ color: "#C8D5C4", fontSize: 14 }}>{f}</span>
            </div>
          ))}
        </div>

        <button onClick={onGetStarted} className="btn-primary w-full" style={{ padding: "16px", fontSize: 16 }}>
          Start Free Trial →
        </button>
        <p style={{ color: "#8A9E80", fontSize: 12, marginTop: 14 }}>No credit card required to get started</p>
      </div>
    </section>
  );
}

// ── CTA BANNER ────────────────────────────────────────────────────────────────
function CTABanner({ onGetStarted }) {
  return (
    <section className="relative overflow-hidden" style={{ padding: "80px 24px", margin: "0 24px 80px", borderRadius: 20, background: "linear-gradient(135deg, rgba(58,125,44,0.15) 0%, rgba(16,20,15,0.8) 50%, rgba(58,125,44,0.1) 100%)", border: "1px solid rgba(58,125,44,0.25)" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(144,216,123,0.08) 0%, transparent 60%)" }} />
      <div className="relative text-center max-w-2xl mx-auto">
        <h2 className="font-manrope font-black mb-4" style={{ color: "#F4F0E6", fontSize: "clamp(28px, 4vw, 44px)", letterSpacing: "-0.03em" }}>
          Ready to see your data differently?
        </h2>
        <p style={{ color: "#8A9E80", fontSize: 17, lineHeight: 1.7, marginBottom: 36 }}>
          Join operators, investors, and analysts who use Lumina to turn raw numbers into clear decisions.
        </p>
        <button onClick={onGetStarted} className="btn-primary" style={{ padding: "16px 40px", fontSize: 16 }}>
          Get Started Free →
        </button>
      </div>
    </section>
  );
}

// ── FOOTER ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-4 px-10 py-8" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, background: "linear-gradient(135deg,#3A7D2C,#5AAD40)" }}>
          <span className="font-manrope font-black text-white" style={{ fontSize: 13 }}>L</span>
        </div>
        <span style={{ color: "#8A9E80", fontSize: 13 }}>Lumina © 2025 · Financial Intelligence Platform</span>
      </div>
      <span style={{ color: "rgba(138,158,128,0.5)", fontSize: 12 }}>Built for operators. Powered by data.</span>
    </footer>
  );
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();
  const goToApp = () => navigate("/login");

  return (
    <div style={{ background: "#0B0F0A", minHeight: "100vh" }}>
      <Nav onGetStarted={goToApp} />
      <Hero onGetStarted={goToApp} />
      <DashboardPreview />
      <Features />
      <WhoItsFor onGetStarted={goToApp} />
      <Pricing onGetStarted={goToApp} />
      <CTABanner onGetStarted={goToApp} />
      <Footer />
    </div>
  );
}
