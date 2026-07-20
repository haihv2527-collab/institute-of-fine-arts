const bcrypt = require("bcryptjs");
const db = require("../config/db");

// ----------------------- STAFF -----------------------

// GET /api/admin/staff?search=
function listStaff(req, res) {
  const search = `%${req.query.search || ""}%`;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 8));
  const offset = (page - 1) * pageSize;

  const whereClause = `WHERE u.role = 'staff' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)`;
  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM users u JOIN staffs s ON s.user_id = u.id ${whereClause}`)
    .get(search, search, search).n;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const data = db
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active,
              s.id AS staff_id, s.subject, s.classes, s.joined_date
       FROM users u JOIN staffs s ON s.user_id = u.id
       ${whereClause}
       ORDER BY u.full_name
       LIMIT ? OFFSET ?`
    )
    .all(search, search, search, pageSize, offset);

  res.json({ data, page, pageSize, total, totalPages });
}

// POST /api/admin/staff
function createStaff(req, res) {
  const { username, password, full_name, email, phone, subject, classes, joined_date } = req.body;

  if (!username || !password || !full_name || !email) {
    return res.status(400).json({ message: "username, password, full_name and email are required." });
  }

  const insertUser = db.prepare(
    `INSERT INTO users (username, password_hash, role, full_name, email, phone)
     VALUES (?, ?, 'staff', ?, ?, ?)`
  );
  const insertStaff = db.prepare(
    `INSERT INTO staffs (user_id, subject, classes, joined_date) VALUES (?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    const hash = bcrypt.hashSync(password, 10);
    const result = insertUser.run(username, hash, full_name, email, phone || null);
    insertStaff.run(result.lastInsertRowid, subject || null, classes || null, joined_date || null);
    return result.lastInsertRowid;
  });

  try {
    const userId = tx();
    res.status(201).json({ message: "Staff account created.", user_id: userId });
  } catch (err) {
    res.status(400).json({ message: "Could not create staff. " + err.message });
  }
}

// PUT /api/admin/staff/:id
function updateStaff(req, res) {
  const { id } = req.params; // users.id
  const { full_name, email, phone, is_active, subject, classes, joined_date } = req.body;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email),
       phone = COALESCE(?, phone), is_active = COALESCE(?, is_active), updated_at = datetime('now')
       WHERE id = ? AND role = 'staff'`
    ).run(full_name, email, phone, is_active, id);

    db.prepare(
      `UPDATE staffs SET subject = COALESCE(?, subject), classes = COALESCE(?, classes),
       joined_date = COALESCE(?, joined_date) WHERE user_id = ?`
    ).run(subject, classes, joined_date, id);
  });

  tx();
  res.json({ message: "Staff account updated." });
}

// DELETE /api/admin/staff/:id
function deleteStaff(req, res) {
  const result = db.prepare("DELETE FROM users WHERE id = ? AND role = 'staff'").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ message: "Staff not found." });
  res.json({ message: "Staff account deleted." });
}

// PATCH /api/admin/staff/:id/password — admin sets a brand new password.
// Note: there is no way to *view* an existing password — it's stored as
// a one-way bcrypt hash, by design, so only resetting to a new value is
// possible, never reading the old one back out.
function resetStaffPassword(req, res) {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("UPDATE users SET password_hash = ? WHERE id = ? AND role = 'staff'")
    .run(hash, req.params.id);
  if (result.changes === 0) return res.status(404).json({ message: "Staff not found." });
  res.json({ message: "Password reset successfully." });
}

// ----------------------- STUDENT -----------------------

// GET /api/admin/students?search=
function listStudents(req, res) {
  const search = `%${req.query.search || ""}%`;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 8));
  const offset = (page - 1) * pageSize;

  const whereClause = `WHERE u.role = 'student' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)`;
  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM users u JOIN students st ON st.user_id = u.id ${whereClause}`)
    .get(search, search, search).n;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const data = db
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active,
              st.id AS student_id, st.admission_no, st.admission_date, st.date_of_birth,
              st.address, st.guardian_name, st.guardian_phone, st.class_name
       FROM users u JOIN students st ON st.user_id = u.id
       ${whereClause}
       ORDER BY u.full_name
       LIMIT ? OFFSET ?`
    )
    .all(search, search, search, pageSize, offset);

  res.json({ data, page, pageSize, total, totalPages });
}

// POST /api/admin/students
function createStudent(req, res) {
  const {
    username, password, full_name, email, phone,
    admission_no, admission_date, date_of_birth, address,
    guardian_name, guardian_phone, class_name,
  } = req.body;

  if (!username || !password || !full_name || !email) {
    return res.status(400).json({ message: "username, password, full_name and email are required." });
  }

  const insertUser = db.prepare(
    `INSERT INTO users (username, password_hash, role, full_name, email, phone)
     VALUES (?, ?, 'student', ?, ?, ?)`
  );
  const insertStudent = db.prepare(
    `INSERT INTO students (user_id, admission_no, admission_date, date_of_birth, address, guardian_name, guardian_phone, class_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    const hash = bcrypt.hashSync(password, 10);
    const result = insertUser.run(username, hash, full_name, email, phone || null);
    insertStudent.run(
      result.lastInsertRowid, admission_no || null, admission_date || null,
      date_of_birth || null, address || null, guardian_name || null,
      guardian_phone || null, class_name || null
    );
    return result.lastInsertRowid;
  });

  try {
    const userId = tx();
    res.status(201).json({ message: "Student account created.", user_id: userId });
  } catch (err) {
    res.status(400).json({ message: "Could not create student. " + err.message });
  }
}

// PUT /api/admin/students/:id
function updateStudent(req, res) {
  const { id } = req.params; // users.id
  const {
    full_name, email, phone, is_active,
    admission_no, admission_date, date_of_birth, address,
    guardian_name, guardian_phone, class_name,
  } = req.body;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email),
       phone = COALESCE(?, phone), is_active = COALESCE(?, is_active), updated_at = datetime('now')
       WHERE id = ? AND role = 'student'`
    ).run(full_name, email, phone, is_active, id);

    db.prepare(
      `UPDATE students SET admission_no = COALESCE(?, admission_no), admission_date = COALESCE(?, admission_date),
       date_of_birth = COALESCE(?, date_of_birth), address = COALESCE(?, address),
       guardian_name = COALESCE(?, guardian_name), guardian_phone = COALESCE(?, guardian_phone),
       class_name = COALESCE(?, class_name) WHERE user_id = ?`
    ).run(admission_no, admission_date, date_of_birth, address, guardian_name, guardian_phone, class_name, id);
  });

  tx();
  res.json({ message: "Student account updated." });
}

// DELETE /api/admin/students/:id
function deleteStudent(req, res) {
  const result = db.prepare("DELETE FROM users WHERE id = ? AND role = 'student'").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ message: "Student not found." });
  res.json({ message: "Student account deleted." });
}

// PATCH /api/admin/students/:id/password — admin sets a brand new password.
function resetStudentPassword(req, res) {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("UPDATE users SET password_hash = ? WHERE id = ? AND role = 'student'")
    .run(hash, req.params.id);
  if (result.changes === 0) return res.status(404).json({ message: "Student not found." });
  res.json({ message: "Password reset successfully." });
}

module.exports = {
  listStaff, createStaff, updateStaff, deleteStaff, resetStaffPassword,
  listStudents, createStudent, updateStudent, deleteStudent, resetStudentPassword,
};
