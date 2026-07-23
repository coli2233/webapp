import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from '../styles/App.module.css';

const BLOCK_TYPES = {
  HEAT_SOURCE: { id: 'heat', label: 'Fuente de Calor', icon: '🔥', color: '#f87171', tempRange: [0, 500], defaultTemp: 100 },
  COLD_SOURCE: { id: 'cold', label: 'Fuente de Frío', icon: '❄️', color: '#38bdf8', tempRange: [-40, 30], defaultTemp: -10 },
  SUN: { id: 'sun', label: 'Sol / Radiación', icon: '☀️', color: '#fbbf24', tempRange: [0, 600], defaultTemp: 200 },
  CONDUCTOR: { id: 'conductor', label: 'Aluminio', icon: '⚙️', color: '#94a3b8', k: 205, description: 'Aluminio (k=205 W/m·K) — Excelente conductor térmico' },
  INSULATOR: { id: 'insulator', label: 'Tecnopor', icon: '🟡', color: '#fde68a', k: 0.03, description: 'Tecnopor/EPS (k=0.03 W/m·K) — Aislante excepcional' },
  CARDBOARD: { id: 'cardboard', label: 'Cartón', icon: '📦', color: '#d4a574', k: 0.05, description: 'Cartón (k=0.05 W/m·K) — Aislante básico' },
  WALL: { id: 'wall', label: 'Ladrillo', icon: '🧱', color: '#b45309', k: 0.8, description: 'Ladrillo (k=0.8 W/m·K) — Aislante moderado' },
  WINDOW: { id: 'window', label: 'Vidrio', icon: '🪟', color: '#7dd3fc', k: 0.9, description: 'Vidrio doble (k=0.9 W/m·K) — Conductor moderado' },
};

const MECHANISM_LABELS = {
  conduccion: { name: 'Conducción', icon: '🔥', formula: 'Q = k·A·(T₁-T₂)/L (o Q = ΔT/R_total multicapa)', color: '#f87171', desc: 'Transferencia de calor a través de uno o más materiales' },
  conveccion: { name: 'Convección', icon: '💨', formula: 'Q = h·A·(T_s-T_f)', color: '#38bdf8', desc: 'Transferencia por movimiento de fluidos' },
  radiacion: { name: 'Radiación', icon: '☀️', formula: 'Q = ε·σ·A·(T₁⁴-T₂⁴)', color: '#fbbf24', desc: 'Transferencia por ondas electromagnéticas' },
};

const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= 768 || navigator.maxTouchPoints > 0;
};

/** Misma lógica que la etiqueta de aislamiento del panel (R = L / k·A). */
const getWallInsulation = (matBlocks, thickness, area) => {
  if (!matBlocks.length) return { level: 'none', R_total: 0 };
  const R_total = matBlocks.reduce(
    (sum, b) => sum + thickness / (BLOCK_TYPES[b.type].k * area),
    0
  );
  if (R_total > 2) return { level: 'excellent', R_total };
  if (R_total > 0.5) return { level: 'moderate', R_total };
  return { level: 'poor', R_total };
};

export const SimulatorSandbox = ({ externalActiveMechanism, onMechanismChange }) => {
  const [placedBlocks, setPlacedBlocks] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [activeMechanism, setMechanism] = useState('conduccion');
  const [globalParams, setGlobalParams] = useState({ thickness: 0.1, area: 1, velocity: 2, emissivity: 0.85 });
  const [results, setResults] = useState(null);
  const [dragging, setDragging] = useState(null); // { blockType, x, y }
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const blockIdRef = useRef(0);

  const mechanism = externalActiveMechanism || activeMechanism;
  const handleMechanismChange = onMechanismChange || setMechanism;
  const audioCtxRef = useRef(null);
  const ambientNodesRef = useRef({});

  // ===== WEB AUDIO HELPERS =====
  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const playDropSound = (type) => {
    try {
      const ctx = getAudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      switch (type) {
        case 'CONDUCTOR': // Aluminio — bright metallic clink
          osc.type = 'square'; osc.frequency.setValueAtTime(880, now);
          osc.frequency.exponentialRampToValueAtTime(440, now + 0.1);
          gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          osc.start(now); osc.stop(now + 0.25); break;
        case 'WALL': // Ladrillo — heavy thud
          osc.type = 'sawtooth'; osc.frequency.setValueAtTime(120, now);
          osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
          gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.start(now); osc.stop(now + 0.3); break;
        case 'WINDOW': // Vidrio — glass tink
          osc.type = 'sine'; osc.frequency.setValueAtTime(1200, now);
          osc.frequency.exponentialRampToValueAtTime(900, now + 0.15);
          gain.gain.setValueAtTime(0.25, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.start(now); osc.stop(now + 0.4); break;
        case 'INSULATOR': // Tecnopor — airy soft pop
          osc.type = 'sine'; osc.frequency.setValueAtTime(300, now);
          osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);
          gain.gain.setValueAtTime(0.28, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.start(now); osc.stop(now + 0.22); break;
        case 'CARDBOARD': // Cartón — dry flap thud
          osc.type = 'triangle'; osc.frequency.setValueAtTime(180, now);
          osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
          gain.gain.setValueAtTime(0.45, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          osc.start(now); osc.stop(now + 0.18); break;
        case 'HEAT_SOURCE': // Fuego — warm crackle
          osc.type = 'sawtooth'; osc.frequency.setValueAtTime(80, now);
          gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now); osc.stop(now + 0.5); break;
        case 'COLD_SOURCE': // Frío — icy whoosh
          osc.type = 'sine'; osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(200, now + 0.4);
          gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now); osc.stop(now + 0.5); break;
        case 'SUN': // Sol — bright shimmer
          osc.type = 'sine'; osc.frequency.setValueAtTime(500, now);
          osc.frequency.linearRampToValueAtTime(800, now + 0.15);
          osc.frequency.exponentialRampToValueAtTime(400, now + 0.4);
          gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now); osc.stop(now + 0.5); break;
        default:
          osc.type = 'sine'; osc.frequency.setValueAtTime(440, now);
          gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.start(now); osc.stop(now + 0.2);
      }
    } catch(e) { /* audio not available */ }
  };

  // Add block at specific canvas position
  const addBlockAt = useCallback((type, canvasX, canvasY) => {
    const blockType = BLOCK_TYPES[type];
    const isSource = ['HEAT_SOURCE', 'COLD_SOURCE', 'SUN'].includes(type);
    const isMaterial = ['CONDUCTOR', 'INSULATOR', 'CARDBOARD', 'WALL', 'WINDOW'].includes(type);
    const bw = isSource ? 70 : 90;
    const bh = isSource ? 70 : 60;

    const newBlock = {
      id: `block_${blockIdRef.current++}`,
      type,
      x: Math.max(0, Math.min(canvasX - bw / 2, (canvasRef.current?.clientWidth || 600) - bw)),
      y: Math.max(0, Math.min(canvasY - bh / 2, (canvasRef.current?.clientHeight || 400) - bh)),
      bw, bh,
      temp: blockType.defaultTemp ?? 25,
      color: blockType.color,
    };

    setPlacedBlocks(prev => {
      let next = [...prev];
      if (isSource) {
        next = next.filter(b => !['HEAT_SOURCE', 'COLD_SOURCE', 'SUN'].includes(b.type));
      }
      if (isMaterial) {
        next = next.filter(b => !['CONDUCTOR', 'INSULATOR', 'CARDBOARD', 'WALL', 'WINDOW'].includes(b.type));
      }
      return [...next, newBlock];
    });
    setSelectedBlock(newBlock.id);
    playDropSound(type);
  }, []);


  const removeBlock = (id) => {
    const block = placedBlocks.find(b => b.id === id);
    if (!block) return;
    const isSource = block.type === 'HEAT_SOURCE' || block.type === 'COLD_SOURCE' || block.type === 'SUN';
    // No permitir eliminar fuentes de energía individualmente
    if (isSource) return;
    setPlacedBlocks(prev => prev.filter(b => b.id !== id));
    if (selectedBlock === id) setSelectedBlock(null);
  };

  // ========== DRAG AND DROP WITH MOUSE & TOUCH EVENTS ==========
  const handlePaletteMouseDown = (e, blockType) => {
    e.preventDefault();
    setDragging({ blockType, offsetX: e.nativeEvent.offsetX, offsetY: e.nativeEvent.offsetY });
  };

  // Soporte táctil para arrastrar
  const handlePaletteTouchStart = (e, blockType) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;
    setDragging({ blockType, offsetX, offsetY });
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    setDragging(prev => prev ? { ...prev, mouseX: e.clientX, mouseY: e.clientY } : null);
  }, [dragging]);

  const handleTouchMove = useCallback((e) => {
    if (!dragging) return;
    e.preventDefault(); // Evitar scroll mientras se arrastra
    const touch = e.touches[0];
    setDragging(prev => prev ? { ...prev, mouseX: touch.clientX, mouseY: touch.clientY } : null);
  }, [dragging]);

  const handleMouseUp = useCallback((e) => {
    if (!dragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (mx >= 0 && mx <= rect.width && my >= 0 && my <= rect.height) {
        addBlockAt(dragging.blockType, mx, my);
      }
    }
    setDragging(null);
  }, [dragging, addBlockAt]);

  const handleTouchEnd = useCallback((e) => {
    if (!dragging) return;
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      const mx = touch.clientX - rect.left;
      const my = touch.clientY - rect.top;
      if (mx >= 0 && mx <= rect.width && my >= 0 && my <= rect.height) {
        addBlockAt(dragging.blockType, mx, my);
      }
    }
    setDragging(null);
  }, [dragging, addBlockAt]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let frame = 0;
    const animate = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      ctx.clearRect(0, 0, w, h);

      // ── State ──────────────────────────────────────────────
      const extSources = placedBlocks.filter(b => b.x < w * 0.45 && ['HEAT_SOURCE', 'COLD_SOURCE', 'SUN'].includes(b.type));
      const intSources = placedBlocks.filter(b => b.x > w * 0.55 && ['HEAT_SOURCE', 'COLD_SOURCE', 'SUN'].includes(b.type));
      const isExtCold = extSources.some(b => b.type === 'COLD_SOURCE');
      const isExtHot  = extSources.some(b => ['HEAT_SOURCE', 'SUN'].includes(b.type));
