const AudioContext = window.AudioContext || window.webkitAudioContext;
let ctx = null;

function getCtx() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function resumeAudio() {
  try {
    const ac = getCtx();
    if (ac && ac.state === 'suspended') ac.resume();
  } catch {}
}

export function playTick() {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.frequency.setValueAtTime(220, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, ac.currentTime + 0.05);
    gain.gain.setValueAtTime(0.35, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.06);
    osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.06);
  } catch {}
}

export function playDrumRoll(duration = 10000) {
  resumeAudio();
  let elapsed = 0;
  let interval = 80;
  const run = () => {
    if (elapsed >= duration - 400) return;
    playTick();
    const progress = elapsed / duration;
    // Accelerate as it gets closer to reveal, then build suspense
    if (progress < 0.6) interval = Math.max(30, 80 - progress * 80);
    else if (progress < 0.9) interval = Math.max(25, 30 - (progress - 0.6) * 15);
    else interval = Math.min(180, 25 + (progress - 0.9) * 1200);
    elapsed += interval;
    setTimeout(run, interval);
  };
  run();
}

export function playGameStartSound() {
  try {
    resumeAudio();
    const ac = getCtx();
    // Uplifting celebratory royal fanfare chords for game start
    const notes = [
      { f: 392.00, t: 0.0, d: 0.25 }, // G4
      { f: 523.25, t: 0.2, d: 0.3 },  // C5
      { f: 659.25, t: 0.45, d: 0.3 }, // E5
      { f: 783.99, t: 0.7, d: 0.5 },  // G5
      { f: 1046.50, t: 1.1, d: 1.0 }, // C6 grand finish
      { f: 523.25, t: 1.1, d: 1.0 },  // C5 harmony
    ];
    notes.forEach(({ f, t, d }) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = 'triangle';
      const startT = ac.currentTime + t;
      osc.frequency.setValueAtTime(f, startT);
      gain.gain.setValueAtTime(0, startT);
      gain.gain.linearRampToValueAtTime(0.35, startT + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, startT + d);
      osc.start(startT); osc.stop(startT + d + 0.05);
    });
  } catch {}
}

export function playWinnerFanfare() {
  try {
    resumeAudio();
    const ac = getCtx();
    const notes = [
      { f: 523.25, t: 0.0 },
      { f: 659.25, t: 0.15 },
      { f: 783.99, t: 0.3 },
      { f: 1046.5, t: 0.45 },
      { f: 1318.5, t: 0.7 },
      { f: 1567.98, t: 0.95 },
    ];
    notes.forEach(({ f, t }) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = 'sine';
      const startTime = ac.currentTime + t;
      osc.frequency.setValueAtTime(f, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.4, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
      osc.start(startTime); osc.stop(startTime + 0.55);
    });
  } catch {}
}

export function playSuspense() {
  try {
    resumeAudio();
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, ac.currentTime);
    osc.frequency.linearRampToValueAtTime(440, ac.currentTime + 3.5);
    gain.gain.setValueAtTime(0.08, ac.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ac.currentTime + 3.0);
    gain.gain.linearRampToValueAtTime(0, ac.currentTime + 3.6);
    osc.start(ac.currentTime); osc.stop(ac.currentTime + 3.6);
  } catch {}
}

// ── GLOBAL AUDIO REGISTRY & MUTE STATE ──
let isGlobalMuted = false;
const activeAudios = new Set();

export function setAudioMuted(muted) {
  isGlobalMuted = Boolean(muted);
  if (isGlobalMuted) {
    stopAllAudio();
  }
}

export function isAudioMuted() {
  return isGlobalMuted;
}

function safeStopAudio(audio) {
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {}
}

// ── EMP SONG AUDIO FOR EMPLOYEE LUCKY DRAW ──
let empSongAudio = null;

export function preloadEmpSounds() {
  try {
    if (!empSongAudio) {
      empSongAudio = new Audio('/emp_song.mp3');
      empSongAudio.preload = 'auto';
      empSongAudio.load();
    }
    if (!winnerExplosionAudio) {
      winnerExplosionAudio = new Audio('/winner_explosion.aac');
      winnerExplosionAudio.preload = 'auto';
      winnerExplosionAudio.load();
    }
  } catch {}
}

