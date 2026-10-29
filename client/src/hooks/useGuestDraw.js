import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const API = '/api/guests';

export default function useGuestDraw() {
  const [guests, setGuests] = useState([]);
  const [state, setState] = useState({ maxRounds: 3, roundsDone: 0, winners: [], spinning: false });
  const [rolling, setRolling] = useState(null); // guest currently highlighted
  const [spinning, setSpinning] = useState(false);
  const [justWon, setJustWon] = useState(null);
  const guestsRef = useRef([]);
  const timer = useRef(null);

  const stopRolling = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const startRolling = useCallback(() => {
    stopRolling();
    setJustWon(null);
    setSpinning(true);
    let speed = 60;
    const tick = () => {
      const pool = guestsRef.current.filter((g) => !g.won);
      if (pool.length) setRolling(pool[Math.floor(Math.random() * pool.length)]);
    };
    timer.current = setInterval(tick, speed);
  }, []);

  const refresh = useCallback(async () => {
    const [g, s] = await Promise.all([
      fetch(API).then((r) => r.json()),
      fetch(`${API}/state`).then((r) => r.json()),
    ]);
    guestsRef.current = g;
    setGuests(g);
    setState(s);
    if (s.spinning) startRolling();
  }, [startRolling]);

  useEffect(() => {
    refresh();
    // ASSUMPTION: Socket.IO is reachable on the same origin (Vite proxy). Otherwise set VITE_SOCKET_URL.
    const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'https://pg-fortune-fiesta-server.onrender.com';
    const socket = io(socketUrl, { transports: ['websocket', 'polling'] });

    socket.on('guest:spinStart', () => startRolling());

    socket.on('guest:winner', ({ round, winner }) => {
      stopRolling();
      setSpinning(false);
      setRolling(winner);
      setJustWon({ ...winner, wonRound: round });
      guestsRef.current = guestsRef.current.map((g) =>
        g._id === winner._id ? { ...g, won: true, wonRound: round } : g
      );
      setGuests(guestsRef.current);
      setState((s) => ({
        ...s,
        roundsDone: round,
        winners: [...s.winners.filter((w) => w._id !== winner._id), { ...winner, won: true, wonRound: round }],
        spinning: false,
      }));
    });

    const reload = () => {
      stopRolling();
      setSpinning(false);
      setRolling(null);
      setJustWon(null);
      refresh();
    };
    socket.on('guest:reset', reload);
    socket.on('guest:updated', reload);

    return () => {
      stopRolling();
      socket.disconnect();
    };
  }, [refresh, startRolling]);

  return { guests, state, rolling, spinning, justWon, refresh };
}