# English Teacher Site 🎓

Sitio web profesional para profesora de inglés con sistema de agendamiento de clases.

## Stack
- **Frontend**: HTML + CSS + Vanilla JS
- **Backend**: Node.js + Express
- **Base de datos**: PostgreSQL

---

## Desarrollo local

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
# Edita .env con tu DATABASE_URL local
```

### 3. Correr el servidor
```bash
npm run dev
# Abre http://localhost:3000
```

---

## Deploy en Railway

### Paso 1 — Subir a GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/tu-usuario/english-teacher-site.git
git push -u origin main
```

### Paso 2 — Crear proyecto en Railway
1. Entra a [railway.app](https://railway.app)
2. Haz clic en **New Project**
3. Selecciona **Deploy from GitHub repo**
4. Conecta el repositorio

### Paso 3 — Agregar PostgreSQL
1. En el proyecto de Railway: clic en **+ New** → **Database** → **PostgreSQL**
2. Railway automáticamente agrega `DATABASE_URL` como variable de entorno

### Paso 4 — Configurar variables de entorno
En el servicio de Node.js, ve a **Variables** y agrega:
```
NODE_ENV=production
```
> `DATABASE_URL` y `PORT` son inyectados automáticamente por Railway.

### Paso 5 — Deploy
Railway hace el deploy automáticamente al conectar el repo. La base de datos se inicializa sola al primer arranque.

---

## Personalización

### Cambiar información de la profesora
Edita `public/index.html`:
- Nombre: busca "Sofia Reyes"
- Email: busca "sofia@inglesconsofia.com"
- WhatsApp: busca "50688888888"
- Dirección: busca "San José, Costa Rica"

### Cambiar cursos
Edita los `INSERT INTO courses` en `src/db/database.js`

### Cambiar horarios disponibles
Edita los `INSERT INTO time_slots` en `src/db/database.js`  
`day_of_week`: 0=Domingo, 1=Lunes, ..., 6=Sábado

### Agregar foto de perfil
Coloca una foto llamada `profile.jpg` en `public/images/`

### Cambiar colores
Edita las variables CSS en `public/css/style.css`:
```css
--clay:  #C47C5A;   /* Color principal */
--sage:  #7A9B76;   /* Acento verde */
--cream: #FAF6F0;   /* Fondo claro */
```

---

## Aprobar reseñas de estudiantes

Las reseñas que envían los visitantes quedan en estado `approved = false`.  
Para aprobarlas, conéctate a la base de datos y ejecuta:

```sql
-- Ver reseñas pendientes
SELECT * FROM reviews WHERE approved = false;

-- Aprobar una reseña por ID
UPDATE reviews SET approved = true WHERE id = 1;
```

---

## Estructura del proyecto

```
english-teacher-site/
├── public/
│   ├── index.html
│   ├── css/style.css
│   ├── js/main.js
│   └── images/         ← pon aquí profile.jpg
├── src/
│   ├── server.js
│   ├── db/database.js
│   └── routes/api.js
├── .env.example
├── .gitignore
├── railway.toml
└── package.json
```
