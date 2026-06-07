import { useEffect, useState } from "react";

export default function Loader({ onFinish }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);

  const phases = [
    "Inicializando sistema...",
    "Cargando módulos de IA...",
    "Conectando servicios...",
    "Listo",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => onFinish?.(), 400);
          return 100;
        }
        return prev + 1.2;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [onFinish]);

  useEffect(() => {
    if (progress < 30) setPhase(0);
    else if (progress < 60) setPhase(1);
    else if (progress < 90) setPhase(2);
    else setPhase(3);
  }, [progress]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "#09070f" }}
    >
      {/* Animated grid background */}
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />

      {/* Orbiting rings */}
      <div className="relative mb-10">
        {/* Outer ring */}
        <div
          className="w-36 h-36 rounded-full border border-purple-500/30 absolute -inset-6"
          style={{ animation: "spin 8s linear infinite" }}
        />
        {/* Middle ring */}
        <div
          className="w-28 h-28 rounded-full border border-purple-400/50 absolute -inset-2"
          style={{ animation: "spin 5s linear infinite reverse" }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-purple-400" />
        </div>

        {/* Core hexagon-ish glow */}
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center"
          style={{ background: "radial-gradient(circle, #7c3aed 0%, #4c1d95 60%, #1e0a3c 100%)", boxShadow: "0 0 40px rgba(139,92,246,0.6), 0 0 80px rgba(139,92,246,0.2)" }}
        >
          {/* AI text */}
          <span
            className="text-white font-black text-2xl tracking-widest select-none"
            style={{ fontFamily: "'Orbitron', monospace", textShadow: "0 0 20px rgba(255,255,255,0.8)" }}
          >
            AI
          </span>
        </div>

        {/* Orbiting dot */}
        <div
          className="absolute inset-0"
          style={{ animation: "spin 3s linear infinite" }}
        >
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-purple-300"
            style={{ boxShadow: "0 0 10px rgba(216,180,254,0.9)" }} />
        </div>
      </div>

      {/* Brand name */}
      <div className="mb-8 text-center">
        <h1
          className="text-3xl font-black tracking-[0.3em] text-white mb-1"
          style={{ fontFamily: "'Orbitron', monospace", textShadow: "0 0 20px rgba(139,92,246,0.7)" }}
        >
          MovAI
        </h1>
        <p className="text-purple-400 text-xs tracking-[0.4em] uppercase"
          style={{ fontFamily: "'Courier New', monospace" }}>
          {phases[phase]}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-72 relative">
        {/* Track */}
        <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #4c1d95, #7c3aed, #a78bfa)",
              boxShadow: "0 0 12px rgba(139,92,246,0.8)",
            }}
          />
        </div>

        {/* Percentage */}
        <div className="flex justify-between mt-2">
          <span className="text-purple-500 text-xs" style={{ fontFamily: "'Courier New', monospace" }}>
            SYS://BOOT
          </span>
          <span className="text-purple-300 text-xs font-bold" style={{ fontFamily: "'Courier New', monospace" }}>
            {Math.min(100, Math.round(progress))}%
          </span>
        </div>
      </div>

      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 4px)",
        }}
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}