import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  playSquidGameSound,
  stopSquidGameSound,
  playGuestCountdownBeep,
  stopGuestCountdownBeep,
  playTripleWinnerExplosion,
  stopAllGuestAudio,
  preloadGuestSounds,
  playRouletteBallClick,
  resumeAudio
} from '../hooks/useAudio';
import confetti from 'canvas-confetti';

// ── Multi-stage luxury celebration sparkle & fireworks explosion (10 full seconds) ──
function fireGrandCelebration() {
  const colors = ['#FFD700', '#FFA500', '#FF4500', '#9b5de5', '#f15bb5', '#ffffff', '#00f5d4'];

  // 1. Initial grand center burst
  confetti({
    particleCount: 80,
    spread: 120,
    origin: { x: 0.5, y: 0.4 },
    colors,
    startVelocity: 45,
    scalar: 1.15,
  });

  // 2. Dual corner fireworks
  confetti({
    particleCount: 50,
    angle: 60,
    spread: 75,
    origin: { x: 0.05, y: 0.8 },
    colors,
    startVelocity: 55,
  });
  confetti({
    particleCount: 50,
    angle: 120,
    spread: 75,
    origin: { x: 0.95, y: 0.8 },
    colors,
    startVelocity: 55,
  });

  // 3. Staggered celebratory bursts at 2s, 4s, 6s, 8s
  [2000, 4000, 6000, 8000].forEach((delay, idx) => {
    setTimeout(() => {
      confetti({
        particleCount: 45,
        spread: 100,
        origin: { x: idx % 2 === 0 ? 0.2 : 0.8, y: 0.35 },
        colors,
        startVelocity: 42,
        scalar: 1.1,
      });
    }, delay);
  });

  // 4. Elegant 10-second perimeter golden sparkle shower (throttled every 250ms for clear visibility)
  const showerInterval = setInterval(() => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 60,
      origin: { x: 0.04, y: 0.82 },
      colors,
      shapes: ['star', 'circle'],
      scalar: 1.1,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 60,
      origin: { x: 0.96, y: 0.82 },
      colors,
      shapes: ['star', 'circle'],
      scalar: 1.1,
    });
    confetti({
      particleCount: 3,
      spread: 70,
      origin: { x: 0.5, y: 0.15 },
      colors: ['#FFD700', '#FFF8DC', '#FFA500'],
      shapes: ['star'],
      scalar: 1.2,
    });
  }, 260);

  setTimeout(() => {
    clearInterval(showerInterval);
  }, 10000);
}

