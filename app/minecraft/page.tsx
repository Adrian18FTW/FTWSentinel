"use client";

import { useEffect, useRef, useState } from "react";

const FEATURES = [
  {
    category: "Combat Checks",
    color: "from-red-500 to-orange-500",
    icon: "⚔️",
    items: [
      "KillAura detection with angle analysis",
      "Reach checks (3.1 block limit)",
      "Critical hit validation",
      "Velocity & knockback verification",
      "AutoClicker detection (CPS monitoring)",
    ],
  },
  {
    category: "Movement Checks",
    color: "from-cyan-500 to-blue-500",
    icon: "🏃",
    items: [
      "Flight detection (all modes)",
      "Speed hack prevention",
      "Jesus/Water walk detection",
      "NoFall exploit blocking",
      "Step & Spider climb checks",
    ],
  },
  {
    category: "Block Checks",
    color: "from-purple-500 to-pink-500",
    icon: "🧱",
    items: [
      "FastBreak detection",
      "FastPlace prevention",
      "Block reach validation",
      "Nuker detection",
      "Scaffold/Tower checks",
    ],
  },
  {
    category: "Server Protection",
    color: "from-green-500 to-emerald-500",
    icon: "🛡️",
    items: [
      "Packet validation (BadPackets)",
      "Timer detection",
      "Ping spoof prevention",
      "Real-time statistics dashboard",
      "Automatic ban system",
    ],
  },
];

const COLORS = [
  [99, 102, 241], [168, 85, 247], [236, 72, 153], [34, 211, 238], [52, 211, 153],
];

export default function MinecraftPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    fetch('/api/customer/me').then(r => { if (r.ok) setLoggedIn(true); }).catch(() => {});
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animationId: number;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const onMouseMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", onMouseMove);
    type Particle = { x: number; y: number; vx: number; vy: number; radius: number; color: number[]; };
    const particles: Particle[] = Array.from({ length: 100 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6,
      radius: Math.random() * 2 + 1, color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    const CURSOR_RADIUS = 120, CONNECTION_DIST = 150;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mouse = mouseRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = mouse.x - p.x, dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CURSOR_RADIUS && dist > 0) { const force = (CURSOR_RADIUS - dist) / CURSOR_RADIUS; p.vx += (dx / dist) * force * 0.15; p.vy += (dy / dist) * force * 0.15; }
        p.vx *= 0.98; p.vy *= 0.98; p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        const [r, g, b] = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},0.85)`; ctx.fill();
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const cdx = p.x - q.x, cdy = p.y - q.y;
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
          if (cdist < CONNECTION_DIST) {
            const alpha = (1 - cdist / CONNECTION_DIST) * 0.45;
            const [qr, qg, qb] = q.color;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(${Math.round((r+qr)/2)},${Math.round((g+qg)/2)},${Math.round((b+qb)/2)},${alpha})`;
            ctx.lineWidth = 0.8; ctx.stroke();
          }
        }
      }
      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animationId); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", onMouseMove); };
  }, []);

  return (
    <div className="relative flex flex-1 min-h-screen items-center justify-center overflow-hidden bg-[#0a0a15]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="https://r2.fivemanage.com/6i9Nw4DbfIJjqzti98x40/01-image.png" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none" style={{ zIndex: 0 }} />
      <div className="absolute inset-0 bg-[#0a0a15]/75 pointer-events-none" style={{ zIndex: 1 }} />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 2 }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(52,211,153,0.08)_0%,transparent_70%)] pointer-events-none" style={{ zIndex: 2 }} />

      {/* Top nav */}
      <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-6" style={{ zIndex: 10 }}>
        <a href="/" className="text-zinc-400 hover:text-white text-xs flex items-center gap-2 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to FiveM
        </a>
        <div className="flex items-center gap-2">
          {loggedIn ? (
            <a href="/customer" className="text-white text-xs rounded-full px-3 py-1.5 transition hover:opacity-90 bg-gradient-to-r from-emerald-500 to-cyan-500 font-semibold">Dashboard</a>
          ) : (
            <>
              <a href="/customer/login" className="text-zinc-400 hover:text-white text-xs border border-white/10 bg-white/5 rounded-full px-3 py-1.5 transition hover:border-white/30 backdrop-blur-sm">Sign in</a>
              <a href="/customer/register" className="text-white text-xs rounded-full px-3 py-1.5 transition hover:opacity-90 bg-gradient-to-r from-emerald-500 to-cyan-500 font-semibold">Sign up</a>
            </>
          )}
        </div>
      </div>

      <div className="relative flex flex-col items-center gap-8 px-6 text-center" style={{ zIndex: 3 }}>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-300">
          Minecraft Anticheat — Free
        </span>

        <div className="flex items-center justify-center gap-3">
          <svg className="w-12 h-12 sm:w-16 sm:h-16 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 2h16v2H4zm0 4h16v2H4zm0 4h16v2H4zm0 4h16v2H4zm0 4h16v2H4z"/>
          </svg>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            FTW<span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">Sentinel</span>
          </h1>
        </div>

        <p className="max-w-md text-base text-zinc-400 leading-relaxed">
          Enterprise-grade anticheat protection for Minecraft servers. Free forever with real-time analytics dashboard.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
          <a href="https://discord.gg/Prr7FuvBJc" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 rounded-full bg-emerald-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:bg-emerald-500 hover:shadow-emerald-500/50 hover:scale-105 active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0 a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" /></svg>
            Join our Discord
          </a>
          <a href="/minecraft/dashboard" className="flex items-center justify-center gap-2 rounded-full border border-cyan-500/40 bg-white/5 px-6 py-3.5 text-sm font-semibold text-cyan-300 backdrop-blur-sm transition-all duration-300 hover:bg-cyan-500/20 hover:border-cyan-400 hover:text-white hover:scale-105 active:scale-95">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            View Dashboard
          </a>
        </div>

        <div className="w-full max-w-3xl mt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-left">
            {FEATURES.map((cat) => (
              <div key={cat.category} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{cat.icon}</span>
                  <span className={`text-xs font-bold uppercase tracking-widest bg-gradient-to-r ${cat.color} bg-clip-text text-transparent`}>{cat.category}</span>
                </div>
                <ul className="flex flex-col gap-2">
                  {cat.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className={`mt-0.5 text-xs font-bold bg-gradient-to-r ${cat.color} bg-clip-text text-transparent shrink-0`}>✓</span>
                      <span className="text-xs text-zinc-300 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 text-zinc-700 text-xs mt-4">
          <span className="h-px w-16 bg-zinc-700" />
          100% Free • Real-time Stats • Enterprise Protection
          <span className="h-px w-16 bg-zinc-700" />
        </div>
      </div>

      {/* Discord widget */}
      <div className="fixed bottom-4 right-4 z-50">
        <iframe
          src="https://discord.com/widget?id=1484894298020384829&theme=dark"
          width="350"
          height="500"
          allowTransparency={true}
          frameBorder="0"
          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
          title="Discord"
          className="rounded-xl shadow-2xl shadow-emerald-500/20"
        />
      </div>
    </div>
  );
}
