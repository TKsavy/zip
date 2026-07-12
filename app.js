const DATA_URL = "data/evaluation.json";
const STORAGE_KEY = "voice_conversion_eval_scores_v2";
const ID_STORAGE_KEY = "voice_conversion_eval_evaluator_id_v1";
const LANG_STORAGE_KEY = "voice_conversion_eval_language_v1";
const SAMPLE_SELECTION_STORAGE_KEY = "voice_conversion_eval_selected_samples_v1";
const SUBMISSION_EMAIL = document.querySelector('meta[name="submission-email"]')?.content.trim() || "your.email@example.com";

const METRIC_DEFS = {
  mos_naturalness: {
    match: "naturalness",
    labels: { en: "MOS", zh: "自然度" },
    fullLabels: { en: "MOS / Naturalness", zh: "MOS (Naturalness) / 自然度" },
  },
  speaker_similarity: {
    match: "speaker",
    labels: { en: "SIM : Speaker Similarity", zh: "说话人相似度" },
    fullLabels: { en: "Speaker Similarity", zh: "说话人相似度" },
  },
  accent_similarity: {
    match: "accent",
    labels: { en: "Accent Similarity", zh: "口音" },
    fullLabels: { en: "Accent Similarity", zh: "口音相似度" },
  },
  emotion_similarity: {
    match: "emotion",
    labels: { en: "Emotion Similarity", zh: "情感" },
    fullLabels: { en: "Emotion Similarity", zh: "情感相似度" },
  },
};

const SCORE_FIELDS = [
  "mos_naturalness",
  "speaker_similarity",
  "accent_similarity",
  "emotion_similarity",
];

const state = {
  data: null,
  loadError: null,
  lang: getInitialLanguage(),
  scores: normalizeScores(loadJson(STORAGE_KEY, {})),
};