const isIntCold = intSources.some(b => b.type === 'COLD_SOURCE');
       const isIntHot  = intSources.some(b => ['HEAT_SOURCE', 'SUN'].includes(b.type));
       const matBlocks = placedBlocks.filter(b => ['CONDUCTOR','INSULATOR','CARDBOARD','WALL','WINDOW'].includes(b.type));
       const { level: insLevel, R_total: wallR } = getWallInsulation(
         matBlocks,
         globalParams.thickness,
         globalParams.area
       );
       const hasWall = matBlocks.length > 0;
       const poorInsulation = insLevel === 'poor';
       const moderateInsulation = insLevel === 'moderate';
       const excellentInsulation = insLevel === 'excellent';

       // Computed interior temperature (DEPENDE del aislamiento)
       // Base: interior sources own temperature
       // Also affected by exterior source penetrating through wall (depends on insulation)
       // NOAA Temperature interior - Detecta fuentes de energía y materiales
       let lastInteriorTemp = 20;
       let intBaseTemp = 20;
       if (intSources.length > 0) {
         const sum = intSources.reduce((acc, b) => acc + (b.temp || 20), 0);
         intBaseTemp = Math.round(sum / intSources.length);
       }
       
       // Calculate exterior penetration temperature
       let extPenetration = 20;
       if (extSources.length > 0) {
         const sum = extSources.reduce((acc, b) => acc + (b.temp || 20), 0);
         extPenetration = Math.round(sum / extSources.length);
       }
       
       // Si no hay fuentes en el interior, usar exterior como referencia
       // Si hay material, aplica aislamiento. Si no hay, 100% penetra.
       let penFactor;
       if (!hasWall) {
         penFactor = 1.0;  // Sin pared = todo el calor/frío del exterior entra
       } else if (poorInsulation) {
         penFactor = 0.7;
       } else if (moderateInsulation) {
         penFactor = 0.3;
       } else {
         penFactor = 0.05;  // Excelente
       }
       
       // Mezcla entre temperatura interior base + temperatura exterior penetrada
       // Si no hay fuente interior, usar solo exterior
       const effectiveBase = intSources.length > 0 ? intBaseTemp : 20;
       const mixedTemp = (effectiveBase * (1 - penFactor)) + (extPenetration * penFactor);
       lastInteriorTemp = Math.round(mixedTemp);
       
       const isMixedHot = mixedTemp > 30;
       const isMixedCold = mixedTemp < 15;
       
