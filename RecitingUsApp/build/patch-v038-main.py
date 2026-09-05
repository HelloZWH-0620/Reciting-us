#!/usr/bin/env python3
"""v0.38 app.main.js 功能补丁：拼音注音 / AI 设置按档案存取 / 虚词 AI 例句 / 练习目录层级"""
from pathlib import Path

p = Path(__file__).resolve().parent.parent / "web" / "js" / "app.main.js"
s = p.read_text(encoding="utf-8")
n0 = len(s)

# ---------- A. 拼音注音模块 ----------
anchor_a = """  // 账户登录时已把该用户 profile 载入 localStorage；此处直接套用主题即可
  try {
    var theme = Store.getTheme();
    document.documentElement.setAttribute('data-theme', theme);
  } catch(e){}"""
pinyin_mod = anchor_a + """

  /* ===== 拼音注音（v0.38）：文章正文 ruby 逐字注音，顶栏「拼音」开关 ===== */
  var pinyinBtn = document.getElementById('pinyinBtn');
  function pinyinOn(){ return Store.get('pinyinMode', false) === true; }
  function updatePinyinBtn(){
    if (!pinyinBtn) return;
    var on = pinyinOn();
    pinyinBtn.style.background = on ? 'var(--pri)' : '';
    pinyinBtn.style.color = on ? 'var(--pri-fg)' : '';
    pinyinBtn.style.borderColor = on ? 'var(--pri)' : '';
  }
  var _pinyinWorking = false;
  function annotatePinyin(root){
    if (_pinyinWorking || !root) return;
    _pinyinWorking = true;
    try {
      var dict = window.PINYIN_DICT || {};
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function(n){
          if (!n.nodeValue || !/[\\u3400-\\u9fff]/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
          var pp = n.parentNode;
          while (pp && pp !== root) {
            if (pp.nodeName === 'RUBY' || pp.nodeName === 'RT' || pp.nodeName === 'SCRIPT' || pp.nodeName === 'STYLE') return NodeFilter.FILTER_REJECT;
            if (pp.classList && (pp.classList.contains('notes-row-idx') || pp.classList.contains('pinyin-skip'))) return NodeFilter.FILTER_REJECT;
            pp = pp.parentNode;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var nodes = [], nx;
      while ((nx = walker.nextNode())) nodes.push(nx);
      for (var i = 0; i < nodes.length; i++) {
        var tn = nodes[i];
        var frag = document.createDocumentFragment();
        var plain = '';
        var text = tn.nodeValue;
        for (var c = 0; c < text.length; c++) {
          var ch = text[c];
          var py = dict[ch];
          if (py) {
            if (plain) { frag.appendChild(document.createTextNode(plain)); plain = ''; }
            var rb = document.createElement('ruby');
            rb.appendChild(document.createTextNode(ch));
            var rt = document.createElement('rt');
            rt.textContent = py;
            rb.appendChild(rt);
            frag.appendChild(rb);
          } else { plain += ch; }
        }
        if (plain) frag.appendChild(document.createTextNode(plain));
        if (tn.parentNode) tn.parentNode.replaceChild(frag, tn);
      }
    } catch(e){}
    _pinyinWorking = false;
  }
  function removePinyin(root){
    if (!root) return;
    var rubies = root.querySelectorAll('ruby');
    for (var i = 0; i < rubies.length; i++) {
      var rb = rubies[i];
      var ch = (rb.childNodes[0] && rb.childNodes[0].textContent) || '';
      rb.parentNode.replaceChild(document.createTextNode(ch), rb);
    }
    root.normalize();
  }
  function refreshPinyin(){
    var body = document.getElementById('artBody');
    if (!body) return;
    var on = pinyinOn();
    body.classList.toggle('pinyin-on', on);
    if (on) annotatePinyin(body); else removePinyin(body);
  }
  if (pinyinBtn) {
    pinyinBtn.onclick = function(){
      Store.set('pinyinMode', !pinyinOn());
      updatePinyinBtn();
      refreshPinyin();
      showToast(pinyinOn() ? '拼音注音已开启' : '拼音注音已关闭', 'success');
    };
    updatePinyinBtn();
  }
  // 正文重渲染后自动套用/清除注音（观察 artBody，防抖收敛避免自我触发死循环）
  var _pinyinDebounce = null;
  try {
    var _pinyinObs = new MutationObserver(function(){
      if (!pinyinOn()) return;
      if (_pinyinDebounce) clearTimeout(_pinyinDebounce);
      _pinyinDebounce = setTimeout(refreshPinyin, 60);
    });
    _pinyinObs.observe(document.getElementById('artBody'), { childList: true, subtree: true });
  } catch(e){}"""
assert anchor_a in s, "anchor A"
s = s.replace(anchor_a, pinyin_mod)

# ---------- B. AI 配置按档案存取 ----------
anchor_b = """      var fname = fileMap[key];
      if (!fname) return Promise.resolve();"""
new_b = """      var fname = fileMap[key];
      // v0.38：AI 设置绑定到对应用户 —— 写入按档案命名的独立文件
      if (key === 'aiConfig') {
        var _p = window.__ACTIVE_PROFILE__;
        var _tag = ((_p && _p.file) || 'default').replace(/\\.json$/i, '');
        fname = 'ai_config__' + _tag + '.json';
      }
      if (!fname) return Promise.resolve();"""
assert anchor_b in s, "anchor B"
s = s.replace(anchor_b, new_b)

# ---------- C. 虚词词卡：AI 收集例句 ----------
anchor_c = """    html += '</div>';
    html += '<div class="word-card-footer"><button class="word-card-btn" id="wordCardGameBtn">词卡练习👏</button></div>';
    html += '</div>';"""
