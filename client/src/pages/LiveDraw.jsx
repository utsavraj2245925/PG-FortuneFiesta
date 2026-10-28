import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../hooks/useSocket';
import {
  playDrumRoll,
  playWinnerFanfare,
  playGameStartSound,
  resumeAudio,
  playEmpSong,
  stopEmpSong,
  preloadEmpSounds,
  playHallOfFameSong,
  stopHallOfFameSong,
  preloadHallOfFameSound,
  stopSquidGameSound,
  playWinnerExplosion,
  stopAllAudio,
  playClockTick,
  setAudioMuted,
} from '../hooks/useAudio';
import confetti from 'canvas-confetti';
import { Trophy, Crown, Gift, Sparkles } from 'lucide-react';
import RouletteWheel from '../components/RouletteWheel';

const LOGO_PG = 'https://cms-complaint-avidence.s3.eu-north-1.amazonaws.com/pg-logo-Photoroom.png';
const LOGO_ONLY = 'https://cms-complaint-avidence.s3.eu-north-1.amazonaws.com/pg-logo-Photoroom+(1).png';

const GROUP_LABELS = { 1: 'Group A', 2: 'Group B', 3: 'Group C' };
const GROUP_COLORS = { 1: '#3b82f6', 2: '#8b5cf6', 3: '#10b981' };
const GROUP_BG = { 1: '#eff6ff', 2: '#f5f3ff', 3: '#ecfdf5' };

const ROUND_LABELS = {
  1: '1A',
  2: '1B',
  3: '1C',
  4: '2A',
  5: '2B',
  6: '2C',
  7: '3A',
  8: '3B',
  9: '3C',
};

function roundToGroup(r) {
  if (r <= 3) return 1;
  if (r <= 6) return 2;
  return 3;
}

