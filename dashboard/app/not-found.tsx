export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="font-term text-center" style={{ color: "var(--text-3)" }}>
        <div style={{ fontSize: "2rem", color: "var(--red)" }}>404</div>
        <div style={{ fontSize: "0.75rem", letterSpacing: "0.15em", marginTop: "0.5rem" }}>PAGE NOT FOUND</div>
      </div>
    </div>
  );
}
