const express = require("express");
const cookieParser = require("cookie-parser");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(__dirname + "/.."));

const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "dianavslvna@gmail.com",
    pass: "ПАРОЛЬ_ПРИЛОЖЕНИЯ_GMAIL",
  },
});

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "ПАРОЛЬ_MYSQL",
  database: "site",
});

app.get("/api/stats", async (req, res) => {
  const [rows] = await db.query("SELECT COUNT(*) AS total FROM leads");
  res.json(rows[0]);
});

app.post("/api/leads", async (req, res) => {
  const { name, email, kind, message } = req.body;

  if (!name || !email || !kind) {
    return res.status(400).json({ ok: false });
  }

  await db.query(
    "INSERT INTO leads (name, email, kind, message) VALUES (?, ?, ?, ?)",
    [name, email, kind, message || ""],
  );

  const text = [
    "Новая заявка с сайта",
    "Имя: " + name,
    "Email: " + email,
    "Сайт: " + kind,
    "Пожелания: " + (message || "нет"),
  ].join("\n");

  await fetch("https://api.telegram.org/botТОКЕН_БОТА/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: "CHAT_ID",
      text,
    }),
  });

  await mailer.sendMail({
    from: "Diana Sedal <dianavslvna@gmail.com>",
    to: "dianavslvna@gmail.com",
    replyTo: email,
    subject: "Заявка с сайта — " + name,
    text,
  });

  res.json({ ok: true });
});

app.post("/admin/login", (req, res) => {
  if (req.body.password === "ПАРОЛЬ_АДМИНКИ") {
    res.cookie("admin", "yes", { httpOnly: true });
    return res.redirect("/admin");
  }
  res.redirect("/admin/login.html");
});

app.get("/admin", async (req, res) => {
  if (req.cookies.admin !== "yes") {
    return res.redirect("/admin/login.html");
  }

  const [rows] = await db.query(
    "SELECT id, name, email, kind, message, created_at FROM leads ORDER BY id DESC",
  );

  const items = rows
    .map((row) => {
      return (
        '<article class="card lead-card">' +
        '<p class="lead-date">' +
        row.created_at +
        "</p>" +
        "<h2>" +
        row.name +
        "</h2>" +
        "<p>" +
        row.email +
        "</p>" +
        "<p>" +
        row.kind +
        "</p>" +
        "<p>" +
        (row.message || "") +
        "</p>" +
        '<form method="post" action="/admin/delete">' +
        '<input type="hidden" name="id" value="' +
        row.id +
        '">' +
        '<button class="btn btn-ghost" type="submit">Удалить</button>' +
        "</form>" +
        "</article>"
      );
    })
    .join("");

  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Заявки</title>
      <link rel="stylesheet" href="/css/style.css">
    </head>
    <body class="blush">
      <header class="site-header admin-header">
        <div class="wrap">
          <strong>Заявки</strong>
          <a href="/admin/logout">Выйти</a>
        </div>
      </header>
      <main class="section">
        <div class="wrap leads-list">${items || "<p>Пока нет заявок</p>"}</div>
      </main>
    </body>
    </html>
  `);
});

app.get("/admin/logout", (req, res) => {
  res.clearCookie("admin");
  res.redirect("/admin/login.html");
});

app.post("/admin/delete", async (req, res) => {
  if (req.cookies.admin !== "yes") {
    return res.redirect("/admin/login.html");
  }
  await db.query("DELETE FROM leads WHERE id = ?", [req.body.id]);
  res.redirect("/admin");
});

app.listen(3000, () => {
  console.log("Откройте http://localhost:3000");
});
