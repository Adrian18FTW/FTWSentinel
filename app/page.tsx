"use client";

import { useEffect, useRef, useState } from "react";

const PLANS = [
  {
    id: "1month",
    label: "1 Month",
    price: "€29.99",
    priceLabel: "per month",
    gradient: "from-indigo-500 to-blue-500",
    border: "border-indigo-500/30",
    glow: "shadow-indigo-500/20",
    features: [
      { label: "Base Product", included: true },
      { label: "24/7 Support", included: true },
      { label: "Web Panel", included: false },
      { label: "Dev Testing", included: false },
    ],
  },
  {
    id: "3month",
    label: "3 Months",
    price: "€39.99",
    priceLabel: "per month",
    gradient: "from-purple-500 to-pink-500",
    border: "border-purple-500/30",
    glow: "shadow-purple-500/20",
    popular: true,
    features: [
      { label: "Base Product", included: true },
      { label: "24/7 Support", included: true },
      { label: "Web Panel", included: true },
      { label: "Dev Testing", included: false },
    ],
  },
  {
    id: "6month",
    label: "6 Months",
    price: "€79.99",
    priceLabel: "per month",
    gradient: "from-emerald-500 to-cyan-500",
    border: "border-emerald-500/30",
    glow: "shadow-emerald-500/20",
    features: [
      { label: "Base Product", included: true },
      { label: "24/7 Support", included: true },
      { label: "Web Panel", included: true },
      { label: "Dev Testing", included: true },
    ],
  },
];

const FEATURES = [
  {
    category: "Combat Protection",
    color: "from-red-500 to-orange-500",
    icon: "⚔️",
    items: [
      {
        label: "Godmode, invincibility & instant health restore",
        desc: "Detects players who take no damage, have locked health values, or restore HP instantly — all classic godmode signatures.",
      },
      {
        label: "Aimbot, silent aim, triggerbot & headshot ratio",
        desc: "Tracks aim angles, snap speeds, and headshot percentages to flag inhuman accuracy and silent aim injections.",
      },
      {
        label: "Weapon hacks (infinite ammo, rapid fire, blacklist)",
        desc: "Monitors ammo counts, fire rate deltas, and blocks blacklisted weapons from being spawned or used.",
      },
      {
        label: "Damage modifiers & magic bullet detection",
        desc: "Compares dealt damage against weapon baselines and flags impossible one-shot kills or damage multipliers.",
      },
    ],
  },
  {
    category: "Movement Protection",
    color: "from-cyan-500 to-blue-500",
    icon: "🏃",
    items: [
      {
        label: "Speed hacks, teleport & noclip (foot, vehicle, swim)",
        desc: "Validates movement deltas per tick across all movement modes — foot, vehicle, and swimming — to catch speed and teleport cheats.",
      },
      {
        label: "Fly hacks, super jump & freecam detection",
        desc: "Checks vertical velocity, air time, and camera detachment to detect flying, super jumps, and freecam exploits.",
      },
      {
        label: "Vehicle spawn control & blacklist (Rhino, Lazer, etc.)",
        desc: "Prevents spawning of blacklisted vehicles like tanks and jets, and monitors for unauthorized vehicle creation events.",
      },
    ],
  },
  {
    category: "Cheat Detection",
    color: "from-purple-500 to-pink-500",
    icon: "🔍",
    items: [
      {
        label: "Cheat menu & executor scanner (memory signatures)",
        desc: "Scans for known cheat menu signatures and executor fingerprints in memory to identify injected software.",
      },
      {
        label: "Behavioral profiling (statistical + entropy analysis)",
        desc: "Builds a behavioral profile per player using statistical models and entropy scoring to catch subtle, low-and-slow cheating.",
      },
      {
        label: "Stealth cheat detection (slow-burn 2h scoring)",
        desc: "Accumulates suspicion scores over a 2-hour window to catch cheaters who deliberately stay under per-event thresholds.",
      },
      {
        label: "Anti-tamper (hook detection, debug library monitoring)",
        desc: "Detects function hooks, debug library loads, and client-side tampering attempts that indicate active cheat injection.",
      },
    ],
  },
  {
    category: "Server Protection",
    color: "from-green-500 to-emerald-500",
    icon: "🛡️",
    items: [
      {
        label: "Explosion & entity spam protection",
        desc: "Rate-limits explosion events and entity creation to prevent server-side lag exploits and crash attempts.",
      },
      {
        label: "Chat filter, VPN check & new account detection",
        desc: "Filters toxic chat, flags VPN/proxy connections, and applies extra scrutiny to newly created accounts.",
      },
      {
        label: "Discord alerts, screenshots & database ban system",
        desc: "Sends real-time Discord webhook alerts with evidence screenshots and logs all bans to a persistent database.",
      },
      {
        label: "Bans persist across reconnects (token-based)",
        desc: "Uses hardware and token fingerprinting so bans survive reconnects, name changes, and Steam account switches.",
      },
    ],
  },
];

const COLORS = [
  [99, 102, 241],
  [168, 85, 247],
  [236, 72, 153],
  [34, 211, 238],
  [52, 211, 153],
];

