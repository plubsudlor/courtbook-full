require('dns').setServers(['8.8.8.8', '1.1.1.1']);
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
let db;
const bad = (res, code, msg) => res.status(code).json({ error: msg });

// สนามทั้งหมด
app.get('/api/courts', async (req, res) => {
  res.json(await db.collection('courts').find().toArray());
});

// รายการจองทั้งหมด (รวมข้อมูลสนามและลูกค้า)
app.get('/api/bookings', async (req, res) => {
  const list = await db.collection('bookings').aggregate([
    { $lookup: { from: 'courts', localField: 'courtId', foreignField: '_id', as: 'c' } },
    { $unwind: '$c' },
    { $lookup: { from: 'customers', localField: 'customerId', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
    {
      $project: {
        _id: 0, id: { $toString: '$_id' }, court: '$c.code', date: 1, hour: 1,
        status: 1, name: '$u.name', phone: '$u.phone'
      }
    }
  ]).toArray();
  res.json(list);
});

// จองสนาม
app.post('/api/bookings', async (req, res) => {
  try {
    const { court, date, hour, name, phone } = req.body;
    const h = Number(hour);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isInteger(h) || h < 8 || h > 21)
      return bad(res, 400, 'วันที่หรือเวลาไม่ถูกต้อง');
    const n = String(name || '').trim();
    if (!n) return bad(res, 400, 'กรอกชื่อผู้จอง');
    if (!/^0\d{8,9}$/.test(phone || '')) return bad(res, 400, 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก');
    const start = new Date(`${date}T${String(h).padStart(2, '0')}:00:00`);
    if (start < new Date()) return bad(res, 400, 'ไม่สามารถจองเวลาที่ผ่านไปแล้ว');

    const c = await db.collection('courts').findOne({ code: court });
    if (!c) return bad(res, 404, 'ไม่พบสนาม');
    if (c.status !== 'active') return bad(res, 400, 'สนามปิดซ่อม ไม่สามารถจองได้');

    let u = await db.collection('customers').findOne({ phone });
    if (u && u.name !== n) return bad(res, 409, 'เบอร์นี้ถูกใช้โดยลูกค้าคนอื่นแล้ว');
    if (!u) u = { _id: (await db.collection('customers').insertOne({ name: n, phone })).insertedId };

    const r = await db.collection('bookings').insertOne({
      courtId: c._id, customerId: u._id, date, hour: h, status: 'confirmed', createdAt: new Date()
    });
    res.status(201).json({ id: r.insertedId.toString() });
  } catch (e) {
    if (e.code === 11000) {
      return e.keyPattern && e.keyPattern.phone
        ? bad(res, 409, 'เบอร์นี้ถูกใช้โดยลูกค้าคนอื่นแล้ว')
        : bad(res, 409, 'ช่วงเวลานี้ถูกจองแล้ว');
    }
    console.error(e);
    bad(res, 500, 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์');
  }
});

// ยกเลิกการจอง
app.patch('/api/bookings/:id/cancel', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return bad(res, 400, 'รหัสไม่ถูกต้อง');
  const r = await db.collection('bookings').updateOne(
    { _id: new ObjectId(req.params.id) }, { $set: { status: 'cancelled' } });
  r.matchedCount ? res.json({ ok: true }) : bad(res, 404, 'ไม่พบการจอง');
});

(async () => {
  await client.connect();
  db = client.db(process.env.DB_NAME || 'courtbook');
  await db.collection('customers').createIndex({ phone: 1 }, { unique: true });
  // กันจองซ้ำที่ระดับฐานข้อมูล: 1 สนาม/วัน/ชั่วโมง ได้แค่ 1 การจองที่ยังไม่ถูกยกเลิก
  await db.collection('bookings').createIndex(
    { courtId: 1, date: 1, hour: 1 },
    { unique: true, partialFilterExpression: { status: 'confirmed' } });
  if (!(await db.collection('courts').countDocuments())) {
    await db.collection('courts').insertMany([
      { code: 'A', name: 'สนาม A', type: 'ในร่ม', pricePerHour: 300, status: 'active' },
      { code: 'B', name: 'สนาม B', type: 'กลางแจ้ง', pricePerHour: 200, status: 'active' }
    ]);
  }
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`CourtBook running at http://localhost:${port}`));
})().catch(e => { console.error(e); process.exit(1); });
