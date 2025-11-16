const APP_VERSION = "v1.0.0";
const STORAGE_KEY = "vendor-rating-submissions-v2";
const BACKUP_KEY = `vendor-rating-backup-${APP_VERSION}`;
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
let restoreButton;

function initialize() {
  const root = document.getElementById("rating-app");
  form = document.getElementById("rating-form");
  usernameInput = document.getElementById("username");
  totalsContainer = document.getElementById("totals-container");
  tableBody = document.querySelector("#submissions-table tbody");
  criteriaBody = document.getElementById("criteria-body");
  refreshButton = document.getElementById("refresh-data");
  resetButton = document.getElementById("reset-data");
  restoreButton = document.getElementById("restore-version");

  if (!root || !form || !usernameInput || !totalsContainer || !tableBody || !criteriaBody) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initialize, { once: true });
      return;
    }
    console.error("初始化失敗，缺少必要的 DOM 元素。");
    return;
  }

  updateVersionBadges();
  renderCriteriaRows();
  criteriaBody.addEventListener("change", handleCounterpartAutoSelection);
  submissions = loadSubmissions();
  ensureBackup();
  pieChart = initPieChart();
  render();

  form.addEventListener("submit", handleSubmit);
  refreshButton?.addEventListener("click", handleRefresh);
  resetButton?.addEventListener("click", handleReset);
  restoreButton?.addEventListener("click", handleRestore);
}

initialize();

function handleSubmit(event) {
  event.preventDefault();

  const username = usernameInput.value.trim();
  if (!username) {
    alert("請輸入登入名稱");
    usernameInput.focus();
    return;
  }

  const ratings = collectRatingsFromForm();
  if (!ratings) {
    alert("請完成所有評分後再提交。");
    return;
  }

  const newSubmission = {
    id: createId(),
    schemaVersion: SCHEMA_VERSION,
    username: username.trim(),
    ratings,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const normalizedUsername = username.trim().toLowerCase();
  const existingIndex = submissions.findIndex(
    (item) => item.username?.trim().toLowerCase() === normalizedUsername
  );

  if (existingIndex !== -1) {
    const existing = submissions[existingIndex];
    newSubmission.id = existing.id;
    newSubmission.createdAt = existing.createdAt ?? existing.updatedAt ?? newSubmission.createdAt;
    submissions[existingIndex] = newSubmission;
  } else {
    submissions.push(newSubmission);
  }

  saveSubmissions(submissions);
  render();
  form.reset();
  usernameInput.focus();
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
            <option value="" disabled selected>選擇</option>
            <option value="A">A（2 分）</option>
            <option value="B">B（1 分）</option>
            <option value="N/A">N/A（0 分）</option>
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

function loadSubmissions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => normalizeSubmission(item))
      .filter((item) => item !== null);
  } catch (error) {
    console.error("讀取資料時發生錯誤：", error);
    return [];
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
    ratings: {},
    createdAt: item.createdAt ?? new Date().toISOString(),
    updatedAt: item.updatedAt ?? item.createdAt ?? new Date().toISOString(),
  };

  for (const vendor of vendors) {
    const source = item.ratings[vendor];
    normalized.ratings[vendor] = {};

    for (const criterion of criteria) {
      const value = source?.[criterion.id];
      normalized.ratings[vendor][criterion.id] = weightMap[value] !== undefined ? value : "N/A";
    }
  }

  return normalized;
}

function saveSubmissions(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("儲存資料至 Local Storage 失敗，頁面仍會保留本次提交。", error);
  }
}

function ensureBackup() {
  try {
    if (!localStorage.getItem(BACKUP_KEY)) {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(submissions));
    }
  } catch (error) {
    console.warn("建立版本備份失敗：", error);
  }
}

function loadBackup() {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeSubmission(item)).filter(Boolean);
  } catch (error) {
    console.warn("讀取備份失敗：", error);
    return [];
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

  return new Chart(ctx, {
    type: "pie",
    data: {
      labels: vendors,
      datasets: [
        {
          label: "總分",
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
              return `${context.label}: ${formatScore(value)} 分`;
            },
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

    scoreEl.textContent = `${formatScore(totalScore)} 分`;
    averageEl.textContent = `平均 ${formatScore(averageScore)} 分`;
    countEl.textContent =
      submissionCount > 0 ? `${submissionCount} 份提交` : "尚無提交";
  });
}

function renderTable() {
  if (!tableBody) return;

  tableBody.innerHTML = "";
  if (submissions.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.className = "empty-row";
    emptyRow.innerHTML = `<td colspan="4">目前尚無資料</td>`;
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
      <td>${formatScore(yonyouScore.total)} 分</td>
      <td>${formatScore(kingdeeScore.total)} 分</td>
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
      <summary>查看明細</summary>
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
          <span class="criterion-score">${ratingBadge}<span class="score-text">${formatScore(item.weighted)} 分</span></span>
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

function handleRefresh() {
  submissions = loadSubmissions();
  render();
}

function handleReset() {
  const confirmed = window.confirm("確定要清除所有記錄嗎？此操作無法復原。");
  if (!confirmed) return;

  submissions = [];
  saveSubmissions(submissions);
  render();
}

function handleRestore() {
  const confirmed = window.confirm(`還原至版本 ${APP_VERSION} 的備份？現有資料將被覆蓋。`);
  if (!confirmed) return;

  submissions = loadBackup();
  saveSubmissions(submissions);
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

