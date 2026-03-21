import { useNavigate } from "react-router-dom";

const C = {
  bg: "#0B0F0A", panel: "#111812", border: "#1E2B1A",
  text: "#F4F0E6", muted: "#8A9E80", forest: "#3A7D2C", leaf: "#5AAD40",
  gold: "#C8A04A", amber: "#E8B84B", sage: "#7DA05A",
};

function Nav({ onGetStarted }) {
  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: `${C.bg}ee`, backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}`, padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, background: C.forest, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#fff", fontWeight: 900, fontSize: 16 }}>L</span>
        </div>
        <span style={{ color: C.text, fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>Lumina</span>
      </div>
      <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
        {["Features", "Who It's For", "Pricing"].map(l => (
          <a key={l} href={`#${l.toLowerCase().replace(/[^a-z]/g, "")}`}
            style={{ color: C.muted, fontSize: 14, textDecoration: "none", fontWeight: 500 }}>{l}</a>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onGetStarted} style={{ background: "none", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Sign In</button>
        <button onClick={onGetStarted} style={{ background: C.forest, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>Get Started</button>
      </div>
    </nav>
  );
}

function Hero({ onGetStarted }) {
  return (
    <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "120px 24px 80px", position: "relative", overflow: "hidden" }}>
      {/* Background glow */}
      <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)", width: 600, height: 600, background: `radial-gradient(circle, ${C.forest}22 0%, transparent 70%)`, pointerEvents: "none" }} />

      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${C.forest}18`, border: `1px solid ${C.forest}44`, borderRadius: 20, padding: "6px 16px", marginBottom: 32 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.leaf }} />
        <span style={{ color: C.leaf, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em" }}>NOW IN BETA — $50 / MONTH</span>
      </div>

      <h1 style={{ color: C.text, fontSize: "clamp(40px, 7vw, 80px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 0 24px", maxWidth: 800 }}>
        Turn any data into<br />
        <span style={{ color: C.leaf }}>financial intelligence</span>
      </h1>

      <p style={{ color: C.muted, fontSize: "clamp(16px, 2vw, 20px)", lineHeight: 1.7, maxWidth: 560, margin: "0 0 48px" }}>
        Upload any spreadsheet — CSV, Excel, any format — and Lumina instantly generates professional dashboards, forecasts, and insights. No setup. No formulas.
      </p>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={onGetStarted}
          style={{ background: C.forest, color: "#fff", border: "none", borderRadius: 10, padding: "16px 32px", fontSize: 16, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em" }}>
          Start for Free →
        </button>
        <button onClick={onGetStarted}
          style={{ background: "none", color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
          See the Dashboard
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 48, marginTop: 72, flexWrap: "wrap", justifyContent: "center" }}>
        {[
          { value: "2025–2030", label: "Multi-year forecasting" },
          { value: "Any file", label: "CSV, Excel, ODS" },
          { value: "< 60s", label: "From upload to insights" },
        ].map(s => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <p style={{ color: C.text, fontSize: 24, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.02em" }}>{s.value}</p>
            <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const features = [
    { icon: "📂", title: "Drop any file", body: "CSV, Excel, ODS — clean or messy, any language, any layout. Lumina reads it all and extracts the data automatically." },
    { icon: "🧹", title: "Auto data cleaning", body: "Currency symbols, broken formulas, merged cells, monthly rows — all handled automatically before a single chart renders." },
    { icon: "📊", title: "Instant dashboard", body: "Revenue trends, margin analysis, CAPEX planning, Monte Carlo simulation — a full BI dashboard generated from your numbers." },
    { icon: "📈", title: "Scenario modeling", body: "Run Bear, Base, and Bull scenarios side by side. Adjust levers and see how your projections change in real time." },
    { icon: "🎲", title: "Monte Carlo simulation", body: "Understand the probability of different outcomes. Run 2,000 simulations across your key variables in seconds." },
    { icon: "🔒", title: "Private by default", body: "Your data never leaves your account. Every project is isolated — only you can see it." },
  ];

  return (
    <section id="features" style={{ padding: "100px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 64 }}>
        <h2 style={{ color: C.text, fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 16px" }}>Everything you need to understand your business</h2>
        <p style={{ color: C.muted, fontSize: 17, margin: 0 }}>From raw data to boardroom-ready insights in under a minute.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        {features.map(f => (
          <div key={f.title} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "28px 28px 32px" }}>
            <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
            <h3 style={{ color: C.text, fontSize: 17, fontWeight: 700, margin: "0 0 10px", letterSpacing: "-0.01em" }}>{f.title}</h3>
            <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhoItsFor({ onGetStarted }) {
  const segments = [
    { icon: "🌿", title: "Agribusiness Operators", body: "Track plantation development, CPO production, FFB yields, and operational costs across multiple years and sites." },
    { icon: "💼", title: "Investors & Analysts", body: "Upload any financial model and instantly get scenario analysis, margin trends, and risk simulations to support investment decisions." },
    { icon: "📋", title: "Financial Analysts", body: "Stop rebuilding charts in Excel. Upload your data and get a live, interactive dashboard you can explore and share." },
    { icon: "🍽️", title: "Restaurants & F&B", body: "Track revenue per location, food costs, labor costs, and profitability trends. See what's working and what's not." },
  ];

  return (
    <section id="whosfor" style={{ padding: "100px 40px", background: C.panel, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h2 style={{ color: C.text, fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 16px" }}>Built for people who run things</h2>
          <p style={{ color: C.muted, fontSize: 17, margin: 0 }}>Lumina works for any business that has financial data and needs clarity.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          {segments.map(s => (
            <div key={s.title} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "28px 24px" }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{s.icon}</div>
              <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: "0 0 10px" }}>{s.title}</h3>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 48 }}>
          <button onClick={onGetStarted} style={{ background: C.forest, color: "#fff", border: "none", borderRadius: 10, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Get Started →
          </button>
        </div>
      </div>
    </section>
  );
}

function Pricing({ onGetStarted }) {
  return (
    <section id="pricing" style={{ padding: "100px 40px", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
      <h2 style={{ color: C.text, fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 16px" }}>Simple pricing</h2>
      <p style={{ color: C.muted, fontSize: 17, margin: "0 0 48px" }}>One plan. Everything included. Cancel anytime.</p>

      <div style={{ background: C.panel, border: `1px solid ${C.forest}55`, borderRadius: 20, padding: "48px 40px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${C.forest}, ${C.leaf})` }} />

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${C.forest}22`, border: `1px solid ${C.forest}44`, borderRadius: 20, padding: "4px 14px", marginBottom: 24 }}>
          <span style={{ color: C.leaf, fontSize: 12, fontWeight: 700 }}>BETA PRICING</span>
        </div>

        <div style={{ marginBottom: 8 }}>
          <span style={{ color: C.text, fontSize: 64, fontWeight: 900, letterSpacing: "-0.04em" }}>$50</span>
          <span style={{ color: C.muted, fontSize: 18 }}> / month</span>
        </div>
        <p style={{ color: C.muted, fontSize: 14, margin: "0 0 40px" }}>per workspace</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 40, textAlign: "left" }}>
          {[
            "Unlimited file uploads (CSV, Excel, ODS)",
            "Full financial dashboard — 7 analysis views",
            "Scenario modeling (Bear / Base / Bull)",
            "Monte Carlo risk simulation",
            "Multiple projects per account",
            "Private, secure data storage",
            "Priority support",
          ].map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${C.forest}33`, border: `1px solid ${C.forest}66`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: C.leaf, fontSize: 11 }}>✓</span>
              </div>
              <span style={{ color: C.text, fontSize: 14 }}>{f}</span>
            </div>
          ))}
        </div>

        <button onClick={onGetStarted}
          style={{ width: "100%", background: C.forest, color: "#fff", border: "none", borderRadius: 10, padding: "16px", fontSize: 16, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em" }}>
          Start Free Trial →
        </button>
        <p style={{ color: C.muted, fontSize: 12, marginTop: 14 }}>No credit card required to get started</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, padding: "32px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 24, height: 24, background: C.forest, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#fff", fontWeight: 900, fontSize: 12 }}>L</span>
        </div>
        <span style={{ color: C.muted, fontSize: 13 }}>Lumina © 2025 — Financial Intelligence Platform</span>
      </div>
      <span style={{ color: `${C.muted}66`, fontSize: 12 }}>Built for operators. Powered by data.</span>
    </footer>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const goToApp = () => navigate("/login");

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter', 'DM Sans', sans-serif", color: C.text }}>
      <Nav onGetStarted={goToApp} />
      <Hero onGetStarted={goToApp} />
      <Features />
      <WhoItsFor onGetStarted={goToApp} />
      <Pricing onGetStarted={goToApp} />
      <Footer />
    </div>
  );
}
