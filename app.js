const DATA_URL = "data/evaluation.json";
const STORAGE_KEY = "voice_conversion_eval_scores_v2";
const ID_STORAGE_KEY = "voice_conversion_eval_evaluator_id_v1";

const METRIC_DEFS = {
  mos_naturalness: { label: "MOS", fullLabel: "MOS / Naturalness", match: "naturalness" },
  speaker_similarity: { label: "SIM", fullLabel: "Speaker Similarity", match: "speaker" },
  accent_similarity: { label: "Accent", fullLabel: "Accent Similarity", match: "accent" },
  emotion_similarity: { label: "Emotion", fullLabel: "Emotion Similarity", match: "emotion" },
};

const SCORE_FIELDS = [
  "mos_naturalness",
  "speaker_similarity",
  "accent_similarity",
  "emotion_similarity",
];

const state = {
  data: null,
  scores: normalizeScores(loadJson(STORAGE_KEY, {})),
};

main();

async function main() {
  bindGlobalControls();
  const status = document.getElementById("status");
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load ${DATA_URL}: ${response.status}`);
    }
    state.data = await response.json();
    renderEvaluation(state.data);
    updateProgress();
  } catch (error) {
    status.classList.add("warning");
    status.innerHTML = `
      <strong>Evaluation data could not be loaded.</strong>
      <p>Serve the site over HTTP, for example with <code>python3 -m http.server 8000 --directory docs</code>.</p>
      <p lang="zh-CN">请通过 HTTP 打开网页，例如运行 <code>python3 -m http.server 8000 --directory docs</code>。</p>
      <pre>${escapeHtml(error.message)}</pre>
    `;
  }
}

function bindGlobalControls() {
  const evaluatorInput = document.getElementById("evaluator-id");
  evaluatorInput.value = localStorage.getItem(ID_STORAGE_KEY) || "";
  evaluatorInput.addEventListener("input", () => {
    localStorage.setItem(ID_STORAGE_KEY, evaluatorInput.value.trim());
    updateProgress();
  });

  document.getElementById("download-scores").addEventListener("click", downloadScoresCsv);
  document.addEventListener("click", handleAudioButtonClick);
  document.getElementById("clear-scores").addEventListener("click", () => {
    const shouldClear = window.confirm("Clear all scores saved in this browser?");
    if (!shouldClear) return;
    state.scores = {};
    localStorage.removeItem(STORAGE_KEY);
    renderEvaluation(state.data);
    updateProgress();
  });
}

function renderEvaluation(data) {
  document.title = data.title || "Voice Conversion Listening Evaluation";
  const container = document.getElementById("datasets");
  container.replaceChildren(...data.datasets.map(renderDataset));
}

function renderDataset(dataset) {
  const section = document.createElement("section");
  section.className = "panel dataset-panel";

  const header = document.createElement("div");
  header.className = "dataset-header";
  header.innerHTML = `
    <div>
      <h2>${escapeHtml(dataset.name)}</h2>
      <p>${dataset.samples.length} sampled items. Score each anonymous system using the sliders in the table. / 共 ${dataset.samples.length} 个样本，请使用表格中的滑块为每个匿名系统打分。</p>
    </div>
  `;

  const badges = document.createElement("div");
  badges.className = "metric-badges";
  for (const metric of dataset.metrics) {
    const badge = document.createElement("span");
    badge.textContent = metric;
    badges.appendChild(badge);
  }
  header.appendChild(badges);

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap";
  tableWrap.appendChild(renderDatasetTable(dataset));

  section.append(header, tableWrap);
  return section;
}

function renderDatasetTable(dataset) {
  const table = document.createElement("table");
  const systemHeaders = dataset.systems
    .map((system) => `<th class="system-header">${escapeHtml(system.label)}</th>`)
    .join("");
  table.innerHTML = `
    <thead>
      <tr>
        <th class="sticky-col sample-stack-header">Sample / Source / Reference<br><span lang="zh-CN">样本 / 源语音 / 参考语音</span></th>
        ${systemHeaders}
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const metrics = metricsForDataset(dataset);
  const tbody = table.querySelector("tbody");
  for (const sample of dataset.samples) {
    const row = document.createElement("tr");
    row.appendChild(sampleStackCell(sample));
    for (const system of sample.systems) {
      row.appendChild(systemScoreCell(dataset.name, sample.sample_id, system, metrics));
    }
    tbody.appendChild(row);
  }
  return table;
}

