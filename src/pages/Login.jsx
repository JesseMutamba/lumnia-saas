import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const C = {
  bg: "#F4F0E6", panel: "#FEFCF8", border: "#D5CEBC",
  text: "#1A1916", muted: "#8A8375", forest: "#2C5F1A", leaf: "#4D8C2E",
  gold: "#A67C2A", red: "#B03A2A",
};

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    if (mode === "signin") {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
    } else {
      const { error } = await signUp(email, password);
      if (error) setError(error.message);
      else setMessage("Check your email to confirm your account.");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "40px 44px", width: 380, boxShadow: "0 8px 32px rgba(0,0,0,0.07)" }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, background: C.forest, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>P</span>
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: "-0.03em" }}>PVACK</span>
          </div>
          <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>Financial Intelligence Platform</p>
        </div>

        <h2 style={{ color: C.text, fontSize: 15, fontWeight: 700, margin: "0 0 20px", textAlign: "center" }}>
          {mode === "signin" ? "Sign in to your account" : "Create your account"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", color: C.muted, fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>Email</label>
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.bg, color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              placeholder="you@example.com"
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", color: C.muted, fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>Password</label>
            <input
              type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.bg, color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              placeholder="••••••••"
            />
          </div>

          {error && <p style={{ color: C.red, fontSize: 12, margin: "0 0 14px", background: `${C.red}10`, padding: "8px 12px", borderRadius: 6 }}>{error}</p>}
          {message && <p style={{ color: C.forest, fontSize: 12, margin: "0 0 14px", background: `${C.forest}10`, padding: "8px 12px", borderRadius: 6 }}>{message}</p>}

          <button
            type="submit" disabled={loading}
            style={{ width: "100%", padding: "12px", background: C.forest, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p style={{ color: C.muted, fontSize: 12, textAlign: "center", marginTop: 20 }}>
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }}
            style={{ color: C.forest, background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0 }}
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