export function playEmpSong() {
  if (isGlobalMuted) return;
  try {
    resumeAudio();
    stopAllAudio();
    empSongAudio = new Audio('/emp_song.mp3');
    empSongAudio.loop = true;
    empSongAudio.volume = 0.95;
    activeAudios.add(empSongAudio);

    const playPromise = empSongAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        try {
          if (isGlobalMuted) return;
          const fallback = new Audio('/emp_song.mpeg');
          fallback.loop = true;
          fallback.volume = 0.95;
          activeAudios.add(fallback);
          fallback.play().catch(() => {});
          empSongAudio = fallback;
        } catch {}
      });
    }
  } catch (err) {
    console.warn('Error playing EMP song:', err);
  }
}

export function stopEmpSong() {
  safeStopAudio(empSongAudio);
  empSongAudio = null;
}

// ── HALL OF FAME SONG & FIRECRACKER AUDIO FOR FIESTA WINNERS SCREEN ──
let hallOfFameAudio = null;
let crackerAudio = null;
let crackerTimer = null;

export function preloadFiestaWinnersAudio() {
  try {
    if (!hallOfFameAudio) {
      hallOfFameAudio = new Audio('/hall_of_fame.mp3');
      hallOfFameAudio.preload = 'auto';
      hallOfFameAudio.loop = true;
      hallOfFameAudio.volume = 0.95;
      hallOfFameAudio.load();
    }
    if (!crackerAudio) {
      crackerAudio = new Audio('/cracker_sound.mp3');
      crackerAudio.preload = 'auto';
      crackerAudio.loop = false;
      crackerAudio.volume = 0.90;
      crackerAudio.load();
    }
  } catch (err) {
    console.warn('Audio preloading error:', err);
  }
}

export function preloadHallOfFameSound() {
  preloadFiestaWinnersAudio();
}

export function playFiestaCelebrationAudio() {
  if (isGlobalMuted) return;
  try {
    resumeAudio();

    if (crackerTimer) {
      clearTimeout(crackerTimer);
      crackerTimer = null;
    }

    // Stop any other active game sounds
    if (empSongAudio) { safeStopAudio(empSongAudio); empSongAudio = null; }
    if (squidGameAudio) { safeStopAudio(squidGameAudio); squidGameAudio = null; }
    if (countdownBeepAudio) { safeStopAudio(countdownBeepAudio); countdownBeepAudio = null; }
    if (winnerExplosionAudio) { safeStopAudio(winnerExplosionAudio); winnerExplosionAudio = null; }

    // Ensure instances exist and preloaded
    if (!hallOfFameAudio) {
      hallOfFameAudio = new Audio('/hall_of_fame.mp3');
      hallOfFameAudio.preload = 'auto';
      hallOfFameAudio.loop = true;
      hallOfFameAudio.volume = 0.95;
    }
    if (!crackerAudio) {
      crackerAudio = new Audio('/cracker_sound.mp3');
      crackerAudio.preload = 'auto';
      crackerAudio.loop = false;
      crackerAudio.volume = 0.90;
    }

    // 1. Play Hall of Fame song IMMEDIATELY (0 delay)
    try {
      hallOfFameAudio.currentTime = 0;
      hallOfFameAudio.loop = true;
      hallOfFameAudio.volume = 0.95;
      activeAudios.add(hallOfFameAudio);
      const playHof = hallOfFameAudio.play();
      if (playHof !== undefined) {
        playHof.catch(err => {
          console.warn('Hall of Fame play error:', err);
        });
      }
    } catch (e) {
      console.warn('Error playing Hall of Fame:', e);
    }

    // 2. Play Firecracker background sound simultaneously together with Hall of Fame
    try {
      crackerAudio.currentTime = 0;
      crackerAudio.loop = false;
      crackerAudio.volume = 0.90;
      activeAudios.add(crackerAudio);
      const playCracker = crackerAudio.play();
      if (playCracker !== undefined) {
        playCracker.catch(err => {
          console.warn('Cracker play error:', err);
        });
      }
    } catch (e) {
      console.warn('Error playing cracker sound:', e);
    }

    // 3. Exactly after 28 seconds: stop the cracker sound, while Hall of Fame keeps playing continuously till the end!
    crackerTimer = setTimeout(() => {
      if (crackerAudio) {
        try {
          crackerAudio.pause();
          crackerAudio.currentTime = 0;
          activeAudios.delete(crackerAudio);
        } catch {}
      }
      crackerTimer = null;
    }, 28000);

  } catch (err) {
    console.warn('Error in playFiestaCelebrationAudio:', err);
  }
}

