const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { ensureTeacherOrAdmin } = require('../middleware/auth');
const { extractYouTubeId } = require('../utils/youtube');

// All teacher routes require teacher or admin role
router.use(ensureTeacherOrAdmin);

// GET /teacher - Dashboard
router.get('/', async (req, res) => {
  try {
    const isTeacherAdmin = req.session.user.role === 'admin';
    const courses = isTeacherAdmin
      ? await db.getAllCourses()
      : await db.getCoursesByAuthor(req.session.user.id);

    // Get lesson counts
    const coursesWithLessons = await Promise.all(courses.map(async (c) => {
      const lessons = await db.getLessonsByCourseId(c.id);
      return { ...c, lessonsCount: lessons.length };
    }));

    res.render('teacher/dashboard', {
      title: 'Панель преподавателя — Trion Academy',
      courses: coursesWithLessons
    });
  } catch (err) {
    console.error('Teacher dashboard error:', err);
    res.status(500).render('error', { message: 'Ошибка загрузки панели преподавателя' });
  }
});

// GET /teacher/courses/new - New course form
router.get('/courses/new', (req, res) => {
  res.render('teacher/course-form', {
    title: 'Создать новый курс',
    course: null,
    error: null
  });
});

// POST /teacher/courses - Create course action
router.post('/courses', async (req, res) => {
  try {
    const { title, description, category, level, duration, thumbnail } = req.body;

    if (!title || !description) {
      return res.render('teacher/course-form', {
        title: 'Создать новый курс',
        course: req.body,
        error: 'Название и описание курса обязательны'
      });
    }

    const newCourse = await db.createCourse({
      id: 'course-' + uuidv4().slice(0, 8),
      title: title.trim(),
      description: description.trim(),
      category: category || 'Web Development',
      level: level || 'Все уровни',
      duration: duration || '10 часов',
      thumbnail: thumbnail || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80',
      authorId: req.session.user.id,
      authorName: req.session.user.name,
      createdAt: new Date().toISOString()
    });

    res.redirect(`/teacher/courses/${newCourse.id}/edit`);
  } catch (err) {
    console.error('Create course error:', err);
    res.status(500).render('error', { message: 'Ошибка при создании курса' });
  }
});

// GET /teacher/courses/:id/edit - Edit course & its lessons
router.get('/courses/:id/edit', async (req, res) => {
  try {
    const course = await db.getCourseById(req.params.id);
    if (!course) {
      return res.status(404).render('error', { message: 'Курс не найден' });
    }

    // Check ownership unless admin
    if (course.authorId !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.status(403).render('error', { message: 'Вы не являетесь автором этого курса' });
    }

    const lessons = await db.getLessonsByCourseId(course.id);

    res.render('teacher/course-form', {
      title: `Редактирование: ${course.title}`,
      course,
      lessons,
      error: null
    });
  } catch (err) {
    console.error('Edit course error:', err);
    res.status(500).render('error', { message: 'Ошибка загрузки курса' });
  }
});

// POST /teacher/courses/:id/edit - Update course
router.post('/courses/:id/edit', async (req, res) => {
  try {
    const course = await db.getCourseById(req.params.id);
    if (!course) {
      return res.status(404).render('error', { message: 'Курс не найден' });
    }

    if (course.authorId !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.status(403).render('error', { message: 'Нет прав на редактирование' });
    }

    const { title, description, category, level, duration, thumbnail } = req.body;

    await db.updateCourse(course.id, {
      title: title.trim(),
      description: description.trim(),
      category: category || course.category,
      level: level || course.level,
      duration: duration || course.duration,
      thumbnail: thumbnail || course.thumbnail
    });

    res.redirect(`/teacher/courses/${course.id}/edit?saved=1`);
  } catch (err) {
    console.error('Update course error:', err);
    res.status(500).render('error', { message: 'Ошибка при сохранении курса' });
  }
});

// POST /teacher/courses/:id/delete - Delete course
router.post('/courses/:id/delete', async (req, res) => {
  try {
    const course = await db.getCourseById(req.params.id);
    if (!course) {
      return res.status(404).render('error', { message: 'Курс не найден' });
    }

    if (course.authorId !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.status(403).render('error', { message: 'Нет прав на удаление' });
    }

    await db.deleteCourse(course.id);
    res.redirect('/teacher');
  } catch (err) {
    console.error('Delete course error:', err);
    res.status(500).render('error', { message: 'Ошибка при удалении курса' });
  }
});

