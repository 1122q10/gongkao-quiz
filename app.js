const featureStyle = document.createElement("link");
featureStyle.rel = "stylesheet";
featureStyle.href = "features.css";
document.head.append(featureStyle);
const K = {
  b: "gongkao_quiz_banks_v1",
  m: "gongkao_quiz_mistakes_v1",
  k: "gongkao_knowledge_v1",
  f: "gongkao_favorites_v1",
  r: "gongkao_records_v1",
};
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  load = (k, f) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? f;
    } catch {
      return f;
    }
  },
  id = () => crypto.randomUUID?.() || Date.now().toString(36),
  esc = (s = "") =>
    String(s).replace(
      /[&<>'"]/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[c],
    );
let banks = load(K.b, []),
  mistakes = load(K.m, {}),
  tree = load(K.k, []),
  favorites = load(K.f, {}),
  records = load(K.r, {}),
  draft = [],
  session = null,
  selected = "",
  reviewTab = "mistakes";
banks.forEach((b) =>
  b.questions.forEach((q) =>
    Object.assign(q, {
      knowledgeId: q.knowledgeId || "",
      relatedKnowledgeIds: q.relatedKnowledgeIds || [],
      source: q.source || { bank: b.name, number: q.number },
    }),
  ),
);
const types = {
  single: "单选题",
  multiple: "多选题",
  judge: "判断题",
  blank: "填空题",
  short: "简答题",
};
function save() {
  localStorage.setItem(K.b, JSON.stringify(banks));
  localStorage.setItem(K.m, JSON.stringify(mistakes));
  localStorage.setItem(K.k, JSON.stringify(tree));
  localStorage.setItem(K.f, JSON.stringify(favorites));
  localStorage.setItem(K.r, JSON.stringify(records));
  renderAll();
}
function page(n) {
  $$(".page").forEach((x) =>
    x.classList.toggle("active", x.id === `page-${n}`),
  );
  $$(".nav-btn").forEach((x) =>
    x.classList.toggle("active", x.dataset.page === n),
  );
  scrollTo(0, 0);
}
$$("[data-page]").forEach((x) => (x.onclick = () => page(x.dataset.page)));
function all() {
  return banks.flatMap((b) => b.questions.map((q) => ({ b, q })));
}
function find(qid) {
  return all().find((x) => x.q.id === qid);
}
function flat(ns = tree, d = 0, out = []) {
  ns.forEach((n) => {
    out.push({ ...n, depth: d });
    flat(n.children || [], d + 1, out);
  });
  return out;
}
function node(nid, ns = tree) {
  for (const n of ns) {
    if (n.id === nid) return n;
    const x = node(nid, n.children || []);
    if (x) return x;
  }
  return null;
}
function path(nid, ns = tree, p = []) {
  for (const n of ns) {
    const a = [...p, n];
    if (n.id === nid) return a;
    const x = path(nid, n.children || [], a);
    if (x.length) return x;
  }
  return [];
}
function desc(nid) {
  const out = [];
  (function w(n) {
    if (n) {
      out.push(n.id);
      (n.children || []).forEach(w);
    }
  })(node(nid));
  return out;
}
function related(nid, deep = true) {
  const ids = deep ? desc(nid) : [nid];
  return all().filter(
    ({ q }) =>
      ids.includes(q.knowledgeId) ||
      (q.relatedKnowledgeIds || []).some((x) => ids.includes(x)),
  );
}
function options(sel = "") {
  return (
    '<option value="">未分类</option>' +
    flat()
      .map(
        (n) =>
          `<option value="${n.id}" ${sel === n.id ? "selected" : ""}>${"　".repeat(n.depth)}${esc(n.name)}</option>`,
      )
      .join("")
  );
}
function renderAll() {
  renderHome();
  renderTree();
  renderReview();
  $("#review-count").textContent =
    Object.keys(mistakes).length + Object.keys(favorites).length;
}
function renderHome() {
  const qs = all(),
    ats = Object.values(records).flatMap((r) => r.attempts || []),
    right = ats.filter((a) => a.correct).length;
  $("#dashboard").innerHTML =
    `<div><strong>${qs.length}</strong><span>题目</span></div><div><strong>${flat().length}</strong><span>考点</span></div><div><strong>${Object.keys(mistakes).length}</strong><span>错题</span></div><div><strong>${ats.length ? Math.round((right / ats.length) * 100) : 0}%</strong><span>正确率</span></div>`;
  $("#bank-summary").textContent =
    `${banks.length} 个题库，共 ${qs.length} 道题 · 数据保存在当前浏览器`;
  $("#bank-list").innerHTML = banks.length
    ? banks
        .map(
          (b) =>
            `<article class="bank-card"><span class="tag">${b.questions.length} 道题</span><h3>${esc(b.name)}</h3><p>${summary(b.questions)}</p><small>${esc(b.meta || "")} ${new Date(b.createdAt).toLocaleDateString()}</small><div class="card-actions"><button class="primary" data-start="${b.id}">开始刷题</button><button class="ghost danger" data-delete="${b.id}">删除</button></div></article>`,
        )
        .join("")
    : '<div class="empty"><div>还没有题库</div><p>先导入一份资料开始刷题。</p></div>';
  $$("[data-start]").forEach(
    (x) => (x.onclick = () => startBank(x.dataset.start)),
  );
  $$("[data-delete]").forEach(
    (x) =>
      (x.onclick = () => {
        if (confirm("确定删除此题库吗？")) {
          banks = banks.filter((b) => b.id !== x.dataset.delete);
          save();
        }
      }),
  );
}
function summary(qs) {
  const m = {};
  qs.forEach((q) => (m[q.type] = (m[q.type] || 0) + 1));
  return Object.entries(m)
    .map(([k, v]) => `${types[k] || "题目"} ${v}`)
    .join(" · ");
}
function renderTree() {
  $("#knowledge-tree").innerHTML = tree.length
    ? treeHtml(tree)
    : '<div class="empty"><div>还没有考点</div><p>添加考点或粘贴提纲。</p></div>';
  $$("[data-node]").forEach(
    (x) =>
      (x.onclick = () => {
        selected = x.dataset.node;
        renderTree();
        renderDetail();
      }),
  );
}
function treeHtml(ns) {
  return `<ul class="tree">${ns.map((n) => `<li><button class="tree-node ${selected === n.id ? "selected" : ""}" data-node="${n.id}"><span>▸</span>${esc(n.name)}<small>${related(n.id).length}</small></button>${n.children?.length ? treeHtml(n.children) : ""}</li>`).join("")}</ul>`;
}
function renderDetail() {
  const n = node(selected),
    box = $("#knowledge-detail");
  if (!n) {
    box.innerHTML = '<div class="empty">选择一个考点</div>';
    return;
  }
  const qs = related(n.id),
    ats = qs.flatMap(({ q }) => records[q.id]?.attempts || []),
    right = ats.filter((a) => a.correct).length;
  box.innerHTML = `<p class="eyebrow">${path(n.id)
    .map((x) => esc(x.name))
    .join(
      " / ",
    )}</p><h2>${esc(n.name)}</h2><div class="stat-grid compact"><div><strong>${qs.length}</strong><span>相关题目</span></div><div><strong>${ats.length ? Math.round((right / ats.length) * 100) : 0}%</strong><span>正确率</span></div></div><label>考点名称<input id="node-name" value="${esc(n.name)}"></label><label>移动到<select id="node-parent"><option value="">保持当前位置</option>${flat()
    .filter((x) => x.id !== n.id && !desc(n.id).includes(x.id))
    .map(
      (x) =>
        `<option value="${x.id}">${"　".repeat(x.depth)}${esc(x.name)}</option>`,
    )
    .join(
      "",
    )}</select></label><div class="card-actions"><button id="save-node" class="primary">保存</button><button id="add-child" class="ghost">＋ 下级</button><button id="practice-node" class="ghost">专项练习</button><button id="delete-node" class="ghost danger">删除</button></div>`;
  $("#save-node").onclick = () => {
    n.name = $("#node-name").value.trim() || n.name;
    const p = $("#node-parent").value;
    if (p) move(n.id, p);
    save();
  };
  $("#add-child").onclick = () => {
    const v = prompt("下级考点名称");
    if (v) {
      n.children.push({ id: id(), name: v, children: [] });
      save();
    }
  };
  $("#practice-node").onclick = () => startMixed(qs);
  $("#delete-node").onclick = () => delNode(n.id);
}
function take(nid, ns = tree) {
  for (let i = 0; i < ns.length; i++) {
    if (ns[i].id === nid) return ns.splice(i, 1)[0];
    const x = take(nid, ns[i].children || []);
    if (x) return x;
  }
}
function move(nid, pid) {
  const n = take(nid);
  if (n) node(pid).children.push(n);
}
function delNode(nid) {
  if (!confirm("删除后，关联题目会移入“未分类”。确定吗？")) return;
  const ids = desc(nid);
  all().forEach(({ q }) => {
    if (ids.includes(q.knowledgeId)) q.knowledgeId = "";
    q.relatedKnowledgeIds = q.relatedKnowledgeIds.filter(
      (x) => !ids.includes(x),
    );
  });
  take(nid);
  selected = "";
  save();
}
$("#add-root").onclick = () => {
  const v = prompt("一级考点名称");
  if (v) {
    tree.push({ id: id(), name: v, children: [] });
    save();
  }
};
$("#import-outline").onclick = () => $("#outline-dialog").showModal();
$("#confirm-outline").onclick = () => {
  const t = parseOutline($("#outline-text").value);
  if (!t.length) return alert("没有识别到考点。");
  tree.push(...t);
  $("#outline-dialog").close();
  save();
};
function parseOutline(txt) {
  const roots = [],
    stack = [];
  txt
    .split(/\r?\n/)
    .filter((x) => x.trim())
    .forEach((line) => {
      const pre = (line.match(/^[\s│├└─]+/) || [""])[0],
        name = line.replace(/^[\s│├└─]+/, "").trim();
      let d =
        (pre.match(/│/g) || []).length +
        (pre.includes("├") || pre.includes("└") ? 1 : 0);
      if (/^\s+$/.test(pre))
        d = Math.floor(pre.replace(/\t/g, "  ").length / 2);
      const n = { id: id(), name, children: [] };
      if (!d) roots.push(n);
      else (stack[d - 1] || stack.at(-1))?.children.push(n);
      stack[d] = n;
      stack.length = d + 1;
    });
  return roots;
}

$("#question-file").onchange = (e) =>
  ($("#question-file-name").textContent =
    e.target.files[0]?.name || "选择文件");
$("#answer-file").onchange = (e) =>
  ($("#answer-file-name").textContent = e.target.files[0]?.name || "选择文件");
$("#parse-btn").onclick = async () => {
  const qf = $("#question-file").files[0],
    af = $("#answer-file").files[0];
  if (!qf) return status("请先选择题目文档。", 1);
  status("正在读取文档……");
  try {
    draft = qf.name.toLowerCase().endsWith(".json")
      ? normalizeJson(JSON.parse(await qf.text()))
      : parseDocs(await readFile(qf), af ? await readFile(af) : "");
    if (!draft.length) throw Error("没有识别到题目，请检查题号格式。");
    draft.forEach(
      (q) =>
        (q.source = {
          questionFile: qf.name,
          answerFile: af?.name || "",
          number: q.number,
        }),
    );
    renderImport();
    status(`已识别 ${draft.length} 道题，请校对考点和来源。`);
  } catch (e) {
    status(e.message, 1);
  }
};
function status(t, b) {
  $("#parse-status").textContent = t;
  $("#parse-status").style.color = b ? "var(--red)" : "";
}
async function readFile(f) {
  if (!f.name.toLowerCase().endsWith(".pdf")) return f.text();
  const p =
    await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
  p.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  const d = await p.getDocument({ data: await f.arrayBuffer() }).promise;
  let t = "";
  for (let i = 1; i <= d.numPages; i++) {
    const pg = await d.getPage(i),
      c = await pg.getTextContent();
    t += "\n" + c.items.map((x) => x.str).join(" ");
  }
  return t;
}
function normalizeJson(d) {
  const a = Array.isArray(d) ? d : d.questions;
  if (!Array.isArray(a)) throw Error("JSON 中需要 questions 数组。");
  return a.map(normalize);
}
function normalize(q, i) {
  let o = q.options || [];
  if (!Array.isArray(o))
    o = Object.entries(o).map(([key, text]) => ({ key, text }));
  o = o.map((x, j) =>
    typeof x === "string"
      ? { key: String.fromCharCode(65 + j), text: x }
      : { key: x.key, text: x.text },
  );
  return {
    id: q.id || id(),
    number: q.number || i + 1,
    type: q.type || infer(o, q.answer, q.stem),
    stem: q.stem || q.question || "",
    material: q.material || "",
    options: o,
    answer: Array.isArray(q.answer) ? q.answer : String(q.answer ?? ""),
    explanation: q.explanation || q.analysis || "",
    confidence: q.confidence ?? 1,
    knowledgeId: q.knowledgeId || "",
    relatedKnowledgeIds: q.relatedKnowledgeIds || [],
  };
}
function parseDocs(qt, at = "") {
  qt = qt.replace(/\r/g, "");
  const ss = [...qt.matchAll(/(?:^|\n)\s*(\d{1,4})[.、）)]\s*/g)],
    am = answerMap(at || qt);
  return ss
    .map((m, i) => {
      const b = qt
          .slice(
            m.index + m[0].length,
            i + 1 < ss.length ? ss[i + 1].index : qt.length,
          )
          .trim(),
        om = [
          ...b.matchAll(
            /(?:^|\n|\s{2,})([A-H])[.、）)]\s*([^\n]+?)(?=(?:\s{2,}[A-H][.、）)]|\n[A-H][.、）)]|$))/g,
          ),
        ],
        o = om.map((x) => ({ key: x[1], text: x[2].trim() })),
        stem = (om.length ? b.slice(0, om[0].index) : b)
          .replace(/(?:答案|参考答案)[:：][\s\S]*$/, "")
          .trim(),
        a = am[m[1]] || { answer: "", explanation: "" },
        type = infer(o, a.answer, stem);
      return normalize(
        {
          number: m[1],
          stem,
          options: o,
          answer: clean(a.answer, type),
          explanation: a.explanation,
          type,
          confidence: a.answer ? 0.9 : 0.55,
        },
        i,
      );
    })
    .filter((q) => q.stem);
}
function answerMap(t) {
  const m = {};
  [
    ...t.matchAll(
      /(?:^|\n)\s*(\d{1,4})[.、）)]?\s*(?:答案[:：]?\s*)?([A-H]+|正确|错误|对|错|√|×)(?:\s*[；;。]?\s*(?:解析|答案解析)[:：]\s*([\s\S]*?))?(?=(?:\n\s*\d{1,4}[.、）)]\s*)|$)/g,
    ),
  ].forEach(
    (x) => (m[x[1]] = { answer: x[2], explanation: (x[3] || "").trim() }),
  );
  return m;
}
function infer(o, a = "", s = "") {
  if (/正确|错误|对|错|√|×/.test(String(a)) || /判断/.test(s)) return "judge";
  if (o.length)
    return String(a).replace(/[^A-H]/gi, "").length > 1 ? "multiple" : "single";
  return /简答|论述|分析/.test(s) ? "short" : "blank";
}
function clean(a, t) {
  a = String(a || "").trim();
  if (t === "judge")
    return /正确|对|√/.test(a) ? "正确" : /错误|错|×/.test(a) ? "错误" : a;
  if (t === "multiple")
    return a
      .toUpperCase()
      .replace(/[^A-H]/g, "")
      .split("");
  if (t === "single") return a.toUpperCase().match(/[A-H]/)?.[0] || a;
  return a;
}
function renderImport() {
  $("#review-panel").classList.remove("hidden");
  $("#review-summary").textContent =
    `${draft.length} 道题；保存前可以指定主考点。`;
  $("#review-list").innerHTML = draft
    .map(
      (q, i) =>
        `<div class="review-item ${q.confidence < 0.7 ? "warn" : ""}" data-ri="${i}"><strong>#${q.number}</strong><div class="review-fields"><div class="row"><select data-f="type">${Object.entries(
          types,
        )
          .map(
            ([k, v]) =>
              `<option value="${k}" ${q.type === k ? "selected" : ""}>${v}</option>`,
          )
          .join(
            "",
          )}</select><select data-f="knowledgeId">${options(q.knowledgeId)}</select></div><label>相关考点（可多选）<select data-f="relatedKnowledgeIds" multiple size="3">${flat().map((n) => `<option value="${n.id}" ${q.relatedKnowledgeIds.includes(n.id) ? "selected" : ""}>${"　".repeat(n.depth)}${esc(n.name)}</option>`).join("")}</select></label><textarea data-f="stem">${esc(q.stem)}</textarea><input data-f="options" value="${esc(q.options.map((o) => `${o.key}.${o.text}`).join(" | "))}"><div class="row"><input data-f="answer" value="${esc(Array.isArray(q.answer) ? q.answer.join("") : q.answer)}" placeholder="正确答案"><small>来源：${esc(q.source.questionFile)}</small></div><textarea data-f="explanation" placeholder="答案解析">${esc(q.explanation)}</textarea></div><button class="ghost danger" data-rm="${i}">删除</button></div>`,
    )
    .join("");
  $$("[data-ri]").forEach((el, i) =>
    el
      .querySelectorAll("[data-f]")
      .forEach(
        (x) =>
          (x.oninput = () =>
            updateDraft(
              i,
              x.dataset.f,
              x.multiple
                ? [...x.selectedOptions].map((o) => o.value)
                : x.value,
            )),
      ),
  );
  $$("[data-rm]").forEach(
    (x) =>
      (x.onclick = () => {
        draft.splice(+x.dataset.rm, 1);
        renderImport();
      }),
  );
}
function updateDraft(i, f, v) {
  if (f === "options")
    draft[i].options = v
      .split("|")
      .map((s, j) => ({
        key: (s.match(/^\s*([A-H])/) || [])[1] || String.fromCharCode(65 + j),
        text: s.trim().replace(/^[A-H][.、）)]?\s*/, ""),
      }));
  else if (f === "answer") draft[i].answer = clean(v, draft[i].type);
  else if (f === "relatedKnowledgeIds") draft[i].relatedKnowledgeIds = v;
  else draft[i][f] = v;
}
$("#save-bank-btn").onclick = () => {
  const name = $("#bank-name").value.trim() || "未命名题库";
  draft.forEach(
    (q) =>
      (q.source = {
        ...q.source,
        bank: name,
        meta: $("#bank-meta").value.trim(),
      }),
  );
  banks.unshift({
    id: id(),
    name,
    meta: $("#bank-meta").value.trim(),
    createdAt: new Date().toISOString(),
    questions: draft,
  });
  draft = [];
  $("#review-panel").classList.add("hidden");
  save();
  page("home");
};

