const express = require('express');
const router = express.Router();
const db = require('../db');
const { ensureAdmin } = require('../middleware/auth');
const { isFirebaseActive } = require('../config/firebase');

// All routes here require admin privileges
router.use(ensureAdmin);

// GET /admin - Main dashboard
router.get('/', async (req, res) => {
  try {
    const users = await db.getAllUsers();
    const courses = await db.getAllCourses();

    const admins = users.filter(u => u.role === 'admin');
    const teachers = users.filter(u => u.role === 'teacher');
    const students = users.filter(u => u.role === 'student');

    // Calculate total lessons
    let totalLessonsCount = 0;
    const coursesWithLessons = await Promise.all(courses.map(async (c) => {
      const lessons = await db.getLessonsByCourseId(c.id);
      totalLessonsCount += lessons.length;
      return { ...c, lessonsCount: lessons.length };
    }));

    res.render('admin/index', {
      title: 'Панель администратора — Trion Academy',
      users,
      courses: coursesWithLessons,
      stats: {
        totalUsers: users.length,
        adminsCount: admins.length,
        teachersCount: teachers.length,
        studentsCount: students.length,
        coursesCount: courses.length,
        lessonsCount: totalLessonsCount
      },
      isFirebase: isFirebaseActive()
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).render('error', { message: 'Ошибка загрузки панели администратора' });
  }
});

// GET /admin/users - Users management table
router.get('/users', async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.render('admin/users', {
      title: 'Управление пользователями — Trion Admin',
      users,
      isFirebase: isFirebaseActive()
    });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).render('error', { message: 'Ошибка при загрузке пользователей' });
  }
});

// POST /admin/users/:id/role - Update user role
router.post('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;

    if (!['admin', 'teacher', 'student'].includes(role)) {
      return res.status(400).send('Некорректная роль');
    }

    // Safety: prevent admin from downgrading their own currently logged-in account
    if (userId === req.session.user.id && role !== 'admin') {
      return res.status(400).send('Вы не можете снять роль администратора с текущей сессии');
    }

    await db.updateUserRole(userId, role);
    res.redirect(req.headers.referer || '/admin');
  } catch (err) {
    console.error('Admin change role error:', err);
    res.status(500).render('error', { message: 'Ошибка при изменении роли пользователя' });
  }
});

// POST /admin/users/:id/delete - Delete user
router.post('/users/:id/delete', async (req, res) => {
  try {
    const userId = req.params.id;

    if (userId === req.session.user.id) {
      return res.status(400).send('Нельзя удалить свой собственный аккаунт во время сессии');
    }

    await db.deleteUser(userId);
    res.redirect(req.headers.referer || '/admin');
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).render('error', { message: 'Ошибка при удалении пользователя' });
  }
});

// POST /admin/courses/:id/delete - Delete course as admin
router.post('/admin/courses/:id/delete', async (req, res) => {
  try {
    await db.deleteCourse(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    console.error('Admin delete course error:', err);
    res.status(500).render('error', { message: 'Ошибка при удалении курса' });
  }
});

module.exports = router;
