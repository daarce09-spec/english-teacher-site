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
        name VARCHAR(200) DEFAULT 'Sofia Reyes',
        title VARCHAR(200) DEFAULT 'Profesora Certificada de Inglés',
        tagline VARCHAR(300) DEFAULT 'Aprende inglés con método, confianza y resultados reales.',
        bio TEXT DEFAULT 'Soy Sofia, profesora de inglés con certificación TEFL y más de 8 años de experiencia.',
        bio2 TEXT DEFAULT 'Mi enfoque combina gramática sólida con práctica conversacional intensa.',
        years_exp INTEGER DEFAULT 8,
        students_count INTEGER DEFAULT 500,
        satisfaction INTEGER DEFAULT 98,
        email VARCHAR(200) DEFAULT 'sofia@inglesconsofia.com',
        phone VARCHAR(50) DEFAULT '+506 8888-8888',
        whatsapp VARCHAR(30) DEFAULT '50688888888',
        location VARCHAR(200) DEFAULT 'San José, Costa Rica',
        hours VARCHAR(200) DEFAULT 'Lunes a Sábado · 7am – 8pm',
        instagram VARCHAR(200) DEFAULT '#',
        facebook VARCHAR(200) DEFAULT '#',
        tags TEXT DEFAULT 'TEFL Certified,Cambridge CELTA,Nivel C2,TOEFL Prep,Business English'
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

    // Seed admin user if not exists
    const { rows: admins } = await client.query('SELECT COUNT(*) FROM admin_users');
    if (parseInt(admins[0].count) === 0) {
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin1234', 10);
      await client.query(
        'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)',
        [process.env.ADMIN_USERNAME || 'admin', hash]
      );
      console.log('✅ Admin user created. User: admin / Pass: admin1234 (cámbiala en variables de entorno)');
    }

    // Seed profile if not exists
    const { rows: profile } = await client.query('SELECT COUNT(*) FROM site_profile');
    if (parseInt(profile[0].count) === 0) {
      await client.query('INSERT INTO site_profile (id) VALUES (1)');
    }

    // Seed courses if empty
    const { rows: courses } = await client.query('SELECT COUNT(*) FROM courses');
    if (parseInt(courses[0].count) === 0) {
      await client.query(`
        INSERT INTO courses (name, description, level, duration_minutes, price, max_students) VALUES
        ('Inglés General', 'Clases personalizadas para mejorar tu inglés en todas las áreas: conversación, gramática y escritura.', 'Todos los niveles', 60, 25000, 1),
        ('Business English', 'Inglés enfocado en el mundo laboral: presentaciones, correos, reuniones y vocabulario corporativo.', 'Intermedio - Avanzado', 60, 30000, 1),
        ('Inglés para Viajes', 'Aprende el inglés esencial para moverte con confianza en el extranjero.', 'Básico - Intermedio', 60, 22000, 3),
        ('Preparación TOEFL/TOEIC', 'Curso intensivo para obtener la certificación que necesitas. Estrategias y práctica de examen.', 'Intermedio - Avanzado', 90, 35000, 1),
        ('Taller de Conversación', 'Sesión grupal para practicar fluidez y perder el miedo a hablar en inglés.', 'Básico - Intermedio', 60, 15000, 6),
        ('Inglés para Niños', 'Clases dinámicas y divertidas adaptadas para niños de 6 a 12 años.', 'Principiante', 45, 20000, 1);
      `);

      await client.query(`
        INSERT INTO time_slots (course_id, day_of_week, start_time) VALUES
        (1,1,'08:00'),(1,1,'10:00'),(1,1,'15:00'),(1,1,'17:00'),
        (1,3,'08:00'),(1,3,'10:00'),(1,3,'15:00'),(1,3,'17:00'),
        (1,5,'09:00'),(1,5,'11:00'),
        (2,2,'07:00'),(2,2,'12:00'),(2,2,'18:00'),
        (2,4,'07:00'),(2,4,'12:00'),(2,4,'18:00'),
        (3,6,'09:00'),(3,6,'11:00'),
        (4,1,'19:00'),(4,3,'19:00'),(4,5,'19:00'),
        (5,6,'10:00'),
        (6,2,'16:00'),(6,4,'16:00');
      `);

      await client.query(`
        INSERT INTO reviews (student_name, rating, comment, course_name, approved) VALUES
        ('Andrea Mora', 5, 'Excelente profesora. Su método es muy claro y siempre viene bien preparada. En 3 meses mejoré mi nivel notablemente.', 'Business English', true),
        ('Carlos Jiménez', 5, 'Las clases de conversación son increíbles. Ahora me siento seguro hablando en reuniones con clientes extranjeros.', 'Business English', true),
        ('Valeria Soto', 5, 'Pasé mi TOEFL con 97 puntos. Sin su ayuda no lo habría logrado. ¡Mil gracias!', 'Preparación TOEFL/TOEIC', true),
        ('Luis Fernández', 4, 'El taller grupal está muy bien estructurado. Se aprende mucho y se conoce gente interesante.', 'Taller de Conversación', true),
        ('Marcela Rodríguez', 5, 'Mi hija de 8 años ama sus clases. La metodología con niños es espectacular, muy paciente y creativa.', 'Inglés para Niños', true),
        ('Diego Vargas', 5, 'Viajé a Canadá por trabajo y pude comunicarme perfectamente. Las clases de viajes son prácticas y útiles.', 'Inglés para Viajes', true);
      `);
    }

    console.log('✅ Database initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
