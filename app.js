const DB_KEY='gongkao_quiz_banks_v1', MISTAKE_KEY='gongkao_quiz_mistakes_v1';
let banks=load(DB_KEY,[]), mistakes=load(MISTAKE_KEY,{}), draft=[], session=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function load(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function persist(){localStorage.setItem(DB_KEY,JSON.stringify(banks));localStorage.setItem(MISTAKE_KEY,JSON.stringify(mistakes));renderHome();renderMistakes()}
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function id(){return crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)}
function page(name){$$('.page').forEach(x=>x.classList.toggle('active',x.id===`page-${name}`));$$('.nav-btn').forEach(x=>x.classList.toggle('active',x.dataset.page===name));scrollTo(0,0)}
$$('[data-page]').forEach(b=>b.addEventListener('click',()=>page(b.dataset.page)));

function renderHome(){
  $('#bank-summary').textContent=`${banks.length} 个题库，共 ${banks.reduce((n,b)=>n+b.questions.length,0)} 道题 · 数据仅保存在当前浏览器`;
  const box=$('#bank-list');
  if(!banks.length){box.innerHTML='<div class="empty"><div>还没有题库</div><p>导入一份题目文档开始刷题。</p></div>';return}
  box.innerHTML=banks.map(b=>`<article class="bank-card"><span class="tag">${b.questions.length} 道题</span><h3>${esc(b.name)}</h3><p>${typeSummary(b.questions)}</p><small>导入于 ${new Date(b.createdAt).toLocaleDateString()}</small><div class="card-actions"><button class="primary" data-start="${b.id}">开始刷题</button><button class="ghost danger" data-delete="${b.id}">删除</button></div></article>`).join('');
  $$('[data-start]').forEach(x=>x.onclick=()=>startBank(x.dataset.start));
  $$('[data-delete]').forEach(x=>x.onclick=()=>{if(confirm('确定删除这个题库吗？')){banks=banks.filter(b=>b.id!==x.dataset.delete);persist()}})
}
function typeSummary(qs){const m={};qs.forEach(q=>m[q.type]=(m[q.type]||0)+1);return Object.entries(m).map(([k,v])=>`${typeName(k)} ${v}`).join(' · ')}
const typeName=t=>({single:'单选题',multiple:'多选题',judge:'判断题',blank:'填空题',short:'简答题'}[t]||'题目');