new_c = """    html += '</div>';
    html += '<div class="word-card-footer"><button class="word-card-btn" id="wordCardGameBtn">词卡练习👏</button>' +
            '<button class="word-card-btn" id="wordAiExBtn" style="margin-left:10px" title="AI 从教材课文收集该虚词各义项的例句">📚 AI 收集例句</button></div>';
    html += '<div id="wordAiExResult" style="margin-top:14px"></div>';
    html += '</div>';"""
assert anchor_c in s, "anchor C"
s = s.replace(anchor_c, new_c)

anchor_c2 = """    document.getElementById('wordCardGameBtn').onclick = function() {"""
ai_handler = """    document.getElementById('wordAiExBtn').onclick = function() {
      var btn = this;
      var box = document.getElementById('wordAiExResult');
      var cfg = Store.getAIConfig();
      if (!cfg.apiUrl || !cfg.apiKey || !cfg.model) {
        showToast('请先在「更多 → AI 大模型设置」中完成配置', 'error');
        return;
      }
      btn.disabled = true;
      btn.textContent = '⏳ 正在收集例句…';
      box.innerHTML = '<div style="color:var(--sub);font-size:13px;padding:10px 2px">AI 正在从教材课文中为「' + escapeHtml(word) + '」收集例句，请稍候…</div>';
      var prompt = '请从高中语文教材文言文课文中，为文言虚词「' + word + '」收集例句。' +
        '要求：按该虚词的主要义项分组；每个义项给出 2 个例句；' +
        '每个例句独占一行，格式为「原句 —— 《课文篇名》（该虚词在此句中的意义）」。' +
        '例句必须真实出自教材课文，不要编造。除分组标题与例句外不要输出任何其它内容。';
      callAI(cfg, prompt, 90000).then(function(res){
        btn.disabled = false;
        btn.textContent = '📚 AI 收集例句';
        if (!res.success) {
          box.innerHTML = '<div style="color:#e5484d;font-size:13px;padding:8px 2px">' + escapeHtml(res.error || '收集失败') + '</div>';
          return;
        }
        var lines = String(res.content || '').split('\\n');
        var html2 = '<div class="word-card" style="margin-top:4px"><div class="word-card-right">';
        var any = false;
        for (var i = 0; i < lines.length; i++) {
          var ln = lines[i].trim();
          if (!ln) continue;
          any = true;
          var isGroup = /^[一二三四五六七八九十]+[、.．]/.test(ln) || (/义项|用法/.test(ln) && ln.length < 30);
          html2 += '<div class="word-card-meaning" style="padding:10px 14px">' +
                   '<div style="' + (isGroup ? 'font-weight:700;color:var(--pri)' : 'font-family:\\'LXGW WenKai\\',\\'KaiTi\\',serif') + ';font-size:14px;line-height:1.8">' + escapeHtml(ln) + '</div></div>';
        }
        if (!any) html2 += '<div style="color:var(--sub);font-size:13px">AI 未返回有效例句，请重试。</div>';
        html2 += '</div></div>';
        box.innerHTML = html2;
        glassWordGame(box);
        try { box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch(e){}
      });
    };
    document.getElementById('wordCardGameBtn').onclick = function() {"""
assert anchor_c2 in s, "anchor C2"
s = s.replace(anchor_c2, ai_handler)

# ---------- D. 练习目录：顶级动作改用 sbtn（缩进一致）+ 类型选中态生效 ----------
old_d1 = """    html += '<button class="nav-child' + (exerciseState.type==='blank'?' sel':'') + '" data-ex-type="blank">🖊️填空默写</button>';
    html += '<button class="nav-child' + (exerciseState.type==='match'?' sel':'') + '" data-ex-type="match">🧩上下句对接</button>';
    html += '<button class="nav-child' + (exerciseState.type==='situational'?' sel':'') + '" data-ex-type="situational">✨情境默写</button>';
    html += '<button class="nav-child' + (exerciseState.type==='feihua'?' sel':'') + '" data-ex-type="feihua">💐飞花令</button>';"""
new_d1 = """    html += '<button class="sbtn' + (exerciseState.type==='blank'?' sel':'') + '" data-ex-type="blank">🖊️填空默写</button>';
    html += '<button class="sbtn' + (exerciseState.type==='match'?' sel':'') + '" data-ex-type="match">🧩上下句对接</button>';
    html += '<button class="sbtn' + (exerciseState.type==='situational'?' sel':'') + '" data-ex-type="situational">✨情境默写</button>';
    html += '<button class="sbtn' + (exerciseState.type==='feihua'?' sel':'') + '" data-ex-type="feihua">💐飞花令</button>';"""
assert old_d1 in s, "anchor D1"
s = s.replace(old_d1, new_d1)

old_d2 = """    html += '<button class="nav-child" id="exBackBtn" style="margin-bottom:4px">🔙返回练习类型</button>';
    html += '<div style="height:1px;background:var(--border);margin:8px 16px"></div>';
    html += '<button class="nav-child" data-ex-art="random" style="margin-bottom:8px;color:var(--fg)">🎲随机出题</button>';"""
new_d2 = """    html += '<button class="sbtn" id="exBackBtn" style="margin-bottom:4px">🔙返回练习类型</button>';
    html += '<div style="height:1px;background:var(--border);margin:8px 16px"></div>';
    html += '<button class="sbtn" data-ex-art="random" style="margin-bottom:8px;color:var(--fg)">🎲随机出题</button>';"""
assert old_d2 in s, "anchor D2"
s = s.replace(old_d2, new_d2)

p.write_text(s, encoding="utf-8")
print(f"app.main.js patched: {n0} -> {len(s)} bytes")
