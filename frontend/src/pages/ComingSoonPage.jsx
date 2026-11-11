export default function ComingSoonPage({ title }) {
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>{title}</h1>
      <p style={{ color: "var(--text-secondary)" }}>
        Esta pantalla se construye en el próximo paso.
      </p>
    </div>
  );
}