// GET /teacher/courses/:id/lessons/new - New lesson form
router.get('/courses/:id/lessons/new', async (req, res) => {
  try {
    const course = await db.getCourseById(req.params.id);
    if (!course) {
      return res.status(404).render('error', { message: 'Курс не найден' });
    }

    const existingLessons = await db.getLessonsByCourseId(course.id);
    const nextOrder = existingLessons.length + 1;

    res.render('teacher/lesson-form', {
      title: `Новый урок — ${course.title}`,
      course,
      lesson: { order: nextOrder },
      error: null
    });
  } catch (err) {
    console.error('New lesson form error:', err);
    res.status(500).render('error', { message: 'Ошибка при открытии формы урока' });
  }
});

// POST /teacher/courses/:id/lessons - Create lesson
router.post('/courses/:id/lessons', async (req, res) => {
  try {
    const course = await db.getCourseById(req.params.id);
    if (!course) {
      return res.status(404).render('error', { message: 'Курс не найден' });
    }

    const { title, description, order, videoUrl, durationMinutes, theory } = req.body;

    if (!title) {
      return res.render('teacher/lesson-form', {
        title: `Новый урок — ${course.title}`,
        course,
        lesson: req.body,
        error: 'Название урока обязательно'
      });
    }

    const youtubeId = videoUrl ? extractYouTubeId(videoUrl) : null;

    await db.createLesson({
      id: 'lesson-' + uuidv4().slice(0, 8),
      courseId: course.id,
      title: title.trim(),
      description: (description || '').trim(),
      order: Number(order) || 1,
      videoUrl: (videoUrl || '').trim(),
      youtubeId: youtubeId,
      durationMinutes: Number(durationMinutes) || 10,
      theory: (theory || '').trim()
    });

    res.redirect(`/teacher/courses/${course.id}/edit`);
  } catch (err) {
    console.error('Create lesson error:', err);
    res.status(500).render('error', { message: 'Ошибка при создании урока' });
  }
});

// GET /teacher/lessons/:id/edit - Edit lesson form
router.get('/lessons/:id/edit', async (req, res) => {
  try {
    const lesson = await db.getLessonById(req.params.id);
    if (!lesson) {
      return res.status(404).render('error', { message: 'Урок не найден' });
    }

    const course = await db.getCourseById(lesson.courseId);

    res.render('teacher/lesson-form', {
      title: `Редактирование урока — ${lesson.title}`,
      course,
      lesson,
      error: null
    });
  } catch (err) {
    console.error('Edit lesson error:', err);
    res.status(500).render('error', { message: 'Ошибка при загрузке урока' });
  }
});

// POST /teacher/lessons/:id/edit - Update lesson
router.post('/lessons/:id/edit', async (req, res) => {
  try {
    const lesson = await db.getLessonById(req.params.id);
    if (!lesson) {
      return res.status(404).render('error', { message: 'Урок не найден' });
    }

    const { title, description, order, videoUrl, durationMinutes, theory } = req.body;
    const youtubeId = videoUrl ? extractYouTubeId(videoUrl) : null;

    await db.updateLesson(lesson.id, {
      title: title.trim(),
      description: (description || '').trim(),
      order: Number(order) || lesson.order,
      videoUrl: (videoUrl || '').trim(),
      youtubeId: youtubeId,
      durationMinutes: Number(durationMinutes) || lesson.durationMinutes,
      theory: (theory || '').trim()
    });

    res.redirect(`/teacher/courses/${lesson.courseId}/edit`);
  } catch (err) {
    console.error('Update lesson error:', err);
    res.status(500).render('error', { message: 'Ошибка при сохранении урока' });
  }
});

// POST /teacher/lessons/:id/delete - Delete lesson
router.post('/lessons/:id/delete', async (req, res) => {
  try {
    const lesson = await db.getLessonById(req.params.id);
    if (!lesson) {
      return res.status(404).render('error', { message: 'Урок не найден' });
    }

    const courseId = lesson.courseId;
    await db.deleteLesson(lesson.id);

    res.redirect(`/teacher/courses/${courseId}/edit`);
  } catch (err) {
    console.error('Delete lesson error:', err);
    res.status(500).render('error', { message: 'Ошибка при удалении урока' });
  }
});

module.exports = router;
