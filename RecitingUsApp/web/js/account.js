function startAccountFlow(onDone) {
  var api = ProfileAPI();
  var overlay = document.createElement('div');
  overlay.className = 'ac-overlay';
  overlay.innerHTML =
    '<style>' +
    '.ac-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
    'background:radial-gradient(1200px 600px at 50% -10%,rgba(0,120,212,.18),transparent),var(--bg);' +
    'font-family:"Microsoft YaHei",sans-serif;color:var(--fg);padding:24px;box-sizing:border-box}' +
    '.ac-card{width:min(440px,100%);max-height:90vh;overflow:auto;background:var(--card);border:1px solid var(--border);' +
    'border-radius:16px;box-shadow:0 20px 60px var(--shadow);padding:28px}' +
    '.ac-title{font-size:22px;font-weight:600;margin:0 0 4px}' +
    '.ac-sub{font-size:13px;color:var(--sub);margin:0 0 20px}' +
    '.ac-user{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:var(--bg);' +
    'border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:10px;cursor:pointer;transition:border-color .12s,background .12s;color:var(--fg)}' +
    '.ac-user:hover{background:rgba(0,120,212,.06)}' +
    '.ac-avatar{width:44px;height:44px;border-radius:50%;flex:0 0 44px;display:flex;align-items:center;justify-content:center;' +
    'font-size:20px;font-weight:700;color:#fff;background:linear-gradient(135deg,#0078d4,#00b4d8)}' +
    '.ac-user .ac-uname{font-size:16px;font-weight:600}' +
    '.ac-user .ac-pname{font-size:12px;color:var(--sub)}' +
    '.ac-btn{display:block;width:100%;padding:12px;border:none;border-radius:10px;cursor:pointer;font-family:inherit;font-size:14px;transition:opacity .15s}' +
    '.ac-btn.primary{background:var(--pri);color:var(--pri-fg)}' +
    '.ac-btn.primary:hover{opacity:.9}' +
    '.ac-btn.ghost{background:transparent;color:var(--fg);border:1px solid var(--border);margin-top:10px}' +
    '.ac-btn.ghost:hover{background:var(--hover)}' +
    '.ac-field{margin-bottom:16px}' +
    '.ac-field label{display:block;font-size:13px;color:var(--sub);margin-bottom:6px}' +
    '.ac-field input{width:100%;padding:11px 12px;border:1px solid var(--border);border-radius:9px;background:var(--bg);' +
    'color:var(--fg);font-family:inherit;font-size:14px;box-sizing:border-box}' +
    '.ac-field input:focus{outline:none;border-color:var(--pri)}' +
    '.ac-err{color:#e5484d;font-size:12px;min-height:16px;margin:-8px 0 8px}' +
    '.ac-hint{font-size:11px;color:var(--sub);margin-top:4px}' +
    '.ac-divider{display:flex;align-items:center;gap:10px;color:var(--sub);font-size:12px;margin:16px 0}' +
    '.ac-divider:before,.ac-divider:after{content:"";flex:1;height:1px;background:var(--border)}' +
    '</style>' +
    '<div class="ac-card" id="acCard"></div>';

  document.body.appendChild(overlay);
  var card = overlay.querySelector('#acCard');

  function closeAndBoot(profileMeta) {
    overlay.remove();
    onDone();
  }

  function showError(msg) {
    var el = card.querySelector('.ac-err');
    if (el) el.textContent = msg || '';
  }

  function afterLogin(profileMeta, profileObj) {
    // profileMeta: {name, file, username, password, createdAt}
    window.__ACTIVE_PROFILE__ = profileMeta;
    // v0.38：AI 设置绑定到对应用户。旧版本曾把 AI 配置写在全局 ai_config.json，
    // 档案数据缺 aiConfig 时一次性迁入该用户（此后随档案一起保存/恢复，互不串用）。
    var ensure = Promise.resolve(profileObj);
    if (!profileObj || !profileObj.data || !profileObj.data.aiConfig) {
      ensure = api.read('ai_config.json').then(function (legacy) {
        var cfg = legacy && (legacy.aiConfig || (legacy.apiUrl ? legacy : null));
        if (cfg && (cfg.apiUrl || cfg.model)) {
          profileObj = profileObj || {};
          profileObj.data = profileObj.data || {};
          profileObj.data.aiConfig = cfg;
        }
        return profileObj;
      }).catch(function () { return profileObj; });
    }
    ensure.then(function (p) {
      loadProfileIntoLocalStorage(p);
      renderStudyPanel(profileMeta);
    });
  }

  // 登录成功后：展示学习数据概览面板，点击“进入应用”才关闭账户浮层
  // 注意：Store 是 bootApp() 的局部变量，此处不可引用；直接读 localStorage（bsw_ 前缀）
  function bswGet(key, def) {
    try { var v = localStorage.getItem('bsw_' + key); return v === null ? def : JSON.parse(v); }
    catch (e) { return def; }
  }
  function bswStreak() {
    var days = bswGet('studyDays', []);
    var set = {};
    for (var i = 0; i < days.length; i++) set[days[i]] = 1;
    var streak = 0;
    var d = new Date();
    d.setDate(d.getDate() - 1);
    while (true) {
      var fmt = d.getFullYear() + '-' + ((d.getMonth() + 1) + '').padStart(2, '0') + '-' + (d.getDate() + '').padStart(2, '0');
      if (!set[fmt]) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }
  function renderStudyPanel(profileMeta) {
    var st = bswGet('studyTime', { today: 0, total: 0 });
    if (typeof st !== 'object' || st === null) st = { today: 0, total: 0 };
    var recitedArr = bswGet('recited', []);
    var recited = recitedArr.length;
    var fw = bswGet('feihuaBest', 0);
    if (typeof fw !== 'number') fw = 0;
    var days = bswGet('studyDays', []).length;
    var box = 'background:rgba(0,120,212,.08);border:1px solid rgba(0,120,212,.15);border-radius:8px;padding:14px 6px;text-align:center';
    var num = 'font-size:22px;font-weight:700;color:#0a84ff';
    var lab = 'font-size:12px;color:var(--sub);margin-top:4px';
    var cell = function (n, l) { return '<div style="' + box + '"><div style="' + num + '">' + n + '</div><div style="' + lab + '">' + l + '</div></div>'; };
    card.innerHTML =
      '<h2 class="ac-title">欢迎回来，' + escapeHtml(profileMeta.username) + '</h2>' +
      '<p class="ac-sub">你的学习数据概览</p>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0">' +
        cell(st.today || 0, '今日学习(分)') +
        cell(st.total || 0, '累计学习(分)') +
        cell(bswStreak(), '连续打卡(天)') +
        cell(days, '累计学习(天)') +
        cell(recited, '已背篇目') +
        cell(fw, '飞花令最佳(连)') +
      '</div>' +
      '<button class="ac-btn primary" id="acEnterBtn">进入应用</button>';
    card.querySelector('#acEnterBtn').onclick = function () { closeAndBoot(profileMeta); };
  }

  function cacheAccountIndex(name, file, username) {
    try {
      var idx = JSON.parse(localStorage.getItem('bsw_accountIndex') || '[]');
      if (!idx.some(function (a) { return a.file === file; })) {
        idx.push({ name: name, file: file, username: username });
        localStorage.setItem('bsw_accountIndex', JSON.stringify(idx));
      }
    } catch (e) {}
  }

  function loginWith(profileMeta) {
    api.read(profileMeta.file).then(function (obj) {
      if (!obj || typeof obj !== 'object') {
        showError('读取用户配置失败：配置文件为空或损坏。若反复出现，请重启 启动.bat 后重试。');
        return;
      }
      var meta = { name: profileMeta.name, file: profileMeta.file, username: obj.username || profileMeta.username, password: obj.password || '', createdAt: obj.createdAt };
      var needPw = !!(meta.password && meta.password.length > 0);
      if (needPw) {
        renderLogin(meta, obj);
      } else {
        afterLogin(meta, obj);
      }
    }).catch(function (e) { showError('读取用户配置失败：' + ((e && e.message) || '网络/服务不可用')); });
  }

  function renderLogin(meta, obj) {
    card.innerHTML =
      '<h2 class="ac-title">输入密码</h2>' +
      '<p class="ac-sub">' + escapeHtml(meta.username) + '（配置：' + escapeHtml(meta.name) + '）</p>' +
      '<div class="ac-field"><label>密码</label><input type="password" id="acPw" placeholder="请输入密码" autocomplete="current-password"></div>' +
      '<div class="ac-err"></div>' +
      '<button class="ac-btn primary" id="acLoginBtn">登录</button>' +
      '<button class="ac-btn ghost" id="acBack">返回</button>';
    card.querySelector('#acLoginBtn').onclick = function () {
      var pw = card.querySelector('#acPw').value;
      hashPassword(pw).then(function (hpw) {
        if (hpw === obj.password) {
          afterLogin(meta, obj);
        } else {
          showError('密码错误');
        }
      }).catch(function (e) { showError('密码校验异常：' + ((e && e.message) || e)); });
    };
    card.querySelector('#acBack').onclick = function () { renderPicker(); };
    setTimeout(function () { var i = card.querySelector('#acPw'); if (i) i.focus(); }, 50);
  }

  /* ===== 创建用户：三页流程 =====
     第 1 页：配置文件名称 + 用户名
     第 2 页：设置密码（可留空）
     第 3 页：二次确认密码 */
  function renderCreate() {
    card.innerHTML =
      '<h2 class="ac-title">创建用户（1/3）</h2>' +
      '<p class="ac-sub">为这个账户建立一个独立的配置文件（数据单独保存在 userdata 中）</p>' +
      '<div class="ac-field"><label>配置文件名称（仅英文/数字/下划线，作为文件名）</label>' +
      '<input type="text" id="acName" placeholder="例如 mystudy" autocomplete="off"></div>' +
      '<div class="ac-field"><label>用户名（可用中文）</label>' +
      '<input type="text" id="acUname" placeholder="例如 小明" autocomplete="off"></div>' +
      '<div class="ac-err"></div>' +
      '<button class="ac-btn primary" id="acNext1">下一步</button>' +
      '<button class="ac-btn ghost" id="acBack">返回</button>';
    card.querySelector('#acNext1').onclick = function () {
      var name = (card.querySelector('#acName').value || '').trim();
      var uname = (card.querySelector('#acUname').value || '').trim();
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) { showError('配置文件名称需以英文字母开头，仅含英文/数字/下划线'); return; }
      if (!uname) { showError('请填写用户名'); return; }
      renderCreatePw(name, uname);
    };
    card.querySelector('#acBack').onclick = function () { renderPicker(); };
    setTimeout(function () { var i = card.querySelector('#acName'); if (i) i.focus(); }, 50);
  }

  function renderCreatePw(name, uname) {
    card.innerHTML =
      '<h2 class="ac-title">设置密码（2/3）</h2>' +
      '<p class="ac-sub">用户名：' + escapeHtml(uname) + '（配置：' + escapeHtml(name) + '）</p>' +
      '<div class="ac-field"><label>密码（留空表示不设置密码）</label>' +
      '<input type="password" id="acPw" placeholder="留空则登录时无需密码" autocomplete="new-password"></div>' +
      '<div class="ac-hint">下一步需要再次输入密码进行确认，防止误设。</div>' +
      '<div class="ac-err"></div>' +
      '<button class="ac-btn primary" id="acNext2">下一步</button>' +
      '<button class="ac-btn ghost" id="acBack">返回上一步</button>';
    card.querySelector('#acNext2').onclick = function () {
      var pw = card.querySelector('#acPw').value;
      renderCreateConfirm(name, uname, pw);
    };
    card.querySelector('#acBack').onclick = function () { renderCreate(); };
    setTimeout(function () { var i = card.querySelector('#acPw'); if (i) i.focus(); }, 50);
  }

  function renderCreateConfirm(name, uname, pw) {
    card.innerHTML =
      '<h2 class="ac-title">确认密码（3/3）</h2>' +
      '<p class="ac-sub">请再次输入密码以确认无误</p>' +
      '<div class="ac-field"><label>再次输入密码</label>' +
      '<input type="password" id="acPw2" placeholder="与上一步输入的密码保持一致" autocomplete="new-password"></div>' +
      '<div class="ac-err"></div>' +
      '<button class="ac-btn primary" id="acCreateBtn">创建并进入</button>' +
      '<button class="ac-btn ghost" id="acBack">返回上一步</button>';
    card.querySelector('#acCreateBtn').onclick = function () {
      var pw2 = card.querySelector('#acPw2').value;
      if (pw2 !== pw) { showError('两次输入的密码不一致，请返回上一步重新设置'); return; }
      doCreate(name, uname, pw);
    };
    card.querySelector('#acBack').onclick = function () { renderCreatePw(name, uname); };
    setTimeout(function () { var i = card.querySelector('#acPw2'); if (i) i.focus(); }, 50);
  }

  function doCreate(name, username, password) {
    var file = 'profile_' + name + '.json';
    api.read(file).then(function (existing) {
      if (existing && existing.username) { showError('该配置文件名称已存在，请换一个'); return; }
      hashPassword(password).then(function (hpw) {
        var payload = { username: username, password: hpw, createdAt: new Date().toISOString(), data: {} };
        api.write(file, payload).then(function (r) {
          if (!r || !r.success) { showError('创建失败：' + ((r && r.error) || '未知错误') + '。请确认本地服务已启动。'); return; }
          cacheAccountIndex(name, file, username);
          afterLogin({ name: name, file: file, username: username, password: hpw, createdAt: payload.createdAt }, payload);
        }).catch(function (e) { showError('创建失败：' + ((e && e.message) || '网络/服务不可用')); });
      });
    }).catch(function (e) { showError('创建失败：' + ((e && e.message) || '网络/服务不可用')); });
  }

  function cacheAccountIndex(name, file, username) {
    try {
      var idx = JSON.parse(localStorage.getItem('bsw_accountIndex') || '[]');
      if (!idx.some(function (a) { return a.file === file; })) {
        idx.push({ name: name, file: file, username: username });
        localStorage.setItem('bsw_accountIndex', JSON.stringify(idx));
      }
    } catch (e) {}
  }

  // 账户列表缓存：各页“返回”回到选择页时使用
  var cachedAccounts = [];

  function renderPicker() {
    var accounts = cachedAccounts;
    var html = '<h2 class="ac-title">选择用户</h2>' +
      '<p class="ac-sub">欢迎回来，请选择账户登录</p>';
    if (!serverOk) {
      html += '<div style="background:rgba(229,72,77,.1);border:1px solid rgba(229,72,77,.35);color:#e5484d;border-radius:10px;padding:12px 14px;font-size:13px;margin-bottom:14px">' +
        '<b>⚠ 本地服务未连接</b><br>账户数据保存在本机，需通过 <b>Memorization UI\\setuptools\\start.bat</b> 启动服务后，从浏览器地址 <b>http://localhost:8000/app.html</b> 访问。当前页面无法读取/保存任何用户数据。</div>';
    }
    accounts.forEach(function (a) {
      html += '<button class="ac-user" data-name="' + escapeHtml(a.name) + '">' +
        '<div class="ac-avatar">' + escapeHtml((a.username || a.name).slice(0, 1)) + '</div>' +
        '<div><div class="ac-uname">' + escapeHtml(a.username || a.name) + '</div>' +
        '<div class="ac-pname">配置：' + escapeHtml(a.name) + '</div></div></button>';
    });
    html += '<div class="ac-divider">或</div>' +
      '<button class="ac-btn primary" id="acNew">+ 新建用户</button>' +
      '<div class="ac-err"></div>';
    card.innerHTML = html;
    var btns = card.querySelectorAll('.ac-user');
    for (var i = 0; i < btns.length; i++) {
      btns[i].onclick = function () {
        var nm = this.getAttribute('data-name');
        var meta = accounts.filter(function (x) { return x.name === nm; })[0];
        if (meta) loginWith(meta);
      };
    }
    card.querySelector('#acNew').onclick = function () { renderCreate(); };
  }

  function renderFirstCreate() {
    card.innerHTML =
      '<h2 class="ac-title">欢迎！</h2>' +
      '<p class="ac-sub">第一次使用，请先创建一份属于您的配置文件吧</p>' 
    renderCreateInto(card);
  }

  function renderCreateInto(c) {
    c.insertAdjacentHTML('beforeend',
      '<div class="ac-field"><label>配置您的文件名称（仅支持英文）</label>' +
      '<input type="text" id="acName" placeholder="例如 class6" autocomplete="off"></div>' +
      '<div class="ac-err"></div>' +
      '<div class="ac-field"><label>用户名</label>' +
      '<input type="text" id="acUname" placeholder="例如 李华" autocomplete="off"></div>' +
      '<div class="ac-field"><label>密码</label>' +
      '<input type="password" id="acPw" placeholder="留空表示不设置密码" autocomplete="new-password"></div>' +
      '<button class="ac-btn primary" id="acCreateBtn">创建并进入</button>');
    c.querySelector('#acCreateBtn').onclick = function () {
      var name = (c.querySelector('#acName').value || '').trim();
      var uname = (c.querySelector('#acUname').value || '').trim();
      var pw = c.querySelector('#acPw').value;
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) { showError('仅支持英文'); return; }
      if (!uname) { showError('请填写用户名'); return; }
      doCreate(name, uname, pw);
    };
    setTimeout(function () { var i = c.querySelector('#acName'); if (i) i.focus(); }, 50);
  }

  // 主动校验 userdata：账户列表只保留服务器上真实存在且可解析的配置文件，
  // 已被删除的账户同步从 localStorage 缓存索引中清除
  function purgeAccountIndex(valid) {
    try {
      var keep = valid.map(function (a) { return { name: a.name, file: a.file, username: a.username }; });
      localStorage.setItem('bsw_accountIndex', JSON.stringify(keep));
    } catch (e) {}
  }

  // 拉取账户列表
  var serverOk = true;
  api.list().then(function (res) {
    var files = res.files || [];
    serverOk = res.ok !== false;
    var profileFiles = files.filter(function (f) { return f.indexOf('profile_') === 0 && f.slice(-5) === '.json'; });
    if (profileFiles.length === 0) { purgeAccountIndex([]); renderFirstCreate(); return; }
    // 逐个读取校验：文件缺失/损坏的账户视为已删除
    Promise.all(profileFiles.map(function (f) {
      var name = f.slice('profile_'.length, -5);
      return api.read(f).then(function (obj) {
        if (!obj || !obj.username) return null;
        return { name: name, file: f, username: obj.username };
      }).catch(function () { return null; });
    })).then(function (accounts) {
      var valid = accounts.filter(Boolean);
      cachedAccounts = valid;
      purgeAccountIndex(valid);
      if (valid.length === 0) { renderFirstCreate(); return; }
      renderPicker();
    });
  }).catch(function () {
    renderFirstCreate();
  });
}

