/* ============================================
   MAIN.JS - English Teacher Site
============================================ */

const API = '/api';
let allCourses = [];
let selectedSlot = null;
let selectedCourseId = null;

// ── Nav scroll effect ──────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 30);
});

// ── Hamburger menu ─────────────────────────
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('navLinks').classList.toggle('open');
});
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => document.getElementById('navLinks').classList.remove('open'));
});

// ── Scroll reveal ──────────────────────────
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ── Set min date for booking ───────────────
const dateInput = document.getElementById('bookDate');
const today = new Date();
today.setDate(today.getDate() + 1); // minimum tomorrow
dateInput.min = today.toISOString().split('T')[0];

// ── Format currency ────────────────────────
function formatPrice(price) {
  if (!price || Number(price) === 0) return "Consultar precio";
  return '₡' + Number(price).toLocaleString('es-CR');
}

// ── COURSES ───────────────────────────────
async function loadCourses() {
  try {
    const res = await fetch(`${API}/courses`);
    const json = await res.json();
    allCourses = json.data;
    renderCourses(allCourses);
    populateCourseSelect(allCourses);
  } catch {
    document.getElementById('coursesGrid').innerHTML = '<p class="courses-loading">Error al cargar los cursos.</p>';
  }
}

function renderCourses(courses) {
  const grid = document.getElementById('coursesGrid');
  grid.innerHTML = courses.map(c => `
    <div class="course-card reveal">
      <span class="course-level">${c.level}</span>
      <h3>${c.name}</h3>
      <p>${c.description}</p>
      <div class="course-meta">
        <span>⏱ ${c.duration_minutes} min</span>
        <span>👤 Máx. ${c.max_students} ${c.max_students === 1 ? 'persona' : 'personas'}</span>
      </div>
      <div class="course-price">${formatPrice(c.price)} ${Number(c.price) > 0 ? '<small>/ sesión</small>' : ''}</div>
      <button class="btn-primary" onclick="goToBooking(${c.id})">Agendar este curso</button>
    </div>
  `).join('');
  // Re-observe new cards
  document.querySelectorAll('.course-card.reveal').forEach(el => observer.observe(el));
}

function populateCourseSelect(courses) {
  const sel = document.getElementById('bookCourse');
  courses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} — ${formatPrice(c.price)}`;
    sel.appendChild(opt);
  });
}

function goToBooking(courseId) {
  document.getElementById('bookCourse').value = courseId;
  document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => document.getElementById('bookDate').focus(), 600);
}

// ── SLOTS ─────────────────────────────────
async function loadSlots() {
  const courseId = document.getElementById('bookCourse').value;
  const date = document.getElementById('bookDate').value;

  const slotsSection = document.getElementById('slotsSection');
  const noSlotsMsg = document.getElementById('noSlotsMsg');
  const slotsGrid = document.getElementById('slotsGrid');

  slotsSection.style.display = 'none';
  noSlotsMsg.style.display = 'none';
  selectedSlot = null;

  if (!courseId || !date) return;
  selectedCourseId = courseId;

  slotsGrid.innerHTML = '<span style="color:var(--ink-muted);font-size:.85rem">Buscando horarios...</span>';
  slotsSection.style.display = 'block';

  try {
    const res = await fetch(`${API}/slots?course_id=${courseId}&date=${date}`);
    const json = await res.json();

    if (!json.data || json.data.length === 0) {
      slotsSection.style.display = 'none';
      noSlotsMsg.style.display = 'block';
      return;
    }

    slotsGrid.innerHTML = json.data.map(t => {
      const [h, m] = t.split(':');
      const hour = parseInt(h);
      const ampm = hour >= 12 ? 'pm' : 'am';
      const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `<button class="slot-btn" data-time="${t}" onclick="selectSlot(this)">${h12}:${m} ${ampm}</button>`;
    }).join('');
  } catch {
    slotsGrid.innerHTML = '<span style="color:var(--ink-muted);font-size:.85rem">Error al cargar horarios.</span>';
  }
}

function selectSlot(btn) {
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedSlot = btn.dataset.time;

  // Auto-scroll to step 2 after brief delay
  setTimeout(() => {
    showStep2();
  }, 300);
}

document.getElementById('bookCourse').addEventListener('change', loadSlots);
document.getElementById('bookDate').addEventListener('change', loadSlots);

// ── BOOKING STEPS ─────────────────────────
function showStep2() {
  const courseId = document.getElementById('bookCourse').value;
  const date = document.getElementById('bookDate').value;

  if (!courseId || !date || !selectedSlot) return;

  const course = allCourses.find(c => c.id == courseId);
  const dateFormatted = new Date(date + 'T12:00:00').toLocaleDateString('es-CR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const [h, m] = selectedSlot.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;

  document.getElementById('bookingSummaryBar').innerHTML =
    `📚 <strong>${course.name}</strong> &nbsp;·&nbsp; 📅 ${dateFormatted} &nbsp;·&nbsp; 🕐 ${h12}:${m} ${ampm}`;

  document.getElementById('step1').style.display = 'none';
  document.getElementById('step2').style.display = 'block';
  document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('btnBack').addEventListener('click', () => {
  document.getElementById('step2').style.display = 'none';
  document.getElementById('step1').style.display = 'block';
  document.getElementById('formError').textContent = '';
});

// ── SUBMIT BOOKING ─────────────────────────
document.getElementById('btnSubmit').addEventListener('click', async () => {
  const name = document.getElementById('studentName').value.trim();
  const email = document.getElementById('studentEmail').value.trim();
  const phone = document.getElementById('studentPhone').value.trim();
  const message = document.getElementById('studentMessage').value.trim();
  const errorEl = document.getElementById('formError');
  const date = document.getElementById('bookDate').value;

  errorEl.textContent = '';

  if (!name) { errorEl.textContent = 'Por favor ingresa tu nombre.'; return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errorEl.textContent = 'Por favor ingresa un correo válido.'; return; }

  const btn = document.getElementById('btnSubmit');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    const res = await fetch(`${API}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: selectedCourseId,
        student_name: name,
        student_email: email,
        student_phone: phone || null,
        booking_date: date,
        start_time: selectedSlot,
        message: message || null
      })
    });
    const json = await res.json();

    if (!json.success) {
      errorEl.textContent = json.error || 'Ocurrió un error. Por favor intenta de nuevo.';
      return;
    }

    showConfirmModal(json.data);
    resetBookingForm();

  } catch {
    errorEl.textContent = 'Error de conexión. Por favor intenta de nuevo.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar reserva';
  }
});

