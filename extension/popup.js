/* =====================================================================
   RealtyReach companion extension — popup logic

   BEFORE PUBLISHING: change APP_URL to your deployed app
   (your Vercel URL, e.g. https://realtyreach.vercel.app).
   For local testing keep http://localhost:3000
   ===================================================================== */
const APP_URL = "http://localhost:3000";

const openBtn = document.getElementById("open");
const prefillBtn = document.getElementById("prefill");
const foundBox = document.getElementById("found");

openBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: APP_URL });
});

/* If the active tab is a LinkedIn profile, read name + headline from the
   page (via activeTab, so permission is granted by the user's click) and
   offer a pre-filled sequence. */
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab?.url?.startsWith("https://www.linkedin.com/")) return;

  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      func: () => {
        const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
        const name = clean(document.querySelector("h1")?.innerText);
        // The headline line under the name, e.g. "Realtor at Keller Williams"
        const headline = clean(
          document.querySelector(".text-body-medium.inline")?.innerText ||
            document.querySelector("div.mt1 > span")?.innerText ||
            ""
        );
        let role = "";
        let company = "";
        const at = headline.split(" at ");
        if (at.length === 2) {
          role = at[0];
          company = at[1].split("·")[0];
        } else if (headline) {
          role = headline;
        }
        return { name, role, company: clean(company) };
      },
    },
    (results) => {
      const p = results?.[0]?.result;
      if (!p || !p.name) return;

      foundBox.hidden = false;
      foundBox.innerHTML =
        "Lead found: <b></b><br>" +
        [p.role, p.company].filter(Boolean).map(escapeHtml).join(" · ");
      foundBox.querySelector("b").textContent = p.name;

      prefillBtn.hidden = false;
      prefillBtn.addEventListener("click", () => {
        const q = new URLSearchParams();
        if (p.name) q.set("name", p.name);
        if (p.role) q.set("role", p.role);
        if (p.company) q.set("company", p.company);
        q.set("src", "chrome-extension");
        chrome.tabs.create({ url: `${APP_URL}/?${q.toString()}` });
      });
    }
  );
});

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
