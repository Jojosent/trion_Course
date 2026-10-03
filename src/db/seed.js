const bcrypt = require('bcryptjs');
const db = require('./index');

async function seedDatabase() {
  const users = await db.getAllUsers();
  if (users.length > 0) {
    console.log('📦 База данных уже содержит пользователей, пропускаем первичное заполнение.');
    return;
  }

  console.log('🌱 Инициализация тестовых данных (Админ, Учитель, Ученик, Курсы и Уроки)...');

  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash('admin123', salt);
  const teacherPasswordHash = await bcrypt.hash('teacher123', salt);
  const studentPasswordHash = await bcrypt.hash('student123', salt);

  // 1. Seed Users
  const adminUser = await db.createUser({
    id: 'user-admin-1',
    name: 'Главный Администратор',
    email: 'admin@trion.edu',
    password: adminPasswordHash,
    role: 'admin',
    createdAt: new Date().toISOString()
  });

  const teacherUser = await db.createUser({
    id: 'user-teacher-1',
    name: 'Алексей Смирнов (Senior FullStack)',
    email: 'teacher@trion.edu',
    password: teacherPasswordHash,
    role: 'teacher',
    bio: '10+ лет коммерческого опыта в Node.js, React, Cloud Architecture.',
    createdAt: new Date().toISOString()
  });

  const studentUser = await db.createUser({
    id: 'user-student-1',
    name: 'Данияр Бекенов (Студент)',
    email: 'student@trion.edu',
    password: studentPasswordHash,
    role: 'student',
    createdAt: new Date().toISOString()
  });

  // 2. Seed Course 1
  const course1 = await db.createCourse({
    id: 'course-fullstack-node',
    title: 'Full-Stack Веб-Разработка на Node.js & Современный Web',
    description: 'Комплексный курс по разработке масштабируемых веб-приложений с использованием Node.js, Express, защищенных API, баз данных и чистого фронтенда.',
    authorId: teacherUser.id,
    authorName: teacherUser.name,
    category: 'Backend & FullStack',
    level: 'С нуля до PRO',
    duration: '24 академических часа',
    thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString()
  });

  // Lessons for Course 1
  await db.createLesson({
    id: 'lesson-fs-1',
    courseId: course1.id,
    title: 'Урок 1: Введение в экосистему Node.js и архитектуру веба',
    description: 'Разбираем как устроен современный интернет, работу движка V8, Event Loop и запуск первого сервера.',
    order: 1,
    durationMinutes: 15,
    videoUrl: 'https://youtube.com/shorts/vLpVCVKySCE?feature=share',
    theory: `
# 🚀 Урок 1: Введение в Node.js и Архитектуру Веба

Добро пожаловать на курс! В этом уроке мы заложим фундаментальную базу для понимания того, как работают серверные веб-приложения.

---

### 📌 1. Что такое Node.js?
**Node.js** — это среда выполнения JavaScript, построенная на движке Chrome V8. Она позволяет исполнять JavaScript вне браузера — на сервере, в терминале и в облачных микросервисах.

#### Ключевые преимущества:
1. **Асинхронность и неблокирующий I/O**: операции чтения файлов, сетевых запросов и запросов к БД выполняются без заморозки главного потока.
2. **Один язык на клиенте и сервере**: единый синтаксис JavaScript/TypeScript позволяет переиспользовать код валидации и типы данных.
3. **Огромная экосистема npm**: миллионы готовых пакетов и библиотек.

---

### 💻 2. Пример простейшего HTTP сервера на Node.js

\`\`\`javascript
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    message: "Добро пожаловать в Trion Academy!",
    status: "ok",
    timestamp: new Date().toISOString()
  }));
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(\`Сервер успешно запущен на порту http://localhost:\${PORT}\`);
});
\`\`\`

---

### 🛡️ 3. Защита видеоматериалов курса
На нашем портале внедрена интеллектуальная система анти-пропуска:
* Плеер запрещает перескакивать вперед непросмотренные сегменты лекции.
* Доступна функция быстрого повтора: **кнопка «- 5 сек»**.
* Завершение урока засчитывается после просмотра видеоматериала и закрепления теории.
`
  });

  await db.createLesson({
    id: 'lesson-fs-2',
    courseId: course1.id,
    title: 'Урок 2: REST API, Маршрутизация в Express и Middleware',
    description: 'Создание чистого REST API, обработка параметров маршрутов, валидация запросов и использование связующего ПО (Middleware).',
    order: 2,
    durationMinutes: 20,
    videoUrl: 'https://youtube.com/shorts/vLpVCVKySCE?feature=share',
    theory: `
# 🛠️ Урок 2: Создание REST API на Express

В этом уроке мы разберем проектирование надежного API и принципы взаимодействия клиентской и серверной частей.

### 📋 Архитектурные принципы REST:
1. **Идемпотентность методов**: \`GET\`, \`PUT\`, \`DELETE\` должны быть предсказуемы.
2. **Использование правильных HTTP-статусов**:
   * \`200 OK\` — успешный запрос.
   * \`201 Created\` — ресурс успешно создан.
   * \`400 Bad Request\` — ошибка валидации входных данных.
   * \`401 Unauthorized\` — пользователь не авторизован.
   * \`403 Forbidden\` — недостаточно прав (например, ученик пытается зайти в панель учителя).
   * \`404 Not Found\` — ресурс не найден.

### 💡 Пример структуры Middleware авторизации:
\`\`\`javascript
function ensureRole(requiredRole) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/login');
    }
    if (req.session.user.role !== requiredRole && req.session.user.role !== 'admin') {
      return res.status(403).render('error', { message: 'Доступ ограничен!' });
    }
    next();
  };
}
\`\`\`
`
  });

  // 3. Seed Course 2
  const course2 = await db.createCourse({
    id: 'course-frontend-ui',
    title: 'Frontend разработка и UI/UX интерфейсы',
    description: 'Изучите HTML5, современный адаптивный CSS, анимации, стилизацию в цветах Orange & Black и основы интерактивного JavaScript.',
    authorId: teacherUser.id,
    authorName: teacherUser.name,
    category: 'Frontend & UI Design',
    level: 'Начальный',
    duration: '18 академических часов',
    thumbnail: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString()
  });

  await db.createLesson({
    id: 'lesson-fe-1',
    courseId: course2.id,
    title: 'Урок 1: Цветовая палитра Black & Orange и верстка адаптивных сеток',
    description: 'Разбор контрастности, типографики и построения красивых карточек курсов с оранжевыми акцентами.',
    order: 1,
    durationMinutes: 12,
    videoUrl: 'https://youtube.com/shorts/vLpVCVKySCE?feature=share',
    theory: `
# 🎨 Урок 1: Фирменный стиль Black & Orange

Контрастное сочетание черного, белого и яркого оранжевого (\`#FF6600\`) создает энергичный и технологичный стиль образовательной платформы.

### Основные токены дизайна:
* **Background Light**: \`#F8FAFC\` (чистый, не утомляющий глаз фон)
* **Dark Surfaces**: \`#0F172A\` и \`#18181B\` (контрастные панели, плеер и навигация)
* **Primary Accent**: \`#FF6600\` (кнопки призыва к действию, статус прогресса, активные табы)
* **Text**: Глубокий черный \`#0F172A\` на светлом фоне и белоснежный \`#FFFFFF\` на темном.
`
  });

  console.log('✅ База данных успешно инициализирована тестовыми данными!');
  console.log('🔑 Доступы для входа:');
  console.log('   Администратор: admin@trion.edu / admin123 (панель: /admin)');
  console.log('   Учитель:       teacher@trion.edu / teacher123');
  console.log('   Ученик:        student@trion.edu / student123');
}

module.exports = { seedDatabase };
