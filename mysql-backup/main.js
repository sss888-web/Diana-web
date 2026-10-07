const menuBtn = document.querySelector("[data-menu]");
const nav = document.querySelector("[data-nav]");

if (menuBtn && nav) {
  menuBtn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  });
}

const lightbox = document.querySelector("[data-lightbox]");
const lightboxImg = document.querySelector("[data-lightbox-img]");

document.querySelectorAll("[data-shot]").forEach((button) => {
  button.addEventListener("click", () => {
    const img = button.querySelector("img");
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt;
    lightbox.classList.add("open");
  });
});

if (lightbox) {
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox || event.target.closest("[data-lightbox-close]")) {
      lightbox.classList.remove("open");
      lightboxImg.src = "";
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") lightbox.classList.remove("open");
  });
}

const form = document.querySelector("[data-form]");
if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const note = form.querySelector("[data-form-note]");
    const button = form.querySelector("[type='submit']");
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const kind = form.kind.value;
    const message = form.message.value.trim();
    const honey = form.querySelector("[name='_honey']");

    if (honey && honey.value) return;

    button.disabled = true;
    note.hidden = false;
    note.classList.remove("is-ok", "is-err");
    note.textContent = t("form.sending");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, kind, message }),
      });
      const data = await response.json().catch(() => ({}));
      const sent = response.ok && data.ok;

      if (!sent) {
        note.classList.add("is-err");
        note.textContent = t("form.err");
        button.disabled = false;
        return;
      }
      form.reset();
      note.classList.add("is-ok");
      note.textContent = t("form.ok");
    } catch (error) {
      note.classList.add("is-err");
      note.textContent = t("form.offline");
      button.disabled = false;
    }
  });
}
