import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  playSquidGameSound,
  stopSquidGameSound,
  playGuestCountdownBeep,
  stopGuestCountdownBeep,
  playTripleWinnerExplosion,
  playGuestWinnerSong,
  stopGuestWinnerSong,
  stopAllGuestAudio,
  preloadGuestSounds,
  playRouletteBallClick,
  resumeAudio
} from '../hooks/useAudio';
import confetti from 'canvas-confetti';

// ── CONTINUOUS LUXURY CELEBRATION SPARKLES & FIREWORKS (PLAYS THROUGHOUT WINNER SCREEN) ──
let continuousSparkleInterval = null;

function startContinuousCelebration() {
  stopContinuousCelebration();
  const colors = ['#FFD700', '#FFA500', '#FF4500', '#9b5de5', '#f15bb5', '#ffffff', '#00f5d4'];

  // 1. Initial grand center burst
  confetti({
    particleCount: 85,
    spread: 130,
    origin: { x: 0.5, y: 0.4 },
    colors,
    startVelocity: 48,
    scalar: 1.15,
  });

  // 2. Dual corner fireworks
  confetti({
    particleCount: 50,
    angle: 60,
    spread: 80,
    origin: { x: 0.05, y: 0.8 },
    colors,
    startVelocity: 55,
  });
  confetti({
    particleCount: 50,
    angle: 120,
    spread: 80,
    origin: { x: 0.95, y: 0.8 },
    colors,
    startVelocity: 55,
  });

  // 3. Staggered celebratory bursts at 1.5s, 3s, 5s
  [1500, 3000, 5000].forEach((delay, idx) => {
    setTimeout(() => {
      confetti({
        particleCount: 45,
        spread: 100,
        origin: { x: idx % 2 === 0 ? 0.25 : 0.75, y: 0.35 },
        colors,
        startVelocity: 42,
        scalar: 1.1,
      });
    }, delay);
  });

  // 4. Continuous celebratory sparkles & star shower (UNENDING while on guest winning page)
  let tick = 0;
  continuousSparkleInterval = setInterval(() => {
    tick++;
    // Side corner mini-cannons alternating
    if (tick % 4 === 0) {
      confetti({
        particleCount: 20,
        angle: 60,
        spread: 55,
        origin: { x: 0.04, y: 0.82 },
        colors,
        shapes: ['star', 'circle'],
        scalar: 1.1,
      });
    } else if (tick % 4 === 2) {
      confetti({
        particleCount: 20,
        angle: 120,
        spread: 55,
        origin: { x: 0.96, y: 0.82 },
        colors,
        shapes: ['star', 'circle'],
        scalar: 1.1,
      });
    }

    // Gentle golden stars raining down across stage
    confetti({
      particleCount: 3,
      spread: 60,
      origin: { x: 0.25 + (tick % 6) * 0.1, y: 0.15 },
      colors: ['#FFD700', '#FFF8DC', '#FFA500', '#FFFFFF'],
      shapes: ['star'],
      scalar: 1.2,
      gravity: 0.85,
      ticks: 180,
    });
  }, 420);
}

function stopContinuousCelebration() {
  if (continuousSparkleInterval) {
    clearInterval(continuousSparkleInterval);
    continuousSparkleInterval = null;
  }
}

