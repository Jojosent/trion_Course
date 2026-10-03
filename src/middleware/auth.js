function populateUser(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  res.locals.currentPath = req.path;
  next();
}

function ensureAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  const redirectUrl = encodeURIComponent(req.originalUrl || '/');
  return res.redirect(`/login?redirect=${redirectUrl}`);
}

function ensureRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      const redirectUrl = encodeURIComponent(req.originalUrl || '/');
      return res.redirect(`/login?redirect=${redirectUrl}`);
    }

    const userRole = req.session.user.role;
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    // Role denied
    return res.status(403).render('error', {
      title: '403 — Доступ запрещен',
      message: 'У вас нет прав для доступа к этому разделу. Требуется роль: ' + allowedRoles.join(' или ') + '.',
      backUrl: '/'
    });
  };
}

module.exports = {
  populateUser,
  ensureAuth,
  ensureRole,
  ensureAdmin: ensureRole('admin'),
  ensureTeacherOrAdmin: ensureRole('teacher', 'admin')
};