$('#question-file').onchange=e=>$('#question-file-name').textContent=e.target.files[0]?.name||'选择文件';
$('#answer-file').onchange=e=>$('#answer-file-name').textContent=e.target.files[0]?.name||'选择文件';
$('#parse-btn').onclick=async()=>{
  const qf=$('#question-file').files[0], af=$('#answer-file').files[0];
  if(!qf)return status('请先选择题目文档。',true);
  status('正在读取文档……'); $('#parse-btn').disabled=true;
  try{
    if(qf.name.endsWith('.json')) draft=normalizeJson(JSON.parse(await qf.text()));
    else {const qt=await readFile(qf), at=af?await readFile(af):'';draft=parseDocuments(qt,at)}
    if(!draft.length)throw new Error('没有识别出题目，请检查题号格式，或使用示例 JSON 格式。');
    renderReview(); status(`已识别 ${draft.length} 道题，请校对后保存。`);
  }catch(e){status(e.message,true)}finally{$('#parse-btn').disabled=false}
};
function status(t,bad=false){$('#parse-status').textContent=t;$('#parse-status').style.color=bad?'var(--red)':''}
async function readFile(file){
  if(file.name.toLowerCase().endsWith('.pdf')){
    const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;let text='';
    for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i),c=await p.getTextContent();text+='\n'+c.items.map(x=>x.str).join(' ')}return text;
  }return file.text();
}
function normalizeJson(data){const arr=Array.isArray(data)?data:data.questions;if(!Array.isArray(arr))throw new Error('JSON 中需要 questions 数组。');return arr.map((q,i)=>normalizeQuestion(q,i+1))}
function normalizeQuestion(q,n){let opts=q.options||[];if(!Array.isArray(opts))opts=Object.entries(opts).map(([key,text])=>({key,text}));opts=opts.map((o,i)=>typeof o==='string'?{key:String.fromCharCode(65+i),text:o}:{key:String(o.key||String.fromCharCode(65+i)).toUpperCase(),text:o.text});return{id:q.id||id(),number:q.number||n,type:q.type||inferType(opts,q.answer),stem:q.stem||q.question||'',material:q.material||'',options:opts,answer:Array.isArray(q.answer)?q.answer.map(String):String(q.answer??''),explanation:q.explanation||q.analysis||q解析||'',confidence:q.confidence??1}}
function parseDocuments(questionText,answerText=''){
  const clean=s=>s.replace(/\r/g,'').replace(/[\u00a0]/g,' ').replace(/([。；])\s+(?=[A-D][\.、])/g,'$1\n');
  const qt=clean(questionText), at=clean(answerText);
  const starts=[...qt.matchAll(/(?:^|\n)\s*(\d{1,4})[\.、）)]\s*/g)];
  if(!starts.length)return [];
  const answers=parseAnswerMap(at||qt); const result=[];
  for(let i=0;i<starts.length;i++){
    const num=starts[i][1], begin=starts[i].index+starts[i][0].length, end=i+1<starts.length?starts[i+1].index:qt.length;
    let block=qt.slice(begin,end).trim(); if(!block)continue;
    const optionMatches=[...block.matchAll(/(?:^|\n|\s{2,})([A-H])[\.、）)]\s*([^\n]+?)(?=(?:\s{2,}[A-H][\.、）)]|\n[A-H][\.、）)]|$))/g)];
    let options=optionMatches.map(m=>({key:m[1],text:m[2].trim()}));
    let stem=optionMatches.length?block.slice(0,optionMatches[0].index).trim():block;
    const embedded=block.match(/(?:答案|参考答案)[:：]\s*([^\n]+)(?:\n|$)/); const explanation=block.match(/(?:解析|答案解析)[:：]\s*([\s\S]+)$/);
    stem=stem.replace(/(?:答案|参考答案)[:：][\s\S]*$/,'').trim();
    const found=answers[num]||{answer:embedded?.[1]?.trim()||'',explanation:explanation?.[1]?.trim()||''};
    const type=inferType(options,found.answer,stem); result.push(normalizeQuestion({number:num,type,stem,options,answer:cleanAnswer(found.answer,type),explanation:found.explanation,confidence:found.answer?0.9:0.55},num));
  }return result;
}
function parseAnswerMap(text){const map={};if(!text)return map;const ms=[...text.matchAll(/(?:^|\n)\s*(\d{1,4})[\.、）)]?\s*(?:答案[:：]?\s*)?([A-H]+|正确|错误|对|错|√|×|[^\n]{1,30})(?:\s*[；;。]?\s*(?:解析|答案解析)[:：]\s*([\s\S]*?))?(?=(?:\n\s*\d{1,4}[\.、）)]\s*)|$)/g)];ms.forEach(m=>map[m[1]]={answer:m[2].trim(),explanation:(m[3]||'').trim()});return map}
function inferType(options,answer='',stem=''){const a=String(answer);if(/正确|错误|对|错|√|×/.test(a)||/判断/.test(stem))return'judge';if(options.length)return a.replace(/[^A-H]/gi,'').length>1?'multiple':'single';return /简答|论述|分析/.test(stem)?'short':'blank'}
function cleanAnswer(a,t){a=String(a||'').trim();if(t==='judge')return /正确|对|√/.test(a)?'正确':/错误|错|×/.test(a)?'错误':a;if(t==='multiple')return a.toUpperCase().replace(/[^A-H]/g,'').split('');if(t==='single')return a.toUpperCase().match(/[A-H]/)?.[0]||a;return a}

