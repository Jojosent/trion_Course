const fs = require('fs');
const path = require('path');
const { getFirestore, isFirebaseActive } = require('../config/firebase');
const { extractYouTubeId } = require('../utils/youtube');

const DB_PATH = path.join(__dirname, '../../data/db.json');

// In-memory cache + file sync
let localData = {
  users: [],
  courses: [],
  lessons: [],
  progress: []
};

// Load initial local file
function loadLocalDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      localData = JSON.parse(raw);
      if (!localData.users) localData.users = [];
      if (!localData.courses) localData.courses = [];
      if (!localData.lessons) localData.lessons = [];
      if (!localData.progress) localData.progress = [];
    } else {
      saveLocalDb();
    }
  } catch (err) {
    console.error('Error reading local db.json:', err);
  }
}

function saveLocalDb() {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(localData, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving local db.json:', err);
  }
}

loadLocalDb();

// DB Operations Layer
const db = {
  // Sync local data into Firestore if Firestore is fresh and empty
  async syncToFirestore() {
    if (!isFirebaseActive()) return;
    try {
      const firestore = getFirestore();
      const usersSnap = await firestore.collection('users').limit(1).get();
      if (usersSnap.empty && localData.users.length > 0) {
        console.log('🔄 [Firebase Sync] Начало синхронизации локальных данных в Cloud Firestore...');
        for (const u of localData.users) {
          await firestore.collection('users').doc(u.id).set(u);
        }
        for (const c of localData.courses) {
          await firestore.collection('courses').doc(c.id).set(c);
        }
        for (const l of localData.lessons) {
          await firestore.collection('lessons').doc(l.id).set(l);
        }
        console.log('✅ [Firebase Sync] Все курсы, уроки и пользователи успешно перенесены в Cloud Firestore!');
      }
    } catch (e) {
      // Handled gracefully (e.g. if Firestore API not enabled yet)
    }
  },

  // ---- USERS ----
  async getAllUsers() {
    if (isFirebaseActive()) {
      try {
        const snapshot = await getFirestore().collection('users').get();
        const users = [];
        snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
        if (users.length > 0) return users;
      } catch (e) {
        // Fallback to local
      }
    }
    return [...localData.users];
  },

  async findUserByEmail(email) {
    if (!email) return null;
    const cleanEmail = email.toLowerCase().trim();

    if (isFirebaseActive()) {
      try {
        const snapshot = await getFirestore().collection('users').where('email', '==', cleanEmail).limit(1).get();
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          return { id: doc.id, ...doc.data() };
        }
      } catch (e) {
        // Fallback to local
      }
    }
    return localData.users.find(u => u.email.toLowerCase() === cleanEmail) || null;
  },

  async findUserById(id) {
    if (!id) return null;
    if (isFirebaseActive()) {
      try {
        const doc = await getFirestore().collection('users').doc(id).get();
        if (doc.exists) {
          return { id: doc.id, ...doc.data() };
        }
      } catch (e) {
        // Fallback to local
      }
    }
    return localData.users.find(u => u.id === id) || null;
  },

  async createUser(userData) {
    const user = {
      ...userData,
      email: userData.email.toLowerCase().trim(),
      role: userData.role || 'student',
      createdAt: userData.createdAt || new Date().toISOString()
    };

    if (isFirebaseActive()) {
      try {
        await getFirestore().collection('users').doc(user.id).set(user);
      } catch (e) {
        // Local persists even if cloud temporarily pending
      }
    }

    localData.users.push(user);
    saveLocalDb();
    return user;
  },

  async updateUserRole(userId, newRole) {
    if (!['admin', 'teacher', 'student'].includes(newRole)) {
      throw new Error('Недопустимая роль');
    }

    if (isFirebaseActive()) {
      try {
        await getFirestore().collection('users').doc(userId).update({ role: newRole });
      } catch (e) {
        // Fallback
      }
    }

    const idx = localData.users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      localData.users[idx].role = newRole;
      saveLocalDb();
      return localData.users[idx];
    }
    return null;
  },

  async deleteUser(userId) {
    if (isFirebaseActive()) {
      try {
        await getFirestore().collection('users').doc(userId).delete();
      } catch (e) {
        // Fallback
      }
    }

    localData.users = localData.users.filter(u => u.id !== userId);
    saveLocalDb();
    return true;
  },

  // ---- COURSES ----
  async getAllCourses() {
    if (isFirebaseActive()) {
      try {
        const snapshot = await getFirestore().collection('courses').get();
        const list = [];
        snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        if (list.length > 0) return list;
      } catch (e) {
        // Fallback
      }
    }
    return [...localData.courses];
  },

  async getCoursesByAuthor(authorId) {
    const all = await this.getAllCourses();
    return all.filter(c => c.authorId === authorId);
  },

  async getCourseById(courseId) {
    if (isFirebaseActive()) {
      try {
        const doc = await getFirestore().collection('courses').doc(courseId).get();
        if (doc.exists) {
          return { id: doc.id, ...doc.data() };
        }
      } catch (e) {
        // Fallback
      }
    }
    return localData.courses.find(c => c.id === courseId) || null;
  },

  async createCourse(courseData) {
    const course = {
      ...courseData,
      createdAt: courseData.createdAt || new Date().toISOString()
    };

    if (isFirebaseActive()) {
      try {
        await getFirestore().collection('courses').doc(course.id).set(course);
      } catch (e) {
        // Fallback
      }
    }

    localData.courses.push(course);
    saveLocalDb();
    return course;
  },

  async updateCourse(courseId, updateData) {
    if (isFirebaseActive()) {
      try {
        await getFirestore().collection('courses').doc(courseId).update(updateData);
      } catch (e) {
        // Fallback
      }
    }

    const idx = localData.courses.findIndex(c => c.id === courseId);
    if (idx !== -1) {
      localData.courses[idx] = { ...localData.courses[idx], ...updateData };
      saveLocalDb();
      return localData.courses[idx];
    }
    return null;
  },

  async deleteCourse(courseId) {
    if (isFirebaseActive()) {
      try {
        await getFirestore().collection('courses').doc(courseId).delete();
      } catch (e) {
        // Fallback
      }
    }

    localData.courses = localData.courses.filter(c => c.id !== courseId);
    localData.lessons = localData.lessons.filter(l => l.courseId !== courseId);
    saveLocalDb();
    return true;
  },

  // ---- LESSONS ----
  async getLessonsByCourseId(courseId) {
    let lessons = [];
    if (isFirebaseActive()) {
      try {
        const snapshot = await getFirestore().collection('lessons')
          .where('courseId', '==', courseId)
          .get();
        snapshot.forEach(doc => lessons.push({ id: doc.id, ...doc.data() }));
        if (lessons.length > 0) {
          return lessons.sort((a, b) => (a.order || 0) - (b.order || 0));
        }
      } catch (e) {
        // Fallback
      }
    }
    lessons = localData.lessons.filter(l => l.courseId === courseId);
    return lessons.sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  async getLessonById(lessonId) {
    if (isFirebaseActive()) {
      try {
        const doc = await getFirestore().collection('lessons').doc(lessonId).get();
        if (doc.exists) {
          return { id: doc.id, ...doc.data() };
        }
      } catch (e) {
        // Fallback
      }
    }
    return localData.lessons.find(l => l.id === lessonId) || null;
  },

  async createLesson(lessonData) {
    const youtubeId = lessonData.videoUrl ? extractYouTubeId(lessonData.videoUrl) : null;
    const lesson = {
      ...lessonData,
      youtubeId: youtubeId || lessonData.youtubeId || null,
      createdAt: lessonData.createdAt || new Date().toISOString()
    };

    if (isFirebaseActive()) {
      try {
        await getFirestore().collection('lessons').doc(lesson.id).set(lesson);
      } catch (e) {
        // Fallback
      }
    }

    localData.lessons.push(lesson);
    saveLocalDb();
    return lesson;
  },

  async updateLesson(lessonId, updateData) {
    if (updateData.videoUrl !== undefined) {
      updateData.youtubeId = extractYouTubeId(updateData.videoUrl);
    }

    if (isFirebaseActive()) {
      try {
        await getFirestore().collection('lessons').doc(lessonId).update(updateData);
      } catch (e) {
        // Fallback
      }
    }

    const idx = localData.lessons.findIndex(l => l.id === lessonId);
    if (idx !== -1) {
      localData.lessons[idx] = { ...localData.lessons[idx], ...updateData };
      saveLocalDb();
      return localData.lessons[idx];
    }
    return null;
  },

  async deleteLesson(lessonId) {
    if (isFirebaseActive()) {
      try {
        await getFirestore().collection('lessons').doc(lessonId).delete();
      } catch (e) {
        // Fallback
      }
    }

    localData.lessons = localData.lessons.filter(l => l.id !== lessonId);
    localData.progress = localData.progress.filter(p => p.lessonId !== lessonId);
    saveLocalDb();
    return true;
  },

  // ---- PROGRESS ----
  async getUserProgressForCourse(userId, courseId) {
    if (!userId || !courseId) return [];
    if (isFirebaseActive()) {
      try {
        const snapshot = await getFirestore().collection('progress')
          .where('userId', '==', userId)
          .where('courseId', '==', courseId)
          .get();
        const list = [];
        snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        if (list.length > 0) return list;
      } catch (e) {
        // Fallback
      }
    }
    return localData.progress.filter(p => p.userId === userId && p.courseId === courseId);
  },

  async getUserLessonProgress(userId, lessonId) {
    if (!userId || !lessonId) return null;
    const progressId = `${userId}_${lessonId}`;

    if (isFirebaseActive()) {
      try {
        const doc = await getFirestore().collection('progress').doc(progressId).get();
        if (doc.exists) {
          return { id: doc.id, ...doc.data() };
        }
      } catch (e) {
        // Fallback
      }
    }

    return localData.progress.find(p => p.id === progressId) || null;
  },

  async saveLessonProgress({ userId, lessonId, courseId, completed, watchedSeconds }) {
    if (!userId || !lessonId) return null;
    const progressId = `${userId}_${lessonId}`;

    const existing = await this.getUserLessonProgress(userId, lessonId);
    const updated = {
      id: progressId,
      userId,
      lessonId,
      courseId,
      completed: completed !== undefined ? completed : (existing ? existing.completed : false),
      watchedSeconds: Math.max(watchedSeconds || 0, existing ? (existing.watchedSeconds || 0) : 0),
      updatedAt: new Date().toISOString()
    };

    if (isFirebaseActive()) {
      try {
        await getFirestore().collection('progress').doc(progressId).set(updated, { merge: true });
      } catch (e) {
        // Fallback
      }
    }

    const idx = localData.progress.findIndex(p => p.id === progressId);
    if (idx !== -1) {
      localData.progress[idx] = updated;
    } else {
      localData.progress.push(updated);
    }
    saveLocalDb();
    return updated;
  },

  getLocalData: () => localData
};

module.exports = db;
