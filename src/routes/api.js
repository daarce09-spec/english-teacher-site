const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');

// GET all active courses
router.get('/courses', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM courses WHERE active = true ORDER BY price ASC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET available slots for a course on a given date
router.get('/slots', async (req, res) => {
  const { course_id, date } = req.query;
  if (!course_id || !date) {
    return res.status(400).json({ success: false, error: 'course_id and date are required' });
  }

  try {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getUTCDay(); // 0=Sunday

    // Get all slots for this course and day
    const { rows: allSlots } = await pool.query(
      `SELECT start_time FROM time_slots WHERE course_id = $1 AND day_of_week = $2`,
      [course_id, dayOfWeek]
    );

    // Get booked slots for this course and date
    const { rows: booked } = await pool.query(
      `SELECT start_time FROM bookings 
       WHERE course_id = $1 AND booking_date = $2 AND status != 'cancelled'`,
      [course_id, date]
    );

    const bookedTimes = booked.map(b => b.start_time.slice(0, 5));
    const available = allSlots
      .map(s => s.start_time.slice(0, 5))
      .filter(t => !bookedTimes.includes(t));

    res.json({ success: true, data: available });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create a booking
router.post('/bookings', async (req, res) => {
  const { course_id, student_name, student_email, student_phone, booking_date, start_time, message } = req.body;

  if (!course_id || !student_name || !student_email || !booking_date || !start_time) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(student_email)) {
    return res.status(400).json({ success: false, error: 'Invalid email format' });
  }

  try {
    // Check slot not already taken
    const { rows: conflict } = await pool.query(
      `SELECT id FROM bookings WHERE course_id=$1 AND booking_date=$2 AND start_time=$3 AND status != 'cancelled'`,
      [course_id, booking_date, start_time]
    );
    if (conflict.length > 0) {
      return res.status(409).json({ success: false, error: 'Ese horario ya no está disponible. Por favor elige otro.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO bookings (course_id, student_name, student_email, student_phone, booking_date, start_time, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [course_id, student_name, student_email, student_phone || null, booking_date, start_time, message || null]
    );

    // Get course name for response
    const { rows: courseRows } = await pool.query('SELECT name FROM courses WHERE id=$1', [course_id]);
    const courseName = courseRows[0]?.name || '';

    res.json({
      success: true,
      data: { ...rows[0], course_name: courseName }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET approved reviews
router.get('/reviews', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM reviews WHERE approved = true ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST submit a review (goes to moderation)
router.post('/reviews', async (req, res) => {
  const { student_name, rating, comment, course_name } = req.body;
  if (!student_name || !rating || !comment) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }
  try {
    await pool.query(
      `INSERT INTO reviews (student_name, rating, comment, course_name) VALUES ($1,$2,$3,$4)`,
      [student_name, rating, comment, course_name || null]
    );
    res.json({ success: true, message: 'Reseña recibida. Estará visible una vez aprobada.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
