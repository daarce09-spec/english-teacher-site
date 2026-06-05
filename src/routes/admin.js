const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/database');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

// ── LOGIN ──────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, error: 'Usuario y contraseña requeridos' });
  try {
    const { rows } = await pool.query('SELECT * FROM admin_users WHERE username=$1', [username]);
    if (rows.length === 0)
      return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid)
      return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    const token = jwt.sign({ id: rows[0].id, username: rows[0].username }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── CHANGE PASSWORD ────────────────────────
router.put('/password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ success: false, error: 'Campos requeridos' });
  if (new_password.length < 6)
    return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
  try {
    const { rows } = await pool.query('SELECT * FROM admin_users WHERE id=$1', [req.admin.id]);
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ success: false, error: 'Contraseña actual incorrecta' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE admin_users SET password_hash=$1 WHERE id=$2', [hash, req.admin.id]);
    res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PROFILE ────────────────────────────────
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM site_profile WHERE id=1');
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/profile', requireAuth, async (req, res) => {
  const fields = ['name','title','tagline','bio','bio2','years_exp','students_count',
    'satisfaction','email','phone','whatsapp','location','hours','instagram','facebook','tags'];
  const updates = fields.filter(f => req.body[f] !== undefined);
  if (updates.length === 0) return res.status(400).json({ success: false, error: 'Nada que actualizar' });
  try {
    const setClause = updates.map((f, i) => `${f}=$${i+1}`).join(', ');
    const values = updates.map(f => req.body[f]);
    values.push(1);
    await pool.query(`UPDATE site_profile SET ${setClause} WHERE id=$${values.length}`, values);
    const { rows } = await pool.query('SELECT * FROM site_profile WHERE id=1');
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── COURSES ────────────────────────────────
router.get('/courses', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM courses ORDER BY id');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/courses', requireAuth, async (req, res) => {
  const { name, description, level, duration_minutes, price, max_students } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'El nombre es requerido' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO courses (name,description,level,duration_minutes,price,max_students)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, description||null, level||null, duration_minutes||60, price||0, max_students||1]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/courses/:id', requireAuth, async (req, res) => {
  const { name, description, level, duration_minutes, price, max_students, active } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE courses SET name=$1,description=$2,level=$3,duration_minutes=$4,
       price=$5,max_students=$6,active=$7 WHERE id=$8 RETURNING *`,
      [name, description, level, duration_minutes, price, max_students, active, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Curso no encontrado' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/courses/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM courses WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── TIME SLOTS ─────────────────────────────
router.get('/slots/:courseId', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM time_slots WHERE course_id=$1 ORDER BY day_of_week, start_time',
      [req.params.courseId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/slots', requireAuth, async (req, res) => {
  const { course_id, day_of_week, start_time } = req.body;
  if (course_id === undefined || day_of_week === undefined || !start_time)
    return res.status(400).json({ success: false, error: 'Campos requeridos: course_id, day_of_week, start_time' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO time_slots (course_id,day_of_week,start_time) VALUES ($1,$2,$3) RETURNING *',
      [course_id, day_of_week, start_time]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'Ese horario ya existe' });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/slots/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM time_slots WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── BOOKINGS ───────────────────────────────
router.get('/bookings', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.*, c.name as course_name
      FROM bookings b LEFT JOIN courses c ON b.course_id=c.id
      ORDER BY 
        CASE WHEN b.booking_date >= CURRENT_DATE THEN 0 ELSE 1 END,
        CASE WHEN b.booking_date >= CURRENT_DATE THEN b.booking_date END ASC,
        CASE WHEN b.booking_date < CURRENT_DATE THEN b.booking_date END DESC,
        b.start_time ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/bookings/:id', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!['pending','confirmed','cancelled'].includes(status))
    return res.status(400).json({ success: false, error: 'Estado inválido' });
  try {
    const { rows } = await pool.query(
      'UPDATE bookings SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/bookings/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM bookings WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── REVIEWS ────────────────────────────────
router.get('/reviews', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM reviews ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/reviews/:id', requireAuth, async (req, res) => {
  const { approved } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE reviews SET approved=$1 WHERE id=$2 RETURNING *',
      [approved, req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/reviews/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM reviews WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DASHBOARD STATS ────────────────────────
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const [bookings, pending, courses, reviews] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM bookings WHERE status != 'cancelled'"),
      pool.query("SELECT COUNT(*) FROM bookings WHERE status='pending'"),
      pool.query('SELECT COUNT(*) FROM courses WHERE active=true'),
      pool.query('SELECT COUNT(*) FROM reviews WHERE approved=false'),
    ]);
    res.json({
      success: true,
      data: {
        total_bookings: parseInt(bookings.rows[0].count),
        pending_bookings: parseInt(pending.rows[0].count),
        active_courses: parseInt(courses.rows[0].count),
        pending_reviews: parseInt(reviews.rows[0].count),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── TIME SLOTS V2 ──────────────────────────
router.get('/slots_v2/:courseId', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM time_slots_v2 WHERE course_id=$1 ORDER BY slot_type, specific_date, day_of_week, start_time',
      [req.params.courseId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/slots_v2', requireAuth, async (req, res) => {
  const { course_id, slot_type, specific_date, day_of_week, start_time, date_from, date_to } = req.body;
  if (!course_id || !slot_type || !start_time) {
    return res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO time_slots_v2 (course_id, slot_type, specific_date, day_of_week, start_time, date_from, date_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [course_id, slot_type, specific_date||null, day_of_week??null, start_time, date_from||null, date_to||null]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/slots_v2/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM time_slots_v2 WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
