const SUPABASE_URL = "https://jwzheesmfyjaulswafsr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3emhlZXNtZnlqYXVsc3dhZnNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyNDg2MDcsImV4cCI6MjA3ODgyNDYwN30.lubnjWPrdMFtlZJMav69GVfoguu3XOLWrMH_gi7fplo";
const SUPABASE_TABLE = "submissions";
const APP_VERSION = "v1.0.0";
const STORAGE_KEY = "vendor-rating-submissions-cache";
const SCHEMA_VERSION = 2;
const vendors = ["Yonyou", "Kingdee"];
const criteria = [
  {
    id: "user_community",
    name: "User community",
    description:
      "Availability of online resources, active user forums and knowledge-sharing platforms.",
    weightPercent: 1,
  },
  {
    id: "service_expertise",
    name: "Services expertise",
    description:
      "Vendor's professional experience and ability to provide qualified implementation services.",
    weightPercent: 5,
  },
  {
    id: "consulting_quality",
    name: "Consulting quality",
    description:
      "Quality and professionalism of vendor's consultation, including clarity of guidance and proposed solutions.",
    weightPercent: 5,
  },
  {
    id: "roadmap",
    name: "Product roadmap and future vision",
    description:
      "Vendor's long-term product development direction, upgrades and innovation planning.",
    weightPercent: 3,
  },
  {
    id: "customer_focus",
    name: "Customer focus",
    description:
      "Vendor's responsiveness to customer needs, willingness to listen and customer-centric approach.",
    weightPercent: 2,
  },
  {
    id: "product_functionality",
    name: "Product functionality & performance",
    description:
      "Level of maturity, stability and capability of the product to meet business requirements.",
    weightPercent: 25,
  },
  {
    id: "overall_cost",
    name: "Overall cost",
    description:
      "Total cost including licensing, implementation, maintenance and any recurring fees.",
    weightPercent: 20,
  },
  {
    id: "understand_needs",
    name: "Ability to understand needs",
    description:
      "Vendor's ability to understand business requirements and translate the information into workable solutions.",
    weightPercent: 5,
  },
  {
    id: "customization",
    name: "Customization friendliness",
    description:
      "Flexibility for customization and ease of adapting the system without heavy redevelopment.",
    weightPercent: 5,
  },
  {
    id: "ease_of_use",
    name: "Ease of Use / User Interface (UI/UX)",
    description:
      "Overall usability of the system, intuitiveness of the interface and user-friendliness for daily operations.",
    weightPercent: 15,
  },
  {
    id: "reporting",
    name: "Reporting and Analytics Capabilities",
    description:
      "Ability to generate reports, dashboards and analytics to support decision-making, flexibility of reporting formats and data extraction.",
    weightPercent: 10,
  },
  {
    id: "training",
    name: "Training and Documentation Quality",
    description:
      "Availability and quality of user manuals, training materials, onboarding guidance and learning support.",
    weightPercent: 1,
  },
];

const weightMap = {
  A: 2,
  B: 1,
  "N/A": 0,
};

let form;
let usernameInput;
let totalsContainer;
let tableBody;
let criteriaBody;
let pieChart;
let submissions = [];
let refreshButton;
let resetButton;
let supabaseClient;

function initialize() {
  const root = document.getElementById("rating-app");
  form = document.getElementById("rating-form");
  usernameInput = document.getElementById("username");
  totalsContainer = document.getElementById("totals-container");
  tableBody = document.querySelector("#submissions-table tbody");
  criteriaBody = document.getElementById("criteria-body");
  refreshButton = document.getElementById("refresh-data");
  resetButton = document.getElementById("reset-data");

  if (!root || !form || !usernameInput || !totalsContainer || !tableBody || !criteriaBody) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initialize, { once: true });
      return;
    }
    console.error("Initialization failed: required DOM elements are missing.");
    return;
  }

  supabaseClient = createSupabaseClient();
  updateVersionBadges();
  renderCriteriaRows();
  criteriaBody.addEventListener("change", handleCounterpartAutoSelection);
  loadData().finally(() => {
    pieChart = initPieChart();
    render();
  });

  form.addEventListener("submit", handleSubmit);
  refreshButton?.addEventListener("click", handleRefresh);
  resetButton?.addEventListener("click", handleReset);
}

initialize();

