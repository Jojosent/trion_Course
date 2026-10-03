require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const { initFirebase } = require('./src/config/firebase');
const { seedDatabase } = require('./src/db/seed');
const { populateUser } = require('./src/middleware/auth');

const authRoutes = require('./src/routes/authRoutes');
const courseRoutes = require('./src/routes/courseRoutes');
const teacherRoutes = require('./src/routes/teacherRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

const db = require('./src/db');

// 1. Initialize Database & Seed
initFirebase();
seedDatabase()
  .then(() => db.syncToFirestore())
  .catch(err => console.error('Error during DB seed:', err));

// 2. View Engine Setup (EJS)
app.set('views', path.join(__dirname, 'src/views'));
app.set('view engine', 'ejs');

// 3. Body parsers & static assets
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 4. Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'trion-academy-ultra-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    httpOnly: true
  }
}));

// 5. Global locals (user context, current url)
app.use(populateUser);

// 6. Application Routes
app.use('/', authRoutes);
app.use('/', courseRoutes);
app.use('/teacher', teacherRoutes);
app.use('/admin', adminRoutes); // As required: accessible at /admin

// 7. 404 Handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 — Страница не найдена',
    message: 'Запрошенная страница не существует или была перемещена.',
    backUrl: '/'
  });
});

// 8. Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).render('error', {
    title: '500 — Ошибка сервера',
    message: 'На сервере произошла непредвиденная ошибка. Мы уже работаем над исправлением.',
    backUrl: '/'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`🚀 Trion Course Platform успешно запущена!`);
  console.log(`🌐 Главный сайт:     http://localhost:${PORT}`);
  console.log(`🔐 Админ-панель:    http://localhost:${PORT}/admin`);
  console.log(`👨‍🏫 Кабинет учителя: http://localhost:${PORT}/teacher`);
  console.log(`🎨 Дизайн:           White, Orange (#FF6600), Black`);
  console.log(`🛡️ Плеер:            YouTube Anti-Skip (-5 сек, no forward)`);
  console.log(`=================================================\n`);
});
