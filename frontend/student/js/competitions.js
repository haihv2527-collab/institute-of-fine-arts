Auth.guard(["student"]);
renderHeader();
renderDashShell({ role: "student", active: "/student/competitions.html", title: "Competitions" });

let competitions = [];
let mySubmissions = [];

function modalShell(innerHtml) {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `<div class="modal"><button class="close-x" onclick="closeModal()">&times;</button>${innerHtml}</div>`;
  wrap.addEventListener("click", (e) => { if (e.target === wrap) closeModal(); });
  document.body.appendChild(wrap);
}
function closeModal() { const el = document.querySelector(".modal-backdrop"); if (el) el.remove(); }

function competitionCard(c) {
  const already = mySubmissions.some((s) => s.competition_id === c.id);
  const canSubmit = c.status === "ongoing";
  return `
    <div class="frame">
      <span class="corner tl"></span><span class="corner tr"></span>
      <span class="corner bl"></span><span class="corner br"></span>
      <span class="tag ${c.status}">${c.status}</span>
      <h3 style="margin-top:10px;">${escapeHtml(c.title)}</h3>
      <p>${escapeHtml(c.description || "No description.")}</p>
      <p class="hint"><strong>Conditions:</strong> ${escapeHtml(c.conditions || "—")}</p>
      <p class="hint"><strong>Prize:</strong> ${escapeHtml(c.prize || "—")}</p>
      <div class="label"><span>Deadline: ${fmtDate(c.end_date)}</span></div>
      <div style="margin-top:12px;">
        ${already
          ? `<span class="tag ongoing">Already submitted</span>`
          : canSubmit
            ? `<button class="btn gold small" onclick="openSubmit(${c.id})">Submit a Painting</button>`
            : `<span class="hint">Not accepting entries right now.</span>`
        }
      </div>
    </div>
  `;
}

async function load() {
  const main = document.getElementById("dash-main-content");
  try {
    const [competitionsResult, submissionsResult] = await Promise.all([
      api.get("/competitions"),
      api.get("/submissions?pageSize=1000"),
    ]);
    competitions = competitionsResult;
    mySubmissions = submissionsResult.data;
    main.innerHTML = `
      <div class="grid">
        ${competitions.length ? competitions.map(competitionCard).join("") : `<div class="empty-state">No competitions available yet.</div>`}
      </div>
    `;
  } catch (err) {
    toast(err.message, true);
  }
}

function openSubmit(competitionId) {
  modalShell(`
    <h2>Submit Your Painting</h2>
    <form id="submit-form">
      <label>Painting title</label>
      <input name="title" placeholder="e.g. Golden Field at Dusk" />
      <label>Description</label>
      <textarea name="description" placeholder="Tell us about your painting..."></textarea>
      <label>Poem / quote (optional)</label>
      <textarea name="quote" placeholder="A line of poetry or quote that inspired this piece"></textarea>
      <label>Painting image (JPEG only)</label>
      <input name="painting" type="file" accept="image/jpeg" required />
      <button class="btn gold" type="submit" style="width:100%; justify-content:center;">Submit painting</button>
    </form>
  `);

  document.getElementById("submit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    fd.append("competition_id", competitionId);
    try {
      await api.post("/submissions", fd, true);
      toast("Painting submitted successfully!");
      closeModal();
      load();
    } catch (err) {
      toast(err.message, true);
    }
  });
}

load();