function renderReview(){
  $('#review-panel').classList.remove('hidden');$('#review-summary').textContent=`${draft.length} 道题；橙色项需要重点检查。`;
  $('#review-list').innerHTML=draft.map((q,i)=>`<div class="review-item ${q.confidence<.7?'warn':''}" data-review="${i}"><strong>#${q.number}</strong><div class="review-fields"><div class="row"><select data-field="type"><option value="single">单选题</option><option value="multiple">多选题</option><option value="judge">判断题</option><option value="blank">填空题</option><option value="short">简答题</option></select><input data-field="answer" value="${esc(Array.isArray(q.answer)?q.answer.join(''):q.answer)}" placeholder="正确答案" /></div><textarea data-field="stem">${esc(q.stem)}</textarea><input data-field="options" value="${esc(q.options.map(o=>`${o.key}.${o.text}`).join(' | '))}" placeholder="选项：A.内容 | B.内容"/><textarea data-field="explanation" placeholder="答案解析">${esc(q.explanation)}</textarea><span class="confidence">${q.confidence<.7?'⚠ 未找到明确答案，请人工检查':'✓ 已自动配对答案'}</span></div><button class="ghost danger" data-remove="${i}">删除</button></div>`).join('');
  $$('[data-review]').forEach((el,i)=>{el.querySelector('[data-field=type]').value=draft[i].type;el.querySelectorAll('[data-field]').forEach(inp=>inp.oninput=()=>updateDraft(i,inp.dataset.field,inp.value))});
  $$('[data-remove]').forEach(b=>b.onclick=()=>{draft.splice(+b.dataset.remove,1);renderReview()});
}
function updateDraft(i,f,v){if(f==='options')draft[i].options=v.split('|').map(s=>s.trim()).filter(Boolean).map((s,j)=>({key:(s.match(/^([A-H])[\.、）)]?/)||[])[1]||String.fromCharCode(65+j),text:s.replace(/^[A-H][\.、）)]?\s*/,'')}));else if(f==='answer')draft[i].answer=cleanAnswer(v,draft[i].type);else draft[i][f]=v}
$('#save-bank-btn').onclick=()=>{const name=$('#bank-name').value.trim()||$('#question-file').files[0]?.name.replace(/\.[^.]+$/,'')||'未命名题库';banks.unshift({id:id(),name,createdAt:new Date().toISOString(),questions:draft.map(q=>({...q,id:q.id||id()}))});persist();draft=[];$('#review-panel').classList.add('hidden');page('home')};

