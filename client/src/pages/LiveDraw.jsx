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
  preloadFiestaWinnersAudio,
  playFiestaCelebrationAudio,
  stopFiestaCelebrationAudio,
  stopSquidGameSound,
  playWinnerExplosion,
  stopAllAudio,
  playClockTick,
  setAudioMuted,
  setupAudioAutoUnlock,
  isEmpSongPending,
} from '../hooks/useAudio';
import confetti from 'canvas-confetti';
import { Trophy, Crown, Gift, Sparkles, Award, Car, Clock, Star, Flame } from 'lucide-react';
import RouletteWheel from '../components/RouletteWheel';

const LOGO_PG = 'https://cms-complaint-avidence.s3.eu-north-1.amazonaws.com/pg-logo-Photoroom.png';
const LOGO_ONLY = 'https://cms-complaint-avidence.s3.eu-north-1.amazonaws.com/pg-logo-Photoroom+(1).png';
const LOGO_FULL = '/pg-full-logo.png';

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

// 20-Second Realistic Multi-Phase Slot Drum Animation with Authentic Group Prefixes & Staggered Suspense
function SlotDrum({ spinning, winnerCode, sampleCodes, currentGroup = 1, soundEnabled = true, onCountdownZero }) {
  // Real employee code pool for current group
  const samplePool = React.useMemo(() => {
    if (sampleCodes && sampleCodes.length > 0) return sampleCodes;
    if (currentGroup === 3) {
      return ['VON400163', 'CMS400001', 'VON100453', 'CMS100010', 'RUD400874', 'PG400098', 'PT200350', 'PG400689', 'SUP400112'];
    } else if (currentGroup === 2) {
      return ['PT200893', 'PT200716', 'PT200969', 'PG400321', 'PT200450', 'PG400512', 'PT200611', 'PG400780'];
    } else {
      return ['PG400878', 'PG400874', 'PT201159', 'PG400102', 'PT200543', 'PG400621', 'PT200230', 'PG400345'];
    }
  }, [sampleCodes, currentGroup]);

  // Authentic prefix candidate pools by group
  // Group 1: PG, PT
  // Group 2: PT, PG
  // Group 3: PT, PG, VON, RUD, CMS, SUP, BVG, DIM
  const allGroupPrefixes = React.useMemo(() => {
    const set = new Set();
    if (currentGroup === 1) {
      set.add('PG'); set.add('PT');
    } else if (currentGroup === 2) {
      set.add('PT'); set.add('PG');
    } else {
      ['PT', 'PG', 'VON', 'RUD', 'CMS', 'SUP', 'BVG', 'DIM'].forEach(p => set.add(p));
    }
    samplePool.forEach(c => {
      if (c) {
        const p = c.replace(/[0-9]/g, '');
        if (p) set.add(p.toUpperCase());
      }
    });
    return Array.from(set);
  }, [samplePool, currentGroup]);

  // Determine target code & layout
  const targetCode = React.useMemo(() => {
    if (winnerCode) return winnerCode;
    return samplePool[0] || (currentGroup === 3 ? 'VON400163' : 'PG400874');
  }, [winnerCode, samplePool, currentGroup]);

  // Target prefix & target numeric digits
  const { targetPref, targetDigits, targetLen, prefLen } = React.useMemo(() => {
    const prefM = targetCode.match(/^[A-Za-z]+/);
    const p = prefM ? prefM[0].toUpperCase() : (currentGroup === 3 ? 'VON' : 'PG');
    const numM = targetCode.match(/[0-9]+$/);
    const d = (numM ? numM[0] : '400874').padStart(6, '0').slice(-6);
    return {
      targetPref: p,
      targetDigits: d,
      targetLen: p.length + d.length,
      prefLen: p.length,
    };
  }, [targetCode, currentGroup]);

  // Prefix candidates with matching length to target (e.g. length 2 for PT/PG, or length 3 for VON/RUD/CMS)
  const matchingPrefixes = React.useMemo(() => {
    const matched = allGroupPrefixes.filter(p => p.length === prefLen);
    return matched.length > 0 ? matched : (prefLen === 3 ? ['VON', 'RUD', 'CMS', 'SUP'] : ['PG', 'PT']);
  }, [allGroupPrefixes, prefLen]);

  const [chars, setChars] = useState(() => {
    if (winnerCode) return winnerCode.split('');
    return Array(targetLen).fill('?');
  });

  const [phaseStage, setPhaseStage] = useState('idle'); // 'turbo' | 'decelerating' | 'suspense' | 'locked'
  const [highlightIndices, setHighlightIndices] = useState([]);
  const animTimeoutRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const lastTickSecRef = useRef(null);
  const hasExplodedRef = useRef(false);

  // Sync idle display when not spinning
  useEffect(() => {
    if (!spinning) {
      if (winnerCode) {
        setChars(winnerCode.split(''));
      } else {
        setChars(Array(targetLen).fill('?'));
      }
      setPhaseStage('idle');
      setHighlightIndices([]);
    }
  }, [spinning, winnerCode, targetLen]);

  useEffect(() => {
    if (!spinning) {
      clearTimeout(animTimeoutRef.current);
      clearInterval(timerIntervalRef.current);
      if (winnerCode) setChars(winnerCode.split(''));
      return;
    }

    const duration = 20000; // 20 Seconds Game
    const startT = Date.now();
    hasExplodedRef.current = false;
    lastTickSecRef.current = null;
    setPhaseStage('turbo');
    setHighlightIndices([]);
    preloadEmpSounds();

    // 100ms interval for clock countdown sound ticks & final explosion trigger
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startT;
      const remainingSec = Math.max(0, Math.ceil((duration - elapsed) / 1000));

      // In last 5 seconds: mechanical grandfather clock tick pulse
      if (remainingSec <= 5 && remainingSec > 0 && remainingSec !== lastTickSecRef.current) {
        lastTickSecRef.current = remainingSec;
        if (soundEnabled) {
          playClockTick(remainingSec);
        }
      }

      // Exactly at 20s (remainingSec === 0): Stop song, explosion fanfare!
      if (remainingSec === 0 && !hasExplodedRef.current) {
        hasExplodedRef.current = true;
        stopEmpSong();
        if (soundEnabled) {
          playWinnerExplosion();
        }
        if (onCountdownZero) onCountdownZero();
      }
    }, 100);

    // Dynamic state trackers during the 20s spin
    let currentPref = matchingPrefixes[Math.floor(Math.random() * matchingPrefixes.length)] || targetPref;
    let currentDigitsArr = Array.from({ length: 6 }, () => String(Math.floor(Math.random() * 10)));
    let lockedSlots = new Set(); // which slot indices have been locked

    // 3-PHASE ANIMATION LOOP:
    // Phase 1: 0s - 5s (remaining > 15s): Fast Turbo Spin (all numbers and prefix roll fast)
    // Phase 2: 5s - 10s (15s >= remaining > 10s): Smooth Deceleration (rolling gets slower and slower)
    // Phase 3: 10s - 20s (remaining <= 10s): Suspense Finale (very slow, random 1-in-6 numeric digit slow tumbling, prefix spin, progressive locking)
    const stepAnimation = () => {
      const elapsed = Date.now() - startT;
      const remainingSec = Math.max(0, Math.ceil((duration - elapsed) / 1000));

      if (elapsed >= duration || remainingSec === 0) {
        setChars((targetPref + targetDigits).split(''));
        setPhaseStage('locked');
        setHighlightIndices(Array.from({ length: targetLen }, (_, i) => i));
        return;
      }

      // ── PHASE 1: FIRST 5 SECONDS (0s - 5s, remaining > 15s) ──
      // "from 5 sec spins all digits fastly in his box all numbers rolls fast"
      if (remainingSec > 15) {
        setPhaseStage('turbo');
        // All 6 numerical digits tumble rapidly every frame
        for (let k = 0; k < 6; k++) {
          currentDigitsArr[k] = String(Math.floor(Math.random() * 10));
        }
        // Prefix rolls rapidly through group candidates
        if (Math.random() < 0.45) {
          currentPref = matchingPrefixes[Math.floor(Math.random() * matchingPrefixes.length)];
        }
        setChars((currentPref + currentDigitsArr.join('')).split(''));
        setHighlightIndices([]);
        animTimeoutRef.current = setTimeout(stepAnimation, 38);
      }

      // ── PHASE 2: 5s TO 10s (15s >= remaining > 10s) ──
      // "and then change value being moment slow and slow according to time"
      else if (remainingSec > 10) {
        setPhaseStage('decelerating');
        // Decelerate smoothly from 45ms to 320ms based on momentum
        const progress = Math.max(0, Math.min(1, (elapsed - 5000) / 5000));
        const delay = Math.round(45 + Math.pow(progress, 1.7) * 275);

        // All digits still rolling, but with visibly expanding tempo
        for (let k = 0; k < 6; k++) {
          if (Math.random() < 0.85) {
            currentDigitsArr[k] = String(Math.floor(Math.random() * 10));
          }
        }
        if (Math.random() < 0.35) {
          currentPref = matchingPrefixes[Math.floor(Math.random() * matchingPrefixes.length)];
        }
        setChars((currentPref + currentDigitsArr.join('')).split(''));
        setHighlightIndices([]);
        animTimeoutRef.current = setTimeout(stepAnimation, delay);
      }

      // ── PHASE 3: LAST 10 SECONDS (10s - 20s, remaining <= 10s) ──
      // "and at the last 10 seconds it's being slow , slow all from the 9 digits 
      //  all from the 6 numericals digits being slow but randomely spin slow 1 in any of 6 number digits 
      //  and the employe character also spins - PT/PG/VON/RUD.. its character also spinning accordingly to his group"
      else {
        setPhaseStage('suspense');

        // Progressive locking milestones in final 5 seconds:
        if (remainingSec <= 5) {
          // Lock prefix at <= 5s
          currentPref = targetPref;
          for (let p = 0; p < prefLen; p++) lockedSlots.add(p);
        }
        if (remainingSec <= 4) {
          // Lock digit 1
          currentDigitsArr[0] = targetDigits[0];
          lockedSlots.add(prefLen + 0);
        }
        if (remainingSec <= 3) {
          // Lock digit 2
          currentDigitsArr[1] = targetDigits[1];
          lockedSlots.add(prefLen + 1);
        }
        if (remainingSec <= 2) {
          // Lock digit 3 & 4
          currentDigitsArr[2] = targetDigits[2];
          currentDigitsArr[3] = targetDigits[3];
          lockedSlots.add(prefLen + 2);
          lockedSlots.add(prefLen + 3);
        }
        if (remainingSec <= 1) {
          // Lock digit 5
          currentDigitsArr[4] = targetDigits[4];
          lockedSlots.add(prefLen + 4);
        }

        // Find available unlocked numeric digits among the 6 numeric positions
        const unlockedNumericOffsets = [];
        for (let k = 0; k < 6; k++) {
          if (!lockedSlots.has(prefLen + k)) {
            unlockedNumericOffsets.push(k);
          }
        }

        let activeChangedIndices = [];

        // Randomly spin slow 1 in any of the unlocked numeric digits:
        if (unlockedNumericOffsets.length > 0) {
          const chosenOffset = unlockedNumericOffsets[Math.floor(Math.random() * unlockedNumericOffsets.length)];
          const slotIndex = prefLen + chosenOffset;
          // Change this 1 digit slowly
          if (remainingSec <= 1 && chosenOffset === 5) {
            // Very last digit near the end: alternate between close candidates
            const targetVal = parseInt(targetDigits[5], 10);
            const closeOffsets = [-1, 1, 2, -2];
            const delta = closeOffsets[Math.floor(Math.random() * closeOffsets.length)];
            currentDigitsArr[chosenOffset] = String((targetVal + delta + 10) % 10);
          } else {
            currentDigitsArr[chosenOffset] = String(Math.floor(Math.random() * 10));
          }
          activeChangedIndices.push(slotIndex);
        }

        // Employee character / prefix also spins slowly before locking:
        if (remainingSec > 5 && Math.random() < 0.45 && matchingPrefixes.length > 1) {
          currentPref = matchingPrefixes[Math.floor(Math.random() * matchingPrefixes.length)];
          for (let p = 0; p < prefLen; p++) activeChangedIndices.push(p);
        }

        setChars((currentPref + currentDigitsArr.join('')).split(''));
        setHighlightIndices(activeChangedIndices);

        // Suspense cadence: slow and increasingly dramatic
        const suspenseDelays = {
          10: 420,
          9: 460,
          8: 520,
          7: 580,
          6: 650,
          5: 720,
          4: 800,
          3: 880,
          2: 950,
          1: 980,
        };
        const curDelay = suspenseDelays[remainingSec] || 600;
        animTimeoutRef.current = setTimeout(stepAnimation, curDelay);
      }
    };

    stepAnimation();

    return () => {
      clearTimeout(animTimeoutRef.current);
      clearInterval(timerIntervalRef.current);
    };
  }, [spinning, winnerCode, targetCode, targetPref, targetDigits, targetLen, prefLen, matchingPrefixes, soundEnabled, onCountdownZero]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* Dynamic Suspense Banner */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {spinning ? (
          phaseStage === 'suspense' ? (
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                boxShadow: [
                  '0 0 16px rgba(255,215,0,0.6)',
                  '0 0 32px rgba(255,215,0,0.95)',
                  '0 0 16px rgba(255,215,0,0.6)',
                ],
              }}
              transition={{ duration: 0.6, repeat: Infinity }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'linear-gradient(90deg, #8b0000 0%, #C8102E 50%, #8b0000 100%)',
                padding: '6px 26px',
                borderRadius: 24,
                border: '2px solid #FFD700',
              }}
            >
              <span style={{ fontSize: 13, color: '#FFD700', fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                🔥 SUSPENSE FINALE • LOCKING WINNER 🔥
              </span>
            </motion.div>
          ) : phaseStage === 'decelerating' ? (
            <motion.div
              animate={{ opacity: [0.9, 1, 0.9], scale: [1, 1.02, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: '#8b0000',
                letterSpacing: 1.5,
                background: '#fff3e0',
                padding: '6px 24px',
                borderRadius: 24,
                border: '2px solid #ff9800',
                boxShadow: '0 3px 12px rgba(255, 152, 0, 0.25)',
                textTransform: 'uppercase',
              }}
            >
              ⚡ DECELERATING MOMENTUM • TRACKING WINNER ⚡
            </motion.div>
          ) : (
            <motion.div
              animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.02, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: '#C8102E',
                letterSpacing: 2,
                background: '#fff0f0',
                padding: '6px 24px',
                borderRadius: 24,
                border: '2px solid #C8102E',
                boxShadow: '0 3px 12px rgba(200, 16, 46, 0.2)',
                textTransform: 'uppercase',
              }}
            >
              🎰 SHUFFLING ALL EMPLOYEES • HUNTING WINNER 🎰
            </motion.div>
          )
        ) : (
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 1.5,
              color: '#8b0000',
              background: 'rgba(200, 16, 46, 0.08)',
              padding: '5px 22px',
              borderRadius: 24,
              border: '1.5px solid rgba(200, 16, 46, 0.25)',
              textTransform: 'uppercase',
            }}
          >
            🎰 EMPLOYEE LUCKY DRAW REEL
          </div>
        )}
      </div>

      {/* Reel Labels: PREFIX and 6 DIGITS */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          maxWidth: chars.length >= 9 ? 560 : 530,
          padding: '0 8px',
          marginBottom: -4,
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 900,
              color: '#C8102E',
              letterSpacing: 1.2,
              background: 'rgba(200, 16, 46, 0.08)',
              padding: '2px 8px',
              borderRadius: 6,
              border: '1px solid rgba(200, 16, 46, 0.2)',
              textTransform: 'uppercase',
            }}
          >
            COMPANY PREFIX ({prefLen})
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 900,
              color: '#8b0000',
              letterSpacing: 1.2,
              background: 'rgba(212, 175, 55, 0.15)',
              padding: '2px 8px',
              borderRadius: 6,
              border: '1px solid rgba(212, 175, 55, 0.35)',
              textTransform: 'uppercase',
            }}
          >
            NUMERIC DIGITS (6)
          </span>
        </div>
      </div>

      {/* Grand Slot Drum Capsule Container */}
      <div
        style={{
          display: 'flex',
          gap: chars.length >= 9 ? 7 : 9,
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,248,242,0.95) 100%)',
          padding: chars.length >= 9 ? '16px 20px' : '18px 26px',
          borderRadius: 22,
          boxShadow: '0 16px 45px rgba(200,16,46,0.18), 0 2px 8px rgba(0,0,0,0.06)',
          border: '3px solid #D4AF37',
        }}
      >
        {chars.map((char, i) => {
          const isHighlight = highlightIndices.includes(i);
          const isSuspenseDigit = spinning && phaseStage === 'suspense' && isHighlight;
          const isLockedStage = phaseStage === 'locked';

          return (
            <motion.div
              key={i}
              animate={
                spinning
                  ? isSuspenseDigit
                    ? { y: [-3, 3, -3], scale: [1, 1.08, 1] }
                    : phaseStage === 'turbo'
                    ? { y: [-4, 4, -4], scale: [1, 1.015, 1] }
                    : { y: [-2, 2, -2], scale: [1, 1.01, 1] }
                  : isLockedStage
                  ? { y: [0, -4, 0], scale: [1, 1.05, 1] }
                  : { y: 0, scale: 1 }
              }
              transition={
                spinning
                  ? {
                      duration: isSuspenseDigit ? 0.28 : phaseStage === 'turbo' ? 0.08 : 0.16,
                      repeat: Infinity,
                      delay: i * 0.02,
                    }
                  : { duration: 0.3 }
              }
              style={{
                width: chars.length >= 9 ? 54 : 60,
                height: chars.length >= 9 ? 80 : 84,
                borderRadius: 14,
                background: isLockedStage
                  ? 'linear-gradient(180deg, #D4AF37 0%, #B8860B 40%, #8A6508 100%)'
                  : isSuspenseDigit
                  ? 'linear-gradient(180deg, #7A0012 0%, #C8102E 40%, #8A0015 80%, #50000C 100%)'
                  : 'linear-gradient(180deg, #990018 0%, #D61A3C 35%, #A0001E 75%, #680000 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isLockedStage
                  ? '0 0 28px rgba(255,215,0,0.95), inset 0 3px 6px rgba(255,255,255,0.7), inset 0 -4px 6px rgba(0,0,0,0.4)'
                  : isSuspenseDigit
                  ? '0 0 26px rgba(255,215,0,0.95), inset 0 5px 8px rgba(255,255,255,0.6), inset 0 -5px 8px rgba(0,0,0,0.6)'
                  : '0 8px 22px rgba(200,16,46,0.32), inset 0 4px 6px rgba(255,255,255,0.35), inset 0 -4px 6px rgba(0,0,0,0.45)',
                border: isLockedStage
                  ? '2.8px solid #FFFFFF'
                  : isSuspenseDigit
                  ? '2.8px solid #FFD700'
                  : '2px solid #FFD700',
                filter: spinning && phaseStage === 'turbo' ? 'blur(0.35px)' : 'none',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Drum slot 3D gloss sheen */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '35%',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 100%)',
                  pointerEvents: 'none',
                }}
              />

              <span
                style={{
                  fontSize: chars.length >= 9 ? 37 : 41,
                  fontWeight: 900,
                  color: isLockedStage ? '#ffffff' : isSuspenseDigit ? '#FFD700' : '#ffffff',
                  fontFamily: 'Impact, "Arial Black", sans-serif',
                  letterSpacing: 1,
                  textShadow: isLockedStage
                    ? '0 2px 6px rgba(0,0,0,0.6)'
                    : isSuspenseDigit
                    ? '0 0 16px rgba(255,215,0,0.95), 0 2px 6px rgba(0,0,0,0.5)'
                    : '0 2px 6px rgba(0,0,0,0.45)',
                  zIndex: 2,
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
function ProgressTracker({ currentRound, prevWinners = [] }) {
  const currentGroup = roundToGroup(currentRound);
  const totalDrawn = Math.max(prevWinners.length, Math.min(9, currentRound - 1));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
        {Array.from({ length: 9 }, (_, i) => {
          const r = i + 1;
          const won = prevWinners.find(w => (w.roundNo === r || w.round === r));
          const isActive = r === currentRound;
          // Mark done if a winner was recorded OR if this round is strictly before the current active round
          const isDone = Boolean(won) || (r < currentRound);
          const status = isDone ? 'done' : isActive ? 'active' : 'pending';

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
                    background: (r < currentRound || isDone) ? '#52c41a' : r === currentRound ? '#C8102E' : '#e5e7eb',
                    transition: 'background 0.5s ease',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', fontSize: 13, color: '#666', fontWeight: 600 }}>
        Round <b style={{ color: '#C8102E' }}>{ROUND_LABELS[currentRound]}</b> of 9 &nbsp;|&nbsp; <span style={{ color: GROUP_COLORS[currentGroup] }}>{GROUP_LABELS[currentGroup]}</span> &nbsp;|&nbsp; {totalDrawn} Drawn, {9 - totalDrawn} Remaining
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

  // Dedicated prize ranks for symmetry
  const PRIZE_RANK_TITLES = {
    1: 'FIRST PRIZE',
    2: 'SECOND PRIZE',
    3: 'THIRD PRIZE',
    4: 'FIRST PRIZE',
    5: 'SECOND PRIZE',
    6: 'THIRD PRIZE',
    7: 'FIRST PRIZE',
    8: 'SECOND PRIZE',
    9: 'THIRD PRIZE',
  };

  const renderEmpCard = (item) => {
    const isDrawn = Boolean(item.winnerNumber || item.employee);
    const grpColor = GROUP_COLORS[item.group] || '#3b82f6';
    const roundLabel = ROUND_LABELS[item.roundNo] || item.roundNo;
    const rankTitle = PRIZE_RANK_TITLES[item.roundNo] || 'SPECIAL PRIZE';

    return (
      <motion.div
        key={item.roundNo}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: (item.roundNo - 1) * 0.04 }}
        style={{
          background: isDrawn
            ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(20, 10, 35, 0.88) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(10, 5, 20, 0.6) 100%)',
          border: isDrawn ? `2px solid ${grpColor}` : '1.5px dashed rgba(255, 255, 255, 0.18)',
          borderRadius: 14,
          padding: '11px 14px',
          boxShadow: isDrawn
            ? `0 6px 20px ${grpColor}33, inset 0 0 14px ${grpColor}15`
            : 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 118,
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Ambient Top Glow for drawn cards */}
        {isDrawn && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '10%',
              right: '10%',
              height: 2,
              background: `linear-gradient(90deg, transparent, ${grpColor}, transparent)`,
            }}
          />
        )}

        {/* Top Header Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                background: grpColor,
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 900,
                padding: '2.5px 9px',
                borderRadius: 6,
                letterSpacing: 0.8,
                boxShadow: `0 2px 8px ${grpColor}66`,
              }}
            >
              ROUND {roundLabel}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: isDrawn ? '#e2e8f0' : '#94a3b8',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                opacity: 0.9,
              }}
            >
              {rankTitle}
            </span>
          </div>

          {isDrawn ? (
            <span
              style={{
                background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.25) 0%, rgba(212, 175, 55, 0.15) 100%)',
                border: '1px solid rgba(255, 215, 0, 0.6)',
                color: '#FFD700',
                fontWeight: 900,
                fontSize: 12.5,
                letterSpacing: 0.8,
                padding: '2px 8px',
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: '0 0 10px rgba(255, 215, 0, 0.25)',
              }}
            >
              ★ #{item.winnerNumber || item.employeeCode || item.employee?.payCode}
            </span>
          ) : (
            <span
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                color: '#fcd34d',
                fontSize: 10.5,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Clock size={11} /> Pending Draw
            </span>
          )}
        </div>

        {/* Middle Body */}
        {isDrawn ? (
          <div>
            <div
              style={{
                color: '#ffffff',
                fontWeight: 950,
                fontSize: 16,
                lineHeight: 1.2,
                marginTop: 4,
                letterSpacing: 0.3,
                textShadow: '0 2px 6px rgba(0,0,0,0.5)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={item.employee?.name || 'Winner'}
            >
              {item.employee?.name || 'Winner'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#cbd5e1',
                  background: 'rgba(255, 255, 255, 0.08)',
                  padding: '1.5px 7px',
                  borderRadius: 4,
                }}
              >
                🏭 {item.employee?.unit || 'PGTL'}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#cbd5e1',
                  background: 'rgba(255, 255, 255, 0.08)',
                  padding: '1.5px 7px',
                  borderRadius: 4,
                }}
              >
                💼 {item.employee?.department || 'Operations'}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ padding: '6px 0', textAlign: 'center' }}>
            <div style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}>
              ⏳ Awaiting Lucky Spin
            </div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
              Winner will be revealed live on screen
            </div>
          </div>
        )}

        {/* Bottom Prize Bar */}
        <div
          style={{
            marginTop: 5,
            padding: '4px 9px',
            borderRadius: 7,
            background: isDrawn
              ? 'linear-gradient(90deg, rgba(212, 175, 55, 0.22) 0%, rgba(255, 215, 0, 0.12) 100%)'
              : 'rgba(255, 255, 255, 0.03)',
            border: isDrawn ? '1px solid rgba(255, 215, 0, 0.55)' : '1px dashed rgba(255, 255, 255, 0.15)',
            color: isDrawn ? '#FFD700' : '#94a3b8',
            fontSize: 11.5,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: isDrawn ? '0 2px 8px rgba(255, 215, 0, 0.15)' : 'none',
          }}
        >
          <Gift size={13} style={{ color: isDrawn ? '#FFD700' : '#64748b', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.prize?.name
              ? `${item.prize.name} ${item.prize.description ? `(${item.prize.description})` : ''}`
              : `Round ${roundLabel} Trophy Prize`}
          </span>
        </div>
      </motion.div>
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
        padding: '2px 16px 12px',
        overflowY: 'auto',
      }}
    >
      <ContinuousSparkles />

      {/* ── CEREMONY HEADING ── */}
      <div style={{ textAlign: 'center', marginBottom: 10, position: 'relative', zIndex: 2, flexShrink: 0 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255, 215, 0, 0.15)',
            border: '1.5px solid rgba(255, 215, 0, 0.55)',
            padding: '3px 18px',
            borderRadius: 30,
            marginBottom: 4,
            boxShadow: '0 0 16px rgba(255, 215, 0, 0.25)',
          }}
        >
          <Sparkles size={15} style={{ color: '#FFD700' }} />
          <span style={{ color: '#FFD700', fontSize: 12.5, fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            ✦ GRAND LUCKY DRAW CHAMPIONS 2026 ✦
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

      {/* ── 1. VIP GUEST WINNER SECTION (FIRST, HERO SHOWCASE) ── */}
      <div style={{ width: '100%', maxWidth: 1160, marginBottom: 12, position: 'relative', zIndex: 2, flexShrink: 0 }}>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            background: 'linear-gradient(135deg, rgba(74, 18, 78, 0.95) 0%, rgba(24, 12, 48, 0.95) 50%, rgba(92, 24, 118, 0.95) 100%)',
            border: '2.5px solid #FFD700',
            borderRadius: 18,
            padding: '14px 24px',
            boxShadow: '0 0 35px rgba(255, 215, 0, 0.35), 0 10px 30px rgba(0,0,0,0.6), inset 0 0 20px rgba(255, 215, 0, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Shimmer top accent */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: 'linear-gradient(90deg, #D4AF37 0%, #FFD700 50%, #D4AF37 100%)',
              boxShadow: '0 0 12px #FFD700',
            }}
          />

          {guestWinner ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0, flex: 1 }}>
                {/* Crown Medallion */}
                <motion.div
                  animate={{ rotate: [0, 2, -2, 0], scale: [1, 1.03, 1] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #B8860B 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 24px rgba(255, 215, 0, 0.8), 0 4px 12px rgba(0,0,0,0.4)',
                    border: '2px solid #FFFFFF',
                    flexShrink: 0,
                  }}
                >
                  <Crown size={38} style={{ color: '#4A154B', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
                </motion.div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        background: 'linear-gradient(90deg, #FFD700, #FFA500)',
                        color: '#3b0764',
                        fontWeight: 950,
                        fontSize: 11.5,
                        padding: '2.5px 11px',
                        borderRadius: 6,
                        letterSpacing: 1,
                        boxShadow: '0 2px 8px rgba(255, 215, 0, 0.4)',
                      }}
                    >
                      👑 HONORED VIP GUEST WINNER
                    </span>
                    <span
                      style={{
                        background: '#7B1FA2',
                        color: '#FFD700',
                        fontWeight: 900,
                        fontSize: 11.5,
                        padding: '2px 9px',
                        borderRadius: 6,
                        border: '1.5px solid #FFD700',
                        boxShadow: '0 0 8px rgba(123, 31, 162, 0.6)',
                      }}
                    >
                      LUCKY NO: #{guestWinner.serialNo}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 'clamp(22px, 2.6vw, 30px)',
                      fontWeight: 950,
                      color: '#ffffff',
                      fontFamily: 'Georgia, serif',
                      marginTop: 4,
                      letterSpacing: 0.5,
                      textShadow: '0 0 16px rgba(255, 215, 0, 0.4), 0 2px 8px rgba(0,0,0,0.8)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {guestWinner.name}
                  </div>

                  <div style={{ fontSize: 13, color: '#e0c3fc', fontWeight: 700, marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 4, color: '#ffffff' }}>
                      🏭 Guest Unit: <b>{guestWinner.unit || 'PGTL'}</b>
                    </span>
                    {guestWinner.guestNumber && (
                      <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 4, color: '#FFD700' }}>
                        🎟 Pass ID: #{guestWinner.guestNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Prize Box Hero */}
              <motion.div
                animate={{ scale: [1, 1.015, 1] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.22) 0%, rgba(139, 92, 246, 0.15) 100%)',
                  border: '2px solid #FFD700',
                  borderRadius: 14,
                  padding: '11px 20px',
                  boxShadow: '0 6px 20px rgba(255, 215, 0, 0.35)',
                  minWidth: 260,
                  textAlign: 'left',
                  flexShrink: 0,
                }}
              >
                <div style={{ color: '#FFD700', fontSize: 11, fontWeight: 950, letterSpacing: 1.5, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' }}>
                  <Award size={15} style={{ color: '#FFD700' }} /> WON GRAND PRIZE
                </div>
                <div style={{ color: '#ffffff', fontSize: 20, fontWeight: 950, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Car size={22} style={{ color: '#FFD700' }} />
                  <span>{guestPrize?.name || 'CAR (GRAND PRIZE)'}</span>
                </div>
                {guestPrize?.description && (
                  <div style={{ color: '#fef08a', fontSize: 12, marginTop: 2, fontWeight: 600 }}>
                    {guestPrize.description}
                  </div>
                )}
              </motion.div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', justifyContent: 'center', padding: '10px 0' }}>
              <Crown size={32} style={{ color: '#FFD700' }} />
              <div style={{ color: '#FFD700', fontSize: 17, fontWeight: 800 }}>
                VIP Guest Lucky Winner will be drawn live in the Casino Roulette Zone!
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── 2. EMPLOYEE WINNERS LISTS (3 SYMMETRICAL COLUMNS) ── */}
      <div style={{ width: '100%', maxWidth: 1160, position: 'relative', zIndex: 2, flex: 1, minHeight: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 14,
            height: '100%',
          }}
        >
          {/* GROUP A */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.85) 0%, rgba(10, 15, 30, 0.95) 100%)',
              border: '2px solid #3b82f6',
              borderRadius: 16,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid rgba(59, 130, 246, 0.35)', paddingBottom: 8 }}>
              <span style={{ color: '#60a5fa', fontWeight: 950, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 6, letterSpacing: 0.5 }}>
                🏆 GROUP A (Rounds 1A–1C)
              </span>
              <span style={{ background: '#1d4ed8', color: '#ffffff', fontSize: 11.5, fontWeight: 900, padding: '2px 10px', borderRadius: 12, boxShadow: '0 0 10px rgba(29, 78, 216, 0.6)' }}>
                {groupA.filter(x => x.winnerNumber || x.employee).length} / 3 WON
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {groupA.map(renderEmpCard)}
            </div>
          </div>

          {/* GROUP B */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(24, 12, 45, 0.85) 0%, rgba(15, 8, 30, 0.95) 100%)',
              border: '2px solid #a855f7',
              borderRadius: 16,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: '0 8px 24px rgba(168, 85, 247, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid rgba(168, 85, 247, 0.35)', paddingBottom: 8 }}>
              <span style={{ color: '#c084fc', fontWeight: 950, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 6, letterSpacing: 0.5 }}>
                🏆 GROUP B (Rounds 2A–2C)
              </span>
              <span style={{ background: '#7e22ce', color: '#ffffff', fontSize: 11.5, fontWeight: 900, padding: '2px 10px', borderRadius: 12, boxShadow: '0 0 10px rgba(126, 34, 206, 0.6)' }}>
                {groupB.filter(x => x.winnerNumber || x.employee).length} / 3 WON
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {groupB.map(renderEmpCard)}
            </div>
          </div>

          {/* GROUP C */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(6, 30, 24, 0.85) 0%, rgba(4, 20, 16, 0.95) 100%)',
              border: '2px solid #10b981',
              borderRadius: 16,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid rgba(16, 185, 129, 0.35)', paddingBottom: 8 }}>
              <span style={{ color: '#34d399', fontWeight: 950, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 6, letterSpacing: 0.5 }}>
                🏆 GROUP C (Rounds 3A–3C)
              </span>
              <span style={{ background: '#047857', color: '#ffffff', fontSize: 11.5, fontWeight: 900, padding: '2px 10px', borderRadius: 12, boxShadow: '0 0 10px rgba(4, 120, 87, 0.6)' }}>
                {groupC.filter(x => x.winnerNumber || x.employee).length} / 3 WON
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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

  // Preload celebration audios upfront for instant 0-delay playback
  useEffect(() => {
    preloadFiestaWinnersAudio();
    preloadEmpSounds();
  }, []);

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
      const rNum = data.roundNo || data.round || currentRound;
      setWinner({ ...data, roundNo: rNum, round: rNum });
      setPrize(data.prize);
      setSpinData(null);

      if (soundEnabled) {
        stopEmpSong();
        playWinnerExplosion();
      }
      fireConfetti();

      // Update previous winners
      setPrevWinners(prev => {
        const filtered = prev.filter(w => (w.roundNo !== rNum && w.round !== rNum));
        return [
          ...filtered,
          {
            roundNo: rNum,
            round: rNum,
            group: data.group || roundToGroup(rNum),
            winnerNumber: data.winnerNumber || data.employeeCode,
            employee: data.employee,
            prize: data.prize,
          },
        ].sort((a, b) => (a.roundNo || a.round || 0) - (b.roundNo || b.round || 0));
      });
    },
    'game:next_round': ({ round, group }) => {
      setPhase('idle');
      setCurrentRound(round);
      setCurrentGroup(group);
      setWinner(null);
      setPrize(null);
      fetch('/api/game/public-state')
        .then(r => r.json())
        .then(d => {
          if (d?.winners) {
            setPrevWinners(
              d.winners.map(w => ({
                roundNo: w.roundNo || w.round,
                round: w.roundNo || w.round,
                group: w.group || roundToGroup(w.roundNo || w.round || 1),
                winnerNumber: w.winnerNumber || w.employeeCode,
                employee: w.employee,
                prize: w.prize,
              }))
            );
          }
        })
        .catch(() => {});
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
      setGuestSpinData(null);
      stopAllAudio();
    },
    'guest:reset': () => {
      setGuestSpinning(false);
      setGuestWinner(null);
      setGuestPrize(null);
      setGuestSpinData(null);
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
        } else {
          setGuestWinner(null);
          setGuestPrize(null);
          setGuestSpinData(null);
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
          justifyContent: 'flex-start',
          padding: (activeZone === 'guest' || activeZone === 'fiesta_winners') ? '2px 16px' : '0px 16px 8px',
        }}
      >
        {/* ── ZONE 1: EMPLOYEE DRAW (ROUNDS 1 TO 9) ── */}
        {activeZone === 'employee' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              height: '100%',
              minHeight: 0,
              paddingTop: 4,
            }}
          >
            {/* Top Bar: Progress tracker & Active Group Banner */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '2px 10px 0',
                flexShrink: 0,
                width: '100%',
              }}
            >
              <ProgressTracker currentRound={currentRound} prevWinners={prevWinners} />

              {/* Active Group Banner */}
              {gameStarted && (
                <motion.div
                  key={currentRound}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: GROUP_BG[currentGroup],
                    border: `2px solid ${GROUP_COLORS[currentGroup]}`,
                    borderRadius: 20,
                    padding: '3px 22px',
                    textAlign: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: GROUP_COLORS[currentGroup] }}>
                    🎯 {GROUP_LABELS[currentGroup]} &nbsp;·&nbsp; Round {ROUND_LABELS[currentRound]}
                  </span>
                </motion.div>
              )}
            </div>

            {/* Middle Stage: Centered Drum or Winner Reveal (Shifted slightly up for broadcast framing) */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 16px 36px',
              }}
            >
              {/* 20-Second Drum Animation */}
              {(gameStarted || phase === 'spinning') && (phase === 'spinning' || phase === 'idle') && (
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <p style={{ color: '#555', fontSize: 16, marginBottom: 14, fontWeight: 700, letterSpacing: 0.5 }}>
                    {phase === 'spinning' ? '🎵 EMP Draw Rolling • Shuffling Numbers...' : '⏳ Ready — Waiting for Admin to Spin'}
                  </p>
                  <SlotDrum
                    spinning={phase === 'spinning'}
                    winnerCode={spinData?.winnerCode || winner?.winnerNumber || winner?.employeeCode}
                    sampleCodes={spinData?.sampleCodes}
                    currentGroup={currentGroup}
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
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 240, damping: 20 }}
                    style={{
                      background: '#ffffff',
                      border: '3px solid #D4AF37',
                      borderRadius: 24,
                      padding: '22px 36px',
                      textAlign: 'center',
                      boxShadow: '0 0 60px rgba(212,175,55,0.45), 0 16px 45px rgba(0,0,0,0.12)',
                      maxWidth: 620,
                      width: '100%',
                    }}
                  >
                    <div style={{ fontSize: 36, marginBottom: 2 }}>🏆</div>
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
                          fontSize: 25,
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

              {/* Not started - Grand Welcome Hero Stage */}
              {!gameStarted && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  style={{
                    width: '100%',
                    maxWidth: 880,
                    background: 'linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 250, 244, 0.96) 60%, rgba(255, 243, 235, 0.94) 100%)',
                    borderRadius: 26,
                    border: '2.5px solid #D4AF37',
                    boxShadow: '0 24px 65px rgba(200, 16, 46, 0.16), 0 4px 18px rgba(0, 0, 0, 0.05), inset 0 0 20px rgba(255, 215, 0, 0.12)',
                    padding: '26px 36px',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Top Golden Foil Shimmer Accent */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: 'linear-gradient(90deg, #D4AF37 0%, #FFD700 50%, #D4AF37 100%)',
                      boxShadow: '0 0 12px rgba(255, 215, 0, 0.8)',
                    }}
                  />

                  {/* Royal Top Event Pill */}
                  <motion.div
                    animate={{ opacity: [0.9, 1, 0.9] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'linear-gradient(90deg, #C8102E, #8B0000)',
                      color: '#FFD700',
                      padding: '5px 22px',
                      borderRadius: 20,
                      fontSize: 11.5,
                      fontWeight: 900,
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                      boxShadow: '0 2px 10px rgba(200, 16, 46, 0.35)',
                      marginBottom: 14,
                      border: '1px solid #FFD700',
                    }}
                  >
                    <Crown size={14} style={{ color: '#FFD700' }} />
                    <span>PG GROUP ANNUAL FESTIVE CELEBRATION 2026</span>
                    <Crown size={14} style={{ color: '#FFD700' }} />
                  </motion.div>

                  {/* Official PG Full Logo Medallion (Uploaded with red crest + black PG) */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                    <motion.div
                      animate={{ y: [-3, 3, -3] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#ffffff',
                        padding: '10px 34px',
                        borderRadius: 18,
                        boxShadow: '0 10px 30px rgba(200, 16, 46, 0.14), 0 0 24px rgba(212, 175, 55, 0.28)',
                        border: '2px solid #D4AF37',
                      }}
                    >
                      <img
                        src={LOGO_FULL}
                        alt="PG Logo"
                        style={{
                          height: 64,
                          objectFit: 'contain',
                          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))',
                        }}
                      />
                    </motion.div>
                  </div>

                  {/* Grand Headline */}
                  <h1
                    style={{
                      fontSize: 'clamp(26px, 3vw, 36px)',
                      fontWeight: 950,
                      color: '#8B0000',
                      fontFamily: 'Georgia, serif',
                      margin: '0 0 4px',
                      letterSpacing: 1,
                      textShadow: '0 2px 8px rgba(200, 16, 46, 0.2)',
                    }}
                  >
                    PG FORTUNE FIESTA 2026
                  </h1>

                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#666',
                      letterSpacing: 0.8,
                      marginBottom: 20,
                    }}
                  >
                    ✨ Grand Diwali Lucky Draw & Honored VIP Guest Car Ceremony ✨
                  </div>

                  {/* 3 Executive Feature Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 14,
                      marginTop: 6,
                      marginBottom: 20,
                      textAlign: 'left',
                    }}
                  >
                    {/* Tile 1 */}
                    <div
                      style={{
                        background: 'linear-gradient(135deg, rgba(200, 16, 46, 0.06) 0%, rgba(255, 255, 255, 0.95) 100%)',
                        border: '1.5px solid rgba(200, 16, 46, 0.25)',
                        borderRadius: 16,
                        padding: '12px 16px',
                        boxShadow: '0 4px 14px rgba(200, 16, 46, 0.08)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: '#C8102E',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(200,16,46,0.3)',
                          }}
                        >
                          <Trophy size={16} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 900, color: '#C8102E', letterSpacing: 0.5 }}>
                            9 EMPLOYEE ROUNDS
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#777' }}>
                            Rounds 1A to 3C
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#444', fontWeight: 600, lineHeight: 1.35, marginTop: 4 }}>
                        Groups A, B & C • Bumper Festive Prizes & Shuffling Reels
                      </div>
                    </div>

                    {/* Tile 2 */}
                    <div
                      style={{
                        background: 'linear-gradient(135deg, rgba(74, 21, 75, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)',
                        border: '1.5px solid rgba(74, 21, 75, 0.3)',
                        borderRadius: 16,
                        padding: '12px 16px',
                        boxShadow: '0 4px 14px rgba(74, 21, 75, 0.08)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: '#4A154B',
                            color: '#FFD700',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(74, 21, 75, 0.3)',
                          }}
                        >
                          <Car size={16} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 900, color: '#4A154B', letterSpacing: 0.5 }}>
                            VIP GUEST ROULETTE
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#777' }}>
                            Grand Finale
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#444', fontWeight: 600, lineHeight: 1.35, marginTop: 4 }}>
                        Live 30s Casino Roulette • 1 Honored VIP Guest Car Winner
                      </div>
                    </div>

                    {/* Tile 3 */}
                    <div
                      style={{
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)',
                        border: '1.5px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 16,
                        padding: '12px 16px',
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.08)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: '#059669',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          <Sparkles size={16} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 900, color: '#059669', letterSpacing: 0.5 }}>
                            728 PARTICIPANTS
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#777' }}>
                            100% Automated & Fair
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#444', fontWeight: 600, lineHeight: 1.35, marginTop: 4 }}>
                        Real-Time Random Draw • Live Audience Stage Presentation
                      </div>
                    </div>
                  </div>

                  {/* Stage Readiness Indicator */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <motion.div
                      animate={{ scale: [1, 1.025, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 10,
                        background: 'linear-gradient(90deg, #fff0f0 0%, #fffbf0 50%, #fff0f0 100%)',
                        border: '2px solid #C8102E',
                        padding: '8px 26px',
                        borderRadius: 30,
                        boxShadow: '0 4px 16px rgba(200, 16, 46, 0.18)',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: '#52c41a',
                          boxShadow: '0 0 10px #52c41a',
                        }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#C8102E', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                        LIVE AUDIENCE STAGE • READY FOR GRAND COMMENCEMENT
                      </span>
                    </motion.div>

                    <div style={{ fontSize: 12.5, color: '#777', fontWeight: 600, letterSpacing: 0.5 }}>
                      Admin will initiate Round 1A shortly • Wishing Everyone A Prosperous Diwali 2026! 🪔
                    </div>
                  </div>
                </motion.div>
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
            </div>

            {/* Bottom Section: Previous Drawn Winners Strip (Anchored directly above footer) */}
            {prevWinners.length > 0 && (
              <div
                style={{
                  width: '100%',
                  maxWidth: 1140,
                  flexShrink: 0,
                  marginTop: 'auto',
                  paddingBottom: 8,
                  paddingTop: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#888',
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                    textAlign: 'center',
                    marginBottom: 6,
                  }}
                >
                  🏆 Drawn Rounds Winners ({prevWinners.length} / 9)
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'nowrap',
                    overflowX: 'auto',
                    justifyContent: 'center',
                    padding: '2px 4px',
                  }}
                >
                  {prevWinners.map(w => {
                    const rNo = w.roundNo || w.round;
                    const grp = w.group || roundToGroup(rNo || 1);
                    return (
                      <div
                        key={rNo || w.winnerNumber}
                        style={{
                          background: '#fff',
                          border: `1.5px solid ${GROUP_COLORS[grp] || '#C8102E'}`,
                          borderRadius: 10,
                          padding: '5px 10px',
                          fontSize: 12,
                          textAlign: 'center',
                          minWidth: 96,
                          flex: '0 0 auto',
                          boxShadow: '0 3px 8px rgba(0,0,0,0.06)',
                        }}
                      >
                        <div style={{ fontSize: 10, color: '#777', fontWeight: 700 }}>
                          Round {ROUND_LABELS[rNo] || rNo} · Grp {['A','B','C'][grp - 1]}
                        </div>
                        <div style={{ fontWeight: 900, color: '#C8102E', fontSize: 14, marginTop: 1 }}>
                          #{w.winnerNumber}
                        </div>
                      </div>
                    );
                  })}
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
