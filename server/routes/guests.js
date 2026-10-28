const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const XLSX = require('xlsx');
const crypto = require('crypto');
const Guest = require('../models/Guest');
const GameState = require('../models/GameState');
const Prize = require('../models/Prize');
const auth = require('../middleware/auth');

const SPIN_DURATION = 30000; // 30 seconds
let spinning = false;

// Normalize string for column matching
const norm = (k) => String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const pickCol = (row, candidates) => {
  const map = {};
  Object.keys(row).forEach((k) => {
    map[norm(k)] = row[k];
  });
  for (const c of candidates) {
    const key = norm(c);
    if (map[key] !== undefined && String(map[key]).trim() !== '') {
      return String(map[key]).trim();
    }
  }
  return '';
};

module.exports = (io) => {
  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  const getGuestState = async () => {
    const total = await Guest.countDocuments();
    const eligibleCount = await Guest.countDocuments({ won: false });
    const gameState = await GameState.findOne({ singleton: 'state' })
      .populate('guestWinner')
      .populate('guestPrize');

    let currentWinner = null;
    let currentPrize = null;

    if (gameState?.guestWinner) {
      currentWinner = gameState.guestWinner;
      currentPrize = gameState.guestPrize;
    } else {
      // Check directly from Guest if won
      const lastWon = await Guest.findOne({ won: true }).populate('prize');
      if (lastWon) {
        currentWinner = lastWon;
        currentPrize = lastWon.prize || (await Prize.findOne({ roundNo: 10 }));
      }
    }

    if (!currentPrize) {
      currentPrize = await Prize.findOne({ roundNo: 10 });
    }

    const allWinners = await Guest.find({ won: true }).populate('prize').sort({ serialNo: 1 });

    return {
      status: spinning ? 'spinning' : currentWinner ? 'revealed' : (gameState?.guestStatus || 'idle'),
      spinning,
      duration: SPIN_DURATION,
      total,
      eligibleCount,
      winner: currentWinner,
      prize: currentPrize,
      allWinners,
    };
  };

  // GET /api/guests — all guests sorted by serialNo
  router.get('/', async (req, res) => {
    try {
      const guests = await Guest.find().sort({ serialNo: 1 });
      res.json(guests);
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/guests/state — current guest draw state
  router.get('/state', async (req, res) => {
    try {
      const state = await getGuestState();
      res.json(state);
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/guests/upload — upload CSV or XLSX/XLS
  router.post('/upload', auth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      if (spinning) return res.status(409).json({ message: 'Roulette spin is in progress' });

      const mode = req.body.mode || 'replace'; // 'replace' or 'append'
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        return res.status(400).json({ message: 'Uploaded file has no sheets' });
      }

      // Pick first sheet with data
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        return res.status(400).json({ message: 'No data rows found in sheet' });
      }

      let existingCount = mode === 'append' ? await Guest.countDocuments() : 0;
      const guests = [];
      const seenSerials = new Set();
      const errors = [];

      rawRows.forEach((row, i) => {
        const name = pickCol(row, [
          'name', 'guest name', 'guest', 'full name', 'employee name', 'person name'
        ]);
        const unit = pickCol(row, [
          'unit', 'current entity', 'entity', 'location', 'plant', 'branch', 'site', 'dept', 'department'
        ]);
        let serialNoRaw = pickCol(row, [
          'serial no.', 'serial no', 'serial number', 's.no', 'sno', 'sr no', 'sr. no.', 'no.', 'no', 'sl no', 'sl. no.', 'lucky number', 'id'
        ]);

        if (!name && !serialNoRaw && !unit) return; // blank row
        if (!name) {
          errors.push(`Row ${i + 2}: Name is missing`);
          return;
        }

        let serialNo = parseInt(serialNoRaw, 10);
        if (isNaN(serialNo) || serialNo <= 0) {
          // Auto assign sequential number
          serialNo = existingCount + guests.length + 1;
        }

        if (seenSerials.has(serialNo)) {
          // Adjust to avoid collision within the file
          serialNo = Math.max(...Array.from(seenSerials), existingCount + guests.length) + 1;
        }
        seenSerials.add(serialNo);

        guests.push({
          serialNo,
          name: name.trim(),
          unit: unit.trim(),
          guestNumber: String(serialNo),
          won: false,
          wonRound: null,
        });
      });

      if (errors.length > 0 && guests.length === 0) {
        return res.status(400).json({ message: 'File has errors', errors: errors.slice(0, 10) });
      }
      if (guests.length === 0) {
        return res.status(400).json({ message: 'No valid guest records found in file' });
      }

      if (mode === 'replace') {
        await Guest.deleteMany({});
        await GameState.findOneAndUpdate(
          { singleton: 'state' },
          { guestStatus: 'idle', guestWinner: null, guestPrize: null }
        );
        await Guest.insertMany(guests);
      } else {
        // In append mode, ensure unique serialNo against existing
        const existingSerials = new Set((await Guest.find({}, 'serialNo')).map(g => g.serialNo));
        let nextSerial = (await Guest.findOne().sort({ serialNo: -1 }))?.serialNo || 0;

        const adjusted = guests.map(g => {
          if (existingSerials.has(g.serialNo)) {
            nextSerial += 1;
            existingSerials.add(nextSerial);
            return { ...g, serialNo: nextSerial, guestNumber: String(nextSerial) };
          }
          existingSerials.add(g.serialNo);
          return g;
        });
        await Guest.insertMany(adjusted);
      }

      const total = await Guest.countDocuments();
      if (io) {
        io.emit('guest:updated', { total });
        const st = await getGuestState();
        io.emit('guest:state', st);
      }

      res.json({
        ok: true,
        message: mode === 'replace'
          ? `Successfully imported ${guests.length} guests!`
          : `Successfully appended ${guests.length} guests!`,
        count: guests.length,
        total,
      });
    } catch (e) {
      console.error('Guest upload error:', e);
      res.status(500).json({ message: 'Failed to process guest sheet: ' + e.message });
    }
  });

  // Handler for adding a guest (supports POST /api/guests and POST /api/guests/add)
  const handleAddGuest = async (req, res) => {
    try {
      if (spinning) return res.status(409).json({ message: 'Roulette spin is in progress' });
      const { serialNo: inputSerial, name, unit } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Guest name is required' });
      }

      let serialNo = parseInt(inputSerial, 10);
      if (isNaN(serialNo) || serialNo <= 0) {
        const last = await Guest.findOne().sort({ serialNo: -1 });
        serialNo = last ? last.serialNo + 1 : 1;
      } else {
        const existing = await Guest.findOne({ serialNo });
        if (existing) {
          return res.status(400).json({ message: `Serial Number ${serialNo} already exists!` });
        }
      }

      const guest = await Guest.create({
        serialNo,
        name: name.trim(),
        unit: (unit || '').trim(),
        guestNumber: String(serialNo),
        won: false,
        wonRound: null,
      });

      if (io) {
        io.emit('guest:updated');
        const st = await getGuestState();
        io.emit('guest:state', st);
      }

      res.json({ ok: true, guest, message: 'Guest added successfully' });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  };

  router.post('/', auth, handleAddGuest);
  router.post('/add', auth, handleAddGuest);

  // Handler for clearing all guests (supports DELETE /api/guests/all and DELETE /api/guests)
  // MUST be registered BEFORE router.delete('/:id') to avoid Express capturing "all" as an :id!
  const handleClearAllGuests = async (req, res) => {
    try {
      if (spinning) return res.status(409).json({ message: 'Roulette spin is in progress' });
      await Guest.deleteMany({});
      await GameState.findOneAndUpdate(
        { singleton: 'state' },
        { guestStatus: 'idle', guestWinner: null, guestPrize: null }
      );

      if (io) {
        io.emit('guest:updated', { total: 0 });
        const st = await getGuestState();
        io.emit('guest:state', st);
      }

      res.json({ ok: true, message: 'All guests cleared successfully' });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  };

  router.delete('/all', auth, handleClearAllGuests);
  router.delete('/', auth, handleClearAllGuests);

  // POST /api/guests/batch-delete — delete multiple guests
  router.post('/batch-delete', auth, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'No guest IDs provided' });
      }
      await Guest.deleteMany({ _id: { $in: ids } });

      if (io) {
        io.emit('guest:updated');
        const st = await getGuestState();
        io.emit('guest:state', st);
      }

      res.json({ ok: true, message: `Deleted ${ids.length} guest(s)` });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  // PUT /api/guests/:id — update single guest
  router.put('/:id', auth, async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid guest ID' });
      }

      const { serialNo, name, unit } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Guest name is required' });
      }

      const parsedSerial = parseInt(serialNo, 10);
      if (parsedSerial) {
        const existing = await Guest.findOne({ serialNo: parsedSerial, _id: { $ne: req.params.id } });
        if (existing) {
          return res.status(400).json({ message: `Serial number ${parsedSerial} is already assigned to another guest` });
        }
      }

      const updated = await Guest.findByIdAndUpdate(
        req.params.id,
        {
          name: name.trim(),
          unit: (unit || '').trim(),
          ...(parsedSerial ? { serialNo: parsedSerial, guestNumber: String(parsedSerial) } : {}),
        },
        { new: true }
      );

      if (!updated) return res.status(404).json({ message: 'Guest not found' });

      if (io) {
        io.emit('guest:updated');
        const st = await getGuestState();
        io.emit('guest:state', st);
      }

      res.json({ ok: true, guest: updated, message: 'Guest updated successfully' });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  // DELETE /api/guests/:id — delete single guest
  router.delete('/:id', auth, async (req, res) => {
    try {
      if (req.params.id === 'all') {
        return handleClearAllGuests(req, res);
      }
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid guest ID' });
      }

      const deleted = await Guest.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Guest not found' });

      // If deleted guest was winner, reset winner state
      const state = await GameState.findOne({ singleton: 'state' });
      if (state && String(state.guestWinner) === String(req.params.id)) {
        await GameState.findOneAndUpdate(
          { singleton: 'state' },
          { guestStatus: 'idle', guestWinner: null, guestPrize: null }
        );
      }

      if (io) {
        io.emit('guest:updated');
        const st = await getGuestState();
        io.emit('guest:state', st);
      }

      res.json({ ok: true, message: 'Guest deleted' });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/guests/spin — start 30s roulette wheel spin
  router.post('/spin', auth, async (req, res) => {
    try {
      if (spinning) return res.status(409).json({ message: 'Roulette wheel is already spinning' });

      const total = await Guest.countDocuments();
      if (total === 0) {
        return res.status(400).json({ message: 'No guests found. Please add or upload guests first!' });
      }

      const pool = await Guest.find({ won: false }).sort({ serialNo: 1 });
      if (!pool.length) {
        return res.status(400).json({ message: 'All guests have already won or no eligible guests available' });
      }

      // Pick random winner from eligible pool
      const winnerIndex = crypto.randomInt(0, pool.length);
      const winner = pool[winnerIndex];

      // Get prize for Round 10 (Guest Round)
      const prize = await Prize.findOne({ roundNo: 10 });

      // All guests for roulette wheel pockets
      const allGuests = await Guest.find().sort({ serialNo: 1 });
      const rouletteList = allGuests.map(g => ({
        _id: g._id,
        serialNo: g.serialNo,
        name: g.name,
        unit: g.unit,
        won: g.won,
      }));

      spinning = true;

      await GameState.findOneAndUpdate(
        { singleton: 'state' },
        { guestStatus: 'spinning', guestWinner: null, guestPrize: prize?._id || null },
        { upsert: true }
      );

      // Broadcast spin start with 30s duration
      if (io) {
        io.emit('guest:spin_start', {
          duration: SPIN_DURATION,
          allGuests: rouletteList,
          winningSerialNo: winner.serialNo,
          targetWinner: {
            _id: winner._id,
            serialNo: winner.serialNo,
            name: winner.name,
            unit: winner.unit,
          },
          prize: prize ? { name: prize.name, description: prize.description, imageUrl: prize.imageUrl } : null,
        });
      }

      res.json({
        ok: true,
        message: 'Guest roulette spin started (30 seconds)',
        duration: SPIN_DURATION,
        winningSerialNo: winner.serialNo,
      });

      // 30 seconds timer for the roulette reveal
      setTimeout(async () => {
        try {
          winner.won = true;
          winner.wonRound = 1;
          winner.prize = prize?._id || null;
          await winner.save();

          await GameState.findOneAndUpdate(
            { singleton: 'state' },
            {
              guestStatus: 'revealed',
              guestWinner: winner._id,
              guestPrize: prize?._id || null,
            }
          );

          if (io) {
            io.emit('guest:winner_revealed', {
              winner: {
                _id: winner._id,
                serialNo: winner.serialNo,
                name: winner.name,
                unit: winner.unit,
                guestNumber: winner.guestNumber,
              },
              prize: prize ? { name: prize.name, description: prize.description, imageUrl: prize.imageUrl } : null,
            });
            const st = await getGuestState();
            io.emit('guest:state', st);
          }
        } catch (err) {
          console.error('Error during guest spin reveal timeout:', err);
        } finally {
          spinning = false;
        }
      }, SPIN_DURATION);

    } catch (e) {
      console.error('Guest spin error:', e);
      spinning = false;
      res.status(500).json({ message: e.message || 'Spin failed' });
    }
  });

  // POST /api/guests/revert — revert guest winner if absent / not available, allowing another spin
  router.post('/revert', auth, async (req, res) => {
    try {
      if (spinning) return res.status(409).json({ message: 'Roulette spin is in progress' });

      const state = await GameState.findOne({ singleton: 'state' });
      if (state?.guestWinner) {
        await Guest.findByIdAndUpdate(state.guestWinner, { won: false, wonRound: null });
      } else {
        // Find any guest that was marked won
        await Guest.updateMany({ won: true }, { won: false, wonRound: null });
      }

      await GameState.findOneAndUpdate(
        { singleton: 'state' },
        { guestStatus: 'idle', guestWinner: null, guestPrize: null }
      );

      if (io) {
        io.emit('guest:reverted', { message: 'Guest winner reverted' });
        const st = await getGuestState();
        io.emit('guest:state', st);
      }

      res.json({ ok: true, message: 'Winner reverted successfully. You can spin again!' });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/guests/reset — reset guest draw state
  router.post('/reset', auth, async (req, res) => {
    try {
      if (spinning) return res.status(409).json({ message: 'Roulette spin is in progress' });

      await Guest.updateMany({}, { won: false, wonRound: null });
      await GameState.findOneAndUpdate(
        { singleton: 'state' },
        { guestStatus: 'idle', guestWinner: null, guestPrize: null }
      );

      if (io) {
        io.emit('guest:reset');
        const st = await getGuestState();
        io.emit('guest:state', st);
      }

      res.json({ ok: true, message: 'Guest game state reset' });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  return router;
};