function sampleStackCell(sample) {
  const td = document.createElement("td");
  td.className = "sticky-col sample-stack-cell";
  td.innerHTML = `
    <div class="sample-stack">
      <div class="sample-id">${escapeHtml(sample.sample_id)}</div>
      ${compactAudio("Source / 源语音", sample.source.audio, sample.source.transcript)}
      ${compactAudio("Reference / 参考语音", sample.reference.audio, sample.reference.transcript)}
    </div>
  `;
  return td;
}

function compactAudio(label, audioPath, transcript = "") {
  const safeLabel = escapeHtml(label);
  return `
    <div class="compact-audio">
      <button class="play-button" type="button" data-audio-src="${escapeAttribute(audioPath)}">Play</button>
      <span class="compact-audio-label">${safeLabel}</span>
      <audio preload="none" src="${escapeAttribute(audioPath)}"></audio>
      ${transcript ? `<div class="transcript">${escapeHtml(transcript)}</div>` : ""}
    </div>
  `;
}

function systemScoreCell(dataset, sampleId, system, metrics) {
  const td = document.createElement("td");
  td.className = "system-score-cell";
  const scoreKey = makeScoreKey(dataset, sampleId, system.label);
  const saved = state.scores[scoreKey] || {};
  const controls = metrics
    .map((metric) => sliderControl(scoreKey, metric, saved[metric.id]))
    .join("");

  td.innerHTML = `
    <div class="system-card">
      <span class="audio-label">${escapeHtml(system.label)}</span>
      ${compactAudio("Audio", system.audio)}
      <div class="score-controls">${controls}</div>
    </div>
  `;

  td.querySelectorAll("input[type='range']").forEach((slider) => {
    slider.addEventListener("input", handleScoreInput);
    slider.addEventListener("change", handleScoreInput);
    slider.addEventListener("pointerup", handleScoreInput);
    slider.addEventListener("keyup", handleScoreInput);
  });
  return td;
}

function handleAudioButtonClick(event) {
  const button = event.target.closest(".play-button");
  if (!button) return;

  const audio = button.parentElement.querySelector("audio");
  if (!audio) return;

  document.querySelectorAll("audio").forEach((otherAudio) => {
    if (otherAudio !== audio) {
      otherAudio.pause();
      const otherButton = otherAudio.parentElement.querySelector(".play-button");
      if (otherButton) {
        otherButton.textContent = "Play";
        otherButton.classList.remove("is-playing");
      }
    }
  });

  if (audio.paused) {
    audio.play();
    button.textContent = "Pause";
    button.classList.add("is-playing");
    audio.onended = () => {
      button.textContent = "Play";
      button.classList.remove("is-playing");
    };
    audio.onpause = () => {
      if (audio.currentTime < audio.duration) return;
      button.textContent = "Play";
      button.classList.remove("is-playing");
    };
  } else {
    audio.pause();
    button.textContent = "Play";
    button.classList.remove("is-playing");
  }
}

function sliderControl(scoreKey, metric, savedValue) {
  const hasValue = savedValue !== undefined && savedValue !== null && savedValue !== "";
  const value = hasValue ? savedValue : "0";
  const valueText = hasValue ? Number(savedValue).toFixed(1) : "0";
  return `
    <label class="score-control">
      <span class="score-row">
        <span title="${escapeAttribute(metric.fullLabel)}">${escapeHtml(metric.label)}</span>
        <output>${escapeHtml(valueText)}</output>
      </span>
      <input
        type="range"
        min="0"
        max="5"
        step="0.5"
        value="${escapeAttribute(value)}"
        data-score-key="${escapeAttribute(scoreKey)}"
        data-metric="${escapeAttribute(metric.id)}"
        aria-label="${escapeAttribute(metric.fullLabel)}"
      >
    </label>
  `;
}

function handleScoreInput(event) {
  const slider = event.currentTarget;
  const scoreKey = slider.dataset.scoreKey;
  const metric = slider.dataset.metric;
  const value = Number(slider.value).toFixed(1);

  if (!state.scores[scoreKey]) {
    state.scores[scoreKey] = {};
  }
  if (value === "0.0") {
    delete state.scores[scoreKey][metric];
    if (Object.keys(state.scores[scoreKey]).length === 0) {
      delete state.scores[scoreKey];
    }
    slider.closest(".score-control").querySelector("output").textContent = "0";
  } else {
    state.scores[scoreKey][metric] = value;
    slider.closest(".score-control").querySelector("output").textContent = value;
  }
  saveScores();
  updateProgress();
}