export default function RouletteWheel({
  spinning,
  guests = [],
  winningSerialNo,
  winner,
  prize,
  duration = 30000,
  soundEnabled = true,
  onFinished,
}) {
  const [secondsLeft, setSecondsLeft] = useState(30);
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

  // ── GRAND CASINO SIZE: Visible and bigger on screen ──
  // 460px when centered/spinning, 390px when side-by-side with winner card
  const isWinnerRevealed = Boolean(isRevealed || winner);
  const wheelSize = isWinnerRevealed ? 390 : 460;
  const centerR = (wheelSize - 36) / 2;
  const pocketRadius = centerR * 0.74; // resting radius of ball in pocket

  // Keep refs for physics inside requestAnimationFrame loop
  const centerRRef = useRef(centerR);
  const pocketRadiusRef = useRef(pocketRadius);
  centerRRef.current = centerR;
  pocketRadiusRef.current = pocketRadius;

  useEffect(() => {
    if (!spinning) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      stopSquidGameSound();
      stopGuestCountdownBeep();

      if (winner) {
        setIsRevealed(true);
        setSecondsLeft(0);
        setRevealStage(4);
        spinCompletedRef.current = true;

        // Position ball inside the winning pocket
        const pocketCenterAngle = (winIdx + 0.5) * segmentAngle;
        const currentTarget = targetAngleRef.current || (winIdx * 43) % 360;
        const settledBallAngle = (currentTarget + pocketCenterAngle) % 360;
        setBallAngle(settledBallAngle);
        setBallRadius(pocketRadiusRef.current);

        // If not exploded yet (e.g. state caught on reload), play triple explosion
        if (!hasExplodedRef.current) {
          hasExplodedRef.current = true;
          if (soundEnabled) {
            playTripleWinnerExplosion(() => stopAllGuestAudio());
          }
          fireGrandCelebration();
        }
      }
      return;
    }

    // If this spin already completed its full cycle, do NOT re-run!
    if (spinCompletedRef.current) return;

    // ── INITIALIZE BRAND NEW SPIN ──
    setIsRevealed(false);
    setSecondsLeft(30);
    setCountdownNum(null);
    setRevealStage(0);
    lastTickSecRef.current = null;
    hasStartedBeepRef.current = false;
    hasExplodedRef.current = false;
    resumeAudio();
    preloadGuestSounds();

    if (soundEnabled) {
      playSquidGameSound();
    }

    startTimeRef.current = Date.now();

    // Natural wheel rotations (7 full spins + natural angle)
    const totalWheelSpins = 7 * 360;
    const finalWheelTarget = totalWheelSpins + (winIdx * 43) % 360;
    targetAngleRef.current = finalWheelTarget;

    // The winning pocket's center angle relative to rotor
    const pocketCenterAngle = (winIdx + 0.5) * segmentAngle;
    const finalPocketAngle = (finalWheelTarget + pocketCenterAngle) % 360;

    let lastClickTime = 0;

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(1, elapsed / duration);
      const remainingSec = Math.max(0, Math.ceil((duration - elapsed) / 1000));
      setSecondsLeft(remainingSec);

      // Deceleration curve for the wheel
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentWheelAngle = easeProgress * finalWheelTarget;
      setWheelRotation(currentWheelAngle);

      const curCenterR = centerRRef.current;
      const curPocketR = pocketRadiusRef.current;

      // Ball physics:
      // In first 20s (progress < 0.67), ball spins rapidly in counter direction around outer rim
      // In last 10s (progress >= 0.67), ball spirals inward and locks into finalPocketAngle
      if (progress < 0.67) {
        const ballSpeedProgress = progress / 0.67;
        const currentBallAngle = -16 * 360 * Math.pow(ballSpeedProgress, 1.2);
        setBallAngle(currentBallAngle % 360);
        setBallRadius(curCenterR * 0.93);
      } else {
        const settleProgress = (progress - 0.67) / 0.33; // 0 to 1
        const easedSettle = 1 - Math.pow(1 - settleProgress, 2.5);

        // Gradually interpolate ball angle toward the exact winning pocket
        const startDropAngle = -16 * 360;
        const targetRotations = Math.floor(startDropAngle / 360) * 360;
        const targetAngle = targetRotations + finalPocketAngle;
        const currentAngle = startDropAngle + easedSettle * (targetAngle - startDropAngle);

        setBallAngle(currentAngle % 360);

        // Interpolate radius from outer rim to pocket
        const currentR = (curCenterR * 0.93) - easedSettle * ((curCenterR * 0.93) - curPocketR);
        setBallRadius(currentR);
      }

      // Ball clatter sound during spin
      if (soundEnabled && elapsed - lastClickTime > (progress < 0.7 ? 130 : 320) && progress < 0.88) {
        playRouletteBallClick();
        lastClickTime = elapsed;
      }

      // ── LAST 10 SECONDS COUNTDOWN: 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 ──
      // Cut off squid game music and switch exclusively to counting beep sound
      if (remainingSec <= 10 && remainingSec > 0) {
        if (!hasStartedBeepRef.current) {
          hasStartedBeepRef.current = true;
          stopSquidGameSound();
          if (soundEnabled) {
            playGuestCountdownBeep();
          }
        }
        if (remainingSec !== lastTickSecRef.current) {
          lastTickSecRef.current = remainingSec;
          setCountdownNum(remainingSec);
        }
      }

      // ── EXACTLY AT COUNTDOWN 0: STOP ALL MUSIC, PLAY 3 EXPLOSIONS, REVEAL WINNER SUSPENSEFULLY ──
      if (remainingSec === 0 || progress >= 1) {
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

          // Play explosion sound 3 times continuously as requested!
          if (soundEnabled) {
            playTripleWinnerExplosion(() => stopAllGuestAudio());
          }

          // Trigger 10 seconds of high-density celebration sparkles!
          fireGrandCelebration();

          if (onFinished) onFinished();
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
      stopAllGuestAudio();
    };
  }, [spinning, duration, winIdx, segmentAngle, soundEnabled, onFinished]);

  // Ensure full audio cleanup on component unmount (e.g. switching tabs away from guest zone)
  useEffect(() => {
    return () => {
      stopSquidGameSound();
      stopGuestCountdownBeep();
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

      {/* ── CENTER GOLDEN TURRET SPINDLE (Luxury 3D Spindle with Diamond Accents) ── */}
      <div
        style={{
          position: 'absolute',
          width: isWinnerRevealed ? 88 : 102,
          height: isWinnerRevealed ? 88 : 102,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #FFF8DC 0%, #FFD700 45%, #B8860B 80%, #5a4205 100%)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.65), inset 0 2px 6px rgba(255,255,255,0.85)',
          border: '3px solid #FFF8DC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30,
        }}
      >
        <div style={{ position: 'absolute', width: isWinnerRevealed ? 62 : 76, height: 7, background: '#FFD700', borderRadius: 4, boxShadow: '0 2px 4px rgba(0,0,0,0.4)' }} />
        <div style={{ position: 'absolute', height: isWinnerRevealed ? 62 : 76, width: 7, background: '#FFD700', borderRadius: 4, boxShadow: '0 2px 4px rgba(0,0,0,0.4)' }} />
        <div
          style={{
            width: isWinnerRevealed ? 34 : 40,
            height: isWinnerRevealed ? 34 : 40,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #7B1FA2 0%, #4A148C 60%, #1A002C 100%)',
            border: '2.5px solid #FFD700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFD700',
            fontSize: isWinnerRevealed ? 16 : 19,
            zIndex: 32,
            boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4), 0 2px 6px rgba(0,0,0,0.5)',
          }}
        >
          👑
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
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: '#FFD700',
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                background: 'rgba(255,215,0,0.15)',
                padding: '4px 16px',
                borderRadius: 20,
                border: '1.5px solid rgba(255,215,0,0.4)',
                boxShadow: '0 0 15px rgba(255,215,0,0.3)',
              }}
            >
              🎯 Ball Settled on Slot #{winner.serialNo || winningSerialNo}
            </motion.div>
          </div>

          {/* Column 2: Grand Winner Card with Dramatic Suspense Reveal */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 20 }}
            style={{
              width: 500,
              maxWidth: '100%',
              background: 'linear-gradient(135deg, #2E0854 0%, #4A154B 50%, #1A002C 100%)',
              border: '3px solid #D4AF37',
              borderRadius: 22,
              padding: '20px 28px',
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
                fontSize: 11,
                letterSpacing: 1.5,
                padding: '4px 18px',
                borderRadius: 14,
                textTransform: 'uppercase',
                marginBottom: 10,
                boxShadow: '0 2px 8px rgba(255,215,0,0.4)',
              }}
            >
              👑 VIP GUEST LUCKY DRAW WINNER 👑
            </motion.div>

            {/* Lucky Number (Reveals first) */}
            <div style={{ fontSize: 12, color: '#e0c3fc', fontWeight: 700, letterSpacing: 1 }}>
              LUCKY NUMBER / SERIAL NO.
            </div>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [1, 1.08, 1], opacity: 1 }}
              transition={{ duration: 0.8 }}
              style={{
                fontSize: 58,
                fontWeight: 900,
                fontFamily: 'Impact, Arial Black, sans-serif',
                background: 'linear-gradient(135deg, #FFF8DC 0%, #FFD700 50%, #FFA500 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1,
                margin: '2px 0 8px',
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
                    fontSize: 26,
                    fontWeight: 900,
                    fontFamily: 'Georgia, serif',
                    color: '#ffffff',
                    marginBottom: 8,
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