const I18N = {
  en: {
    pageTitle: "Voice Conversion Listening Evaluation",
    eyebrow: "Anonymous Listening Test",
    title: "Voice Conversion Evaluation",
    clearScores: "Clear saved scores",
    downloadScores: "Download my scores",
    vcTitle: "What is Voice Conversion?",
    vcText: "Voice conversion changes speech from a source speaker so that it sounds like a target/reference speaker, while keeping the spoken content unchanged. In this test, you will evaluate our system together with other baseline systems.",
    instructionsTitle: "Instructions",
    instructionsIntro: "Please complete the evaluation in a quiet environment using headphones or good speakers. Listen to the source, reference, and each anonymous system sample before assigning scores.",
    instructions: [
      "Use a 5-point scale with 0.5 increments: 1.0, 1.5, 2.0, ..., 5.0.",
      "Each slider starts at 0, which means not scored. Move it to 1.0-5.0 to record a score.",
      "Evaluate each anonymous system independently. Do not score the source or reference.",
      "System names are hidden on purpose. Please do not try to infer the real systems.",
      "You may replay samples, but avoid changing scores repeatedly after long comparison.",
      "Keep playback volume comfortable and consistent across samples.",
      "Your scores are saved automatically in this browser until you clear them.",
    ],
    criteria: [
      {
        title: "MOS / Naturalness",
        intro: "Judge audio quality and naturalness only.",
        guide: [
          "5: Natural, clean, and human-like.",
          "4: Mostly natural, with minor artifacts.",
          "3: Understandable, but clearly synthetic or degraded.",
          "2: Unnatural, noisy, or difficult to listen to.",
          "1: Very poor quality or hard to understand.",
        ],
      },
      {
        title: "Speaker Similarity",
        intro: "Compare with the reference speaker. Judge voice identity and speaking style; ignore background noise or recording condition.",
        guide: [
          "5: Same or very similar speaker.",
          "4: Mostly similar speaker, with small differences.",
          "3: Partly similar, but noticeable differences.",
          "2: Mostly different speaker.",
          "1: Completely different speaker.",
        ],
      },
      {
        title: "Accent Similarity",
        intro: "For L2Arctic only. Compare accent with the reference, including pronunciation, rhythm, and stress.",
        guide: [
          "5: Accent is very similar to the reference.",
          "4: Accent is mostly similar.",
          "3: Accent is partly similar, with clear differences.",
          "2: Accent is mostly different.",
          "1: Accent is completely different.",
        ],
      },
      {
        title: "Emotion Similarity",
        intro: "For ESD only. Compare emotion with the reference, including emotion type and strength.",
        guide: [
          "5: Emotion is very similar to the reference.",
          "4: Emotion is mostly similar.",
          "3: Emotion is partly similar, with clear differences.",
          "2: Emotion is mostly different.",
          "1: Emotion is completely different.",
        ],
      },
    ],
    submitTitle: "Submit Your Scores",
    submitDownload: "After you finish all ratings, click <strong>Download my scores</strong> at the top of the page. This will download a CSV file containing your scores.",
    submitEmailLead: "Please send the downloaded CSV file by email to",
    nicknameLabel: "Nickname",
    nicknameHelp: "Use a nickname or short ID only to distinguish different evaluation submissions.",
    nicknamePlaceholder: "Example: Alex01",
    loading: "Loading evaluation data...",
    loadErrorTitle: "Evaluation data could not be loaded.",
    loadErrorHelp: "Serve the site over HTTP, for example with",
    datasetItems: (count) => `${count} sampled items. Score each anonymous system using the sliders in the table.`,
    sampleHeader: "Sample / Source / Reference",
    source: "Source",
    reference: "Reference",
    audio: "Audio",
    play: "Play",
    pause: "Pause",
    progress: (completed, required) => `${completed} / ${required} required scores complete`,
    nicknameStatus: (id) => `Nickname: ${id}`,
    nicknameMissing: "Enter a nickname or short ID before downloading the final CSV.",
    clearConfirm: "Clear all scores saved in this browser?",
    nicknameAlert: "Please enter a nickname or short ID before downloading your scores.",
    footerText: "Download the CSV after finishing the evaluation and send that file to the study organizer.",
  },
  zh: {
    pageTitle: "语音转换主观听测评估",
    eyebrow: "匿名听测",
    title: "语音转换评估",
    clearScores: "清除已保存分数",
    downloadScores: "下载我的评分",
    vcTitle: "什么是语音转换？",
    vcText: "语音转换是把源说话人的语音转换成听起来像目标/参考说话人的语音，同时保持说话内容不变。本次评测中，你将同时评价我们的系统和其他基线系统。",
    instructionsTitle: "评测说明",
    instructionsIntro: "请在安静的环境中使用耳机或质量较好的扬声器完成评测。打分前，请先听源语音、参考语音以及每个匿名系统的转换语音。",
    instructions: [
      "请使用 1.0 到 5.0 的五分制，步长为 0.5。",
      "每个滑块初始为 0，表示尚未打分；请移动到 1.0-5.0 记录分数。",
      "请独立评价每个匿名系统，不需要给源语音或参考语音打分。",
      "系统真实名称已隐藏，请不要尝试推测真实系统。",
      "可以重复播放，但请避免长时间反复比较后频繁修改分数。",
      "请保持舒适且一致的播放音量。",
      "分数会自动保存在当前浏览器中，直到你清除保存的分数。",
    ],
    criteria: [
      {
        title: "MOS / 自然度",
        intro: "只评价语音质量和自然度。",
        guide: [
          "5：自然、清晰，接近真人语音。",
          "4：整体自然，只有少量瑕疵。",
          "3：能听懂，但明显合成或有失真。",
          "2：不自然、有噪声，或听起来比较困难。",
          "1：质量很差或难以理解。",
        ],
      },
      {
        title: "说话人相似度",
        intro: "与参考语音中的说话人比较。评价声音身份和说话风格，忽略背景噪声或录音条件。",
        guide: [
          "5：同一个或非常相似的说话人。",
          "4：大体相似，但有小差异。",
          "3：部分相似，但差异明显。",
          "2：大部分听起来像不同说话人。",
          "1：完全不同的说话人。",
        ],
      },
      {
        title: "口音相似度",
        intro: "仅用于 L2Arctic。与参考语音比较口音，包括发音、节奏和重音。",
        guide: [
          "5：口音与参考语音非常相似。",
          "4：口音大体相似。",
          "3：口音部分相似，但差异明显。",
          "2：口音大部分不同。",
          "1：口音完全不同。",
        ],
      },
      {
        title: "情感相似度",
        intro: "仅用于 ESD。与参考语音比较情感，包括情感类别和强度。",
        guide: [
          "5：情感与参考语音非常相似。",
          "4：情感大体相似。",
          "3：情感部分相似，但差异明显。",
          "2：情感大部分不同。",
          "1：情感完全不同。",
        ],
      },
    ],
    submitTitle: "提交评分",
    submitDownload: "完成所有评分后，请点击页面顶部的 <strong>下载我的评分</strong> 下载 CSV 评分文件。",
    submitEmailLead: "请将下载的 CSV 文件发送到",
    nicknameLabel: "昵称",
    nicknameHelp: "请使用昵称或简短编号，仅用于区分不同评测结果。",
    nicknamePlaceholder: "例如：Alex01",
    loading: "正在加载评测数据...",
    loadErrorTitle: "无法加载评测数据。",
    loadErrorHelp: "请通过 HTTP 打开网页，例如运行",
    datasetItems: (count) => `共 ${count} 个样本，请使用表格中的滑块为每个匿名系统打分。`,
    sampleHeader: "样本 / 源语音 / 参考语音",
    source: "源语音",
    reference: "参考语音",
    audio: "音频",
    play: "播放",
    pause: "暂停",
    progress: (completed, required) => `已完成 ${completed} / ${required} 个必填分数`,
    nicknameStatus: (id) => `昵称：${id}`,
    nicknameMissing: "下载最终 CSV 前，请输入昵称或简短编号。",
    clearConfirm: "清除当前浏览器中保存的所有分数？",
    nicknameAlert: "下载评分前，请先输入昵称或简短编号。",
    footerText: "完成评测后请下载 CSV，并发送给研究组织者。",
  },
};

