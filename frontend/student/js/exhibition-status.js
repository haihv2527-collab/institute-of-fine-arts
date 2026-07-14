Auth.guard(["student"]);
renderHeader();
renderDashShell({ role: "student", active: "/student/exhibition-status.html", title: "My Exhibited Paintings" });

function paintingCard(p, exhibitionTitle) {
  return `
    <div class="frame">
      <span class="corner tl"></span><span class="corner tr"></span>
      <span class="corner bl"></span><span class="corner br"></span>
      <img class="painting-img" src="${paintingUrl(p.image_path)}" alt="${escapeHtml(p.painting_title || 'Painting')}" />
      <span class="tag ${p.status}">${p.status.replace("_", " ")}</span>
      <h3 style="margin-top:10px;">${escapeHtml(p.painting_title || "Untitled")}</h3>
      <p class="hint">${escapeHtml(exhibitionTitle)}</p>
      <p class="hint"><strong>Asking price:</strong> ${p.asking_price ?? "—"}</p>
      ${p.status === "sold" ? `
        <p class="hint"><strong>Sold price:</strong> ${p.sold_price ?? "—"}</p>
        <p class="hint"><strong>Payment received:</strong> ${p.paid_to_student ? "Yes" : "Not yet"}</p>
      ` : ""}
    </div>
  `;
}

async function load() {
  const main = document.getElementById("dash-main-content");
  try {
    const exhibitions = await api.get("/exhibitions");
    const results = await Promise.all(
      exhibitions.map(async (e) => ({
        exhibition: e,
        paintings: await api.get(`/exhibitions/${e.id}/paintings`),
      }))
    );
    const withPaintings = results.filter((r) => r.paintings.length > 0);

    if (!withPaintings.length) {
      main.innerHTML = `<div class="empty-state">None of your paintings are in an exhibition yet. Strong submissions may be selected by your teacher.</div>`;
      return;
    }

    main.innerHTML = withPaintings.map((r) => `
      <h2 style="margin-top:28px;">${escapeHtml(r.exhibition.title)} <span class="tag ${r.exhibition.status}">${r.exhibition.status}</span></h2>
      <div class="grid">
        ${r.paintings.map((p) => paintingCard(p, r.exhibition.title)).join("")}
      </div>
    `).join("");
  } catch (err) {
    toast(err.message, true);
  }
}

load();