// ── Crypto Checkout Modal ──────────────────────────────────────────────────────
function CheckoutModal({
  plan,
  onClose,
}: {
  plan: (typeof PLANS)[0];
  onClose: () => void;
}) {
  const [currency, setCurrency] = useState<"btc" | "eth">("eth");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePay() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/crypto/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.id, currency, email }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0d1f] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold text-lg">Checkout</h2>
            <p className={`text-xs font-semibold bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent`}>
              {plan.label} — {plan.price}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Currency selector */}
        <p className="text-zinc-400 text-xs mb-2">Pay with</p>
        <div className="flex gap-3 mb-5">
          {(["eth", "btc"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition ${
                currency === c
                  ? "border-indigo-500 bg-indigo-500/20 text-white"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white"
              }`}
            >
              {c === "eth" ? (
                <>
                  <span className="text-base">Ξ</span> Ethereum
                </>
              ) : (
                <>
                  <span className="text-base">₿</span> Bitcoin
                </>
              )}
            </button>
          ))}
        </div>

        {/* Optional email */}
        <p className="text-zinc-400 text-xs mb-2">
          Email <span className="text-zinc-600">(optional — for key delivery)</span>
        </p>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 mb-5 focus:outline-none focus:border-indigo-500 placeholder:text-zinc-600"
        />

        {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

        <button
          onClick={handlePay}
          disabled={loading}
          className={`w-full rounded-full py-3 text-sm font-semibold text-white transition bg-gradient-to-r ${plan.gradient} hover:opacity-90 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? "Redirecting…" : `Pay with ${currency === "eth" ? "Ethereum" : "Bitcoin"}`}
        </button>

        <p className="text-zinc-600 text-xs text-center mt-4">
          Powered by NOWPayments · Secure crypto checkout
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const [panel, setPanel] = useState<"features" | "plans" | null>(null);
  const [planAvailability, setPlanAvailability] = useState<Record<string, boolean>>({
    "1month": true,
    "3month": true,
    "6month": true,
  });
  const [tooltip, setTooltip] = useState<{ label: string; desc: string } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [checkoutPlan, setCheckoutPlan] = useState<(typeof PLANS)[0] | null>(null);

  useEffect(() => {
    fetch("/api/plans")
      .then((r) => r.json())
      .then(setPlanAvailability)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animationId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMouseMove);

    type Particle = {
      x: number; y: number; vx: number; vy: number;
      radius: number; color: number[];
    };

    const particles: Particle[] = Array.from({ length: 100 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      radius: Math.random() * 2 + 1,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    const CURSOR_RADIUS = 120;
    const CONNECTION_DIST = 150;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mouse = mouseRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CURSOR_RADIUS && dist > 0) {
          const force = (CURSOR_RADIUS - dist) / CURSOR_RADIUS;
          p.vx += (dx / dist) * force * 0.15;
          p.vy += (dy / dist) * force * 0.15;
        }
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        const [r, g, b] = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},0.85)`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const cdx = p.x - q.x;
          const cdy = p.y - q.y;
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
          if (cdist < CONNECTION_DIST) {
            const alpha = (1 - cdist / CONNECTION_DIST) * 0.45;
            const [qr, qg, qb] = q.color;
            const mr = Math.round((r + qr) / 2);
            const mg = Math.round((g + qg) / 2);
            const mb = Math.round((b + qb) / 2);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(${mr},${mg},${mb},${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
      animationId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      className="relative flex flex-1 min-h-screen items-center justify-center overflow-hidden bg-[#050510]"
      onMouseMove={handleMouseMove}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://r2.fivemanage.com/6i9Nw4DbfIJjqzti98x40/Untitleddesign.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        style={{ zIndex: 0 }}
      />
      <div className="absolute inset-0 bg-[#050510]/75 pointer-events-none" style={{ zIndex: 1 }} />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 2 }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.12)_0%,transparent_70%)] pointer-events-none" style={{ zIndex: 2 }} />

      <div className="relative flex flex-col items-center gap-8 px-6 text-center" style={{ zIndex: 3 }}>
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-indigo-300">
          FiveM Anticheat
        </span>

        <div className="flex items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://r2.fivemanage.com/6i9Nw4DbfIJjqzti98x40/NewProject(1).png"
            alt="FTWSentinel logo"
            className="h-14 w-14 sm:h-20 sm:w-20 object-contain drop-shadow-lg"
          />
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-7xl">
            FTW
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Sentinel
            </span>
          </h1>
        </div>

        <p className="max-w-md text-base text-zinc-400 leading-relaxed">
          Advanced anticheat protection for your FiveM server. Detect, prevent,
          and eliminate cheaters in real time.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full max-w-2xl">
          <a
            href="https://discord.gg/Prr7FuvBJc"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-3 rounded-full bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:bg-indigo-500 hover:shadow-indigo-500/50 hover:scale-105 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden="true">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
            </svg>
            Join our Discord
          </a>

          <button
            onClick={() => setPanel((v) => (v === "features" ? null : "features"))}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-indigo-500/40 bg-white/5 px-6 py-3.5 text-sm font-semibold text-indigo-300 backdrop-blur-sm transition-all duration-300 hover:bg-indigo-500/20 hover:border-indigo-400 hover:text-white hover:scale-105 active:scale-95"
          >
            <span className="inline-block transition-transform duration-300" style={{ transform: panel === "features" ? "rotate(45deg)" : "rotate(0deg)" }}>
              ✦
            </span>
            {panel === "features" ? "Hide Features" : "View Features"}
          </button>

          <button
            onClick={() => setPanel((v) => (v === "plans" ? null : "plans"))}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/40 bg-white/5 px-6 py-3.5 text-sm font-semibold text-purple-300 backdrop-blur-sm transition-all duration-300 hover:bg-purple-500/20 hover:border-purple-400 hover:text-white hover:scale-105 active:scale-95"
          >
            <span className="inline-block transition-transform duration-300" style={{ transform: panel === "plans" ? "rotate(45deg)" : "rotate(0deg)" }}>
              ◈
            </span>
            {panel === "plans" ? "Hide Plans" : "View Plans"}
          </button>
        </div>

        {/* Panel container */}
        {panel === "features" && (
          <div key="features" className="w-full max-w-3xl animate-fadeSlideIn">
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 text-left">
              {FEATURES.map((cat) => (
                <div key={cat.category} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{cat.icon}</span>
                    <span className={`text-xs font-bold uppercase tracking-widest bg-gradient-to-r ${cat.color} bg-clip-text text-transparent`}>
                      {cat.category}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {cat.items.map((item) => (
                      <li
                        key={item.label}
                        onMouseEnter={() => setTooltip(item)}
                        onMouseLeave={() => setTooltip(null)}
                        className="group flex items-start gap-2 cursor-default rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-white/10"
                      >
                        <span className={`mt-0.5 text-xs font-bold bg-gradient-to-r ${cat.color} bg-clip-text text-transparent shrink-0`}>
                          [+]
                        </span>
                        <span className="text-xs text-zinc-300 group-hover:text-white transition-colors duration-150 leading-relaxed">
                          {item.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {panel === "plans" && (
          <div key="plans" className="w-full max-w-3xl animate-fadeSlideIn">
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3 text-left">
              {PLANS.map((plan) => {
                const available = planAvailability[plan.id] ?? true;
                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-2xl border ${plan.border} bg-white/5 backdrop-blur-sm p-6 flex flex-col gap-4 shadow-xl ${plan.glow} ${plan.popular ? "ring-1 ring-purple-500/50" : ""}`}
                  >
                    {plan.popular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-0.5 text-xs font-bold text-white">
                        Popular
                      </span>
                    )}
                    <div>
                      <span className={`text-xs font-bold uppercase tracking-widest bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent`}>
                        {plan.label}
                      </span>
                      <div className="mt-2 flex items-end gap-1">
                        <span className={`text-3xl font-extrabold bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent`}>
                          {plan.price}
                        </span>
                        <span className="text-zinc-500 text-xs mb-1">/ mo</span>
                      </div>
                    </div>
                    <ul className="flex flex-col gap-2 flex-1">
                      {plan.features.map((f) => (
                        <li key={f.label} className="flex items-center gap-2 text-xs">
                          {f.included ? (
                            <span className="text-emerald-400 font-bold">✓</span>
                          ) : (
                            <span className="text-red-400 font-bold">✗</span>
                          )}
                          <span className={f.included ? "text-zinc-200" : "text-zinc-500"}>{f.label}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => available && setCheckoutPlan(plan)}
                      disabled={!available}
                      className={`mt-2 w-full text-center rounded-full py-2.5 text-xs font-semibold transition-all duration-200 ${
                        available
                          ? `bg-gradient-to-r ${plan.gradient} text-white hover:opacity-90 hover:scale-105 active:scale-95 shadow-lg`
                          : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                      }`}
                    >
                      {available ? "Purchase with Crypto" : "Unavailable"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 text-zinc-700 text-xs">
          <span className="h-px w-16 bg-zinc-700" />
          Protecting servers worldwide
          <span className="h-px w-16 bg-zinc-700" />
        </div>
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 max-w-xs rounded-xl border border-indigo-500/30 bg-[#0d0d1f]/95 backdrop-blur-md px-4 py-3 text-xs text-zinc-300 shadow-xl shadow-indigo-500/10 leading-relaxed"
          style={{
            left: tooltipPos.x + 16,
            top: tooltipPos.y + 16,
            transform: tooltipPos.x > window.innerWidth - 280 ? "translateX(-110%)" : undefined,
          }}
        >
          <p className="font-semibold text-white mb-1">{tooltip.label}</p>
          <p>{tooltip.desc}</p>
        </div>
      )}

      {/* Crypto checkout modal */}
      {checkoutPlan && (
        <CheckoutModal plan={checkoutPlan} onClose={() => setCheckoutPlan(null)} />
      )}
    </div>
  );
}