main();

async function main() {
  applyLanguage();
  bindGlobalControls();
  const status = document.getElementById("status");
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load ${DATA_URL}: ${response.status}`);
    }
    state.data = selectOneSamplePerDataset(await response.json());
    renderEvaluation(state.data);
    updateProgress();
  } catch (error) {
    state.loadError = error;
    renderLoadError(error);
  }
}

function bindGlobalControls() {
  bindSubmissionEmail();
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.lang));
  });

  const evaluatorInput = document.getElementById("evaluator-id");
  evaluatorInput.value = localStorage.getItem(ID_STORAGE_KEY) || "";
  evaluatorInput.addEventListener("input", () => {
    localStorage.setItem(ID_STORAGE_KEY, evaluatorInput.value.trim());
    updateProgress();
  });

  document.getElementById("download-scores").addEventListener("click", downloadScoresCsv);
  document.addEventListener("click", handleAudioButtonClick);
  document.getElementById("clear-scores").addEventListener("click", () => {
    const shouldClear = window.confirm(t("clearConfirm"));
    if (!shouldClear) return;
    state.scores = {};
    localStorage.removeItem(STORAGE_KEY);
    renderEvaluation(state.data);
    updateProgress();
  });
}

function bindSubmissionEmail() {
  document.querySelectorAll("[data-submission-email-text]").forEach((element) => {
    element.textContent = SUBMISSION_EMAIL;
  });
  document.querySelectorAll("[data-submission-email-link]").forEach((element) => {
    element.href = `mailto:${SUBMISSION_EMAIL}`;
  });
}

function getInitialLanguage() {
  const saved = localStorage.getItem(LANG_STORAGE_KEY);
  return saved === "en" ? "en" : "zh";
}

function selectOneSamplePerDataset(data) {
  const savedSelection = loadJson(SAMPLE_SELECTION_STORAGE_KEY, {});
  const nextSelection = { ...savedSelection };
  let changed = false;

  const datasets = (data.datasets || []).map((dataset) => {
    const samples = dataset.samples || [];
    if (samples.length <= 1) {
      if (samples[0] && nextSelection[dataset.name] !== samples[0].sample_id) {
        nextSelection[dataset.name] = samples[0].sample_id;
        changed = true;
      }
      return dataset;
    }

    let selectedSample = samples.find((sample) => sample.sample_id === savedSelection[dataset.name]);
    if (!selectedSample) {
      selectedSample = samples[Math.floor(Math.random() * samples.length)];
      nextSelection[dataset.name] = selectedSample.sample_id;
      changed = true;
    }

    return {
      ...dataset,
      samples: [selectedSample],
    };
  });

  if (changed) {
    localStorage.setItem(SAMPLE_SELECTION_STORAGE_KEY, JSON.stringify(nextSelection));
  }

  return {
    ...data,
    datasets,
  };
}

function setLanguage(lang) {
  state.lang = lang === "zh" ? "zh" : "en";
  localStorage.setItem(LANG_STORAGE_KEY, state.lang);
  applyLanguage();
  if (state.data) {
    renderEvaluation(state.data);
    updateProgress();
  }
}

function t(key) {
  return I18N[state.lang][key];
}

function applyLanguage() {
  const langCode = state.lang === "zh" ? "zh-CN" : "en";
  document.documentElement.lang = langCode;
  document.title = t("pageTitle");
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.lang === state.lang);
  });
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((element) => {
    element.innerHTML = t(element.dataset.i18nHtml);
  });
  document.getElementById("evaluator-id").placeholder = t("nicknamePlaceholder");
  if (state.loadError) {
    renderLoadError(state.loadError);
  } else if (!state.data) {
    document.getElementById("status").textContent = t("loading");
  }
  renderInstructionList();
  renderCriteria();
}

function renderLoadError(error) {
  const status = document.getElementById("status");
  status.classList.add("warning");
  status.innerHTML = `
    <strong>${escapeHtml(t("loadErrorTitle"))}</strong>
    <p>${escapeHtml(t("loadErrorHelp"))} <code>python3 -m http.server 8000 --directory docs</code>.</p>
    <pre>${escapeHtml(error.message)}</pre>
  `;
}

function renderInstructionList() {
  const list = document.getElementById("instruction-list");
  list.replaceChildren(
    ...t("instructions").map((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    })
  );
}

function renderCriteria() {
  const grid = document.getElementById("criteria-grid");
  grid.replaceChildren(
    ...t("criteria").map((criterion) => {
      const card = document.createElement("div");
      const title = document.createElement("h3");
      const intro = document.createElement("p");
      const guide = document.createElement("ol");
      guide.className = "score-guide";
      title.textContent = criterion.title;
      intro.textContent = criterion.intro;
      guide.replaceChildren(
        ...criterion.guide.map((item) => {
          const li = document.createElement("li");
          li.textContent = item;
          return li;
        })
      );
      card.append(title, intro, guide);
      return card;
    })
  );
}

function renderEvaluation(data) {
  document.title = t("pageTitle");
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
      <p>${escapeHtml(t("datasetItems")(dataset.samples.length))}</p>
    </div>
  `;

  const badges = document.createElement("div");
  badges.className = "metric-badges";
  for (const metric of metricsForDataset(dataset)) {
    const badge = document.createElement("span");
    badge.textContent = metric.fullLabel;
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
        <th class="sticky-col sample-stack-header">${escapeHtml(t("sampleHeader"))}</th>
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
      ${compactAudio(t("source"), sample.source.audio, sample.source.transcript)}
      ${compactAudio(t("reference"), sample.reference.audio, sample.reference.transcript)}
    </div>
  `;
  return td;
}

function compactAudio(label, audioPath, transcript = "") {
  const safeLabel = escapeHtml(label);
  return `
    <div class="compact-audio">
      <button class="play-button" type="button" data-audio-src="${escapeAttribute(audioPath)}">${escapeHtml(t("play"))}</button>
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
      ${compactAudio(t("audio"), system.audio)}
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
        otherButton.textContent = t("play");
        otherButton.classList.remove("is-playing");
      }
    }
  });

  if (audio.paused) {
    audio.play();
    button.textContent = t("pause");
    button.classList.add("is-playing");
    audio.onended = () => {
      button.textContent = t("play");
      button.classList.remove("is-playing");
    };
    audio.onpause = () => {
      if (audio.currentTime < audio.duration) return;
      button.textContent = t("play");
      button.classList.remove("is-playing");
    };
  } else {
    audio.pause();
    button.textContent = t("play");
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
      <strong>${escapeHtml(t("progress")(completed, required))}</strong>
      <span>${percent}%</span>
    </div>
    <div class="progress-bar" aria-hidden="true"><span style="width: ${percent}%"></span></div>
    <p>${evaluatorId ? escapeHtml(t("nicknameStatus")(evaluatorId)) : escapeHtml(t("nicknameMissing"))}</p>
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
    window.alert(t("nicknameAlert"));
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
    .map(([id, definition]) => ({
      id,
      match: definition.match,
      label: definition.labels[state.lang],
      fullLabel: definition.fullLabels[state.lang],
    }));
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
