export default function Modal({ title, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28, 28, 26, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: 420, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 18 }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="btn btn-ghost"
            style={{ padding: "4px 10px" }}
          >
            ✕
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