function fireConfetti() {
  const end = Date.now() + 5000;
  const colors = ['#C8102E', '#D4AF37', '#FFD700', '#FF6B6B', '#4ECDC4', '#52c41a'];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 65, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 65, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

// 10-Second High-Octane Slot Drum Animation with Fast 6-Digit Shuffle & Suspense Deceleration on Last 4 Digits
function SlotDrum({ spinning, winnerCode, sampleCodes, soundEnabled = true, onCountdownZero }) {
  const [chars, setChars] = useState(Array(8).fill('?'));
  const [secondsLeft, setSecondsLeft] = useState(10);
  const animTimeoutRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const lastTickSecRef = useRef(null);
  const hasExplodedRef = useRef(false);

  // Extract authentic prefixes and patterns from database sample codes
  const { prefixes, samplePool } = React.useMemo(() => {
    const defaultPrefixes = ['PG', 'PT'];
    const codes = (sampleCodes && sampleCodes.length > 0)
      ? sampleCodes
      : ['PG100086', 'PG100277', 'PT200016', 'PT200034', 'PG400003', 'PG300017', 'PT200042', 'PT200066'];

    const prefSet = new Set();
    codes.forEach(c => {
      if (c && c.length >= 2) prefSet.add(c.slice(0, 2).toUpperCase());
    });
    return {
      prefixes: prefSet.size > 0 ? Array.from(prefSet) : defaultPrefixes,
      samplePool: codes,
    };
  }, [sampleCodes]);

  useEffect(() => {
    if (!spinning) {
      clearTimeout(animTimeoutRef.current);
      clearInterval(timerIntervalRef.current);
      if (winnerCode) {
        setChars(winnerCode.padEnd(8, ' ').slice(0, 8).split(''));
      }
      return;
    }

    // Reset countdown and explosion state
    setSecondsLeft(10);
    hasExplodedRef.current = false;
    lastTickSecRef.current = null;
    preloadEmpSounds();

    const startT = Date.now();
    const duration = 10000;

    // Pick stable prefix & leading 2 digits for settling phase
    const samplePick = samplePool[Math.floor(Math.random() * samplePool.length)] || 'PG400003';
    const settledPrefix = samplePick.slice(0, 2);
    const settledFirst2Digits = samplePick.slice(2, 4);

    // Precise 100ms ticker for remaining countdown
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startT;
      const remainingSec = Math.max(0, Math.ceil((duration - elapsed) / 1000));
      setSecondsLeft(remainingSec);

      // Audio cue at countdown ticks 3, 2, 1
      if (remainingSec <= 3 && remainingSec > 0 && remainingSec !== lastTickSecRef.current) {
        lastTickSecRef.current = remainingSec;
        if (soundEnabled) {
          playClockTick(remainingSec);
        }
      }

      // Exactly at 0s: EMP Song stops, instant explosion sound triggers!
      if (remainingSec === 0 && !hasExplodedRef.current) {
        hasExplodedRef.current = true;
        stopEmpSong();
        if (soundEnabled) {
          playWinnerExplosion();
        }
        if (onCountdownZero) onCountdownZero();
      }
    }, 100);

    // Fast-shuffle & deceleration animation loop
    const stepAnimation = () => {
      const elapsed = Date.now() - startT;
      const remainingSec = Math.max(0, Math.ceil((duration - elapsed) / 1000));

      if (elapsed >= duration || remainingSec === 0) {
        if (winnerCode) {
          setChars(winnerCode.padEnd(8, ' ').slice(0, 8).split(''));
        }
        return;
      }

      // ── PHASE 1: ULTRA-FAST SHUFFLE OF ALL 6 DIGITS (Seconds 10 down to > 3s) ──
      if (remainingSec > 3) {
        const curPref = prefixes[Math.floor(Math.random() * prefixes.length)] || 'PG';
        // All 6 numeric digits generate random numbers independently at high speed
        const d1 = Math.floor(Math.random() * 10);
        const d2 = Math.floor(Math.random() * 10);
        const d3 = Math.floor(Math.random() * 10);
        const d4 = Math.floor(Math.random() * 10);
        const d5 = Math.floor(Math.random() * 10);
        const d6 = Math.floor(Math.random() * 10);

        setChars([curPref[0], curPref[1], String(d1), String(d2), String(d3), String(d4), String(d5), String(d6)]);
        // Super rapid cycle: 35ms
        animTimeoutRef.current = setTimeout(stepAnimation, 35);
      } 
      // ── PHASE 2: SUSPENSE SLOWDOWN OF LAST 4 DIGITS (Seconds 3, 2, 1, 0) ──
      else {
        // Prefix and first 2 digits are stabilized
        const p0 = settledPrefix[0] || 'P';
        const p1 = settledPrefix[1] || 'T';
        const d1 = settledFirst2Digits[0] || '2';
        const d2 = settledFirst2Digits[1] || '0';

        // Last 4 digits change slowly based on remaining seconds
        const d3 = Math.floor(Math.random() * 10);
        const d4 = Math.floor(Math.random() * 10);
        const d5 = Math.floor(Math.random() * 10);
        const d6 = Math.floor(Math.random() * 10);

        setChars([p0, p1, d1, d2, String(d3), String(d4), String(d5), String(d6)]);

        // Progressive deceleration: 3s -> 140ms, 2s -> 260ms, 1s -> 480ms
        const delay = remainingSec === 3 ? 140 : remainingSec === 2 ? 260 : 480;
        animTimeoutRef.current = setTimeout(stepAnimation, delay);
      }
    };

    stepAnimation();

    return () => {
      clearTimeout(animTimeoutRef.current);
      clearInterval(timerIntervalRef.current);
    };
  }, [spinning, winnerCode, samplePool, prefixes, soundEnabled, onCountdownZero]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {/* Fixed-Height (40px) Status & Countdown Banner — Absolute ZERO vertical layout shift! */}
      <div
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {spinning ? (
          secondsLeft > 3 ? (
            <motion.div
              animate={{ scale: [1, 1.03, 1], opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: '#C8102E',
                letterSpacing: 2,
                background: '#fff0f0',
                padding: '5px 22px',
                borderRadius: 24,
                border: '2px solid #C8102E',
                boxShadow: '0 3px 12px rgba(200, 16, 46, 0.2)',
                textTransform: 'uppercase',
              }}
            >
              ⏱️ DRAWING WINNER... {secondsLeft}s
            </motion.div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'linear-gradient(90deg, #8b0000, #C8102E, #8b0000)',
                padding: '4px 26px',
                borderRadius: 24,
                border: '2.5px solid #FFD700',
                boxShadow: '0 0 25px rgba(255, 215, 0, 0.75), 0 0 15px rgba(200, 16, 46, 0.6)',
              }}
            >
              <span style={{ fontSize: 13, color: '#FFD700', fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                ⚡ COUNTDOWN:
              </span>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  fontFamily: 'Impact, Arial Black, sans-serif',
                  color: secondsLeft === 0 ? '#52c41a' : '#FFD700',
                  textShadow: '0 0 14px rgba(255,215,0,0.95)',
                  minWidth: 22,
                  textAlign: 'center',
                  lineHeight: 1,
                }}
              >
                {secondsLeft}
              </span>
            </div>
          )
        ) : (
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 1.5,
              color: '#8b0000',
              background: 'rgba(200, 16, 46, 0.08)',
              padding: '4px 20px',
              borderRadius: 24,
              border: '1.5px solid rgba(200, 16, 46, 0.25)',
              textTransform: 'uppercase',
            }}
          >
            🎰 EMPLOYEE LUCKY DRAW REEL
          </div>
        )}
      </div>

      {/* Futuristic Slot Drum Reel for Employee Code */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'center',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.9)',
          padding: '16px 24px',
          borderRadius: 20,
          boxShadow: '0 12px 36px rgba(200,16,46,0.18)',
          border: '2.5px solid #D4AF37',
        }}
      >
        {chars.map((char, i) => {
          // Highlight last 4 digits during countdown suspense phase (i >= 4)
          const isSuspenseDigit = spinning && secondsLeft <= 3 && i >= 4;
          return (
            <motion.div
              key={i}
              animate={
                spinning
                  ? isSuspenseDigit
                    ? { y: [-3, 3, -3], scale: [1, 1.05, 1] }
                    : { y: [-6, 6, -6], scale: [1, 1.03, 1] }
                  : { y: 0, scale: [1, 1.05, 1] }
              }
              transition={
                spinning
                  ? { duration: isSuspenseDigit ? 0.25 : 0.1, repeat: Infinity, delay: i * 0.015 }
                  : { duration: 0.4 }
              }
              style={{
                width: 56,
                height: 76,
                borderRadius: 10,
                background: isSuspenseDigit
                  ? 'linear-gradient(180deg, #A0001E 0%, #680000 100%)'
                  : 'linear-gradient(180deg, #C8102E 0%, #8b0000 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isSuspenseDigit
                  ? '0 0 18px rgba(255,215,0,0.6), inset 0 2px 6px rgba(255,255,255,0.6)'
                  : '0 6px 18px rgba(200,16,46,0.3), inset 0 2px 4px rgba(255,255,255,0.4)',
                border: isSuspenseDigit ? '2.5px solid #FFD700' : '2px solid #FFD700',
                filter: spinning && !isSuspenseDigit ? 'blur(0.3px)' : 'none',
              }}
            >
              <span
                style={{
                  fontSize: 38,
                  fontWeight: 900,
                  color: isSuspenseDigit ? '#FFD700' : '#fff',
                  fontFamily: 'Impact, Arial Black, sans-serif',
                  letterSpacing: 1,
                  textShadow: isSuspenseDigit ? '0 0 10px rgba(255,215,0,0.8)' : '0 2px 6px rgba(0,0,0,0.4)',
                }}
              >
                {char}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// Progress tracker across all 9 rounds
function ProgressTracker({ currentRound, prevWinners }) {
  const completedRounds = prevWinners.length;
  const currentGroup = roundToGroup(currentRound);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
        {Array.from({ length: 9 }, (_, i) => {
          const r = i + 1;
          const won = prevWinners.find(w => w.roundNo === r);
          const isActive = r === currentRound;
          const status = won ? 'done' : isActive ? 'active' : 'pending';

          return (
            <React.Fragment key={r}>
              <motion.div
                animate={isActive ? { scale: [1, 1.1, 1], boxShadow: ['0 0 0px #C8102E', '0 0 12px #C8102E', '0 0 0px #C8102E'] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 900,
                  background: status === 'done' ? '#52c41a' : status === 'active' ? '#C8102E' : '#e5e7eb',
                  color: status === 'pending' ? '#9ca3af' : '#fff',
                  border: `2px solid ${status === 'done' ? '#389e0d' : status === 'active' ? '#C8102E' : '#d1d5db'}`,
                  zIndex: 2,
                  cursor: 'default',
                  letterSpacing: 0.5,
                }}
                title={won ? `Round ${ROUND_LABELS[r]} - ${won.winnerNumber} - ${won.prize?.name || ''}` : `Round ${ROUND_LABELS[r]}`}
              >
                {status === 'done' ? '✓' : ROUND_LABELS[r]}
              </motion.div>
              {r < 9 && (
                <div
                  style={{
                    width: 28,
                    height: 3,
                    background: r < currentRound ? '#52c41a' : r === currentRound ? '#C8102E' : '#e5e7eb',
                    transition: 'background 0.5s ease',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', fontSize: 13, color: '#666', fontWeight: 600 }}>
        Round <b style={{ color: '#C8102E' }}>{ROUND_LABELS[currentRound]}</b> of 9 &nbsp;|&nbsp; <span style={{ color: GROUP_COLORS[currentGroup] }}>{GROUP_LABELS[currentGroup]}</span> &nbsp;|&nbsp; {completedRounds} Drawn, {9 - completedRounds} Remaining
      </div>
    </div>
  );
}

// Continuous floating sparkles & stars effect across the whole section
function ContinuousSparkles() {
  const stars = React.useMemo(() => {
    return Array.from({ length: 45 }, (_, i) => ({
      id: i,
      left: `${(i * 2.3 + (i % 7) * 4.1) % 96 + 2}%`,
      top: `${(i * 3.1 + (i % 5) * 6.3) % 94 + 2}%`,
      size: (i % 3 === 0) ? 18 : (i % 3 === 1) ? 13 : 9,
      duration: 1.8 + (i % 5) * 0.5,
      delay: (i % 7) * 0.35,
      char: (i % 4 === 0) ? '✨' : (i % 4 === 1) ? '★' : (i % 4 === 2) ? '✦' : '⭐',
      color: (i % 2 === 0) ? '#FFD700' : '#FFF3B0',
    }));
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 1 }}>
      {stars.map(s => (
        <motion.div
          key={s.id}
          initial={{ opacity: 0.15, scale: 0.7 }}
          animate={{
            opacity: [0.15, 0.95, 0.25, 1, 0.15],
            scale: [0.8, 1.25, 0.85, 1.3, 0.8],
            y: [-4, 6, -5, 4, -4],
          }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            position: 'absolute',
            left: s.left,
            top: s.top,
            fontSize: s.size,
            color: s.color,
            textShadow: '0 0 10px rgba(255,215,0,0.85), 0 0 22px rgba(255,215,0,0.4)',
            userSelect: 'none',
          }}
        >
          {s.char}
        </motion.div>
      ))}
    </div>
  );
}

// ── PG FORTUNE FIESTA WINNERS CEREMONY DISPLAY ──
function FiestaWinnersDisplay({ prevWinners = [], guestWinner, guestPrize }) {
  const groupA = [1, 2, 3].map(r => prevWinners.find(w => w.roundNo === r) || { roundNo: r, group: 1 });
  const groupB = [4, 5, 6].map(r => prevWinners.find(w => w.roundNo === r) || { roundNo: r, group: 2 });
  const groupC = [7, 8, 9].map(r => prevWinners.find(w => w.roundNo === r) || { roundNo: r, group: 3 });

  const renderEmpCard = (item) => {
    const isDrawn = Boolean(item.winnerNumber || item.employee);
    const grpColor = GROUP_COLORS[item.group] || '#3b82f6';

    return (
      <div
        key={item.roundNo}
        style={{
          background: isDrawn
            ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)'
            : 'rgba(255, 255, 255, 0.03)',
          border: isDrawn ? `1.5px solid ${grpColor}` : '1.5px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: 12,
          padding: '10px 14px',
          boxShadow: isDrawn ? `0 4px 14px ${grpColor}33` : 'none',
          transition: 'all 0.3s',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              background: grpColor,
              color: '#fff',
              fontSize: 10.5,
              fontWeight: 900,
              padding: '2px 8px',
              borderRadius: 4,
              letterSpacing: 0.5,
            }}
          >
            ROUND {ROUND_LABELS[item.roundNo]}
          </span>

          {isDrawn ? (
            <span style={{ color: '#FFD700', fontWeight: 900, fontSize: 13, letterSpacing: 0.5 }}>
              #{item.winnerNumber || item.employeeCode || item.employee?.payCode}
            </span>
          ) : (
            <span style={{ color: '#94a3b8', fontSize: 11, fontStyle: 'italic' }}>Pending Draw</span>
          )}
        </div>

        {isDrawn ? (
          <>
            <div style={{ color: '#ffffff', fontWeight: 800, fontSize: 15, lineHeight: 1.25, marginTop: 2 }}>
              {item.employee?.name || 'Winner'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11.5, color: '#cbd5e1' }}>
              <span>🏭 {item.employee?.unit || 'PGTL'}</span>
              <span>•</span>
              <span>🏢 {item.employee?.department || '—'}</span>
            </div>
            {item.prize?.name && (
              <div
                style={{
                  marginTop: 3,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'rgba(212, 175, 55, 0.15)',
                  border: '1px solid rgba(212, 175, 55, 0.4)',
                  color: '#FFD700',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Gift size={12} style={{ color: '#FFD700' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.prize.name} {item.prize.description && `(${item.prize.description})`}
                </span>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: '#64748b', fontSize: 12, padding: '8px 0', textAlign: 'center', fontStyle: 'italic' }}>
            ⏳ Round {ROUND_LABELS[item.roundNo]} Drawing Soon
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        position: 'relative',
        padding: '2px 14px 10px',
        overflowY: 'auto',
      }}
    >
      <ContinuousSparkles />

      {/* ── HEADING ── */}
      <div style={{ textAlign: 'center', marginBottom: 10, position: 'relative', zIndex: 2, flexShrink: 0 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255, 215, 0, 0.14)',
            border: '1.5px solid rgba(255, 215, 0, 0.5)',
            padding: '3px 18px',
            borderRadius: 30,
            marginBottom: 4,
          }}
        >
          <Sparkles size={15} style={{ color: '#FFD700' }} />
          <span style={{ color: '#FFD700', fontSize: 12.5, fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            ✦ Grand Lucky Draw Champions 2026 ✦
          </span>
          <Sparkles size={15} style={{ color: '#FFD700' }} />
        </div>

        <motion.h1
          animate={{ scale: [1, 1.018, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            margin: 0,
            fontSize: 'clamp(24px, 3.4vw, 38px)',
            fontWeight: 950,
            letterSpacing: 2,
            fontFamily: 'Georgia, serif',
            background: 'linear-gradient(135deg, #FFD700 0%, #FFF5D0 35%, #D4AF37 70%, #FFDF73 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 24px rgba(255, 215, 0, 0.6))',
            lineHeight: 1.15,
          }}
        >
          👑 PG - FORTUNE FIESTA WINNERS 👑
        </motion.h1>

        <div style={{ fontSize: 13, color: '#fbcfe8', fontWeight: 700, letterSpacing: 0.8, marginTop: 2 }}>
          ✨ Heartiest Congratulations to our Honored VIP Guest Winner & Employee Champions! ✨
        </div>
      </div>

      {/* ── 1. VIP GUEST WINNER SECTION (FIRST, BELOW HEADING) ── */}
      <div style={{ width: '100%', maxWidth: 1100, marginBottom: 12, position: 'relative', zIndex: 2, flexShrink: 0 }}>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            background: 'linear-gradient(135deg, rgba(74, 21, 75, 0.95) 0%, rgba(30, 27, 75, 0.95) 50%, rgba(88, 28, 135, 0.95) 100%)',
            border: '2.5px solid #FFD700',
            borderRadius: 16,
            padding: '12px 24px',
            boxShadow: '0 0 35px rgba(255, 215, 0, 0.35), 0 8px 25px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          {guestWinner ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(255, 215, 0, 0.7)',
                    flexShrink: 0,
                  }}
                >
                  <Crown size={36} style={{ color: '#4A154B' }} />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        background: 'linear-gradient(90deg, #FFD700, #FFA500)',
                        color: '#3b0764',
                        fontWeight: 950,
                        fontSize: 12,
                        padding: '2px 10px',
                        borderRadius: 6,
                        letterSpacing: 1,
                      }}
                    >
                      👑 HONORED VIP GUEST WINNER
                    </span>
                    <span
                      style={{
                        background: '#7B1FA2',
                        color: '#FFD700',
                        fontWeight: 900,
                        fontSize: 12,
                        padding: '2px 8px',
                        borderRadius: 6,
                        border: '1px solid #FFD700',
                      }}
                    >
                      LUCKY NO: #{guestWinner.serialNo}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 'clamp(20px, 2.2vw, 26px)',
                      fontWeight: 900,
                      color: '#ffffff',
                      fontFamily: 'Georgia, serif',
                      marginTop: 4,
                      letterSpacing: 0.5,
                      textShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}
                  >
                    {guestWinner.name}
                  </div>

                  <div style={{ fontSize: 13, color: '#e0c3fc', fontWeight: 700, marginTop: 2 }}>
                    🏭 Guest Unit: <b style={{ color: '#ffffff' }}>{guestWinner.unit || 'PGTL'}</b>
                    {guestWinner.guestNumber && (
                      <span style={{ marginLeft: 12, color: '#fbcfe8' }}>
                        Pass ID: #{guestWinner.guestNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Prize Box */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '2px solid #FFD700',
                  borderRadius: 12,
                  padding: '10px 18px',
                  boxShadow: '0 4px 18px rgba(255, 215, 0, 0.25)',
                  minWidth: 240,
                  textAlign: 'left',
                }}
              >
                <div style={{ color: '#FFD700', fontSize: 11, fontWeight: 900, letterSpacing: 1.5, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' }}>
                  <Gift size={14} style={{ color: '#FFD700' }} /> WON GRAND PRIZE
                </div>
                <div style={{ color: '#ffffff', fontSize: 18, fontWeight: 900, marginTop: 2 }}>
                  {guestPrize?.name || 'Grand Prize'}
                </div>
                {guestPrize?.description && (
                  <div style={{ color: '#fef08a', fontSize: 12, marginTop: 1 }}>
                    {guestPrize.description}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', justifyContent: 'center', padding: '6px 0' }}>
              <Crown size={28} style={{ color: '#FFD700' }} />
              <div style={{ color: '#FFD700', fontSize: 16, fontWeight: 800 }}>
                VIP Guest Lucky Winner will be drawn in the Casino Roulette Zone!
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── 2. EMPLOYEE WINNERS LISTS (AFTER GUEST DETAILS) ── */}
      <div style={{ width: '100%', maxWidth: 1100, position: 'relative', zIndex: 2, flex: 1, minHeight: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            height: '100%',
          }}
        >
          {/* GROUP A */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: '2px solid #3b82f6',
              borderRadius: 14,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              boxShadow: '0 4px 20px rgba(59, 130, 246, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid rgba(59, 130, 246, 0.3)', paddingBottom: 6 }}>
              <span style={{ color: '#60a5fa', fontWeight: 900, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                🎯 GROUP A (Rounds 1A–1C)
              </span>
              <span style={{ background: '#1d4ed8', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 10 }}>
                {groupA.filter(x => x.winnerNumber || x.employee).length} / 3
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groupA.map(renderEmpCard)}
            </div>
          </div>

          {/* GROUP B */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: '2px solid #a855f7',
              borderRadius: 14,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              boxShadow: '0 4px 20px rgba(168, 85, 247, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid rgba(168, 85, 247, 0.3)', paddingBottom: 6 }}>
              <span style={{ color: '#c084fc', fontWeight: 900, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                🎯 GROUP B (Rounds 2A–2C)
              </span>
              <span style={{ background: '#7e22ce', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 10 }}>
                {groupB.filter(x => x.winnerNumber || x.employee).length} / 3
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groupB.map(renderEmpCard)}
            </div>
          </div>

          {/* GROUP C */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: '2px solid #10b981',
              borderRadius: 14,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid rgba(16, 185, 129, 0.3)', paddingBottom: 6 }}>
              <span style={{ color: '#34d399', fontWeight: 900, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                🎯 GROUP C (Rounds 3A–3C)
              </span>
              <span style={{ background: '#047857', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 10 }}>
                {groupC.filter(x => x.winnerNumber || x.employee).length} / 3
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groupC.map(renderEmpCard)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LiveDraw() {
  const [activeZone, setActiveZone] = useState('employee'); // 'employee' | 'guest' | 'fiesta_winners'
  const [showFiestaWinners, setShowFiestaWinners] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | spinning | revealed | completed
  const [currentRound, setCurrentRound] = useState(1);
  const [currentGroup, setCurrentGroup] = useState(1);
  const [winner, setWinner] = useState(null);
  const [prize, setPrize] = useState(null);
  const [spinData, setSpinData] = useState(null);
  const [prevWinners, setPrevWinners] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);

  // VIP Guest Draw States
  const [guestSpinning, setGuestSpinning] = useState(false);
  const [guestSpinData, setGuestSpinData] = useState(null);
  const [guestWinner, setGuestWinner] = useState(null);
  const [guestPrize, setGuestPrize] = useState(null);
  const [guestList, setGuestList] = useState([]);

  const changeZone = (newZone) => {
    stopAllAudio();
    if (newZone !== 'guest') {
      setGuestSpinning(false);
    }
    setActiveZone(newZone);
  };

  // Sync global audio mute flag with component soundEnabled state
  useEffect(() => {
    setAudioMuted(!soundEnabled);
  }, [soundEnabled]);

  const toggleSound = () => {
    setSoundEnabled(p => {
      const next = !p;
      setAudioMuted(!next);
      if (!next) {
        stopAllAudio();
      } else {
        resumeAudio();
        if (activeZone === 'fiesta_winners') {
          playHallOfFameSong();
        }
      }
      return next;
    });
  };

  useSocket({
    'game:state': ({ state }) => {
      if (state) {
        setCurrentRound(state.currentRound || 1);
        setCurrentGroup(roundToGroup(state.currentRound || 1));
        setGameStarted(state.isActive || false);
        if (state.status === 'idle' || state.status === 'revealed') setPhase(state.status);
        if (state.showFiestaWinners !== undefined) {
          setShowFiestaWinners(state.showFiestaWinners);
          if (state.showFiestaWinners) {
            stopAllAudio();
            setActiveZone('fiesta_winners');
          }
        }
      }
    },
    'game:fiesta_winners_display': (data) => {
      stopAllAudio();
      if (data?.show) {
        setShowFiestaWinners(true);
        setActiveZone('fiesta_winners');
        if (data.winners) {
          setPrevWinners(
            data.winners.map(w => ({
              roundNo: w.roundNo,
              group: w.group,
              winnerNumber: w.winnerNumber || w.employeeCode,
              employee: w.employee,
              prize: w.prize,
            }))
          );
        }
        if (data.guestWinner) setGuestWinner(data.guestWinner);
        if (data.guestPrize) setGuestPrize(data.guestPrize);
      } else {
        setShowFiestaWinners(false);
        setActiveZone('employee');
      }
    },
    'game:start': () => {
      stopAllAudio();
      setActiveZone('employee');
      setGameStarted(true);
      setPhase('idle');
      if (soundEnabled) playGameStartSound();
    },
    'game:spin_start': (data) => {
      stopAllAudio();
      setActiveZone('employee');
      setPhase('spinning');
      setWinner(null);
      setPrize(null);
      setSpinData(data);
      setCurrentRound(data.round);
      setCurrentGroup(data.group);
      setGameStarted(true);

      if (soundEnabled) {
        preloadEmpSounds();
        playEmpSong();
      }
    },
    'game:winner_revealed': (data) => {
      setPhase('revealed');
      setWinner(data);
      setPrize(data.prize);
      setSpinData(null);

      if (soundEnabled) {
        stopEmpSong();
        playWinnerExplosion();
      }
      fireConfetti();

      // Update previous winners
      setPrevWinners(prev => [
        ...prev.filter(w => w.roundNo !== data.roundNo),
        {
          roundNo: data.roundNo,
          group: data.group,
          winnerNumber: data.winnerNumber || data.employeeCode,
          employee: data.employee,
          prize: data.prize,
        },
      ]);
    },
    'game:next_round': ({ round, group }) => {
      setPhase('idle');
      setCurrentRound(round);
      setCurrentGroup(group);
      setWinner(null);
      setPrize(null);
    },
    'game:reset': () => {
      setPhase('idle');
      setCurrentRound(1);
      setCurrentGroup(1);
      setWinner(null);
      setPrize(null);
      setPrevWinners([]);
      setGameStarted(false);
      stopAllAudio();
    },
    'game:completed': () => {
      setPhase('completed');
    },

    // ── GUEST DRAW SOCKET EVENTS ──
    'guest:spin_start': (data) => {
      stopAllAudio();
      setActiveZone('guest');
      setGuestSpinning(true);
      setGuestSpinData(data);
      setGuestWinner(null);
      setGuestPrize(null);
      if (data.allGuests && data.allGuests.length > 0) {
        setGuestList(data.allGuests);
      }
    },
    'guest:winner_revealed': (data) => {
      setGuestSpinning(false);
      setGuestWinner(data.winner);
      setGuestPrize(data.prize);
      stopSquidGameSound();
    },
    'guest:reverted': () => {
      setGuestSpinning(false);
      setGuestWinner(null);
      setGuestPrize(null);
      stopAllAudio();
    },
    'guest:reset': () => {
      setGuestSpinning(false);
      setGuestWinner(null);
      setGuestPrize(null);
      stopAllAudio();
    },
    'guest:state': (st) => {
      if (st) {
        if (st.spinning && !st.winner) {
          setGuestSpinning(true);
        } else {
          setGuestSpinning(false);
          stopSquidGameSound();
        }
        if (st.winner) {
          setGuestWinner(st.winner);
          setGuestPrize(st.prize);
        }
      }
    },
    'guest:updated': () => {
      fetch('/api/guests')
        .then(r => r.json())
        .then(g => setGuestList(g))
        .catch(() => {});
    },
  });

  // Fetch initial state (public-state works for audience display without login)
  useEffect(() => {
    fetch('/api/game/public-state')
      .then(r => r.json())
      .catch(() => {
        return fetch('/api/game/state', {
          headers: { Authorization: `Bearer ${localStorage.getItem('pg_admin_token')}` },
        }).then(r => r.json());
      })
      .then((data) => {
        if (!data) return;
        const { state, winners, guestWinner: gWin, guestPrize: gPrz } = data;
        if (state) {
          setCurrentRound(state.currentRound || 1);
          setCurrentGroup(roundToGroup(state.currentRound || 1));
          setGameStarted(state.isActive || false);
          setPhase(state.status || 'idle');
          if (state.showFiestaWinners) {
            setShowFiestaWinners(true);
            setActiveZone('fiesta_winners');
          }
        }
        if (winners) {
          setPrevWinners(
            winners.map(w => ({
              roundNo: w.roundNo,
              group: w.group,
              winnerNumber: w.winnerNumber || w.employeeCode,
              employee: w.employee,
              prize: w.prize,
            }))
          );
          if (winners.length > 0 && state?.status === 'revealed') {
            const last = winners[winners.length - 1];
            setWinner({
              winnerNumber: last.winnerNumber || last.employeeCode,
              employeeCode: last.employeeCode,
              employee: last.employee,
            });
            setPrize(last.prize);
          }
        }
        if (gWin) setGuestWinner(gWin);
        if (gPrz) setGuestPrize(gPrz);
      })
      .catch(() => {});

    // Fetch guest state and list
    fetch('/api/guests/state')
      .then(r => r.json())
      .then(st => {
        if (st) {
          if (st.spinning && !st.winner) {
            setGuestSpinning(true);
            setActiveZone(currentZone => currentZone === 'fiesta_winners' ? currentZone : 'guest');
          } else {
            setGuestSpinning(false);
            stopSquidGameSound();
          }
          if (st.winner) {
            setGuestWinner(st.winner);
            setGuestPrize(st.prize);
          }
        }
      })
      .catch(() => {});

    fetch('/api/guests')
      .then(r => r.json())
      .then(g => setGuestList(g))
      .catch(() => {});

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  // Periodic celebratory confetti sparkles every 4 seconds while Fiesta Winners view is active
  useEffect(() => {
    if (activeZone !== 'fiesta_winners') return;
    fireConfetti();
    const interval = setInterval(() => {
      fireConfetti();
    }, 4000);
    return () => clearInterval(interval);
  }, [activeZone]);

  // Play Hall of Fame song ONLY when Fiesta Winners view is active, and cleanly STOP on leave/unmount
  useEffect(() => {
    if (activeZone === 'fiesta_winners' && soundEnabled) {
      resumeAudio();
      preloadHallOfFameSound();
      playHallOfFameSong();
    } else {
      stopHallOfFameSong();
    }

    return () => {
      stopHallOfFameSong();
    };
  }, [activeZone, soundEnabled]);

  // Stop all audio when browser tab is hidden / minimized or user navigates away
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAllAudio();
      } else {
        if (activeZone === 'fiesta_winners' && soundEnabled) {
          resumeAudio();
          playHallOfFameSong();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', stopAllAudio);
    window.addEventListener('pagehide', stopAllAudio);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', stopAllAudio);
      window.removeEventListener('pagehide', stopAllAudio);
      stopAllAudio();
    };
  }, [activeZone, soundEnabled]);

  // Overall component teardown on route change / unmount
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, []);

  const diyaStyle = { fontSize: 28, animation: 'flicker 0.8s ease-in-out infinite' };

  return (
    <div
      onClick={resumeAudio}
      style={{
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: activeZone === 'guest' || activeZone === 'fiesta_winners'
          ? 'linear-gradient(160deg, #120224 0%, #260644 45%, #0d0018 100%)'
          : 'linear-gradient(160deg, #fff9f0 0%, #fff1e6 45%, #fff7f2 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        transition: 'background 0.5s ease',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          background: activeZone === 'guest' || activeZone === 'fiesta_winners' ? '#140020' : '#fff',
          borderBottom: activeZone === 'guest' || activeZone === 'fiesta_winners' ? '2.5px solid #D4AF37' : '2.5px solid #C8102E',
          padding: '8px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 14px rgba(0,0,0,0.18)',
          flexShrink: 0,
          transition: 'all 0.5s',
        }}
      >
        {/* PG LOGO: Clean, direct logo in Employee Zone (NO golden border), luxurious golden badge in VIP Guest / Fiesta Winners Zone */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {activeZone === 'guest' || activeZone === 'fiesta_winners' ? (
            <div
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #fffef8 55%, #fff6e8 100%)',
                padding: '4px 18px',
                borderRadius: 14,
                border: '2.5px solid #D4AF37',
                boxShadow: '0 0 26px rgba(255, 215, 0, 0.7), inset 0 0 6px rgba(255,255,255,0.9), 0 4px 14px rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                minWidth: 90,
                height: 48,
              }}
            >
              {/* Luminous reflection sweep */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '60%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)',
                  transform: 'skewX(-25deg)',
                  animation: 'logoReflection 4s infinite ease-in-out',
                  pointerEvents: 'none',
                }}
              />
              <img
                src={LOGO_PG}
                alt="PG Logo"
                style={{
                  height: 40,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.18))',
                }}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', padding: '2px 0' }}>
              <img
                src={LOGO_PG}
                alt="PG Logo"
                style={{
                  height: 44,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                }}
              />
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 900,
              color: activeZone === 'guest' || activeZone === 'fiesta_winners' ? '#FFD700' : '#1a1a1a',
              fontFamily: 'Georgia, serif',
              letterSpacing: 1,
            }}
          >
            PG FORTUNE FIESTA 2026
          </h1>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: activeZone === 'fiesta_winners' ? '#fde047' : activeZone === 'guest' ? '#e0c3fc' : '#C8102E',
              marginTop: 1,
            }}
          >
            {activeZone === 'fiesta_winners'
              ? '👑 Grand Champions Ceremony 👑'
              : activeZone === 'guest'
              ? '👑 VIP Guest Playing Zone 👑'
              : '💥 The Lucky Legends 💥'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={toggleSound}
            style={{
              background: soundEnabled ? (activeZone === 'guest' || activeZone === 'fiesta_winners' ? '#3b1257' : '#f6ffed') : '#fff1f0',
              border: `1.5px solid ${soundEnabled ? '#52c41a' : '#ff4d4f'}`,
              color: soundEnabled ? '#52c41a' : '#cf1322',
              borderRadius: 20,
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {soundEnabled ? '🔊 Sound: ON' : '🔈 Sound: MUTED'}
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={diyaStyle}>🪔</span>
            <span style={{ ...diyaStyle, animationDelay: '0.3s' }}>🪔</span>
          </div>
        </div>
      </div>

      {/* ZONE SWITCHER BAR */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 2px', flexShrink: 0 }}>
        <div
          style={{
            display: 'inline-flex',
            background: activeZone === 'guest' || activeZone === 'fiesta_winners' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)',
            padding: 3,
            borderRadius: 24,
            border: '1.5px solid #D4AF37',
            boxShadow: '0 3px 12px rgba(0,0,0,0.1)',
            gap: 4,
          }}
        >
          <button
            onClick={() => changeZone('employee')}
            style={{
              background: activeZone === 'employee' ? '#C8102E' : 'transparent',
              color: activeZone === 'employee' ? '#fff' : (activeZone === 'guest' || activeZone === 'fiesta_winners' ? '#ccc' : '#666'),
              fontWeight: 800,
              fontSize: 13,
              border: 'none',
              borderRadius: 20,
              padding: '6px 16px',
              cursor: 'pointer',
              transition: 'all 0.3s',
            }}
          >
            🏢 Employee Draw (Rounds 1A–3C)
          </button>
          <button
            onClick={() => changeZone('guest')}
            style={{
              background: activeZone === 'guest' ? 'linear-gradient(90deg, #7B1FA2, #C8102E)' : 'transparent',
              color: activeZone === 'guest' ? '#fff' : (activeZone === 'fiesta_winners' ? '#ccc' : '#666'),
              fontWeight: 800,
              fontSize: 13,
              border: 'none',
              borderRadius: 20,
              padding: '6px 16px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>🎰 VIP Guest Roulette Zone</span>
            {guestSpinning && (
              <span
                style={{
                  display: 'inline-block',
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#FFD700',
                  boxShadow: '0 0 6px #FFD700',
                }}
              />
            )}
          </button>
          <button
            onClick={() => changeZone('fiesta_winners')}
            style={{
              background: activeZone === 'fiesta_winners'
                ? 'linear-gradient(90deg, #D4AF37, #FFD700, #B8860B)'
                : 'transparent',
              color: activeZone === 'fiesta_winners' ? '#000' : (activeZone === 'guest' ? '#FFD700' : '#854d0e'),
              fontWeight: 900,
              fontSize: 13,
              border: 'none',
              borderRadius: 20,
              padding: '6px 18px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: activeZone === 'fiesta_winners' ? '0 0 14px rgba(255,215,0,0.6)' : 'none',
            }}
          >
            <span>👑 PG - FORTUNE FIESTA WINNERS</span>
            <Sparkles size={14} style={{ color: activeZone === 'fiesta_winners' ? '#000' : '#FFD700' }} />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* ── MAIN STAGE CONTAINER (FLEX 1, FITS 100% ON SINGLE SCREEN) ── */}
      {/* ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: (activeZone === 'guest' || activeZone === 'fiesta_winners') ? 'flex-start' : 'center',
          padding: (activeZone === 'guest' || activeZone === 'fiesta_winners') ? '2px 16px' : '4px 16px',
        }}
      >
        {/* ── ZONE 1: EMPLOYEE DRAW (ROUNDS 1 TO 9) ── */}
        {activeZone === 'employee' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', gap: 10 }}>
            {/* Progress tracker */}
            <div style={{ padding: '2px 10px', flexShrink: 0 }}>
              <ProgressTracker currentRound={currentRound} prevWinners={prevWinners} />
            </div>

            {/* Active Group Banner */}
            {gameStarted && (
              <motion.div
                key={currentRound}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: GROUP_BG[currentGroup],
                  border: `2px solid ${GROUP_COLORS[currentGroup]}`,
                  borderRadius: 20,
                  padding: '4px 22px',
                  textAlign: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: GROUP_COLORS[currentGroup] }}>
                  🎯 {GROUP_LABELS[currentGroup]} &nbsp;·&nbsp; Round {ROUND_LABELS[currentRound]}
                </span>
              </motion.div>
            )}

            {/* 10-Second Drum Animation */}
            {(gameStarted || phase === 'spinning') && (phase === 'spinning' || phase === 'idle') && (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <p style={{ color: '#777', fontSize: 15, marginBottom: 12, fontWeight: 700 }}>
                  {phase === 'spinning' ? '🎵 EMP Draw Rolling • Shuffling Numbers...' : '⏳ Ready — Waiting for Admin to Spin'}
                </p>
                <SlotDrum
                  spinning={phase === 'spinning'}
                  winnerCode={winner?.winnerNumber || winner?.employeeCode}
                  sampleCodes={spinData?.sampleCodes}
                  soundEnabled={soundEnabled}
                  onCountdownZero={() => {
                    if (soundEnabled) {
                      stopEmpSong();
                      playWinnerExplosion();
                    }
                  }}
                />
              </div>
            )}

            {/* SLOW, SUSPENSEFUL WINNER REVEAL */}
            <AnimatePresence>
              {phase === 'revealed' && winner && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 240, damping: 20 }}
                  style={{
                    background: '#ffffff',
                    border: '3px solid #D4AF37',
                    borderRadius: 20,
                    padding: '18px 32px',
                    textAlign: 'center',
                    boxShadow: '0 0 50px rgba(212,175,55,0.4), 0 16px 40px rgba(0,0,0,0.1)',
                    maxWidth: 580,
                    width: '100%',
                  }}
                >
                  <div style={{ fontSize: 34, marginBottom: 2 }}>🏆</div>
                  <div style={{ fontSize: 12, color: '#C8102E', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 800 }}>
                    Round {ROUND_LABELS[currentRound]} • Lucky Winner
                  </div>

                  {/* Step 1: Winner Employee ID Code */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    style={{
                      fontSize: 54,
                      fontWeight: 900,
                      fontFamily: 'Impact, Arial Black, sans-serif',
                      background: 'linear-gradient(135deg, #C8102E 0%, #D4AF37 60%, #8b0000 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      lineHeight: 1.1,
                      margin: '6px 0 4px',
                      letterSpacing: 2,
                    }}
                  >
                    #{winner.winnerNumber || winner.employeeCode}
                  </motion.div>

                  {/* Step 2: Employee Name */}
                  {winner.employee?.name && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.9, duration: 0.6 }}
                      style={{
                        fontSize: 24,
                        fontWeight: 900,
                        color: '#1a1a1a',
                        fontFamily: 'Georgia, serif',
                        marginTop: 4,
                        marginBottom: 4,
                      }}
                    >
                      {winner.employee.name}
                    </motion.div>
                  )}

                  {/* Step 3 & 4: Department & Current Unit */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.6, duration: 0.6 }}
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 10,
                      marginTop: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    {winner.employee?.department && (
                      <span
                        style={{
                          background: '#f3f4f6',
                          border: '1px solid #d1d5db',
                          borderRadius: 14,
                          padding: '4px 12px',
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#374151',
                        }}
                      >
                        🏢 {winner.employee.department}
                      </span>
                    )}
                    {winner.employee?.unit && (
                      <span
                        style={{
                          background: '#eff6ff',
                          border: '1px solid #93c5fd',
                          borderRadius: 14,
                          padding: '4px 12px',
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#1d4ed8',
                        }}
                      >
                        🏭 {winner.employee.unit}
                      </span>
                    )}
                  </motion.div>

                  {/* Step 5: Prize Details */}
                  {prize && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 2.2, duration: 0.6 }}
                      style={{
                        background: 'linear-gradient(135deg, #C8102E, #8b0000)',
                        borderRadius: 12,
                        padding: '10px 20px',
                        marginTop: 12,
                        boxShadow: '0 6px 18px rgba(200,16,46,0.3)',
                        border: '1.5px solid #FFD700',
                      }}
                    >
                      <div style={{ color: '#FFD700', fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                        🎁 WON PRIZE
                      </div>
                      <div style={{ color: '#fff', fontSize: 20, fontWeight: 900 }}>
                        {prize.name}
                      </div>
                      {prize.description && (
                        <div style={{ color: '#fed7aa', fontSize: 12, marginTop: 2 }}>
                          {prize.description}
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Not started */}
            {!gameStarted && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <img src={LOGO_ONLY} alt="PG" style={{ height: 80, objectFit: 'contain', marginBottom: 12, opacity: 0.9 }} />
                <h2 style={{ fontSize: 22, color: '#C8102E', fontFamily: 'Georgia, serif', margin: 0 }}>
                  Waiting for Game to Start...
                </h2>
                <p style={{ color: '#888', marginTop: 4, fontSize: 14 }}>
                  Admin will begin the PG Fortune Fiesta Lucky Draw shortly.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
                  {['🪔', '✨', '🎊', '✨', '🪔'].map((e, i) => (
                    <span key={i} style={{ fontSize: 26 }}>{e}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Completed */}
            {phase === 'completed' && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{ textAlign: 'center', padding: '20px 0' }}
              >
                <div style={{ fontSize: 54 }}>🎊</div>
                <h2 style={{ fontSize: 28, color: '#C8102E', fontFamily: 'Georgia, serif' }}>
                  Lucky Draw Complete!
                </h2>
                <p style={{ color: '#555', marginTop: 4, fontSize: 16 }}>
                  All 9 rounds have concluded. Heartiest Congratulations to all winners!
                </p>
              </motion.div>
            )}

            {/* Previous Winners Strip */}
            {prevWinners.length > 0 && phase !== 'revealed' && (
              <div style={{ width: '100%', maxWidth: 860, marginTop: 4, flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {prevWinners.map(w => (
                    <div
                      key={w.roundNo}
                      style={{
                        background: '#fff',
                        border: `1.2px solid ${GROUP_COLORS[w.group]}`,
                        borderRadius: 8,
                        padding: '4px 10px',
                        fontSize: 12,
                        textAlign: 'center',
                        minWidth: 100,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                      }}
                    >
                      <div style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Round {ROUND_LABELS[w.roundNo] || w.roundNo} · Grp {['A','B','C'][w.group-1]}</div>
                      <div style={{ fontWeight: 900, color: '#C8102E', fontSize: 14 }}>
                        #{w.winnerNumber}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ZONE 2: VIP GUEST PLAYING ZONE (CASINO ROULETTE WHEEL) ── */}
        {activeZone === 'guest' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              width: '100%',
              height: '100%',
              paddingTop: 4,
              gap: 8,
            }}
          >
            {/* Header sitting right below the navbar */}
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: '#FFD700',
                  fontFamily: 'Georgia, serif',
                  letterSpacing: 1.2,
                  margin: 0,
                  textShadow: '0 0 16px rgba(255, 215, 0, 0.45)',
                }}
              >
                🎰 GRAND CASINO ROULETTE WHEEL 🎰
              </h2>
              <div style={{ color: '#e0c3fc', fontSize: 13, fontWeight: 600, marginTop: 2, letterSpacing: 0.5 }}>
                Special Honored VIP Guest Draw • Single Lucky Winner Round
              </div>
            </div>

            {/* Interactive Roulette Wheel Component (Fits 100% on screen) */}
            <RouletteWheel
              spinning={guestSpinning}
              guests={guestList}
              winningSerialNo={guestSpinData?.winningSerialNo || guestWinner?.serialNo}
              winner={guestWinner}
              prize={guestPrize}
              duration={guestSpinData?.duration || 30000}
              soundEnabled={soundEnabled}
              onFinished={() => setGuestSpinning(false)}
            />

            {/* If waiting for spin */}
            {!guestSpinning && !guestWinner && (
              <div style={{ textAlign: 'center', padding: '4px 0', flexShrink: 0 }}>
                <div style={{ color: '#FFD700', fontSize: 15, fontWeight: 700 }}>
                  ⏳ Ready — Waiting for Admin to Spin the VIP Guest Roulette Wheel
                </div>
                <div style={{ color: '#e0c3fc', fontSize: 12, marginTop: 2 }}>
                  {guestList.length} VIP Guests registered in the lucky draw pool.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ZONE 3: PG FORTUNE FIESTA WINNERS CEREMONY DISPLAY ── */}
        {activeZone === 'fiesta_winners' && (
          <FiestaWinnersDisplay
            prevWinners={prevWinners}
            guestWinner={guestWinner}
            guestPrize={guestPrize}
          />
        )}
      </div>

      {/* Compact Footer */}
      <div
        style={{
          textAlign: 'center',
          padding: '4px 0 6px',
          color: activeZone === 'guest' || activeZone === 'fiesta_winners' ? '#baa3cd' : '#999',
          fontSize: 11,
          flexShrink: 0,
        }}
      >
        🪔 PG Group — Grand Diwali Fortune Fiesta 2026 🪔
      </div>

      <style>{`
        @keyframes flicker {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.08) rotate(3deg); }
        }
        @keyframes logoReflection {
          0% { left: -100%; }
          30% { left: 180%; }
          100% { left: 180%; }
        }
      `}</style>
    </div>
  );
}