export default function RouletteWheel({
  spinning,
  guests = [],
  winningSerialNo,
  winner,
  prize,
  duration = 60000,
  soundEnabled = true,
  onFinished,
}) {
  const effectiveDuration = Math.max(60000, Number(duration) || 60000);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballAngle, setBallAngle] = useState(0);
  const [ballRadius, setBallRadius] = useState(150);
  const [isRevealed, setIsRevealed] = useState(false);
  const [countdownNum, setCountdownNum] = useState(null);
  const [revealStage, setRevealStage] = useState(0); // 0=none, 1=number, 2=name, 3=unit, 4=prize

  const animFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastTickSecRef = useRef(null);
  const hasStartedBeepRef = useRef(false);
  const hasExplodedRef = useRef(Boolean(winner));
  const targetAngleRef = useRef(0);
  const spinCompletedRef = useRef(false);

  // Prepare roulette segments from guest list (minimum 20 for full casino rotor aesthetic)
  const segments = React.useMemo(() => {
    if (!guests || guests.length === 0) {
      return Array.from({ length: 25 }, (_, i) => ({
        serialNo: i + 1,
        name: `Guest ${i + 1}`,
      }));
    }
    return guests;
  }, [guests]);

  const numSegments = segments.length;
  const segmentAngle = 360 / numSegments;

  // Find index of winning serial number
  const winIdx = React.useMemo(() => {
    if (!winningSerialNo) return 0;
    const idx = segments.findIndex(s => s.serialNo === winningSerialNo);
    return idx !== -1 ? idx : 0;
  }, [segments, winningSerialNo]);

  // ── GRAND CASINO SIZE: Responsive calculation fitting any PC screen without vertical scrolling ──
  const [windowHeight, setWindowHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
  useEffect(() => {
    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isWinnerRevealed = Boolean(isRevealed || winner);
  // Guarantee wheel fits on screen: navbar (~60px) + tabs (~45px) + header (~65px) + footer (~35px) = ~205px
  const maxWheelAvail = Math.max(260, Math.min(440, windowHeight - 215));
  const wheelSize = isWinnerRevealed ? Math.min(370, maxWheelAvail) : maxWheelAvail;
  const centerR = (wheelSize - 36) / 2;
  const pocketRadius = centerR * 0.74; // resting radius of ball in pocket

  // Keep refs for physics inside requestAnimationFrame loop
  const centerRRef = useRef(centerR);
  const pocketRadiusRef = useRef(pocketRadius);
  centerRRef.current = centerR;
  pocketRadiusRef.current = pocketRadius;

  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const isSpinActiveRef = useRef(false);
  const winIdxRef = useRef(winIdx);
  winIdxRef.current = winIdx;

  useEffect(() => {
    if (!spinning) {
      isSpinActiveRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      stopSquidGameSound();
      stopGuestCountdownBeep();

      if (winner) {
        setIsRevealed(true);
        setSecondsLeft(0);
        setCountdownNum(0);
        setRevealStage(4);
        spinCompletedRef.current = true;

        // Position ball inside the winning pocket
        const pocketCenterAngle = (winIdx + 0.5) * segmentAngle;
        const currentTarget = targetAngleRef.current || (winIdx * 43) % 360;
        const settledBallAngle = (currentTarget + pocketCenterAngle) % 360;
        setBallAngle(settledBallAngle);
        setBallRadius(pocketRadiusRef.current);

        // If not started yet (e.g. state caught on reload), start unstoppable song and continuous sparkles
        if (!hasExplodedRef.current) {
          hasExplodedRef.current = true;
          if (soundEnabledRef.current) {
            playGuestWinnerSong();
          }
          startContinuousCelebration();
        }
      } else {
        // Idle / Reverted / Reset state: immediately clear previous winner & countdown data
        setIsRevealed(false);
        setSecondsLeft(60);
        setCountdownNum(null);
        setRevealStage(0);
        spinCompletedRef.current = false;
        hasExplodedRef.current = false;
        hasStartedBeepRef.current = false;
        stopGuestWinnerSong();
        stopContinuousCelebration();
      }
      return;
    }

    // ── GUARD: If already actively spinning, NEVER restart or reset startTimeRef! ──
    if (isSpinActiveRef.current) {
      return;
    }

    isSpinActiveRef.current = true;

    // ── INITIALIZE BRAND NEW 60-SECOND SPIN ──
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    spinCompletedRef.current = false;
    setIsRevealed(false);
    setSecondsLeft(60);
    setCountdownNum(null);
    setRevealStage(0);
    lastTickSecRef.current = null;
    hasStartedBeepRef.current = false;
    hasExplodedRef.current = false;
    stopGuestWinnerSong();
    stopContinuousCelebration();
    resumeAudio();
    preloadGuestSounds();

    if (soundEnabledRef.current) {
      playSquidGameSound();
    }

    startTimeRef.current = Date.now();

    const currentWinIdx = winIdx;
    // Natural wheel rotations (14 full spins + natural angle for winning pocket)
    const totalWheelSpins = 14 * 360;
    const finalWheelTarget = totalWheelSpins + (currentWinIdx * 43) % 360;
    targetAngleRef.current = finalWheelTarget;

    // The winning pocket's center angle relative to rotor
    const pocketCenterAngle = (currentWinIdx + 0.5) * segmentAngle;
    const finalPocketAngle = (finalWheelTarget + pocketCenterAngle) % 360;

    // ── NATURAL CONTINUOUS BALL TRAJECTORY (-32 full revolutions) ──
    const totalBaseSpins = -32 * 360;
    const normTarget = ((finalPocketAngle % 360) + 360) % 360;
    // Exactly lands on finalPocketAngle at progress = 1:
    const targetBallAngle = totalBaseSpins - ((360 - normTarget) % 360);

    let lastClickTime = 0;

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(1, elapsed / 60000);
      const remainingSec = Math.max(0, Math.ceil((60000 - elapsed) / 1000));
      setSecondsLeft(remainingSec);

      // Deceleration curve for the wheel: naturally slow down from fast to very slow
      const easeProgress = 1 - Math.pow(1 - progress, 2.8);
      const currentWheelAngle = easeProgress * finalWheelTarget;
      setWheelRotation(currentWheelAngle);

      const curCenterR = centerRRef.current;
      const curPocketR = pocketRadiusRef.current;
      const outerR = curCenterR * 0.93;

      // ── NATURAL CONTINUOUS BALL MOTION (Strictly Monotonic Deceleration) ──
      // The ball moves fast initially, gradually decreases speed continuously according to time,
      // never turns back, rolls smoothly down into the pocket ring, and comes to a gentle stop.
      const easeBall = 1 - Math.pow(1 - progress, 3.25);
      const baseBallAngle = easeBall * targetBallAngle;

      // Ball Radius Physics over 60 seconds:
      // 0 - 42s (progress < 0.70): held securely on outer rim by centrifugal force
      // 42s - 52s (0.70 <= progress < 0.87): smoothly spirals down from outer rim into pocket ring
      // 52s - 60s (progress >= 0.87): rolls smoothly along pocket ring into winning pocket
      let currentR = outerR;
      if (progress >= 0.70 && progress < 0.87) {
        const dropRatio = (progress - 0.70) / 0.17; // 0 to 1
        // Smooth Hermite S-curve for inward spiral
        const smoothDrop = dropRatio * dropRatio * (3 - 2 * dropRatio);
        currentR = outerR - smoothDrop * (outerR - curPocketR);
      } else if (progress >= 0.87) {
        currentR = curPocketR;
      }
      setBallRadius(currentR);

      // Subtle realistic fret settle in final 1.5 seconds (micro-dampened forward bounce < 0.6 deg)
      let bounceOffset = 0;
      if (progress >= 0.975 && progress < 1.0) {
        const settleRatio = (progress - 0.975) / 0.025; // 0 to 1
        const damp = Math.pow(1 - settleRatio, 2);
        bounceOffset = Math.sin(settleRatio * Math.PI * 3) * 0.6 * damp;
      }

      const calculatedAngle = ((baseBallAngle + bounceOffset) % 360 + 360) % 360;
      setBallAngle(calculatedAngle);

      // Ball clatter sound only in first 45 seconds, silenced before countdown begins
      if (soundEnabledRef.current && progress < 0.75 && elapsed - lastClickTime > (progress < 0.35 ? 130 : (progress < 0.55 ? 240 : 420))) {
        playRouletteBallClick();
        lastClickTime = elapsed;
      }

      // ── LAST 10 SECONDS COUNTDOWN: 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 ──
      // Cut off squid game music and switch exclusively to clock sound
      if (remainingSec <= 10 && remainingSec > 0) {
        if (!hasStartedBeepRef.current) {
          hasStartedBeepRef.current = true;
          stopSquidGameSound();
          if (soundEnabledRef.current) {
            playGuestCountdownBeep();
          }
        }
        if (remainingSec !== lastTickSecRef.current) {
          lastTickSecRef.current = remainingSec;
          setCountdownNum(remainingSec);
        }
      }

      // ── EXACTLY AT COUNTDOWN 0: STOP CLOCK, PLAY 3 EXPLOSIONS, START UNSTOPPABLE SONG & CONTINUOUS SPARKLES ──
      if (remainingSec === 0 || progress >= 1) {
        isSpinActiveRef.current = false;
        stopSquidGameSound();
        stopGuestCountdownBeep();

        setSecondsLeft(0);
        setCountdownNum(0);
        setIsRevealed(true);
        spinCompletedRef.current = true;
        setBallAngle(finalPocketAngle);
        setBallRadius(curPocketR);

        // Suspense reveal sequencing
        setRevealStage(1); // Lucky Number
        setTimeout(() => setRevealStage(2), 700); // Name
        setTimeout(() => setRevealStage(3), 1400); // Unit
        setTimeout(() => setRevealStage(4), 2100); // Prize & Congratulations

        if (!hasExplodedRef.current) {
          hasExplodedRef.current = true;

          // Play explosion sound 3 times continuously!
          if (soundEnabledRef.current) {
            playTripleWinnerExplosion();
            // Start unstoppable song right as the winner card reveals!
            setTimeout(() => {
              if (soundEnabledRef.current) {
                playGuestWinnerSong();
              }
            }, 1200);
          }

          // Trigger continuous luxury celebration sparkles!
          startContinuousCelebration();

          if (onFinishedRef.current) onFinishedRef.current();
        }
        return;
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      stopSquidGameSound();
      stopGuestCountdownBeep();
      stopGuestWinnerSong();
      stopContinuousCelebration();
      isSpinActiveRef.current = false;
    };
  }, [spinning]);

  // Ensure full audio cleanup on component unmount (e.g. switching tabs away from guest zone)
  useEffect(() => {
    return () => {
      stopSquidGameSound();
      stopGuestCountdownBeep();
      stopGuestWinnerSong();
      stopContinuousCelebration();
      stopAllGuestAudio();
    };
  }, []);

  const getSegmentColor = (idx) => {
    if (idx % 2 === 0) return '#8B0000'; // Casino Crimson Red
    return '#141414'; // Casino Velvet Black
  };

  // ── LUXURY CASINO ROULETTE WHEEL DOM ──
  const renderWheel = () => (
    <div
      style={{
        position: 'relative',
        width: wheelSize,
        height: wheelSize,
        borderRadius: '50%',
        boxShadow: isWinnerRevealed
          ? '0 0 50px rgba(255,215,0,0.6), inset 0 0 30px rgba(0,0,0,0.85), 0 12px 35px rgba(0,0,0,0.7)'
          : '0 16px 50px rgba(0,0,0,0.65), inset 0 0 30px rgba(0,0,0,0.85), 0 0 40px rgba(212,175,55,0.45)',
        background: 'radial-gradient(circle, #3d1b06 0%, #2a1103 60%, #150801 88%, #080300 100%)',
        padding: 10,
        border: '9px solid #D4AF37',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        userSelect: 'none',
        flexShrink: 0,
        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Outer Polished Brass Ball Track & Deflection Diamond Rivets */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '6px dashed rgba(212,175,55,0.65)',
          pointerEvents: 'none',
          boxShadow: 'inset 0 0 15px rgba(0,0,0,0.8)',
        }}
      />

      {/* Spinning Wheel Rotor */}
      <div
        style={{
          position: 'absolute',
          width: wheelSize - 36,
          height: wheelSize - 36,
          borderRadius: '50%',
          transform: `rotate(${wheelRotation}deg)`,
          transition: spinning ? 'none' : 'transform 0.5s ease-out',
          boxShadow: 'inset 0 0 18px rgba(0,0,0,0.7)',
        }}
      >
        <svg
          viewBox={`0 0 ${wheelSize - 36} ${wheelSize - 36}`}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {segments.map((s, idx) => {
            const startAngle = idx * segmentAngle;
            const endAngle = (idx + 1) * segmentAngle;
            const r = (wheelSize - 36) / 2;

            const x1 = r + r * Math.cos((Math.PI * startAngle) / 180);
            const y1 = r + r * Math.sin((Math.PI * startAngle) / 180);
            const x2 = r + r * Math.cos((Math.PI * endAngle) / 180);
            const y2 = r + r * Math.sin((Math.PI * endAngle) / 180);

            const largeArcFlag = segmentAngle > 180 ? 1 : 0;
            const pathData = `M ${r} ${r} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

            const midAngle = startAngle + segmentAngle / 2;
            const textR = r * 0.74;
            const tx = r + textR * Math.cos((Math.PI * midAngle) / 180);
            const ty = r + textR * Math.sin((Math.PI * midAngle) / 180);

            const isWin = s.serialNo === winningSerialNo && isWinnerRevealed;

            return (
              <g key={s.serialNo || idx}>
                <path
                  d={pathData}
                  fill={isWin ? '#FFD700' : getSegmentColor(idx)}
                  stroke="#D4AF37"
                  strokeWidth={isWin ? '2.5' : '1'}
                />
                <text
                  x={tx}
                  y={ty}
                  fill={isWin ? '#8B0000' : '#FFD700'}
                  fontSize={numSegments > 24 ? (isWinnerRevealed ? '12' : '14') : (isWinnerRevealed ? '14' : '16')}
                  fontWeight="900"
                  fontFamily="'Arial Black', Impact, sans-serif"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${midAngle + 90}, ${tx}, ${ty})`}
                >
                  {s.serialNo}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── EXPENSIVE 3D PEARL & IVORY CASINO BALL ── */}
      {(spinning || isWinnerRevealed) && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: isWinnerRevealed ? 22 : 20,
            height: isWinnerRevealed ? 22 : 20,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 28%, #ffffff 0%, #fffef7 22%, #f0ece1 48%, #c9c0ae 75%, #7a6e5b 95%, #3d3529 100%)',
            boxShadow: isWinnerRevealed
              ? '0 0 22px #FFD700, 0 0 10px #ffffff, 0 5px 12px rgba(0,0,0,0.85), inset -2px -2px 5px rgba(0,0,0,0.4), inset 2px 2px 4px rgba(255,255,255,0.9)'
              : '0 0 16px rgba(255,255,255,0.95), 0 4px 10px rgba(0,0,0,0.8), inset -2px -2px 5px rgba(0,0,0,0.4), inset 2px 2px 4px rgba(255,255,255,0.9)',
            border: '1px solid rgba(255,255,255,0.6)',
            zIndex: 35,
            transform: `translate(-50%, -50%) rotate(${ballAngle}deg) translate(${ballRadius}px) rotate(${-ballAngle}deg)`,
            pointerEvents: 'none',
            transition: spinning ? 'none' : 'all 0.4s ease-out',
          }}
        />
      )}

      {/* ── CENTER LUXURY GOLDEN TURRET SPINDLE WITH PG LOGO ── */}
      <div
        style={{
          position: 'absolute',
          width: isWinnerRevealed ? 96 : 112,
          height: isWinnerRevealed ? 96 : 112,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 32% 28%, #FFFDE6 0%, #FFE57F 22%, #FFD700 48%, #C69214 78%, #5C4003 100%)',
          boxShadow: '0 10px 28px rgba(0,0,0,0.75), inset 0 3px 8px rgba(255,255,255,0.9), inset 0 -4px 10px rgba(50,32,1,0.85)',
          border: '3px solid #FFF8DC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30,
        }}
      >
        {/* 4-Arm Polished Brass Spinner Handles */}
        <div
          style={{
            position: 'absolute',
            width: isWinnerRevealed ? 76 : 90,
            height: 9,
            background: 'linear-gradient(180deg, #FFFDE6 0%, #FFD700 40%, #B8860B 80%, #704F00 100%)',
            borderRadius: 5,
            boxShadow: '0 3px 6px rgba(0,0,0,0.55), inset 0 1px 2px rgba(255,255,255,0.7)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            height: isWinnerRevealed ? 76 : 90,
            width: 9,
            background: 'linear-gradient(90deg, #FFFDE6 0%, #FFD700 40%, #B8860B 80%, #704F00 100%)',
            borderRadius: 5,
            boxShadow: '0 3px 6px rgba(0,0,0,0.55), inset 0 1px 2px rgba(255,255,255,0.7)',
          }}
        />

        {/* Center Medallion: Elegant Polished Gold Ring with Rounded Red PG Logo on Crisp White */}
        <div
          style={{
            position: 'relative',
            width: isWinnerRevealed ? 46 : 54,
            height: isWinnerRevealed ? 46 : 54,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFFDE6 0%, #FFD700 35%, #D4AF37 70%, #996515 100%)',
            border: '2px solid #FFF8DC',
            padding: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 32,
            boxShadow: '0 4px 12px rgba(0,0,0,0.6), inset 0 1px 3px rgba(255,255,255,0.85)',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.18)',
            }}
          >
            <img
              src="/pg-round-logo.png?v=2"
              alt="PG Logo"
              style={{
                width: '88%',
                height: '88%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ width: '100%', maxWidth: 1040, margin: '0 auto', flexShrink: 0 }}>
      {/* ── STATE 1: REVEALED WINNER (SUSPENSEFUL 2-COLUMN LUXURY STAGE) ── */}
      {isWinnerRevealed && winner ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 32,
            width: '100%',
            padding: '4px 0',
            flexWrap: 'nowrap',
          }}
        >
          {/* Column 1: Settled Casino Wheel with Ball in Pocket */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {renderWheel()}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [1, 1.03, 1],
                opacity: 1,
                boxShadow: [
                  '0 0 16px rgba(255,215,0,0.45), inset 0 0 10px rgba(255,215,0,0.2)',
                  '0 0 32px rgba(255,215,0,0.85), inset 0 0 15px rgba(255,215,0,0.4)',
                  '0 0 16px rgba(255,215,0,0.45), inset 0 0 10px rgba(255,215,0,0.2)',
                ],
              }}
              transition={{
                scale: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
                boxShadow: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
                opacity: { duration: 0.4, delay: 0.2 },
              }}
              style={{
                fontSize: 12.5,
                fontWeight: 900,
                color: '#FFD700',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                background: 'linear-gradient(90deg, rgba(74, 21, 75, 0.95) 0%, rgba(138, 43, 226, 0.45) 50%, rgba(74, 21, 75, 0.95) 100%)',
                padding: '6px 22px',
                borderRadius: 24,
                border: '2px solid #FFD700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                textShadow: '0 0 12px rgba(255,215,0,0.8)',
              }}
            >
              👑 DESTINY HAS CHOSEN • LUCKY VIP SLOT #{winner.serialNo || winningSerialNo} 👑
            </motion.div>
          </div>

          {/* Column 2: Grand Winner Card with Dramatic Suspense Reveal */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 20 }}
            style={{
              width: 'clamp(340px, 36vw, 480px)',
              maxWidth: '100%',
              background: 'linear-gradient(135deg, #2E0854 0%, #4A154B 50%, #1A002C 100%)',
              border: '3px solid #D4AF37',
              borderRadius: 22,
              padding: 'clamp(12px, 1.8vh, 20px) clamp(16px, 2vw, 28px)',
              textAlign: 'center',
              boxShadow: '0 0 60px rgba(212,175,55,0.45), 0 16px 40px rgba(0,0,0,0.5)',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {/* Top Badge */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                display: 'inline-block',
                background: 'linear-gradient(90deg, #FFD700, #FFA500)',
                color: '#2E0854',
                fontWeight: 900,
                fontSize: 'clamp(9.5px, 1.2vh, 11px)',
                letterSpacing: 1.5,
                padding: '3px 16px',
                borderRadius: 14,
                textTransform: 'uppercase',
                marginBottom: 6,
                boxShadow: '0 2px 8px rgba(255,215,0,0.4)',
              }}
            >
              👑 VIP GUEST LUCKY DRAW WINNER 👑
            </motion.div>

            {/* Lucky Number (Reveals first) */}
            <div style={{ fontSize: 'clamp(10px, 1.3vh, 12px)', color: '#e0c3fc', fontWeight: 700, letterSpacing: 1 }}>
              LUCKY NUMBER / SERIAL NO.
            </div>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [1, 1.08, 1], opacity: 1 }}
              transition={{ duration: 0.8 }}
              style={{
                fontSize: 'clamp(38px, 6vh, 56px)',
                fontWeight: 900,
                fontFamily: 'Impact, Arial Black, sans-serif',
                background: 'linear-gradient(135deg, #FFF8DC 0%, #FFD700 50%, #FFA500 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1,
                margin: '2px 0 6px',
                letterSpacing: 2,
                textShadow: '0 0 20px rgba(255,215,0,0.6)',
              }}
            >
              #{winner.serialNo || winningSerialNo}
            </motion.div>

            {/* Suspenseful Winner Name Reveal */}
            <AnimatePresence>
              {(revealStage >= 2 || !spinning) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  style={{
                    fontSize: 'clamp(18px, 3vh, 26px)',
                    fontWeight: 900,
                    fontFamily: 'Georgia, serif',
                    color: '#ffffff',
                    marginBottom: 6,
                    lineHeight: 1.2,
                    textShadow: '0 2px 8px rgba(0,0,0,0.6)',
                  }}
                >
                  {winner.name}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Suspenseful Winner Unit Reveal */}
            <AnimatePresence>
              {(revealStage >= 3 || !spinning) && winner.unit && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  style={{ marginBottom: 12 }}
                >
                  <span
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: '1.5px solid #FFD700',
                      borderRadius: 16,
                      padding: '5px 20px',
                      fontSize: 15,
                      fontWeight: 800,
                      color: '#FFD700',
                      display: 'inline-block',
                      boxShadow: '0 0 15px rgba(255,215,0,0.25)',
                    }}
                  >
                    🏭 Unit: <b>{winner.unit}</b>
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Suspenseful Prize Reveal */}
            <AnimatePresence>
              {(revealStage >= 4 || !spinning) && prize && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  style={{
                    background: 'linear-gradient(135deg, #7B1FA2 0%, #4A148C 100%)',
                    borderRadius: 14,
                    padding: '12px 18px',
                    marginTop: 6,
                    border: '1.5px solid #FFD700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 14,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  }}
                >
                  {prize.imageUrl && (
                    <img
                      src={prize.imageUrl}
                      alt={prize.name}
                      style={{ height: 48, maxWidth: 65, objectFit: 'contain', borderRadius: 6, border: '1px solid #FFD700' }}
                    />
                  )}
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ color: '#FFD700', fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                      🎁 WON PRIZE
                    </div>
                    <div style={{ color: '#fff', fontSize: 17, fontWeight: 900, lineHeight: 1.2 }}>
                      {prize.name}
                    </div>
                    {prize.description && (
                      <div style={{ color: '#e0c3fc', fontSize: 12, marginTop: 2 }}>
                        {prize.description}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              style={{ marginTop: 12, color: '#FFD700', fontSize: 12, fontWeight: 800, letterSpacing: 1 }}
            >
              ✨ HEARTIEST CONGRATULATIONS! ✨
            </motion.div>
          </motion.div>
        </div>
      ) : (
        /* ── STATE 2: SPINNING OR IDLE (CENTERED SINGLE SCREEN LAYOUT) ── */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
          {/* Status & Countdown Area:
              NOTE: As requested, the spinning 28s banner is completely REMOVED!
              Only the high-suspense COUNTDOWN is shown during the last 10 seconds! */}
          <div
            style={{
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              margin: '2px 0 8px',
            }}
          >
            {spinning ? (
              /* Only show during the final 10 seconds countdown (10, 9, ... 0) */
              secondsLeft <= 10 && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    background: 'linear-gradient(90deg, #1A002C, #4A0E17, #1A002C)',
                    padding: '6px 32px',
                    borderRadius: 26,
                    border: '2.5px solid #FFD700',
                    boxShadow: '0 0 30px rgba(255, 215, 0, 0.85)',
                  }}
                >
                  <span style={{ fontSize: 14, color: '#FFD700', fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase' }}>
                    ⚡ COUNTDOWN:
                  </span>
                  <span
                    style={{
                      fontSize: 34,
                      fontWeight: 900,
                      fontFamily: 'Impact, Arial Black, sans-serif',
                      color: secondsLeft === 0 ? '#52c41a' : '#FFD700',
                      textShadow: '0 0 20px rgba(255,215,0,0.95)',
                      minWidth: 32,
                      textAlign: 'center',
                      display: 'inline-block',
                      lineHeight: 1,
                    }}
                  >
                    {secondsLeft}
                  </span>
                </motion.div>
              )
            ) : (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                  color: '#FFD700',
                  background: 'rgba(255, 215, 0, 0.12)',
                  padding: '6px 26px',
                  borderRadius: 24,
                  border: '1.5px solid rgba(255, 215, 0, 0.35)',
                  textTransform: 'uppercase',
                }}
              >
                ✨ VIP GUEST HONORED DRAW • 1 LUCKY WINNER ROUND ✨
              </div>
            )}
          </div>

          {/* Centered Large Roulette Wheel */}
          {renderWheel()}
        </div>
      )}
    </div>
  );
}
