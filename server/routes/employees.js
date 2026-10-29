const router = require('express').Router();
const multer = require('multer');
const fs = require('fs');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const auth = require('../middleware/auth');
const Employee = require('../models/Employee');
const GameState = require('../models/GameState');
const Winner = require('../models/Winner');
const DrawConfig = require('../models/DrawConfig');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function assignGroup(serialNo, total) {
  if (total <= 0) return 1;
  const size = Math.ceil(total / 3);
  if (serialNo <= size) return 1;
  if (serialNo <= size * 2) return 2;
  return 3;
}

async function recomputeGroups() {
  const all = await Employee.find().sort({ serialNo: 1, createdAt: 1 });
  const total = all.length;
  const size = Math.ceil(total / 3);

  // Step 1: Assign temporary negative serial numbers to prevent unique index collisions
  for (let i = 0; i < all.length; i++) {
    await Employee.updateOne({ _id: all[i]._id }, { $set: { serialNo: -(i + 1) } });
  }

  // Step 2: Assign clean contiguous serial numbers (1..total) and recalculated groups
  for (let i = 0; i < all.length; i++) {
    const sNo = i + 1;
    await Employee.updateOne(
      { _id: all[i]._id },
      { $set: { serialNo: sNo, group: assignGroup(sNo, total) } }
    );
  }

  await GameState.findOneAndUpdate(
    { singleton: 'state' },
    { totalEmployees: total, groupSize: size },
    { upsert: true }
  );

  await DrawConfig.findOneAndUpdate(
    { singleton: 'config' },
    { totalCards: total, groupSize: size },
    { upsert: true }
  );

  return { total, groupSize: size };
}

// Universal parser for Excel (.xlsx, .xls) and CSV across all sheets
function parseEmployeeFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded file contains no sheets or data');
  }

  let selectedSheet = null;
  let rawRows = null;
  let headerIdx = -1;

  // Scan sheets to locate the first sheet that contains employee headers
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rows || rows.length === 0) continue;

    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;
      const rowUpper = row.map(c => String(c).trim().toUpperCase());
      if (
        rowUpper.some(c =>
          c === 'NAME' ||
          c === 'NAME OF EMPLOYEE' ||
          c === 'NAME OF THE EMPLOYEE' ||
          c === 'EMPLOYEE NAME' ||
          c === 'EMP NAME' ||
          c === 'FULL NAME' ||
          c === 'EMPLOYEE' ||
          c.includes('NAME OF EMPLOYEE') ||
          c.includes('EMPLOYEE NAME')
        )
      ) {
        selectedSheet = sheetName;
        rawRows = rows;
        headerIdx = i;
        break;
      }
    }
    if (selectedSheet) break;
  }

  // Fallback to first sheet if no explicit header row detected
  if (!selectedSheet) {
    selectedSheet = workbook.SheetNames[0];
    const sheet = workbook.Sheets[selectedSheet];
    rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    headerIdx = 0;
  }

  if (!rawRows || rawRows.length <= headerIdx) {
    throw new Error('No data found in the uploaded file');
  }

  const headers = rawRows[headerIdx].map(h => String(h).trim().toUpperCase());

  const getColVal = (row, ...aliases) => {
    for (const alias of aliases) {
      const target = alias.toUpperCase();
      const idx = headers.findIndex(h => h === target || h.includes(target));
      if (idx !== -1 && row[idx] !== undefined && row[idx] !== null) {
        const val = String(row[idx]).trim();
        if (val) return val;
      }
    }
    return '';
  };

  const results = [];
  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || !Array.isArray(row) || row.length === 0) continue;

    const name = getColVal(
      row,
      'NAME OF EMPLOYEE',
      'NAME OF THE EMPLOYEE',
      'EMPLOYEE NAME',
      'EMP NAME',
      'FULL NAME',
      'NAME',
      'EMPLOYEE'
    );
    if (!name) continue;

    const payCode = getColVal(
      row,
      'EMPLOYEE CODE',
      'EMP CODE',
      'PAY CODE',
      'PAYCODE',
      'PAY_CODE',
      'EMPLOYEEID',
      'EMPLOYEE ID',
      'EMPID',
      'EMP ID',
      'CODE',
      'TOKEN'
    );
    const unit = getColVal(row, 'CURRENT ENTITY', 'ENTITY', 'UNIT', 'LOCATION', 'PLANT', 'BRANCH', 'SITE');
    const gender = getColVal(row, 'GENDER', 'SEX');
    const department = getColVal(row, 'DEPARTMENT', 'DEPT', 'DIVISION', 'SECTION');
    const designation = getColVal(row, 'CATEGORY', 'DESIGNATION', 'DESIG', 'ROLE', 'POSITION', 'TITLE');

    results.push({
      name,
      payCode,
      employeeId: payCode,
      unit,
      gender,
      department,
      designation,
    });
  }

  return results;
}