function startBank(bid, ids) {
  const b = banks.find((x) => x.id === bid),
    qs = ids ? b?.questions.filter((q) => ids.includes(q.id)) : b?.questions;
  if (!qs?.length) return alert("没有可练习的题目。");
  session = { bank: b, questions: qs, index: 0 };
  page("quiz");
  renderQuestion();
}
function startMixed(rows) {
  if (!rows.length) return alert("没有同考点题目。");
  session = {
    bank: { name: "考点专项练习" },
    questions: rows.map((x) => x.q),
    index: 0,
  };
  page("quiz");
  renderQuestion();
}
function renderQuestion() {
  const q = session.questions[session.index],
    r = records[q.id] || {};
  $("#quiz-bank-name").textContent = session.bank.name;
  $("#quiz-progress").textContent =
    `${session.index + 1} / ${session.questions.length}`;
  $("#progress-bar").style.width =
    `${((session.index + 1) / session.questions.length) * 100}%`;
  $("#question-type").textContent = types[q.type];
  $("#question-number").textContent = `第 ${q.number} 题`;
  $("#question-stem").textContent = q.stem;
  $("#shared-material").textContent = q.material || "";
  $("#shared-material").classList.toggle("hidden", !q.material);
  $("#question-tags").innerHTML = `<span>${esc(
    path(q.knowledgeId)
      .map((x) => x.name)
      .join(" / ") || "未分类",
  )}</span><span>来源：${esc(q.source?.bank || find(q.id)?.b.name || "")}</span>`;
  $("#result-panel").classList.add("hidden");
  $("#submit-answer").classList.remove("hidden");
  $("#toggle-favorite").textContent = favorites[q.id] ? "★ 已收藏" : "☆ 收藏";
  $("#error-reason").value = r.errorReason || "";
  $("#personal-note").value = r.note || "";
  $("#prev-question").disabled = !session.index;
  $("#next-question").textContent =
    session.index === session.questions.length - 1 ? "完成" : "下一题";
  renderAnswer(q);
}
function renderAnswer(q) {
  const multi = q.type === "multiple";
  $("#answer-area").innerHTML = ["single", "multiple"].includes(q.type)
    ? q.options
        .map(
          (o) =>
            `<label class="option"><input type="${multi ? "checkbox" : "radio"}" name="answer" value="${o.key}"><b>${o.key}</b><span>${esc(o.text)}</span></label>`,
        )
        .join("")
    : q.type === "judge"
      ? ["正确", "错误"]
          .map(
            (x) =>
              `<label class="option"><input type="radio" name="answer" value="${x}">${x}</label>`,
          )
          .join("")
      : '<textarea class="text-answer" rows="4" placeholder="输入你的答案"></textarea>';
}
function userAnswer(q) {
  return q.type === "multiple"
    ? $$("[name=answer]:checked")
        .map((x) => x.value)
        .sort()
    : ["single", "judge"].includes(q.type)
      ? $("[name=answer]:checked")?.value || ""
      : $(".text-answer")?.value.trim() || "";
}
function equal(a, b, t) {
  if (t === "multiple")
    return (
      [...a].sort().join("") ===
      [...(Array.isArray(b) ? b : String(b).split(""))].sort().join("")
    );
  if (t === "short") return null;
  return (
    String(a).replace(/\s/g, "").toLowerCase() ===
    String(b).replace(/\s/g, "").toLowerCase()
  );
}
$("#submit-answer").onclick = () => {
  const q = session.questions[session.index],
    a = userAnswer(q);
  if (!a || (Array.isArray(a) && !a.length)) return alert("请先作答。");
  const ok = equal(a, q.answer, q.type),
    r = records[q.id] || { attempts: [] };
  r.attempts.push({ at: new Date().toISOString(), answer: a, correct: ok });
  records[q.id] = r;
  const p = $("#result-panel");
  p.classList.remove("hidden", "wrong");
  $("#result-title").textContent =
    ok === true ? "回答正确" : ok === false ? "回答错误" : "请对照答案自评";
  if (ok === false) {
    p.classList.add("wrong");
    const old = mistakes[q.id] || {};
    mistakes[q.id] = {
      questionId: q.id,
      bankId: find(q.id)?.b.id || old.bankId,
      wrongCount: (old.wrongCount || 0) + 1,
      lastWrongAt: new Date().toISOString(),
      knowledgeId: q.knowledgeId,
      source: q.source,
    };
  }
  $("#correct-answer").textContent = Array.isArray(q.answer)
    ? q.answer.join("、")
    : q.answer || "暂无";
  $("#explanation").textContent = q.explanation || "暂无解析";
  $("#submit-answer").classList.add("hidden");
  save();
};
$("#toggle-favorite").onclick = () => {
  const q = session.questions[session.index];
  favorites[q.id]
    ? delete favorites[q.id]
    : (favorites[q.id] = { at: new Date().toISOString() });
  save();
  renderQuestion();
};
$("#save-note").onclick = () => {
  const q = session.questions[session.index],
    r = records[q.id] || { attempts: [] };
  r.note = $("#personal-note").value.trim();
  r.errorReason = $("#error-reason").value;
  records[q.id] = r;
  save();
  $("#save-note").textContent = "✓ 已保存";
  setTimeout(() => ($("#save-note").textContent = "保存笔记"), 1200);
};
$("#practice-similar").onclick = () => {
  const q = session.questions[session.index];
  q.knowledgeId
    ? startMixed(related(q.knowledgeId).filter((x) => x.q.id !== q.id))
    : alert("这道题还没有设置考点。");
};
$("#prev-question").onclick = () => {
  if (session.index) {
    session.index--;
    renderQuestion();
  }
};
$("#next-question").onclick = () => {
  if (session.index < session.questions.length - 1) {
    session.index++;
    renderQuestion();
  } else page("home");
};
$("#quit-quiz").onclick = () => page("home");
function renderReview() {
  const map =
      reviewTab === "mistakes"
        ? mistakes
        : reviewTab === "favorites"
          ? favorites
          : Object.fromEntries(
              Object.entries(records).filter(([, r]) => r.note),
            ),
    rows = Object.keys(map).map(find).filter(Boolean);
  $("#review-list").innerHTML = rows.length
    ? rows
        .map(({ b, q }) => {
          const r = records[q.id] || {},
            m = mistakes[q.id];
          return `<article class="mistake-card"><div class="chips"><span>${esc(
            path(q.knowledgeId)
              .map((x) => x.name)
              .join(" / ") || "未分类",
          )}</span><span>${esc(q.source?.bank || b.name)} · 第${q.source?.number || q.number}题</span></div><h3>${esc(q.stem)}</h3>${m ? `<p>累计答错 ${m.wrongCount || 1} 次</p>` : ""}${r.errorReason ? `<p><b>错因：</b>${esc(r.errorReason)}</p>` : ""}${r.note ? `<p class="note"><b>笔记：</b>${esc(r.note)}</p>` : ""}<div class="card-actions"><button class="primary" data-retry="${q.id}" data-bank="${b.id}">重做</button>${q.knowledgeId ? `<button class="ghost" data-similar="${q.knowledgeId}">练同类题</button>` : ""}<button class="ghost danger" data-remove="${q.id}">移除</button></div></article>`;
        })
        .join("")
    : '<div class="empty"><div>暂无内容</div><p>相关题目会出现在这里。</p></div>';
  $$("[data-retry]").forEach(
    (x) => (x.onclick = () => startBank(x.dataset.bank, [x.dataset.retry])),
  );
  $$("[data-similar]").forEach(
    (x) => (x.onclick = () => startMixed(related(x.dataset.similar))),
  );
  $$("[data-remove]").forEach(
    (x) =>
      (x.onclick = () => {
        if (reviewTab === "mistakes") delete mistakes[x.dataset.remove];
        else if (reviewTab === "favorites") delete favorites[x.dataset.remove];
        else records[x.dataset.remove].note = "";
        save();
      }),
  );
}
$$("[data-review-tab]").forEach(
  (x) =>
    (x.onclick = () => {
      reviewTab = x.dataset.reviewTab;
      $$("[data-review-tab]").forEach((y) =>
        y.classList.toggle("active", y === x),
      );
      renderReview();
    }),
);
$("#practice-mistakes").onclick = () =>
  startMixed(Object.keys(mistakes).map(find).filter(Boolean));
renderAll();
