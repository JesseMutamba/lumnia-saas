import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import PVAKDashboard from "../components/PVAKDashboard";
import DynamicDashboard from "../components/DynamicDashboard";

const C = {
  bg: "#F4F0E6", panel: "#FEFCF8", panel2: "#EDE8DC", border: "#D5CEBC",
  text: "#1A1916", muted: "#8A8375", forest: "#2C5F1A",
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    const { data } = await supabase
      .from("financial_projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      setProjects(data);
      setActiveProject(data[0]);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontFamily: "Inter, sans-serif" }}>
        Loading your dashboard...
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ width: 56, height: 56, background: C.forest, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 24 }}>P</span>
          </div>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}>Welcome to PVACK</h2>
          <p style={{ color: C.muted, fontSize: 14, margin: "0 0 28px", lineHeight: 1.6 }}>
            No financial data yet. Enter your 2025–2030 projections to generate your personalized dashboard.
          </p>
          <button onClick={() => navigate("/input")}
            style={{ background: C.forest, color: "#fff", border: "none", borderRadius: 9, padding: "13px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Enter My Financial Data
          </button>
          <div style={{ marginTop: 16 }}>
            <button onClick={signOut} style={{ background: "none", color: C.muted, border: "none", fontSize: 12, cursor: "pointer" }}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  const sharedProps = {
    projectName: activeProject.name,
    projects,
    onSwitchProject: (p) => setActiveProject(p),
    onNewProject: () => navigate("/input"),
    onEditProject: () => navigate(`/input?id=${activeProject.id}`),
    onSignOut: signOut,
    userEmail: user.email,
  };

  // Route to the right dashboard based on data type
  if (activeProject.data?.type === "generic") {
    return <DynamicDashboard data={activeProject.data} sector={activeProject.sector} {...sharedProps} />;
  }

  return (
    <PVAKDashboard
      baseData={activeProject.data}
      projectId={activeProject.id}
      {...sharedProps}
    />
  );
}