async function handleSubmit(event) {
  event.preventDefault();

  const username = usernameInput.value.trim();
  if (!username) {
    alert("Please enter a reviewer name.");
    usernameInput.focus();
    return;
  }

  const ratings = collectRatingsFromForm();
  if (!ratings) {
    alert("Please complete all ratings before submitting.");
    return;
  }

  try {
    const newSubmission = {
      username: username.trim(),
      ratings,
    };

    await upsertSubmission(newSubmission);
    await loadData();
    render();
    form.reset();
    usernameInput.focus();
  } catch (error) {
    console.error("Failed to submit ratings:", error);
    alert(
      "Unable to store ratings on the server. Please check the console or Supabase table policies."
    );
  }
}

function renderCriteriaRows() {
  if (!criteriaBody) return;
  if (criteriaBody.children.length > 0) {
    return;
  }
  const fragment = document.createDocumentFragment();
  criteria.forEach((criterion, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="criteria-name">
        <span class="criteria-index">${String(index + 1).padStart(2, "0")}</span>
        <div class="criteria-text">
          <span class="criteria-title">${escapeHTML(criterion.name)}</span>
          <span class="criteria-description">${escapeHTML(criterion.description)}</span>
        </div>
      </td>
      <td class="criteria-weight">${criterion.weightPercent}%</td>
      ${vendors
        .map(
          (vendor) => `
        <td>
          <select data-vendor="${vendor}" data-criterion="${criterion.id}" required>
            <option value="" disabled selected>Select</option>
            <option value="A">A (2 pts)</option>
            <option value="B">B (1 pt)</option>
            <option value="N/A">N/A (0 pt)</option>
          </select>
        </td>
      `
        )
        .join("")}
    `;
    fragment.appendChild(row);
  });
  criteriaBody.innerHTML = "";
  criteriaBody.appendChild(fragment);
}

function collectRatingsFromForm() {
  if (!form) return null;
  const ratings = {};
  for (const vendor of vendors) {
    ratings[vendor] = {};
  }

  for (const criterion of criteria) {
    for (const vendor of vendors) {
      const select = form.querySelector(
        `select[data-vendor="${vendor}"][data-criterion="${criterion.id}"]`
      );
      if (!select) continue;
      const value = select.value;
      if (!value) {
        select.focus();
        select.reportValidity();
        return null;
      }
      ratings[vendor][criterion.id] = value;
    }
  }
  return ratings;
}

async function loadData() {
  try {
    const { data, error } = await supabaseClient
      .from(SUPABASE_TABLE)
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    submissions = Array.isArray(data)
      ? data.map((item) => normalizeSubmission(item)).filter(Boolean)
      : [];

    cacheSubmissions(submissions);
  } catch (error) {
    console.error("Failed to load submissions:", error);
    submissions = loadCachedSubmissions();
  }
}

function normalizeSubmission(item) {
  if (
    !item ||
    typeof item !== "object" ||
    typeof item.username !== "string" ||
    !item.ratings ||
    typeof item.ratings !== "object"
  ) {
    return null;
  }

  const normalized = {
    id: item.id ?? createId(),
    schemaVersion: SCHEMA_VERSION,
    username: item.username.trim(),
    ratings: {
      Yonyou: item.yonyou_ratings ?? {},
      Kingdee: item.kingdee_ratings ?? {},
    },
    createdAt: item.created_at ?? item.createdAt ?? new Date().toISOString(),
    updatedAt: item.updated_at ?? item.updatedAt ?? new Date().toISOString(),
  };

  for (const vendor of vendors) {
    const source = normalized.ratings[vendor];
    normalized.ratings[vendor] = {};

    for (const criterion of criteria) {
      const value = source?.[criterion.id];
      normalized.ratings[vendor][criterion.id] = weightMap[value] !== undefined ? value : "N/A";
    }
  }

  return normalized;
}

function cacheSubmissions(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("Unable to cache submissions locally.", error);
  }
}

function loadCachedSubmissions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeSubmission(item)).filter(Boolean);
  } catch (error) {
    console.error("Failed to read cached submissions:", error);
    return [];
  }
}


async function upsertSubmission(payload) {
  const timestamp = new Date().toISOString();

  const { data: existing, error: fetchError } = await supabaseClient
    .from(SUPABASE_TABLE)
    .select("id, created_at")
    .eq("username", payload.username)
    .maybeSingle();

  if (fetchError && fetchError.code !== "PGRST116") {
    throw fetchError;
  }

  if (existing) {
    const { error: updateError } = await supabaseClient
      .from(SUPABASE_TABLE)
      .update({
        yonyou_ratings: payload.ratings.Yonyou,
        kingdee_ratings: payload.ratings.Kingdee,
        updated_at: timestamp,
      })
      .eq("id", existing.id);

    if (updateError) {
      throw updateError;
    }
  } else {
    const { error: insertError } = await supabaseClient.from(SUPABASE_TABLE).insert({
      username: payload.username,
      yonyou_ratings: payload.ratings.Yonyou,
      kingdee_ratings: payload.ratings.Kingdee,
      created_at: timestamp,
      updated_at: timestamp,
    });

    if (insertError) {
      throw insertError;
    }
  }
}



function initPieChart() {
  const ctx = document.getElementById("score-pie");
  const totals = computeTotals(submissions);
  const datasetData = vendors.map((vendor) => totals[vendor].score);

  if (typeof Chart === "undefined" || !ctx) {
    return {
      data: { datasets: [{ data: datasetData }] },
      update() {},
    };
  }

  if (typeof ChartDataLabels !== "undefined" && Chart.registry?.plugins?.get("datalabels") !== ChartDataLabels) {
    Chart.register(ChartDataLabels);
  }

  return new Chart(ctx, {
    type: "pie",
    data: {
      labels: vendors,
      datasets: [
        {
          label: "Total Score",
          data: datasetData,
          backgroundColor: ["#ff6fa7", "#ffafcc"],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
        },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.raw ?? 0;
              const total = context.dataset.data.reduce((sum, item) => sum + (item ?? 0), 0);
              const percentage = total ? ((value / total) * 100).toFixed(1) : "0.0";
              return `${context.label}: ${formatScore(value)} pts (${percentage}%)`;
            },
          },
        },
        datalabels: {
          formatter(value, ctx) {
            const dataset = ctx.chart.data.datasets[0];
            const total = dataset.data.reduce((sum, item) => sum + (item ?? 0), 0);
            if (!total) return "";
            const percentage = ((value / total) * 100).toFixed(1);
            return `${percentage}%`;
          },
          color: "#ffffff",
          font: {
            weight: "700",
            size: 14,
          },
        },
      },
    },
  });
}

function computeTotals(data) {
  const totals = {};

  for (const vendor of vendors) {
    totals[vendor] = { score: 0, ratedEntries: 0 };
  }

  for (const submission of data) {
    for (const vendor of vendors) {
      const vendorRatings = submission.ratings[vendor] ?? {};
      for (const criterion of criteria) {
        const rating = vendorRatings[criterion.id] ?? "N/A";
        const scoreValue = weightMap[rating] ?? 0;
        const weightedScore = scoreValue * criterion.weightPercent * 0.1;
        totals[vendor].score += weightedScore;
        if (rating !== "N/A") {
          totals[vendor].ratedEntries += 1;
        }
      }
    }
  }

  return totals;
}

function renderTotals() {
  const totals = computeTotals(submissions);
  if (pieChart && pieChart.data && pieChart.data.datasets?.[0]) {
    pieChart.data.datasets[0].data = vendors.map((vendor) => totals[vendor].score);
    if (typeof pieChart.update === "function") {
      pieChart.update();
    }
  }

  const submissionCount = submissions.length;

  const boxes = totalsContainer
    ? totalsContainer.querySelectorAll(".total-box")
    : [];

  boxes.forEach((box) => {
    const vendor = box.dataset.vendor;
    const scoreEl = box.querySelector(".score");
    const averageEl = box.querySelector(".average");
    const countEl = box.querySelector(".count");

    const totalScore = totals[vendor].score ?? 0;
    const averageScore = submissionCount ? totalScore / submissionCount : 0;

    scoreEl.textContent = `${formatScore(totalScore)} pts`;
    averageEl.textContent = `Average ${formatScore(averageScore)} pts`;
    countEl.textContent =
      submissionCount > 0 ? `${submissionCount} submissions` : "No submissions yet";
  });
}

function renderTable() {
  if (!tableBody) return;

  tableBody.innerHTML = "";
  if (submissions.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.className = "empty-row";
    emptyRow.innerHTML = `<td colspan="4">No data yet</td>`;
    tableBody.appendChild(emptyRow);
    return;
  }

  const sorted = [...submissions].sort(
    (a, b) =>
      new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() -
      new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
  );

  for (const submission of sorted) {
    const yonyouScore = calculateVendorScore(submission.ratings.Yonyou);
    const kingdeeScore = calculateVendorScore(submission.ratings.Kingdee);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHTML(submission.username)}</td>
      <td>${formatScore(yonyouScore.total)} pts</td>
      <td>${formatScore(kingdeeScore.total)} pts</td>
      <td class="breakdown">
        ${createBreakdownDetails(yonyouScore.breakdown, kingdeeScore.breakdown)}
      </td>
    `;
    tableBody.appendChild(row);
  }
}

function calculateVendorScore(ratingsMap = {}) {
  let total = 0;
  const breakdown = criteria.map((criterion, index) => {
    const rating = ratingsMap[criterion.id] ?? "N/A";
    const baseScore = weightMap[rating] ?? 0;
    const weighted = Number((baseScore * criterion.weightPercent * 0.1).toFixed(2));
    total += weighted;
    return {
      index: index + 1,
      label: criterion.name,
      weightPercent: criterion.weightPercent,
      rating,
      weighted,
    };
  });

  total = Number(total.toFixed(2));
  return { total, breakdown };
}

function createBreakdownDetails(yonyouBreakdown, kingdeeBreakdown) {
  const yonyouHtml = buildBreakdownColumn("Yonyou", yonyouBreakdown);
  const kingdeeHtml = buildBreakdownColumn("Kingdee", kingdeeBreakdown);

  return `
    <details>
      <summary>View breakdown</summary>
      <div class="breakdown-panel">
        ${yonyouHtml}
        ${kingdeeHtml}
      </div>
    </details>
  `;
}

function buildBreakdownColumn(vendor, breakdown) {
  const rows = breakdown
    .map((item) => {
      const indexLabel = String(item.index).padStart(2, "0");
      const ratingBadge = createRatingBadge(item.rating);
      return `
        <div class="criterion-row">
          <span class="criterion-label">${indexLabel}. ${escapeHTML(item.label)}（${item.weightPercent}%）</span>
          <span class="criterion-score">${ratingBadge}<span class="score-text">${formatScore(item.weighted)} pts</span></span>
        </div>
      `;
    })
    .join("");

  return `
    <div class="breakdown-vendor">
      <h4>${vendor}</h4>
      ${rows}
    </div>
  `;
}

function createRatingBadge(rating) {
  const display = rating ?? "N/A";
  const slug = display.replace("/", "").replace("N/A", "NA");
  return `<span class="rating-chip badge-${slug}">${display}</span>`;
}

function formatScore(value) {
  const numeric = Number(value);
  const safeValue = Number.isFinite(numeric) ? numeric : 0;
  return safeValue.toLocaleString("zh-TW", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function escapeHTML(string) {
  return String(string).replace(/[&<>"']/g, (match) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[match];
  });
}

function render() {
  renderTotals();
  renderTable();
}

function updateVersionBadges() {
  document.querySelectorAll("[data-version]").forEach((element) => {
    element.textContent = APP_VERSION;
  });
}

async function handleRefresh() {
  await loadData();
  render();
}

async function handleReset() {
  const confirmed = window.confirm("Clear all records? This action cannot be undone.");
  if (!confirmed) return;

  try {
    const { error } = await supabaseClient.from(SUPABASE_TABLE).delete().neq("id", null);
    if (error) {
      throw error;
    }
    submissions = [];
    cacheSubmissions(submissions);
    render();
  } catch (error) {
    console.error("Failed to clear records:", error);
    alert("Failed to clear records. Please try again later.");
  }
  await loadData();
  render();
}

function handleCounterpartAutoSelection(event) {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement)) return;

  const vendor = select.dataset.vendor;
  const criterionId = select.dataset.criterion;
  if (!vendor || !criterionId) return;

  const oppositeVendor = vendors.find((item) => item !== vendor);
  if (!oppositeVendor) return;

  const oppositeSelect = criteriaBody.querySelector(
    `select[data-vendor="${oppositeVendor}"][data-criterion="${criterionId}"]`
  );
  if (!oppositeSelect) return;

  const value = select.value;
  if (!value) {
    oppositeSelect.value = "";
    return;
  }

  if (value === "A") {
    oppositeSelect.value = "B";
  } else if (value === "B") {
    oppositeSelect.value = "A";
  } else {
    oppositeSelect.value = "N/A";
  }
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function createSupabaseClient() {
  if (typeof supabase === "undefined") {
    throw new Error("Supabase client library failed to load.");
  }

  return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
    },
  });
}

