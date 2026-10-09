import React, { useEffect } from 'react';
import { motion } from 'motion/react';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  useEffect(() => {
    // Automatically finish after 3.2 seconds to allow a smooth fade-out
    const timer = setTimeout(() => {
      onFinish();
    }, 3200);

    return () => clearTimeout(timer);
  }, [onFinish]);

  // Dust particles specification
  const rearDust = [
    { delay: 0.0, x: -50, y: -10, size: 6 },
    { delay: 0.15, x: -70, y: -15, size: 8 },
    { delay: 0.3, x: -40, y: -5, size: 5 },
    { delay: 0.45, x: -80, y: -12, size: 9 },
  ];

  const frontDust = [
    { delay: 0.05, x: -40, y: -8, size: 5 },
    { delay: 0.2, x: -60, y: -12, size: 7 },
    { delay: 0.35, x: -35, y: -4, size: 4 },
  ];

  return (
    <motion.div
      id="splash-screen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 select-none overflow-hidden"
    >
      {/* Dynamic Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950 pointer-events-none" />

      {/* Main Branding Card */}
      <motion.div
        initial={{ opacity: 0, y: -30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center p-8 bg-slate-900/80 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-md mb-12 max-w-sm w-full mx-4"
      >
        {/* Subtle glowing amber aura behind logo */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 blur-xl opacity-50" />

        <div className="relative flex flex-col items-center gap-4">
          {/* Logo Badge */}
          <div className="flex items-center justify-center bg-slate-950 p-3 rounded-2xl border border-slate-800 shadow-inner">
            {/* JCB portion */}
            <div className="px-6 py-2.5 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30 skew-x-[-6deg]">
              <span className="text-slate-950 font-black text-3xl leading-none tracking-tighter">JCB</span>
            </div>
          </div>

          <div className="text-center mt-1">
            <h2 className="text-slate-100 font-extrabold text-xs tracking-wider uppercase">FLEET OPERATIONS MANAGER</h2>
            <p className="text-slate-500 text-[9px] font-mono tracking-widest uppercase mt-1">LEDGER PRO • SECURITY TLS-256</p>
          </div>
        </div>
      </motion.div>

      {/* Dynamic Animated JCB Stage */}
      <div className="relative w-full max-w-lg h-44 flex items-end justify-center px-8">
        
        {/* Ground Line */}
        <div className="absolute bottom-6 left-0 right-0 h-1 bg-slate-800" />
        <div className="absolute bottom-2 left-0 right-0 h-4 bg-slate-900/40 border-t border-slate-900 flex justify-around overflow-hidden">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="w-4 h-full bg-amber-500/10 rotate-12 flex-shrink-0" />
          ))}
        </div>

        {/* Moving JCB Wrapper */}
        <motion.div
          initial={{ x: '-100vw' }}
          animate={{ x: '0vw' }}
          transition={{ duration: 2.0, ease: [0.15, 0.85, 0.35, 1.0] }}
          className="relative w-[280px] h-32 mb-6 flex-shrink-0 origin-bottom"
        >
          <svg viewBox="0 0 280 120" className="w-full h-full overflow-visible">
            
            {/* BACKHOE REAR STABILIZERS */}
            <path d="M 40,90 L 25,112 M 40,90 L 30,105" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
            <rect x="20" y="110" width="10" height="4" fill="#1e293b" rx="1" />

            {/* REAR EXCAVATOR ARM (Folded Back with dynamic extension & scooping action) */}
            <g stroke="#1e293b" strokeWidth="2" strokeLinejoin="round" fill="none">
              {/* Main Base Joint Pivot */}
              <circle cx="45" cy="85" r="4" fill="#475569" />
                           {/* BOOM (Pivots at 45, 85) */}
              <g transform="translate(45, 85)">
                <motion.g
                  animate={{ rotate: [0, 0, -35, -40, 0] }}
                  transition={{
                    duration: 3.0,
                    times: [0, 0.66, 0.8, 0.9, 1],
                    ease: 'easeInOut',
                  }}
                >
                  {/* Boom segment (0,0 to -15,-30) */}
                  <path d="M 0,0 L -15,-30" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />
                  
                  {/* Hydraulic Cylinder */}
                  <line x1="-3" y1="-15" x2="-17" y2="-37" stroke="#cbd5e1" strokeWidth="2" />

                  {/* STICK (Pivots at the end of Boom, i.e. -15, -30) */}
                  <g transform="translate(-15, -30)">
                    <motion.g
                      animate={{ rotate: [0, 0, 105, 115, 0] }}
                      transition={{
                        duration: 3.0,
                        times: [0, 0.66, 0.8, 0.9, 1],
                        ease: 'easeInOut',
                      }}
                    >
                      {/* Stick segment (0,0 to -10,-20) */}
                      <path d="M 0,0 L -10,-20" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />

                      {/* BUCKET LINK AND EXCAVATOR BUCKET (Pivots at the end of Stick, i.e. -10, -20) */}
                      <g transform="translate(-10, -20)">
                        <motion.g
                          animate={{ rotate: [0, 0, -75, 15, 0] }}
                          transition={{
                            duration: 3.0,
                            times: [0, 0.66, 0.8, 0.9, 1],
                            ease: 'easeInOut',
                          }}
                        >
                          {/* Bucket Link (0,0 to -8,15) */}
                          <path d="M 0,0 L -8,15" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" />
                          
                          {/* Excavator Bucket */}
                          <path 
                            d="M -8,15 L -15,10 L -12,0 C -10,0 -8,3 -8,5 Z" 
                            fill="#1e293b" 
                            strokeWidth="1.5" 
                          />
                        </motion.g>
                      </g>
                    </motion.g>
                  </g>
                </motion.g>
              </g>
            </g>

            {/* MAIN CABIN BODY (Amber/Yellow) */}
            {/* Chassis lower plate */}
            <rect x="52" y="90" width="100" height="15" fill="#1e293b" rx="2" stroke="#0f172a" strokeWidth="1.5" />
            
            {/* Heavy Engine Compartment Hood */}
            <path d="M 144,70 L 195,73 L 195,102 L 144,102 Z" fill="#f59e0b" stroke="#1e293b" strokeWidth="2" />
            {/* Engine Grille details */}
            <rect x="182" y="78" width="8" height="18" fill="#1e293b" rx="1" />
            <line x1="184" y1="81" x2="184" y2="93" stroke="#f59e0b" strokeWidth="1" />
            <line x1="187" y1="81" x2="187" y2="93" stroke="#f59e0b" strokeWidth="1" />
            
            {/* Exhaust Stack */}
            <rect x="156" y="44" width="4" height="28" fill="#334155" rx="1" />
            <path d="M 156,44 L 161,40" stroke="#334155" strokeWidth="3" strokeLinecap="round" />

            {/* Cabin Structure */}
            <path d="M 68,90 L 68,52 L 112,52 L 144,90 Z" fill="#f59e0b" stroke="#1e293b" strokeWidth="2" />
            {/* Cabin Glass - Blue Tint */}
            <path d="M 74,86 L 74,57 L 108,57 L 132,86 Z" fill="#38bdf8" opacity="0.8" stroke="#1e293b" strokeWidth="1.5" />
            {/* Glass partition line */}
            <line x1="102" y1="57" x2="102" y2="86" stroke="#1e293b" strokeWidth="1.5" />
            {/* Inner Seat Silhouette */}
            <path d="M 80,80 L 88,80 L 88,68" fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />

            {/* Operator Decals / JCB Badge */}
            <rect x="110" y="74" width="16" height="9" fill="#1e293b" rx="1" />
            <text x="111" y="81" fill="#fbbf24" fontSize="6" fontWeight="bold" fontFamily="sans-serif">JCB</text>

            {/* Mudguards */}
            <path d="M 45,102 A 28,28 0 0,1 101,102" fill="none" stroke="#1e293b" strokeWidth="5" />
            <path d="M 148,103 A 19,19 0 0,1 184,103" fill="none" stroke="#1e293b" strokeWidth="4" />

            {/* FRONT LOADER ARM AND BUCKET (With Raise & Lower animation) */}
            <g transform="translate(144, 90)">
              <motion.g
                animate={{ rotate: [0, 0, -18, 0, 0] }}
                transition={{
                  duration: 3.0,
                  times: [0, 0.66, 0.8, 0.93, 1],
                  ease: 'easeInOut',
                }}
              >
                {/* Loader Main Arm Segment */}
                <path d="M 10,12 L 68,16 L 98,40" fill="none" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 10,12 L 68,16 L 98,40" fill="none" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                
                {/* Secondary Hydraulic cylinder */}
                <line x1="20" y1="0" x2="65" y2="10" stroke="#cbd5e1" strokeWidth="3" />
                <line x1="65" y1="10" x2="94" y2="34" stroke="#475569" strokeWidth="2.5" />

                {/* Front Bucket Joint Pivot */}
                <circle cx="98" cy="40" r="3" fill="#1e293b" />

                {/* Front Heavy Bucket */}
                <path d="M 94,30 L 112,30 L 118,50 L 98,54 L 90,44 Z" fill="#334155" stroke="#0f172a" strokeWidth="1.5" strokeLinejoin="round" />
                {/* Bucket teeth */}
                <line x1="118" y1="50" x2="121" y2="48" stroke="#0f172a" strokeWidth="2" />
                <line x1="117" y1="52" x2="120" y2="50" stroke="#0f172a" strokeWidth="2" />
              </motion.g>
            </g>

            {/* DUST PARTICLES (Behind Rear Wheel) */}
            <motion.g
              animate={{ opacity: [1, 1, 0, 0] }}
              transition={{ duration: 3.0, times: [0, 0.66, 0.72, 1] }}
            >
              {rearDust.map((dust, idx) => (
                <motion.circle
                  key={`rear-dust-${idx}`}
                  cx="50"
                  cy="112"
                  r={dust.size}
                  fill="#78716c"
                  animate={{
                    x: [0, dust.x],
                    y: [0, dust.y],
                    scale: [0.6, 2],
                    opacity: [0, 0.6, 0],
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    delay: dust.delay,
                    ease: 'easeOut',
                  }}
                />
              ))}

              {/* DUST PARTICLES (Behind Front Wheel) */}
              {frontDust.map((dust, idx) => (
                <motion.circle
                  key={`front-dust-${idx}`}
                  cx="155"
                  cy="114"
                  r={dust.size}
                  fill="#78716c"
                  animate={{
                    x: [0, dust.x],
                    y: [0, dust.y],
                    scale: [0.6, 1.8],
                    opacity: [0, 0.5, 0],
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    delay: dust.delay,
                    ease: 'easeOut',
                  }}
                />
              ))}
            </motion.g>

            {/* BACK WHEEL (Large) - Translate to center (73, 105) */}
            <g transform="translate(73, 105)">
              <motion.g
                animate={{ rotate: [0, 1440] }}
                transition={{ duration: 2.0, ease: [0.15, 0.85, 0.35, 1.0] }}
              >
                {/* Main tire outer circle */}
                <circle cx="0" cy="0" r="22" fill="#1e293b" stroke="#0f172a" strokeWidth="3" />
                {/* Tire treads */}
                {Array.from({ length: 8 }).map((_, i) => {
                  const angle = (i * 360) / 8;
                  return (
                    <rect
                      key={`rear-tread-${i}`}
                      x="-4"
                      y="-25"
                      width="8"
                      height="4"
                      fill="#0f172a"
                      transform={`rotate(${angle})`}
                    />
                  );
                })}
                {/* Inner Wheel Rim (Amber) */}
                <circle cx="0" cy="0" r="13" fill="#f59e0b" stroke="#0f172a" strokeWidth="1.5" />
                {/* Heavy wheel bolts & details */}
                <circle cx="0" cy="0" r="6" fill="#1e293b" />
                {Array.from({ length: 5 }).map((_, i) => {
                  const angle = (i * 360) / 5;
                  return (
                    <circle
                      key={`rear-bolt-${i}`}
                      cx="0"
                      cy="-9"
                      r="1.5"
                      fill="#94a3b8"
                      transform={`rotate(${angle})`}
                    />
                  );
                })}
              </motion.g>
            </g>

            {/* FRONT WHEEL (Small) - Translate to center (166, 109) */}
            <g transform="translate(166, 109)">
              <motion.g
                animate={{ rotate: [0, 2160] }}
                transition={{ duration: 2.0, ease: [0.15, 0.85, 0.35, 1.0] }}
              >
                {/* Main tire outer circle */}
                <circle cx="0" cy="0" r="15" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
                {/* Tire treads */}
                {Array.from({ length: 6 }).map((_, i) => {
                  const angle = (i * 360) / 6;
                  return (
                    <rect
                      key={`front-tread-${i}`}
                      x="-3"
                      y="-17"
                      width="6"
                      height="3"
                      fill="#0f172a"
                      transform={`rotate(${angle})`}
                    />
                  );
                })}
                {/* Inner Wheel Rim (Amber) */}
                <circle cx="0" cy="0" r="9" fill="#f59e0b" stroke="#0f172a" strokeWidth="1" />
                {/* Wheel hub details */}
                <circle cx="0" cy="0" r="4" fill="#1e293b" />
                {Array.from({ length: 4 }).map((_, i) => {
                  const angle = (i * 360) / 4;
                  return (
                    <circle
                      key={`front-bolt-${i}`}
                      cx="0"
                      cy="-6"
                      r="1"
                      fill="#94a3b8"
                      transform={`rotate(${angle})`}
                    />
                  );
                })}
              </motion.g>
            </g>

          </svg>
        </motion.div>
      </div>

      {/* Elegant Progress/Status Loading Bar */}
      <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-2 mt-2 px-6">
        <div className="w-full h-1.5 bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.8, ease: 'easeInOut' }}
            className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]"
          />
        </div>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0.8] }}
          transition={{ duration: 0.5 }}
          className="text-[9px] font-mono tracking-widest text-slate-400 uppercase mt-1"
        >
          Initializing Fleet Systems...
        </motion.p>
      </div>
    </motion.div>
  );
}
