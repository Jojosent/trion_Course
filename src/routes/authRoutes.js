const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// GET /login
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  const redirect = req.query.redirect || '';
  res.render('login', {
    title: 'Вход в аккаунт — Trion Academy',
    error: null,
    redirect
  });
});

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { email, password, redirect } = req.body;

    if (!email || !password) {
      return res.render('login', {
        title: 'Вход в аккаунт',
        error: 'Пожалуйста, заполните email и пароль',
        redirect
      });
    }

    const user = await db.findUserByEmail(email);
    if (!user) {
      return res.render('login', {
        title: 'Вход в аккаунт',
        error: 'Пользователь с таким email не найден',
        redirect
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('login', {
        title: 'Вход в аккаунт',
        error: 'Неверный пароль',
        redirect
      });
    }

    // Set session
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    if (redirect && redirect.startsWith('/')) {
      return res.redirect(redirect);
    }

    // Role-based smart redirect
    if (user.role === 'admin') {
      return res.redirect('/admin');
    } else if (user.role === 'teacher') {
      return res.redirect('/teacher');
    }
    return res.redirect('/');
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', {
      title: 'Вход в аккаунт',
      error: 'Произошла ошибка при входе. Попробуйте еще раз.',
      redirect: req.body.redirect || ''
    });
  }
});

// GET /register
router.get('/register', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('register', {
    title: 'Регистрация — Trion Academy',
    error: null,
    formData: {}
  });
});

// POST /register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role } = req.body;

    if (!name || !email || !password) {
      return res.render('register', {
        title: 'Регистрация',
        error: 'Все обязательные поля должны быть заполнены',
        formData: { name, email, role }
      });
    }

    if (password !== confirmPassword) {
      return res.render('register', {
        title: 'Регистрация',
        error: 'Пароли не совпадают',
        formData: { name, email, role }
      });
    }

    if (password.length < 6) {
      return res.render('register', {
        title: 'Регистрация',
        error: 'Пароль должен содержать не менее 6 символов',
        formData: { name, email, role }
      });
    }

    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return res.render('register', {
        title: 'Регистрация',
        error: 'Пользователь с таким email уже зарегистрирован',
        formData: { name, email, role }
      });
    }

    // Allowed self-registration roles: 'student' or 'teacher' (admin must be created by admin)
    const assignedRole = role === 'teacher' ? 'teacher' : 'student';

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await db.createUser({
      id: 'user-' + uuidv4().slice(0, 8),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role: assignedRole,
      createdAt: new Date().toISOString()
    });

    req.session.user = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role
    };

    if (assignedRole === 'teacher') {
      return res.redirect('/teacher');
    }
    return res.redirect('/');
  } catch (err) {
    console.error('Registration error:', err);
    res.render('register', {
      title: 'Регистрация',
      error: 'Ошибка при регистрации. Пожалуйста, повторите попытку.',
      formData: req.body
    });
  }
});

// GET /logout & POST /logout
router.all('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
