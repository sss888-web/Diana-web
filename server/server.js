require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const nodemailer = require("nodemailer");
const { Pool } = require("pg");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(__dirname + "/.."));

const db = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes("localhost")
          ? false
          : { rejectUnauthorized: false },
      }
    : {
        host: process.env.PGHOST || "localhost",
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE || "site",
        port: Number(process.env.PGPORT || 5432),
      },
);

const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL,
      kind VARCHAR(100) NOT NULL,
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

app.get("/api/stats", async (req, res) => {
  const { rows } = await db.query("SELECT COUNT(*)::int AS total FROM leads");
  res.json(rows[0]);
});

app.post("/api/leads", async (req, res) => {
  const { name, email, kind, message, consent } = req.body;

  if (!name || !email || !kind || consent !== true) {
    return res.status(400).json({ ok: false });
  }

  try {
    await db.query(
      "INSERT INTO leads (name, email, kind, message) VALUES ($1, $2, $3, $4)",
      [name, email, kind, message || ""],
    );
  } catch (error) {
    console.error("Не удалось сохранить заявку:", error.message);
    return res.status(500).json({ ok: false });
  }

  const text = [
    "Новая заявка с сайта",
    "Имя: " + name,
    "Email: " + email,
    "Сайт: " + kind,
    "Пожелания: " + (message || "нет"),
  ].join("\n");

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (token && chatId) {
    try {
      await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      console.error("Telegram не отправился:", error.message);
    }
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      await mailer.sendMail({
        from: "Diana Sedal <" + process.env.GMAIL_USER + ">",
        to: process.env.GMAIL_USER,
        replyTo: email,
        subject: "Заявка с сайта — " + name,
        text,
      });
    } catch (error) {
      console.error("Письмо не отправилось:", error.message);
    }
  }

  res.json({ ok: true });
});

app.post("/admin/login", (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    res.cookie("admin", "yes", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    return res.redirect("/admin");
  }
  res.redirect("/admin/login.html");
});

app.get("/admin", async (req, res) => {
  if (req.cookies.admin !== "yes") {
    return res.redirect("/admin/login.html");
  }

  const { rows } = await db.query(
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
  await db.query("DELETE FROM leads WHERE id = $1", [req.body.id]);
  res.redirect("/admin");
});

const port = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log("Откройте http://localhost:" + port);
    });
  })
  .catch((error) => {
    console.error("Не удалось подключить Postgres:", error.message);
    process.exit(1);
  });
