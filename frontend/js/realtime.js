/* ============================================================
   realtime.js — connects to the Socket.io server (only once the
   person is logged in) and turns backend events into toast
   notifications, live-refreshing the current page's list when
   relevant. Loaded on every page via layout.js so it works site-wide
   without editing every single HTML file.
   ============================================================ */

let socket = null;

function connectRealtime() {
  const user = Auth.getUser();
  const token = Auth.getToken();
  if (!user || !token || typeof io === "undefined") return;
  if (socket) return; // already connected this page load

  socket = io({ auth: { token } });

  socket.on("connect_error", () => {
    // Silent — realtime is a nice-to-have, never block the page over it.
  });

  // ---- Student-facing events ----
  socket.on("submission:scored", (data) => {
    toast(`🎨 ${data.judgeName} vừa chấm bài "${data.competitionTitle}" của bạn: ${data.mark}`);
    if (typeof window.onRealtimeSubmissionScored === "function") {
      window.onRealtimeSubmissionScored(data);
    }
  });

  socket.on("award:new", (data) => {
    toast(`🏆 Chúc mừng! Bạn vừa được trao giải "${data.awardName}" — ${data.competitionTitle}`);
  });

  socket.on("exhibition:sold", (data) => {
    toast(`💰 Tranh "${data.paintingTitle || "Untitled"}" của bạn vừa được bán tại ${data.exhibitionTitle}!`);
  });

  // ---- Staff-facing events ----
  socket.on("submission:new", (data) => {
    toast(`📥 ${data.studentName} vừa nộp bài mới vào "${data.competitionTitle}"`);
    if (typeof window.onRealtimeNewSubmission === "function") {
      window.onRealtimeNewSubmission(data);
    }
  });
}