// GET all employees
router.get('/', auth, async (req, res) => {
  try {
    const employees = await Employee.find().sort({ serialNo: 1 });
    res.json(employees);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET summary counts
router.get('/summary', auth, async (req, res) => {
  try {
    const total = await Employee.countDocuments();
    const g1 = await Employee.countDocuments({ group: 1 });
    const g2 = await Employee.countDocuments({ group: 2 });
    const g3 = await Employee.countDocuments({ group: 3 });
    res.json({ total, groups: { 1: g1, 2: g2, 3: g3 } });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET public employee pass details for QR scan
router.get('/public-pass/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let employee = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      employee = await Employee.findById(id);
    }
    if (!employee && !isNaN(id)) {
      employee = await Employee.findOne({ serialNo: parseInt(id) });
    }
    if (!employee) {
      employee = await Employee.findOne({
        $or: [{ payCode: id }, { employeeId: id }]
      });
    }
    if (!employee) {
      return res.status(404).json({ message: 'Employee pass not found' });
    }
    const winner = await Winner.findOne({ winnerNumber: employee.serialNo }).populate('prize');
    res.json({
      employee,
      card: {
        number: employee.serialNo,
        group: employee.group,
        groupLabel: employee.group === 1 ? 'Group A' : employee.group === 2 ? 'Group B' : 'Group C',
      },
      winner: winner || null,
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST bulk upload Excel (.xlsx, .xls) or CSV with replace or append mode
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const mode = req.body.mode || 'replace'; // 'replace' or 'append'
    const results = parseEmployeeFile(req.file.path);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    if (results.length === 0) {
      return res.status(400).json({ message: 'No valid employee records found in file. Please verify column headers.' });
    }

    if (mode === 'replace') {
      await Employee.deleteMany({});
      await Winner.deleteMany({});

      const total = results.length;
      const size = Math.ceil(total / 3);
      const docs = results.map((r, i) => ({
        ...r,
        serialNo: i + 1,
        group: assignGroup(i + 1, total),
        hasWon: false,
      }));

      await Employee.insertMany(docs);
      await GameState.findOneAndUpdate(
        { singleton: 'state' },
        { totalEmployees: total, groupSize: size, currentRound: 1, status: 'idle', isActive: false },
        { upsert: true, new: true }
      );
      await DrawConfig.findOneAndUpdate(
        { singleton: 'config' },
        { totalCards: total, groupSize: size },
        { upsert: true, new: true }
      );

      const io = req.app.get('io');
      if (io) io.emit('employees:changed', { total, groupSize: size });

      return res.json({
        message: `Successfully replaced database with ${total} employees!`,
        total,
        groupSize: size
      });
    } else {
      // Append mode
      const existingCount = await Employee.countDocuments();
      const docs = results.map((r, i) => ({
        ...r,
        serialNo: existingCount + i + 1,
        group: 1,
        hasWon: false,
      }));
      await Employee.insertMany(docs);
      const info = await recomputeGroups();

      const io = req.app.get('io');
      if (io) io.emit('employees:changed', info);

      return res.json({
        message: `Successfully appended ${results.length} new employees (total: ${info.total})!`,
        total: info.total,
        groupSize: info.groupSize
      });
    }
  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: e.message });
  }
});

// POST add single employee manually
router.post('/add', auth, async (req, res) => {
  try {
    const { name, payCode, employeeId, unit, gender, department, designation } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });

    const last = await Employee.findOne().sort({ serialNo: -1 });
    const tempSerial = last ? last.serialNo + 1 : 1;

    const emp = await Employee.create({
      serialNo: tempSerial,
      name: name.trim(),
      payCode: payCode?.trim() || '',
      employeeId: employeeId?.trim() || payCode?.trim() || '',
      unit: unit?.trim() || '',
      gender: gender?.trim() || '',
      department: department?.trim() || '',
      designation: designation?.trim() || '',
      group: 1,
      hasWon: false,
    });

    const info = await recomputeGroups();
    const io = req.app.get('io');
    if (io) io.emit('employees:changed', info);

    res.json({ employee: emp, ...info });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// DELETE all employees directly from database
router.delete('/all', auth, async (req, res) => {
  try {
    await Employee.deleteMany({});
    await Winner.deleteMany({});
    await GameState.findOneAndUpdate(
      { singleton: 'state' },
      { totalEmployees: 0, groupSize: 0, currentRound: 1, status: 'idle', isActive: false },
      { upsert: true }
    );
    await DrawConfig.findOneAndUpdate(
      { singleton: 'config' },
      { totalCards: 0, groupSize: 0 },
      { upsert: true }
    );

    const io = req.app.get('io');
    if (io) io.emit('employees:changed', { total: 0, groupSize: 0 });

    res.json({ message: 'All employees cleared from database' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST batch delete employees directly from database
router.post('/batch-delete', auth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No employee IDs provided' });
    }
    await Employee.deleteMany({ _id: { $in: ids } });
    const info = await recomputeGroups();

    const io = req.app.get('io');
    if (io) io.emit('employees:changed', info);

    res.json({ message: `Successfully deleted ${ids.length} employee(s) from database`, ...info });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// PUT update single employee
router.put('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid employee ID' });
    }
    const { name, payCode, employeeId, unit, gender, department, designation } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });

    const updated = await Employee.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        payCode: payCode?.trim() || '',
        employeeId: employeeId?.trim() || payCode?.trim() || '',
        unit: unit?.trim() || '',
        gender: gender?.trim() || '',
        department: department?.trim() || '',
        designation: designation?.trim() || '',
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Employee not found' });

    const io = req.app.get('io');
    if (io) io.emit('employees:changed');

    res.json({ message: 'Employee updated successfully', employee: updated });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// DELETE single employee directly from database
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid employee ID' });
    }
    const deleted = await Employee.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Employee not found' });
    const info = await recomputeGroups();

    const io = req.app.get('io');
    if (io) io.emit('employees:changed', info);

    res.json({ message: 'Deleted successfully from database', ...info });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
