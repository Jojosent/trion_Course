const express = require('express');
const router = express.Router();
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const db = require('../db');
const { ensureAuth } = require('../middleware/auth');

// Configure marked options
marked.setOptions({
  breaks: true,
  gfm: true
});

// GET / - Home page
router.get('/', async (req, res) => {
  try {
    const courses = await db.getAllCourses();
    const users = await db.getAllUsers();
    const teachersCount = users.filter(u => u.role === 'teacher').length;
    const studentsCount = users.filter(u => u.role === 'student').length;

    // Attach lesson counts to courses
    const coursesWithStats = await Promise.all(courses.map(async (c) => {
      const lessons = await db.getLessonsByCourseId(c.id);
      return {
        ...c,
        lessonsCount: lessons.length
      };
    }));

    res.render('index', {
      title: 'Trion Academy — Образовательная Платформа нового поколения',
      courses: coursesWithStats,
      stats: {
        coursesCount: courses.length,
        teachersCount: Math.max(1, teachersCount),
        studentsCount: Math.max(1, studentsCount)
      }
    });
  } catch (err) {
    console.error('Home page error:', err);
    res.status(500).render('error', { message: 'Ошибка загрузки главной страницы' });
  }
});

// GET /courses - Course list
router.get('/courses', async (req, res) => {
  try {
    const courses = await db.getAllCourses();
    const coursesWithStats = await Promise.all(courses.map(async (c) => {
      const lessons = await db.getLessonsByCourseId(c.id);
      return {
        ...c,
        lessonsCount: lessons.length
      };
    }));

    res.render('courses', {
      title: 'Все курсы — Trion Academy',
      courses: coursesWithStats
    });
  } catch (err) {
    console.error('Courses list error:', err);
    res.status(500).render('error', { message: 'Ошибка загрузки курсов' });
  }
});

// GET /courses/:id - Course syllabus and overview
router.get('/courses/:id', async (req, res) => {
  try {
    const course = await db.getCourseById(req.params.id);
    if (!course) {
      return res.status(404).render('error', {
        title: 'Курс не найден',
        message: 'Запрошенный курс не существует или был удален.'
      });
    }

    const lessons = await db.getLessonsByCourseId(course.id);
    let userProgress = [];
    if (req.session.user) {
      userProgress = await db.getUserProgressForCourse(req.session.user.id, course.id);
    }

    const completedLessonIds = new Set(userProgress.filter(p => p.completed).map(p => p.lessonId));

    res.render('course-view', {
      title: `${course.title} — Trion Academy`,
      course,
      lessons,
      completedLessonIds
    });
  } catch (err) {
    console.error('Course view error:', err);
    res.status(500).render('error', { message: 'Ошибка загрузки курса' });
  }
});

// GET /lessons/:id - Lesson view (Theory + Anti-skip Video Player)
router.get('/lessons/:id', ensureAuth, async (req, res) => {
  try {
    const lesson = await db.getLessonById(req.params.id);
    if (!lesson) {
      return res.status(404).render('error', {
        title: 'Урок не найден',
        message: 'Запрошенный урок не найден.'
      });
    }

    const course = await db.getCourseById(lesson.courseId);
    if (!course) {
      return res.status(404).render('error', {
        title: 'Курс не найден',
        message: 'Курс для этого урока не найден.'
      });
    }

    const allLessons = await db.getLessonsByCourseId(course.id);
    const currentIndex = allLessons.findIndex(l => l.id === lesson.id);
    const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
    const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

    // Progress
    const userProgress = await db.getUserProgressForCourse(req.session.user.id, course.id);
    const completedLessonIds = new Set(userProgress.filter(p => p.completed).map(p => p.lessonId));
    const currentLessonProgress = userProgress.find(p => p.lessonId === lesson.id) || null;

    // Render markdown theory securely
    let renderedTheory = '';
    if (lesson.theory) {
      const rawHtml = marked.parse(lesson.theory);
      renderedTheory = sanitizeHtml(rawHtml, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'img', 'span', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr']),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          code: ['class'],
          pre: ['class'],
          span: ['class'],
          img: ['src', 'alt', 'class']
        }
      });
    }

    res.render('lesson-view', {
      title: `${lesson.title} — ${course.title}`,
      course,
      lesson,
      renderedTheory,
      allLessons,
      prevLesson,
      nextLesson,
      completedLessonIds,
      currentLessonProgress
    });
  } catch (err) {
    console.error('Lesson view error:', err);
    res.status(500).render('error', { message: 'Ошибка при открытии урока' });
  }
});

// POST /api/progress/:lessonId - Save student watch progress & completion
router.post('/api/progress/:lessonId', ensureAuth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { courseId, completed, watchedSeconds } = req.body;

    const updated = await db.saveLessonProgress({
      userId: req.session.user.id,
      lessonId,
      courseId,
      completed: completed === true || completed === 'true',
      watchedSeconds: Number(watchedSeconds) || 0
    });

    res.json({ success: true, progress: updated });
  } catch (err) {
    console.error('Save progress error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
