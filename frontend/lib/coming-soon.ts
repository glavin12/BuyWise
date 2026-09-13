/**
 * "Coming soon" feedback for features the backend doesn't expose yet
 * (CSV export, sort, copy-budget, net-worth history, AI/notif toggles, …).
 *
 * Usage:
 *   <button {...comingSoonProps("Export CSV")}>⤓ Export CSV</button>
 * or imperatively: onClick={() => comingSoon("Sort")}
 *
 * Renders a small cream toast bottom-right. No dependency, no provider.
 */

let container: HTMLDivElement | null = null;

function ensureContainer(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  if (container && document.body.contains(container)) return container;
  container = document.createElement("div");
  container.setAttribute("data-coming-soon", "");
  Object.assign(container.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: "9999",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    pointerEvents: "none",
  } as CSSStyleDeclaration);
  document.body.appendChild(container);
  return container;
}

export function comingSoon(feature?: string): void {
  const root = ensureContainer();
  if (!root) return;

  const toast = document.createElement("div");
  toast.textContent = feature ? `${feature} — coming soon` : "Coming soon";
  Object.assign(toast.style, {
    background: "#1B1B1B",
    color: "#F4EEE1",
    font: "500 13px/1.4 'Instrument Sans', system-ui, sans-serif",
    padding: "10px 14px",
    borderRadius: "12px",
    boxShadow: "0 6px 20px rgba(27,27,27,0.18)",
    opacity: "0",
    transform: "translateY(6px)",
    transition: "opacity .18s ease, transform .18s ease",
  } as CSSStyleDeclaration);
  root.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(6px)";
    window.setTimeout(() => toast.remove(), 220);
  }, 2200);
}

/** Spread onto any button/anchor to make it a click-toast + hover-tooltip. */
export function comingSoonProps(feature?: string) {
  return {
    title: feature ? `${feature} — coming soon` : "Coming soon",
    onClick: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      comingSoon(feature);
    },
  };
}
