const router = require('express').Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const GameState  = require('../models/GameState');
const Winner     = require('../models/Winner');
const Prize      = require('../models/Prize');
const DrawConfig = require('../models/DrawConfig');
const Employee   = require('../models/Employee');
const Guest      = require('../models/Guest');

function groupForRound(round) {
  if (round <= 3) return 1;
  if (round <= 6) return 2;
  return 3;
}

// POST /start
router.post('/start', auth, async (req, res) => {
  try {
    const io = req.app.get('io');
    const totalEmps = await Employee.countDocuments();
    if (totalEmps === 0) {
      return res.status(400).json({ message: 'No employees found. Please upload employee list first!' });
    }
    const groupSize = Math.ceil(totalEmps / 3);

    await GameState.findOneAndUpdate(
      { singleton: 'state' },
      { isActive: true, status: 'idle', currentRound: 1, totalEmployees: totalEmps, groupSize },
      { upsert: true }
    );
    await DrawConfig.findOneAndUpdate(
      { singleton: 'config' },
      { totalCards: totalEmps, groupSize },
      { upsert: true }
    );

    if (io) io.emit('game:start');
    res.json({ message: 'Game started successfully', totalEmployees: totalEmps, groupSize });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST /spin
router.post('/spin', auth, async (req, res) => {
  try {
    const io     = req.app.get('io');
    const state  = await GameState.findOne({ singleton: 'state' });

    if (!state || !state.isActive)
      return res.status(400).json({ message: 'Start game first' });
    if (state.status === 'spinning')
      return res.status(400).json({ message: 'Already spinning' });

    const round = state.currentRound;
    if (round > 9) return res.status(400).json({ message: 'All 9 rounds complete' });

    // Check if winner already drawn this round
    const existing = await Winner.findOne({ roundNo: round });
    if (existing) return res.status(400).json({ message: 'Winner already drawn for this round' });

    const group = groupForRound(round);

    // Collect already-won employee IDs
    const prevWinners = await Winner.find();
    const wonEmployeeIds = prevWinners.map(w => w.employee).filter(Boolean);

    // Find eligible employees in this group from the saved employee list
    const eligibleEmployees = await Employee.find({
      group,
      _id: { $nin: wonEmployeeIds },
      hasWon: false
    });

    if (eligibleEmployees.length === 0) {
      const gName = group === 1 ? 'Group A' : group === 2 ? 'Group B' : 'Group C';
      return res.status(400).json({ message: `No eligible employees remaining in ${gName}` });
    }

    // Pick a random employee from the group
    const winnerIndex = crypto.randomInt(0, eligibleEmployees.length);
    const winnerEmp = eligibleEmployees[winnerIndex];
    const winnerCode = winnerEmp.payCode || winnerEmp.employeeId || ('EMP' + winnerEmp.serialNo);

    // Sample employee codes for the 10-second drum animation
    const sampleCodes = eligibleEmployees.map(e => e.payCode || e.employeeId).filter(Boolean);

    // Get prize for this round
    const prize = await Prize.findOne({ roundNo: round });

    await GameState.findOneAndUpdate(
      { singleton: 'state' },
      { status: 'spinning' },
      { upsert: true }
    );

    // 20-second spin animation broadcast with authentic group sample codes
    if (io) {
      io.emit('game:spin_start', {
        round,
        group,
        duration: 20000,
        sampleCodes: sampleCodes.slice(0, 200),
        winnerLength: winnerCode.length,
      });
    }

    // After 20 seconds: reveal winner and store in database
    setTimeout(async () => {
      try {
        const winner = await Winner.create({
          roundNo: round,
          group,
          winnerNumber: winnerCode,
          employeeCode: winnerCode,
          employee: winnerEmp._id,
          prize: prize?._id || null,
        });

        await Employee.findByIdAndUpdate(winnerEmp._id, { hasWon: true });

        await GameState.findOneAndUpdate(
          { singleton: 'state' },
          { status: 'revealed' }
        );

        if (io) {
          io.emit('game:winner_revealed', {
            round,
            roundNo: round,
            group,
            winnerNumber: winnerCode,
            employeeCode: winnerCode,
            employee: {
              _id: winnerEmp._id,
              serialNo: winnerEmp.serialNo,
              name: winnerEmp.name,
              payCode: winnerEmp.payCode,
              employeeId: winnerEmp.employeeId || winnerEmp.payCode,
              department: winnerEmp.department,
              designation: winnerEmp.designation,
              unit: winnerEmp.unit,
              gender: winnerEmp.gender,
            },
            prize: prize ? { name: prize.name, description: prize.description, imageUrl: prize.imageUrl } : null,
          });
        }
      } catch (err) {
        console.error('Error in spin reveal timeout:', err);
      }
    }, 20000);

    res.json({ message: 'Spinning started for 20 seconds', round, group });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST /spin-again — redraw same round (previous winner was absent)
router.post('/spin-again', auth, async (req, res) => {
  try {
    const io     = req.app.get('io');
    const state  = await GameState.findOne({ singleton: 'state' });

    if (!state || state.status !== 'revealed')
      return res.status(400).json({ message: 'Can only spin again after a winner is revealed' });

    const round = state.currentRound;
    const group = groupForRound(round);

    // Remove previous winner for this round and mark them hasWon: false
    const prevWinner = await Winner.findOne({ roundNo: round });
    if (prevWinner && prevWinner.employee) {
      await Employee.findByIdAndUpdate(prevWinner.employee, { hasWon: false });
    }
    await Winner.deleteOne({ roundNo: round });

    // Find all remaining winners
    const remainingWinners = await Winner.find();
    const wonEmployeeIds = remainingWinners.map(w => w.employee).filter(Boolean);

    // Find eligible employees in this group
    const eligibleEmployees = await Employee.find({
      group,
      _id: { $nin: wonEmployeeIds },
      hasWon: false
    });

    if (eligibleEmployees.length === 0) {
      const gName = group === 1 ? 'Group A' : group === 2 ? 'Group B' : 'Group C';
      return res.status(400).json({ message: `No eligible employees remaining in ${gName}` });
    }

    const winnerIndex = crypto.randomInt(0, eligibleEmployees.length);
    const winnerEmp = eligibleEmployees[winnerIndex];
    const winnerCode = winnerEmp.payCode || winnerEmp.employeeId || ('EMP' + winnerEmp.serialNo);
    const sampleCodes = eligibleEmployees.map(e => e.payCode || e.employeeId).filter(Boolean);
    const prize = await Prize.findOne({ roundNo: round });

    await GameState.findOneAndUpdate(
      { singleton: 'state' },
      { status: 'spinning' }
    );

    if (io) {
      io.emit('game:spin_start', {
        round,
        group,
        duration: 20000,
        sampleCodes: sampleCodes.slice(0, 200),
        winnerLength: winnerCode.length,
      });
    }

    setTimeout(async () => {
      try {
        await Winner.create({
          roundNo: round,
          group,
          winnerNumber: winnerCode,
          employeeCode: winnerCode,
          employee: winnerEmp._id,
          prize: prize?._id || null,
        });

        await Employee.findByIdAndUpdate(winnerEmp._id, { hasWon: true });

        await GameState.findOneAndUpdate(
          { singleton: 'state' },
          { status: 'revealed' }
        );

        if (io) {
          io.emit('game:winner_revealed', {
            round,
            roundNo: round,
            group,
            winnerNumber: winnerCode,
            employeeCode: winnerCode,
            employee: {
              _id: winnerEmp._id,
              serialNo: winnerEmp.serialNo,
              name: winnerEmp.name,
              payCode: winnerEmp.payCode,
              employeeId: winnerEmp.employeeId || winnerEmp.payCode,
              department: winnerEmp.department,
              designation: winnerEmp.designation,
              unit: winnerEmp.unit,
              gender: winnerEmp.gender,
            },
            prize: prize ? { name: prize.name, description: prize.description, imageUrl: prize.imageUrl } : null,
          });
        }
      } catch (err) {
        console.error('Error in spin-again reveal timeout:', err);
      }
    }, 20000);

    res.json({ message: 'Spinning again for 10 seconds...' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST /next-round
router.post('/next-round', auth, async (req, res) => {
  try {
    const io    = req.app.get('io');
    const state = await GameState.findOne({ singleton: 'state' });
    if (!state) return res.status(400).json({ message: 'No game state' });

    const nextRound = state.currentRound + 1;
    if (nextRound > 9) {
      await GameState.findOneAndUpdate({ singleton: 'state' }, { status: 'completed' });
      if (io) io.emit('game:completed');
      return res.json({ message: 'All 9 rounds complete' });
    }

    await GameState.findOneAndUpdate(
      { singleton: 'state' },
      { currentRound: nextRound, status: 'idle' }
    );
    if (io) io.emit('game:next_round', { round: nextRound, group: groupForRound(nextRound) });
    res.json({ message: `Round ${nextRound} started` });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST /reset
router.post('/reset', auth, async (req, res) => {
  try {
    const io = req.app.get('io');
    await Winner.deleteMany({});
    await Employee.updateMany({}, { hasWon: false });
    await GameState.findOneAndUpdate(
      { singleton: 'state' },
      { currentRound: 1, status: 'idle', isActive: false, showFiestaWinners: false },
      { upsert: true }
    );
    if (io) io.emit('game:reset');
    res.json({ message: 'Game reset' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST /show-fiesta-winners — toggle or set live screen display of Fiesta Winners list
router.post('/show-fiesta-winners', auth, async (req, res) => {
  try {
    const io = req.app.get('io');
    const { show } = req.body;
    const state = await GameState.findOne({ singleton: 'state' });
    const targetShow = (typeof show === 'boolean') ? show : !(state?.showFiestaWinners);

    const updated = await GameState.findOneAndUpdate(
      { singleton: 'state' },
      { showFiestaWinners: targetShow },
      { new: true, upsert: true }
    ).populate('guestWinner').populate('guestPrize');

    const winners = await Winner.find().populate('prize').populate('employee').sort({ roundNo: 1 });
    let guestWinner = updated.guestWinner;
    let guestPrize = updated.guestPrize;
    if (!guestWinner) {
      guestWinner = await Guest.findOne({ won: true }).populate('prize');
      if (guestWinner) guestPrize = guestWinner.prize;
    }
    if (!guestPrize) {
      guestPrize = await Prize.findOne({ roundNo: 10 });
    }

    if (io) {
      io.emit('game:fiesta_winners_display', {
        show: targetShow,
        winners,
        guestWinner,
        guestPrize,
      });
    }

    res.json({
      message: targetShow ? 'Fiesta Winners broadcast to Live Screen' : 'Fiesta Winners hidden from Live Screen',
      showFiestaWinners: targetShow,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /public-state (for live audience screen without requiring login)
router.get('/public-state', async (req, res) => {
  try {
    const state   = await GameState.findOne({ singleton: 'state' }).populate('guestWinner').populate('guestPrize');
    const config  = await DrawConfig.findOne({ singleton: 'config' });
    const winners = await Winner.find().populate('prize').populate('employee').sort({ roundNo: 1 });
    let guestWinner = state?.guestWinner;
    let guestPrize = state?.guestPrize;
    if (!guestWinner) {
      guestWinner = await Guest.findOne({ won: true }).populate('prize');
      if (guestWinner) guestPrize = guestWinner.prize;
    }
    if (!guestPrize) {
      guestPrize = await Prize.findOne({ roundNo: 10 });
    }
    res.json({ state, config, winners, guestWinner, guestPrize });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET /state
router.get('/state', auth, async (req, res) => {
  try {
    const state   = await GameState.findOne({ singleton: 'state' }).populate('guestWinner').populate('guestPrize');
    const config  = await DrawConfig.findOne({ singleton: 'config' });
    const winners = await Winner.find().populate('prize').populate('employee').sort({ roundNo: 1 });
    res.json({ state, config, winners });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
