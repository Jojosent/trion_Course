const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

let firestoreDb = null;
let isFirebaseActive = false;

function initFirebase() {
  try {
    const keyPathRoot = path.join(__dirname, '../../serviceAccountKey.json');
    const keyPathConfig = path.join(__dirname, 'serviceAccountKey.json');
    let serviceAccount = null;

    if (fs.existsSync(keyPathRoot)) {
      serviceAccount = require(keyPathRoot);
    } else if (fs.existsSync(keyPathConfig)) {
      serviceAccount = require(keyPathConfig);
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
    }

    if (serviceAccount) {
      if (!admin.getApps().length) {
        admin.initializeApp({
          credential: admin.cert(serviceAccount)
        });
      }
      firestoreDb = getFirestore();
      isFirebaseActive = true;
      console.log(`🔥 [Firebase] Ключ найден (Проект: ${serviceAccount.project_id || serviceAccount.projectId}). Инициализация Firestore...`);

      // Verify connection asynchronously
      firestoreDb.listCollections().then(() => {
        console.log('✅ [Firebase] Успешное соединение с Cloud Firestore установлено!');
      }).catch(err => {
        if (err.message && err.message.includes('Cloud Firestore API has not been used')) {
          console.warn('\n⚠️  [Firebase Внимание] База данных Firestore еще не активирована в проекте!');
          console.warn(`👉 Перейдите по ссылке и нажмите «Создать базу данных» (Create Database):`);
          console.warn(`   https://console.firebase.google.com/project/${serviceAccount.project_id || 'trioncourse'}/firestore`);
          console.warn(`   Или включите API: https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=${serviceAccount.project_id || 'trioncourse'}\n`);
          console.log('💾 [DB] До активации в Firebase все данные надежно сохраняются в data/db.json.\n');
        } else {
          console.warn('⚠️ [Firebase] Проверка связи с Firestore:', err.message);
        }
      });

    } else {
      console.log('ℹ️ [Firebase] Файл serviceAccountKey.json или переменные окружения не найдены.');
      console.log('💡 [Firebase] Автоматически активирован встроенный локальный JSON-драйвер данных (data/db.json).');
      console.log('💡 Для перехода на Firebase: поместите serviceAccountKey.json в корень проекта или заполните .env');
    }
  } catch (error) {
    console.warn('⚠️ [Firebase] Ошибка инициализации Firebase:', error.message);
    console.log('💡 [DB] Переключение на локальное хранилище данных.');
    isFirebaseActive = false;
    firestoreDb = null;
  }

  return {
    admin,
    firestore: firestoreDb,
    isFirebaseActive
  };
}

module.exports = {
  initFirebase,
  getFirestore: () => firestoreDb,
  isFirebaseActive: () => isFirebaseActive
};