export function playHallOfFameSong() {
  playFiestaCelebrationAudio();
}

export function stopFiestaCelebrationAudio() {
  if (crackerTimer) {
    clearTimeout(crackerTimer);
    crackerTimer = null;
  }
  if (crackerAudio) {
    try {
      crackerAudio.pause();
      crackerAudio.currentTime = 0;
      activeAudios.delete(crackerAudio);
    } catch {}
  }
  if (hallOfFameAudio) {
    try {
      hallOfFameAudio.pause();
      hallOfFameAudio.currentTime = 0;
      activeAudios.delete(hallOfFameAudio);
    } catch {}
  }
}

export function stopHallOfFameSong() {
  stopFiestaCelebrationAudio();
}

// ── SQUID GAME, COUNTDOWN BEEP & EXPLOSION AUDIO FOR VIP GUEST ROULETTE ──
let squidGameAudio = null;
let countdownBeepAudio = null;
let winnerExplosionAudio = null;

export function playSquidGameSound() {
  if (isGlobalMuted) return;
  try {
    resumeAudio();
    stopAllAudio();
    squidGameAudio = new Audio('/squid_game_sound.mp3');
    squidGameAudio.loop = true;
    squidGameAudio.volume = 0.9;
    activeAudios.add(squidGameAudio);

    const playPromise = squidGameAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('Squid game audio play prevented:', err);
      });
    }
  } catch (err) {
    console.warn('Error playing squid game audio:', err);
  }
}

export function stopSquidGameSound() {
  safeStopAudio(squidGameAudio);
  squidGameAudio = null;
}

export function playGuestCountdownBeep() {
  if (isGlobalMuted) return;
  try {
    resumeAudio();
    safeStopAudio(squidGameAudio);
    squidGameAudio = null;

    countdownBeepAudio = new Audio('/guest_countdown_beep.aac');
    countdownBeepAudio.volume = 1.0;
    activeAudios.add(countdownBeepAudio);

    const playPromise = countdownBeepAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        try {
          if (isGlobalMuted) return;
          const fallback = new Audio('/guest_countdown_beep.mp3');
          fallback.volume = 1.0;
          activeAudios.add(fallback);
          fallback.play().catch(() => {});
          countdownBeepAudio = fallback;
        } catch {}
      });
    }
  } catch (err) {
    console.warn('Error playing countdown beep:', err);
  }
}

export function stopGuestCountdownBeep() {
  safeStopAudio(countdownBeepAudio);
  countdownBeepAudio = null;
}

export function preloadGuestSounds() {
  try {
    if (!countdownBeepAudio) {
      countdownBeepAudio = new Audio('/guest_countdown_beep.aac');
      countdownBeepAudio.load();
    }
    if (!winnerExplosionAudio) {
      winnerExplosionAudio = new Audio('/winner_explosion.aac');
      winnerExplosionAudio.load();
    }
  } catch {}
}

export function playSynthesizedExplosionBoom() {
  try {
    resumeAudio();
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);

    // Deep thunderous sub-bass explosion punch
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(25, ac.currentTime + 1.4);

    gain.gain.setValueAtTime(0.75, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 1.8);

    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 1.9);
  } catch {}
}

