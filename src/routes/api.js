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

// GET available slots for a course on a given date (uses v2)
router.get('/slots', async (req, res) => {
  const { course_id, date } = req.query;
  if (!course_id || !date) {
    return res.status(400).json({ success: false, error: 'course_id and date are required' });
  }

  try {
    const dateObj = new Date(date + 'T12:00:00');
    const dayOfWeek = dateObj.getDay();

    // Get matching v2 slots for this date
    const { rows: v2Slots } = await pool.query(
      `SELECT DISTINCT start_time FROM time_slots_v2 
       WHERE course_id = $1 AND (
         (slot_type = 'specific' AND specific_date = $2) OR
         (slot_type = 'range' AND day_of_week = $3 AND date_from <= $2 AND date_to >= $2)
       )`,
      [course_id, date, dayOfWeek]
    );

    // Get booked slots
    const { rows: booked } = await pool.query(
      `SELECT start_time FROM bookings 
       WHERE course_id = $1 AND booking_date = $2 AND status != 'cancelled'`,
      [course_id, date]
    );

    const bookedTimes = booked.map(b => b.start_time.slice(0, 5));
    const available = v2Slots
      .map(s => s.start_time.slice(0, 5))
      .filter(t => !bookedTimes.includes(t))
      .sort();

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

// GET public profile
router.get('/profile', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM site_profile WHERE id=1');
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET available dates for a course (next 60 days) using v2 slots
router.get('/available-days', async (req, res) => {
  const { course_id } = req.query;
  if (!course_id) {
    return res.status(400).json({ success: false, error: 'course_id required' });
  }
  try {
    const { rows: slots } = await pool.query(
      'SELECT * FROM time_slots_v2 WHERE course_id = $1',
      [course_id]
    );

    const today = new Date();
    today.setHours(0,0,0,0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 90); // next 90 days
    const availableDates = new Set();

    for (const slot of slots) {
      if (slot.slot_type === 'specific') {
        const d = new Date(slot.specific_date + 'T12:00:00');
        if (d > today && d <= maxDate) {
          availableDates.add(slot.specific_date);
        }
      } else if (slot.slot_type === 'range') {
        const from = new Date(slot.date_from + 'T12:00:00');
        const to = new Date(slot.date_to + 'T12:00:00');
        const start = from > today ? from : new Date(today.getTime() + 86400000);
        const end = to < maxDate ? to : maxDate;
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (d.getDay() === slot.day_of_week) {
            availableDates.add(d.toISOString().split('T')[0]);
          }
        }
      }
    }

    const sorted = Array.from(availableDates).sort();
    res.json({ success: true, data: sorted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