function updateProgress() {
  if (!state.data) return;
  const status = document.getElementById("status");
  const required = getRequiredScoreCount();
  const completed = getCompletedScoreCount();
  const evaluatorId = document.getElementById("evaluator-id").value.trim();
  const percent = required ? Math.round((completed / required) * 100) : 0;
  status.classList.remove("warning");
  status.innerHTML = `
    <div class="progress-header">
      <strong>${completed} / ${required} required scores complete</strong>
      <span>${percent}%</span>
    </div>
    <div class="progress-bar" aria-hidden="true"><span style="width: ${percent}%"></span></div>
    <p>${evaluatorId ? `Nickname / 昵称: ${escapeHtml(evaluatorId)}` : "Enter a nickname or short ID before downloading the final CSV. / 下载最终 CSV 前，请输入昵称或简短编号。"}</p>
  `;
}

function getRequiredScoreCount() {
  let total = 0;
  for (const dataset of state.data.datasets) {
    const metricCount = metricsForDataset(dataset).length;
    for (const sample of dataset.samples) {
      total += sample.systems.length * metricCount;
    }
  }
  return total;
}

function getCompletedScoreCount() {
  let total = 0;
  for (const dataset of state.data.datasets) {
    const metrics = metricsForDataset(dataset);
    for (const sample of dataset.samples) {
      for (const system of sample.systems) {
        const saved = state.scores[makeScoreKey(dataset.name, sample.sample_id, system.label)] || {};
        total += metrics.filter((metric) => saved[metric.id]).length;
      }
    }
  }
  return total;
}

function downloadScoresCsv() {
  if (!state.data) return;
  const evaluatorId = document.getElementById("evaluator-id").value.trim();
  if (!evaluatorId) {
    window.alert("Please enter a nickname or short ID before downloading your scores.");
    document.getElementById("evaluator-id").focus();
    return;
  }

  const rows = buildScoreRows(evaluatorId);
  const csv = rowsToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const link = document.createElement("a");
  link.href = url;
  link.download = `voice_conversion_scores_${safeFilePart(evaluatorId)}_${timestamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildScoreRows(evaluatorId) {
  const rows = [];
  const submittedAt = new Date().toISOString();
  for (const dataset of state.data.datasets) {
    const metrics = metricsForDataset(dataset);
    for (const sample of dataset.samples) {
      for (const system of sample.systems) {
        const saved = state.scores[makeScoreKey(dataset.name, sample.sample_id, system.label)] || {};
        const row = {
          submitted_at: submittedAt,
          evaluator_id: evaluatorId,
          dataset: dataset.name,
          sample_id: sample.sample_id,
          anonymous_system: system.label,
          mos_naturalness: "",
          speaker_similarity: "",
          accent_similarity: "",
          emotion_similarity: "",
        };
        for (const metric of metrics) {
          row[metric.id] = saved[metric.id] || "";
        }
        rows.push(row);
      }
    }
  }
  return rows;
}

function rowsToCsv(rows) {
  const headers = [
    "submitted_at",
    "evaluator_id",
    "dataset",
    "sample_id",
    "anonymous_system",
    ...SCORE_FIELDS,
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvValue(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function csvValue(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function metricsForDataset(dataset) {
  const names = dataset.metrics || [];
  return Object.entries(METRIC_DEFS)
    .filter(([, definition]) => names.some((name) => name.toLowerCase().includes(definition.match)))
    .map(([id, definition]) => ({ id, ...definition }));
}

function makeScoreKey(dataset, sampleId, systemLabel) {
  return `${dataset}|||${sampleId}|||${systemLabel}`;
}

function saveScores() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.scores));
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function normalizeScores(scores) {
  const normalized = {};
  for (const [scoreKey, metrics] of Object.entries(scores || {})) {
    const keptMetrics = {};
    for (const [metric, value] of Object.entries(metrics || {})) {
      if (value !== "0" && value !== "0.0" && value !== 0) {
        keptMetrics[metric] = value;
      }
    }
    if (Object.keys(keptMetrics).length > 0) {
      normalized[scoreKey] = keptMetrics;
    }
  }
  return normalized;
}

function cell(className, text) {
  const td = document.createElement("td");
  td.className = className;
  td.textContent = text;
  return td;
}

function safeFilePart(value) {
  return value.replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "evaluator";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const escapes = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return escapes[char];
  });
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