export function playTripleWinnerExplosion(onEnded) {
  if (isGlobalMuted) {
    if (onEnded) onEnded();
    return;
  }
  try {
    resumeAudio();
    stopAllAudio();

    // 1st explosion blast
    playWinnerExplosion();

    // 2nd explosion blast (continuous cadence at 450ms)
    setTimeout(() => {
      if (isGlobalMuted) return;
      try {
        playSynthesizedExplosionBoom();
        const a2 = new Audio('/winner_explosion.aac');
        a2.volume = 1.0;
        activeAudios.add(a2);
        a2.play().catch(() => {
          try {
            if (isGlobalMuted) return;
            const f2 = new Audio('/winner_explosion.mp3');
            activeAudios.add(f2);
            f2.play().catch(() => {});
          } catch {}
        });
      } catch {}
    }, 450);

    // 3rd explosion blast (continuous cadence at 950ms)
    setTimeout(() => {
      if (isGlobalMuted) {
        if (onEnded) onEnded();
        return;
      }
      try {
        playSynthesizedExplosionBoom();
        const a3 = new Audio('/winner_explosion.aac');
        a3.volume = 1.0;
        activeAudios.add(a3);
        a3.onended = () => {
          stopAllAudio();
          if (onEnded) onEnded();
        };
        a3.play().catch(() => {
          try {
            if (isGlobalMuted) {
              if (onEnded) onEnded();
              return;
            }
            const fallback3 = new Audio('/winner_explosion.mp3');
            activeAudios.add(fallback3);
            fallback3.onended = () => { stopAllAudio(); if (onEnded) onEnded(); };
            fallback3.play().catch(() => { if (onEnded) onEnded(); });
          } catch {
            if (onEnded) onEnded();
          }
        });
      } catch {
        if (onEnded) onEnded();
      }
    }, 950);
  } catch (err) {
    console.warn('Error in playTripleWinnerExplosion:', err);
    if (onEnded) onEnded();
  }
}

export function playWinnerExplosion(onEnded) {
  if (isGlobalMuted) {
    if (onEnded) onEnded();
    return;
  }
  try {
    resumeAudio();
    stopAllAudio();

    // Instant acoustic explosion punch
    playSynthesizedExplosionBoom();

    winnerExplosionAudio = new Audio('/winner_explosion.aac');
    winnerExplosionAudio.currentTime = 0;
    winnerExplosionAudio.volume = 1.0;
    activeAudios.add(winnerExplosionAudio);

    winnerExplosionAudio.onended = () => {
      stopAllAudio();
      if (onEnded) onEnded();
    };

    const playPromise = winnerExplosionAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        try {
          if (isGlobalMuted) {
            if (onEnded) onEnded();
            return;
          }
          const fallback = new Audio('/winner_explosion.mp3');
          fallback.currentTime = 0;
          fallback.volume = 1.0;
          activeAudios.add(fallback);
          fallback.onended = () => {
            stopAllAudio();
            if (onEnded) onEnded();
          };
          fallback.play().catch(() => {});
          winnerExplosionAudio = fallback;
        } catch {
          if (onEnded) onEnded();
        }
      });
    }
  } catch (err) {
    console.warn('Error playing winner explosion audio:', err);
    if (onEnded) onEnded();
  }
}

export function stopWinnerExplosion() {
  safeStopAudio(winnerExplosionAudio);
  winnerExplosionAudio = null;
}

export function stopAllAudio() {
  safeStopAudio(empSongAudio);
  empSongAudio = null;

  safeStopAudio(hallOfFameAudio);
  hallOfFameAudio = null;

  safeStopAudio(squidGameAudio);
  squidGameAudio = null;

  safeStopAudio(countdownBeepAudio);
  countdownBeepAudio = null;

  safeStopAudio(winnerExplosionAudio);
  winnerExplosionAudio = null;

  activeAudios.forEach(a => {
    safeStopAudio(a);
  });
  activeAudios.clear();
}

export function stopAllGuestAudio() {
  stopAllAudio();
}

export function playClockTick(countdownValue) {
  try {
    resumeAudio();
    const ac = getCtx();
    
    // Crisp grandfather clock / metallic countdown pulse
    const osc1 = ac.createOscillator();
    const osc2 = ac.createOscillator();
    const gainNode = ac.createGain();

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ac.destination);

    // Dynamic pitch escalation from 5 down to 0
    const baseFreq = countdownValue === 0 ? 880 : 380 + (5 - countdownValue) * 75;
    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(baseFreq, ac.currentTime);
    osc2.frequency.setValueAtTime(baseFreq * 1.5, ac.currentTime);

    // Mechanical click envelope
    gainNode.gain.setValueAtTime(0, ac.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.65, ac.currentTime + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.22);

    osc1.start(ac.currentTime);
    osc2.start(ac.currentTime);
    osc1.stop(ac.currentTime + 0.23);
    osc2.stop(ac.currentTime + 0.23);
  } catch {}
}

export function playRouletteBallClick() {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'sine';
    const freq = 1200 + Math.random() * 400;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ac.currentTime + 0.04);
    gain.gain.setValueAtTime(0.2, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.04);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.05);
  } catch {}
}