function resetBookingForm() {
  document.getElementById('bookCourse').value = '';
  document.getElementById('bookDate').value = '';
  document.getElementById('slotsSection').style.display = 'none';
  document.getElementById('noSlotsMsg').style.display = 'none';
  document.getElementById('studentName').value = '';
  document.getElementById('studentEmail').value = '';
  document.getElementById('studentPhone').value = '';
  document.getElementById('studentMessage').value = '';
  selectedSlot = null;
  selectedCourseId = null;
  document.getElementById('step2').style.display = 'none';
  document.getElementById('step1').style.display = 'block';
}

function showConfirmModal(booking) {
  const dateFormatted = new Date(booking.booking_date + 'T12:00:00').toLocaleDateString('es-CR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const [h, m] = booking.start_time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;

  document.getElementById('modalDetails').innerHTML = `
    <strong>Curso:</strong> ${booking.course_name}<br>
    <strong>Fecha:</strong> ${dateFormatted}<br>
    <strong>Hora:</strong> ${h12}:${m} ${ampm}<br>
    <strong>Nombre:</strong> ${booking.student_name}<br>
    <strong>Correo:</strong> ${booking.student_email}
  `;
  document.getElementById('modalOverlay').style.display = 'flex';
}

document.getElementById('modalClose').addEventListener('click', () => {
  document.getElementById('modalOverlay').style.display = 'none';
});
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modalOverlay')) {
    document.getElementById('modalOverlay').style.display = 'none';
  }
});

// ── REVIEWS CAROUSEL ──────────────────────
let reviewIndex = 0;
let reviews = [];

async function loadReviews() {
  try {
    const res = await fetch(`${API}/reviews`);
    const json = await res.json();
    reviews = json.data;
    renderReviews(reviews);
  } catch {
    document.getElementById('reviewsTrack').innerHTML = '<p class="reviews-loading">Error al cargar reseñas.</p>';
  }
}

function renderReviews(data) {
  const track = document.getElementById('reviewsTrack');
  track.innerHTML = data.map(r => `
    <div class="review-card">
      <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
      <p class="review-comment">"${r.comment}"</p>
      <div class="review-author">
        <div class="review-avatar">${r.student_name.charAt(0)}</div>
        <div>
          <div class="review-name">${r.student_name}</div>
          ${r.course_name ? `<div class="review-course">${r.course_name}</div>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  const dotsEl = document.getElementById('reviewDots');
  dotsEl.innerHTML = data.map((_, i) => `<div class="review-dot${i === 0 ? ' active' : ''}" onclick="goToReview(${i})"></div>`).join('');

  updateCarousel();
}

function updateCarousel() {
  const track = document.getElementById('reviewsTrack');
  const cardWidth = 340 + 24; // width + gap
  track.style.transform = `translateX(-${reviewIndex * cardWidth}px)`;
  document.querySelectorAll('.review-dot').forEach((d, i) => d.classList.toggle('active', i === reviewIndex));
}

function goToReview(i) {
  reviewIndex = Math.max(0, Math.min(i, reviews.length - 1));
  updateCarousel();
}

document.getElementById('reviewNext').addEventListener('click', () => {
  reviewIndex = (reviewIndex + 1) % reviews.length;
  updateCarousel();
});
document.getElementById('reviewPrev').addEventListener('click', () => {
  reviewIndex = (reviewIndex - 1 + reviews.length) % reviews.length;
  updateCarousel();
});

// Auto-advance reviews
setInterval(() => {
  if (reviews.length > 0) {
    reviewIndex = (reviewIndex + 1) % reviews.length;
    updateCarousel();
  }
}, 5000);

// ── INIT ───────────────────────────────────
loadCourses();
loadReviews();