const finalIntHot = intSources.some(b => ['HEAT_SOURCE', 'SUN'].includes(b.type)) || (penFactor > 0.3 && isMixedHot);
       const finalIntCold = intSources.some(b => b.type === 'COLD_SOURCE') || (penFactor > 0.3 && isMixedCold);

       // ══════════════════════════════════════════════════════
       //  EXTERIOR  (left 45%)
       // ══════════════════════════════════════════════════════
      const extGrad = ctx.createLinearGradient(0, 0, 0, h);
      if (isExtCold) {
        extGrad.addColorStop(0, '#020617'); extGrad.addColorStop(0.5, '#0f172a'); extGrad.addColorStop(1, '#1e3a8a');
      } else if (isExtHot) {
        extGrad.addColorStop(0, '#0ea5e9'); extGrad.addColorStop(0.6, '#7dd3fc'); extGrad.addColorStop(1, '#bae6fd');
      } else {
        extGrad.addColorStop(0, '#0f172a'); extGrad.addColorStop(1, '#1e293b');
      }
      ctx.fillStyle = extGrad;
      ctx.fillRect(0, 0, w * 0.45, h);

      // ── SKY ELEMENTS ──────────────────────────────────────
      if (!isExtHot) {
        // Pulsating stars
        for (let i = 0; i < 45; i++) {
          const sx = 5 + (i * 53 + Math.sin(i * 2.3) * 15) % (w * 0.42);
          const sy = 5 + (i * 37 + Math.cos(i * 1.7) * 12) % (h * 0.65);
          const twinkle = 0.25 + 0.75 * Math.abs(Math.sin(frame * 0.04 + i * 0.8));
          ctx.globalAlpha = twinkle;
          ctx.fillStyle = i % 5 === 0 ? '#fbbf24' : '#ffffff';
          ctx.beginPath(); ctx.arc(sx, sy, i % 3 === 0 ? 2 : 1, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Moon with glow
        const moonX = w * 0.08, moonY = h * 0.18;
        const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 55);
        moonGlow.addColorStop(0, 'rgba(254,240,138,0.25)');
        moonGlow.addColorStop(1, 'rgba(254,240,138,0)');
        ctx.fillStyle = moonGlow; ctx.beginPath(); ctx.arc(moonX, moonY, 55, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(moonX, moonY, 22, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fde047'; ctx.font = 'bold 28px serif'; ctx.textAlign = 'center';
        ctx.fillText('🌙', moonX, moonY + 10);
      }
      if (isExtHot) {
        // Animated sun with rays
        const sunX = w * 0.09, sunY = h * 0.18;
        const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 80);
        sunGlow.addColorStop(0, 'rgba(253,224,71,0.5)');
        sunGlow.addColorStop(0.5, 'rgba(251,191,36,0.2)');
        sunGlow.addColorStop(1, 'rgba(251,191,36,0)');
        ctx.fillStyle = sunGlow; ctx.beginPath(); ctx.arc(sunX, sunY, 80, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fde047'; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 30;
        ctx.beginPath(); ctx.arc(sunX, sunY, 28, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
        // Sun rays
        for (let r = 0; r < 8; r++) {
          const angle = (r / 8) * Math.PI * 2 + frame * 0.01;
          ctx.strokeStyle = 'rgba(253,224,71,0.5)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(sunX + Math.cos(angle) * 34, sunY + Math.sin(angle) * 34);
          ctx.lineTo(sunX + Math.cos(angle) * 55, sunY + Math.sin(angle) * 55);
          ctx.stroke();
        }
        // Moving clouds
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < 3; i++) {
          const cx = ((frame * 0.3 + i * (w * 0.18)) % (w * 0.52 + 80)) - 40;
          const cy = h * 0.12 + (i % 2) * 35;
          ctx.beginPath();
          ctx.arc(cx, cy, 18, 0, Math.PI*2);
          ctx.arc(cx + 22, cy - 10, 24, 0, Math.PI*2);
          ctx.arc(cx + 44, cy + 2, 20, 0, Math.PI*2);
          ctx.fill();
        }
      }

      // ── EXTERIOR GROUND ─────────────────────────────────
      const groundGrad = ctx.createLinearGradient(0, h * 0.74, 0, h);
      if (isExtCold) {
        groundGrad.addColorStop(0, '#e2e8f0'); groundGrad.addColorStop(1, '#cbd5e1');
      } else if (isExtHot) {
        groundGrad.addColorStop(0, '#a16207'); groundGrad.addColorStop(1, '#78350f');
      } else {
        groundGrad.addColorStop(0, '#15803d'); groundGrad.addColorStop(1, '#14532d');
      }
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, h * 0.74, w * 0.45, h * 0.26);
      // Ground line sheen
      ctx.fillStyle = isExtCold ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.07)';
      ctx.fillRect(0, h * 0.74, w * 0.45, 3);

      // ── PINE TREE ────────────────────────────────────────
      const tx = w * 0.32, ty = h * 0.74;
      const treeColor = isExtCold ? '#1e293b' : (isExtHot ? '#92400e' : '#14532d');
      ctx.fillStyle = treeColor;
      // Trunk
      ctx.fillRect(tx - 7, ty - 65, 14, 65);
      if (!isExtHot) {
        // Triple-layer pine
        [[55, 0], [80, -40], [65, -75]].forEach(([halfW, yOff]) => {
          ctx.beginPath();
          ctx.moveTo(tx, ty + yOff - 60); ctx.lineTo(tx - halfW, ty + yOff); ctx.lineTo(tx + halfW, ty + yOff); ctx.closePath();
          ctx.fill();
        });
      } else {
        // Cactus shape
        ctx.fillStyle = '#65a30d';
        ctx.fillRect(tx - 8, ty - 100, 16, 100);
        ctx.fillRect(tx - 28, ty - 70, 20, 8);
        ctx.fillRect(tx + 8, ty - 55, 20, 8);
      }

      // Snow accumulation on ground
      if (isExtCold) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.ellipse(tx, ty, 30, 8, 0, 0, Math.PI * 2); ctx.fill();
      }

      // ══════════════════════════════════════════════════════
      //  INTERIOR  (right 45%)
      // ══════════════════════════════════════════════════════
      // ── Interior base (dark background behind wall) ────────
      const intGrad = ctx.createLinearGradient(w * 0.55, 0, w * 0.55, h * 0.75);
      if (isIntCold) {
        intGrad.addColorStop(0, '#0f2540'); intGrad.addColorStop(1, '#162d48');
      } else if (isIntHot) {
        intGrad.addColorStop(0, '#3d1c0a'); intGrad.addColorStop(1, '#4a220c');
      } else {
        intGrad.addColorStop(0, '#2a1d12'); intGrad.addColorStop(1, '#3d2b1a');
      }
      ctx.fillStyle = intGrad;
      ctx.fillRect(w * 0.55, 0, w * 0.45, h * 0.74);

      // ── Interior wall (dark warm contrast) ──────────────────
      const wallGrad = ctx.createLinearGradient(w * 0.55, 0, w * 0.55, h * 0.74);
      if (isIntCold) {
        wallGrad.addColorStop(0, '#1e3a5f');
        wallGrad.addColorStop(0.5, '#1a3352');
        wallGrad.addColorStop(1, '#162d48');
      } else if (isIntHot) {
        wallGrad.addColorStop(0, '#5c2a0e');
        wallGrad.addColorStop(0.5, '#4a220c');
        wallGrad.addColorStop(1, '#3d1c0a');
      } else {
        wallGrad.addColorStop(0, '#3d2b1a');
        wallGrad.addColorStop(0.5, '#4a3320');
        wallGrad.addColorStop(1, '#3d2b1a');
      }
      ctx.fillStyle = wallGrad;
      ctx.fillRect(w * 0.55, 0, w * 0.45, h * 0.74);

      // Subtle texture on wall
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      for (let x = w * 0.55; x < w; x += 30) ctx.fillRect(x, 0, 15, h * 0.74);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      for (let x = w * 0.55 + 15; x < w; x += 30) ctx.fillRect(x, 0, 15, h * 0.74);

      // ── Wall picture frame ─────────────────────────────────
      const frameX = w * 0.62, frameY = h * 0.18;
      ctx.fillStyle = '#78350f';
      ctx.fillRect(frameX - 4, frameY - 4, 68, 52);
      ctx.fillStyle = '#d4c4a8';
      ctx.fillRect(frameX, frameY, 60, 44);
      ctx.fillStyle = '#8b7355';
      ctx.fillRect(frameX + 4, frameY + 4, 52, 36);
      ctx.fillStyle = '#f5deb3';
      ctx.fillRect(frameX + 6, frameY + 6, 48, 32);
      // Simple landscape in frame
      ctx.fillStyle = '#87ceeb';
      ctx.fillRect(frameX + 6, frameY + 6, 48, 18);
      ctx.fillStyle = '#228b22';
      ctx.beginPath();
      ctx.moveTo(frameX + 6, frameY + 24); ctx.lineTo(frameX + 20, frameY + 16); ctx.lineTo(frameX + 34, frameY + 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#228b22';
      ctx.beginPath();
      ctx.moveTo(frameX + 28, frameY + 24); ctx.lineTo(frameX + 42, frameY + 14); ctx.lineTo(frameX + 54, frameY + 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(frameX + 6, frameY + 24, 48, 14);
      // Frame shine
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(frameX - 4, frameY - 4, 68, 3);

      // ── Window with curtains ────────────────────────────────
      const winX = w * 0.72, winY = h * 0.12;
      const winW = 70, winH = 85;
      // Curtain rod
      ctx.strokeStyle = '#a16207'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(winX - 20, winY - 8); ctx.lineTo(winX + winW + 20, winY - 8); ctx.stroke();
      ctx.fillStyle = '#ca8a04';
      ctx.beginPath(); ctx.arc(winX - 20, winY - 8, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(winX + winW + 20, winY - 8, 5, 0, Math.PI * 2); ctx.fill();
      // Left curtain
      ctx.fillStyle = 'rgba(180,80,60,0.75)';
      ctx.beginPath();
      ctx.moveTo(winX - 18, winY - 4);
      ctx.quadraticCurveTo(winX - 5, winY + winH * 0.4, winX - 2, winY + winH);
      ctx.lineTo(winX - 18, winY + winH);
      ctx.closePath(); ctx.fill();
      // Right curtain
      ctx.beginPath();
      ctx.moveTo(winX + winW + 18, winY - 4);
      ctx.quadraticCurveTo(winX + winW + 5, winY + winH * 0.4, winX + winW + 2, winY + winH);
      ctx.lineTo(winX + winW + 18, winY + winH);
      ctx.closePath(); ctx.fill();
      // Window frame
      ctx.fillStyle = '#f5f5f4';
      ctx.fillRect(winX, winY, winW, winH);
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(winX, winY, winW, 6);
      ctx.fillRect(winX, winY + winH - 6, winW, 6);
      ctx.fillRect(winX, winY, 6, winH);
      ctx.fillRect(winX + winW - 6, winY, 6, winH);
      // Window glass panes
      ctx.fillStyle = isIntCold ? 'rgba(147,197,253,0.5)' : (isIntHot ? 'rgba(253,230,138,0.5)' : 'rgba(203,213,225,0.4)');
      ctx.fillRect(winX + 8, winY + 8, (winW - 18) / 2, winH - 16);
      ctx.fillRect(winX + 10 + (winW - 18) / 2, winY + 8, (winW - 18) / 2, winH - 16);
      // Window cross
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(winX + winW / 2 - 2, winY + 8, 4, winH - 16);
      ctx.fillRect(winX + 8, winY + winH / 2 - 2, winW - 16, 4);
      // Curtain fold shadows
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.beginPath();
      ctx.moveTo(winX - 14, winY - 4);
      ctx.quadraticCurveTo(winX - 8, winY + winH * 0.4, winX - 4, winY + winH);
      ctx.lineTo(winX - 10, winY + winH);
      ctx.quadraticCurveTo(winX - 12, winY + winH * 0.4, winX - 16, winY - 4);
      ctx.closePath(); ctx.fill();

      // ── Ceiling cornice (matching wall) ─────────────────────
      ctx.fillStyle = '#2a1d12';
      ctx.fillRect(w * 0.55, 0, w * 0.45, 18);
      const corniceGrad = ctx.createLinearGradient(0, 0, 0, 10);
      corniceGrad.addColorStop(0, 'rgba(0,0,0,0.08)'); corniceGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = corniceGrad; ctx.fillRect(w * 0.55, 18, w * 0.45, 10);

      // ── Light wood floor (contrasts dark wall) ──────────────
      const floorGrad = ctx.createLinearGradient(0, h * 0.74, 0, h);
      floorGrad.addColorStop(0, '#d4b896');
      floorGrad.addColorStop(0.4, '#c8a882');
      floorGrad.addColorStop(1, '#b8976a');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(w * 0.55, h * 0.74, w * 0.45, h * 0.26);
      // Wood planks with varied tones
      for (let i = 0; i < 8; i++) {
        const plankX = w * 0.55 + i * w * 0.055;
        const shade = i % 2 === 0 ? 'rgba(200,170,120,0.2)' : 'rgba(140,100,50,0.12)';
        ctx.fillStyle = shade;
        ctx.fillRect(plankX, h * 0.74, w * 0.055, h * 0.26);
      }
      // Plank lines
      ctx.strokeStyle = 'rgba(80,50,20,0.4)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.55 + i * w * 0.055, h * 0.74);
        ctx.lineTo(w * 0.55 + i * w * 0.055, h);
        ctx.stroke();
      }
      // Horizontal plank dividers
      for (let y = h * 0.78; y < h; y += 28) {
        ctx.strokeStyle = 'rgba(80,50,20,0.35)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(w * 0.55, y); ctx.lineTo(w, y); ctx.stroke();
      }
      // Skirting board (warm off-white)
      ctx.fillStyle = '#f5f0e8';
      ctx.fillRect(w * 0.55, h * 0.74 - 10, w * 0.45, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(w * 0.55, h * 0.74 - 10, w * 0.45, 3);

      // ── Pendant lamp with warm shade ─────────────────────
      const lampX = w * 0.72, lampY = h * 0.28;
      ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lampX, 18); ctx.lineTo(lampX, lampY - 10); ctx.stroke();
      // Warm fabric shade
      ctx.fillStyle = isIntHot ? '#fbbf24' : (isIntCold ? '#94a3b8' : '#d4a574');
      ctx.beginPath();
      ctx.moveTo(lampX - 28, lampY - 8);
      ctx.lineTo(lampX + 28, lampY - 8);
      ctx.lineTo(lampX + 20, lampY + 18);
      ctx.lineTo(lampX - 20, lampY + 18);
      ctx.closePath(); ctx.fill();
      // Shade highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.moveTo(lampX - 24, lampY - 6);
      ctx.lineTo(lampX - 8, lampY - 6);
      ctx.lineTo(lampX - 6, lampY + 14);
      ctx.lineTo(lampX - 18, lampY + 14);
      ctx.closePath(); ctx.fill();
      // Warm lamp glow
      const glow = ctx.createRadialGradient(lampX, lampY + 5, 0, lampX, lampY + 5, 100);
      const lampAlpha = isIntCold ? 0.05 : (isIntHot ? 0.28 : 0.2);
      glow.addColorStop(0, `rgba(251,191,36,${lampAlpha + 0.15})`);
      glow.addColorStop(0.4, `rgba(251,191,36,${lampAlpha * 0.5})`);
      glow.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(lampX, lampY + 5, 100, 0, Math.PI * 2); ctx.fill();
      // Bulb shine
      ctx.fillStyle = '#fef3c7'; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = isIntHot ? 20 : 10;
      ctx.beginPath(); ctx.arc(lampX, lampY + 5, 7, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

// ── Termómetro Digital pulsante ───────────────────────────
 const drawDigitalThermometer = (cx, cy, label, temp, isCold, isHot) => {
   const tempColor = isCold ? '#60a5fa' : (isHot ? '#fb7185' : '#4ade80');
   
   // Palpitación muy sutil - reducido aún más
   const pulse = 1 + 0.05 * Math.sin(frame * 0.10);
   const baseW = 62 * pulse;  // -33% total desde original 92
   const baseH = 40 * pulse;  // -31% total desde original 58
   
   const boxX = cx - baseW / 2;
   const boxY = cy - baseH / 2;
   
   // Glow suave
   const haloPulse = 8 + 5 * Math.abs(Math.sin(frame * 0.10));
   ctx.shadowColor = tempColor;
   ctx.shadowBlur = haloPulse;
   
   // Fondo del display
   ctx.fillStyle = isCold ? '#0f1a2e' : (isHot ? '#2e1a1a' : '#0f261e');
   ctx.beginPath(); ctx.roundRect(boxX, boxY, baseW, baseH, 10); ctx.fill();
   
   // Borde
   ctx.strokeStyle = tempColor;
   ctx.lineWidth = 2;
   ctx.beginPath(); ctx.roundRect(boxX, boxY, baseW, baseH, 10); ctx.stroke();
   ctx.shadowBlur = 0;
   
   // LCD scan lines
   ctx.fillStyle = isCold ? 'rgba(96,165,250,0.06)' : (isHot ? 'rgba(251,113,133,0.06)' : 'rgba(74,222,128,0.06)');
   for (let i = 0; i < baseH; i += 3) {
     ctx.fillRect(boxX, boxY + i, baseW, 1);
   }
   
   // Etiqueta (menos pulsante)
   ctx.font = 'bold 9px monospace'; ctx.fillStyle = tempColor; ctx.textAlign = 'center';
   const labelAlpha = 0.7 + 0.3 * Math.abs(Math.sin(frame * 0.08));
   ctx.globalAlpha = labelAlpha;
   ctx.fillText(label, cx, boxY + 12);
   ctx.globalAlpha = 1;
   
   // Temperatura (pulso muy sutil)
   ctx.font = 'bold 17px "Courier New", monospace';  // 20 → 17 más pequeño
   ctx.fillStyle = tempColor;
   const tempY = boxY + 28;  // ajustando posición
   
   const tempPulse = 0.95 + 0.08 * Math.abs(Math.sin(frame * 0.14));
   ctx.save();
   ctx.translate(cx, tempY);
   ctx.scale(tempPulse, tempPulse);
   
   ctx.shadowColor = tempColor;
   ctx.shadowBlur = 6 + 3 * Math.abs(Math.sin(frame * 0.14));
   ctx.fillText(`${temp}°C`, 0, 0);
   ctx.shadowBlur = 0;
   ctx.restore();
   
   // LED principal (parpadea más lento)
   if (Math.floor(frame / 30) % 2 === 0) {
     ctx.fillStyle = tempColor;
     ctx.shadowColor = tempColor;
     ctx.shadowBlur = 5;
     ctx.beginPath(); ctx.arc(cx + baseW / 2 - 10, boxY + 10, 2.5, 0, Math.PI * 2); ctx.fill();
     ctx.shadowBlur = 0;
   }
   
   // LED secundario
   const led2Pulse = 0.5 + 0.3 * Math.abs(Math.sin(frame * 0.15));
   ctx.fillStyle = tempColor;
   ctx.globalAlpha = led2Pulse;
   ctx.shadowColor = tempColor;
   ctx.shadowBlur = 4 * led2Pulse;
   ctx.beginPath(); ctx.arc(cx - baseW / 2 + 10, boxY + 10, 2, 0, Math.PI * 2); ctx.fill();
   ctx.shadowBlur = 0;
   ctx.globalAlpha = 1;
   
   // Barra de estado
   const barW = baseW - 20;
   const barH = 3;
   const barX = boxX + 10;
   const barY = boxY + baseH - 8;
   ctx.fillStyle = 'rgba(255,255,255,0.1)';
   ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 1.5); ctx.fill();
   const fillRatio = Math.max(0.05, Math.min(0.95, (temp + 20) / 200));
   ctx.fillStyle = tempColor;
   ctx.fillRect(barX, barY, barW * fillRatio, barH);
 };
 
 // Calcular temperatura promedio del exterior
 let extAvgTemp = 20;
 if (extSources.length > 0) {
   const sum = extSources.reduce((acc, b) => acc + (b.temp || 20), 0);
   extAvgTemp = Math.round(sum / extSources.length);
 }
 
 // Termómetro Digital EXTERIOR (movido más adentro del ambient, lejos de la pared)
 drawDigitalThermometer(w * 0.40, 50, 'EXT', extAvgTemp, isExtCold, isExtHot);
 
 // Termómetro Digital INTERIOR (movido más adentro, dentro del hogar)
 drawDigitalThermometer(w * 0.93, 50, 'INT', lastInteriorTemp, finalIntCold, finalIntHot);

      // ── Cozy couch ────────────────────────────────────────
      const couchX = w * 0.62, couchY = h * 0.67;
      const couchColor = isIntHot ? '#dc2626' : (isIntCold ? '#2563eb' : '#7c3aed');
      ctx.fillStyle = couchColor;
      ctx.beginPath();
      ctx.roundRect(couchX, couchY, 72, 30, 6); ctx.fill(); // seat
      ctx.beginPath();
      ctx.roundRect(couchX, couchY - 24, 72, 26, [6, 6, 0, 0]); ctx.fill(); // back
      ctx.fillRect(couchX - 8, couchY - 24, 10, 52); // left arm
      ctx.fillRect(couchX + 70, couchY - 24, 10, 52); // right arm
      // Cushion highlight
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.roundRect(couchX + 4, couchY - 22, 64, 18, 4); ctx.fill();
      // Decorative pillows
      ctx.fillStyle = isIntHot ? '#fbbf24' : (isIntCold ? '#60a5fa' : '#f472b6');
      ctx.beginPath(); ctx.ellipse(couchX + 12, couchY - 16, 10, 8, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = isIntCold ? '#93c5fd' : (isIntHot ? '#f87171' : '#a78bfa');
      ctx.beginPath(); ctx.ellipse(couchX + 60, couchY - 16, 10, 8, 0.3, 0, Math.PI * 2); ctx.fill();
      // Couch legs
      ctx.fillStyle = '#78350f';
      ctx.fillRect(couchX + 5, couchY + 30, 6, 8);
      ctx.fillRect(couchX + 61, couchY + 30, 6, 8);

      // ── Side table with plant ──────────────────────────────
      const tableX = w * 0.88, tableY = h * 0.74;
      // Table top
      ctx.fillStyle = '#a16207';
      ctx.beginPath(); ctx.roundRect(tableX - 18, tableY - 35, 36, 8, 3); ctx.fill();
      // Table legs
      ctx.fillStyle = '#78350f';
      ctx.fillRect(tableX - 14, tableY - 27, 4, 27);
      ctx.fillRect(tableX + 10, tableY - 27, 4, 27);
      // Table shelf
      ctx.fillStyle = '#92400e';
      ctx.fillRect(tableX - 14, tableY - 10, 28, 5);
      // Plant pot
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(tableX - 10, tableY - 35);
      ctx.lineTo(tableX + 10, tableY - 35);
      ctx.lineTo(tableX + 8, tableY - 55);
      ctx.lineTo(tableX - 8, tableY - 55);
      ctx.closePath(); ctx.fill();
      // Pot rim
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(tableX - 11, tableY - 37, 22, 4);
      // Soil
      ctx.fillStyle = '#451a03';
      ctx.beginPath(); ctx.ellipse(tableX, tableY - 55, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
      // Plant leaves
      ctx.fillStyle = isIntCold ? '#1e3a2f' : (isIntHot ? '#65a30d' : '#16a34a');
      [[0, -75, 12], [-12, -68, 10], [12, -70, 10], [-6, -85, 9], [6, -82, 9], [0, -92, 8]].forEach(([ox, oy, r]) => {
        ctx.beginPath(); ctx.arc(tableX + ox, tableY + oy, r, 0, Math.PI * 2); ctx.fill();
      });
      // Leaf highlights
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      [[-2, -78, 5], [8, -72, 4], [-8, -88, 4]].forEach(([ox, oy, r]) => {
        ctx.beginPath(); ctx.arc(tableX + ox, tableY + oy, r, 0, Math.PI * 2); ctx.fill();
      });

      // ── INTERIOR ANIMATIONS ────────────────────────────────

      // Floating dust particles in warm light
      for (let i = 0; i < 15; i++) {
        const dx = w * 0.56 + (i * 37 + Math.sin(frame * 0.018 + i * 2.1) * 80) % (w * 0.42);
        const dy = h * 0.1 + (i * 29 + Math.cos(frame * 0.013 + i * 1.7) * 70) % (h * 0.6);
        const dsize = 2 + Math.sin(frame * 0.04 + i) * 1;
        ctx.fillStyle = isIntHot ? 'rgba(251,191,36,0.7)' : (isIntCold ? 'rgba(180,200,230,0.6)' : 'rgba(251,200,100,0.6)');
        ctx.beginPath(); ctx.arc(dx, dy, dsize, 0, Math.PI * 2); ctx.fill();
      }

      // Animated warm light rays from lamp
      ctx.save();
      ctx.fillStyle = isIntHot ? 'rgba(251,191,36,0.12)' : (isIntCold ? 'rgba(148,163,184,0.06)' : 'rgba(251,220,100,0.09)');
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + frame * 0.005;
        const rayLen = 90 + 30 * Math.sin(frame * 0.025 + i);
        const x1 = lampX + Math.cos(angle) * 28;
        const y1 = lampY + 18;
        const x2 = lampX + Math.cos(angle) * rayLen;
        const y2 = lampY + 18 + Math.sin(angle) * rayLen * 0.6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2 - 6, y2);
        ctx.lineTo(x2 + 6, y2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Curtain gentle sway
      ctx.fillStyle = 'rgba(180,80,60,0.2)';
      const cs = Math.sin(frame * 0.02) * 5;
      ctx.beginPath();
      ctx.moveTo(winX - 14, winY + 10);
      ctx.quadraticCurveTo(winX - 8 + cs, winY + winH * 0.4, winX - 3 + cs, winY + winH);
      ctx.lineTo(winX - 18, winY + winH);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(winX + winW + 14, winY + 10);
      ctx.quadraticCurveTo(winX + winW + 8 - cs, winY + winH * 0.4, winX + winW + 3 - cs, winY + winH);
      ctx.lineTo(winX + winW + 18, winY + winH);
      ctx.closePath(); ctx.fill();

      // Temperature effects in interior
      if (isIntHot) {
        // Steam wisps rising
        ctx.strokeStyle = 'rgba(251,191,36,0.5)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const sx = w * 0.62 + i * 22;
          const sy = h * 0.68 - (frame * 0.5 + i * 20) % (h * 0.4);
          ctx.globalAlpha = 0.4 - ((frame * 0.5 + i * 20) % (h * 0.4)) / (h * 0.4) * 0.4;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(sx + Math.sin(frame * 0.04 + i) * 12, sy - 20, sx + Math.sin(frame * 0.03 + i) * 6, sy - 40);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Warm glow on floor
        const fa = 0.08 + 0.05 * Math.sin(frame * 0.12);
        ctx.fillStyle = `rgba(251,146,36,${fa})`;
        ctx.beginPath();
        ctx.ellipse(w * 0.7, h * 0.85, 90 + Math.sin(frame * 0.12) * 15, 20, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (isIntCold) {
        // Frost shimmer on window
        ctx.fillStyle = 'rgba(147,197,253,0.5)';
        for (let i = 0; i < 10; i++) {
          const fx = winX + 8 + (i * 6 + Math.sin(frame * 0.03 + i) * 4) % (winW - 16);
          const fy = winY + 8 + (i * 8 + Math.cos(frame * 0.02 + i) * 3) % (winH - 16);
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx + 3, fy - 6);
          ctx.lineTo(fx + 6, fy);
          ctx.lineTo(fx + 3, fy + 6);
          ctx.closePath(); ctx.fill();
        }

        // Cold mist at bottom
        ctx.fillStyle = 'rgba(147,197,253,0.08)';
        for (let i = 0; i < 4; i++) {
          const mx = w * 0.58 + i * 30 + Math.sin(frame * 0.01 + i) * 15;
          const my = h * 0.68 + Math.sin(frame * 0.015 + i * 2) * 8;
          ctx.beginPath(); ctx.ellipse(mx, my, 25, 8, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      const clockX = w * 0.85, clockY = h * 0.45;
      ctx.strokeStyle = 'rgba(120,80,40,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(clockX, clockY, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,248,235,0.6)';
      ctx.beginPath(); ctx.arc(clockX, clockY, 16, 0, Math.PI * 2); ctx.fill();
      // Clock hands
      ctx.strokeStyle = 'rgba(60,40,20,0.5)';
      ctx.lineWidth = 1.5;
      const hourAngle = ((frame * 0.001) % (Math.PI * 2));
      const minAngle = ((frame * 0.02) % (Math.PI * 2));
      ctx.beginPath(); ctx.moveTo(clockX, clockY); ctx.lineTo(clockX + Math.cos(hourAngle) * 8, clockY + Math.sin(hourAngle) * 8); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(clockX, clockY); ctx.lineTo(clockX + Math.cos(minAngle) * 12, clockY + Math.sin(minAngle) * 12); ctx.stroke();
      // Clock center dot
      ctx.fillStyle = 'rgba(60,40,20,0.5)';
      ctx.beginPath(); ctx.arc(clockX, clockY, 2, 0, Math.PI * 2); ctx.fill();

      // ── Labels ─────────────────────────────────────────────
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10;
      ctx.font = 'bold 22px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = isExtCold ? 'rgba(30,30,60,0.85)' : 'rgba(255,255,255,0.95)';
      ctx.fillText('☁ EXTERIOR', w * 0.225, h - 14);
      ctx.fillStyle = isIntHot ? 'rgba(80,40,0,0.8)' : 'rgba(255,255,255,0.95)';
      ctx.fillText('🏠 INTERIOR', w * 0.775, h - 14);
      ctx.shadowBlur = 0;

      // ══════════════════════════════════════════════════════
      //  CENTRAL WALL  (middle 10%)
      // ══════════════════════════════════════════════════════
      const wallStartX = w * 0.45;
      const wallWidth  = w * 0.10;

      // Bright vivid material colors lookup
      const matColors = {
        CONDUCTOR: { fill: '#38bdf8', glow: '#0ea5e9', stripe: 'rgba(255,255,255,0.18)' },
        INSULATOR: { fill: '#facc15', glow: '#eab308', stripe: 'rgba(255,255,255,0.2)' },
        CARDBOARD: { fill: '#f97316', glow: '#ea580c', stripe: 'rgba(255,255,255,0.12)' },
        WALL:      { fill: '#ef4444', glow: '#dc2626', stripe: 'rgba(255,255,255,0.1)' },
        WINDOW:    { fill: '#a78bfa', glow: '#7c3aed', stripe: 'rgba(255,255,255,0.25)' },
      };

      if (matBlocks.length === 0) {
        // Empty wall — dark slot
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(wallStartX, 0, wallWidth, h);
        // Dashed outline
        ctx.setLineDash([8, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
        ctx.strokeRect(wallStartX + 2, 2, wallWidth - 4, h - 4);
        ctx.setLineDash([]);
        ctx.save(); ctx.translate(w/2, h/2); ctx.rotate(-Math.PI/2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = 'bold 16px Inter'; ctx.textAlign = 'center';
        ctx.fillText('⬆ AGREGA MATERIALES', 0, 4);
        ctx.restore();
      } else {
        const layerW = wallWidth / matBlocks.length;
        matBlocks.forEach((mat, idx) => {
          mat.x = wallStartX + idx * layerW;
          mat.y = 0; mat.bw = layerW; mat.bh = h;
          const mc = matColors[mat.type];

          // Vivid solid fill
          ctx.fillStyle = mc.fill;
          ctx.fillRect(mat.x, 0, mat.bw, h);

          // Animated shimmer stripe
          const shimmerX = ((frame * 2 + idx * 30) % (mat.bw + 30)) - 15;
          const shimmer = ctx.createLinearGradient(mat.x + shimmerX, 0, mat.x + shimmerX + 15, h);
          shimmer.addColorStop(0, 'rgba(255,255,255,0)');
          shimmer.addColorStop(0.5, 'rgba(255,255,255,0.18)');
          shimmer.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = shimmer; ctx.fillRect(mat.x, 0, mat.bw, h);

          // Material-specific texture
          ctx.fillStyle = mc.stripe;
          if (mat.type === 'WALL') {
            for (let by = 0; by < h; by += 14) {
              ctx.fillRect(mat.x, by, mat.bw, 3);
              ctx.fillRect(mat.x + (by % 28 === 0 ? 0 : mat.bw * 0.5), by, 3, 14);
            }
          } else if (mat.type === 'WINDOW') {
            // Glass cross-hatching
            for (let gx = mat.x; gx < mat.x + mat.bw; gx += 10)
              { ctx.fillRect(gx, 0, 2, h); }
            for (let gy = 0; gy < h; gy += 14)
              { ctx.fillRect(mat.x, gy, mat.bw, 2); }
            // Diagonal glare
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath(); ctx.moveTo(mat.x, h); ctx.lineTo(mat.x + mat.bw, h - mat.bw * 2); ctx.lineTo(mat.x + mat.bw, 0); ctx.fill();
          } else if (mat.type === 'INSULATOR') {
            // Foam bubble pattern
            for (let bx = mat.x + 4; bx < mat.x + mat.bw - 4; bx += 8)
              for (let by = 6; by < h - 6; by += 8)
                { ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI*2); ctx.fill(); }
          } else if (mat.type === 'CONDUCTOR') {
            // Metal brushed lines
            for (let by = 0; by < h; by += 5)
              { ctx.fillRect(mat.x, by, mat.bw, 1); }
          } else if (mat.type === 'CARDBOARD') {
            // Corrugated wave
            ctx.beginPath();
            for (let by = 0; by < h; by += 2) {
              const bx = mat.x + Math.sin(by * 0.4) * 4;
              if (by === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
            }
            ctx.strokeStyle = mc.stripe; ctx.lineWidth = 3; ctx.stroke();
          }

          // Glowing border between layers
          ctx.strokeStyle = mc.glow; ctx.lineWidth = 3;
          ctx.shadowColor = mc.glow; ctx.shadowBlur = 12;
          ctx.strokeRect(mat.x + 1, 1, mat.bw - 2, h - 2);
          ctx.shadowBlur = 0;

          // Label (rotated, white with shadow)
          ctx.save();
          ctx.translate(mat.x + mat.bw / 2, h / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillStyle = 'white'; ctx.font = 'bold 18px Inter'; ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6;
          ctx.fillText(BLOCK_TYPES[mat.type].label, 0, -8);
          ctx.font = 'bold 13px Inter'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillText(`k=${BLOCK_TYPES[mat.type].k}`, 0, 10);
          ctx.restore();
        });

        // Top-cap on wall
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(wallStartX, 0, wallWidth, 6);
      }

      // ── WEATHER ANIMATIONS (penetración según aislamiento) ─
      if (isExtCold) {
        for (let i = 0; i < 70; i++) {
          const sy = (frame * (1.2 + i % 3 * 0.4) + i * 15) % h;
          const baseX = w * 0.08 + (i * 19) % (w * 0.35);
          let sx;

          if (!hasWall || excellentInsulation) {
            sx = baseX + Math.sin(frame * 0.012 + i * 1.1) * w * 0.06;
            sx = Math.min(sx, w * 0.43);
          } else if (moderateInsulation) {
            const canPenetrate = i % 5 === 0;
            if (canPenetrate) {
              const drift = (Math.sin(frame * 0.009 + i * 0.7) + 1) / 2;
              sx = w * 0.12 + drift * w * 0.58;
            } else {
              sx = baseX + Math.sin(frame * 0.012 + i * 1.1) * w * 0.06;
              sx = Math.min(sx, w * 0.43);
            }
          } else {
            const drift = (Math.sin(frame * 0.011 + i * 0.45) + 1) / 2;
            sx = w * 0.06 + drift * w * 0.88;
          }

          const size = 1 + (i % 4) * 0.7;
          const insideInterior = sx > w * 0.56;
          ctx.globalAlpha = insideInterior
            ? 0.35 + 0.25 * Math.sin(frame * 0.05 + i)
            : 0.7 + 0.3 * Math.sin(frame * 0.05 + i);
          ctx.fillStyle = insideInterior ? 'rgba(200,230,255,0.9)' : 'white';
          ctx.beginPath(); ctx.arc(sx, sy, size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      if (isExtHot) {
        for (let i = 0; i < 9; i++) {
          let maxReachX = w * 0.43;
          if (hasWall) {
            if (poorInsulation) maxReachX = w * 0.88;
            else if (moderateInsulation) maxReachX = i < 2 ? w * 0.72 : w * 0.43;
          }

          ctx.beginPath();
          for (let y = h * 0.22; y < h * 0.73; y += 8) {
            const t = (y - h * 0.22) / (h * 0.51);
            const baseX = w * 0.04 + i * (w * 0.44 / 9);
            const x = baseX + t * (maxReachX - baseX) + Math.sin(y * 0.07 - frame * 0.12 + i) * 14;
            if (y === h * 0.22) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(255,180,50,${0.1 + i * 0.02})`;
          ctx.lineWidth = 5; ctx.stroke();
        }
      }

      // ── SOURCE BLOCKS ─────────────────────────────────────
      placedBlocks.forEach(block => {
        const blockType = BLOCK_TYPES[block.type];
        const isSelected = selectedBlock === block.id;
        const isMaterial = ['CONDUCTOR','INSULATOR','CARDBOARD','WALL','WINDOW'].includes(block.type);
        if (!isMaterial) {
          ctx.shadowColor = block.color; ctx.shadowBlur = isSelected ? 30 : 16;
          ctx.fillStyle = block.color;
          ctx.beginPath(); ctx.roundRect(block.x, block.y, block.bw, block.bh, 10); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = isSelected ? 'white' : 'rgba(255,255,255,0.25)';
          ctx.lineWidth = isSelected ? 3 : 1; ctx.stroke();
          ctx.font = '26px serif'; ctx.textAlign = 'center';
          ctx.fillText(blockType.icon, block.x + block.bw / 2, block.y + block.bh / 2 + 10);
          ctx.font = 'bold 8px Inter'; ctx.fillStyle = 'white';
          ctx.fillText(blockType.label, block.x + block.bw / 2, block.y + block.bh - 7);
          ctx.font = 'bold 11px Inter';
          ctx.fillText(`${block.temp}°C`, block.x + block.bw / 2, block.y - 7);
        }
        if (isSelected) {
          ctx.fillStyle = '#ef4444'; ctx.shadowBlur = 0;
          ctx.beginPath(); ctx.arc(block.x + block.bw, block.y, 11, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = 'white'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('×', block.x + block.bw, block.y + 5);
        }
      });

      // ── HEAT TRANSFER PARTICLES ────────────────────────────
      if ((isExtHot || isIntHot || isExtCold || isIntCold) && (isExtHot !== isIntHot || isExtCold !== isIntCold)) {
        const flowRight = isExtHot && !isIntHot || isExtCold && !isIntCold && !isExtHot ? true :
                          isIntHot && !isExtHot ? false : true;
        const particleSpeed = Math.max(0.4, 7 / (wallR + 0.5));
        const baseParticleCount = poorInsulation ? 36 : moderateInsulation ? 20 : 10;
        const isFire = isExtHot && flowRight || isIntHot && !flowRight;
        const pColorFire = isFire ? true : false;
        for (let i = 0; i < baseParticleCount; i++) {
          const entersInterior = poorInsulation
            ? true
            : moderateInsulation
              ? i % 4 === 0
              : false;

          const progress = ((frame * particleSpeed * 0.005 + i / (baseParticleCount || 1)) % 1);
          const startX = flowRight ? w * 0.18 : w * 0.82;
          let endX;
          if (excellentInsulation) {
            endX = flowRight ? w * 0.42 : w * 0.58;
          } else if (moderateInsulation) {
            endX = flowRight
              ? (entersInterior ? w * 0.78 : w * 0.42)
              : (entersInterior ? w * 0.22 : w * 0.58);
          } else {
            endX = flowRight ? w * 0.85 : w * 0.15;
          }
          let px = startX + (endX - startX) * progress;

          if (excellentInsulation && ((flowRight && px > w * 0.44) || (!flowRight && px < w * 0.56))) continue;

          let dropAmount = 0;
          if (poorInsulation) dropAmount = h * 0.18;
          else if (moderateInsulation && entersInterior) dropAmount = h * 0.09;
          
          const py = h / 2 + dropAmount + Math.sin(frame * 0.05 + i * 0.9) * (h * 0.32);
          const alpha = 0.55 + 0.45 * Math.abs(Math.sin(frame * 0.07 + i));
          const flicker = 1 + 0.15 * Math.sin(frame * 0.12 + i * 1.3);
          ctx.shadowBlur = 10;

          if (pColorFire) {
            // ── LLAMA DE FUEGO ──
            ctx.save(); ctx.translate(px, py);
            ctx.fillStyle = `rgba(255,80,20,${alpha})`;
            // Outer flame
            ctx.beginPath();
            ctx.moveTo(0, -15 * flicker);
            ctx.quadraticCurveTo(-7, -6, -4, 5);
            ctx.quadraticCurveTo(0, 8, 4, 5);
            ctx.quadraticCurveTo(7, -6, 0, -15 * flicker);
            ctx.fill();
            // Inner flame (orange)
            ctx.fillStyle = `rgba(255,180,20,${alpha * 0.9})`;
            ctx.beginPath();
            ctx.moveTo(0, -8 * flicker);
            ctx.quadraticCurveTo(-4, -3, -2, 3);
            ctx.quadraticCurveTo(0, 5, 2, 3);
            ctx.quadraticCurveTo(4, -3, 0, -8 * flicker);
            ctx.fill();
            // Core (yellow-white)
            ctx.fillStyle = `rgba(255,240,80,${alpha * 0.8})`;
            ctx.beginPath();
            ctx.moveTo(0, -4 * flicker);
            ctx.quadraticCurveTo(-2, -1, -1, 1);
            ctx.quadraticCurveTo(0, 2, 1, 1);
            ctx.quadraticCurveTo(2, -1, 0, -4 * flicker);
            ctx.fill();
            ctx.shadowColor = 'rgba(255,100,0,0.8)';
            ctx.restore();
          } else {
            // ── CRISTAL DE HIELO ──
            ctx.save(); ctx.translate(px, py);
            ctx.fillStyle = `rgba(180,220,255,${alpha})`;
            // Hexagonal crystal base
            ctx.beginPath();
            for (let v = 0; v < 6; v++) {
              const ang = (v * Math.PI) / 3 - Math.PI / 2;
              const rad = 7 + (v % 2) * 1.5;
              const cx = Math.cos(ang) * rad;
              const cy = Math.sin(ang) * rad;
              v === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
            }
            ctx.closePath(); ctx.fill();
            // Inner shine
            ctx.fillStyle = `rgba(220,240,255,${alpha * 0.7})`;
            ctx.beginPath();
            for (let v = 0; v < 6; v++) {
              const ang = (v * Math.PI) / 3 - Math.PI / 2;
              const rad = 4;
              const cx = Math.cos(ang) * rad;
              const cy = Math.sin(ang) * rad;
              v === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
            }
            ctx.closePath(); ctx.fill();
            // Arms of the crystal
            ctx.strokeStyle = `rgba(200,230,255,${alpha * 0.5})`; ctx.lineWidth = 1;
            for (let arm = 0; arm < 6; arm++) {
              const ang = (arm * Math.PI) / 3 - Math.PI / 2;
              ctx.beginPath();
              ctx.moveTo(Math.cos(ang) * 7, Math.sin(ang) * 7);
              ctx.lineTo(Math.cos(ang) * (9 + Math.sin(frame * 0.08 + i) * 2), Math.sin(ang) * (9 + Math.sin(frame * 0.08 + i) * 2));
              ctx.stroke();
            }
            ctx.shadowColor = 'rgba(100,180,255,0.7)';
            ctx.restore();
          }
          ctx.shadowBlur = 0;
        }
      }


      frame++;
      animRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [placedBlocks, selectedBlock, globalParams]);

  const handleCanvasClick = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const clickedDelete = placedBlocks.find(b => {
      const dx = mx - (b.x + b.bw);
      const dy = my - b.y;
      return Math.sqrt(dx * dx + dy * dy) < 12;
    });
    if (clickedDelete) { removeBlock(clickedDelete.id); return; }

    const clickedBlock = placedBlocks.find(b =>
      mx >= b.x && mx <= b.x + b.bw && my >= b.y && my <= b.y + b.bh
    );
    setSelectedBlock(clickedBlock ? clickedBlock.id : null);
  };

  const handleCanvasDblClick = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const clickedBlock = placedBlocks.find(b => {
    const notSource = b.type !== 'HEAT_SOURCE' && b.type !== 'COLD_SOURCE' && b.type !== 'SUN';
    return notSource && mx >= b.x && mx <= b.x + b.bw && my >= b.y && my <= b.y + b.bh
  });
  if (clickedBlock) removeBlock(clickedBlock.id);
  };

  const calculate = () => {
    const heatSource = placedBlocks.find(b => b.type === 'HEAT_SOURCE');
    const coldSource = placedBlocks.find(b => b.type === 'COLD_SOURCE');
    const sunSource = placedBlocks.find(b => b.type === 'SUN');
    const conductorBlock = placedBlocks.find(b => b.type === 'CONDUCTOR');
    const insulatorBlock = placedBlocks.find(b => b.type === 'INSULATOR');
    const cardboardBlock = placedBlocks.find(b => b.type === 'CARDBOARD');

    const sourceBlocks = [heatSource, coldSource, sunSource].filter(Boolean);
    if (sourceBlocks.length === 0) {
      setResults({ error: '⚠️ Agrega al menos una fuente de energía (🔥, ❄️ o ☀️) al canvas' });
      return;
    }

    // Determinar temperatura exterior (lado izquierdo) e interior (lado derecho)
    // basado en posición del bloque (x < 45% w = exterior, x > 55% w = interior)
    const T_AMBIENT = 20; // °C referencia cuando un lado no tiene fuente
    const extSources = sourceBlocks.filter(b => b.x < canvasRef.current?.clientWidth * 0.45);
    const intSources = sourceBlocks.filter(b => b.x > canvasRef.current?.clientWidth * 0.55);

    const avg = arr => arr.length ? arr.reduce((s, b) => s + (b.temp ?? 20), 0) / arr.length : null;
    let T_ext = avg(extSources) ?? T_AMBIENT;
    let T_int = avg(intSources) ?? T_AMBIENT;

    // Convención: Q = (T_exterior - T_interior) / R
    // Q > 0: calor fluye del exterior hacia el interior (exterior más caliente)
    // Q < 0: calor fluye del interior hacia el exterior (interior más caliente)
    const A = globalParams.area;

    if (mechanism === 'conduccion') {
      const L = globalParams.thickness;
      const materialBlocks = placedBlocks.filter(b => BLOCK_TYPES[b.type].k !== undefined);
      
      if (materialBlocks.length === 0) {
        setResults({ error: '⚠️ Agrega al menos un material (ej. pared, aislante, etc.) para calcular la conducción multicapa.' });
        return;
      }

      let R_total = 0;
      const k_values = [];
      const breakdown = [];
      materialBlocks.forEach(b => {
        const k = BLOCK_TYPES[b.type].k;
        const r_i = L / (k * A);
        R_total += r_i;
        k_values.push(k);
        breakdown.push({
          id: b.id,
          name: BLOCK_TYPES[b.type].label,
          color: BLOCK_TYPES[b.type].color,
          r: r_i
        });
      });

      breakdown.forEach(item => {
        item.percent = ((item.r / R_total) * 100).toFixed(1);
      });

      const Q = (T_ext - T_int) / R_total;  // ΔT = T_ext - T_int
      const Q_abs = Math.abs(Q);  // magnitud del flujo
      const k_eq = (materialBlocks.length * L) / (R_total * A);
      const direction = Q > 0 ? '↗️ Calor fluye del exterior al interior (exterior más caliente)'
                      : Q < 0 ? '↙️ Frío fluye del exterior al interior (exterior más frío)'
                              : '➖ Equilibrio térmico';

      setResults({
        Q_watts: Q.toFixed(1),
        Q_abs_watts: Q_abs.toFixed(1),  // valor absoluto para mostrar
        Q_joules_hr: (Q * 3600).toFixed(0),
        k: materialBlocks.length > 1 ? k_eq.toFixed(3) + ' (eq)' : k_values[0],
        L: (L * materialBlocks.length).toFixed(2), 
        A, T_ext, T_int,
        resistance: R_total.toFixed(4),
        breakdown: breakdown,
        suggestion: R_total > 1
          ? '✅ Buena resistencia térmica global. El sistema está bien aislado.'
          : '⚠️ Baja resistencia térmica. Se escapa mucho calor/frío, considera agregar mejores aislantes.',
        formula: materialBlocks.length > 1 
          ? `Q = ΔT / R_total = (T_ext=${T_ext} - T_int=${T_int}) / ${R_total.toFixed(4)} = ${Q.toFixed(1)} W\n${direction}`
          : `Q = ${k_values[0]} · ${A} · (T_ext=${T_ext} - T_int=${T_int}) / ${L} = ${Q.toFixed(1)} W\n${direction}`,
      });
    } else if (mechanism === 'conveccion') {
      const h = 10 + globalParams.velocity * 5;
      const Q = h * A * (T_ext - T_int);  // ΔT = T_ext - T_int
      const Q_abs = Math.abs(Q);
      const direction = Q > 0 ? '↗️ Calor fluye del exterior al interior (exterior más caliente)'
                      : Q < 0 ? '↙️ Frío fluye del exterior al interior (exterior más frío)'
                              : '➖ Equilibrio térmico';
      setResults({
        Q_watts: Q.toFixed(1),
        Q_abs_watts: Q_abs.toFixed(1),
        Q_joules_hr: (Q * 3600).toFixed(0),
        h, A, T_ext, T_int,
        suggestion: Math.abs(Q) > 500
          ? '🔥 Convección intensa. El aire transporta mucho calor/frío. Usa barreras.'
          : '💨 Flujo moderado. Reduce la velocidad del aire para menor transferencia.',
        formula: `Q = ${h.toFixed(0)} · ${A} · (T_ext=${T_ext} - T_int=${T_int}) = ${Q.toFixed(1)} W\n${direction}`,
      });
    } else {
      const sigma = 5.67e-8;
      const eps = globalParams.emissivity;
      const T1K = T_ext + 273.15;
      const T2K = T_int + 273.15;
      const Q = eps * sigma * A * (T1K ** 4 - T2K ** 4);
      const Q_abs = Math.abs(Q);
      const direction = Q > 0 ? '↗️ Calor radiante del exterior al interior (exterior más caliente)'
                      : Q < 0 ? '↙️ Frío radiante del exterior al interior (exterior más frío)'
                              : '➖ Equilibrio térmico';
      setResults({
        Q_watts: Q.toFixed(1),
        Q_abs_watts: Q_abs.toFixed(1),
        Q_joules_hr: (Q * 3600).toFixed(0),
        eps, A, T_ext, T_int,
        suggestion: eps > 0.8
          ? '☀️ Alta emisividad. El cuerpo se comporta casi como cuerpo negro.'
          : '🔇 Baja emisividad. Superficie reflectora. Minimiza pérdidas por radiación.',
        formula: `Q = ${eps} · ${sigma.toExponential(1)} · ${A} · (${T1K.toFixed(0)}⁴-${T2K.toFixed(0)}⁴) = ${Q.toFixed(1)} W\n${direction}`,
      });
    }
  };

  const selectedBlockData = placedBlocks.find(b => b.id === selectedBlock);
  const activeMech = MECHANISM_LABELS[mechanism];
  const draggingBlock = dragging ? BLOCK_TYPES[dragging.blockType] : null;

  return (
    <div className={styles.sandboxRoot}>
      {/* Left Panel - Block Palette */}
      <div className={styles.blockPalette}>
        <div className={styles.paletteTitle}>🧪 Bloques</div>
        <div className={styles.paletteScroll}>

          <div className={styles.paletteSection}>
            <div className={styles.paletteSectionLabel}>Fuentes de Energía</div>
            <div className={styles.blockGrid}>
              {['HEAT_SOURCE', 'COLD_SOURCE', 'SUN'].map(id => {
                const b = BLOCK_TYPES[id];
                return (
                  <div key={id} className={styles.paletteBlock}
                    style={{ borderColor: b.color, backgroundColor: `${b.color}15` }}
                    onMouseDown={(e) => handlePaletteMouseDown(e, id)}
                    onTouchStart={(e) => handlePaletteTouchStart(e, id)}
                  >
                    <div className={styles.paletteBlockIcon}>{b.icon}</div>
                    <div className={styles.paletteBlockLabel}>{b.label}</div>
                    <div className={styles.paletteBlockDesc}>{b.tempRange ? `${b.tempRange[0]}°C a ${b.tempRange[1]}°C` : ''}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.paletteSection}>
            <div className={styles.paletteSectionLabel}>Materiales</div>
            <div className={styles.blockGrid}>
              {['CONDUCTOR', 'INSULATOR', 'CARDBOARD'].map(id => {
                const b = BLOCK_TYPES[id];
                return (
                  <div key={id} className={styles.paletteBlock}
                    style={{ borderColor: b.color, backgroundColor: `${b.color}15` }}
                    onMouseDown={(e) => handlePaletteMouseDown(e, id)}
                    onTouchStart={(e) => handlePaletteTouchStart(e, id)}
                  >
                    <div className={styles.paletteBlockIcon}>{b.icon}</div>
                    <div className={styles.paletteBlockLabel}>{b.label}</div>
                    {b.k && <div className={styles.paletteBlockK}>k={b.k}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.paletteSection}>
            <div className={styles.paletteSectionLabel}>Estructuras</div>
            <div className={styles.blockGrid}>
              {['WALL', 'WINDOW'].map(id => {
                const b = BLOCK_TYPES[id];
                return (
                  <div key={id} className={styles.paletteBlock}
                    style={{ borderColor: b.color, backgroundColor: `${b.color}15` }}
                    onMouseDown={(e) => handlePaletteMouseDown(e, id)}
                    onTouchStart={(e) => handlePaletteTouchStart(e, id)}
                  >
                    <div className={styles.paletteBlockIcon}>{b.icon}</div>
                    <div className={styles.paletteBlockLabel}>{b.label}</div>
                    {b.k && <div className={styles.paletteBlockK}>k={b.k}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.paletteHint}>🖱️ Arrastra bloques al canvas</div>
        </div>
      </div>

      {/* Center - Canvas */}
      <div className={styles.canvasArea}>
        <div className={styles.canvasToolbar}>
          <div className={styles.mechanismTabs}>
            {Object.entries(MECHANISM_LABELS).map(([key, m]) => (
              <button
                key={key}
                className={`${styles.mechTab} ${mechanism === key ? styles.mechTabActive : ''}`}
                style={{ '--mech-color': m.color }}
                onClick={() => handleMechanismChange(key)}
              >
                <span>{m.icon}</span>
                <span>{m.name}</span>
              </button>
            ))}
          </div>
          <div className={styles.canvasActions}>
            <button className={styles.clearBtn} onClick={() => { setPlacedBlocks([]); setResults(null); setSelectedBlock(null); }}>
              🗑️ Limpiar todo
            </button>
            <button className={styles.calcBtn} onClick={calculate}>
              ⚡ Calcular
            </button>
          </div>
        </div>

        <canvas ref={canvasRef} className={styles.simCanvas} onClick={handleCanvasClick} onDoubleClick={handleCanvasDblClick} />

        {placedBlocks.length === 0 && (
          <div className={styles.canvasHint}>
            {isMobile() ? '👆 Toca y arrastra los bloques al canvas' : '🖱️ Arrastra los bloques de la izquierda hacia el canvas'}
          </div>
        )}
      </div>

      {/* Right Panel - Results */}
      <div className={styles.resultsPanel}>

        {/* Parameters */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '12px', padding: '14px 16px', marginBottom: '14px'
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '12px' }}>⚙️ Parámetros</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Grosor (L)</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{globalParams.thickness} m</span>
              </div>
              <input type="range" min="0.01" max="0.5" step="0.01" value={globalParams.thickness}
                onChange={(e) => setGlobalParams(p => ({ ...p, thickness: Number(e.target.value) }))}
                className={styles.simSlider} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Área (A)</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{globalParams.area} m²</span>
              </div>
              <input type="range" min="0.1" max="5" step="0.1" value={globalParams.area}
                onChange={(e) => setGlobalParams(p => ({ ...p, area: Number(e.target.value) }))}
                className={styles.simSlider} />
            </div>
            {mechanism === 'conveccion' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Velocidad del Aire</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{globalParams.velocity} m/s</span>
                </div>
                <input type="range" min="0.5" max="20" step="0.5" value={globalParams.velocity}
                  onChange={(e) => setGlobalParams(p => ({ ...p, velocity: Number(e.target.value) }))}
                  className={styles.simSlider} />
              </div>
            )}
            {mechanism === 'radiacion' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Emisividad (ε)</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{globalParams.emissivity}</span>
                </div>
                <input type="range" min="0.01" max="1" step="0.01" value={globalParams.emissivity}
                  onChange={(e) => setGlobalParams(p => ({ ...p, emissivity: Number(e.target.value) }))}
                  className={styles.simSlider} />
              </div>
            )}
          </div>
        </div>

        {/* Selected Block Properties */}
        {selectedBlockData && (() => {
          const bType = BLOCK_TYPES[selectedBlockData.type];
          const isMat = bType.k !== undefined;
          const blockR = isMat ? globalParams.thickness / (bType.k * globalParams.area) : 0;
          const isExcellent = blockR > 2;
          const isModerate = blockR > 0.5 && blockR <= 2;
          const badgeText = isExcellent ? '🛡️ Excelente Aislante' : isModerate ? '🧱 Aislante Moderado' : '⚠️ Pobre Aislante';
          const badgeColor = isExcellent ? '#4ade80' : isModerate ? '#facc15' : '#f87171';
          return (
            <div style={{
              background: `${bType.color}11`,
              border: `1px solid ${bType.color}44`,
              borderRadius: '12px', padding: '14px 16px', marginBottom: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>{bType.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{bType.label}</div>
                  {isMat && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{bType.description}</div>}
                </div>
              </div>
              {['HEAT_SOURCE', 'COLD_SOURCE', 'SUN'].includes(selectedBlockData.type) && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Temperatura</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: bType.color }}>{selectedBlockData.temp}°C</span>
                  </div>
                  <input type="range"
                    min={bType.tempRange[0]} max={bType.tempRange[1]} step="1" value={selectedBlockData.temp}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setPlacedBlocks(prev => prev.map(b => b.id === selectedBlockData.id ? { ...b, temp: v } : b));
                    }}
                    className={styles.simSlider} />
                </div>
              )}
              {isMat && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Resistencia (R)</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{blockR.toFixed(3)} K/W</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Conductividad (k)</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{bType.k} W/(m·K)</span>
                  </div>
                  <div style={{
                    background: `${badgeColor}18`, color: badgeColor,
                    border: `1px solid ${badgeColor}44`, borderRadius: '6px',
                    padding: '5px 10px', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', marginTop: '4px'
                  }}>{badgeText}</div>
                </div>
              )}
              {!['HEAT_SOURCE', 'COLD_SOURCE', 'SUN'].includes(selectedBlockData.type) && (
                <button onClick={() => removeBlock(selectedBlockData.id)} style={{
                  marginTop: '10px', width: '100%', padding: '7px',
                  background: 'rgba(239,68,68,0.1)', color: '#f87171',
                  border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px',
                  cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600
                }}>🗑️ Eliminar bloque</button>
              )}
            </div>
          );
        })()}

        {/* Calculation Results */}
        {results && !results.error && (
          <div style={{
            background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.2)',
            borderRadius: '12px', padding: '14px 16px', marginBottom: '14px'
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '12px' }}>📊 Resultados</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Flujo Q</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '2px' }}>{results.Q_watts} W</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Por Hora</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#a78bfa', marginTop: '2px' }}>{Number(results.Q_joules_hr).toLocaleString()} J</div>
              </div>
              {results.resistance && (
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resistencia R</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#4ade80', marginTop: '2px' }}>{results.resistance}</div>
                </div>
              )}
              {results.h && (
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coef. h</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fb923c', marginTop: '2px' }}>{results.h}</div>
                </div>
              )}
            </div>
            {/* Formula */}
            <div style={{
              background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '8px 10px',
              fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'monospace',
              wordBreak: 'break-all', marginBottom: '10px'
            }}>{results.formula}</div>
            {/* Breakdown bar */}
            {results.breakdown && results.breakdown.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>Aporte al Aislamiento</div>
                <div style={{ display: 'flex', width: '100%', height: '14px', borderRadius: '7px', overflow: 'hidden', boxShadow: '0 0 0 1px rgba(255,255,255,0.1)' }}>
                  {results.breakdown.map((item, idx) => (
                    <div key={idx} style={{ width: `${item.percent}%`, backgroundColor: item.color, transition: 'width 0.5s ease' }} title={`${item.name}: ${item.percent}%`} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {results.breakdown.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{item.name} <strong style={{ color: 'var(--text-primary)' }}>({item.percent}%)</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Suggestion */}
            <div style={{
              padding: '8px 10px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 500,
              background: results.suggestion?.startsWith('✅') ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
              color: results.suggestion?.startsWith('✅') ? '#4ade80' : '#f87171',
              border: results.suggestion?.startsWith('✅') ? '1px solid rgba(74,222,128,0.25)' : '1px solid rgba(248,113,113,0.25)'
            }}>{results.suggestion}</div>
          </div>
        )}

        {results?.error && (
          <div style={{
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: '10px', padding: '12px 14px', fontSize: '0.82rem', color: '#f87171'
          }}>{results.error}</div>
        )}

        {/* Stats bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px',
          fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 'auto'
        }}>
          <span>🧱 {placedBlocks.length} bloques</span>
          <span style={{ color: activeMech.color, fontWeight: 600 }}>{activeMech.icon} {activeMech.name}</span>
        </div>
      </div>

      {/* Dragging preview */}
      {dragging && draggingBlock && (
        <div style={{
          position: 'fixed',
          left: dragging.mouseX - 35,
          top: dragging.mouseY - 35,
          width: 70,
          height: 70,
          backgroundColor: draggingBlock.color,
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 30px ${draggingBlock.color}`,
          zIndex: 9999,
          pointerEvents: 'none',
          opacity: 0.9,
        }}>
          <div style={{ fontSize: 24 }}>{draggingBlock.icon}</div>
          <div style={{ fontSize: 7, fontWeight: 'bold', color: 'white' }}>{draggingBlock.label}</div>
        </div>
      )}
    </div>
  );
};