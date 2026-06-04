const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(200) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS site_profile (
        id INTEGER PRIMARY KEY DEFAULT 1,
        name VARCHAR(200) DEFAULT 'Dianne Herrera Gamboa',
        title VARCHAR(200) DEFAULT 'Profesora de Inglés',
        tagline VARCHAR(300) DEFAULT 'Clases de inglés personalizadas para todos los niveles. Presencial y virtual, a tu ritmo.',
        bio TEXT DEFAULT 'Soy profesora de inglés apasionada por hacer que aprender un idioma sea una experiencia accesible, práctica y divertida.',
        bio2 TEXT DEFAULT 'Ofrezco clases adaptadas a tus objetivos, ya sea que quieras mejorar tu conversación, prepararte para el trabajo, viajar con confianza, o simplemente empezar desde cero.',
        years_exp INTEGER DEFAULT 1,
        students_count INTEGER DEFAULT 0,
        satisfaction INTEGER DEFAULT 100,
        email VARCHAR(200) DEFAULT 'dianne@email.com',
        phone VARCHAR(50) DEFAULT '+506 8888-8888',
        whatsapp VARCHAR(30) DEFAULT '50688888888',
        location VARCHAR(200) DEFAULT 'Costa Rica',
        hours VARCHAR(200) DEFAULT 'Lunes a Sábado · 7am – 8pm',
        instagram VARCHAR(200) DEFAULT '#',
        facebook VARCHAR(200) DEFAULT '#',
        tags TEXT DEFAULT 'Presencial,Virtual,Clases individuales,Grupos pequeños,Niños y adultos'
      );

      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        level VARCHAR(50),
        duration_minutes INTEGER DEFAULT 60,
        price DECIMAL(10,2),
        max_students INTEGER DEFAULT 1,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS time_slots (
        id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
        start_time TIME NOT NULL,
        UNIQUE(course_id, day_of_week, start_time)
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES courses(id),
        student_name VARCHAR(200) NOT NULL,
        student_email VARCHAR(200) NOT NULL,
        student_phone VARCHAR(50),
        booking_date DATE NOT NULL,
        start_time TIME NOT NULL,
        message TEXT,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled')),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        student_name VARCHAR(200) NOT NULL,
        rating INTEGER CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        course_name VARCHAR(200),
        approved BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const { rows: admins } = await client.query('SELECT COUNT(*) FROM admin_users');
    if (parseInt(admins[0].count) === 0) {
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin1234', 10);
      await client.query(
        'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)',
        [process.env.ADMIN_USERNAME || 'admin', hash]
      );
    }

    const { rows: profile } = await client.query('SELECT COUNT(*) FROM site_profile');
    if (parseInt(profile[0].count) === 0) {
      await client.query('INSERT INTO site_profile (id) VALUES (1)');
    }

    const { rows: courses } = await client.query('SELECT COUNT(*) FROM courses');
    if (parseInt(courses[0].count) === 0) {
      await client.query(`
        INSERT INTO courses (name, description, level, duration_minutes, price, max_students) VALUES
        ('Inglés Individual', 'Clase 100% personalizada según tus objetivos y nivel. Ideal para avanzar rápido con atención exclusiva.', 'Todos los niveles', 60, 0, 1),
        ('Inglés Grupal', 'Clases en grupos pequeños (máx. 4 personas). Aprendé con otros y practicá la conversación en un ambiente dinámico.', 'Todos los niveles', 60, 0, 4),
        ('Inglés para Niños', 'Clases dinámicas y divertidas para niños de 5 a 12 años. Metodología lúdica adaptada a su edad.', 'Principiante', 45, 0, 1),
        ('Inglés Conversacional', 'Enfocado en perder el miedo a hablar. Practicamos situaciones reales: trabajo, viajes, vida cotidiana.', 'Básico - Intermedio', 60, 0, 3),
        ('Business English', 'Inglés para el entorno laboral: correos, reuniones, presentaciones y vocabulario corporativo.', 'Intermedio - Avanzado', 60, 0, 1),
        ('Inglés desde Cero', 'Para quienes nunca han estudiado inglés o quieren retomar desde los fundamentos. Ritmo tranquilo y práctico.', 'Principiante', 60, 0, 2);
      `);

      await client.query(`
        INSERT INTO time_slots (course_id, day_of_week, start_time) VALUES
        (1,1,'08:00'),(1,1,'10:00'),(1,1,'15:00'),(1,1,'17:00'),
        (1,3,'08:00'),(1,3,'10:00'),(1,3,'15:00'),(1,3,'17:00'),
        (1,5,'09:00'),(1,5,'11:00'),
        (2,2,'09:00'),(2,2,'16:00'),(2,4,'09:00'),(2,4,'16:00'),
        (3,2,'15:00'),(3,2,'16:00'),(3,4,'15:00'),(3,4,'16:00'),(3,6,'10:00'),
        (4,6,'09:00'),(4,6,'11:00'),
        (5,1,'19:00'),(5,3,'19:00'),(5,5,'19:00'),
        (6,1,'08:00'),(6,3,'08:00'),(6,5,'08:00');
      `);
    }

    console.log('✅ Database initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