function startBank(bankId,questionIds=null){const bank=banks.find(b=>b.id===bankId);if(!bank)return;const questions=questionIds?bank.questions.filter(q=>questionIds.includes(q.id)):bank.questions;session={bank,questions,index:0,answers:{}};page('quiz');renderQuestion()}
function renderQuestion(){const {bank,questions,index}=session,q=questions[index];$('#quiz-bank-name').textContent=bank.name;$('#quiz-progress').textContent=`${index+1} / ${questions.length}`;$('#progress-bar').style.width=`${(index+1)/questions.length*100}%`;$('#question-type').textContent=typeName(q.type);$('#question-number').textContent=`第 ${q.number} 题`;$('#question-stem').textContent=q.stem;$('#shared-material').textContent=q.material;$('#shared-material').classList.toggle('hidden',!q.material);$('#result-panel').classList.add('hidden');$('#submit-answer').classList.remove('hidden');$('#prev-question').disabled=index===0;$('#next-question').textContent=index===questions.length-1?'完成':'下一题';$('#toggle-favorite').textContent=mistakes[q.id]?'★ 已收藏':'☆ 收藏';renderAnswerArea(q)}
function renderAnswerArea(q){const box=$('#answer-area'),multi=q.type==='multiple';if(q.type==='single'||multi)box.innerHTML=q.options.map(o=>`<label class="option"><input type="${multi?'checkbox':'radio'}" name="answer" value="${esc(o.key)}"><b>${esc(o.key)}</b><span>${esc(o.text)}</span></label>`).join('');else if(q.type==='judge')box.innerHTML=['正确','错误'].map(x=>`<label class="option"><input type="radio" name="answer" value="${x}"><span>${x}</span></label>`).join('');else box.innerHTML=`<textarea class="text-answer" rows="4" placeholder="输入你的答案"></textarea>`}
function userAnswer(q){if(q.type==='multiple')return $$('[name=answer]:checked').map(x=>x.value).sort();if(q.type==='single'||q.type==='judge')return $('[name=answer]:checked')?.value||'';return $('.text-answer')?.value.trim()||''}
function equalAnswer(a,b,type){if(type==='multiple')return [...a].sort().join('')===[...(Array.isArray(b)?b:String(b).split(''))].sort().join('');if(type==='blank')return String(a).replace(/\s/g,'').toLowerCase()===String(b).replace(/\s/g,'').toLowerCase();if(type==='short')return null;return String(a)===String(b)}
$('#submit-answer').onclick=()=>{const q=session.questions[session.index],a=userAnswer(q);if(!a||Array.isArray(a)&&!a.length)return alert('请先作答。');const ok=equalAnswer(a,q.answer,q.type);session.answers[q.id]={answer:a,correct:ok};const r=$('#result-panel');r.classList.remove('hidden','wrong');if(ok===true){$('#result-title').textContent='回答正确';if(mistakes[q.id])delete mistakes[q.id]}else if(ok===false){$('#result-title').textContent='回答错误';r.classList.add('wrong');mistakes[q.id]={bankId:session.bank.id,questionId:q.id,lastWrongAt:new Date().toISOString()}}else{$('#result-title').textContent='请对照参考答案自评'}$('#correct-answer').textContent=Array.isArray(q.answer)?q.answer.join('、'):q.answer||'暂无标准答案';$('#explanation').textContent=q.explanation||'暂无解析';$('#submit-answer').classList.add('hidden');persist()};
$('#prev-question').onclick=()=>{if(session.index>0){session.index--;renderQuestion()}};
$('#next-question').onclick=()=>{if(session.index<session.questions.length-1){session.index++;renderQuestion()}else{page('home')}};
$('#quit-quiz').onclick=()=>page('home');
$('#toggle-favorite').onclick=()=>{const q=session.questions[session.index];if(mistakes[q.id])delete mistakes[q.id];else mistakes[q.id]={bankId:session.bank.id,questionId:q.id,lastWrongAt:new Date().toISOString()};persist();renderQuestion()};
function renderMistakes(){const rows=Object.values(mistakes).map(m=>{const b=banks.find(x=>x.id===m.bankId),q=b?.questions.find(x=>x.id===m.questionId);return b&&q?{b,q,m}:null}).filter(Boolean);$('#mistake-count').textContent=rows.length;const box=$('#mistake-list');if(!rows.length){box.innerHTML='<div class="empty"><div>还没有错题</div><p>答错的题目会自动收录到这里。</p></div>';return}box.innerHTML=rows.map(({b,q})=>`<article class="mistake-card"><small>${esc(b.name)} · ${typeName(q.type)}</small><h3>${esc(q.stem)}</h3><p><b>答案：</b>${esc(Array.isArray(q.answer)?q.answer.join('、'):q.answer)}</p><div class="card-actions"><button class="primary" data-retry-bank="${b.id}" data-retry-q="${q.id}">重做</button><button class="ghost danger" data-forget="${q.id}">移除</button></div></article>`).join('');$$('[data-retry-q]').forEach(x=>x.onclick=()=>startBank(x.dataset.retryBank,[x.dataset.retryQ]));$$('[data-forget]').forEach(x=>x.onclick=()=>{delete mistakes[x.dataset.forget];persist()})}
$('#practice-mistakes').onclick=()=>{const first=Object.values(mistakes)[0];if(!first)return alert('错题本还是空的。');const ids=Object.values(mistakes).filter(x=>x.bankId===first.bankId).map(x=>x.questionId);startBank(first.bankId,ids)};
renderHome();renderMistakes();
