function bootApp() {

  /* ===== STORE: localStorage 持久化 ===== */
  var Store = {
    get: function(key, def){
      try { var v = localStorage.getItem('bsw_'+key); return v===null ? def : JSON.parse(v); }
      catch(e){ return def; }
    },
    set: function(key, val){ try { localStorage.setItem('bsw_'+key, JSON.stringify(val)); } catch(e){} },
    getFont: function(){ return this.get('font', 16); },
    setFont: function(v){ this.set('font', v); },
    getAuthorFont: function(){ return this.get('authorFont', 16); },
    setAuthorFont: function(v){ this.set('authorFont', v); },
    getTheme: function(){ return this.get('theme','light'); },
    setTheme: function(v){ this.set('theme', v); },
    getLast: function(){ return this.get('last', null); },
    setLast: function(v){ this.set('last', v); },
    getScroll: function(id){ return this.get('scroll_'+id, 0); },
    setScroll: function(id, v){ this.set('scroll_'+id, v); },
    getAudio: function(id){ return this.get('audio_'+id, 0); },
    setAudio: function(id, v){ this.set('audio_'+id, v); },
    getRecited: function(){ return this.get('recited', []); },
    isRecited: function(id){ return this.getRecited().indexOf(id) >= 0; },
    toggleRecited: function(id){
      var r = this.getRecited(); var i = r.indexOf(id);
      if(i>=0){ r.splice(i,1); } else { r.push(id); }
      this.set('recited', r); return i<0;
    },
    getSpeed: function(){ return this.get('audiospeed', 1); },
    setSpeed: function(v){ this.set('audiospeed', v); },
    getLoop: function(){ return this.get('audioloop', false); },
    setLoop: function(v){ this.set('audioloop', v); },
    getWallpaper: function(){ return this.get('wallpaper', {current:'background.png', rotate:false, interval:30, index:0}); },
    setWallpaper: function(v){ this.set('wallpaper', v); },
    getAIConfig: function(){ return this.get('aiConfig', {apiUrl:'', apiKey:'', model:'', quizType:'any'}); },
    setAIConfig: function(v){ this.set('aiConfig', v); },
    /* 学习时间统计 */
    getStudyTime: function(){ return this.get('studyTime', {today:0}); },
    addStudyTime: function(min){
      var t = this.getStudyTime();
      if (typeof t !== 'object' || t === null) t = {today:0};
      t.today = (t.today || 0) + min;
      this.set('studyTime', t);
      var today = new Date();
      var fmt = today.getFullYear() + '-' + ((today.getMonth()+1)+'').padStart(2,'0') + '-' + (today.getDate()+'').padStart(2,'0');
      var days = this.get('studyDays', []);
      if (days.indexOf(fmt) < 0) { days.push(fmt); this.set('studyDays', days); }
    },
    /* 连续学习天数（从昨天往前数） */
    getStreak: function(){
      var days = this.get('studyDays', []);
      var set = {};
      for (var i=0;i<days.length;i++) set[days[i]] = 1;
      var streak = 0;
      var d = new Date();
      d.setDate(d.getDate() - 1);
      while (true) {
        var fmt = d.getFullYear() + '-' + ((d.getMonth()+1)+'').padStart(2,'0') + '-' + (d.getDate()+'').padStart(2,'0');
        if (!set[fmt]) break;
        streak++;
        d.setDate(d.getDate() - 1);
      }
      return { days: streak };
    },
    /* 打卡：把今天记入学习日列表（幂等）。
       修复方案 V2 P0-1b：原代码在 3 处调用未定义的 updateStreak 导致 TypeError */
    updateStreak: function(){
      var t = new Date();
      var fmt = t.getFullYear() + '-' + ((t.getMonth()+1)+'').padStart(2,'0') + '-' + (t.getDate()+'').padStart(2,'0');
      var days = this.get('studyDays', []);
      if (days.indexOf(fmt) < 0) { days.push(fmt); this.set('studyDays', days); }
      return this.getStreak();
    },
    getLastState: function(){ return this.get('lastState', null); },
    setLastState: function(s){ this.set('lastState', s); }
  };

  /* ===== USERDATA: 文件存储层（桌面端持久化） ===== */
  var UserDataAPI = {
    PREF_FILE: 'preferences.json',
    AI_FILE: 'ai_config.json',
    QUESTIONS_FILE: 'ai_questions.json',

    _cache: null,

    _url: function(name){ return '/api/userdata/file/' + encodeURIComponent(name); },

    read: function(name){
      return fetch(this._url(name)).then(function(r){ return r.json(); });
    },

    write: function(name, data){
      return fetch(this._url(name), {
        method: 'POST',
        headers: {'Content-Type': 'application/json; charset=utf-8'},
        body: JSON.stringify({data: data})
      }).then(function(r){ return r.json(); });
    },

    remove: function(name){
      return fetch(this._url(name), {method: 'DELETE'}).then(function(r){ return r.json(); });
    },

    // Flush a specific Store key to its userdata file
    syncKey: function(key, val){
      var fileMap = {
        'aiConfig': 'ai_config.json',
        'theme': 'preferences.json',
        'font': 'preferences.json',
        'authorFont': 'preferences.json',
        'wallpaper': 'preferences.json'
      };
      var fname = fileMap[key];
      if (!fname) return Promise.resolve();

      // Read existing, merge, write back
      return this.read(fname).then(function(result){
        var obj = (result && result.data) ? result.data : {};
        if (typeof obj !== 'object') obj = {};
        obj[key] = val;
        return UserDataAPI.write(fname, obj);
      }).catch(function(){
        var obj = {};
        obj[key] = val;
        return UserDataAPI.write(fname, obj);
      });
    },

    // Hydrate localStorage from userdata files on startup
    hydrate: function(){
      var self = this;
      var keys = {
        'ai_config.json': ['aiConfig'],
        'preferences.json': ['theme', 'font', 'authorFont', 'wallpaper']
      };
      var promises = [];
      Object.keys(keys).forEach(function(fname){
        promises.push(self.read(fname).then(function(result){
          if (!result || !result.data) return;
          var data = result.data;
          var mapped = keys[fname];
          mapped.forEach(function(k){
            if (data[k] !== undefined) {
              localStorage.setItem('bsw_' + k, JSON.stringify(data[k]));
            }
          });
        }).catch(function(){}));
      });
      return Promise.all(promises);
    }
  };

  // 暴露到全局，供 OOBE 等顶层 IIFE 访问
  window.UserDataAPI = UserDataAPI;

  // 把 Store.set 改为：写入 localStorage 后，逐步把当前用户数据写入其 JSON 配置文件。
  // 关键数据（AI 配置、错题本、AI 题库、练习统计、已背诵、复习卡）立即落盘，
  // 其余高频键（学习时长、滚动/音频进度等）走 700ms 防抖，避免频繁写文件。
  var _CRITICAL_KEYS = { aiConfig:1, wrongbook:1, aiQuestions:1, practiceStats:1, recited:1, reviewCards:1, dailyStats:1, feihuaBest:1 };
  var _origStoreSet = Store.set.bind(Store);
  Store.set = function(key, val){
    _origStoreSet(key, val);
    if (_CRITICAL_KEYS[key]) flushProfileSave();
    else scheduleProfileSave();
  };

  // 账户登录时已把该用户 profile 载入 localStorage；此处直接套用主题即可
  try {
    var theme = Store.getTheme();
    document.documentElement.setAttribute('data-theme', theme);
  } catch(e){}

  /* ===== 右上角通知系统（Windows 10 风格统一堆叠区） =====
     所有提示（自动消失的 showToast + 常驻的 pushNotice）都进入同一个
     固定在右上角的 notice-rail：从右侧滑入、带左侧主色指示条、可单条关闭或一键清除全部。 */
  function getNoticeRail(){
    var rail = document.getElementById('noticeRail');
    if (!rail) {
      rail = document.createElement('div');
      rail.id = 'noticeRail';
      rail.className = 'notice-rail';
      rail.setAttribute('aria-live', 'polite');
      document.body.appendChild(rail);
      var clearAll = document.createElement('button');
      clearAll.type = 'button';
      clearAll.className = 'notice-clear-all';
      clearAll.textContent = '清除全部';
      clearAll.onclick = function(){
        var items = rail.querySelectorAll('.notice-item');
        for (var i = 0; i < items.length; i++) items[i].remove();
        refreshClearAll();
      };
      rail._clearAll = clearAll;
      rail.appendChild(clearAll);
    }
    return rail;
  }

  function refreshClearAll(){
    var r = document.getElementById('noticeRail');
    if (!r) return;
    var hasItems = r.querySelectorAll('.notice-item').length > 0;
    if (r._clearAll) r._clearAll.style.display = hasItems ? '' : 'none';
  }

  function buildNotice(msg, type, autoMs){
    var item = document.createElement('div');
    item.className = 'notice-item' + (type ? ' ' + type : '');
    var span = document.createElement('span');
    span.className = 'notice-text';
    span.textContent = msg;
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'notice-close';
    close.title = '清除本消息';
    close.setAttribute('aria-label', '清除本消息');
    close.textContent = '×';
    item.appendChild(span);
    item.appendChild(close);
    var timer = null;
    function kill(){ if (timer) { clearTimeout(timer); timer = null; } item.remove(); refreshClearAll(); }
    close.onclick = kill;
    if (autoMs && autoMs > 0) timer = setTimeout(kill, autoMs);
    return item;
  }

  /* 常驻确认类提示：添加到背诵 / 加入错题本等；7 秒后自动收回，也可手动关闭 */
  function pushNotice(msg, type){
    if (type === 'error') { showErrorAlert(msg); return; }
    var rail = getNoticeRail();
    var item = buildNotice(msg, type, 7000);
    rail.insertBefore(item, rail.firstChild);
    refreshClearAll();
  }

  /* 自动消失提示：3 秒后淡出移除，与 pushNotice 共用同一右上角堆叠区 */
  function showToast(msg, type){
    if (type === 'error') { showErrorAlert(msg); return; }
    var rail = getNoticeRail();
    var item = buildNotice(msg, type, 3000);
    rail.insertBefore(item, rail.firstChild);
    refreshClearAll();
  }

  /* 红色警告：屏幕中央大提示（参考 Windows 11 低电量提醒），不自动熄灭，需手动关闭 */
  function showErrorAlert(msg){
    var overlay = document.getElementById('errorAlertOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'errorAlertOverlay';
      overlay.className = 'error-alert-overlay';
      overlay.innerHTML = '<div class="error-alert">' +
        '<div class="error-alert-icon">!</div>' +
        '<div class="error-alert-body"><div class="error-alert-title">警告</div>' +
        '<div class="error-alert-msg"></div></div>' +
        '<button class="error-alert-close" type="button" title="关闭" aria-label="关闭">×</button>' +
        '</div>';
      overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.remove(); });
      overlay.querySelector('.error-alert-close').addEventListener('click', function(){ overlay.remove(); });
      document.body.appendChild(overlay);
    }
    overlay.querySelector('.error-alert-msg').textContent = msg;
  }
  function findArt(id){ for(var i=0;i<D.length;i++){ if(D[i].id===id) return D[i]; } return null; }
  function getArticleDifficulty(article){
    return '';
  }

  /* ===== STATE ===== */
  var cur = D[0];
  var playing = false;
  var viewMode = 'art';
  var systemMode = 'learn';
  var sidebarTab = 'art';
  var bodyFontSize = Store.getFont();
  var authorDetailFontSize = Store.getAuthorFont();
  var currentAuthor = null;
  var currentDynasty = null;
  var hlKw = '';
  var audioEl = new Audio();
  audioEl.preload = 'metadata';

  /* ===== DOM ===== */
  var greet = document.getElementById('greet');
  var searchIn = document.getElementById('searchIn');
  var navEl = document.getElementById('nav');
  var moreBtn = document.getElementById('moreBtn');
  var modeBtn1 = document.getElementById('modeBtn1');
  var modeBtn2 = document.getElementById('modeBtn2');
  var modeBtn3 = document.getElementById('modeBtn3');
  var modeIndicator = document.getElementById('modeIndicator');
  var modeIndicatorText = document.getElementById('modeIndicatorText');
  var themeBtn = document.getElementById('themeBtn');
  var viewArt = document.getElementById('viewArt');
  var viewAuthors = document.getElementById('viewAuthors');
  var viewAuthorDetail = document.getElementById('viewAuthorDetail');
  var viewDynasty = document.getElementById('viewDynasty');
  var viewExample = document.getElementById('viewExample');
  var viewAbout = document.getElementById('viewAbout');
  var viewWordGame = document.getElementById('viewWordGame');
  var searchWrap = document.getElementById('searchWrap');
  var fsCtrl = document.getElementById('fsCtrl');
  var artTitle = document.getElementById('artTitle');
  var artAuthor = document.getElementById('artAuthor');
  var artBody = document.getElementById('artBody');
  var searchNav = document.getElementById('searchNav');
  var hlCount = document.getElementById('hlCount');
  var contentArea = document.getElementById('contentArea');
  var btnPP = document.getElementById('btnPP');
  var btnRW = document.getElementById('btnRW');
  var btnFF = document.getElementById('btnFF');
  var speedBtn = document.getElementById('speedBtn');
  var loopBtn = document.getElementById('loopBtn');
  var pTitle = document.getElementById('pTitle');
  var pFill = document.getElementById('pFill');
  var tCur = document.getElementById('tCur');
  var tTotal = document.getElementById('tTotal');
  var pTrack = document.getElementById('pTrack');
  var authorGrid = document.getElementById('authorGrid');
  var dynastyGrid = document.getElementById('dynastyGrid');

  /* ===== GREETING (四段修复) ===== */
  var hour = new Date().getHours();
  var greetMsg;
  if(hour>=5 && hour<10) greetMsg='早上好。';
  else if(hour>=10 && hour<13) greetMsg='中午好。';
  else if(hour>=13 && hour<18) greetMsg='下午好。';
  else greetMsg='晚上好。';
  greet.textContent = greetMsg;

  /* ===== THEME ===== */
  function applyTheme(){
    var dark = Store.getTheme()==='dark';
    document.body.classList.toggle('dark', dark);
    document.getElementById('themeIco').className = 'ico ' + (dark ? 'ico-night' : 'ico-sun');
  }
  themeBtn.onclick = function(){
    Store.setTheme(Store.getTheme()==='dark' ? 'light' : 'dark');
    applyTheme();
  };

  /* ===== WALLPAPER ===== */
  var wpState = Store.getWallpaper();
  var wpFiles = [];
  var wpTimer = null;
  var wpUploadInput = document.getElementById('wpUploadInput');
  var wpUploadBtn = document.getElementById('wpUploadBtn');
  var wpList = document.getElementById('wpList');
  var wpRotate = document.getElementById('wpRotate');
  var wpInterval = document.getElementById('wpInterval');
  var wpStatus = document.getElementById('wpStatus');

  function wallpaperPath(filename){
    return 'resource/background/' + encodeURIComponent(filename);
  }

  function applyWallpaper(filename){
    if (!filename) filename = 'background.png';
    document.body.style.setProperty('--wallpaper-url', 'url(' + wallpaperPath(filename) + ')');
    wpState.current = filename;
    Store.setWallpaper(wpState);
    renderWpList();
  }

  function startWallpaperTimer(){
    stopWallpaperTimer();
    if (!wpState.rotate || wpFiles.length <= 1) return;
    var ms = Math.max(1, parseInt(wpState.interval, 10) || 30) * 60 * 1000;
    wpTimer = setInterval(function(){
      var idx = wpFiles.indexOf(wpState.current);
      if (idx < 0) idx = 0;
      idx = (idx + 1) % wpFiles.length;
      applyWallpaper(wpFiles[idx]);
    }, ms);
  }

  function stopWallpaperTimer(){
    if (wpTimer) { clearInterval(wpTimer); wpTimer = null; }
  }

  function saveWallpaperSettings(){
    wpState.rotate = wpRotate.checked;
    wpState.interval = parseInt(wpInterval.value, 10) || 30;
    Store.setWallpaper(wpState);
    startWallpaperTimer();
  }

  function renderWpList(){
    if (!wpList) return;
    if (wpFiles.length === 0) {
      wpList.innerHTML = '<div class="wp-empty">暂无自定义壁纸，请点击上方上传</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < wpFiles.length; i++) {
      var f = wpFiles[i];
      var active = f === wpState.current ? ' active' : '';
      html += '<div class="wallpaper-thumb' + active + '" data-file="' + escapeHtml(f) + '">';
      html += '<img src="' + wallpaperPath(f) + '" alt="' + escapeHtml(f) + '" loading="lazy">';
      html += '<button class="wp-del" data-del="' + escapeHtml(f) + '" title="删除">×</button>';
      html += '</div>';
    }
    wpList.innerHTML = html;
  }

  function loadWallpaperList(){
    fetch('/api/wallpapers')
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.success) {
          wpFiles = data.files;
          if (wpFiles.length > 0 && wpFiles.indexOf(wpState.current) < 0) {
            applyWallpaper(wpFiles[0]);
          } else {
            renderWpList();
          }
          startWallpaperTimer();
        } else {
          wpStatus.textContent = '壁纸列表加载失败：' + (data.error || '未知错误');
        }
      })
      .catch(function(e){
        wpStatus.textContent = '壁纸功能需要运行 setup\\start.bat';
      });
  }

  function uploadWallpaper(file){
    if (!file) return;
    wpStatus.textContent = '正在上传…';
    var reader = new FileReader();
    reader.onerror = function(){
      wpStatus.textContent = '读取图片失败';
    };
    reader.onload = function(e){
      var dataUrl = e.target.result;
      fetch('/api/upload-wallpaper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ filename: file.name, data: dataUrl })
      })
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.success) {
          wpStatus.textContent = '上传成功：' + data.filename;
          applyWallpaper(data.filename);
          loadWallpaperList();
          setTimeout(function(){ location.reload(); }, 600);
        } else {
          wpStatus.textContent = '上传失败：' + (data.error || '未知错误');
        }
      })
      .catch(function(e){
        wpStatus.textContent = '上传失败，请确认已通过 setup\\start.bat 启动服务';
      });
    };
    reader.readAsDataURL(file);
  }

  function deleteWallpaper(filename){
    if (!filename) return;
    if (!confirm('确定删除壁纸「' + filename + '」吗？')) return;
    fetch('/api/wallpapers/' + encodeURIComponent(filename), { method: 'DELETE' })
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.success) {
          if (wpState.current === filename && wpFiles.length > 1) {
            var idx = wpFiles.indexOf(filename);
            var next = wpFiles[(idx + 1) % wpFiles.length];
            if (next === filename) next = wpFiles[0];
            applyWallpaper(next);
          }
          loadWallpaperList();
        } else {
          wpStatus.textContent = '删除失败：' + (data.error || '未知错误');
        }
      })
      .catch(function(e){
        wpStatus.textContent = '删除失败，请确认已通过 setup\\start.bat 启动服务';
      });
  }

  if (wpUploadBtn && wpUploadInput) {
    wpUploadBtn.onclick = function(){ wpUploadInput.click(); };
    wpUploadInput.onchange = function(){
      if (this.files && this.files[0]) uploadWallpaper(this.files[0]);
      this.value = '';
    };
  }

  if (wpList) {
    wpList.onclick = function(e){
      var target = e.target;
      var delFile = target.getAttribute('data-del');
      if (delFile) { e.stopPropagation(); deleteWallpaper(delFile); return; }
      var thumb = target.closest('.wallpaper-thumb');
      if (thumb) {
        var file = thumb.getAttribute('data-file');
        if (file) applyWallpaper(file);
      }
    };
  }

  if (wpRotate) wpRotate.onchange = saveWallpaperSettings;
  if (wpInterval) wpInterval.onchange = saveWallpaperSettings;

  // 初始化
  applyWallpaper(wpState.current);
  wpRotate.checked = !!wpState.rotate;
  wpInterval.value = Math.max(1, parseInt(wpState.interval, 10) || 30);
  loadWallpaperList();

  /* ===== UTILS ===== */
  function formatTime(sec) {
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function throttle(fn, ms){
    var last=0, timer=null;
    return function(){
      var ctx=this, args=arguments, now=Date.now();
      var rem = ms - (now-last);
      if(rem<=0){ last=now; if(timer){ clearTimeout(timer); timer=null; } fn.apply(ctx,args); }
      else if(!timer){ timer=setTimeout(function(){ last=Date.now(); timer=null; fn.apply(ctx,args); }, rem); }
    };
  }
  function escapeReg(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function debounce(fn, ms){
    var timer = null;
    return function(){
      var ctx = this, args = arguments;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function(){ timer = null; fn.apply(ctx, args); }, ms);
    };
  }

  function hideAllViews() {
    var views = [viewArt, viewAuthors, viewAuthorDetail, viewDynasty, viewExample, viewAbout, viewWordGame];
    for (var i = 0; i < views.length; i++) { if (views[i]) views[i].classList.add('hidden'); }
    var headBtns = document.querySelector('.art-head-btns');
    if (headBtns) headBtns.classList.add('hidden');
    // 离开文章视图时移除玻璃背景
    var artSplitEl = document.getElementById('artSplit');
    if (artSplitEl) artSplitEl.classList.remove('glass-article');
    var btns = navEl.querySelectorAll('.sbtn');
    for (var j = 0; j < btns.length; j++) btns[j].classList.remove('sel');
    if (moreBtn) moreBtn.classList.remove('sel');
    if (fsCtrl) {
      if (viewMode === 'art' || viewMode === 'authorDetail') fsCtrl.classList.remove('hidden');
      else fsCtrl.classList.add('hidden');
    }
    if (authorTtsBtn) {
      authorTtsBtn.style.display = (viewMode === 'authorDetail') ? 'flex' : 'none';
    }
    if (typeof clearFeihuaTimer === 'function') clearFeihuaTimer();
  }

  function showWordGame() {
    hideAllViews();
    viewWordGame.classList.remove('hidden');
    viewMode = 'wordGame';
    if (wordQuestions.length === 0) {
      loadWordGameData(function() { renderWordGameIntro(); });
    } else {
      renderWordGameIntro();
    }
  }

  /* ===== SYSTEM MODE SELECTOR (下拉选择) ===== */
  var modeSelectorMenu = document.getElementById('modeSelectorMenu');
  var modeSelectorItems = modeSelectorMenu.querySelectorAll('.mode-selector-item');

  // 点击外部关闭下拉菜单
  document.addEventListener('click', function(e) {
    if (!modeSelectorMenu.classList.contains('open')) return;
    if (!e.target.closest('.mode-selector-wrap')) modeSelectorMenu.classList.remove('open');
  });

  // 点击按钮打开/关闭下拉菜单
  modeIndicator.addEventListener('click', function(e) {
    e.stopPropagation();
    modeSelectorMenu.classList.toggle('open');
  });

  // 模式名称映射
  var modeNames = { 'learn': '文章', 'word': '字词', 'practice': '语法', 'exercise': '练习' };

  // 统一切换系统模式
  function setSystemMode(newMode) {
    systemMode = newMode;
    modeSelectorMenu.classList.remove('open');
    modeIndicatorText.textContent = modeNames[newMode];
    
    // 更新下拉选项激活状态
    modeSelectorItems.forEach(function(it) {
      it.classList.toggle('active', it.dataset.systemMode === newMode);
    });

    modeBtn3.classList.add('hidden');
    modeBtn2.classList.remove('disabled');
    
    if (newMode === 'learn') {
      modeBtn1.textContent = '篇目';
      modeBtn2.textContent = '作家';
      searchIn.placeholder = '搜索篇目';
      modeBtn1.classList.remove('hidden');
      modeBtn2.classList.remove('hidden');
      searchIn.classList.remove('hidden');
      searchWrap.classList.remove('hidden');
      sidebarTab = 'art';
    } else if (newMode === 'practice') {
      modeBtn1.textContent = '句式';
      modeBtn2.textContent = '词类活用';
      searchIn.placeholder = '搜索句式';
      modeBtn1.classList.remove('hidden');
      modeBtn2.classList.remove('hidden');
      searchIn.classList.remove('hidden');
      searchWrap.classList.remove('hidden');
      sidebarTab = 'jushi';
    } else if (newMode === 'exercise') {
      modeBtn1.classList.add('hidden');
      modeBtn2.classList.add('hidden');
      searchIn.placeholder = '';
      searchIn.classList.add('hidden');
      searchWrap.classList.add('hidden');
      sidebarTab = 'exType';
    } else if (newMode === 'word') {
      modeBtn1.textContent = '虚词';
      modeBtn2.textContent = '实词';
      modeBtn1.classList.remove('hidden');
      modeBtn2.classList.remove('hidden');
      modeBtn2.classList.add('disabled');
      modeBtn3.classList.add('hidden');
      searchIn.placeholder = '';
      searchIn.classList.add('hidden');
      searchWrap.classList.add('hidden');
      sidebarTab = 'word';
    }
    
    modeBtn1.classList.add('active');
    modeBtn2.classList.remove('active');
    searchIn.value = '';
    hlKw = '';
    searchNav.classList.add('hidden');
    TTS.stop();
    renderSidebar();

    if (newMode === 'learn') {
      selectArticle(cur.id);
    } else if (newMode === 'practice') {
      showPlaceholder('点击左侧分类查看实例', '句式与词类活用', '从收录课文中精选典型例句');
    } else if (newMode === 'exercise') {
      showPlaceholder('选择练习类型开始', '互动练习', '填空默写 · 上下句对接 · 情境默写 · 飞花令');
    } else if (newMode === 'word') {
      showWordGame();
    }
  }

  // 绑定下拉选项点击事件
  modeSelectorItems.forEach(function(it) {
    it.addEventListener('click', function() {
      setSystemMode(it.dataset.systemMode);
    });
  });

  /* ===== RENDER: Sidebar ===== */
  function renderSidebar() {
    if (systemMode === 'learn') {
      if (sidebarTab === 'art') renderArticleNav();
      else renderDynastyNav();
    } else if (systemMode === 'exercise') {
      if (sidebarTab === 'exArt') {
        renderExArtNav();
      } else {
        renderExerciseNav();
      }
    } else if (systemMode === 'word') {
      renderWordNav();
    } else if (sidebarTab === 'jushi') {
      renderJushiNav();
    } else {
      renderCileiNav();
    }
  }

  var WORD_LIST = ['而','何','乎','乃','其','且','若','所','为','焉','也','以','因','于','与','则','者','之'];

  var WORD_DEFS = {
    '而': [
      { meaning: '表并列，而且', example: '蟹六跪而二螯（《劝学》）' },
      { meaning: '表转折，却', example: '青，取之于蓝，而青于蓝（《劝学》）' },
      { meaning: '表承接，就', example: '余方心动欲还，而大声发于水上（《石钟山记》）' },
      { meaning: '表修饰，地', example: '吾尝终日而思矣（《劝学》）' }
    ],
    '何': [
      { meaning: '疑问代词，什么', example: '大王来何操？（《鸿门宴》）' },
      { meaning: '疑问代词，哪里', example: '欲何之？（《逍遥游》）' },
      { meaning: '疑问副词，怎么', example: '君美甚，徐公何能及君也？（《邹忌讽齐王纳谏》）' },
      { meaning: '固定结构，怎么样', example: '今日之事何如？（《赤壁之战》）' }
    ],
    '乎': [
      { meaning: '语气词，表疑问', example: '壮士，能复饮乎？（《鸿门宴》）' },
      { meaning: '语气词，表反问', example: '学而时习之，不亦说乎？（《论语》）' },
      { meaning: '形容词词尾', example: '浩浩乎如冯虚御风（《赤壁赋》）' },
      { meaning: '介词，在', example: '相与枕藉乎舟中（《赤壁赋》）' }
    ],
    '乃': [
      { meaning: '副词，于是', example: '项伯乃夜驰之沛公军（《鸿门宴》）' },
      { meaning: '副词，才', example: '度我至军中，公乃入（《鸿门宴》）' },
      { meaning: '代词，你的', example: '家祭无忘告乃翁（《示儿》）' },
      { meaning: '副词，竟然', example: '今其智乃反不能及（《师说》）' }
    ],
    '其': [
      { meaning: '代词，他（的）', example: '吾视其辙乱（《曹刿论战》）' },
      { meaning: '代词，那', example: '其远而无所至极邪？（《逍遥游》）' },
      { meaning: '副词，难道', example: '其孰能讥之乎？（《游褒禅山记》）' },
      { meaning: '连词，如果', example: '其业有不精，德有不成者（《送东阳马生序》）' }
    ],
    '且': [
      { meaning: '连词，而且', example: '河水清且涟猗（《伐檀》）' },
      { meaning: '连词，尚且', example: '臣死且不避，卮酒安足辞！（《鸿门宴》）' },
      { meaning: '副词，暂且', example: '且放白鹿青崖间（《梦游天姥吟留别》）' },
      { meaning: '副词，将近', example: '北山愚公者，年且九十（《愚公移山》）' }
    ],
    '若': [
      { meaning: '连词，如果', example: '若使烛之武见秦君，师必退（《烛之武退秦师》）' },
      { meaning: '连词，至于', example: '若至于幽暗昏惑而无物以相之（《游褒禅山记》）' },
      { meaning: '代词，你', example: '若入前为寿（《鸿门宴》）' },
      { meaning: '动词，像', example: '天涯若比邻（《送杜少府之任蜀州》）' }
    ],
    '所': [
      { meaning: '助词，……的人/事物', example: '道之所存，师之所存也（《师说》）' },
      { meaning: '助词，……的地方', example: '成所居屋（《聊斋志异》）' },
      { meaning: '与"以"连用，……的原因', example: '此臣所以报先帝而忠陛下之职分也（《出师表》）' },
      { meaning: '与"为"连用，表被动', example: '为秦人积威之所劫（《六国论》）' }
    ],
    '为': [
      { meaning: '介词，被', example: '为天下笑（《过秦论》）' },
      { meaning: '介词，替', example: '为君翻作《琵琶行》（《琵琶行》）' },
      { meaning: '动词，做', example: '温故而知新，可以为师矣（《论语》）' },
      { meaning: '语气词，呢', example: '何以伐为？（《季氏将伐颛臾》）' }
    ],
    '焉': [
      { meaning: '兼词，于此', example: '积土成山，风雨兴焉（《劝学》）' },
      { meaning: '代词，它', example: '以俟夫观人风者得焉（《捕蛇者说》）' },
      { meaning: '代词，哪里', example: '且焉置土石？（《愚公移山》）' },
      { meaning: '语气词，了', example: '至丹以荆卿为计，始速祸焉（《六国论》）' }
    ],
    '也': [
      { meaning: '语气词，表判断', example: '廉颇者，赵之良将也（《廉颇蔺相如列传》）' },
      { meaning: '语气词，表肯定', example: '吾生也有涯，而知也无涯（《庄子》）' },
      { meaning: '语气词，表陈述', example: '臣之所好者道也（《庖丁解牛》）' },
      { meaning: '语气词，表感叹', example: '善哉！技盖至此乎？（《庖丁解牛》）' }
    ],
    '以': [
      { meaning: '介词，用', example: '以故其后名之曰"褒禅"（《游褒禅山记》）' },
      { meaning: '介词，因为', example: '不以物喜，不以己悲（《岳阳楼记》）' },
      { meaning: '连词，来', example: '作《师说》以贻之（《师说》）' },
      { meaning: '连词，表结果', example: '日削月割，以趋于亡（《六国论》）' }
    ],
    '因': [
      { meaning: '介词，凭借', example: '因河为池（《过秦论》）' },
      { meaning: '介词，通过', example: '因宾客至蔺相如门谢罪（《廉颇蔺相如列传》）' },
      { meaning: '连词，因为', example: '因造玉清宫，伐山取材（《雁荡山》）' },
      { meaning: '副词，于是', example: '项王即日因留沛公与饮（《鸿门宴》）' }
    ],
    '于': [
      { meaning: '介词，在', example: '游于赤壁之下（《赤壁赋》）' },
      { meaning: '介词，对', example: '于其身也，则耻师焉（《师说》）' },
      { meaning: '介词，比', example: '师不必贤于弟子（《师说》）' },
      { meaning: '介词，被', example: '不拘于时（《师说》）' }
    ],
    '与': [
      { meaning: '连词，和', example: '吾与子渔樵于江渚之上（《赤壁赋》）' },
      { meaning: '介词，和', example: '沛公军霸上，未得与项羽相见（《鸿门宴》）' },
      { meaning: '语气词，吗（通"欤"）', example: '岂曰无衣？与子同袍（《诗经》）' },
      { meaning: '动词，结交', example: '与嬴而不助五国也（《六国论》）' }
    ],
    '则': [
      { meaning: '连词，就', example: '每闻琴瑟之声，则应节而舞（《促织》）' },
      { meaning: '连词，却', example: '臣知欺大王之罪当诛，臣请就汤镬（《廉颇蔺相如列传》）' },
      { meaning: '副词，就是', example: '此则岳阳楼之大观也（《岳阳楼记》）' },
      { meaning: '连词，如果', example: '则有责作奸犯科及为忠善者（《出师表》）' }
    ],
    '者': [
      { meaning: '助词，……的人', example: '古之学者必有师（《师说》）' },
      { meaning: '助词，……的事物', example: '逝者如斯夫，不舍昼夜（《论语》）' },
      { meaning: '助词，表停顿', example: '廉颇者，赵之良将也（《廉颇蔺相如列传》）' },
      { meaning: '助词，定语后置标志', example: '太子及宾客知其事者（《荆轲刺秦王》）' }
    ],
    '之': [
      { meaning: '助词，的', example: '此非孟德之诗乎？（《赤壁赋》）' },
      { meaning: '助词，取独', example: '师道之不传也久矣（《师说》）' },
      { meaning: '代词，他/它', example: '作《师说》以贻之（《师说》）' },
      { meaning: '动词，到', example: '项伯乃夜驰之沛公军（《鸿门宴》）' }
    ]
  };

  function renderWordNav() {
    var html = '<div class="sec-label"><span>18 个文言虚词</span></div>';
    html += '<button class="nav-child" id="navAIGenAll" style="color:var(--pri);font-weight:600">✨ AI 针对全部虚词出题</button>';
    for (var i = 0; i < WORD_LIST.length; i++) {
      html += '<button class="sbtn" data-word="' + WORD_LIST[i] + '" title="点击跳转内置题目 · 右键 AI 针对该虚词出题">' + WORD_LIST[i] + '</button>';
    }
    navEl.innerHTML = html;
    var aiAllBtn = document.getElementById('navAIGenAll');
    if (aiAllBtn) aiAllBtn.onclick = function() { startAIWordGame(null); };
    var btns = navEl.querySelectorAll('.sbtn[data-word]');
    for (var bi = 0; bi < btns.length; bi++) {
      (function(btn) {
        btn.onclick = function() {
          var w = btn.getAttribute('data-word');
          // 高亮当前选中的虚词按钮（与朝代按钮同款橙色渐变）
          var all = navEl.querySelectorAll('.sbtn[data-word]');
          for (var k = 0; k < all.length; k++) all[k].classList.remove('dynasty-sel');
          btn.classList.add('dynasty-sel');
          renderWordCard(w);
        };
        btn.oncontextmenu = function(e) {
          e.preventDefault();
          var w = btn.getAttribute('data-word');
          startAIWordGame(w);
        };
      })(btns[bi]);
    }
  }

  function renderWordCard(word) {
    var defs = WORD_DEFS[word];
    if (!defs || defs.length === 0) {
      showToast('暂无该虚词的释义数据', 'error');
      return;
    }
    var html = '<div class="word-card">';
    html += '<div class="word-card-left">';
    html += '<div class="word-game-word">' + word + '</div>';
    html += '</div>';
    html += '<div class="word-card-right">';
    for (var i = 0; i < defs.length; i++) {
      html += '<div class="word-card-meaning">';
      html += '<div class="word-card-meaning-text">' + (i + 1) + '. ' + escapeHtml(defs[i].meaning) + '</div>';
      html += '<div class="word-card-example">' + escapeHtml(defs[i].example) + '</div>';
      html += '</div>';
    }
    html += '</div>';
    html += '<div class="word-card-footer"><button class="word-card-btn" id="wordCardGameBtn">词卡练习👏</button></div>';
    html += '</div>';
    hideAllViews();
    viewWordGame.classList.remove('hidden');
    viewMode = 'wordGame';
    viewWordGame.innerHTML = html;
    glassWordGame(viewWordGame);
    document.getElementById('wordCardGameBtn').onclick = function() {
      var idx = -1;
      var qs = (window._origWordQuestions && window._origWordQuestions.length > 0) ? window._origWordQuestions : wordQuestions;
      for (var k = 0; k < qs.length; k++) {
        if (qs[k].focusWord === word) { idx = k; break; }
      }
      if (idx >= 0) {
        if (window._origWordQuestions) wordQuestions = window._origWordQuestions.slice();
        wordCurrentIdx = idx;
        wordScore = 0;
        renderWordQuestion();
      } else {
        showToast('该虚词暂无内置题目', 'error');
      }
    };
  }

  function renderArticleNav() {
    var html = '';
    var cats = [{key:'wenyanwen', label:'文言文'}, {key:'gushici', label:'古诗词'}];
    for (var c = 0; c < cats.length; c++) {
      html += '<div class="sec-label" data-cat="' + cats[c].key + '"><span>' + cats[c].label + '</span></div>';
      for (var i = 0; i < D.length; i++) {
        if (D[i].cat === cats[c].key) {
          var sel = (cur && cur.id === D[i].id) ? ' sel' : '';
          var recited = Store.isRecited(D[i].id) ? ' recited' : '';
          html += '<button class="sbtn' + sel + recited + '" data-id="' + D[i].id + '">' + D[i].title + ' <span style="font-size:10px">' + getArticleDifficulty(D[i]) + '</span></button>';
        }
      }
    }
    navEl.innerHTML = html;
    bindBtns(navEl, 'data-id', function(btn) { selectArticle(btn.getAttribute('data-id')); });
  }

  function renderDynastyNav() {
    var html = '';
    var dynasties = [];
    var seen = {};
    for (var i = 0; i < AUTHORS.length; i++) {
      if (!seen[AUTHORS[i].dynasty]) {
        seen[AUTHORS[i].dynasty] = true;
        dynasties.push(AUTHORS[i].dynasty);
      }
    }
    for (var d = 0; d < dynasties.length; d++) {
      var sel = (currentDynasty === dynasties[d]) ? ' dynasty-sel' : '';
      html += '<button class="sbtn' + sel + '" data-dynasty="' + dynasties[d] + '">' + dynasties[d] + '</button>';
    }
    navEl.innerHTML = html;
    bindBtns(navEl, 'data-dynasty', function(btn) {
      var dyn = btn.getAttribute('data-dynasty');
      currentDynasty = dyn;
      renderDynastyNav();
      showDynastyCards(dyn);
    });
  }

  function bindBtns(container, attr, handler) {
    var btns = container.querySelectorAll('.sbtn');
    for (var i = 0; i < btns.length; i++) {
      (function(btn) { btn.onclick = function() { handler(btn); }; })(btns[i]);
    }
  }

  /* ===== RENDER: Content ===== */
  function highlight(text, kw){
    if(!kw) return text;
    var re = new RegExp('(' + escapeReg(kw) + ')', 'gi');
    return text.replace(re, '<mark class="hl">$1</mark>');
  }

  function renderStudyPanel(art) {
    // 始终渲染面板：无本地数据时也显示「在线查询」兜底
    if (!art) art = {};
    var tRaw = (typeof art.translation === 'string') ? art.translation.trim() : '';
    var aRaw = (typeof art.appreciation === 'string') ? art.appreciation.trim() : '';
    var hasT = tRaw.length > 0;
    var hasN = !!(art.notes && art.notes.length);
    var hasA = aRaw.length > 0;
    var hasLocal = hasT || hasN || hasA;
    var html = '<div class="study-panel">';
    html += '<div class="study-panel-head"><span class="icon"></span><span>学习辅导</span>';
    html += '<span class="sub">点击切换查看</span></div>';
    html += '<div class="study-tabs">';
    var nCount = hasN ? art.notes.length : 0;
    if (hasT) html += '<button class="study-tab" data-tab="translation">译文</button>';
    if (hasN) html += '<button class="study-tab" data-tab="notes">注释<span class="badge">' + nCount + '</span></button>';
    if (hasA) html += '<button class="study-tab" data-tab="appreciation">赏析</button>';
    // 始终显示「在线查询」tab（兜底 + 对照查询）
    html += '<button class="study-tab" data-tab="online"> 在线查询</button>';
    html += '</div>';
    if (hasT) {
      var tParas = art.translation.split('\n').filter(function(s){ return s.trim(); });
      html += '<div class="study-content" data-content="translation">';
      for (var i = 0; i < tParas.length; i++) {
        html += '<p>' + escapeHtml(tParas[i]) + '</p>';
      }
      html += '</div>';
    }
    if (hasN) {
      html += '<div class="study-content" data-content="notes">';
      for (var k = 0; k < art.notes.length; k++) {
        var n = art.notes[k] || {};
        // 跳过完全空的注释项
        if (!n.phrase && !n.pos && !n.explain) continue;
        html += '<div class="note-item">';
        html += '<div class="note-head">';
        if (n.phrase) html += '<span class="note-phrase">' + escapeHtml(n.phrase) + '</span>';
        if (n.pos) html += '<span class="note-pos">【' + escapeHtml(n.pos) + '】</span>';
        html += '</div>';
        if (n.explain) html += '<div class="note-explain">' + escapeHtml(n.explain) + '</div>';
        html += '</div>';
      }
      html += '</div>';
    }
    if (hasA) {
      var aParas = art.appreciation.split('\n').filter(function(s){ return s.trim(); });
      html += '<div class="study-content" data-content="appreciation">';
      for (var j = 0; j < aParas.length; j++) {
        html += '<p>' + escapeHtml(aParas[j]) + '</p>';
      }
      html += '</div>';
    }
    // 在线查询内容区（始终渲染）
    var title = art.title || '';
    var encT = encodeURIComponent(title);
    var tipMsg = hasLocal
      ? ' 想对照更多版本或查阅详细字词？点击下方按钮在线查询：'
      : ' 本篇暂无本地译文数据，可点击下方按钮在线查询：';
    html += '<div class="study-content" data-content="online">';
    html += '<div class="online-lookup">';
    html += '<div class="online-lookup-tip">' + tipMsg + '</div>';
    html += '<div class="online-lookup-btns">';
    html += '<a class="online-lookup-btn" href="https://so.gushiwen.cn/search.aspx?value=' + encT + '" target="_blank" rel="noopener noreferrer"> 古诗文网</a>';
    html += '<a class="online-lookup-btn" href="https://hanyu.baidu.com/s?wd=' + encT + '&ptype=pwd_shici" target="_blank" rel="noopener noreferrer"> 百度汉语</a>';
    html += '<a class="online-lookup-btn" href="https://www.bing.com/search?q=' + encT + '+译文+注释" target="_blank" rel="noopener noreferrer"> 必应搜索</a>';
    html += '</div>';
    if (!hasLocal) {
      html += '<div class="online-lookup-hint">提示：本地译文数据正在持续补充中，敬请期待。</div>';
    }
    html += '</div>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* 轻量 Markdown 渲染（用于 AI 回答） */
  function renderMarkdown(text) {
    if (!text) return '';
    var lines = escapeHtml(String(text)).split('\n');
    var html = '';
    var inList = false;
    var inQuote = false;
    var inCode = false;
    var codeBuf = '';
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      // 代码块 ```
      if (line.trim().indexOf('```') === 0) {
        if (inCode) {
          html += '<pre style="background:var(--bg);padding:12px;border-radius:4px;overflow-x:auto;font-size:13px;line-height:1.5;margin:8px 0;border:1px solid var(--border)"><code>' + escapeHtml(codeBuf) + '</code></pre>';
          codeBuf = ''; inCode = false;
        } else {
          if (inList) { html += '</ul>'; inList = false; }
          if (inQuote) { html += '</blockquote>'; inQuote = false; }
          inCode = true;
        }
        continue;
      }
      if (inCode) { codeBuf += line + '\n'; continue; }
      // 标题
      var hMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (hMatch) {
        if (inList) { html += '</ul>'; inList = false; }
        if (inQuote) { html += '</blockquote>'; inQuote = false; }
        var level = hMatch[1].length;
        var sizes = [20, 18, 16, 15];
        html += '<h' + level + ' style="font-size:' + sizes[level-1] + 'px;margin:12px 0 6px;font-weight:600;color:var(--fg)">' + hMatch[2] + '</h' + level + '>';
        continue;
      }
      // 引用 >
      var qMatch = line.match(/^&gt;\s?(.*)$/);
      if (qMatch) {
        if (inList) { html += '</ul>'; inList = false; }
        if (!inQuote) { html += '<blockquote style="border-left:3px solid var(--orange);padding-left:12px;margin:8px 0;color:var(--sub);font-size:14px">'; inQuote = true; }
        html += qMatch[1] + '<br>';
        continue;
      }
      if (inQuote) { html += '</blockquote>'; inQuote = false; }
      // 无序列表 - / *
      var lMatch = line.match(/^[\-\*]\s+(.+)$/);
      if (lMatch) {
        if (!inList) { html += '<ul style="padding-left:20px;margin:4px 0">'; inList = true; }
        html += '<li>' + lMatch[1] + '</li>';
        continue;
      }
      if (inList) { html += '</ul>'; inList = false; }
      // 普通行
      html += line + '<br>';
    }
    if (inList) html += '</ul>';
    if (inQuote) html += '</blockquote>';
    if (inCode) html += '<pre style="background:var(--bg);padding:12px;border-radius:4px;overflow-x:auto;font-size:13px;line-height:1.5;margin:8px 0;border:1px solid var(--border)"><code>' + escapeHtml(codeBuf) + '</code></pre>';
    // 行内格式：加粗、行内代码、斜体
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`(.+?)`/g, '<code style="background:var(--bg);padding:2px 5px;border-radius:3px;font-size:0.9em">$1</code>');
    html = html.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>');
    return html;
  }

  function renderText(txt, art) {
    // 防御：txt 可能为 null/undefined
    if (txt === null || txt === undefined) txt = '';
    // 翻译/字解分栏模式下按行拆分，确保左右一一对照
    var lineMode = (artMode === 'translation' || artMode === 'notes');
    var paras = lineMode ? String(txt).split('\n') : String(txt).split('\n\n');
    var html = '';
    for (var i = 0; i < paras.length; i++) {
      var p = paras[i];
      if (hlKw) p = highlight(p, hlKw);
      p = p.replace(/\n/g, '<br>');
      html += '<p>' + p + '</p>';
    }
    // 拼接（不再追加 studyPanel）
    artBody.innerHTML = html;
    artBody.style.fontSize = bodyFontSize + 'px';
    var tb = document.getElementById('artTransBody');
    // 分屏译文渲染（仅当当前模式为 translation）
    if (artMode === 'translation') {
      renderTranslation(art);
    } else if (artMode === 'notes') {
      renderNotesMode(art);
    }
    // 赏析
    renderAppreciation(art);
    updateSearchNav();
  }

  function renderTranslation(art) {
    var transBox = document.getElementById('artTransBox');
    var transBody = document.getElementById('artTransBody');
    var transTitle = document.getElementById('artTransTitle');
    if (!art || !art.translation) {
      transBox.style.display = 'none';
      document.getElementById('artDivider').style.display = 'none';
      return;
    }
    transBox.style.display = '';
    document.getElementById('artDivider').style.display = '';
    transTitle.textContent = '译文';
    // 按行拆分并保留空行占位，保证与原文行数对齐
    var tLines = art.translation.split('\n');
    var html = '';
    for (var i = 0; i < tLines.length; i++) {
      html += '<p>' + escapeHtml(tLines[i]) + '</p>';
    }
    transBody.innerHTML = html;
    // 检测译文中是否含"上阕/下阕"等词牌分阕标记，或标题中含"·"（词牌名）
    // 这两种情况译文与左侧逐句原文无法逐行对齐，跳过补空 <p> 与强制 gridRow 对齐
    var hasCipaiMark = /上\s*[阕阙]|下\s*[阕阙]/.test(art.translation);
    var hasDotTitle = art.title && String(art.title).indexOf('·') !== -1;
    var noAlign = hasCipaiMark || hasDotTitle;
    if (!noAlign) {
      // 补齐行数：较短一侧补空 <p>，避免一侧多出导致大面积留白
      var leftBody = document.getElementById('artBody');
      var leftCount = leftBody ? leftBody.children.length : 0;
      var rightCount = transBody.children.length;
      while (transBody.children.length < leftCount) transBody.appendChild(document.createElement('p'));
      if (leftBody) {
        while (leftBody.children.length < rightCount) leftBody.appendChild(document.createElement('p'));
      }
    }
    var transAuthor = transBox.querySelector('.art-author');
    var srcAuthor = document.getElementById('artAuthor');
    if (transAuthor && srcAuthor) {
      transAuthor.innerHTML = srcAuthor.innerHTML;
    }
    transBody.style.fontSize = bodyFontSize + 'px';
    transBody.style.lineHeight = '2';
    // 强制右侧注解继承左侧字号
    var rightItems = transBody.querySelectorAll('.notes-row-item');
    for (var i = 0; i < rightItems.length; i++) {
    rightItems[i].style.fontSize = bodyFontSize + 'px';
    }
    if (noAlign) {
      // 词牌/含"·"标题译文：清除强制 gridRow，让左右两列自然排列
      clearSplitRows();
    } else {
      alignSplitRows();
    }
  }

  function alignSplitRows() {
    var split = document.getElementById('artSplit');
    if (!split || split.classList.contains('no-split')) return;
    var leftHead = document.querySelector('#artBox > .art-head');
    var leftAuthor = document.querySelector('#artBox > .art-author');
    var rightHead = document.querySelector('#artTransBox > .art-head');
    var rightAuthor = document.querySelector('#artTransBox > .art-author');
    if (leftHead) leftHead.style.gridRow = '1';
    if (rightHead) rightHead.style.gridRow = '1';
    if (leftAuthor) leftAuthor.style.gridRow = '2';
    if (rightAuthor) rightAuthor.style.gridRow = '2';
    var leftKids = document.querySelectorAll('#artBody > *');
    var rightKids = document.querySelectorAll('#artTransBody > *');
    for (var i = 0; i < leftKids.length; i++) leftKids[i].style.gridRow = (i + 3);
    for (var i = 0; i < rightKids.length; i++) rightKids[i].style.gridRow = (i + 3);
  }

  // 清除分栏模式下的强制 gridRow（用于词牌译文等不应逐行对齐的场景）
  function clearSplitRows() {
    var split = document.getElementById('artSplit');
    if (!split || split.classList.contains('no-split')) return;
    var leftHead = document.querySelector('#artBox > .art-head');
    var leftAuthor = document.querySelector('#artBox > .art-author');
    var rightHead = document.querySelector('#artTransBox > .art-head');
    var rightAuthor = document.querySelector('#artTransBox > .art-author');
    if (leftHead) leftHead.style.gridRow = '';
    if (rightHead) rightHead.style.gridRow = '';
    if (leftAuthor) leftAuthor.style.gridRow = '';
    if (rightAuthor) rightAuthor.style.gridRow = '';
    var leftKids = document.querySelectorAll('#artBody > *');
    var rightKids = document.querySelectorAll('#artTransBody > *');
    for (var i = 0; i < leftKids.length; i++) leftKids[i].style.gridRow = '';
    for (var i = 0; i < rightKids.length; i++) rightKids[i].style.gridRow = '';
  }

  function updateSearchNav(){
    if(!hlKw){ searchNav.classList.add('hidden'); return; }
    var marks = artBody.querySelectorAll('mark.hl');
    if(marks.length===0){ searchNav.classList.add('hidden'); return; }
    searchNav.classList.remove('hidden');
    for(var i=0;i<marks.length;i++) marks[i].classList.remove('cur');
    marks[0].classList.add('cur');
    marks[0].scrollIntoView({block:'center'});
    hlCount.textContent = '1 / ' + marks.length;
    curHlIdx = 0;
  }
  var curHlIdx = 0;
  function hlJump(dir){
    var marks = artBody.querySelectorAll('mark.hl');
    if(marks.length===0) return;
    curHlIdx = (curHlIdx + dir + marks.length) % marks.length;
    for(var i=0;i<marks.length;i++) marks[i].classList.remove('cur');
    marks[curHlIdx].classList.add('cur');
    marks[curHlIdx].scrollIntoView({block:'center'});
    hlCount.textContent = (curHlIdx+1) + ' / ' + marks.length;
  }

  function renderDynastyCards(dynastyName) {
    var html = '';
    var count = 0;
    for (var i = 0; i < AUTHORS.length; i++) {
      var a = AUTHORS[i];
      if (dynastyName && a.dynasty !== dynastyName) continue;
      count++;
      var brief = a.bio.split('\n')[0];
      html += '<div class="author-card" data-author-id="' + a.id + '">';
      html += '<div class="author-card-name">' + a.name + '</div>';
      html += '<div class="author-card-dynasty">' + a.dynasty + '</div>';
      html += '<div class="author-card-brief">' + brief + '</div>';
      html += '</div>';
    }
    if(count===0){
      dynastyGrid.innerHTML = '<div class="empty-state"><div class="icon"></div><div class="title">暂无作家</div><div class="desc">该朝代下未收录作家</div></div>';
      return;
    }
    dynastyGrid.innerHTML = html;
    var cards = dynastyGrid.querySelectorAll('.author-card');
    for (var j = 0; j < cards.length; j++) {
      (function(card) {
        card.onclick = function() { showAuthorDetail(card.getAttribute('data-author-id')); };
      })(cards[j]);
    }
    glassAuthorCards(dynastyGrid);
  }

  function renderAuthorDetail(authorId) {
    var author = null;
    for (var i = 0; i < AUTHORS.length; i++) {
      if (AUTHORS[i].id === authorId) { author = AUTHORS[i]; break; }
    }
    if (!author) return;
    var html = '';
    html += '<div class="back-btn" id="backBtn">&lt; 返回</div>';
    html += '<div class="author-detail-name">' + author.name + '</div>';
    html += '<div class="author-detail-dynasty">' + author.dynasty + '</div>';
    var bioParas = author.bio.split('\n\n');
    html += '<div class="author-detail-bio">';
    for (var p = 0; p < bioParas.length; p++) html += '<p>' + bioParas[p] + '</p>';
    html += '</div>';
    // 代表作
    var MASTERWORKS = {
      'libai':'《将进酒》《蜀道难》《梦游天姥吟留别》','dufu':'《登高》《蜀相》《客至》','sushi':'《赤壁赋》《念奴娇·赤壁怀古》《江城子》',
      'baijuyi':'《琵琶行》《长恨歌》《赋得古原草送别》','xunzi':'《劝学》《荀子》','simaqian':'《史记》《报任安书》',
      'hanyu':'《师说》《进学解》《祭十二郎文》','taoyuanming':'《归去来兮辞》《归园田居》《饮酒》','liuzongyuan':'《种树郭橐驼传》《小石潭记》《捕蛇者说》',
      'ouyangxiu':'《五代史伶官传序》《醉翁亭记》《秋声赋》','suxun':'《六国论》《权书》《衡论》','wanganshi':'《答司马谏议书》《游褒禅山记》《伤仲永》',
      'quyuan':'《离骚》《九歌》《天问》','libai2':'','qinyuan':'《鹊桥仙》《淮海词》','liqingzhao':'《声声慢》《如梦令》《一剪梅》',
      'luyou':'《书愤》《临安春雨初霁》《示儿》','xinqiji':'《永遇乐·京口北固亭怀古》《青玉案·元夕》《破阵子》','caocao':'《短歌行》《观沧海》《龟虽寿》',
      'wangwei':'《山居秋暝》《鹿柴》《送元二使安西》','dumu':'《阿房宫赋》《泊秦淮》《赤壁》','jiayi':'《过秦论》《论积贮疏》《吊屈原赋》'
    };
    var mw = MASTERWORKS[author.id];
    if (mw) html += '<div style="font-size:13px;color:var(--sub);margin-bottom:16px;font-family:\'Microsoft YaHei\',sans-serif"> 代表作：' + mw + '</div>';
    var worksCount = 0;
    html += '<div class="author-detail-works-title">相关篇目</div>';
    for (var a = 0; a < D.length; a++) {
      if (D[a].authorId === authorId) {
        worksCount++;
        html += '<span class="author-work-link" data-article-id="' + D[a].id + '">' + D[a].title + '</span>';
      }
    }
    if(worksCount===0) html += '<div style="font-size:13px;color:var(--muted-fg)">暂未收录该作家的篇目</div>';
    viewAuthorDetail.innerHTML = html;
    var bio = viewAuthorDetail.querySelector('.author-detail-bio');
    if (bio) bio.style.fontSize = authorDetailFontSize + 'px';
    document.getElementById('backBtn').onclick = function() {
      if (currentDynasty) { showDynastyCards(currentDynasty); }
      else { showDynastyCards(null); }
    };
    var links = viewAuthorDetail.querySelectorAll('.author-work-link');
    for (var k = 0; k < links.length; k++) {
      (function(link) { link.onclick = function() {
        setSystemMode('learn');
        selectArticle(link.getAttribute('data-article-id'));
      }; })(links[k]);
    }
  }

  /* ===== Practice Nav ===== */
  function clearNavSel(){
    var allP = navEl.querySelectorAll('.nav-parent');
    for (var i = 0; i < allP.length; i++) allP[i].classList.remove('sel');
    var allC = navEl.querySelectorAll('.nav-child');
    for (var j = 0; j < allC.length; j++) allC[j].classList.remove('sel');
  }

  function renderExampleNav(structure, type){
    var html = '';
    for (var i = 0; i < structure.length; i++) {
      var item = structure[i];
      var hasCh = item.children && item.children.length > 0;
      var guide = item.guide ? ' guide' : '';
      html += '<button class="nav-parent' + guide + '" data-nav-id="' + item.id + '">';
      html += '<span>' + item.name + '</span>';
      if (hasCh) html += '<span class="nav-arrow">&#9654;</span>';
      html += '</button>';
      if (hasCh) {
        html += '<div class="nav-children" data-parent="' + item.id + '">';
        for (var j = 0; j < item.children.length; j++) {
          var ch = item.children[j];
          html += '<button class="nav-child" data-nav-id="' + ch.id + '">' + ch.name + '</button>';
        }
        html += '</div>';
      }
    }
    navEl.innerHTML = html;
    var parents = navEl.querySelectorAll('.nav-parent');
    for (var p = 0; p < parents.length; p++) {
      (function(parentBtn) {
        var id = parentBtn.getAttribute('data-nav-id');
        var childDiv = navEl.querySelector('.nav-children[data-parent="' + id + '"]');
        var arrow = parentBtn.querySelector('.nav-arrow');
        if (childDiv) {
          parentBtn.onclick = function() {
            childDiv.classList.toggle('open');
            if (arrow) arrow.classList.toggle('open');
          };
        } else {
          parentBtn.onclick = function() {
            clearNavSel();
            parentBtn.classList.add('sel');
            showExamples(id, type);
          };
        }
      })(parents[p]);
    }
    var children = navEl.querySelectorAll('.nav-child');
    for (var c = 0; c < children.length; c++) {
      (function(childBtn) {
        childBtn.onclick = function() {
          clearNavSel();
          childBtn.classList.add('sel');
          showExamples(childBtn.getAttribute('data-nav-id'), type);
        };
      })(children[c]);
    }
  }

  function renderJushiNav() {
    var structure = [
      {name:'判断句', id:'panduan'},
      {name:'被动句', id:'beidong'},
      {name:'倒装句', id:'daozhuang', guide:true, children:[
        {name:'宾语前置', id:'binyu'},
        {name:'状语后置', id:'zhuangyu'},
        {name:'定语后置', id:'dingyu'},
        {name:'主谓倒装', id:'zhuwei'}
      ]},
      {name:'省略句', id:'shenglve', guide:true, children:[
        {name:'省略主语', id:'shengzhuyu'},
        {name:'省略谓语', id:'shengweiyu'},
        {name:'省略宾语', id:'shengbinyu'},
        {name:'省略介词', id:'shengjieci'}
      ]}
    ];
    renderExampleNav(structure, 'jushi');
    // 追加「AI 检查句子语法」入口
    var aiBtn = document.createElement('button');
    aiBtn.className = 'nav-parent';
    aiBtn.innerHTML = '<span>✨ AI 检查句子语法</span>';
    aiBtn.style.color = 'var(--pri)';
    aiBtn.style.fontWeight = '600';
    aiBtn.style.borderTop = '1px solid var(--border)';
    aiBtn.style.marginTop = '4px';
    aiBtn.onclick = function() {
      clearNavSel();
      aiBtn.classList.add('sel');
      showAIGrammarCheck();
    };
    navEl.appendChild(aiBtn);
  }

  /* ===== AI 检查句子语法 ===== */
  function showAIGrammarCheck() {
    hideAllViews();
    viewExample.classList.remove('hidden');
    viewExample.classList.remove('view'); void viewExample.offsetWidth; viewExample.classList.add('view');
    var html = '<div class="example-title">✨ AI 检查句子语法</div>';
    html += '<div style="max-width:680px;margin:0 auto;padding:0 16px">';
    html += '<div style="margin-bottom:12px;color:var(--sub);font-size:13px;font-family:\'Microsoft YaHei\',sans-serif;line-height:1.6">输入一句文言文，AI 将判断其句式类型（判断句 / 被动句 / 倒装句 / 省略句等）并给出语法解析。</div>';
    html += '<div style="display:flex;gap:8px;margin-bottom:16px">';
    html += '<input type="text" id="aiGrammarInput" placeholder="例如：廉颇者，赵之良将也。" style="flex:1;height:38px;border:1px solid var(--border);background:var(--card);color:var(--fg);padding:0 12px;font-family:inherit;font-size:14px;outline:none;border-radius:4px">';
    html += '<button class="exercise-submit" id="aiGrammarBtn" style="margin:0;white-space:nowrap">检查</button>';
    html += '</div>';
    html += '<div id="aiGrammarResult"></div>';
    html += '</div>';
    viewExample.innerHTML = html;
    glassExampleCards(viewExample);

    var input = document.getElementById('aiGrammarInput');
    var btn = document.getElementById('aiGrammarBtn');
    var resultDiv = document.getElementById('aiGrammarResult');

    input.focus();
    input.onkeydown = function(e) { if (e.key === 'Enter') btn.click(); };

    btn.onclick = async function() {
      var sentence = input.value.trim();
      if (!sentence) { showToast('请输入要检查的句子', 'warn'); return; }
      var cfg = Store.getAIConfig();
      if (!cfg.apiUrl || !cfg.apiKey || !cfg.model) {
        showToast('请先在「更多」中配置 AI API 信息', 'warn');
        return;
      }
      resultDiv.innerHTML = '<div style="padding:24px;text-align:center;color:var(--sub);font-size:14px">AI 正在分析中，请稍候…</div>';
      btn.disabled = true;

      var prompt = '你是一位资深的高中语文老师，擅长文言文语法分析。请对以下文言文句子进行语法判断和解析。\n\n' +
        '句子：' + sentence + '\n\n' +
        '请从以下方面分析：\n' +
        '1. 判断该句属于哪种文言特殊句式（判断句 / 被动句 / 倒装句 / 省略句 / 正常句式等）；如果是倒装句，请说明具体类型（宾语前置 / 状语后置 / 定语后置 / 主谓倒装）\n' +
        '2. 解释判断依据（语法标志词、句式特点等）\n' +
        '3. 如有倒装或省略，请还原正常语序\n' +
        '4. 给出该句的现代汉语翻译\n\n' +
        '请用简洁清晰的中文回答。';

      var result = await callAI(cfg, prompt, 30000);
      btn.disabled = false;
      if (!result.success) {
        resultDiv.innerHTML = '<div class="exercise-result wrong">分析失败：' + escapeHtml(result.error) + '</div>';
        return;
      }
      var content = renderMarkdown(result.content);
      resultDiv.innerHTML = '<div style="padding:16px;background:var(--card);border:1px solid var(--border);border-left:3px solid var(--pri);font-size:14px;line-height:1.8;color:var(--fg);font-family:\'Microsoft YaHei\',sans-serif;border-radius:4px">' + content + '</div>';
    };
  }

  /* ===== AI 识别词类活用 ===== */
  function showAICileiCheck() {
    hideAllViews();
    viewExample.classList.remove('hidden');
    viewExample.classList.remove('view'); void viewExample.offsetWidth; viewExample.classList.add('view');
    var html = '<div class="example-title">✨ AI 识别词类活用</div>';
    html += '<div style="max-width:680px;margin:0 auto;padding:0 16px">';
    html += '<div style="margin-bottom:12px;color:var(--sub);font-size:13px;font-family:\'Microsoft YaHei\',sans-serif;line-height:1.6">输入一句文言文，AI 将识别其中的词类活用现象（名词作动词 / 名词作状语 / 形容词作动词 / 形容词作名词 / 动词作名词 / 使动用法 / 意动用法等）并给出详细解析。</div>';
    html += '<div style="display:flex;gap:8px;margin-bottom:16px">';
    html += '<input type="text" id="aiCileiInput" placeholder="例如：沛公军霸上。" style="flex:1;height:38px;border:1px solid var(--border);background:var(--card);color:var(--fg);padding:0 12px;font-family:inherit;font-size:14px;outline:none;border-radius:4px">';
    html += '<button class="exercise-submit" id="aiCileiBtn" style="margin:0;white-space:nowrap">识别</button>';
    html += '</div>';
    html += '<div id="aiCileiResult"></div>';
    html += '</div>';
    viewExample.innerHTML = html;
    glassExampleCards(viewExample);

    var input = document.getElementById('aiCileiInput');
    var btn = document.getElementById('aiCileiBtn');
    var resultDiv = document.getElementById('aiCileiResult');

    input.focus();
    input.onkeydown = function(e) { if (e.key === 'Enter') btn.click(); };

    btn.onclick = async function() {
      var sentence = input.value.trim();
      if (!sentence) { showToast('请输入要识别的句子', 'warn'); return; }
      var cfg = Store.getAIConfig();
      if (!cfg.apiUrl || !cfg.apiKey || !cfg.model) {
        showToast('请先在「更多」中配置 AI API 信息', 'warn');
        return;
      }
      resultDiv.innerHTML = '<div style="padding:24px;text-align:center;color:var(--sub);font-size:14px">AI 正在分析中，请稍候…</div>';
      btn.disabled = true;

      var prompt = '你是一位资深的高中语文老师，擅长文言文词类活用分析。请对以下文言文句子进行词类活用识别和解析。\n\n' +
        '句子：' + sentence + '\n\n' +
        '请从以下方面分析：\n' +
        '1. 找出句中所有的词类活用现象（名词作动词 / 名词作状语 / 形容词作动词 / 形容词作名词 / 动词作名词 / 使动用法 / 意动用法等）\n' +
        '2. 对每个活用现象，说明：原词原本的词性、活用后的用法、判断依据\n' +
        '3. 解释该活用现象的语法特点和表达效果\n' +
        '4. 给出该句的现代汉语翻译（注意体现活用后的意思）\n\n' +
        '请用简洁清晰的中文回答。';

      var result = await callAI(cfg, prompt, 30000);
      btn.disabled = false;
      if (!result.success) {
        resultDiv.innerHTML = '<div class="exercise-result wrong">识别失败：' + escapeHtml(result.error) + '</div>';
        return;
      }
      var content = renderMarkdown(result.content);
      resultDiv.innerHTML = '<div style="padding:16px;background:var(--card);border:1px solid var(--border);border-left:3px solid var(--orange);font-size:14px;line-height:1.8;color:var(--fg);font-family:\'Microsoft YaHei\',sans-serif;border-radius:4px">' + content + '</div>';
    };
  }

  function renderCileiNav() {
    var structure = [
      {name:'名词作动词', id:'mz_dongci'},
      {name:'名词作状语', id:'mz_zhuangyu'},
      {name:'形容词作动词', id:'xz_dongci'},
      {name:'形容词作名词', id:'xz_mingci'},
      {name:'动词作名词', id:'dz_mingci'},
      {name:'使动用法', id:'shidong'},
      {name:'意动用法', id:'yidong'}
    ];
    renderExampleNav(structure, 'cilei');
    // 追加「AI 识别词类活用」入口
    var aiBtn = document.createElement('button');
    aiBtn.className = 'nav-parent';
    aiBtn.innerHTML = '<span>✨ AI 识别词类活用</span>';
    aiBtn.style.color = 'var(--pri)';
    aiBtn.style.fontWeight = '600';
    aiBtn.style.borderTop = '1px solid var(--border)';
    aiBtn.style.marginTop = '4px';
    aiBtn.onclick = function() {
      clearNavSel();
      aiBtn.classList.add('sel');
      showAICileiCheck();
    };
    navEl.appendChild(aiBtn);
  }

  function showExamples(categoryId, type){
    var data = type === 'jushi' ? JUSHI : CILEI;
    var cat = data[categoryId];
    if(!cat) return;
    hideAllViews();
    viewExample.classList.remove('hidden');
    viewExample.classList.remove('view'); void viewExample.offsetWidth; viewExample.classList.add('view');
    var html = '<div class="example-title">' + cat.name + ' · 共 ' + cat.items.length + ' 例</div>';
    html += '<div class="example-grid">';
    for (var i = 0; i < cat.items.length; i++) {
      var it = cat.items[i];
      var art = findArt(it.art);
      html += '<div class="example-card">';
      html += '<div class="example-sentence">' + it.s + '</div>';
      html += '<div class="example-explain">' + it.e + '</div>';
      html += '<div class="example-source" data-art="' + it.art + '">—— ' + (art ? art.title : '') + '</div>';
      html += '</div>';
    }
    html += '</div>';
    viewExample.innerHTML = html;
    glassExampleCards(viewExample);
    var srcs = viewExample.querySelectorAll('.example-source');
    for (var j = 0; j < srcs.length; j++) {
      (function(s){ s.onclick = function(){
        setSystemMode('learn');
        selectArticle(s.getAttribute('data-art'));
      }; })(srcs[j]);
    }
  }

  function showPlaceholder(title, desc, sub) {
    hideAllViews();
    viewArt.classList.remove('hidden');
    artTitle.textContent = '';
    artAuthor.textContent = '';
    artSplit.classList.add('no-split');
    setArtMode('orig-only');
    artBody.innerHTML = '<div class="empty-state"><div class="icon"></div><div class="title">' + (title||'功能开发中') + '</div><div class="desc">' + (desc||'敬请期待') + '</div>' + (sub?'<div class="desc" style="margin-top:6px">'+sub+'</div>':'') + '</div>';
    var ap = document.getElementById('artAppreciation');
    if (ap) ap.style.display = 'none';
  }

  /* ===== WORD GAME ===== */
  var wordQuestions = [];
  var wordCurrentIdx = 0;
  var wordScore = 0;
  var wordAnswered = false;
  var wordLoadCallback = null;

  var wordFallbackData = [
    {
      focusWord: "而",
      options: ["表转折，却", "介词，在", "代词，他", "语气词，吗", "动词，到", "表被动"],
      answer: 0,
      explanation: "“而”常表转折，如《劝学》“青，取之于蓝，而青于蓝”。"
    },
    {
      focusWord: "何",
      options: ["疑问代词，什么", "介词，凭借", "连词，如果", "助词，的", "表承接，就", "形容词词尾"],
      answer: 0,
      explanation: "“何”作疑问代词，如《鸿门宴》“大王来何操？”"
    },
    {
      focusWord: "乎",
      options: ["语气词，吗", "代词，你的", "副词，竟然", "连词，而且", "介词，从", "助词，……的人"],
      answer: 0,
      explanation: "“乎”可表疑问语气，如《鸿门宴》“壮士，能复饮乎？”"
    },
    {
      focusWord: "乃",
      options: ["副词，于是", "代词，那", "介词，用", "连词，却", "兼词，于此", "语气词，了"],
      answer: 0,
      explanation: "“乃”作副词“于是”，如《鸿门宴》“项伯乃夜驰之沛公军”。"
    },
    {
      focusWord: "其",
      options: ["代词，他（的）", "连词，如果", "介词，被", "助词，取独", "副词，才", "动词，给予"],
      answer: 0,
      explanation: "“其”作代词，如《曹刿论战》“吾视其辙乱”。"
    },
    {
      focusWord: "且",
      options: ["连词，而且", "介词，比", "副词，大概", "助词，的", "兼词，于此", "语气词，呢"],
      answer: 0,
      explanation: "“且”可表并列递进，如“河水清且涟猗”。"
    },
    {
      focusWord: "若",
      options: ["连词，如果", "副词，就", "代词，哪里", "介词，对", "助词，……的样子", "动词，是"],
      answer: 0,
      explanation: "“若”作假设连词，如《烛之武退秦师》“若使烛之武见秦君”。"
    },
    {
      focusWord: "所",
      options: ["助词，……的人/事物", "介词，用", "连词，然后", "副词，难道", "代词，你的", "形容词词尾"],
      answer: 0,
      explanation: "“所”字结构，如《师说》“道之所存，师之所存也”。"
    },
    {
      focusWord: "为",
      options: ["介词，被", "表转折，却", "代词，他", "兼词，于此", "语气词，吗", "助词，的"],
      answer: 0,
      explanation: "“为”表被动，如《过秦论》“为天下笑”。"
    },
    {
      focusWord: "焉",
      options: ["兼词，于此", "连词，如果", "副词，才", "介词，凭借", "代词，什么", "助词，提宾标志"],
      answer: 0,
      explanation: "“焉”作兼词，如《劝学》“积土成山，风雨兴焉”。"
    },
    {
      focusWord: "也",
      options: ["语气词，表判断", "介词，从", "连词，而且", "副词，于是", "代词，那", "动词，到"],
      answer: 0,
      explanation: "“也”用于判断句尾，如《廉颇蔺相如列传》“廉颇者，赵之良将也”。"
    },
    {
      focusWord: "以",
      options: ["介词，用", "语气词，呢", "代词，你的", "表承接，就", "助词，的", "兼词，于此"],
      answer: 0,
      explanation: "“以”作介词“用”，如《游褒禅山记》“以故其后名之曰‘褒禅’”。"
    },
    {
      focusWord: "因",
      options: ["介词，凭借", "连词，表转折", "副词，大概", "代词，哪里", "助词，取独", "语气词，了"],
      answer: 0,
      explanation: "“因”可译为“凭借”，如《过秦论》“因河为池”。"
    },
    {
      focusWord: "于",
      options: ["介词，在", "连词，并且", "代词，它", "副词，竟然", "助词，……的人", "兼词，于此"],
      answer: 0,
      explanation: "“于”引出处所，如《赤壁赋》“游于赤壁之下”。"
    },
    {
      focusWord: "与",
      options: ["连词，和", "介词，被", "副词，就", "代词，你的", "助词，的", "语气词，吗"],
      answer: 0,
      explanation: "“与”作并列连词，如《赤壁赋》“吾与子渔樵于江渚之上”。"
    },
    {
      focusWord: "则",
      options: ["连词，就", "介词，用", "代词，他", "副词，才", "兼词，于此", "助词，……的样子"],
      answer: 0,
      explanation: "“则”表承接，如《促织》“每闻琴瑟之声，则应节而舞”。"
    },
    {
      focusWord: "者",
      options: ["助词，……的人", "连词，如果", "介词，比", "副词，难道", "代词，什么", "动词，给予"],
      answer: 0,
      explanation: "“者”字结构，如《师说》“古之学者必有师”。"
    },
    {
      focusWord: "之",
      options: ["助词，的", "介词，在", "连词，而且", "副词，于是", "语气词，呢", "代词，那"],
      answer: 0,
      explanation: "“之”作结构助词“的”，如《赤壁赋》“此非孟德之诗乎？”"
    }
  ];

  // 打包成 App 后页面走 file://，fetch 会被 CORS 拦截，
  // 此时退回到 config/bundled.js 内联的完整题库（由 gen_bundled_config.py 生成）。
  function wordGameBundled() {
    try { return (window.__BUNDLED__ && window.__BUNDLED__.game && window.__BUNDLED__.game.questions) || null; }
    catch(e) { return null; }
  }

  function loadWordGameData(cb) {
    wordLoadCallback = cb || null;
    if (typeof fetch !== 'undefined') {
      fetch('config/game.json')
        .then(function(r){ return r.json(); })
        .then(function(data){ initWordQuestions(data && data.questions ? data.questions : []); })
        .catch(function(err){
          // file:// 下 fetch 失败：优先用打包进 App 的完整题库
          var b = wordGameBundled();
          initWordQuestions(b || wordFallbackData);
        });
    } else {
      initWordQuestions(wordGameBundled() || wordFallbackData);
    }
  }

  function initWordQuestions(list) {
    wordQuestions = [];
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      var q = list[i];
      if (!q) continue;
      if (q.type && q.type !== 1) continue;
      if (seen[q.focusWord]) continue;
      seen[q.focusWord] = true;
      wordQuestions.push(q);
    }
    wordQuestions.sort(function(a, b){ return (a.id || 0) - (b.id || 0); });
    if (wordLoadCallback) { wordLoadCallback(); wordLoadCallback = null; }
  }

  function renderWordGameIntro() {
    viewWordGame.innerHTML = '<div class="word-game"><div class="word-game-start"><div class="title">文言虚词 · 百词斩</div><div class="desc">从 18 个常见虚词中出题，检测你对虚词用法的掌握。</div><div class="word-game-actions"><button class="word-game-btn" id="wordStartBtn">内置题库开始</button><button class="word-game-btn secondary" id="aiGenBtn" title="需先在「更多」中配置 AI API">✨ AI 智能出题</button></div></div></div>';
    document.getElementById('wordStartBtn').onclick = startWordGame;
    var aiGenBtn = document.getElementById('aiGenBtn');
    if (aiGenBtn) aiGenBtn.onclick = function() { startAIWordGame(null); };
  }

  function startWordGame() {
    // 如果之前使用过 AI 题库，现在要恢复内置原始题库
    if (window._origWordQuestions && window._origWordQuestions.length > 0) {
      var currentFirstId = wordQuestions[0] && wordQuestions[0].id ? String(wordQuestions[0].id) : '';
      if (currentFirstId.indexOf('ai_') === 0) {
        wordQuestions = window._origWordQuestions.slice();
      }
    }
    if (wordQuestions.length === 0) return;
    wordCurrentIdx = 0;
    wordScore = 0;
    renderWordQuestion();
  }

  function renderWordQuestion() {
    var q = wordQuestions[wordCurrentIdx];
    wordAnswered = false;
    var html = '<div class="word-game">';
    html += '<div class="word-game-progress">第 ' + (wordCurrentIdx + 1) + ' / ' + wordQuestions.length + ' 题' + (q.id && String(q.id).indexOf('ai_') === 0 ? ' · AI 出题' : '') + '</div>';
    html += '<div class="word-game-word">' + q.focusWord + '</div>';
    // AI 题目格式：包含 sentence 和 question 字段
    if (q.sentence) {
      html += '<div style="font-size:18px;color:var(--fg);margin-bottom:12px;padding:12px 16px;background:var(--bg);border-left:3px solid var(--pri);line-height:1.8;font-family:\'LXGW WenKai\',\'KaiTi\',serif;">"' + escapeHtml(q.sentence) + '"</div>';
    }
    var questionText = q.question || ('虚词“' + q.focusWord + '”常表示什么？');
    html += '<div class="word-game-question">' + escapeHtml(questionText) + '</div>';
    html += '<div class="word-game-options">';
    for (var i = 0; i < q.options.length; i++) {
      html += '<button class="word-game-option" id="wordOpt' + i + '" data-idx="' + i + '">' + escapeHtml(q.options[i]) + '</button>';
    }
    html += '</div>';
    html += '<div class="word-game-feedback" id="wordFeedback"></div>';
    html += '<div class="word-game-actions"><button class="word-game-btn secondary" id="aiRegenBtn" title="AI 重新出题">✨ AI 换一批</button><button class="word-game-btn" id="wordNextBtn" disabled>下一题</button></div>';
    html += '</div>';
    viewWordGame.innerHTML = html;
    glassWordGame(viewWordGame);
    for (var j = 0; j < q.options.length; j++) {
      (function(idx){
        document.getElementById('wordOpt' + idx).onclick = function(){ selectWordOption(idx); };
      })(j);
    }
    document.getElementById('wordNextBtn').onclick = nextWordQuestion;
    var aiRegenBtn = document.getElementById('aiRegenBtn');
    if (aiRegenBtn) aiRegenBtn.onclick = function() { startAIWordGame(q.focusWord); };
  }

  function selectWordOption(idx) {
    if (wordAnswered) return;
    wordAnswered = true;
    var q = wordQuestions[wordCurrentIdx];
    var correct = idx === q.answer;
    if (correct) wordScore++;
    for (var i = 0; i < q.options.length; i++) {
      var btn = document.getElementById('wordOpt' + i);
      btn.classList.add('disabled');
      if (i === q.answer) btn.classList.add('correct');
      else if (i === idx) btn.classList.add('wrong');
    }
    var fb = document.getElementById('wordFeedback');
    fb.innerHTML = renderMarkdown(q.explanation);
    fb.classList.add('show');
    var nextBtn = document.getElementById('wordNextBtn');
    nextBtn.disabled = false;
    if (wordCurrentIdx === wordQuestions.length - 1) nextBtn.textContent = '查看结果';
  }

  function nextWordQuestion() {
    wordCurrentIdx++;
    if (wordCurrentIdx >= wordQuestions.length) renderWordResult();
    else renderWordQuestion();
  }

  function renderWordResult() {
    var total = wordQuestions.length;
    var isAI = wordQuestions.length > 0 && wordQuestions[0].id && String(wordQuestions[0].id).indexOf('ai_') === 0;
    var html = '<div class="word-game"><div class="word-game-result"><div class="score">' + wordScore + '/' + total + '</div><div class="desc">测试完成，答对 ' + wordScore + ' 题，共 ' + total + ' 题' + (isAI ? '（AI 出题）' : '') + '</div><div class="word-game-actions"><button class="word-game-btn" id="wordRestartBtn">' + (isAI ? '用内置题库再测' : '再测一次') + '</button><button class="word-game-btn secondary" id="aiGenAgainBtn">✨ AI 再出一套</button></div></div></div>';
    viewWordGame.innerHTML = html;
    glassWordGame(viewWordGame);
    document.getElementById('wordRestartBtn').onclick = startWordGame;
    var aiGenAgainBtn = document.getElementById('aiGenAgainBtn');
    if (aiGenAgainBtn) aiGenAgainBtn.onclick = function() { startAIWordGame(null); };
  }

  async function startAIWordGame(focusWord) {
    var questions = await generateAIWordQuestions(focusWord);
    if (!questions || questions.length === 0) return;
    // 备份原始内置题库（仅备份一次）
    if (!window._origWordQuestions) window._origWordQuestions = wordQuestions.slice();
    wordQuestions = questions;
    wordCurrentIdx = 0;
    wordScore = 0;
    hideAllViews();
    viewWordGame.classList.remove('hidden');
    viewMode = 'wordGame';
    renderWordQuestion();
    showToast('AI 已生成 ' + questions.length + ' 道题目，开始答题吧！', 'success');

    // 自动保存到当前用户的 profile（随其他用户数据一起写入 JSON 配置文件）
    try {
      var bank = Store.get('aiQuestions', {});
      bank._lastUpdated = new Date().toISOString();
      bank._lastFocusWord = focusWord || '随机';
      bank._lastQuestions = questions;
      Store.set('aiQuestions', bank);
    } catch(e) {}
  }

  /* ===== EXERCISE STATE ===== */
  var exerciseState = { type: 'blank', articleId: null, questions: [], currentIdx: 0, answers: [], shuffledAuthors: [] };

  /* ===== Store 扩展：错题本 + 统计 ===== */
  Store.getWrongBook = function() { return this.get('wrongbook', []); };
  Store.addWrongBook = function(item) {
    var wb = this.getWrongBook();
    // 间隔复习字段：新错题默认 1 天后进入复习队列
    item.reviewLevel = item.reviewLevel || 0;
    item.nextReviewDate = item.nextReviewDate || (Date.now() + 86400000);
    wb.push(item);
    this.set('wrongbook', wb);
  };
  Store.removeWrongBook = function(idx) { var wb = this.getWrongBook(); wb.splice(idx, 1); this.set('wrongbook', wb); };
  Store.clearWrongBook = function() { this.set('wrongbook', []); };
  // 错题间隔复习：返回今日到期错题的索引数组（兼容历史无字段数据）
  Store.getTodayWrongReviews = function() {
    var wb = this.getWrongBook();
    var now = Date.now();
    var result = [];
    for (var i = 0; i < wb.length; i++) {
      var item = wb[i];
      if (!item.nextReviewDate || item.nextReviewDate <= now) result.push(i);
    }
    return result;
  };
  // 错题间隔复习：根据答题结果更新复习等级；最高级答对则移出错题本（已掌握）
  Store.scheduleWrongReview = function(idx, correct) {
    var wb = this.getWrongBook();
    if (!wb[idx]) return { mastered: false };
    var intervals = [1, 3, 7, 14, 30];
    var item = wb[idx];
    var currentLevel = item.reviewLevel || 0;
    if (correct) {
      var nextLevel = Math.min(currentLevel + 1, intervals.length - 1);
      if (nextLevel >= intervals.length - 1) {
        wb.splice(idx, 1);
        this.set('wrongbook', wb);
        return { mastered: true };
      }
      item.reviewLevel = nextLevel;
      item.nextReviewDate = Date.now() + intervals[nextLevel] * 86400000;
      item.lastReviewedAt = Date.now();
    } else {
      item.reviewLevel = 0;
      item.nextReviewDate = Date.now() + intervals[0] * 86400000;
      item.lastReviewedAt = Date.now();
    }
    this.set('wrongbook', wb);
    return { mastered: false };
  };
  Store.getStats = function() {
    return this.get('practiceStats', { totalAttempts:0, totalCorrect:0, blank:{attempts:0,correct:0}, match:{attempts:0,correct:0}, pair:{attempts:0,correct:0}, situational:{attempts:0,correct:0}, feihua:{attempts:0,correct:0} });
  };
  Store.recordPractice = function(type, correct) {
    var s = this.getStats();
    if (!s[type]) s[type] = { attempts: 0, correct: 0 };
    s.totalAttempts++;
    if (correct) s.totalCorrect++;
    if (s[type]) { s[type].attempts++; if (correct) s[type].correct++; }
    this.set('practiceStats', s);
    var dk = this.getDailyKey();
    this.recordDaily(dk, 'attempts', 1);
    if (correct) this.recordDaily(dk, 'correct', 1);
  };
  // 飞花令最佳连击持久化
  Store.getFeihuaBest = function() { return this.get('feihuaBest', 0); };
  Store.setFeihuaBest = function(v) { if (v > this.getFeihuaBest()) this.set('feihuaBest', v); };

  /* ===== 按日学习统计（阶段4 可视化数据源） ===== */
  Store.getDailyStats = function() { return this.get('dailyStats', {}); };
  Store.getDailyKey = function(d) {
    var dd = d ? new Date(d) : new Date();
    var m = dd.getMonth() + 1;
    var day = dd.getDate();
    return dd.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  };
  Store.recordDaily = function(date, field, value) {
    var ds = this.getDailyStats();
    if (!ds[date]) ds[date] = { attempts: 0, correct: 0, studyTime: 0 };
    ds[date][field] = (ds[date][field] || 0) + value;
    this.set('dailyStats', ds);
  };
  Store.getRecentDailyStats = function(days) {
    var ds = this.getDailyStats();
    var result = [];
    var n = days || 14;
    var today = new Date();
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(today.getTime() - i * 86400000);
      var key = this.getDailyKey(d);
      result.push({
        date: key,
        day: (d.getMonth() + 1) + '/' + d.getDate(),
        weekday: ['日','一','二','三','四','五','六'][d.getDay()],
        attempts: (ds[key] && ds[key].attempts) || 0,
        correct: (ds[key] && ds[key].correct) || 0,
        studyTime: (ds[key] && ds[key].studyTime) || 0
      });
    }
    return result;
  };

  /* ===== 练习模式侧边栏 ===== */
  function renderExerciseNav() {
    var html = '<div class="sec-label"><span>练习类型</span></div>';
    html += '<button class="nav-child' + (exerciseState.type==='blank'?' sel':'') + '" data-ex-type="blank">🖊️填空默写</button>';
    html += '<button class="nav-child' + (exerciseState.type==='match'?' sel':'') + '" data-ex-type="match">🧩上下句对接</button>';
    html += '<button class="nav-child' + (exerciseState.type==='situational'?' sel':'') + '" data-ex-type="situational">✨情境默写</button>';
    html += '<button class="nav-child' + (exerciseState.type==='feihua'?' sel':'') + '" data-ex-type="feihua">💐飞花令</button>';
    navEl.innerHTML = html;
    navEl.querySelectorAll('[data-ex-type]').forEach(function(btn){
      btn.onclick = function(){
        exerciseState.type = btn.getAttribute('data-ex-type');
        exerciseState.articleId = null;
        sidebarTab = 'exArt';
        searchIn.classList.remove('hidden');
        searchIn.placeholder = '搜索篇目';
        searchIn.value = '';
        hlKw = '';
        searchNav.classList.add('hidden');
        renderSidebar();
        var typeLabel = exerciseState.type === 'blank' ? '填空默写' : exerciseState.type === 'match' ? '上下句对接' : exerciseState.type === 'situational' ? '情境默写' : '飞花令';
        showPlaceholder('选择篇目开始' + typeLabel, typeLabel, '从左侧选择一篇课文');
      };
    });
  }

  function startExercise() {
    if (exerciseState.type === 'blank') startBlankExercise();
    else if (exerciseState.type === 'match') startMatchExercise();
    else if (exerciseState.type === 'pair') startPairExercise();
    else if (exerciseState.type === 'situational') startSituationalExercise();
    else if (exerciseState.type === 'feihua') startFeihuaExercise();
    renderSidebar();
  }

  /* ===== 练习模式·篇目选择 ===== */
  function renderExArtNav() {
    var html = '';
    html += '<button class="nav-child" id="exBackBtn" style="margin-bottom:4px">🔙返回练习类型</button>';
    html += '<div style="height:1px;background:var(--border);margin:8px 16px"></div>';
    html += '<button class="nav-child" data-ex-art="random" style="margin-bottom:8px;color:var(--fg)">🎲随机出题</button>';
    html += '<div class="sec-label"><span>选择篇目</span></div>';
    var kw = (searchIn.value || '').trim().toLowerCase();
    for (var i = 0; i < D.length; i++) {
      if (kw && D[i].title.toLowerCase().indexOf(kw) === -1 && D[i].author.toLowerCase().indexOf(kw) === -1) continue;
      var sel = exerciseState.articleId === D[i].id ? ' sel' : '';
      html += '<button class="sbtn' + sel + '" data-ex-art="' + D[i].id + '">' + D[i].title + ' <span style="font-size:10px;color:var(--sub)">' + D[i].author + '</span></button>';
    }
    navEl.innerHTML = html;
    document.getElementById('exBackBtn').onclick = function() {
      sidebarTab = 'exType';
      searchIn.value = '';
      searchIn.classList.add('hidden');
      hlKw = '';
      searchNav.classList.add('hidden');
      renderSidebar();
      showPlaceholder('选择练习类型开始', '互动练习', '填空默写 · 上下句对接 · 情境默写 · 飞花令');
    };
    navEl.querySelectorAll('[data-ex-art]').forEach(function(btn){
      btn.onclick = function(){
        var artId = btn.getAttribute('data-ex-art');
        if (artId === 'random') artId = null;
        exerciseState.articleId = artId;
        if (exerciseState.type === 'blank') startBlankExercise();
        else if (exerciseState.type === 'match') startMatchExercise();
        else if (exerciseState.type === 'situational') startSituationalExercise();
        else if (exerciseState.type === 'feihua') startFeihuaExercise();
        renderSidebar();
      };
    });
  }

  /* ========== 填空默写 ========== */
  function generateBlankQuestions(articleId) {
    var questions = [];
    var pool = articleId === 'random' ? D : [findArt(articleId)];
    if (articleId === 'random') {
      pool = [];
      var indices = [];
      while (indices.length < 5) {
        var r = Math.floor(Math.random() * D.length);
        if (indices.indexOf(r) < 0) indices.push(r);
      }
      for (var i = 0; i < indices.length; i++) pool.push(D[indices[i]]);
    }
    for (var pi = 0; pi < pool.length; pi++) {
      var art = pool[pi];
      if (!art) continue;
      var sentences = art.text.match(/[^。！？\n]+[。！？\n]?/g) || [];
      var picked = [];
      for (var si = 0; si < sentences.length && picked.length < 3; si++) {
        var s = sentences[si].trim();
        if (s.length > 10 && s.length < 80) picked.push(s);
      }
      if (picked.length > 3) picked = picked.slice(0, 3);
      for (var qi = 0; qi < picked.length; qi++) {
        var sentence = picked[qi];
        var chars = [];
        for (var ci = 0; ci < sentence.length; ci++) {
          if (/[\u4e00-\u9fff]/.test(sentence[ci])) chars.push(ci);
        }
        if (chars.length < 4) continue;
        var blankStart = chars[Math.floor(chars.length * 0.4)];
        var blankEnd = Math.min(blankStart + 3, sentence.length);
        while (blankEnd < sentence.length && /[\u4e00-\u9fff]/.test(sentence[blankEnd])) blankEnd++;
        blankEnd = Math.min(blankEnd, blankStart + 4);
        var blankWord = sentence.substring(blankStart, blankEnd);
        if (blankWord.length < 1 || blankWord.length > 4) continue;
        var questionText = sentence.substring(0, blankStart) + '___' + sentence.substring(blankEnd);
        questions.push({
          articleId: art.id, articleTitle: art.title,
          question: questionText, answer: blankWord, fullSentence: sentence
        });
      }
    }
    return questions;
  }

  function startBlankExercise() {
    exerciseState.questions = generateBlankQuestions(exerciseState.articleId);
    exerciseState.currentIdx = 0;
    exerciseState.answers = [];
    if (exerciseState.questions.length === 0) {
      showPlaceholder('无法生成题目', '该篇目暂无合适的填空句', '请选择其他篇目');
      return;
    }
    renderBlankQuestion();
  }

  function renderBlankQuestion() {
    hideAllViews();
    viewArt.classList.remove('hidden');
    var q = exerciseState.questions[exerciseState.currentIdx];
    var isLast = exerciseState.currentIdx >= exerciseState.questions.length - 1;
    artTitle.textContent = '填空默写 (' + (exerciseState.currentIdx + 1) + '/' + exerciseState.questions.length + ')';
    artAuthor.textContent = '出自：' + q.articleTitle;
    var html = '<div class="exercise-question">' +
      q.question.replace('___', '<input class="exercise-blank" id="blankInput" type="text" autocomplete="off">') +
      '</div>' +
      '<button class="exercise-submit" id="blankSubmit">提交</button>' +
      '<button class="exercise-btn" id="blankHint"> 提示</button>' +
      '<div id="blankResult"></div>';
    if (!isLast) {
      html += '<button class="exercise-btn" id="blankNext" style="display:none">下一题 →</button>';
    } else {
      html += '<button class="exercise-btn" id="blankSummary" style="display:none"> 查看成绩单</button>';
    }
    artBody.innerHTML = html;
    var input = document.getElementById('blankInput');
    var submitBtn = document.getElementById('blankSubmit');
    var hintBtn = document.getElementById('blankHint');
    var resultDiv = document.getElementById('blankResult');
    var nextBtn = document.getElementById('blankNext');
    var summaryBtn = document.getElementById('blankSummary');
    var hintUsed = false;
    hintBtn.onclick = function() {
      if (submitBtn.style.display === 'none') return;
      if (input.value.length === 0) {
        input.value = q.answer.charAt(0);
        hintUsed = true;
        showToast('已显示首字：' + q.answer.charAt(0), 'info');
      } else {
        var remaining = q.answer.substring(input.value.length);
        if (remaining.length > 0) {
          input.value += remaining.charAt(0);
          hintUsed = true;
          showToast('已补一字', 'info');
        } else {
          showToast('答案已完整', 'info');
        }
      }
      input.focus();
    };
    submitBtn.onclick = function() {
      var userAnswer = input.value.trim();
      var correct = userAnswer === q.answer;
      input.className = 'exercise-blank ' + (correct ? 'correct' : 'wrong');
      if (!correct) {
        input.value = q.answer;
        var hintMark = hintUsed ? '（使用过提示）' : '';
        resultDiv.innerHTML = '<div class="exercise-result wrong">错 正确答案：' + q.answer + (hintUsed ? ' <span style="font-size:12px;color:var(--orange)">注意 使用过提示</span>' : '') + '</div>';
        Store.addWrongBook({ type: 'blank', articleId: q.articleId, articleTitle: q.articleTitle, question: q.question, userAnswer: userAnswer || '（空）', correctAnswer: q.answer, hintUsed: hintUsed, timestamp: Date.now() }); pushNotice('已加入错题本', 'warn');
      } else {
        resultDiv.innerHTML = '<div class="exercise-result correct">对 正确！' + (hintUsed ? ' <span style="font-size:12px;color:var(--orange)">注意 使用过提示</span>' : '') + '</div>';
        if (hintUsed) {
          Store.addWrongBook({ type: 'blank', articleId: q.articleId, articleTitle: q.articleTitle, question: q.question, userAnswer: userAnswer, correctAnswer: q.answer, hintUsed: true, timestamp: Date.now() });
        }
      }
      submitBtn.style.display = 'none';
      hintBtn.style.display = 'none';
      input.disabled = true;
      if (nextBtn) nextBtn.style.display = 'inline-block';
      if (summaryBtn) summaryBtn.style.display = 'inline-block';
      exerciseState.answers.push({ question: q, userAnswer: userAnswer, correct: correct, hintUsed: hintUsed });
      Store.recordPractice('blank', correct);
    };
    if (nextBtn) {
      nextBtn.onclick = function() {
        exerciseState.currentIdx++;
        renderBlankQuestion();
      };
    }
    if (summaryBtn) {
      summaryBtn.onclick = function() { showExerciseSummary('blank'); };
    }
    input.onkeydown = function(e) {
      if (e.key === 'Enter' && submitBtn.style.display !== 'none') submitBtn.click();
    };
    setTimeout(function() { if (input) input.focus(); }, 100);
  }

  /* ========== 情境默写 ========== */
  function normalizeAnswer(s) {
    if (!s) return '';
    var map = { '知':'智','反':'返','阙':'缺','辟':'避','贾':'价','无':'毋','说':'悦','内':'纳','被':'披','属':'嘱' };
    s = s.replace(/[\s，。、；：""''！？·\-]/g, '');
    var result = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      var found = false;
      for (var k in map) {
        if (ch === k) { result += map[k]; found = true; break; }
      }
      if (!found) result += ch;
    }
    return result;
  }

  /* generateSituationalQuestions 已移除，全部改用 generateAISituationalQuestions */

  async function startSituationalExercise() {
    // 显示加载提示
    hideAllViews();
    viewArt.classList.remove('hidden');
    artTitle.textContent = '情境默写';
    artAuthor.textContent = 'AI 出题中…';
    artBody.innerHTML = '<div class="exercise-question" style="text-align:center;padding:48px 20px;color:var(--sub);font-size:15px;line-height:2">✨ AI 正在为您生成情境默写题目，请稍候…<br><span style="font-size:12px;color:var(--sub)">如长时间无响应，请检查「更多」中的 AI 配置</span></div>';

    // 情境默写全部改用 AI 出题
    var questions = await generateAISituationalQuestions(exerciseState.articleId);
    if (!questions || questions.length === 0) {
      showPlaceholder('无法生成题目', 'AI 情境默写生成失败', '请检查 AI 配置或稍后再试');
      return;
    }
    exerciseState.questions = questions;
    exerciseState.currentIdx = 0;
    exerciseState.answers = [];
    renderSituationalQuestion();
  }

  function renderSituationalQuestion() {
    hideAllViews();
    viewArt.classList.remove('hidden');
    var q = exerciseState.questions[exerciseState.currentIdx];
    var isLast = exerciseState.currentIdx >= exerciseState.questions.length - 1;
    artTitle.textContent = '情境默写 (' + (exerciseState.currentIdx + 1) + '/' + exerciseState.questions.length + ')';
    artAuthor.textContent = '出自：' + q.articleTitle;
    var scenarioHtml = q.scenario.replace(/______/g, '<input class="exercise-blank sq-blank" type="text" autocomplete="off">');
    var html = '<div class="exercise-question" style="font-size:18px">' + scenarioHtml + '</div>' +
      '<button class="exercise-submit" id="sqSubmit">提交</button>' +
      '<button class="exercise-btn" id="sqHint"> 提示</button>' +
      '<div id="sqResult"></div>';
    if (!isLast) {
      html += '<button class="exercise-btn" id="sqNext" style="display:none">下一题 →</button>';
    } else {
      html += '<button class="exercise-btn" id="sqSummary" style="display:none"> 查看成绩单</button>';
    }
    artBody.innerHTML = html;
    var inputs = artBody.querySelectorAll('.sq-blank');
    var submitBtn = document.getElementById('sqSubmit');
    var hintBtn = document.getElementById('sqHint');
    var resultDiv = document.getElementById('sqResult');
    var nextBtn = document.getElementById('sqNext');
    var summaryBtn = document.getElementById('sqSummary');
    var hintUsed = false;
    hintBtn.onclick = function() {
      if (submitBtn.style.display === 'none') return;
      hintUsed = true;
      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        var correctAns = q.answers[i] || '';
        var currentVal = inp.value.trim();
        if (normalizeAnswer(currentVal) !== normalizeAnswer(correctAns)) {
          if (currentVal.length < correctAns.length) {
            inp.value = correctAns.substring(0, currentVal.length + 1);
            showToast('已补一字', 'info');
          } else {
            inp.value = correctAns;
            showToast('已显示完整答案', 'info');
          }
          inp.focus();
          return;
        }
      }
      showToast('所有空已填完整', 'info');
    };
    submitBtn.onclick = function() {
      var userAnswers = [];
      var correctCount = 0;
      for (var i = 0; i < inputs.length; i++) {
        var val = inputs[i].value.trim();
        userAnswers.push(val);
        var isCorrect = normalizeAnswer(val) === normalizeAnswer(q.answers[i]);
        if (isCorrect) {
          inputs[i].className = 'exercise-blank sq-blank correct';
          correctCount++;
        } else {
          inputs[i].className = 'exercise-blank sq-blank wrong';
          inputs[i].value = q.answers[i];
        }
        inputs[i].disabled = true;
      }
      var allCorrect = correctCount === inputs.length;
      var resultHtml = '';
      if (allCorrect) {
        resultHtml = '<div class="exercise-result correct">对 全部正确！' + (hintUsed ? ' <span style="font-size:12px;color:var(--orange)">注意 使用过提示</span>' : '') + '</div>';
      } else {
        resultHtml = '<div class="exercise-result wrong">错 正确 ' + correctCount + '/' + inputs.length + ' 空</div>';
        resultHtml += '<div style="margin-top:8px;padding:10px;background:var(--bg);border-left:3px solid var(--pri);font-size:13px;color:var(--sub);font-family:\'Microsoft YaHei\',sans-serif"><strong> 解析：</strong>' + renderMarkdown(q.explanation) + '</div>';
      }
      resultDiv.innerHTML = resultHtml;
      submitBtn.style.display = 'none';
      hintBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'inline-block';
      if (summaryBtn) summaryBtn.style.display = 'inline-block';
      if (!allCorrect || hintUsed) {
        Store.addWrongBook({
          type: 'situational',
          articleId: q.articleId,
          articleTitle: q.articleTitle,
          question: q.scenario,
          userAnswer: userAnswers.join(' / '),
          correctAnswer: q.answers.join(' / '),
          hintUsed: hintUsed,
          timestamp: Date.now()
        });
        if (!allCorrect) pushNotice('已加入错题本', 'warn');
      }
      exerciseState.answers.push({
        question: q,
        userAnswer: userAnswers.join(' / '),
        correct: allCorrect,
        hintUsed: hintUsed,
        correctCount: correctCount,
        totalBlanks: inputs.length
      });
      Store.recordPractice('situational', allCorrect);
    };
    if (nextBtn) {
      nextBtn.onclick = function() {
        exerciseState.currentIdx++;
        renderSituationalQuestion();
      };
    }
    if (summaryBtn) {
      summaryBtn.onclick = function() { showExerciseSummary('situational'); };
    }
    for (var k = 0; k < inputs.length; k++) {
      (function(inp){
        inp.onkeydown = function(e) {
          if (e.key === 'Enter' && submitBtn.style.display !== 'none') submitBtn.click();
        };
      })(inputs[k]);
    }
    setTimeout(function() { if (inputs[0]) inputs[0].focus(); }, 100);
  }

  /* ========== 上下句对接 ========== */
  function generateMatchQuestions(articleId) {
    var questions = [];
    var pool = articleId === 'random' ? D : [findArt(articleId)];
    if (articleId === 'random') {
      pool = [];
      var indices = [];
      while (indices.length < 5) {
        var r = Math.floor(Math.random() * D.length);
        if (indices.indexOf(r) < 0) indices.push(r);
      }
      for (var i = 0; i < indices.length; i++) pool.push(D[indices[i]]);
    }
    for (var pi = 0; pi < pool.length; pi++) {
      var art = pool[pi];
      if (!art) continue;
      var sentences = art.text.match(/[^。！？\n]+[。！？\n]?/g) || [];
      if (sentences.length < 2) continue;
      for (var si = 0; si < sentences.length - 1; si++) {
        var s1 = sentences[si].trim();
        var s2 = sentences[si + 1].trim();
        if (s1.length > 6 && s2.length > 6 && s1.length < 60 && s2.length < 60) {
          var distractors = [];
          for (var di = 0; di < sentences.length && distractors.length < 3; di++) {
            if (di !== si + 1) {
              var d = sentences[di].trim();
              if (d.length > 4 && d !== s2 && distractors.indexOf(d) < 0) distractors.push(d);
            }
          }
          if (distractors.length < 2) {
            for (var oi = 0; oi < D.length && distractors.length < 3; oi++) {
              if (D[oi].id === art.id) continue;
              var os = D[oi].text.match(/[^。！？\n]+[。！？\n]?/g) || [];
              var rds = os[Math.floor(Math.random() * os.length)];
              if (rds && rds.trim().length > 4 && distractors.indexOf(rds.trim()) < 0) distractors.push(rds.trim());
            }
          }
          var options = [s2].concat(distractors.slice(0, 3));
          for (var fi = options.length - 1; fi > 0; fi--) {
            var j = Math.floor(Math.random() * (fi + 1));
            var tmp = options[fi]; options[fi] = options[j]; options[j] = tmp;
          }
          questions.push({
            articleId: art.id, articleTitle: art.title,
            upperSentence: s1, correctAnswer: s2, options: options
          });
          break;
        }
      }
    }
    return questions;
  }

  function startMatchExercise() {
    exerciseState.questions = generateMatchQuestions(exerciseState.articleId);
    exerciseState.currentIdx = 0;
    exerciseState.answers = [];
    if (exerciseState.questions.length === 0) {
      showPlaceholder('无法生成题目', '该篇目暂无合适的句对', '请选择其他篇目');
      return;
    }
    renderMatchQuestion();
  }

  function renderMatchQuestion() {
    hideAllViews();
    viewArt.classList.remove('hidden');
    var q = exerciseState.questions[exerciseState.currentIdx];
    var isLast = exerciseState.currentIdx >= exerciseState.questions.length - 1;
    artTitle.textContent = '上下句对接 (' + (exerciseState.currentIdx + 1) + '/' + exerciseState.questions.length + ')';
    artAuthor.textContent = '出自：' + q.articleTitle;
    var html = '<div class="exercise-question"><strong>上句：</strong>' + q.upperSentence + '</div>';
    html += '<div class="exercise-options" id="matchOptions">';
    for (var oi = 0; oi < q.options.length; oi++) {
      html += '<button class="exercise-option" data-opt="' + oi + '">' + q.options[oi] + '</button>';
    }
    html += '</div>';
    html += '<button class="exercise-btn warn" id="matchSkip" style="margin-top:12px">下 跳过</button>';
    html += '<div id="matchResult"></div>';
    artBody.innerHTML = html;
    var selected = -1;
    var answered = false;
    var optionBtns = artBody.querySelectorAll('.exercise-option');
    var skipBtn = document.getElementById('matchSkip');
    function finishQuestion(userAnswer, correct, skipped) {
      if (answered) return;
      answered = true;
      if (skipBtn) skipBtn.style.display = 'none';
      var resultDiv = document.getElementById('matchResult');
      if (skipped) {
        optionBtns.forEach(function(b, i) {
          if (q.options[i] === q.correctAnswer) b.classList.add('correct');
        });
        resultDiv.innerHTML = '<div class="exercise-result wrong">下 已跳过 · 正确答案已标绿</div>';
        Store.addWrongBook({ type: 'match', articleId: q.articleId, articleTitle: q.articleTitle, question: q.upperSentence, userAnswer: '（已跳过）', correctAnswer: q.correctAnswer, skipped: true, timestamp: Date.now() }); pushNotice('已跳过，加入错题本', 'warn');
      } else if (correct) {
        resultDiv.innerHTML = '<div class="exercise-result correct">对 正确！</div>';
      } else {
        Store.addWrongBook({ type: 'match', articleId: q.articleId, articleTitle: q.articleTitle, question: q.upperSentence, userAnswer: userAnswer, correctAnswer: q.correctAnswer, timestamp: Date.now() }); pushNotice('已加入错题本', 'warn');
      }
      exerciseState.answers.push({ question: q, userAnswer: userAnswer, correct: correct, skipped: skipped });
      Store.recordPractice('match', correct);
      var btnLabel = isLast ? ' 查看成绩单' : '下一题 →';
      var btnId = isLast ? 'matchSummary' : 'matchNext';
      resultDiv.insertAdjacentHTML('beforeend', '<button class="exercise-submit" id="' + btnId + '" style="margin-top:8px">' + btnLabel + '</button>');
      document.getElementById(btnId).onclick = function() {
        if (isLast) { showExerciseSummary('match'); return; }
        exerciseState.currentIdx++;
        renderMatchQuestion();
      };
    }
    skipBtn.onclick = function() { finishQuestion('（已跳过）', false, true); };
    optionBtns.forEach(function(btn, idx) {
      btn.onclick = function() {
        if (answered) return;
        selected = idx;
        btn.classList.add('selected');
        var correct = q.options[idx] === q.correctAnswer;
        if (correct) {
          btn.classList.add('correct');
        } else {
          btn.classList.add('wrong');
          optionBtns.forEach(function(b, i) {
            if (q.options[i] === q.correctAnswer) b.classList.add('correct');
          });
          document.getElementById('matchResult').innerHTML = '<div class="exercise-result wrong">错 正确答案已标绿</div>';
        }
        finishQuestion(q.options[idx], correct, false);
      };
    });
  }

  /* ========== 作者配对 ========== */
  function startPairExercise() {
    var indices = [];
    while (indices.length < 8) {
      var r = Math.floor(Math.random() * D.length);
      if (indices.indexOf(r) < 0) indices.push(r);
    }
    var pairs = [];
    for (var i = 0; i < indices.length; i++) {
      pairs.push({ title: D[indices[i]].title, author: D[indices[i]].author, articleId: D[indices[i]].id });
    }
    var shuffledAuthors = pairs.map(function(p) { return p.author; });
    for (var fi = shuffledAuthors.length - 1; fi > 0; fi--) {
      var j = Math.floor(Math.random() * (fi + 1));
      var tmp = shuffledAuthors[fi]; shuffledAuthors[fi] = shuffledAuthors[j]; shuffledAuthors[j] = tmp;
    }
    exerciseState.questions = pairs;
    exerciseState.shuffledAuthors = shuffledAuthors;
    exerciseState.answers = [];
    exerciseState.currentIdx = 0;
    renderPairExercise(pairs, shuffledAuthors);
  }

  function renderPairExercise(pairs, shuffledAuthors) {
    hideAllViews();
    viewArt.classList.remove('hidden');
    artTitle.textContent = '作者配对';
    artAuthor.textContent = '点击篇目再点击作者进行配对';
    var html = '<div style="display:flex;gap:24px;flex-wrap:wrap">';
    html += '<div style="flex:1;min-width:200px"><h3 style="margin-bottom:12px;font-family:\'Microsoft YaHei\',sans-serif;font-size:15px;color:var(--sub)">篇目</h3>';
    for (var i = 0; i < pairs.length; i++) {
      html += '<div class="exercise-option pair-title" data-pair-idx="' + i + '" style="margin-bottom:6px">' + pairs[i].title + '</div>';
    }
    html += '</div>';
    html += '<div style="flex:1;min-width:200px"><h3 style="margin-bottom:12px;font-family:\'Microsoft YaHei\',sans-serif;font-size:15px;color:var(--sub)">作者</h3>';
    for (var j = 0; j < shuffledAuthors.length; j++) {
      html += '<div class="exercise-option pair-author" data-author="' + shuffledAuthors[j].replace(/"/g, '&quot;') + '" style="margin-bottom:6px">' + shuffledAuthors[j] + '</div>';
    }
    html += '</div></div>';
    html += '<button class="exercise-submit" id="pairSubmit" style="margin-top:16px">提交</button>';
    html += '<button class="exercise-btn" id="pairReshuffle" style="margin-top:16px"> 重新排列</button>';
    html += '<button class="exercise-btn warn" id="pairClear" style="margin-top:16px;display:none">↺ 清除配对</button>';
    html += '<div id="pairResult"></div>';
    artBody.innerHTML = html;
    var selectedTitle = null;
    var pairMap = {};
    var pairSubmitBtn = document.getElementById('pairSubmit');
    var pairReshuffleBtn = document.getElementById('pairReshuffle');
    var pairClearBtn = document.getElementById('pairClear');
    function updateClearBtnVisibility() {
      var hasMatch = false;
      for (var k in pairMap) { hasMatch = true; break; }
      pairClearBtn.style.display = hasMatch ? 'inline-block' : 'none';
    }
    artBody.querySelectorAll('.pair-title').forEach(function(btn) {
      btn.onclick = function() {
        artBody.querySelectorAll('.pair-title').forEach(function(b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        selectedTitle = parseInt(btn.getAttribute('data-pair-idx'));
      };
    });
    artBody.querySelectorAll('.pair-author').forEach(function(btn) {
      btn.onclick = function() {
        if (selectedTitle === null) return;
        var author = btn.getAttribute('data-author');
        pairMap[selectedTitle] = author;
        var titleBtns = artBody.querySelectorAll('.pair-title');
        titleBtns[selectedTitle].textContent = pairs[selectedTitle].title + ' → ' + author;
        titleBtns[selectedTitle].classList.remove('selected');
        titleBtns[selectedTitle].style.opacity = '0.6';
        selectedTitle = null;
        updateClearBtnVisibility();
      };
    });
    pairReshuffleBtn.onclick = function() {
      var newShuffled = pairs.map(function(p) { return p.author; });
      for (var fi = newShuffled.length - 1; fi > 0; fi--) {
        var j = Math.floor(Math.random() * (fi + 1));
        var tmp = newShuffled[fi]; newShuffled[fi] = newShuffled[j]; newShuffled[j] = tmp;
      }
      // 避免与原顺序完全相同
      var sameAsOriginal = true;
      for (var si = 0; si < newShuffled.length; si++) {
        if (newShuffled[si] !== shuffledAuthors[si]) { sameAsOriginal = false; break; }
      }
      if (sameAsOriginal && newShuffled.length > 1) {
        var tmp2 = newShuffled[0]; newShuffled[0] = newShuffled[1]; newShuffled[1] = tmp2;
      }
      exerciseState.shuffledAuthors = newShuffled;
      pairMap = {};
      selectedTitle = null;
      renderPairExercise(pairs, newShuffled);
      showToast('作者已重新排列', 'info');
    };
    pairClearBtn.onclick = function() {
      pairMap = {};
      selectedTitle = null;
      artBody.querySelectorAll('.pair-title').forEach(function(b, i) {
        b.textContent = pairs[i].title;
        b.classList.remove('selected');
        b.style.opacity = '1';
      });
      updateClearBtnVisibility();
      showToast('已清除所有配对', 'info');
    };
    pairSubmitBtn.onclick = function() {
      var correctCount = 0;
      var resultHtml = '';
      exerciseState.answers = [];
      for (var i = 0; i < pairs.length; i++) {
        var userAuthor = pairMap[i] || '（未作答）';
        var correct = userAuthor === pairs[i].author;
        if (correct) correctCount++;
        exerciseState.answers.push({ question: { articleTitle: pairs[i].title, correctAnswer: pairs[i].author, question: pairs[i].title }, userAnswer: userAuthor, correct: correct });
        resultHtml += '<div class="summary-row ' + (correct ? 'correct' : 'wrong') + '">' +
          '<div class="q">' + pairs[i].title + '</div>' +
          '<div class="a">' + (correct ? '' : '<span class="ua">' + userAuthor + '</span>') + '<span class="ca">' + pairs[i].author + '</span>' + (correct ? ' 对' : '') + '</div>' +
          '</div>';
        if (!correct) {
          Store.addWrongBook({ type: 'pair', articleId: pairs[i].articleId, question: pairs[i].title, userAnswer: userAuthor, correctAnswer: pairs[i].author, timestamp: Date.now() }); pushNotice('已加入错题本', 'warn');
        }
        Store.recordPractice('pair', correct);
      }
      var pct = Math.round(correctCount / pairs.length * 100);
      var summaryHtml = '<div class="exercise-result ' + (pct >= 80 ? 'correct' : 'wrong') + '">正确率：' + correctCount + '/' + pairs.length + ' (' + pct + '%)</div>';
      summaryHtml += '<div class="exercise-summary"><h4> 成绩单</h4>' + resultHtml + '</div>';
      summaryHtml += '<button class="exercise-submit" id="pairAgain" style="margin-top:12px"> 再来一组</button>';
      document.getElementById('pairResult').innerHTML = summaryHtml;
      pairSubmitBtn.style.display = 'none';
      pairReshuffleBtn.style.display = 'none';
      pairClearBtn.style.display = 'none';
      document.getElementById('pairAgain').onclick = function() { startPairExercise(); };
    };
  }

  /* ========== 飞花令 ========== */
  var feihuaTimer = null;
  var feihuaRoundToken = 0;
  var feihuaCorpus = [];
  var feihuaNormCorpus = [];
  function clearFeihuaTimer() {
    if (feihuaTimer) { clearInterval(feihuaTimer); feihuaTimer = null; }
  }

  // 从篇目文本抽取诗句（按句末标点切分），作为飞花令字库与示例来源
  function buildFeihuaCorpus(articleId) {
    var pool = articleId ? [findArt(articleId)] : D;
    var verses = [];
    for (var i = 0; i < pool.length; i++) {
      var art = pool[i];
      if (!art || !art.text) continue;
      var sentences = art.text.match(/[^。！？\n]+[。！？\n]?/g) || [];
      for (var s = 0; s < sentences.length; s++) {
        var v = sentences[s].trim();
        if (v.length >= 5) verses.push({ verse: v, title: art.title, articleId: art.id });
      }
    }
    return verses;
  }

  // 统计字频（按句去重），挑选在 >=2 句中出现过的字作为飞花令关键字
  function pickFeihuaChar(corpus) {
    var freq = {};
    for (var i = 0; i < corpus.length; i++) {
      var v = corpus[i].verse;
      var seen = {};
      for (var c = 0; c < v.length; c++) {
        var ch = v[c];
        if (/[\u4e00-\u9fff]/.test(ch) && !seen[ch]) { seen[ch] = true; freq[ch] = (freq[ch] || 0) + 1; }
      }
    }
    var candidates = [];
    for (var k in freq) { if (freq[k] >= 2) candidates.push(k); }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function feihuaExamplesFor(char, corpus, limit) {
    var res = [];
    for (var i = 0; i < corpus.length && res.length < (limit || 3); i++) {
      if (corpus[i].verse.indexOf(char) >= 0) res.push(corpus[i]);
    }
    return res;
  }

  function normalizeLight(s) {
    if (!s) return '';
    return s.replace(/[\s，。、；：""''！？·\-（）()]/g, '');
  }

  // 判断输入（已归一化）是否为已收录篇目中的真实诗句片段，防止无意义输入蒙混过关
  function isFeihuaRealVerse(normInput) {
    for (var i = 0; i < feihuaNormCorpus.length; i++) {
      if (feihuaNormCorpus[i].indexOf(normInput) >= 0) return true;
    }
    return false;
  }

  var feihuaRun = { attempts: 0, hits: 0, streak: 0, best: 0 };

  function startFeihuaExercise() {
    clearFeihuaTimer();
    exerciseState.questions = [];
    exerciseState.answers = [];
    exerciseState.currentIdx = 0;
    var corpus = buildFeihuaCorpus(exerciseState.articleId);
    if (corpus.length < 3) {
      showPlaceholder('无法开始飞花令', '该篇目诗句不足以出题', '请选择其他篇目或「随机出题」');
      return;
    }
    feihuaCorpus = corpus;
    feihuaNormCorpus = [];
    for (var ni = 0; ni < corpus.length; ni++) feihuaNormCorpus.push(normalizeLight(corpus[ni].verse));
    feihuaRun = { attempts: 0, hits: 0, streak: 0, best: Store.getFeihuaBest(), roundBest: 0 };
    renderFeihuaRound();
  }

  function renderFeihuaRound() {
    clearFeihuaTimer();
    var char = pickFeihuaChar(feihuaCorpus);
    if (!char) { showPlaceholder('无法开始飞花令', '未找到合适的字', '请返回重试'); return; }
    var myToken = ++feihuaRoundToken;
    var timeLeft = 45;
    var answered = false;
    var examples = feihuaExamplesFor(char, feihuaCorpus, 3);

    hideAllViews();
    viewArt.classList.remove('hidden');
    artTitle.textContent = '飞花令';
    artAuthor.textContent = '限时说出含「' + char + '」的诗句';
    var html = '<div class="feihua-wrap">' +
      '<div class="feihua-timer"><div class="feihua-timer-bar" id="feihuaBar"></div></div>' +
      '<div class="feihua-meta"><span>剩余 <b id="feihuaTime">' + timeLeft + '</b> 秒</span><span>本局连击 <b id="feihuaStreak">' + feihuaRun.streak + '</b></span><span>最佳 <b>' + feihuaRun.best + '</b></span></div>' +
      '<div class="feihua-char-box"><div class="feihua-char" id="feihuaChar">' + char + '</div><div class="feihua-char-label">请说出一句包含此字的古诗文</div></div>' +
      '<input class="feihua-input" id="feihuaInput" type="text" autocomplete="off" placeholder="在此输入诗句…">' +
      '<button class="exercise-submit" id="feihuaSubmit">提交</button>' +
      '<button class="exercise-btn" id="feihuaSkip"> 换一字（认输）</button>' +
      '<button class="exercise-btn" id="feihuaEnd"> 结束本局</button>' +
      '<div id="feihuaResult"></div>' +
      '<div class="feihua-examples" id="feihuaExamples" style="display:none"><div class="fe-title">示例（含「' + char + '」）：</div></div>' +
      '</div>';
    artBody.innerHTML = html;

    var input = document.getElementById('feihuaInput');
    var submitBtn = document.getElementById('feihuaSubmit');
    var skipBtn = document.getElementById('feihuaSkip');
    var endBtn = document.getElementById('feihuaEnd');
    var resultDiv = document.getElementById('feihuaResult');
    var examplesBox = document.getElementById('feihuaExamples');
    var timeEl = document.getElementById('feihuaTime');
    var barEl = document.getElementById('feihuaBar');
    var streakEl = document.getElementById('feihuaStreak');

    function showExamples() {
      if (examplesBox.style.display !== 'none') return;
      examplesBox.style.display = 'block';
      for (var i = 0; i < examples.length; i++) {
        var d = document.createElement('div');
        d.className = 'fe-item';
        d.innerHTML = examples[i].verse + '<span class="fe-from">— ' + examples[i].title + '</span>';
        examplesBox.appendChild(d);
      }
    }

    function appendControls() {
      var cont = document.createElement('button');
      cont.className = 'exercise-btn';
      cont.textContent = ' 下一字 →';
      cont.style.marginTop = '12px';
      cont.onclick = function() { if (myToken !== feihuaRoundToken) return; renderFeihuaRound(); };
      var endNow = document.createElement('button');
      endNow.className = 'exercise-submit';
      endNow.textContent = ' 结束本局';
      endNow.style.marginTop = '12px';
      endNow.style.marginLeft = '8px';
      endNow.onclick = function() { if (myToken !== feihuaRoundToken) return; showFeihuaSummary(); };
      resultDiv.appendChild(cont);
      resultDiv.appendChild(endNow);
    }

    function finish(correct, isTimeout, wrongMsg) {
      if (answered) return;
      answered = true;
      clearFeihuaTimer();
      feihuaRun.attempts++;
      submitBtn.style.display = 'none';
      skipBtn.style.display = 'none';
      endBtn.style.display = 'none';
      input.disabled = true;
      if (correct) {
        feihuaRun.hits++;
        feihuaRun.streak++;
        if (feihuaRun.streak > feihuaRun.roundBest) feihuaRun.roundBest = feihuaRun.streak;
        if (feihuaRun.streak > feihuaRun.best) { feihuaRun.best = feihuaRun.streak; Store.setFeihuaBest(feihuaRun.best); }
        streakEl.textContent = feihuaRun.streak;
        Store.recordPractice('feihua', true);
        resultDiv.innerHTML = '<div class="exercise-result correct">对！连击 +1（' + feihuaRun.streak + '）</div>';
      } else {
        feihuaRun.streak = 0;
        streakEl.textContent = '0';
        Store.recordPractice('feihua', false);
        resultDiv.innerHTML = '<div class="exercise-result wrong">' + (isTimeout ? '时间到！' : (wrongMsg || '未包含「' + char + '」')) + ' 连击清零</div>';
      }
      showExamples();
      appendControls();
    }

    submitBtn.onclick = function() {
      var val = normalizeLight(input.value);
      var hasChar = val.indexOf(char) >= 0;
      var lenOk = val.length >= 4;
      var isReal = isFeihuaRealVerse(val);
      var correct = hasChar && lenOk && isReal;
      var wrongMsg;
      if (!hasChar) wrongMsg = '未包含「' + char + '」';
      else if (!lenOk) wrongMsg = '诗句过短（至少 4 字）';
      else if (!isReal) wrongMsg = '未收录该诗句';
      finish(correct, false, wrongMsg);
    };
    input.onkeydown = function(e) {
      if (e.key === 'Enter' && !answered) submitBtn.click();
    };
    skipBtn.onclick = function() {
      if (answered) return;
      answered = true;
      clearFeihuaTimer();
      feihuaRun.attempts++;
      feihuaRun.streak = 0;
      streakEl.textContent = '0';
      Store.recordPractice('feihua', false);
      submitBtn.style.display = 'none';
      skipBtn.style.display = 'none';
      endBtn.style.display = 'none';
      input.disabled = true;
      resultDiv.innerHTML = '<div class="exercise-result wrong">已认输，连击清零</div>';
      showExamples();
      appendControls();
    };
    endBtn.onclick = function() { if (myToken !== feihuaRoundToken) return; clearFeihuaTimer(); showFeihuaSummary(); };

    // 倒计时（限时说出）
    feihuaTimer = setInterval(function() {
      if (myToken !== feihuaRoundToken) { clearFeihuaTimer(); return; }
      if (!document.getElementById('feihuaInput')) { clearFeihuaTimer(); return; }
      timeLeft--;
      if (timeEl) timeEl.textContent = timeLeft;
      if (barEl) barEl.style.width = (timeLeft / 45 * 100) + '%';
      if (timeLeft <= 0) { clearFeihuaTimer(); finish(false, true); }
    }, 1000);

    setTimeout(function() { if (input && !answered) input.focus(); }, 100);
  }

  function showFeihuaSummary() {
    clearFeihuaTimer();
    hideAllViews();
    viewArt.classList.remove('hidden');
    var runPct = feihuaRun.attempts > 0 ? Math.round(feihuaRun.hits / feihuaRun.attempts * 100) : 0;
    artTitle.textContent = '飞花令 · 本局成绩';
    artAuthor.textContent = '命中 ' + feihuaRun.hits + '/' + feihuaRun.attempts + ' · 正确率 ' + runPct + '%';
    var html = '<div class="feihua-summary">' +
      '<div class="big">' + feihuaRun.roundBest + '</div>' +
      '<div class="row">本局最高连击</div>' +
      '<div style="height:14px"></div>' +
      '<div class="exercise-summary" style="text-align:left;max-width:420px;margin:0 auto">' +
        '<div class="summary-row"><div class="q">总作答</div><div class="a">' + feihuaRun.attempts + ' 次</div></div>' +
        '<div class="summary-row correct"><div class="q">命中</div><div class="a">' + feihuaRun.hits + ' 次</div></div>' +
        '<div class="summary-row"><div class="q">本局正确率</div><div class="a">' + runPct + '%</div></div>' +
        '<div class="summary-row"><div class="q">历史最佳连击</div><div class="a">' + Store.getFeihuaBest() + ' 连</div></div>' +
      '</div>' +
      '<div style="margin-top:18px">' +
      '<button class="exercise-submit" id="feihuaAgain"> 再来一局</button>' +
      '<button class="exercise-btn" id="feihuaBack" style="margin-left:8px">← 返回练习类型</button>' +
      '</div></div>';
    artBody.innerHTML = html;
    document.getElementById('feihuaAgain').onclick = function() { startFeihuaExercise(); };
    document.getElementById('feihuaBack').onclick = function() {
      sidebarTab = 'exType';
      searchIn.value = '';
      searchIn.classList.add('hidden');
      hlKw = '';
      searchNav.classList.add('hidden');
      renderSidebar();
      showPlaceholder('选择练习类型开始', '互动练习', '填空默写 · 上下句对接 · 情境默写 · 飞花令');
    };
  }

  /* ========== 练习成绩单 ========== */
  function showExerciseSummary(type) {
    hideAllViews();
    viewArt.classList.remove('hidden');
    var answers = exerciseState.answers || [];
    var correctCount = 0;
    for (var i = 0; i < answers.length; i++) {
      if (answers[i].correct) correctCount++;
    }
    var pct = answers.length > 0 ? Math.round(correctCount / answers.length * 100) : 0;
    var typeLabel = type === 'blank' ? '填空默写' : type === 'match' ? '上下句对接' : type === 'situational' ? '情境默写' : '练习';
    artTitle.textContent = typeLabel + ' · 成绩单';
    artAuthor.textContent = correctCount + '/' + answers.length + ' 正确';
    var html = '<div class="exercise-result ' + (pct >= 80 ? 'correct' : 'wrong') + '" style="font-size:18px;padding:16px 24px;text-align:center">正确率：' + correctCount + '/' + answers.length + ' (' + pct + '%)</div>';
    var encourage = '';
    if (pct === 100) encourage = ' 全对！太棒了！';
    else if (pct >= 80) encourage = ' 表现出色！继续保持';
    else if (pct >= 60) encourage = ' 继续加油，多读几遍';
    else if (pct > 0) encourage = ' 建议重新阅读后再练';
    else encourage = ' 别灰心，从阅读开始吧';
    html += '<div style="text-align:center;font-family:\'Microsoft YaHei\',sans-serif;color:var(--sub);margin:12px 0;font-size:14px">' + encourage + '</div>';
    html += '<div class="exercise-summary"><h4> 详细正误</h4>';
    for (var j = 0; j < answers.length; j++) {
      var a = answers[j];
      var q = a.question || {};
      var rowClass = a.correct ? 'correct' : 'wrong';
      var questionText = '';
      var userAnsText = a.skipped ? '（已跳过）' : (a.userAnswer || '（空）');
      var correctAnsText = '';
      if (type === 'blank') {
        questionText = (q.question || '').replace('___', '【空】') + ' · 《' + (q.articleTitle || '') + '》';
        correctAnsText = q.answer || q.correctAnswer || '';
      } else if (type === 'match') {
        questionText = '上句：' + (q.upperSentence || '') + ' · 《' + (q.articleTitle || '') + '》';
        correctAnsText = q.correctAnswer || '';
      } else if (type === 'situational') {
        questionText = (q.scenario || q.question || '').replace(/______/g, '＿＿') + ' · 《' + (q.articleTitle || '') + '》';
        correctAnsText = (q.answers && q.answers.length) ? q.answers.join(' / ') : (q.correctAnswer || '');
      } else {
        questionText = q.question || '';
        correctAnsText = q.correctAnswer || q.answer || '';
      }
      html += '<div class="summary-row ' + rowClass + '">';
      html += '<div class="q">' + (j + 1) + '. ' + questionText + (a.hintUsed ? ' <span style="color:var(--orange);font-size:11px">注意使用提示</span>' : '') + '</div>';
      html += '<div class="a">';
      if (!a.correct) html += '<span class="ua">' + userAnsText + '</span>';
      html += '<span class="ca">' + correctAnsText + '</span>';
      if (a.correct) html += ' 对';
      html += '</div>';
      html += '</div>';
    }
    html += '</div>';
    html += '<div style="margin-top:16px">';
    html += '<button class="exercise-submit" id="summaryRetry"> 再来一组</button>';
    html += '<button class="exercise-btn" id="summaryBack">← 返回练习菜单</button>';
    html += '</div>';
    artBody.innerHTML = html;
    document.getElementById('summaryRetry').onclick = function() {
      if (type === 'blank') startBlankExercise();
      else if (type === 'match') startMatchExercise();
      else if (type === 'situational') startSituationalExercise();
    };
    document.getElementById('summaryBack').onclick = function() {
      sidebarTab = 'exType';
      searchIn.classList.add('hidden');
      renderSidebar();
      showPlaceholder('选择练习类型开始', '互动练习', '填空默写 · 上下句对接 · 情境默写 · 飞花令');
    };
    artBody.scrollTop = 0;
    Store.updateStreak();
  }

  /* ========== 错题本 ========== */
  function showWrongBook() {
    hideAllViews();
    viewArt.classList.remove('hidden');
    artTitle.textContent = '错题本';
    artAuthor.textContent = '';
    var wb = Store.getWrongBook();
    if (wb.length === 0) {
      artBody.innerHTML = '<div class="empty-state"><div class="icon"></div><div class="title">暂无错题</div><div class="desc">完成练习后，错题会自动记录在这里</div><button class="exercise-submit" id="goPracticeBtn" style="margin-top:20px">去练习 →</button></div>';
      var goBtn = document.getElementById('goPracticeBtn');
      if (goBtn) goBtn.onclick = function(){
        setSystemMode('exercise');
      };
      return;
    }
    var todayWrongCount = Store.getTodayWrongReviews().length;
    var html = '';
    if (todayWrongCount > 0) {
      html += '<div style="margin-bottom:16px;padding:16px;background:linear-gradient(135deg,rgba(255,152,0,.15),rgba(255,152,0,.05));border:1px solid var(--border);border-radius:8px;font-family:\'Microsoft YaHei\',sans-serif">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
        '<div><div style="font-size:15px;font-weight:600;color:var(--fg)"> 今日待复习错题 <span style="color:var(--warn)">' + todayWrongCount + '</span> 道</div>' +
        '<div style="font-size:12px;color:var(--sub);margin-top:4px">间隔复习：答对升级间隔，最高级掌握后自动清除</div></div>' +
        '<button class="exercise-submit" id="startWrongReviewBtn" style="margin:0;flex-shrink:0;white-space:nowrap">开始重练</button>' +
        '</div></div>';
    } else {
      html += '<div style="margin-bottom:16px;padding:14px;background:rgba(76,175,80,.1);border:1px solid #4caf50;border-radius:8px;font-family:\'Microsoft YaHei\',sans-serif;font-size:13px;color:#4caf50;text-align:center">对 今日错题已全部复习完，继续保持！</div>';
    }
    html += '<div style="font-family:\'Microsoft YaHei\',sans-serif;font-size:13px;color:var(--sub);margin-bottom:12px">共 ' + wb.length + ' 道错题</div>';
    for (var i = wb.length - 1; i >= 0; i--) {
      var item = wb[i];
      var typeLabel = item.type === 'blank' ? '填空' : item.type === 'match' ? '对接' : item.type === 'situational' ? '情境' : '配对';
      var dueMs = item.nextReviewDate ? item.nextReviewDate - Date.now() : 0;
      var dueLabel = dueMs > 0 ? ' · ' + Math.ceil(dueMs / 86400000) + '天后复习' : ' · 待复习';
      html += '<div class="wrongbook-item">' +
        '<div style="font-size:11px;color:var(--muted-fg);margin-bottom:4px">' + typeLabel + ' · ' + (item.articleTitle || '') + dueLabel + '</div>' +
        '<div class="question">' + (item.question || '').replace(/______/g, '＿＿').replace(/___/g, '＿＿') + '</div>' +
        '<div class="answer">你的答案：<span style="color:#f44336">' + (item.userAnswer || '（未作答）') + '</span></div>' +
        '<div class="correct-answer">正确答案：' + item.correctAnswer + '</div>' +
        '</div>';
    }
    artBody.innerHTML = html;
    var swrBtn = document.getElementById('startWrongReviewBtn');
    if (swrBtn) swrBtn.onclick = function() { startWrongReview(); };
  }

  /* ========== 错题重练模式 ========== */
  var wrongReviewState = { correctCount: 0, totalCount: 0, masteredCount: 0, maxCount: 10, results: [] };
  var WR_INTERVAL_LABELS = ['1 天后','3 天后','7 天后','14 天后','30 天后'];

  function startWrongReview() {
    wrongReviewState.correctCount = 0;
    wrongReviewState.totalCount = 0;
    wrongReviewState.masteredCount = 0;
    wrongReviewState.results = [];
    renderWrongReviewQuestion();
  }

  function renderWrongReviewQuestion() {
    var indices = Store.getTodayWrongReviews();
    if (wrongReviewState.totalCount >= wrongReviewState.maxCount || indices.length === 0) {
      showWrongReviewSummary();
      return;
    }
    hideAllViews();
    viewArt.classList.remove('hidden');
    var idx = indices[0];
    var wb = Store.getWrongBook();
    var item = wb[idx];
    if (!item) { showWrongReviewSummary(); return; }
    var totalEstimate = wrongReviewState.totalCount + indices.length;
    artTitle.textContent = '错题重练 (' + (wrongReviewState.totalCount + 1) + '/' + Math.min(wrongReviewState.maxCount, totalEstimate) + ')';
    artAuthor.textContent = '出自：' + (item.articleTitle || '');
    var typeLabel = item.type === 'blank' ? '填空' : item.type === 'match' ? '对接' : item.type === 'situational' ? '情境' : '配对';
    var questionText = (item.question || '').replace(/______/g, '＿＿').replace(/___/g, '＿＿');
    var html = '<div style="margin-bottom:8px;font-size:11px;color:var(--muted-fg);font-family:\'Microsoft YaHei\',sans-serif">' + typeLabel + ' · 复习等级 ' + (item.reviewLevel || 0) + '/4</div>' +
      '<div class="exercise-question">' + questionText + '</div>' +
      '<div style="margin:12px 0;font-family:\'Microsoft YaHei\',sans-serif;font-size:13px;color:var(--sub)">你的答案：</div>' +
      '<input class="exercise-blank wr-input" type="text" autocomplete="off" style="width:100%;min-width:200px;border:1px solid var(--border);border-radius:4px;padding:10px 12px" placeholder="输入完整答案">' +
      '<div style="margin-top:12px">' +
      '<button class="exercise-submit" id="wrSubmit">提交</button>' +
      '<button class="exercise-btn" id="wrSkip">跳过</button>' +
      '</div>' +
      '<div id="wrResult"></div>';
    artBody.innerHTML = html;
    var input = artBody.querySelector('.wr-input');
    var submitBtn = document.getElementById('wrSubmit');
    var skipBtn = document.getElementById('wrSkip');
    var resultDiv = document.getElementById('wrResult');
    function handleAnswer(skipped) {
      var userAns = skipped ? '' : input.value.trim();
      var correct = !skipped && normalizeAnswer(userAns) === normalizeAnswer(item.correctAnswer);
      var result = Store.scheduleWrongReview(idx, correct);
      var resultHtml = '';
      if (skipped) {
        resultHtml = '<div class="exercise-result wrong">下 已跳过，1 天后再次进入复习</div>';
      } else if (correct) {
        if (result.mastered) {
          wrongReviewState.masteredCount++;
          resultHtml = '<div class="exercise-result correct">对 答对！复习等级已满，该错题已掌握并移出错题本 </div>';
        } else {
          resultHtml = '<div class="exercise-result correct">对 答对！下次复习：' + WR_INTERVAL_LABELS[item.reviewLevel] + '</div>';
        }
        wrongReviewState.correctCount++;
      } else {
        resultHtml = '<div class="exercise-result wrong">错 答错，复习等级重置，1 天后再次复习</div>';
        resultHtml += '<div style="margin-top:8px;padding:10px;background:var(--bg);border-left:3px solid var(--pri);font-size:13px;color:var(--sub);font-family:\'Microsoft YaHei\',sans-serif"><strong>正确答案：</strong>' + item.correctAnswer + '</div>';
      }
      resultDiv.innerHTML = resultHtml;
      submitBtn.style.display = 'none';
      skipBtn.style.display = 'none';
      input.disabled = true;
      wrongReviewState.totalCount++;
      wrongReviewState.results.push({ item: item, userAnswer: userAns, correct: correct, skipped: skipped, mastered: result.mastered });
      var nextBtn = document.createElement('button');
      nextBtn.className = 'exercise-submit';
      var noMore = wrongReviewState.totalCount >= wrongReviewState.maxCount || Store.getTodayWrongReviews().length === 0;
      nextBtn.textContent = noMore ? ' 查看成绩单' : '下一题 →';
      nextBtn.style.marginTop = '12px';
      nextBtn.onclick = function() { renderWrongReviewQuestion(); };
      resultDiv.appendChild(nextBtn);
      Store.recordPractice(item.type, correct);
    }
    submitBtn.onclick = function() { handleAnswer(false); };
    skipBtn.onclick = function() { handleAnswer(true); };
    input.onkeydown = function(e) { if (e.key === 'Enter') submitBtn.click(); };
    setTimeout(function() { input.focus(); }, 100);
  }

  function showWrongReviewSummary() {
    hideAllViews();
    viewArt.classList.remove('hidden');
    var st = wrongReviewState;
    var pct = st.totalCount > 0 ? Math.round(st.correctCount / st.totalCount * 100) : 0;
    artTitle.textContent = '错题重练 · 成绩单';
    artAuthor.textContent = st.correctCount + '/' + st.totalCount + ' 正确';
    var html = '<div class="exercise-result ' + (pct >= 80 ? 'correct' : 'wrong') + '" style="font-size:18px;padding:16px 24px;text-align:center">正确率：' + st.correctCount + '/' + st.totalCount + ' (' + pct + '%)</div>';
    html += '<div style="display:flex;gap:12px;margin:16px 0;font-family:\'Microsoft YaHei\',sans-serif">' +
      '<div class="stats-card" style="flex:1"><div class="number" style="color:#4caf50">' + st.correctCount + '</div><div class="label">答对</div></div>' +
      '<div class="stats-card" style="flex:1"><div class="number" style="color:#f44336">' + (st.totalCount - st.correctCount) + '</div><div class="label">答错/跳过</div></div>' +
      '<div class="stats-card" style="flex:1"><div class="number" style="color:var(--orange)">' + st.masteredCount + '</div><div class="label">已掌握</div></div>' +
      '</div>';
    var encourage = '';
    if (pct === 100) encourage = ' 全对！错题正在被你逐个消灭';
    else if (pct >= 80) encourage = ' 表现出色，继续保持复习节奏';
    else if (pct >= 60) encourage = ' 多读原文，加深记忆';
    else encourage = ' 建议回到原文重新学习后再练';
    html += '<div style="text-align:center;font-family:\'Microsoft YaHei\',sans-serif;color:var(--sub);margin:12px 0;font-size:14px">' + encourage + '</div>';
    if (st.results.length > 0) {
      html += '<div class="exercise-summary"><h4> 本次复习详情</h4>';
      for (var j = 0; j < st.results.length; j++) {
        var r = st.results[j];
        var rowClass = r.correct ? 'correct' : 'wrong';
        var ansText = r.skipped ? '（已跳过）' : (r.userAnswer || '（空）');
        var qText = (r.item.question || '').replace(/______/g, '＿＿').replace(/___/g, '＿＿');
        html += '<div class="summary-row ' + rowClass + '">';
        html += '<div class="q">' + (j + 1) + '. ' + qText + (r.mastered ? ' <span style="color:var(--orange);font-size:11px">已掌握</span>' : '') + '</div>';
        html += '<div class="a">';
        if (!r.correct) html += '<span class="ua">' + ansText + '</span>';
        html += '<span class="ca">' + r.item.correctAnswer + '</span>';
        if (r.correct) html += ' 对';
        html += '</div></div>';
      }
      html += '</div>';
    }
    var remaining = Store.getTodayWrongReviews().length;
    html += '<div style="margin-top:16px">';
    if (remaining > 0) {
      html += '<button class="exercise-submit" id="wrContinue"> 继续复习（剩 ' + remaining + ' 题）</button>';
    }
    html += '<button class="exercise-btn" id="wrBack">← 返回错题本</button>';
    html += '</div>';
    artBody.innerHTML = html;
    var contBtn = document.getElementById('wrContinue');
    if (contBtn) contBtn.onclick = function() { startWrongReview(); };
    document.getElementById('wrBack').onclick = function() { showWrongBook(); };
    artBody.scrollTop = 0;
    Store.updateStreak();
  }

  /* ===== Canvas 图表工具（阶段4 数据可视化）===== */
  var CHART_COLORS = {
    primary: '#4a90d9',
    success: '#4caf50',
    warn: '#ff9800',
    danger: '#e74c3c',
    purple: '#9c27b0',
    cyan: '#00bcd4',
    grid: 'rgba(120,120,120,.15)',
    axis: 'rgba(120,120,120,.4)',
    text: '#666',
    textLight: '#999'
  };
  // 高清屏适配：根据容器宽度设置 Canvas 像素
  function setupCanvas(canvas, width, height) {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return ctx;
  }
  // 圆角矩形路径
  function roundRect(ctx, x, y, w, h, r) {
    if (h < 0) { y += h; h = -h; }
    if (w < 0) { x += w; w = -w; }
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  // hex 转 rgba
  function hexToRgba(hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function(c){return c+c;}).join('');
    var r = parseInt(hex.substr(0, 2), 16);
    var g = parseInt(hex.substr(2, 2), 16);
    var b = parseInt(hex.substr(4, 2), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }
  // 折线图：data = [{ label, value }] value 由 options.min/max 决定（默认 0-100）
  function drawLineChart(canvas, data, options) {
    options = options || {};
    var W = canvas.offsetWidth || 600;
    var H = options.height || 220;
    var ctx = setupCanvas(canvas, W, H);
    var padding = { top: 20, right: 16, bottom: 32, left: 38 };
    var cw = W - padding.left - padding.right;
    var ch = H - padding.top - padding.bottom;
    var min = options.min != null ? options.min : 0;
    var max = options.max != null ? options.max : 100;
    var color = options.color || CHART_COLORS.primary;
    // 网格 + Y 轴标签
    ctx.strokeStyle = CHART_COLORS.grid;
    ctx.lineWidth = 1;
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = CHART_COLORS.textLight;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    var gridLines = 4;
    for (var i = 0; i <= gridLines; i++) {
      var y = padding.top + ch * i / gridLines;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + cw, y);
      ctx.stroke();
      var v = Math.round(max - (max - min) * i / gridLines);
      ctx.fillText(v + (options.unit || ''), padding.left - 4, y);
    }
    if (!data || data.length === 0) {
      ctx.fillStyle = CHART_COLORS.textLight;
      ctx.textAlign = 'center';
      ctx.font = '13px "Microsoft YaHei", sans-serif';
      ctx.fillText('暂无数据', W / 2, H / 2);
      return;
    }
    var n = data.length;
    var step = n > 1 ? cw / (n - 1) : cw;
    // X 轴标签（最多 7 个）
    ctx.fillStyle = CHART_COLORS.textLight;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var labelStep = Math.ceil(n / 7);
    for (var k = 0; k < n; k += labelStep) {
      ctx.fillText(data[k].label, padding.left + step * k, padding.top + ch + 8);
    }
    // 点坐标
    var pts = [];
    for (var j = 0; j < n; j++) {
      var v = data[j].value;
      var x = padding.left + step * j;
      var y = padding.top + ch - (v - min) / (max - min) * ch;
      pts.push({ x: x, y: y, v: v, label: data[j].label });
    }
    // 填充区域
    ctx.beginPath();
    ctx.moveTo(pts[0].x, padding.top + ch);
    for (var p = 0; p < pts.length; p++) ctx.lineTo(pts[p].x, pts[p].y);
    ctx.lineTo(pts[pts.length - 1].x, padding.top + ch);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(color, 0.12);
    ctx.fill();
    // 折线
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var q = 1; q < pts.length; q++) ctx.lineTo(pts[q].x, pts[q].y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    // 数据点
    for (var r = 0; r < pts.length; r++) {
      ctx.beginPath();
      ctx.arc(pts[r].x, pts[r].y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // 平均值参考线
    if (options.showAvg && n > 0) {
      var sum = 0;
      for (var s = 0; s < pts.length; s++) sum += pts[s].v;
      var avg = sum / pts.length;
      var yAvg = padding.top + ch - (avg - min) / (max - min) * ch;
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = CHART_COLORS.warn;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, yAvg);
      ctx.lineTo(padding.left + cw, yAvg);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = CHART_COLORS.warn;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('均值 ' + Math.round(avg) + (options.unit || ''), padding.left + cw - 4, yAvg - 2);
    }
  }
  // 柱状图：data = [{ label, value, color }] value >= 0
  function drawBarChart(canvas, data, options) {
    options = options || {};
    var W = canvas.offsetWidth || 600;
    var H = options.height || 220;
    var ctx = setupCanvas(canvas, W, H);
    var padding = { top: 20, right: 16, bottom: 36, left: 40 };
    var cw = W - padding.left - padding.right;
    var ch = H - padding.top - padding.bottom;
    if (!data || data.length === 0) {
      ctx.fillStyle = CHART_COLORS.textLight;
      ctx.textAlign = 'center';
      ctx.font = '13px "Microsoft YaHei", sans-serif';
      ctx.fillText('暂无数据', W / 2, H / 2);
      return;
    }
    var max = options.max;
    if (!max) { max = 0; for (var i = 0; i < data.length; i++) { if (data[i].value > max) max = data[i].value; } }
    if (max <= 0) max = 1;
    max = Math.ceil(max * 1.15);
    var n = data.length;
    var barGap = 8;
    var barW = Math.max(8, (cw - barGap * (n - 1)) / n);
    // 网格 + Y 轴
    ctx.strokeStyle = CHART_COLORS.grid;
    ctx.lineWidth = 1;
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = CHART_COLORS.textLight;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    var gridLines = 4;
    for (var g = 0; g <= gridLines; g++) {
      var y = padding.top + ch * g / gridLines;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + cw, y);
      ctx.stroke();
      ctx.fillText(String(Math.round(max - max * g / gridLines)), padding.left - 4, y);
    }
    // 柱子
    for (var b = 0; b < n; b++) {
      var v = data[b].value;
      var h = v / max * ch;
      var x = padding.left + b * (barW + barGap);
      var y = padding.top + ch - h;
      var baseColor = data[b].color || CHART_COLORS.primary;
      if (h > 0) {
        var grd = ctx.createLinearGradient(0, y, 0, y + h);
        grd.addColorStop(0, baseColor);
        grd.addColorStop(1, hexToRgba(baseColor, 0.55));
        ctx.fillStyle = grd;
        roundRect(ctx, x, y, barW, h, 4);
        ctx.fill();
        // 顶部数值
        ctx.fillStyle = CHART_COLORS.text;
        ctx.font = '11px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(v), x + barW / 2, y - 2);
      }
      // X 轴标签
      ctx.fillStyle = CHART_COLORS.textLight;
      ctx.font = '11px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(data[b].label, x + barW / 2, padding.top + ch + 8);
    }
  }
  // 饼图（环形）：data = [{ label, value, color }]
  function drawPieChart(canvas, data, options) {
    options = options || {};
    var W = canvas.offsetWidth || 600;
    var H = options.height || 220;
    var ctx = setupCanvas(canvas, W, H);
    if (!data || data.length === 0) {
      ctx.fillStyle = CHART_COLORS.textLight;
      ctx.textAlign = 'center';
      ctx.font = '13px "Microsoft YaHei", sans-serif';
      ctx.fillText('暂无数据', W / 2, H / 2);
      return;
    }
    var total = 0;
    for (var i = 0; i < data.length; i++) total += data[i].value;
    if (total === 0) {
      ctx.fillStyle = CHART_COLORS.textLight;
      ctx.textAlign = 'center';
      ctx.font = '13px "Microsoft YaHei", sans-serif';
      ctx.fillText('暂无数据', W / 2, H / 2);
      return;
    }
    var legendW = 150;
    var pieR = Math.min((W - legendW - 40) / 2, H - 40) / 2;
    pieR = Math.max(40, pieR);
    var cx = 20 + pieR;
    var cy = H / 2;
    // 扇形
    var start = -Math.PI / 2;
    for (var j = 0; j < data.length; j++) {
      var angle = data[j].value / total * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, pieR, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = data[j].color || CHART_COLORS.primary;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      start += angle;
    }
    // 中心圆（环形）
    ctx.beginPath();
    ctx.arc(cx, cy, pieR * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    // 中心文字
    ctx.fillStyle = CHART_COLORS.text;
    ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(total), cx, cy - 8);
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = CHART_COLORS.textLight;
    ctx.fillText(options.centerLabel || '总数', cx, cy + 10);
    // 图例
    var legendX = cx + pieR + 24;
    var legendY = cy - (data.length * 22) / 2;
    for (var k = 0; k < data.length; k++) {
      var ly = legendY + k * 22;
      var pct = Math.round(data[k].value / total * 100);
      ctx.fillStyle = data[k].color || CHART_COLORS.primary;
      roundRect(ctx, legendX, ly, 12, 12, 2);
      ctx.fill();
      ctx.fillStyle = CHART_COLORS.text;
      ctx.font = '12px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      var txt = data[k].label + '  ' + data[k].value + ' (' + pct + '%)';
      ctx.fillText(txt, legendX + 18, ly + 6);
    }
  }
  // 热力图：data = [{ label, value }] 横向网格
  function drawHeatmap(canvas, data, options) {
    options = options || {};
    var W = canvas.offsetWidth || 600;
    var cell = 14;
    var gap = 3;
    var cols = data.length;
    var labelH = 20;
    var H = cell + gap + labelH + 10;
    var ctx = setupCanvas(canvas, W, H);
    if (!data || data.length === 0) return;
    var maxV = 0;
    for (var i = 0; i < data.length; i++) { if (data[i].value > maxV) maxV = data[i].value; }
    if (maxV === 0) maxV = 1;
    var totalW = cols * (cell + gap) - gap;
    var startX = Math.max(10, (W - totalW) / 2);
    ctx.font = '10px "Microsoft YaHei", sans-serif';
    for (var c = 0; c < data.length; c++) {
      var v = data[c].value;
      var level = v === 0 ? 0 : Math.ceil(v / maxV * 4);
      var color = getHeatColor(level);
      var x = startX + c * (cell + gap);
      var y = labelH;
      ctx.fillStyle = color;
      roundRect(ctx, x, y, cell, cell, 2);
      ctx.fill();
      if (c % 5 === 0 || c === data.length - 1) {
        ctx.fillStyle = CHART_COLORS.textLight;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(data[c].label, x + cell / 2, y + cell + 4);
      }
    }
    // 图例
    ctx.font = '10px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = CHART_COLORS.textLight;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    var legendStartX = startX + totalW + 12;
    if (legendStartX + 80 < W) {
      ctx.fillText('少', legendStartX, labelH + cell / 2);
      for (var lv = 0; lv < 5; lv++) {
        ctx.fillStyle = getHeatColor(lv);
        roundRect(ctx, legendStartX + 16 + lv * 12, labelH + cell / 2 - 5, 10, 10, 2);
        ctx.fill();
      }
      ctx.fillStyle = CHART_COLORS.textLight;
      ctx.fillText('多', legendStartX + 16 + 5 * 12 + 4, labelH + cell / 2);
    }
  }
  function getHeatColor(level) {
    var colors = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'];
    if (document.documentElement.classList.contains('dark-mode') || document.body.classList.contains('dark-mode')) {
      colors = ['#2d333b', '#0e4429', '#006d32', '#26a641', '#39d353'];
    }
    return colors[Math.max(0, Math.min(4, level))];
  }

  /* ========== 评分统计 ========== */
  function showStats() {
    hideAllViews();
    viewArt.classList.remove('hidden');
    artTitle.textContent = '练习统计';
    artAuthor.textContent = '';
    var s = Store.getStats();
    var overallPct = s.totalAttempts > 0 ? Math.round(s.totalCorrect / s.totalAttempts * 100) : 0;
    var blankPct = s.blank.attempts > 0 ? Math.round(s.blank.correct / s.blank.attempts * 100) : 0;
    var matchPct = s.match.attempts > 0 ? Math.round(s.match.correct / s.match.attempts * 100) : 0;
    var pairPct = s.pair.attempts > 0 ? Math.round(s.pair.correct / s.pair.attempts * 100) : 0;
    var situationalPct = s.situational && s.situational.attempts > 0 ? Math.round(s.situational.correct / s.situational.attempts * 100) : 0;
    var feihuaPct = s.feihua && s.feihua.attempts > 0 ? Math.round(s.feihua.correct / s.feihua.attempts * 100) : 0;
    var streak = Store.getStreak();
    var studyTime = Store.getStudyTime();
    var html = '<div class="stats-grid">' +
      '<div class="stats-card"><div class="number">' + s.totalAttempts + '</div><div class="label">总题数</div></div>' +
      '<div class="stats-card"><div class="number">' + overallPct + '%</div><div class="label">总正确率</div></div>' +
      '<div class="stats-card"><div class="number">' + Store.getWrongBook().length + '</div><div class="label">错题数</div></div>' +
      '<div class="stats-card"><div class="number">' + streak.days + '</div><div class="label">连续打卡</div></div>' +
      '<div class="stats-card"><div class="number">' + studyTime.total + '</div><div class="label">累计学习(分)</div></div>' +
      '</div>';
    html += '<div style="font-family:\'Microsoft YaHei\',sans-serif;margin-top:12px">' +
      '<div class="about-row"><span class="about-label">填空默写</span><span class="about-value">' + s.blank.attempts + ' 题，正确率 ' + blankPct + '%</span></div>' +
      '<div class="about-row"><span class="about-label">上下句对接</span><span class="about-value">' + s.match.attempts + ' 题，正确率 ' + matchPct + '%</span></div>' +
      '<div class="about-row"><span class="about-label">作者配对</span><span class="about-value">' + s.pair.attempts + ' 题，正确率 ' + pairPct + '%</span></div>' +
      '<div class="about-row"><span class="about-label">情境默写</span><span class="about-value">' + (s.situational ? s.situational.attempts : 0) + ' 题，正确率 ' + situationalPct + '%</span></div>' +
      '<div class="about-row"><span class="about-label">飞花令</span><span class="about-value">' + (s.feihua ? s.feihua.attempts : 0) + ' 题，正确率 ' + feihuaPct + '%</span></div>' +
      '</div>';
    // 图表区
    html += '<div style="margin-top:20px;font-family:\'Microsoft YaHei\',sans-serif">' +
      '<div style="margin-bottom:24px;padding:14px;background:rgba(74,144,217,.05);border:1px solid rgba(74,144,217,.15);border-radius:8px">' +
        '<div style="font-size:14px;font-weight:600;color:var(--fg);margin-bottom:10px"> 近 14 天正确率趋势</div>' +
        '<canvas id="chartAccuracyLine" style="width:100%;display:block"></canvas>' +
      '</div>' +
      '<div style="margin-bottom:24px;padding:14px;background:rgba(76,175,80,.05);border:1px solid rgba(76,175,80,.15);border-radius:8px">' +
        '<div style="font-size:14px;font-weight:600;color:var(--fg);margin-bottom:10px"> 各题型题量分布</div>' +
        '<canvas id="chartTypeBar" style="width:100%;display:block"></canvas>' +
      '</div>' +
      '<div style="margin-bottom:24px;padding:14px;background:rgba(231,76,60,.05);border:1px solid rgba(231,76,60,.15);border-radius:8px">' +
        '<div style="font-size:14px;font-weight:600;color:var(--fg);margin-bottom:10px"> 错题本题型分布</div>' +
        '<canvas id="chartWrongPie" style="width:100%;display:block"></canvas>' +
      '</div>' +
      '<div style="margin-bottom:8px;padding:14px;background:rgba(255,152,0,.05);border:1px solid rgba(255,152,0,.15);border-radius:8px">' +
        '<div style="font-size:14px;font-weight:600;color:var(--fg);margin-bottom:10px"> 近 30 天学习强度热力图</div>' +
        '<canvas id="chartHeatmap" style="width:100%;display:block"></canvas>' +
      '</div>' +
    '</div>';
    if (s.totalAttempts === 0) {
      html += '<div class="empty-state" style="padding:30px 20px"><div class="icon"></div><div class="title">开始你的第一次练习吧</div><div class="desc">坚持每日一练，积少成多，必有所成</div></div>';
    } else if (overallPct >= 80) {
      html += '<div style="margin-top:16px;padding:12px;background:rgba(76,175,80,.1);border:1px solid #4caf50;font-family:\'Microsoft YaHei\',sans-serif;font-size:13px;color:#4caf50;text-align:center"> 表现出色！继续保持</div>';
    }
    artBody.innerHTML = html;
    // 绘制图表（DOM 插入后调用，确保 offsetWidth 可用）
    drawStatsCharts(s);
  }

  // 统计页图表绘制
  function drawStatsCharts(s) {
    // 1. 折线图：近 14 天正确率
    var recent = Store.getRecentDailyStats(14);
    var lineData = [];
    var hasData = false;
    for (var i = 0; i < recent.length; i++) {
      var r = recent[i];
      var pct = r.attempts > 0 ? Math.round(r.correct / r.attempts * 100) : 0;
      if (r.attempts > 0) hasData = true;
      lineData.push({ label: r.day, value: pct });
    }
    var lineCanvas = document.getElementById('chartAccuracyLine');
    if (lineCanvas) {
      drawLineChart(lineCanvas, hasData ? lineData : [], { height: 200, min: 0, max: 100, unit: '%', showAvg: true, color: CHART_COLORS.primary });
    }
    // 2. 柱状图：各题型题量
    var barData = [
      { label: '填空', value: s.blank.attempts, color: CHART_COLORS.primary },
      { label: '对接', value: s.match.attempts, color: CHART_COLORS.success },
      { label: '配对', value: s.pair.attempts, color: CHART_COLORS.warn },
      { label: '情境', value: (s.situational ? s.situational.attempts : 0), color: CHART_COLORS.purple },
      { label: '飞花', value: (s.feihua ? s.feihua.attempts : 0), color: CHART_COLORS.cyan }
    ];
    var hasBarData = false;
    for (var b = 0; b < barData.length; b++) { if (barData[b].value > 0) hasBarData = true; }
    var barCanvas = document.getElementById('chartTypeBar');
    if (barCanvas) {
      drawBarChart(barCanvas, hasBarData ? barData : [], { height: 200 });
    }
    // 3. 饼图：错题本按题型分布
    var wb = Store.getWrongBook();
    var typeMap = { blank: 0, match: 0, pair: 0, situational: 0 };
    var typeLabels = { blank: '填空默写', match: '上下句对接', pair: '作者配对', situational: '情境默写' };
    var typeColors = { blank: CHART_COLORS.primary, match: CHART_COLORS.success, pair: CHART_COLORS.warn, situational: CHART_COLORS.purple };
    for (var w = 0; w < wb.length; w++) {
      var t = wb[w].type || 'blank';
      if (typeMap[t] !== undefined) typeMap[t]++;
    }
    var pieData = [];
    for (var key in typeMap) {
      if (typeMap[key] > 0) {
        pieData.push({ label: typeLabels[key], value: typeMap[key], color: typeColors[key] });
      }
    }
    var pieCanvas = document.getElementById('chartWrongPie');
    if (pieCanvas) {
      drawPieChart(pieCanvas, pieData, { height: 220, centerLabel: '错题' });
    }
    // 4. 热力图：近 30 天学习时长
    var recent30 = Store.getRecentDailyStats(30);
    var heatData = [];
    for (var h = 0; h < recent30.length; h++) {
      heatData.push({ label: recent30[h].day, value: recent30[h].studyTime });
    }
    var heatCanvas = document.getElementById('chartHeatmap');
    if (heatCanvas) {
      drawHeatmap(heatCanvas, heatData, {});
    }
  }

  /* ========== 闪卡模式 ========== */
  var flashcardState = { queue: [], currentIdx: 0, mastered: 0, forgotten: 0 };

  function renderFlashcardNav() {
    var html = '<div class="sec-label"><span>闪卡复习</span></div>';
    html += '<button class="nav-child" data-fc-action="restart"> 重新开始</button>';
    html += '<button class="nav-child" data-fc-action="all"> 全部篇目</button>';
    html += '<button class="nav-child" data-fc-action="unmastered"> 未掌握篇目</button>';
    html += '<div class="sec-label"><span>进度</span></div>';
    html += '<div style="padding:8px 16px;font-size:13px;color:var(--sub);font-family:\'Microsoft YaHei\',sans-serif">' +
      '已掌握：<span style="color:#4caf50">' + flashcardState.mastered + '</span> / ' +
      (flashcardState.queue.length + flashcardState.mastered + flashcardState.forgotten || 0) +
      '</div>';
    navEl.innerHTML = html;
    navEl.querySelectorAll('[data-fc-action]').forEach(function(btn) {
      btn.onclick = function() {
        var action = btn.getAttribute('data-fc-action');
        if (action === 'restart') { startFlashcard(); }
        else if (action === 'all') { startFlashcard(true); }
        else if (action === 'unmastered') { startFlashcard(false); }
      };
    });
  }

  function generateFlashcardQueue(allArticles) {
    var queue = [];
    var articles = allArticles ? D : D.filter(function(a) { return !Store.isRecited(a.id); });
    if (articles.length === 0) articles = D;
    for (var i = 0; i < articles.length; i++) {
      var art = articles[i];
      var sentences = art.text.match(/[^。！？\n]+[。！？\n]?/g) || [];
      for (var si = 0; si < sentences.length - 1; si++) {
        var s1 = sentences[si].trim();
        var s2 = sentences[si + 1].trim();
        if (s1.length > 6 && s2.length > 4 && s1.length < 60 && s2.length < 60) {
          queue.push({ upper: s1, lower: s2, articleTitle: art.title, articleId: art.id });
        }
      }
    }
    // 随机打乱
    for (var fi = queue.length - 1; fi > 0; fi--) {
      var j = Math.floor(Math.random() * (fi + 1));
      var tmp = queue[fi]; queue[fi] = queue[j]; queue[j] = tmp;
    }
    // 最多20张卡片
    return queue.slice(0, 20);
  }

  function startFlashcard(allArticles) {
    flashcardState.queue = generateFlashcardQueue(allArticles !== false);
    flashcardState.currentIdx = 0;
    flashcardState.mastered = 0;
    flashcardState.forgotten = 0;
    if (flashcardState.queue.length === 0) {
      showPlaceholder('无法生成闪卡', '没有足够的句子对', '请先阅读更多篇目');
      return;
    }
    renderSidebar();
    renderFlashcard();
  }

  function renderFlashcard() {
    hideAllViews();
    viewArt.classList.remove('hidden');
    if (flashcardState.currentIdx >= flashcardState.queue.length) {
      // 完成
      var total = flashcardState.mastered + flashcardState.forgotten;
      artTitle.textContent = '闪卡复习完成';
      artAuthor.textContent = '';
      var pct = total > 0 ? Math.round(flashcardState.mastered / total * 100) : 0;
      artBody.innerHTML = '<div class="flashcard-done">' +
        '<div class="icon">' + (pct >= 80 ? '' : '') + '</div>' +
        '<div class="title">复习完成！</div>' +
        '<div class="sub">记住了 ' + flashcardState.mastered + ' / ' + total + ' 句 (' + pct + '%)</div>' +
        '<button class="exercise-submit" id="fcRestart" style="margin-top:20px">再来一轮</button>' +
        '</div>';
      document.getElementById('fcRestart').onclick = function() { startFlashcard(true); };
      Store.updateStreak();
      return;
    }
    var q = flashcardState.queue[flashcardState.currentIdx];
    artTitle.textContent = '闪卡 (' + (flashcardState.currentIdx + 1) + '/' + flashcardState.queue.length + ')';
    artAuthor.textContent = '出自：' + q.articleTitle;
    var html = '<div class="flashcard-wrap">' +
      '<div class="flashcard" id="fcCard" onclick="this.classList.toggle(\'flipped\')">' +
      '<div class="flashcard-inner">' +
      '<div class="flashcard-front"><span class="flashcard-hint">点击翻转</span>' + q.upper + '</div>' +
      '<div class="flashcard-back">' + q.lower + '</div>' +
      '</div></div>' +
      '<div class="flashcard-actions">' +
      '<button class="flashcard-btn forgot" id="fcForgot">错 没记住</button>' +
      '<button class="flashcard-btn remember" id="fcRemember">对 记住了</button>' +
      '</div></div>';
    artBody.innerHTML = html;
    document.getElementById('fcForgot').onclick = function() {
      flashcardState.forgotten++;
      // 将当前卡片移到队列末尾
      flashcardState.queue.push(flashcardState.queue[flashcardState.currentIdx]);
      flashcardState.currentIdx++;
      renderFlashcard();
      renderSidebar();
    };
    document.getElementById('fcRemember').onclick = function() {
      flashcardState.mastered++;
      flashcardState.currentIdx++;
      renderFlashcard();
      renderSidebar();
    };
    glassFlashcard(artBody);
  }

  /* ===== AUDIO ===== */
  function syncProgress() {
    var dur = audioEl.duration || 0;
    var ct = audioEl.currentTime || 0;
    pFill.style.width = dur > 0 ? (ct / dur * 100) + '%' : '0%';
    tCur.textContent = formatTime(ct);
  }

  function setAudioDisabled(dis){
    btnRW.classList.toggle('disabled', dis);
    btnPP.classList.toggle('disabled', dis);
    btnFF.classList.toggle('disabled', dis);
    pTrack.classList.toggle('disabled', dis);
    speedBtn.classList.toggle('disabled', dis);
    loopBtn.classList.toggle('disabled', dis);
  }

  var saveAudioPos = throttle(function(){
    if(cur && resolveAudio(cur) && audioEl.duration){ Store.setAudio(cur.id, audioEl.currentTime); }
  }, 1500);

  /* ===== 朗读音频自动匹配 ===== */
  // Android 打包工具(APT) 不支持中文文件名，resource/audio 下的音频已重命名为 ASCII 短名。
  // 这里维护「文章标题 -> 音频文件名」的静态映射，在 APK(file://) 与桌面端都可用，优先级最高。
  var AUDIO_ALIAS = {
    '劝学': 'q01.mp3',
    '师说': 'q02.mp3',
    '登泰山记': 'q10.mp3',
    '赤壁赋': 'q13.mp3',
    '静女': 'q14.mp3',
    '涉江采芙蓉': 'q08.mp3',
    '归园田居（其一）': 'q03.mp3',
    '梦游天姥吟留别': 'q06.mp3',
    '登高': 'q11.mp3',
    '琵琶行（并序）': 'q09.mp3',
    '虞美人（春花秋月何时了）': 'q12.mp3',
    '念奴娇·赤壁怀古': 'q04.mp3',
    '鹊桥仙（纤云弄巧）': 'q15.mp3',
    '声声慢（寻寻觅觅）': 'q16.mp3',
    '永遇乐·京口北固亭怀古': 'q07.mp3'
  };

  // 启动时拉取 /api/audio-files 列表，构造 title(无扩展名) → filename 映射
  // 通过文章中文标题匹配 resource/audio 目录下的音频文件
  var audioMap = {};
  function loadAudioFiles() {
    return fetch('/api/audio-files').then(function(r) { return r.json(); }).then(function(res) {
      if (!res || !res.success || !res.files) return;
      res.files.forEach(function(fn) {
        // 文件名去掉扩展名作为 key（支持中文标题）
        var key = fn.replace(/\.(mp3|wav|m4a|aac)$/i, '').trim();
        audioMap[key] = 'resource/audio/' + encodeURIComponent(fn);
      });
    }).catch(function() {});
  }
  loadAudioFiles();

  // 给定文章，返回可播放的音频 URL（无则 null）
  // 仅通过中文标题匹配 resource/audio 目录，废弃旧的 aac 字段逻辑
  function resolveAudio(art) {
    if (!art) return null;
    var t = (art.title || '').trim();
    if (!t) return null;
    // 1. 静态别名映射（跨平台通用，APK 内无服务器也能命中）
    if (AUDIO_ALIAS[t]) return 'resource/audio/' + AUDIO_ALIAS[t];
    // 2. 服务器 API 返回的映射
    if (audioMap[t]) return audioMap[t];
    // 3. Fallback：直接用中文标题拼接 mp3 路径（兼容历史中文名文件）
    //    加载失败会触发 audioEl.onerror，已有处理
    var encodedTitle = t.split('/').map(function(seg){ return encodeURIComponent(seg); }).join('/');
    return 'resource/audio/' + encodedTitle + '.mp3';
  }

  function loadAudio() {
    audioEl.pause();
    playing = false;
    setPpIcon(false);
    var audioUrl = resolveAudio(cur);
    if (audioUrl) {
      setAudioDisabled(false);
      audioEl.src = audioUrl;
      audioEl.load();
      audioEl.playbackRate = Store.getSpeed();
      audioEl.loop = Store.getLoop();
      audioEl.onloadedmetadata = function() {
        tTotal.textContent = formatTime(audioEl.duration);
        var pos = Store.getAudio(cur.id);
        if (pos > 0 && pos < audioEl.duration - 1) { audioEl.currentTime = pos; }
        syncProgress();
      };
      audioEl.ontimeupdate = function() { syncProgress(); saveAudioPos(); };
      audioEl.onended = function() { playing = false; setPpIcon(false); };
      audioEl.onerror = function() {
        setAudioDisabled(true);
        pTitle.textContent = cur.title + ' - ' + cur.author + '（音频文件缺失）';
      };
    } else {
      audioEl.src = '';
      audioEl.onloadedmetadata = null;
      audioEl.ontimeupdate = null;
      audioEl.onended = null;
      audioEl.onerror = null;
      setAudioDisabled(true);
    }
    pTitle.textContent = cur.title + ' - ' + cur.author + (audioUrl ? '' : '（暂无音频）');
    tTotal.textContent = '0:00';
    tCur.textContent = '0:00';
    pFill.style.width = '0%';
  }

  /* ===== VIEW SWITCHING ===== */
  function showArticleView() {
    viewMode = 'art';
    hideAllViews();
    viewArt.classList.remove('hidden');
    var headBtns = document.querySelector('.art-head-btns');
    if (headBtns) headBtns.classList.remove('hidden');
    viewArt.classList.remove('view'); void viewArt.offsetWidth; viewArt.classList.add('view');
    // 给文章区域加玻璃背景
    var artSplitEl = document.getElementById('artSplit');
    if (artSplitEl) artSplitEl.classList.add('glass-article');
  }

  function showDynastyCards(dynastyName) {
    viewMode = 'dynasty';
    hideAllViews();
    viewDynasty.classList.remove('hidden');
    viewDynasty.classList.remove('view'); void viewDynasty.offsetWidth; viewDynasty.classList.add('view');
    renderDynastyCards(dynastyName);
  }

  function getAuthorById(id) {
    for (var i = 0; i < AUTHORS.length; i++) {
      if (AUTHORS[i].id === id) return AUTHORS[i];
    }
    return null;
  }

  function showAuthorDetail(authorId) {
    viewMode = 'authorDetail';
    hideAllViews();
    viewAuthorDetail.classList.remove('hidden');
    viewAuthorDetail.classList.remove('view'); void viewAuthorDetail.offsetWidth; viewAuthorDetail.classList.add('view');
    currentAuthor = getAuthorById(authorId);
    renderAuthorDetail(authorId);
  }

  /* ===== GLOBAL FONT SIZE ===== */
  var GFS_SIZES = [
    {px:12, label:'小五'},
    {px:14, label:'五号'},
    {px:15.36, label:'小四'},
    {px:16, label:'四号'},
    {px:18, label:'小三'},
    {px:20, label:'三号'},
    {px:22, label:'小二'},
    {px:24, label:'二号'}
  ];
  var gfsIndex = 3; // 默认四号 16px
  (function(){
    var saved = Store.get('globalFontSize');
    if (saved !== null && saved !== undefined) {
      for (var i = 0; i < GFS_SIZES.length; i++) {
        if (GFS_SIZES[i].px === saved) { gfsIndex = i; break; }
      }
    }
    document.documentElement.style.fontSize = GFS_SIZES[gfsIndex].px + 'px';
  })();

  function updateGfsDisplay() {
    var el = document.getElementById('gfsValue');
    if (el) el.textContent = GFS_SIZES[gfsIndex].label + ' (' + GFS_SIZES[gfsIndex].px + 'px)';
  }

  function showAboutView() {
    viewMode = 'about';
    hideAllViews();
    viewAbout.classList.remove('hidden');
    viewAbout.classList.remove('view'); void viewAbout.offsetWidth; viewAbout.classList.add('view');
    moreBtn.classList.add('sel');
    updateGfsDisplay();
    document.getElementById('gfsMinus').onclick = function(){
      if (gfsIndex > 0) {
        gfsIndex--;
        document.documentElement.style.fontSize = GFS_SIZES[gfsIndex].px + 'px';
        Store.set('globalFontSize', GFS_SIZES[gfsIndex].px);
        updateGfsDisplay();
      }
    };
    document.getElementById('gfsPlus').onclick = function(){
      if (gfsIndex < GFS_SIZES.length - 1) {
        gfsIndex++;
        document.documentElement.style.fontSize = GFS_SIZES[gfsIndex].px + 'px';
        Store.set('globalFontSize', GFS_SIZES[gfsIndex].px);
        updateGfsDisplay();
      }
    };
    // 数据管理按钮绑定
    var exportBtn = document.getElementById('exportBtn');
    var importBtn = document.getElementById('importBtn');
    if (exportBtn) exportBtn.onclick = exportData;
    if (importBtn) importBtn.onclick = function(){
      var input = document.createElement('input');
      input.type = 'file'; input.accept = '.json';
      input.onchange = function(){ if(this.files[0]) importData(this.files[0]); };
      input.click();
    };
    // 重置按钮
    var resetBtns = document.querySelectorAll('.reset-btn');
    for (var ri = 0; ri < resetBtns.length; ri++) {
      bindResetBtn(resetBtns[ri]);
    }
    // 存储用量
    updateStorageUsage();
    // AI 设置初始化和绑定
    var aiCfg = Store.getAIConfig();
    var aiUrlInput = document.getElementById('aiApiUrl');
    var aiKeyInput = document.getElementById('aiApiKey');
    var aiModelInput = document.getElementById('aiModel');
    var aiStatusEl = document.getElementById('aiStatus');
    if (aiUrlInput) aiUrlInput.value = aiCfg.apiUrl || '';
    if (aiKeyInput) aiKeyInput.value = aiCfg.apiKey || '';
    if (aiModelInput) aiModelInput.value = aiCfg.model || '';
    var aiSaveBtn = document.getElementById('aiSaveBtn');
    var aiTestBtn = document.getElementById('aiTestBtn');
    if (aiSaveBtn) {
      aiSaveBtn.onclick = function() {
        var oldCfg = Store.getAIConfig();
        var cfg = {
          apiUrl: normalizeApiUrl(aiUrlInput ? aiUrlInput.value.trim() : ''),
          apiKey: aiKeyInput ? aiKeyInput.value.trim() : '',
          model: aiModelInput ? aiModelInput.value.trim() : '',
          quizType: oldCfg.quizType || 'any'
        };
        Store.setAIConfig(cfg);
        flushProfileSave();
        if (aiUrlInput) aiUrlInput.value = cfg.apiUrl;
        showToast('AI 设置已保存（已自动补全 API 路径）', 'success');
      };
    }
    // 情境默写出题偏好按钮
    var quizTypeBtns = document.querySelectorAll('.quiz-type-btn');
    function updateQuizTypeBtns() {
      var cfg = Store.getAIConfig();
      var current = cfg.quizType || 'any';
      quizTypeBtns.forEach(function(btn) {
        var active = btn.getAttribute('data-quiz-type') === current;
        btn.style.background = active ? 'var(--pri)' : 'var(--card)';
        btn.style.color = active ? 'var(--pri-fg)' : 'var(--fg)';
        btn.style.borderColor = active ? 'var(--pri)' : 'var(--border)';
      });
    }
    updateQuizTypeBtns();
    quizTypeBtns.forEach(function(btn) {
      btn.onclick = function() {
        var cfg = Store.getAIConfig();
        cfg.quizType = btn.getAttribute('data-quiz-type');
        Store.setAIConfig(cfg);
        flushProfileSave();
        updateQuizTypeBtns();
        var labels = { mock: '模拟题', real: '高考真题', any: '不限' };
        showToast('出题偏好已设为：' + labels[cfg.quizType], 'success');
      };
    });
    if (aiTestBtn) {
      aiTestBtn.onclick = async function() {
        var cfg = Store.getAIConfig();
        if (!cfg.apiUrl || !cfg.apiKey || !cfg.model) {
          showToast('请先填写完整的 AI 配置并保存', 'warn');
          return;
        }
        if (aiStatusEl) aiStatusEl.textContent = '正在测试连接...';
        try {
          var result = await callAI(cfg, '你好，请回复一个字：好', 8000);
          if (result && result.success) {
            if (aiStatusEl) aiStatusEl.style.color = '#4caf50';
            if (aiStatusEl) aiStatusEl.textContent = '✓ 连接成功！模型回复：' + (result.content || '');
            showToast('AI 连接测试成功', 'success');
          } else {
            throw new Error(result.error || '未知错误');
          }
        } catch (e) {
          if (aiStatusEl) aiStatusEl.style.color = '#f44336';
          if (aiStatusEl) aiStatusEl.textContent = '✗ 连接失败：' + e.message;
          showToast('AI 连接测试失败：' + e.message, 'error');
        }
      };
    }
  }

  /* ===== AI 调用核心函数 =====
     页面由本地服务器(http://localhost:8000)提供，浏览器直接请求外部 API 常被 CORS 拦截。
     因此优先走同源代理 /api/ai-proxy（由 setuptools/server.ps1 转发），代理失败再回退直连。 */
  function getProxyBase() {
    try {
      if (location.protocol === 'http:' && /localhost|127\.0\.0\.1/.test(location.hostname)) return location.origin;
    } catch (e) {}
    return 'http://localhost:8000';
  }

  // 自动补全接口路径。
  // 注意：DeepSeek 的接口是 https://api.deepseek.com/chat/completions（没有 /v1 段）；
  // OpenAI 等则是 https://xx/v1/chat/completions。对 DeepSeek 要剔除多余的 /v1，否则会被上游 404。
  function normalizeApiUrl(url) {
    url = (url || '').trim();
    if (!url) return url;
    if (/chat\/completions/i.test(url)) {
      // 已含完整路径：仅当是 DeepSeek 时剔除误加的 /v1 段
      if (/api\.deepseek\.com/i.test(url)) return url.replace(/\/v1\/chat\/completions/i, '/chat/completions');
      return url;
    }
    if (/\/v1\/?$/i.test(url)) return url.replace(/\/+$/, '') + '/chat/completions';
    return url.replace(/\/+$/, '') + '/chat/completions';
  }

  async function callAI(cfg, prompt, timeoutMs) {
    if (!cfg || !cfg.apiUrl || !cfg.apiKey || !cfg.model) {
      return { success: false, error: 'AI 配置不完整，请在「更多」中设置' };
    }
    var apiUrl = normalizeApiUrl(cfg.apiUrl);
    timeoutMs = timeoutMs || 30000;
    var controller = new AbortController();
    var messages = [{ role: 'user', content: prompt }];
    var proxyBase = getProxyBase();

    // 1. 优先走同源代理：无 CORS，且能拿到真实 upstream 错误
    var proxyTimer = setTimeout(function() { controller.abort(); }, timeoutMs);
    try {
      var proxyResp = await fetch(proxyBase + '/api/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ url: apiUrl, apiKey: cfg.apiKey, model: cfg.model, messages: messages, temperature: 0.7, stream: false }),
        signal: controller.signal
      });
      clearTimeout(proxyTimer);
      if (!proxyResp.ok) {
        var errText = await proxyResp.text().catch(function(){ return ''; });
        try { var ej = JSON.parse(errText); if (ej && ej.error) errText = ej.error; } catch (e2) {}
        // 代理路由本身没生效（旧版 server.ps1 未重启）：静态处理返回空 body 的 404
        if (proxyResp.status === 404 && !errText) {
          return { success: false, error: '本地 AI 代理路由未生效（server.ps1 返回 404）。请关闭并重新运行 start.bat / setup.bat 重启本地服务器，新的 /api/ai-proxy 才会加载。' };
        }
        var hint = '';
        if (/HTTP 404/i.test(errText || '')) hint = '（多半是接口地址或模型名不对：DeepSeek 正确地址为 https://api.deepseek.com/chat/completions，模型名 deepseek-v4-flash）';
        return { success: false, error: '代理错误 HTTP ' + proxyResp.status + ' ' + (errText || proxyResp.statusText) + hint };
      }
      var text = await proxyResp.text();
      var data;
      try { data = JSON.parse(text); } catch (e2) { return { success: false, error: '代理返回无法解析：' + text.slice(0, 200) }; }
      // 代理层错误结构 {success:false, error}
      if (data && data.success === false && data.error) { return { success: false, error: data.error }; }
      var content = '';
      if (data && data.choices && data.choices[0]) {
        if (typeof data.choices[0].message === 'string') content = data.choices[0].message;
        else if (data.choices[0].message && data.choices[0].message.content) content = data.choices[0].message.content;
        else if (data.choices[0].text) content = data.choices[0].text;
      }
      if (!content) return { success: false, error: 'API 返回为空或格式无法解析' };
      return { success: true, content: String(content).trim(), raw: data };
    } catch (e) {
      clearTimeout(proxyTimer);
      if (e.name === 'AbortError') {
        return { success: false, error: '请求超时（' + (timeoutMs/1000) + '秒）' };
      }
      // 2. 代理本身连不上（服务器未重启 / 未启动 / 直接 file:// 打开），兜底直连一次
      try {
        var directResp = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': 'Bearer ' + cfg.apiKey },
          body: JSON.stringify({ model: cfg.model, messages: messages, temperature: 0.7, stream: false })
        });
        if (!directResp.ok) {
          var dt = await directResp.text().catch(function(){ return ''; });
          return { success: false, error: '直连 HTTP ' + directResp.status + ' ' + (dt || directResp.statusText) };
        }
        var dtext = await directResp.text();
        var ddata = JSON.parse(dtext);
        var dc = '';
        if (ddata && ddata.choices && ddata.choices[0]) {
          if (typeof ddata.choices[0].message === 'string') dc = ddata.choices[0].message;
          else if (ddata.choices[0].message && ddata.choices[0].message.content) dc = ddata.choices[0].message.content;
          else if (ddata.choices[0].text) dc = ddata.choices[0].text;
        }
        return { success: true, content: String(dc).trim(), raw: ddata };
      } catch (e2) {
        return { success: false, error: '代理不可用，且直连也被浏览器拦截（CORS）。请确认已用 start.bat 启动本地服务器并重启 server.ps1。' };
      }
    }
  }

  /* ===== AI 生成虚词题目 ===== */
  var aiGenerating = false;
  async function generateAIWordQuestions(focusWord) {
    var cfg = Store.getAIConfig();
    if (!cfg.apiUrl || !cfg.apiKey || !cfg.model) {
      showToast('请先在「更多」中配置 AI API 信息', 'warn');
      return null;
    }
    if (aiGenerating) { showToast('AI 正在出题中，请稍候...', 'info'); return null; }
    aiGenerating = true;
    showToast('AI 正在为您出题，请稍候...', 'info');
    var wordListText = WORD_LIST.join('、');
    var targetWord = focusWord || '随机';
    var prompt = '你是一位资深的高中语文老师。请为文言虚词练习生成5道四选一选择题。' +
      (targetWord && targetWord !== '随机' ? '重点围绕虚词「' + targetWord + '」，也可涉及其他常见虚词。' : '从以下18个文言虚词中选择出题：' + wordListText + '。') +
      '\n\n要求：\n' +
      '1. 每道题给出一个包含该虚词的文言例句（尽量从经典课文中选，或仿经典造句）\n' +
      '2. 提问句中该虚词的意义或用法\n' +
      '3. 提供4个选项，只有1个正确\n' +
      '4. 每题附带简短解析\n\n' +
      '请严格输出JSON数组格式，不要额外文字，格式如下：\n' +
      '[\n' +
      '  {\n' +
      '    "focusWord": "而",\n' +
      '    "sentence": "青，取之于蓝，而青于蓝",\n' +
      '    "question": "句中\"而\"的用法是？",\n' +
      '    "options": ["表并列", "表转折", "表承接", "表修饰"],\n' +
      '    "answer": 1,\n' +
      '    "explanation": "此处\"而\"表转折，意为\"却\"。全句译为：靛青从蓝草中提取，却比蓝草颜色更深。"\n' +
      '  }\n' +
      ']\n\n' +
      '注意：answer字段为正确选项的索引（0-based），请确保每题只有一个正确答案。';
    try {
      var result = await callAI(cfg, prompt, 60000);
      aiGenerating = false;
      if (!result.success) { showToast('AI 出题失败：' + result.error, 'error'); return null; }
      // 尝试提取 JSON
      var text = result.content;
      var jsonStart = text.indexOf('[');
      var jsonEnd = text.lastIndexOf(']');
      if (jsonStart < 0 || jsonEnd < 0) { throw new Error('AI 返回格式不正确，无法解析题目'); }
      var jsonStr = text.substring(jsonStart, jsonEnd + 1);
      var questions = JSON.parse(jsonStr);
      if (!Array.isArray(questions) || questions.length === 0) throw new Error('AI 未生成有效题目');
      // 规范化字段
      questions = questions.map(function(q, i) {
        return {
          id: 'ai_' + Date.now() + '_' + i,
          type: 1,
          focusWord: q.focusWord || (q.options ? '虚词' : ''),
          sentence: q.sentence || '',
          question: q.question || '请选择正确答案',
          options: q.options || [],
          answer: typeof q.answer === 'number' ? q.answer : 0,
          explanation: q.explanation || '暂无解析'
        };
      }).filter(function(q) { return q.options.length >= 2 && typeof q.answer === 'number'; });
      if (questions.length === 0) throw new Error('生成的题目格式不符合要求');
      return questions;
    } catch (e) {
      aiGenerating = false;
      showToast('AI 出题失败：' + e.message, 'error');
      return null;
    }
  }

  /* ===== AI 生成情境默写题目 ===== */
  var aiSituationalGenerating = false;
  async function generateAISituationalQuestions(articleId) {
    var cfg = Store.getAIConfig();
    if (!cfg.apiUrl || !cfg.apiKey || !cfg.model) {
      showToast('请先在「更多」中配置 AI API 信息', 'warn');
      return null;
    }
    if (aiSituationalGenerating) { showToast('AI 正在出题中，请稍候…', 'info'); return null; }
    aiSituationalGenerating = true;
    showToast('AI 正在为情境默写出题，请稍候…', 'info');

    // 构造篇目信息提示
    var targetArt = null;
    var articleHint = '';
    if (articleId && articleId !== 'random') {
      targetArt = findArt(articleId);
      if (targetArt) {
        articleHint = '请围绕篇目《' + targetArt.title + '》（作者：' + (targetArt.author || '佚名') + '）出题。\n' +
          '原文参考：\n' + (targetArt.text || '').substring(0, 600) + '\n\n';
      }
    } else {
      // 随机：抽 5 篇做样本供 AI 选择
      var idxs = [];
      while (idxs.length < Math.min(5, D.length)) {
        var r = Math.floor(Math.random() * D.length);
        if (idxs.indexOf(r) < 0) idxs.push(r);
      }
      var sample = [];
      for (var i = 0; i < idxs.length; i++) {
        var a = D[idxs[i]];
        sample.push('《' + a.title + '》（' + (a.author || '佚名') + '）：' + (a.text || '').substring(0, 180).replace(/\n+/g, ' '));
      }
      articleHint = '请从以下篇目中任选若干出题（也可同篇多题）：\n' + sample.join('\n') + '\n\n';
    }

    var prompt = '你是一位资深的高中语文老师，正在为学生准备"情境默写"练习题。' +
      articleHint +
      (cfg.quizType === 'mock' ? '出题要求：模拟题风格，情境设置贴近模拟考试，难度适中，考查对原文的准确记忆和理解。\n\n'
        : cfg.quizType === 'real' ? '出题要求：高考真题风格，情境设置参照历年高考真题的命题方式，注重综合考查，难度较高。\n\n'
        : '') +
      '请生成 5 道情境默写题。\n\n' +
      '要求：\n' +
      '1. 每道题用一个具体情境句引导（如"作者在某场景下用______句表达…"），挖空处必须用 6 个下划线 "______" 表示\n' +
      '2. 每道题可挖 1～3 个空，每个空对应原文中一句完整的诗句或文句\n' +
      '3. 答案必须与原文文字完全一致（不含标点）\n' +
      '4. 每题附简短解析\n' +
      '5. 不得编造原文中不存在的句子\n\n' +
      '请严格输出 JSON 数组格式，不要输出任何额外文字，格式如下：\n' +
      '[\n' +
      '  {\n' +
      '    "articleId": "chushibiao",\n' +
      '    "articleTitle": "出师表",\n' +
      '    "scenario": "诸葛亮在《出师表》中用\\"______，______\\"两句劝谏后主不宜妄自菲薄，以免阻塞忠谏之路。",\n' +
      '    "answers": ["不宜妄自菲薄", "引喻失义"],\n' +
      '    "explanation": "原文为\\"不宜妄自菲薄，引喻失义，以塞忠谏之路也\\"。"\n' +
      '  }\n' +
      ']\n\n' +
      '注意：scenario 中的占位符必须用 6 个下划线 "______"；answers 数组长度必须与占位符数量完全一致。';

    try {
      var result = await callAI(cfg, prompt, 60000);
      aiSituationalGenerating = false;
      if (!result.success) { showToast('AI 出题失败：' + result.error, 'error'); return null; }
      var text = result.content || '';
      var jsonStart = text.indexOf('[');
      var jsonEnd = text.lastIndexOf(']');
      if (jsonStart < 0 || jsonEnd < 0) { throw new Error('AI 返回格式不正确，无法解析题目'); }
      var jsonStr = text.substring(jsonStart, jsonEnd + 1);
      var questions = JSON.parse(jsonStr);
      if (!Array.isArray(questions) || questions.length === 0) throw new Error('AI 未生成有效题目');
      // 规范化字段 + 校验占位符与答案数量匹配
      questions = questions.map(function(q, i) {
        return {
          id: 'ai_sq_' + Date.now() + '_' + i,
          articleId: q.articleId || (targetArt ? targetArt.id : 'random'),
          articleTitle: q.articleTitle || (targetArt ? targetArt.title : '随机篇目'),
          scenario: String(q.scenario || ''),
          answers: Array.isArray(q.answers) ? q.answers.map(function(a){ return String(a); }) : [],
          explanation: q.explanation || '暂无解析'
        };
      }).filter(function(q) {
        var blanks = (q.scenario.match(/_{6}/g) || []).length;
        return blanks > 0 && blanks === q.answers.length;
      });
      if (questions.length === 0) throw new Error('生成的题目占位符与答案数量不匹配');
      return questions;
    } catch (e) {
      aiSituationalGenerating = false;
      showToast('AI 出题失败：' + (e.message || '未知错误'), 'error');
      return null;
    }
  }

  /* ===== 数据导出/导入/重置 ===== */
  function exportData(){
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key.indexOf('bsw_') === 0) {
        try { data[key] = JSON.parse(localStorage.getItem(key)); }
        catch(e){ data[key] = localStorage.getItem(key); }
      }
    }
    var blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '背书哇_备份_' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('数据已导出', 'success');
  }

  function importData(file){
    var reader = new FileReader();
    reader.onload = function(e){
      try {
        var data = JSON.parse(e.target.result);
        var count = 0;
        for (var key in data) {
          if (key.indexOf('bsw_') === 0) {
            if (key === 'bsw_wrongbook') {
              var existing = Store.getWrongBook();
              var merged = existing.concat(data[key]);
              localStorage.setItem(key, JSON.stringify(merged));
            } else if (key === 'bsw_practiceStats') {
              var es = Store.getStats();
              var is = data[key];
              es.totalAttempts += is.totalAttempts || 0;
              es.totalCorrect += is.totalCorrect || 0;
              if (is.blank) { es.blank.attempts += is.blank.attempts||0; es.blank.correct += is.blank.correct||0; }
              if (is.match) { es.match.attempts += is.match.attempts||0; es.match.correct += is.match.correct||0; }
              if (is.pair) { es.pair.attempts += is.pair.attempts||0; es.pair.correct += is.pair.correct||0; }
              localStorage.setItem(key, JSON.stringify(es));
            } else {
              localStorage.setItem(key, JSON.stringify(data[key]));
            }
            count++;
          }
        }
        showToast('已导入 ' + count + ' 项数据', 'success');
        // 导入后把数据立即写入当前用户的 profile 文件（直接写 localStorage 不会触发防抖保存）
        saveProfile();
        renderSidebar();
        if (viewMode === 'art') selectArticle(cur.id);
        updateStorageUsage();
      } catch(err) {
        showToast('导入失败：文件格式错误', 'error');
      }
    };
    reader.readAsText(file);
  }

  var _resetConfirm = null;
  function bindResetBtn(btn){
    btn.onclick = function(){
      var type = btn.getAttribute('data-reset');
      var origText = {wrongbook:'错题本',stats:'统计',recite:'已背诵',all:'全部'}[type];
      if (_resetConfirm === type) {
        if (type === 'wrongbook') Store.clearWrongBook();
        else if (type === 'stats') Store.set('practiceStats', {totalAttempts:0,totalCorrect:0,blank:{attempts:0,correct:0},match:{attempts:0,correct:0},pair:{attempts:0,correct:0}});
        else if (type === 'recite') { Store.set('recited', []); }
        else if (type === 'all') {
          // 清空「更多」里的全部学习数据，但保留账户（用户名/密码）
          var _p = window.__ACTIVE_PROFILE__;
          if (_p) {
            ProfileAPI().write(_p.file, { username: _p.username, password: _p.password, createdAt: _p.createdAt, data: {} });
          }
          // 仅清除学习数据键，保留账户索引与 OOBE 完成标记
          var _keep = ['bsw_oobeCompleted', 'bsw_accountIndex'];
          var _rm = [];
          for (var _i = 0; _i < localStorage.length; _i++) {
            var _k = localStorage.key(_i);
            if (_k && _k.indexOf('bsw_') === 0 && _keep.indexOf(_k) === -1) _rm.push(_k);
          }
          _rm.forEach(function (_k) { localStorage.removeItem(_k); });
          location.reload();
          return;
        }
        btn.textContent = '对 已重置';
        btn.style.color = '#4caf50'; btn.style.borderColor = '#4caf50';
        _resetConfirm = null;
        showToast(origText + '已重置', 'success');
        updateStorageUsage();
        renderSidebar();
        setTimeout(function(){ btn.textContent = origText; btn.style.color = type==='all'?'#f44336':''; btn.style.borderColor = type==='all'?'#f44336':''; }, 2000);
      } else {
        _resetConfirm = type;
        btn.textContent = '确认？';
        btn.style.color = '#f44336'; btn.style.borderColor = '#f44336';
        setTimeout(function(){ if(_resetConfirm === type){ _resetConfirm = null; btn.textContent = origText; btn.style.color = type==='all'?'#f44336':''; btn.style.borderColor = type==='all'?'#f44336':''; } }, 3000);
      }
    };
  }

  function updateStorageUsage(){
    var total = 0;
    for (var i = 0; i < localStorage.length; i++) {
      total += (localStorage.key(i) || '').length + (localStorage.getItem(localStorage.key(i)) || '').length;
    }
    var kb = (total / 1024).toFixed(1);
    var el = document.getElementById('storageUsage');
    if (el) el.textContent = kb + ' KB（约 ' + Math.max(0, 5120 - parseFloat(kb)).toFixed(0) + ' KB 可用）';
  }

  var saveScroll = throttle(function(){
    if(cur) Store.setScroll(cur.id, contentArea.scrollTop);
  }, 400);
  contentArea.addEventListener('scroll', saveScroll);

  function getSiblingArticle(dir){
    var cat = cur.cat;
    var sameCat = [];
    for (var j = 0; j < D.length; j++) { if (D[j].cat === cat) sameCat.push(D[j]); }
    var posInCat = -1;
    for (var k = 0; k < sameCat.length; k++) { if (sameCat[k].id === cur.id) { posInCat = k; break; } }
    if (posInCat < 0) return null;
    var newPos = posInCat + dir;
    if (newPos < 0) newPos = sameCat.length - 1;
    if (newPos >= sameCat.length) newPos = 0;
    return sameCat[newPos];
  }
  function prevArticle(){ var n = getSiblingArticle(-1); if(n) selectArticle(n.id); }
  function nextArticle(){ var n = getSiblingArticle(1); if(n) selectArticle(n.id); }

  function updateRecitedBtn(){
    var btn = document.getElementById('recitedBtn');
    if(!btn) return;
    var ico = document.getElementById('recitedIco');
    var on = cur && Store.isRecited(cur.id);
    btn.classList.toggle('on', on);
    if (ico) ico.className = 'ico ' + (on ? 'ico-star' : 'ico-unstar');
  }

  function selectArticle(id) {
    var art = findArt(id);
    if (!art) return;
    // 保存当前音频进度再切换
    if (cur && resolveAudio(cur) && cur.id !== id && audioEl.duration) Store.setAudio(cur.id, audioEl.currentTime);
    cur = art;
    TTS.stop();
    showArticleView();
    artTitle.textContent = cur.title;
    artAuthor.innerHTML = '';
    var authorBtn = document.createElement('button');
    authorBtn.className = 'author-tag-btn';
    authorBtn.type = 'button';
    var diff = getArticleDifficulty(cur);
    authorBtn.textContent = diff ? cur.author + '  ·  ' + diff : cur.author;
    authorBtn.onclick = function(e){ e.stopPropagation(); if(cur && cur.authorId) showAuthorDetail(cur.authorId); };
    artAuthor.appendChild(authorBtn);
    // 高亮关键词：仅在 学-篇目 且搜索框有值时
    if (systemMode === 'learn' && sidebarTab === 'art' && searchIn.value.trim()) {
      hlKw = searchIn.value.trim();
    } else {
      hlKw = '';
      searchNav.classList.add('hidden');
    }
    if (systemMode === 'learn') {
      renderText(cur.text, cur);
    }
    updateRecitedBtn();
    loadAudio();
    Store.setLast(cur.id);
    if (systemMode === 'learn' && sidebarTab === 'art') renderArticleNav();
    // 恢复滚动位置
    var savedScroll = Store.getScroll(cur.id);
    requestAnimationFrame(function(){
      contentArea.scrollTop = savedScroll || 0;
    });
  }

  /* ===== SIDEBAR TAB SWITCH ===== */
  modeBtn1.onclick = function() {
    if (systemMode === 'word') {
      startWordGame();
      return;
    }
    modeBtn1.classList.add('active');
    modeBtn2.classList.remove('active');
    if (systemMode === 'learn') {
      sidebarTab = 'art';
      searchIn.placeholder = '搜索篇目';
      searchIn.value = '';
      hlKw = '';
      searchNav.classList.add('hidden');
      renderSidebar();
      selectArticle(cur.id);
    } else {
      sidebarTab = 'jushi';
      searchIn.placeholder = '搜索句式';
      searchIn.value = '';
      renderSidebar();
      showPlaceholder('点击左侧分类查看实例', '句式', '从收录课文中精选典型例句');
    }
  };

  modeBtn2.onclick = function() {
    if (systemMode === 'word') return;
    modeBtn2.classList.add('active');
    modeBtn1.classList.remove('active');
    if (systemMode === 'learn') {
      sidebarTab = 'author';
      searchIn.placeholder = '搜索作家';
      searchIn.value = '';
      currentDynasty = null;
      renderSidebar();
      showDynastyCards(null);
    } else {
      sidebarTab = 'cilei';
      searchIn.placeholder = '搜索词类活用';
      searchIn.value = '';
      renderSidebar();
      showPlaceholder('点击左侧分类查看实例', '词类活用', '从收录课文中精选典型例句');
    }
  };

  /* ===== FONT SIZE (article body / author detail bio) ===== */
  function applyCurrentFontSize() {
    if (viewMode === 'authorDetail') {
      var bio = document.querySelector('.author-detail-bio');
      if (bio) bio.style.fontSize = authorDetailFontSize + 'px';
    } else if (viewMode === 'art') {
      artBody.style.fontSize = bodyFontSize + 'px';
      artBody.style.lineHeight = '2';
      var tb = document.getElementById('artTransBody');
      if (tb) { tb.style.fontSize = bodyFontSize + 'px'; tb.style.lineHeight = '2'; }
      var ap = document.getElementById('artAppreciationBody');
      if (ap) ap.style.fontSize = Math.max(13, bodyFontSize - 2) + 'px';
      // 强制右侧字解/翻译中的注解条目继承字号，确保与正文时刻统一
      var rightItems = document.querySelectorAll('#artTransBody .notes-row-item');
      for (var i = 0; i < rightItems.length; i++) {
        rightItems[i].style.fontSize = bodyFontSize + 'px';
      }
    }
  }
  document.getElementById('fsMinus').onclick = function() {
    if (viewMode === 'authorDetail') {
      authorDetailFontSize = Math.max(12, authorDetailFontSize - 2);
      Store.setAuthorFont(authorDetailFontSize);
    } else {
      bodyFontSize = Math.max(12, bodyFontSize - 2);
      Store.setFont(bodyFontSize);
    }
    applyCurrentFontSize();
  };
  document.getElementById('fsPlus').onclick = function() {
    if (viewMode === 'authorDetail') {
      authorDetailFontSize = Math.min(32, authorDetailFontSize + 2);
      Store.setAuthorFont(authorDetailFontSize);
    } else {
      bodyFontSize = Math.min(32, bodyFontSize + 2);
      Store.setFont(bodyFontSize);
    }
    applyCurrentFontSize();
  };
  // 显示模式选择器（翻译/字解/仅原文）
  var recitedBtn = document.getElementById('recitedBtn');
  var artSplit = document.getElementById('artSplit');
  var modeSelectBtn = document.getElementById('modeSelectBtn');
  var modeSelectMenu = document.getElementById('modeSelectMenu');
  var modeSelectItems = modeSelectMenu.querySelectorAll('.mode-select-item');
  var artMode = 'orig-only';
  artSplit.classList.add('no-split');

  // 关闭菜单（点击外部 + 滚动 + 视口变化）
  function closeModeMenu() {
    if (!modeSelectMenu.classList.contains('open')) return;
    modeSelectMenu.classList.remove('open');
  }
  function positionModeMenu() {
    if (!modeSelectMenu.classList.contains('open')) return;
    var rect = modeSelectBtn.getBoundingClientRect();
    var menuW = modeSelectMenu.offsetWidth || 160;
    var top = rect.bottom + 4;
    var right = Math.max(8, window.innerWidth - rect.right);
    modeSelectMenu.style.top = top + 'px';
    modeSelectMenu.style.right = right + 'px';
    modeSelectMenu.style.left = 'auto';
    // 超出屏幕底部则改为向上展开
    var menuH = modeSelectMenu.offsetHeight || 120;
    if (top + menuH > window.innerHeight - 8) {
      modeSelectMenu.style.top = Math.max(8, rect.top - menuH - 4) + 'px';
    }
  }
  document.addEventListener('click', function(e) {
    if (!modeSelectMenu.classList.contains('open')) return;
    if (e.target === modeSelectBtn) return;          // 按钮自身 click 在下面 toggle
    if (modeSelectMenu.contains(e.target)) return;  // 点击菜单项不关闭（setArtMode 会关）
    if (modeSelectBtn.contains(e.target)) return;   // 兼容
    closeModeMenu();
  });
  modeSelectBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    var willOpen = !modeSelectMenu.classList.contains('open');
    modeSelectMenu.classList.toggle('open');
    if (willOpen) positionModeMenu();
  });
  window.addEventListener('resize', closeModeMenu);
  window.addEventListener('scroll', closeModeMenu, true);

  function setArtMode(mode) {
    artMode = mode;
    artSplit.classList.remove('notes-mode');
    artSplit.classList.remove('para-gap');
    modeSelectBtn.textContent = mode === 'orig-only' ? '仅原文'
      : (mode === 'translation' ? '翻译' : '字解');
    modeSelectBtn.classList.toggle('on', mode !== 'orig-only');
    modeSelectItems.forEach(function(it) {
      it.classList.toggle('active', it.dataset.mode === mode);
    });
    modeSelectMenu.classList.remove('open');

    if (mode === 'orig-only') {
      artSplit.classList.add('no-split');
      // 还原原文（清除 notes 高亮）
      if (cur) renderText(cur.text, cur);
    } else if (mode === 'translation') {
      artSplit.classList.remove('no-split');
      if (cur) {
        renderText(cur.text, cur);
        renderTranslation(cur);
      }
    } else if (mode === 'notes') {
      artSplit.classList.remove('no-split');
      if (cur) renderNotesMode(cur);
    }
  }

  modeSelectItems.forEach(function(it) {
    it.addEventListener('click', function() {
      setArtMode(it.dataset.mode);
    });
  });

  recitedBtn.onclick = function(){
    if(!cur) return;
    var added = Store.toggleRecited(cur.id);
    updateRecitedBtn();
    if (systemMode === 'learn' && sidebarTab === 'art') renderArticleNav();
    // 立即更新当前目录按钮状态，避免重新渲染延迟
    var navBtn = navEl.querySelector('.sbtn[data-id="' + cur.id + '"]');
    if (navBtn) navBtn.classList.toggle('recited', added);
    pushNotice(added ? '★已标记为已背诵' : '☆已取消已背诵', added ? 'success' : 'info');
  };
  /* ===== NOTES 字解模式渲染 ===== */
  function renderNotesMode(art) {
    if (!art || !art.notes || !art.notes.length) {
      // 没有 notes，回退到翻译模式
      showToast('本文暂无字解数据，已切换为翻译', 'info');
      setArtMode('translation');
      return;
    }
    // 1. 先渲染左侧原文（按行，高亮 pos）
    artSplit.classList.add('notes-mode');
    renderTextWithNotes(art);

    var transBox = document.getElementById('artTransBox');
    var transBody = document.getElementById('artTransBody');
    var transTitle = document.getElementById('artTransTitle');
    transBox.style.display = '';
    document.getElementById('artDivider').style.display = '';
    transTitle.textContent = '字解';

    // 2. 按原文行拆分右侧字解，每行只显示该行包含的字解，与左侧逐行对齐
    var lines = String(art.text || '').split('\n');
    var html = '';
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim()) continue; // 跳过空行，段落间距由 para-gap 的 margin 控制
      var parts = [];
      for (var j = 0; j < art.notes.length; j++) {
        var n = art.notes[j];
        var pos = n.pos || n.phrase || '';
        if (pos && line.indexOf(pos) !== -1) {
          parts.push('<span class="notes-row-item"><span class="notes-row-idx">' + (j + 1) + '</span>' + escapeHtml(n.explain || '') + '</span>');
        }
      }
      if (parts.length === 0) {
        html += '<p class="notes-row empty"></p>';
      } else {
        html += '<p class="notes-row">' + parts.join('<br>') + '</p>';
      }
    }
    transBody.innerHTML = html;

    // 补齐行数：较短一侧补空 <p>
    var leftBody = document.getElementById('artBody');
    var leftCount = leftBody ? leftBody.children.length : 0;
    var rightCount = transBody.children.length;
    while (transBody.children.length < leftCount) transBody.appendChild(document.createElement('p'));
    if (leftBody) {
      while (leftBody.children.length < rightCount) leftBody.appendChild(document.createElement('p'));
    }

    var transAuthor = transBox.querySelector('.art-author');
    var srcAuthor = document.getElementById('artAuthor');
    if (transAuthor && srcAuthor) transAuthor.innerHTML = srcAuthor.innerHTML;
    transBody.style.fontSize = bodyFontSize + 'px';
    transBody.style.lineHeight = '2';

    alignSplitRows();
  }

  function renderTextWithNotes(art) {
    if (!art) return;
    var txt = art.text || '';
    // 字解模式按行拆分，便于右侧字解按行对齐
    var paras = String(txt).split('\n');
    var html = '';
    var hasEmptyLine = false;
    // 按 pos 长度倒序，避免短串先替换导致长串匹配不到
    var notes = (art.notes || []).slice().map(function(n, i) {
      return { pos: n.pos || n.phrase || '', idx: i };
    }).filter(function(n) { return n.pos; })
      .sort(function(a, b) { return b.pos.length - a.pos.length; });

    for (var i = 0; i < paras.length; i++) {
      var p = paras[i];
      if (!p.trim()) { hasEmptyLine = true; continue; } // 跳过空行，段间距用 margin 控制
      if (hlKw) p = highlight(p, hlKw);
      p = p.replace(/\n/g, '<br>');
      // 在段落内逐句标记 pos（按句号、问号、感叹号、分号切分）
      p = markNotesInText(p, notes);
      html += '<p>' + p + '</p>';
    }
    artBody.innerHTML = html;
    // 含空行分段（散文）时，用约一行的段间距替代空行占位
    artSplit.classList.toggle('para-gap', hasEmptyLine);
    artBody.style.fontSize = bodyFontSize + 'px';
  }

  function markNotesInText(text, notes) {
    // text 已含 <br>，不能再被切；但我们只在纯文本节点上做替换
    // 简化：用 token 替换法，先保护 <br>
    var placeholders = [];
    var work = text.replace(/<br\s*\/?>/g, function(m) {
      placeholders.push(m);
      return '\u0001BR' + (placeholders.length - 1) + '\u0001';
    });

    // 找出每个 pos 出现的位置并打标签
    // 因为有多个 pos，逐个扫描替换；同一 pos 多次出现只标第一次
    var used = {};
    notes.forEach(function(n) {
      if (used[n.pos]) return;
      var safePos = n.pos.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var re = new RegExp(safePos, '');
      if (re.test(work)) {
        var idx = n.idx + 1;
        var markStr = '<span class="note-mark" data-idx="' + idx + '">' + n.pos + '<span class="nm-idx">' + idx + '</span></span>';
        work = work.replace(re, markStr.replace(/\$/g, '$$$$'));
        used[n.pos] = true;
      }
    });

    // 还原 <br>
    work = work.replace(/\u0001BR(\d+)\u0001/g, function(m, n) {
      return placeholders[parseInt(n, 10)];
    });
    return work;
  }

  /* ===== APPRECIATION 渲染 ===== */
  function renderAppreciation(art) {
    var ap = document.getElementById('artAppreciation');
    var body = document.getElementById('artAppreciationBody');
    if (!ap || !body) return;
    if (art && art.appreciation) {
      body.textContent = art.appreciation;
      // 字号比正文小 2px
      body.style.fontSize = Math.max(13, bodyFontSize - 2) + 'px';
      ap.style.display = 'block';
      glassArtAppreciation(ap.parentElement || document.getElementById('artSplit'));
    } else {
      ap.style.display = 'none';
    }
  }

  /* ===== PLAYER ===== */
  function setPpIcon(p){ document.getElementById('ppIco').className = 'ico ' + (p ? 'ico-pause' : 'ico-play'); }
  btnRW.onclick = function() { if(cur && resolveAudio(cur)) audioEl.currentTime = Math.max(0, audioEl.currentTime - 5); };
  btnFF.onclick = function() { if(cur && resolveAudio(cur)) audioEl.currentTime = Math.min(audioEl.duration || 0, audioEl.currentTime + 5); };
  btnPP.onclick = function() {
    if (!cur || !resolveAudio(cur)) return;
    if (audioEl.error) return;
    if (playing) {
      playing = false; setPpIcon(false); audioEl.pause();
    } else {
      TTS.stop();
      playing = true; setPpIcon(true);
      var result = audioEl.play();
      if (result && typeof result.catch === 'function') result.catch(function() { playing=false; setPpIcon(false); });
    }
  };
  pTrack.onclick = function(e) {
    if (!cur || !resolveAudio(cur)) return;
    var rect = pTrack.getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (audioEl.duration) audioEl.currentTime = pct * audioEl.duration;
  };

  var SPEEDS = [0.75, 1, 1.25, 1.5];
  function updateSpeedBtn(){ speedBtn.textContent = Store.getSpeed() + 'x'; }
  speedBtn.onclick = function() {
    if (!cur || !resolveAudio(cur)) return;
    var s = Store.getSpeed();
    var idx = SPEEDS.indexOf(s);
    var next = SPEEDS[(idx + 1) % SPEEDS.length];
    Store.setSpeed(next);
    audioEl.playbackRate = next;
    updateSpeedBtn();
  };
  function updateLoopBtn(){ var on = Store.getLoop(); loopBtn.classList.toggle('loop-on', on); document.getElementById('loopIco').className = 'ico ' + (on ? 'ico-loop' : 'ico-list'); }
  loopBtn.onclick = function() {
    if (!cur || !resolveAudio(cur)) return;
    var v = !Store.getLoop();
    Store.setLoop(v);
    audioEl.loop = v;
    updateLoopBtn();
  };

  /* ===== TTS: Web Speech API 朗读系统 ===== */
  var authorTtsBtn = document.getElementById('authorTtsBtn');
  var TTS = {
    synth: window.speechSynthesis,
    voice: null,
    chunks: [],
    chunkIdx: 0,
    active: false,
    paused: false,
    speed: 1,
    highlightSpans: [],
    init: function(){
      var self = this;
      if(!this.synth){ authorTtsBtn.classList.add('disabled'); authorTtsBtn.title='浏览器不支持语音朗读'; return; }
      // Android 某些 WebView 存在 speechSynthesis 但未实现 cancel/speak（会抛 NotSupportedError）
      try {
        var voices = this.synth.getVoices();
        if(voices.length>0){ this.selectVoice(voices); }
        this.synth.onvoiceschanged = function(){
          try { self.selectVoice(self.synth.getVoices()); } catch(e){}
        };
      } catch(e) {
        authorTtsBtn.classList.add('disabled'); authorTtsBtn.title='浏览器不支持语音朗读';
      }
    },
    _safeCancel: function(){
      if(!this.synth) return;
      try { this.synth.cancel(); } catch(e){}
    },
    _safeSpeak: function(u){
      if(!this.synth) return false;
      try { this.synth.speak(u); return true; } catch(e){ return false; }
    },
    selectVoice: function(voices){
      if(!voices||!voices.length) return;
      var preferred = ['Microsoft Yaoyao','Microsoft Huihui','Google 普通话','Ting-Ting'];
      for(var p=0;p<preferred.length;p++){
        for(var v=0;v<voices.length;v++){
          if(voices[v].name.indexOf(preferred[p])>=0){ this.voice=voices[v]; this.supportsChinese=true; return; }
        }
      }
      for(var v=0;v<voices.length;v++){
        if(voices[v].lang.indexOf('zh-CN')>=0){ this.voice=voices[v]; this.supportsChinese=true; return; }
      }
      for(var v=0;v<voices.length;v++){
        if(voices[v].lang.indexOf('zh')>=0){ this.voice=voices[v]; this.supportsChinese=true; return; }
      }
      authorTtsBtn.classList.add('disabled'); authorTtsBtn.title='无可用的中文语音';
    },
    splitText: function(text){
      var raw = text.match(/[^。！？\n]+[。！？\n]?/g) || [text];
      var result = [];
      for(var i=0;i<raw.length;i++){
        var s = raw[i].trim();
        if(s.length>0) result.push(s);
      }
      return result;
    },
    play: function(){
      var self = this;
      if(!this.supportsChinese||!this.chunks.length) return;
      if(this.active&&this.paused){ this.resume(); return; }
      this.stop();
      this.active = true; this.paused = false; this.chunkIdx = 0;
      this.highlightClear();
      authorTtsBtn.classList.add('tts-playing');
      this.speakNext();
    },
    speakNext: function(){
      var self = this;
      if(!this.active||this.chunkIdx>=this.chunks.length){
        this.onComplete(); return;
      }
      var u = new SpeechSynthesisUtterance(this.chunks[this.chunkIdx]);
      u.lang = 'zh-CN'; u.rate = this.speed; u.voice = this.voice;
      u.onstart = function(){ self.highlightSentence(self.chunkIdx); };
      u.onend = function(){
        if(!self.active||self.paused) return;
        self.chunkIdx++;
        self.speakNext();
      };
      u.onerror = function(e){
        if(e.error==='canceled'||e.error==='interrupted') return;
        if(!self.active||self.paused) return;
        self.chunkIdx++;
        self.speakNext();
      };
      this._safeSpeak(u);
    },
    pause: function(){
      this.paused = true;
      this._safeCancel();
      authorTtsBtn.classList.remove('tts-playing');
    },
    resume: function(){
      this.paused = false;
      authorTtsBtn.classList.add('tts-playing');
      this.speakNext();
    },
    stop: function(){
      this.active = false; this.paused = false;
      this._safeCancel();
      authorTtsBtn.classList.remove('tts-playing');
      this.highlightClear();
    },
    onComplete: function(){
      this.active = false; this.paused = false;
      authorTtsBtn.classList.remove('tts-playing');
      this.highlightClear();
    },
    highlightSentence: function(idx){
      this.highlightClear();
      if(idx>=0&&idx<this.highlightSpans.length){
        this.highlightSpans[idx].classList.add('tts-hl');
        this.highlightSpans[idx].scrollIntoView({behavior:'smooth',block:'center'});
      }
    },
    highlightClear: function(){
      for(var i=0;i<this.highlightSpans.length;i++){
        this.highlightSpans[i].classList.remove('tts-hl');
      }
    },
    prepareText: function(text){
      this.stop();
      this.chunks = this.splitText(text);
      this.highlightClear();
      var artBody = document.getElementById('artBody');
      var html = '';
      var self = this;
      this.highlightSpans = [];
      for(var i=0;i<this.chunks.length;i++){
        html += '<span class="tts-seg" data-tts-idx="'+i+'">'+this.chunks[i]+'</span>';
      }
      artBody.innerHTML = html;
      var spans = artBody.querySelectorAll('.tts-seg');
      for(var j=0;j<spans.length;j++){ this.highlightSpans.push(spans[j]); }
      updateSearchNav();
    }
  };
  TTS.prepareAuthorText = function(text){
    this.stop();
    this.chunks = this.splitText(text);
    this.highlightClear();
    this.highlightSpans = [];
  };
  TTS.init();

  // 作者详情页语音播报
  function getAuthorTtsText() {
    if (!currentAuthor) return '';
    return currentAuthor.name + '，' + currentAuthor.dynasty + '。' + currentAuthor.bio;
  }
  authorTtsBtn.onclick = function(){
    if (viewMode !== 'authorDetail') return;
    if (TTS.active && !TTS.paused) { TTS.stop(); return; }
    if (playing) { btnPP.click(); }
    if (!TTS.supportsChinese) return;
    var txt = getAuthorTtsText();
    if (!txt) return;
    TTS.prepareAuthorText(txt);
    TTS.play();
  };

  // 离开作者详情页时自动停止语音
  var _origHideAllViews = hideAllViews;
  hideAllViews = function(){
    if (!viewAuthorDetail.classList.contains('hidden') && TTS.active) { TTS.stop(); }
    _origHideAllViews();
  };

  // 覆盖 renderText 包装 TTS 高亮（搜索激活时不覆盖，确保高亮正常）
  var _origRenderText = renderText;
  renderText = function(txt, art){
    if(TTS.active && !hlKw){
      TTS.prepareText(txt);
    } else {
      _origRenderText(txt, art);
    }
  };



  moreBtn.onclick = showAboutView;

  /* ===== SEARCH HIT NAV ===== */
  document.getElementById('hlPrev').onclick = function(){ hlJump(-1); };
  document.getElementById('hlNext').onclick = function(){ hlJump(1); };
  document.getElementById('hlClose').onclick = function(){
    searchIn.value = '';
    hlKw = '';
    searchNav.classList.add('hidden');
    if (viewMode === 'art') renderText(cur.text, cur);
    searchIn.oninput();
  };

  /* ===== SEARCH (all modes) ===== */
  searchIn.oninput = debounce(function() {
    var kw = searchIn.value.trim().toLowerCase();
    if (systemMode === 'learn' && sidebarTab === 'art') {
      var btns = navEl.querySelectorAll('.sbtn[data-id]');
      for (var i = 0; i < btns.length; i++) {
        var id = btns[i].getAttribute('data-id');
        var article = findArt(id);
        if (!article) continue;
        var match = !kw || article.title.toLowerCase().indexOf(kw) >= 0 || article.author.toLowerCase().indexOf(kw) >= 0 || article.text.toLowerCase().indexOf(kw) >= 0;
        btns[i].style.display = match ? 'flex' : 'none';
      }
      // 收藏/分类标签：若其下所有按钮均隐藏则隐藏标签
      var labels = navEl.querySelectorAll('.sec-label');
      for (var li = 0; li < labels.length; li++) {
        var anyVisible = false;
        var sib = labels[li].nextElementSibling;
        while (sib && sib.classList.contains('sbtn')) {
          if (sib.style.display !== 'none') { anyVisible = true; break; }
          sib = sib.nextElementSibling;
        }
        labels[li].style.display = (kw && !anyVisible) ? 'none' : '';
      }
      // 若清空搜索且当前在文章视图，清除高亮
      if (!kw && viewMode === 'art') {
        hlKw = '';
        searchNav.classList.add('hidden');
        renderText(cur.text, cur);
      }
    } else if (systemMode === 'learn' && sidebarTab === 'author') {
      var sbtns = navEl.querySelectorAll('.sbtn[data-dynasty]');
      for (var k = 0; k < sbtns.length; k++) {
        var dyn = sbtns[k].getAttribute('data-dynasty');
        var matchDyn = !kw || dyn.toLowerCase().indexOf(kw) >= 0;
        if (!matchDyn) {
          for (var m = 0; m < AUTHORS.length; m++) {
            if (AUTHORS[m].dynasty === dyn && AUTHORS[m].name.toLowerCase().indexOf(kw) >= 0) { matchDyn = true; break; }
          }
        }
        sbtns[k].style.display = matchDyn ? 'flex' : 'none';
      }
    } else if (systemMode === 'exercise') {
      if (sidebarTab === 'exArt') {
        renderExArtNav();
      }
    } else {
      // practice: filter nav-parent / nav-child by name and example sentences
      var parents = navEl.querySelectorAll('.nav-parent');
      for (var pi = 0; pi < parents.length; pi++) {
        var pName = parents[pi].textContent.toLowerCase();
        var pMatch = !kw || pName.indexOf(kw) >= 0;
        var childMatch = false;
        var cd = parents[pi].nextElementSibling;
        if (cd && cd.classList.contains('nav-children')) {
          var chBtns = cd.querySelectorAll('.nav-child');
          for (var ci = 0; ci < chBtns.length; ci++) {
            var cId = chBtns[ci].getAttribute('data-nav-id');
            var cName = chBtns[ci].textContent.toLowerCase();
            var data = sidebarTab === 'jushi' ? JUSHI : CILEI;
            var cat = data[cId];
            var sentenceMatch = false;
            if (cat && kw) {
              for (var si = 0; si < cat.items.length; si++) {
                if (cat.items[si].s.toLowerCase().indexOf(kw) >= 0 || cat.items[si].e.toLowerCase().indexOf(kw) >= 0) { sentenceMatch = true; break; }
              }
            }
            var cm = !kw || cName.indexOf(kw) >= 0 || sentenceMatch;
            chBtns[ci].style.display = cm ? 'flex' : 'none';
            if (cm) childMatch = true;
          }
        }
        parents[pi].style.display = (pMatch || childMatch) ? 'flex' : 'none';
      }
    }
  }, 200);

  /* ===== HAMBURGER MENU (mobile) ===== */
  var hamburger = document.getElementById('hamburger');
  var sideOverlay = document.getElementById('sideOverlay');
  var sideEl = document.getElementById('side');
  function openSidebar(){ sideEl.classList.add('open'); sideOverlay.classList.add('show'); document.body.classList.add('sidebar-open'); hamburger.innerHTML = '✕'; hamburger.title = '收起侧边栏'; }
  function closeSidebar(){ sideEl.classList.remove('open'); sideOverlay.classList.remove('show'); document.body.classList.remove('sidebar-open'); hamburger.innerHTML = '☰'; hamburger.title = '展开侧边栏'; }
  hamburger.onclick = function(){ if(sideEl.classList.contains('open')) closeSidebar(); else openSidebar(); };
  sideOverlay.onclick = closeSidebar;
  // 点击侧边栏内任意按钮后关闭（移动端）
  sideEl.addEventListener('click', function(e){
    if(window.innerWidth <= 768 && (e.target.classList.contains('sbtn')||e.target.classList.contains('nav-parent')||e.target.classList.contains('nav-child')||e.target.closest('.mode-btn'))){ closeSidebar(); }
  });
  // 进入手机/平板宽度时自动收起侧边栏；初始化时若是小屏也默认收起
  function syncSidebarByWidth(){
    if(window.innerWidth <= 768 && sideEl.classList.contains('open')) closeSidebar();
  }
  window.addEventListener('resize', syncSidebarByWidth);
  if(window.innerWidth <= 768) closeSidebar();

  /* ===== INIT ===== */
  applyTheme();
  updateSpeedBtn();
  updateLoopBtn();
  renderArticleNav();
  var lastId = Store.getLast();
  selectArticle(lastId && findArt(lastId) ? lastId : 'lunyu');

  // 学习计时器：每分钟记录一次
  var studyTimer = setInterval(function() {
    Store.addStudyTime(1);
    var st = Store.getStudyTime();
    var streak = Store.getStreak();
    // 更新问候语旁的打卡天数
    if (streak.days > 0) {
      greet.textContent = greetMsg + ' ' + streak.days + '天';
    }
    // 每日目标达成提示
    if (st.today === 30) {
      showToast(' 今日学习目标达成！', 'success');
    }
  }, 60000);

  // 页面关闭时保存学习时间
  window.addEventListener('beforeunload', function() {
    Store.addStudyTime(0); // 确保日期正确
    Store.setLastState({ mode: systemMode, tab: sidebarTab, articleId: cur.id });
  });

  // 显示打卡天数
  var streak = Store.getStreak();
  if (streak.days > 0) greet.textContent = greetMsg + ' ' + streak.days + '天';

  /* ===== 继续学习提示 ===== */
  var lastState = Store.getLastState();
  if (lastState && (lastState.mode !== systemMode || lastState.articleId !== cur.id)) {
    var resumeBanner = document.createElement('div');
    resumeBanner.style.cssText = 'position:fixed;top:56px;left:50%;transform:translateX(-50%);z-index:50;padding:10px 20px;background:var(--card);border:1px solid var(--pri);font-family:"Microsoft YaHei",sans-serif;font-size:14px;color:var(--fg);cursor:pointer;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);animation:fadeUp .3s ease-out;white-space:nowrap';
    resumeBanner.textContent = '↩ 继续上次的学习？';
    document.body.appendChild(resumeBanner);
    var resumeTimeout = setTimeout(function(){ resumeBanner.click(); }, 4000);
    resumeBanner.onclick = function(){
      clearTimeout(resumeTimeout);
      resumeBanner.remove();
      modeBtn3.classList.add('hidden');
      modeBtn2.classList.remove('disabled');
      if (lastState.mode === 'practice') {
        systemMode = 'practice';
        modeBtn1.textContent = '句式'; modeBtn2.textContent = '词类活用';
        searchIn.placeholder = '搜索句式'; searchIn.classList.remove('hidden'); searchWrap.classList.remove('hidden');
        modeBtn1.classList.remove('hidden'); modeBtn2.classList.remove('hidden');
        sidebarTab = lastState.tab || 'jushi';
      } else if (lastState.mode === 'exercise') {
        systemMode = 'exercise';
        modeBtn1.classList.add('hidden'); modeBtn2.classList.add('hidden');
        searchIn.placeholder = ''; searchIn.classList.add('hidden'); searchWrap.classList.add('hidden');
        sidebarTab = lastState.tab || 'exType';
      } else if (lastState.mode === 'word') {
        systemMode = 'word';
        modeBtn1.textContent = '虚词'; modeBtn2.textContent = '实词';
        modeBtn1.classList.remove('hidden'); modeBtn2.classList.remove('hidden');
        modeBtn2.classList.add('disabled');
        searchIn.placeholder = ''; searchIn.classList.add('hidden'); searchWrap.classList.add('hidden');
        sidebarTab = lastState.tab || 'word';
      } else {
        systemMode = 'learn';
        modeBtn1.textContent = '篇目'; modeBtn2.textContent = '作家';
        searchIn.placeholder = '搜索篇目'; searchIn.classList.remove('hidden'); searchWrap.classList.remove('hidden');
        modeBtn1.classList.remove('hidden'); modeBtn2.classList.remove('hidden');
        sidebarTab = lastState.tab || 'art';
      }
      // 更新模式指示器文本和下拉菜单激活状态
      modeIndicatorText.textContent = modeNames[systemMode];
      modeSelectorItems.forEach(function(it) {
        it.classList.toggle('active', it.dataset.systemMode === systemMode);
      });
      modeBtn1.classList.add('active'); modeBtn2.classList.remove('active');
      renderSidebar();
      if (systemMode === 'word') {
        showWordGame();
      } else {
        selectArticle(findArt(lastState.articleId) ? lastState.articleId : 'lunyu');
      }
    };
    var cancelResume = function(e){ if(e.target !== resumeBanner){ clearTimeout(resumeTimeout); resumeBanner.remove(); document.removeEventListener('click', cancelResume); } };
    document.addEventListener('click', cancelResume);
  }

  /* ===== 移动端滑动手势 ===== */
  var touchStartX = 0, touchStartY = 0;
  contentArea.addEventListener('touchstart', function(e){
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });
  contentArea.addEventListener('touchend', function(e){
    if (systemMode !== 'learn') return;
    var dx = (e.changedTouches[0] || {}).clientX - touchStartX;
    var dy = (e.changedTouches[0] || {}).clientY - touchStartY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0) prevArticle();
      else nextArticle();
    }
  });

  /* ===== ARIA 属性 ===== */
  sideEl.setAttribute('role', 'navigation');
  sideEl.setAttribute('aria-label', '主菜单');
  contentArea.setAttribute('role', 'main');
  contentArea.setAttribute('aria-label', '内容区域');
  modeIndicator.setAttribute('aria-label', '切换模式');
  modeIndicator.setAttribute('role', 'button');
  themeBtn.setAttribute('aria-label', '切换主题');
  searchIn.setAttribute('aria-label', '搜索篇目');
  btnPP.setAttribute('aria-label', '播放/暂停');
  document.getElementById('fsMinus').setAttribute('aria-label', '缩小字体');
  document.getElementById('fsPlus').setAttribute('aria-label', '放大字体');
  contentArea.setAttribute('tabindex', '-1');

  /* ================================================================
     M1+ 功能块(方案 V3 路线图):
     ① normalizeTitle 音频归一化匹配(V2 §2.4)
     ② C1 补录《插秧歌》(唯一缺篇的有音频篇目)
     ③ 复习卡片 SRS-lite(V2 §4.3 SM-2 变体,卡壳句入队)
     ④ 首字链式背诵(V2.1 §1.1 渐进消隐)
     ⑤ (已移除)今日仪表盘 Home 模式 —— 改为账户登录制(见底部 Account 模块)
     ⑥ 全文朗读(TTS 逐句高亮,V2.1 §2.1 卡拉OK跟读)
     ⑦ 液态玻璃接管主面板(照抄 liquid-glass-react)
     ================================================================ */

  /* ---- ① 音频标题归一化(V2 §2.4):全半角括号/书名号/间隔号/空白 ---- */
  function normalizeTitle(s) {
    return (s || '').replace(/[《》【】()（）·・\s\-_.]/g, '').toLowerCase();
  }
  var _origResolveAudio = resolveAudio;
  resolveAudio = function (art) {
    if (!art) return null;
    var t = (art.title || '').trim();
    if (!t) return null;
    var key = normalizeTitle(t);
    for (var k in audioMap) {
      if (normalizeTitle(k) === key) return audioMap[k];
    }
    if (art.audio && /\.(mp3|wav|m4a|aac)$/i.test(art.audio)) return art.audio;
    return _origResolveAudio(art);
  };

  /* ---- ② C1 内容补录:插秧歌(有官方音频;方案 V3 §1.5) ---- */
  if (!findArt('chasangge')) {
    D.push({
      id: 'chasangge', title: '插秧歌', author: '杨万里', authorId: 'yangwanli', cat: 'gushici',
      audio: 'resource/audio/插秧歌.mp3',
      text: '田夫抛秧田妇接，小儿拔秧大儿插。\n笠是兜鍪蓑是甲，雨从头上湿到胛。\n唤渠朝餐歇半霎，低头折腰只不答。\n秧根未牢莳未匝，照管鹅儿与雏鸭。',
      translation: '农夫把秧苗抛在田中，农妇接住，小儿子拔秧，大儿子插秧。\n斗笠当作头盔，蓑衣当作铠甲，雨水从头上流下，湿透肩胛。\n喊他吃早饭让他歇一小会儿，他低头弯腰只顾干活不答话。\n秧根还没栽牢，田还没插完，还要提防鹅儿和雏鸭来糟蹋。',
      notes: [{ phrase: '兜鍪', pos: '笠是兜鍪蓑是甲', explain: '头盔。此句以兜鍪喻斗笠、以铠甲喻蓑衣，写抢插如作战。' }, { phrase: '胛', pos: '雨从头上湿到胛', explain: '肩胛。' }, { phrase: '渠', pos: '唤渠朝餐歇半霎', explain: '他，指插秧的农夫。' }, { phrase: '半霎', pos: '歇半霎', explain: '极短的时间。' }, { phrase: '莳', pos: '秧根未牢莳未匝', explain: '移栽、种植。' }, { phrase: '匝', pos: '莳未匝', explain: '完毕。' }, { phrase: '照管', pos: '照管鹅儿与雏鸭', explain: '提防、照看。' }],
      appreciation: '《插秧歌》是南宋诗人杨万里的七言古诗，生动描绘了江南农家雨中抢插稻秧的劳动场面。\n\n艺术特色：全诗以口语入诗，节奏明快。"田夫抛秧田妇接，小儿拔秧大儿插"一句一景，四个"抛、接、拔、插"动词连贯如画，写出全家总动员的抢种场景。三、四句以"兜鍪""甲"作比，把插秧写成紧张激烈的战斗，构思新奇。\n\n写作手法：五、六句"唤渠朝餐歇半霎，低头折腰只不答"以呼喊与不答的对照，侧面表现劳动的忘我与紧张。结尾嘱咐"照管鹅儿与雏鸭"，质朴的家常口吻中见出农事的辛劳，含蓄隽永，体现了诚斋体活泼自然、幽默风趣的特点。'
    });
    AUTHORS.push({
      id: 'yangwanli', name: '杨万里', dynasty: '南宋',
      bio: '杨万里（1127年\u20141206年），字廷秀，号诚斋，吉州吉水（今江西吉水）人。南宋诗人，与陆游、尤袤、范成大并称"中兴四大诗人"。一生作诗两万余首，传世作品有四千二百余首。其诗自成一格，语言浅近清新，活泼自然，风趣幽默，被称为"诚斋体"。代表作有《小池》《插秧歌》《晓出净慈寺送林子方》等。'
    });
  }

  /* ---- ③ 复习卡片(SRS-lite):SM-2 变体,规格见方案 V2 §4.3 ---- */
  var ReviewCards = {
    QUALITY: { FORGOT: 0, HARD: 1, GOOD: 2, EASY: 3 },
    all: function () { return Store.get('reviewCards', []); },
    save: function (list) { Store.set('reviewCards', list); },
    find: function (id) {
      var list = this.all();
      for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; }
      return null;
    },
    /* 句卡建立或复习(quality 为空则只建档不排期) */
    upsert: function (card, quality) {
      var list = this.all(), c = this.find(card.id);
      if (!c) {
        c = {
          id: card.id, kind: 'sentence', articleId: card.articleId, articleTitle: card.articleTitle,
          front: card.front || '', back: card.back || '',
          ef: 2.5, reps: 0, lapses: 0, interval: 0, due: Date.now(), state: 'new',
          created: Date.now(), lastReviewed: 0
        };
        list.push(c);
      }
      if (typeof quality === 'number') this.schedule(c, quality);
      this.save(list);
      return c;
    },
    /* SM-2 变体:忘了→10 分钟学习步;间隔 1d→3d→interval×EF;上限 180d */
    schedule: function (card, quality) {
      var q = [2, 3, 4, 5][quality];
      if (q < 3) {
        card.reps = 0; card.lapses++; card.interval = 0;
        card.state = 'learning';
        card.due = Date.now() + 10 * 60 * 1000;
        card.ef = Math.max(1.3, card.ef - 0.2);
      } else {
        if (card.reps === 0) card.interval = 1;
        else if (card.reps === 1) card.interval = 3;
        else {
          var bonus = quality === 3 ? 1.3 : (quality === 1 ? 0.7 : 1.0);
          card.interval = Math.min(180, Math.round(card.interval * card.ef * bonus));
        }
        card.reps++;
        if (q === 5) card.ef = Math.min(3.0, card.ef + 0.1);
        card.state = (card.interval >= 60 && card.lapses === 0) ? 'mastered' : 'review';
        card.due = Date.now() + card.interval * 86400000;
      }
      card.lastReviewed = Date.now();
    },
    dueList: function () {
      var now = Date.now(), list = this.all(), due = [];
      for (var i = 0; i < list.length; i++) {
        if (list[i].state !== 'mastered' && list[i].due <= now) due.push(list[i]);
      }
      due.sort(function (a, b) { return a.due - b.due; });
      return due;
    },
    dueCount: function () { return this.dueList().length; },
    total: function () { return this.all().filter(function (c) { return c.state !== 'mastered'; }).length; },

    /* 复习会话 */
    session: null,
    startSession: function () {
      var queue = this.dueList().slice(0, 100);
      this.session = { queue: queue, idx: 0, revealed: false, stats: { good: 0, forgot: 0 } };
      this.render();
    },
    render: function () {
      var s = this.session;
      artTitle.textContent = '复习卡片';
      artAuthor.textContent = '';
      if (!s.queue.length) {
        artBody.innerHTML = '<div class="review-stage"><div class="review-card">' +
          '<div class="review-front">今日没有到期的卡片</div>' +
          '<div class="review-from">完成「链式背诵」时卡壳的句子会自动进入复习队列</div>' +
          '<div class="review-actions"><button class="review-grade" id="rvBack">返回</button></div>' +
          '</div></div>';
        document.getElementById('rvBack').onclick = function () { ChainRecall.exitToArticle(); };
        return;
      }
      if (s.idx >= s.queue.length) {
        artBody.innerHTML = '<div class="review-stage"><div class="review-card">' +
          '<div class="review-front">复习完成!</div>' +
          '<div class="review-from">记牢 ' + s.stats.good + ' 句 · 待巩固 ' + s.stats.forgot + ' 句(未记牢的句子今天稍后会再出现)</div>' +
          '<div class="review-actions"><button class="review-grade" id="rvBack">完成</button></div>' +
          '</div></div>';
        document.getElementById('rvBack').onclick = function () { ChainRecall.exitToArticle(); };
        showToast('复习完成!记牢 ' + s.stats.good + ' 句', 'success');
        return;
      }
      var c = s.queue[s.idx];
      var html = '<div class="review-stage">' +
        '<div class="review-meta">第 ' + (s.idx + 1) + ' / ' + s.queue.length + ' 张 · 今日到期 ' + ReviewCards.dueCount() + ' 张</div>' +
        '<div class="review-card">' +
        '<div class="review-from">《' + escapeHtml(c.articleTitle) + '》</div>' +
        '<div class="review-front">' + escapeHtml(c.front) + '</div>' +
        (s.revealed ? '<div class="review-back">' + escapeHtml(c.back) + '</div>' : '') +
        '</div>' +
        '<div class="review-actions">' +
        (s.revealed
          ? '<button class="review-grade g0" data-q="0">忘了</button>' +
            '<button class="review-grade" data-q="1">想起来了</button>' +
            '<button class="review-grade" data-q="2">记住了</button>' +
            '<button class="review-grade g3" data-q="3">很简单</button>'
          : '<button class="review-grade primary" id="rvReveal" style="background:var(--pri);color:var(--pri-fg)">显示答案</button>') +
        '<button class="review-grade" id="rvQuit">结束</button>' +
        '</div></div>';
      artBody.innerHTML = html;
      var self = this;
      if (s.revealed) {
        var grades = artBody.querySelectorAll('.review-grade[data-q]');
        for (var i = 0; i < grades.length; i++) {
          grades[i].onclick = function () {
            ReviewCards.upsert({ id: c.id, articleId: c.articleId, articleTitle: c.articleTitle, front: c.front, back: c.back }, Number(this.dataset.q));
            if (Number(this.dataset.q) === 0) s.stats.forgot++; else s.stats.good++;
            s.idx++; s.revealed = false;
            self.render();
          };
        }
      } else {
        document.getElementById('rvReveal').onclick = function () { s.revealed = true; self.render(); };
      }
      document.getElementById('rvQuit').onclick = function () { ChainRecall.exitToArticle(); };
      artBody.scrollTop = 0;
      Store.updateStreak();
    }
  };

  /* ---- ④ 首字链式背诵(V2.1 §1.1):四级渐进消隐,卡壳句自动入复习队列 ---- */
  var CHAIN_LEVELS = [
    { name: 'L1 支架', tag: '全文淡显,逐句确认' },
    { name: 'L2 首字', tag: '只看每句首字' },
    { name: 'L3 骨架', tag: '只剩标点结构' },
    { name: 'L4 裸背', tag: '全空白连背' }
  ];
  var ChainRecall = {
    art: null, level: 0, sentences: [], graded: [], stuck: [],
    start: function (art) {
      this.art = art;
      this.sentences = TTS.splitText(art.text);
      this.level = Store.get('chain_' + art.id, 0);
      this.level = Math.min(this.level, CHAIN_LEVELS.length - 1);
      this.resetProgress();
      this.render();
    },
    resetProgress: function () {
      this.graded = []; this.stuck = [];
      for (var i = 0; i < this.sentences.length; i++) this.graded.push(null);
    },
    active: function () { return this.art !== null; },
    exitToArticle: function () {
      var art = this.art; this.art = null;
      if (!art) { if (cur) renderText(cur.text, cur); return; }
      ChainRecall._restore(art);
    },
    _restore: function (art) {
      if (findArt(art.id)) { selectArticle(art.id); }
      else { renderText(cur.text, cur); }
    },
    render: function () {
      var self = this;
      artTitle.textContent = this.art.title + ' · 链式背诵';
      artAuthor.textContent = this.art.author + ' · ' + CHAIN_LEVELS[this.level].name + '(' + CHAIN_LEVELS[this.level].tag + ')';
      var lv = this.level, html = '<div class="chain-wrap">';
      html += '<div class="chain-toolbar">' +
        '<span class="chain-level">' + CHAIN_LEVELS[lv].name + '</span>' +
        '<span class="chain-level-tag">' + CHAIN_LEVELS[lv].tag + '</span>' +
        '<span class="chain-progress" id="chainProgress"></span>' +
        '<span class="spacer"></span>' +
        '<button class="chain-btn" id="chainPrev">« 上一级</button>' +
        '<button class="chain-btn" id="chainNext"' + (lv >= CHAIN_LEVELS.length - 1 || this.level >= CHAIN_LEVELS.length - 1 ? '' : '') + '>下一级 »</button>' +
        '<button class="chain-btn primary" id="chainExit">退出</button>' +
        '</div>';
      for (var i = 0; i < this.sentences.length; i++) {
        html += '<div class="chain-sent" id="cs' + i + '">' +
          '<div class="chain-text">' + this.renderSentence(this.sentences[i], lv) + '</div>' +
          '<div class="chain-ops">' +
          '<button class="chain-btn" data-si="' + i + '" data-g="1">顺畅</button>' +
          '<button class="chain-btn warn" data-si="' + i + '" data-g="0">卡住了</button>' +
          '</div></div>';
      }
      html += '</div>';
      artBody.innerHTML = html;
      this.bindCommon();
      this.updateProgress();
      var ops = artBody.querySelectorAll('.chain-btn[data-si]');
      for (var j = 0; j < ops.length; j++) {
        ops[j].onclick = function () {
          self.gradeSentence(Number(this.dataset.si), Number(this.dataset.g) === 0, this);
        };
      }
      artBody.scrollTop = 0;
    },
    renderSentence: function (s, level) {
      var out = '', i, ch;
      if (level === 0) {
        for (i = 0; i < s.length; i++) {
          ch = escapeHtml(s[i]);
          out += i === 0 ? '<span class="first-char">' + ch + '</span>' : '<span class="dim">' + ch + '</span>';
        }
        return out;
      }
      if (level === 1) {
        for (i = 0; i < s.length; i++) {
          ch = escapeHtml(s[i]);
          out += i === 0 ? '<span class="first-char">' + ch + '</span>'
            : (/[，。；：、！？]/.test(s[i]) ? ch : '<span class="ghost">' + ch + '</span>');
        }
        return out;
      }
      if (level === 2) {
        for (i = 0; i < s.length; i++) {
          out += /[，。；：、！？]/.test(s[i]) ? escapeHtml(s[i]) : '<span class="ghost">·</span>';
        }
        return out;
      }
      return '<span class="ghost">' + new Array(s.length + 1).join('·') + '</span>';
    },
    bindCommon: function () {
      var self = this;
      document.getElementById('chainExit').onclick = function () { self.exitToArticle(); };
      document.getElementById('chainPrev').onclick = function () {
        if (self.level > 0) { self.level--; self.resetProgress(); self.render(); }
      };
      document.getElementById('chainNext').onclick = function () {
        if (self.level < CHAIN_LEVELS.length - 1) { self.level++; self.resetProgress(); self.render(); }
        else showToast('已是最高级别 L4 裸背', 'success');
      };
    },
    updateProgress: function () {
      var done = 0;
      for (var i = 0; i < this.graded.length; i++) { if (this.graded[i] !== null) done++; }
      var el = document.getElementById('chainProgress');
      if (el) el.textContent = '已评 ' + done + ' / ' + this.sentences.length + ' 句';
    },
    gradeSentence: function (idx, stuck, btn) {
      if (this.graded[idx] !== null) return;
      this.graded[idx] = stuck;
      if (stuck) {
        this.stuck.push(idx);
        var sent = this.sentences[idx];
        ReviewCards.upsert({
          id: this.art.id + '#s' + idx,
          articleId: this.art.id, articleTitle: this.art.title,
          front: sent.charAt(0) + '……',
          back: sent
        }, ReviewCards.QUALITY.FORGOT);
        var row = document.getElementById('cs' + idx);
        if (row) {
          row.classList.add('ok-stuck');
          var textEl = row.querySelector('.chain-text');
          if (textEl) textEl.innerHTML = '<span class="first-char">' + escapeHtml(sent.charAt(0)) + '</span>' + escapeHtml(sent.slice(1));
        }
      }
      if (btn) {
        var ops = btn.parentNode.querySelectorAll('.chain-btn');
        for (var i = 0; i < ops.length; i++) ops[i].disabled = true;
      }
      this.updateProgress();
      var allDone = true;
      for (var k = 0; k < this.graded.length; k++) { if (this.graded[k] === null) { allDone = false; break; } }
      if (allDone) this.finishLevel();
    },
    finishLevel: function () {
      var rate = this.stuck.length / this.sentences.length;
      var self = this;
      if (rate <= 0.2) {
        if (this.level < CHAIN_LEVELS.length - 1) {
          Store.set('chain_' + this.art.id, this.level + 1);
          showToast('卡壳率 ' + Math.round(rate * 100) + '%,晋级 ' + CHAIN_LEVELS[this.level + 1].name + '!', 'success');
          setTimeout(function () { self.level++; self.resetProgress(); self.render(); }, 900);
        } else {
          showToast('全篇裸背通过,《' + this.art.title + '》', 'success');
        }
      } else {
        showToast('还有 ' + this.stuck.length + ' 句卡壳(' + Math.round(rate * 100) + '%),已加入今日复习', 'warn');
      }
    }
  };

  /* 今日/Home 模式已移除（用户改为账户登录制，无统一首页仪表盘） */
  /* 大面板不使用 LiquidGlass 位移滤镜，避免色散/透明导致的可读性问题；改用 CSS 半透明卡片 */
  function glassCards(container) { /* dash cards use .dash-card background */ }
  function glassAuthorCards(container) { /* author cards use .author-card background */ }
  function glassExampleCards(container) { /* example cards use .example-card background */ }
  function glassStudyPanel(container) { /* study panels use .study-panel background */ }
  function glassArtAppreciation(container) { /* appreciation panels use .art-appreciation background */ }
  function glassWordGame(container) { /* word game panels use .word-game / .word-card background */ }
  function glassFlashcard(container) { /* flashcards use .flashcard background */ }
  /* 今日/Home 仪表盘已移除 */

  /* ---- ⑦ 液态玻璃:仅小元素保留，大面板禁用以保证高对比度 ---- */
  if (window.LiquidGlass) {
    // 仅对下拉菜单等小型浮层应用轻微液态玻璃效果
    var modeMenu = document.getElementById('modeSelectorMenu');
    if (modeMenu) {
      LiquidGlass.attach(modeMenu, { mode: 'standard', displacementScale: 16, blurAmount: 0.05, saturation: 120, cornerRadius: 6 });
    }
  }

  /* 版本号动态显示 */
  (function loadVersion() {
    var el = document.getElementById('aboutVersion');
    if (!el) return;
    var render = function (v) {
      if (v && v.version) el.textContent = 'v' + v.version + (v.channel === 'beta' ? ' (测试通道)' : '') + ' · ' + (v.releasedAt || '');
      else el.textContent = '未知';
    };
    if (typeof fetch === 'undefined') {
      // 无 fetch 的极端场景，直接用打包数据
      render(window.__BUNDLED__ && window.__BUNDLED__.version);
      return;
    }
    fetch('config/version.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(render)
      .catch(function () {
        // file:// 下 fetch 失败，退回到 config/bundled.js
        render(window.__BUNDLED__ && window.__BUNDLED__.version);
      });
  })();

  /* ---- ⑥ 全文朗读(TTS 逐句高亮)+ 顶部按钮 ---- */
(function OOBE(){
  var OOBE_FILE = 'preferences.json';
  var OOBE_FLAG_KEY = 'oobeCompleted';
  var IMAGES = [
    'resource/OOBE/page1.png',
    'resource/OOBE/page2.png',
    'resource/OOBE/page3.png'
  ];
  var TITLES = ['欢迎使用'];

  var state = { idx: 0 };

  function markCompleted(){
    // 写 userdata 文件
    UserDataAPI.read(OOBE_FILE).then(function(res){
      var obj = (res && res.data && typeof res.data === 'object') ? res.data : {};
      obj[OOBE_FLAG_KEY] = true;
      obj.oobeCompletedAt = new Date().toISOString();
      return UserDataAPI.write(OOBE_FILE, obj);
    }).then(function(){
      // 同步写 localStorage 防止下次再触发
      localStorage.setItem('bsw_oobeCompleted', '1');
    }).catch(function(){});
  }

  function buildDots(total, activeIdx){
    var html = '';
    for(var i=0;i<total;i++){
      html += '<div class="oobe-dot ' + (i===activeIdx?'active':'') + '"></div>';
    }
    return html;
  }

  function update(overlay){
    var total = IMAGES.length;
    overlay.querySelector('.oobe-img').src = IMAGES[state.idx];
    overlay.querySelector('.oobe-img').alt = TITLES[state.idx] || '';
    var prev = overlay.querySelector('.oobe-prev');
    var next = overlay.querySelector('.oobe-next');
    var skip = overlay.querySelector('.oobe-skip');
    prev.disabled = state.idx === 0;
    if (state.idx === total - 1) {
      next.textContent = '开始使用';
    } else {
      next.textContent = '下一步 »';
    }
    overlay.querySelector('.oobe-pages').innerHTML = buildDots(total, state.idx);
  }

  function close(overlay){
    overlay.remove();
    markCompleted();
  }

  function show(){
    // 预加载图片
    var total = IMAGES.length;
    var overlay = document.createElement('div');
    overlay.className = 'oobe-overlay';
    overlay.innerHTML =
      '<div class="oobe-box">' +
        '<span class="oobe-skip">跳过引导 ×</span>' +
        '<img class="oobe-img" alt="">' +
        '<div class="oobe-pages"></div>' +
        '<div class="oobe-nav">' +
          '<div class="oobe-nav-left">' +
            '<button class="oobe-btn oobe-btn-ghost oobe-prev">« 上一步</button>' +
          '</div>' +
          '<div class="oobe-nav-right">' +
            '<button class="oobe-btn oobe-btn-primary oobe-next">下一步 »</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    update(overlay);

    // 事件
    overlay.querySelector('.oobe-prev').addEventListener('click', function(){
      if (state.idx > 0) { state.idx--; update(overlay); }
    });
    overlay.querySelector('.oobe-next').addEventListener('click', function(){
      if (state.idx < total - 1) {
        state.idx++; update(overlay);
      } else {
        close(overlay);
      }
    });
    overlay.querySelector('.oobe-skip').addEventListener('click', function(){
      close(overlay);
    });
    // ESC 跳过
    overlay.addEventListener('keydown', function(e){
      if (e.key === 'Escape') close(overlay);
      if (e.key === 'ArrowRight') { if(state.idx<total-1){state.idx++;update(overlay);} else{close(overlay);} }
      if (e.key === 'ArrowLeft' && state.idx > 0) { state.idx--; update(overlay); }
    });
    overlay.tabIndex = 0;
    overlay.focus();
  }

  // OOBE 引导检查与 hydrate 挂钩：
  // UserDataAPI 定义在 DOMContentLoaded 回调内，此顶层 IIFE 可能访问不到，
  // 包一层 try 避免启动时 ReferenceError（失败则跳过引导，不影响核心功能）。
  try {
    function shouldShow(){
      // 1. localStorage 快速检查
      if (localStorage.getItem('bsw_oobeCompleted') === '1') return Promise.resolve(false);
      // 2. userdata 文件检查
      return UserDataAPI.read(OOBE_FILE).then(function(res){
        if (res && res.data && res.data && res.data[OOBE_FLAG_KEY]) {
          localStorage.setItem('bsw_oobeCompleted', '1');
          return false;
        }
        return true;
      }).catch(function(){ return true; });
    }

    // 在 UserDataAPI.hydrate 之后检查
    var origHydrate = UserDataAPI.hydrate.bind(UserDataAPI);
    UserDataAPI.hydrate = function(){
      return origHydrate().then(function(r){
        return shouldShow().then(function(need){
          if (need) setTimeout(show, 600);
          return r;
        });
      });
    };
  } catch(e) {}
})();

} /* ===== bootApp 结束 ===== */
