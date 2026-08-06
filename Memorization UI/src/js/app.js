document.addEventListener('DOMContentLoaded', function() {

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
    getFavs: function(){ return this.get('favs', []); },
    isFav: function(id){ return this.getFavs().indexOf(id) >= 0; },
    toggleFav: function(id){
      var f = this.getFavs(); var i = f.indexOf(id);
      if(i>=0){ f.splice(i,1); } else { f.push(id); }
      this.set('favs', f); return i<0;
    },
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
    getWallpaper: function(){ return this.get('wallpaper', {current:'bg.png', rotate:false, interval:30, index:0}); },
    setWallpaper: function(v){ this.set('wallpaper', v); },
    /* ===== 学习连续打卡 (Streak) ===== */
    getStreak: function(){
      var s = this.get('streak', {days:0, lastDate:''});
      if (s.lastDate) {
        var today = this.getDailyKey();
        if (s.lastDate !== today) {
          var last = new Date(s.lastDate);
          var now = new Date(today);
          var diff = Math.round((now - last) / 86400000);
          if (diff > 1) { s.days = 0; }
        }
      }
      return s;
    },
    updateStreak: function(){
      var s = this.get('streak', {days:0, lastDate:''});
      var today = this.getDailyKey();
      if (s.lastDate === today) return s;
      var yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      var yKey = yesterday.getFullYear() + '-' +
        ('0'+(yesterday.getMonth()+1)).slice(-2) + '-' +
        ('0'+yesterday.getDate()).slice(-2);
      if (s.lastDate === yKey) { s.days = (s.days||0) + 1; }
      else if (s.lastDate === today) { /* already counted */ }
      else { s.days = 1; }
      s.lastDate = today;
      this.set('streak', s);
      return s;
    },
    /* ===== 学习时间统计 ===== */
    addStudyTime: function(minutes){
      var dk = this.getDailyKey();
      this.recordDaily(dk, 'studyTime', minutes);
    },
    getStudyTime: function(){
      var ds = this.getDailyStats();
      var total = 0;
      for (var d in ds) { total += (ds[d].studyTime || 0); }
      var today = this.getDailyKey();
      var todayTime = (ds[today] && ds[today].studyTime) || 0;
      return { total: total, today: todayTime };
    },
    /* ===== 页面状态保存/恢复 ===== */
    setLastState: function(state){ this.set('lastState', state); },
    getLastState: function(){ return this.get('lastState', null); }
  };

  /* ===== Toast 通知系统 ===== */
  function showToast(msg, type){
    var container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    var toast = document.createElement('div');
    toast.className = 'toast' + (type ? ' ' + type : '');
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(function(){ toast.remove(); }, 3000);
  }

  function findArt(id){ for(var i=0;i<D.length;i++){ if(D[i].id===id) return D[i]; } return null; }
  function getArticleDifficulty(article){
    if (!article || !article.text) return '';
    var text = article.text;
    var len = text.length;
    // Difficulty factors: length, punctuation density (complex sentences), unique characters
    var difficulty = 0;
    // Length factor (0-3 points)
    if (len > 800) difficulty += 3;
    else if (len > 400) difficulty += 2;
    else if (len > 150) difficulty += 1;
    // Sentence count (approximate by period/comma count)
    var sentences = text.split(/[。！？]/).length;
    if (sentences > 15) difficulty += 2;
    else if (sentences > 8) difficulty += 1;
    // Unique character ratio (higher = more diverse vocabulary = harder)
    var chars = {};
    for (var i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) > 0x4e00) chars[text[i]] = true;
    }
    var uniqueCount = Object.keys(chars).length;
    if (uniqueCount > 200) difficulty += 2;
    else if (uniqueCount > 100) difficulty += 1;

    // Map to star rating
    if (difficulty >= 5) return '★★★';
    if (difficulty >= 3) return '★★☆';
    return '★☆☆';
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
  var btnPrev = document.getElementById('btnPrev');
  var btnNext = document.getElementById('btnNext');
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
    themeBtn.textContent = dark ? '夜' : '日';
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
    if (!filename) filename = 'bg.png';
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
        headers: { 'Content-Type': 'application/json' },
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
    viewArt.classList.add('hidden');
    viewAuthors.classList.add('hidden');
    viewAuthorDetail.classList.add('hidden');
    viewDynasty.classList.add('hidden');
    viewExample.classList.add('hidden');
    viewAbout.classList.add('hidden');
    viewWordGame.classList.add('hidden');
    var headBtns = document.querySelector('.art-head-btns');
    if (headBtns) headBtns.classList.add('hidden');
    var btns = navEl.querySelectorAll('.sbtn');
    for (var j = 0; j < btns.length; j++) btns[j].classList.remove('sel');
    moreBtn.classList.remove('sel');
    if (fsCtrl) {
      if (viewMode === 'art' || viewMode === 'authorDetail') fsCtrl.classList.remove('hidden');
      else fsCtrl.classList.add('hidden');
    }
    if (authorTtsBtn) {
      authorTtsBtn.style.display = (viewMode === 'authorDetail') ? 'flex' : 'none';
    }
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

  /* ===== SYSTEM MODE TOGGLE ===== */
  modeIndicator.onclick = function() {
    // 四态循环: 文 → 法 → 练 → 词 → 文
    modeBtn3.classList.add('hidden');
    modeBtn2.classList.remove('disabled');
    if (systemMode === 'learn') {
      systemMode = 'practice';
      modeIndicatorText.textContent = '法';
      modeBtn1.textContent = '句式';
      modeBtn2.textContent = '词类活用';
      searchIn.placeholder = '搜索句式';
      modeBtn1.classList.remove('hidden');
      modeBtn2.classList.remove('hidden');
      searchIn.classList.remove('hidden');
      searchWrap.classList.remove('hidden');
      sidebarTab = 'jushi';
    } else if (systemMode === 'practice') {
      systemMode = 'exercise';
      modeIndicatorText.textContent = '练';
      modeBtn1.classList.add('hidden');
      modeBtn2.classList.add('hidden');
      searchIn.placeholder = '';
      searchIn.classList.add('hidden');
      searchWrap.classList.add('hidden');
      sidebarTab = 'exType';
    } else if (systemMode === 'exercise') {
      systemMode = 'word';
      modeIndicatorText.textContent = '词';
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
    } else {
      systemMode = 'learn';
      modeIndicatorText.textContent = '文';
      modeBtn1.textContent = '篇目';
      modeBtn2.textContent = '作家';
      searchIn.placeholder = '搜索篇目';
      modeBtn1.classList.remove('hidden');
      modeBtn2.classList.remove('hidden');
      searchIn.classList.remove('hidden');
      searchWrap.classList.remove('hidden');
      sidebarTab = 'art';
    }
    modeBtn1.classList.add('active');
    modeBtn2.classList.remove('active');
    searchIn.value = '';
    hlKw = '';
    searchNav.classList.add('hidden');
    TTS.stop();
    renderSidebar();
    if (systemMode === 'learn') {
      selectArticle(cur.id);
    } else if (systemMode === 'practice') {
      showPlaceholder('点击左侧分类查看实例', '句式与词类活用', '从收录课文中精选典型例句');
    } else if (systemMode === 'exercise') {
      showPlaceholder('选择练习类型开始', '互动练习', '填空默写 · 上下句对接 · 情境默写');
    } else {
      showWordGame();
    }
  };

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

  function renderWordNav() {
    var html = '<div class="sec-label"><span>18 个文言虚词</span></div>';
    for (var i = 0; i < WORD_LIST.length; i++) {
      html += '<button class="sbtn" data-word="' + WORD_LIST[i] + '">' + WORD_LIST[i] + '</button>';
    }
    navEl.innerHTML = html;
    bindBtns(navEl, 'data-word', function(btn) {
      var w = btn.getAttribute('data-word');
      var idx = -1;
      for (var k = 0; k < wordQuestions.length; k++) {
        if (wordQuestions[k].focusWord === w) { idx = k; break; }
      }
      if (idx >= 0) {
        wordCurrentIdx = idx;
        wordScore = 0;
        renderWordQuestion();
      }
    });
  }

  function renderArticleNav() {
    var html = '';
    var favs = Store.getFavs();
    if (favs.length) {
      html += '<div class="sec-label" data-cat="fav"><span> 收藏</span></div>';
      for (var f = 0; f < favs.length; f++) {
        var fa = findArt(favs[f]);
        if (!fa) continue;
        var sel = (cur && cur.id === fa.id) ? ' sel' : '';
        var recited = Store.isRecited(fa.id) ? ' recited' : '';
        html += '<button class="sbtn' + sel + recited + '" data-id="' + fa.id + '">' + fa.title + '</button>';
      }
    }
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
      var sel = (currentDynasty === dynasties[d]) ? ' sel' : '';
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

  function renderText(txt, art) {
    // 防御：txt 可能为 null/undefined
    if (txt === null || txt === undefined) txt = '';
    var paras = String(txt).split('\n\n');
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
    // 分屏译文渲染
    renderTranslation(art);
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
    var tParas = art.translation.split('\n').filter(function(s){ return s.trim(); });
    var html = '';
    for (var i = 0; i < tParas.length; i++) {
      html += '<p>' + escapeHtml(tParas[i]) + '</p>';
    }
    transBody.innerHTML = html;
    var transAuthor = transBox.querySelector('.art-author');
    var srcAuthor = document.getElementById('artAuthor');
    if (transAuthor && srcAuthor) {
      transAuthor.innerHTML = srcAuthor.innerHTML;
    }
    transBody.style.fontSize = bodyFontSize + 'px';
    transBody.style.lineHeight = '2';
    alignSplitRows();
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
    var leftPs = document.querySelectorAll('#artBody > p');
    var rightPs = document.querySelectorAll('#artTransBody > p');
    for (var i = 0; i < leftPs.length; i++) leftPs[i].style.gridRow = (i + 3);
    for (var i = 0; i < rightPs.length; i++) rightPs[i].style.gridRow = (i + 3);
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
        systemMode = 'learn'; sidebarTab = 'art';
        modeIndicatorText.textContent = '文'; modeBtn1.textContent = '篇目'; modeBtn2.textContent = '作家';
        modeBtn1.classList.add('active'); modeBtn2.classList.remove('active');
        searchIn.placeholder = '搜索篇目';
        renderSidebar();
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
    var srcs = viewExample.querySelectorAll('.example-source');
    for (var j = 0; j < srcs.length; j++) {
      (function(s){ s.onclick = function(){
        systemMode = 'learn'; sidebarTab = 'art';
        modeIndicatorText.textContent = '文'; modeBtn1.textContent = '篇目'; modeBtn2.textContent = '作家';
        modeBtn1.classList.add('active'); modeBtn2.classList.remove('active');
        searchIn.placeholder = '搜索篇目';
        renderSidebar();
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
    transBtn.classList.remove('on');
    transBtn.textContent = '显示译文';
    translationOn = false;
    artBody.innerHTML = '<div class="empty-state"><div class="icon"></div><div class="title">' + (title||'功能开发中') + '</div><div class="desc">' + (desc||'敬请期待') + '</div>' + (sub?'<div class="desc" style="margin-top:6px">'+sub+'</div>':'') + '</div>';
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

  function loadWordGameData(cb) {
    wordLoadCallback = cb || null;
    if (typeof fetch !== 'undefined') {
      fetch('game.json')
        .then(function(r){ return r.json(); })
        .then(function(data){ initWordQuestions(data && data.questions ? data.questions : []); })
        .catch(function(err){ initWordQuestions(wordFallbackData); });
    } else {
      initWordQuestions(wordFallbackData);
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
    viewWordGame.innerHTML = '<div class="word-game"><div class="word-game-start"><div class="title">文言虚词 · 百词斩</div><div class="desc">从 18 个常见虚词中出题，检测你对虚词用法的掌握。</div><button class="word-game-btn" id="wordStartBtn">开始</button></div></div>';
    document.getElementById('wordStartBtn').onclick = startWordGame;
  }

  function startWordGame() {
    if (wordQuestions.length === 0) return;
    wordCurrentIdx = 0;
    wordScore = 0;
    renderWordQuestion();
  }

  function renderWordQuestion() {
    var q = wordQuestions[wordCurrentIdx];
    wordAnswered = false;
    var html = '<div class="word-game">';
    html += '<div class="word-game-progress">第 ' + (wordCurrentIdx + 1) + ' / ' + wordQuestions.length + ' 题</div>';
    html += '<div class="word-game-word">' + q.focusWord + '</div>';
    html += '<div class="word-game-question">虚词“' + q.focusWord + '”常表示什么？</div>';
    html += '<div class="word-game-options">';
    for (var i = 0; i < q.options.length; i++) {
      html += '<button class="word-game-option" id="wordOpt' + i + '" data-idx="' + i + '">' + escapeHtml(q.options[i]) + '</button>';
    }
    html += '</div>';
    html += '<div class="word-game-feedback" id="wordFeedback"></div>';
    html += '<div class="word-game-actions"><button class="word-game-btn" id="wordNextBtn" disabled>下一题</button></div>';
    html += '</div>';
    viewWordGame.innerHTML = html;
    for (var j = 0; j < q.options.length; j++) {
      (function(idx){
        document.getElementById('wordOpt' + idx).onclick = function(){ selectWordOption(idx); };
      })(j);
    }
    document.getElementById('wordNextBtn').onclick = nextWordQuestion;
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
    fb.textContent = q.explanation;
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
    var html = '<div class="word-game"><div class="word-game-result"><div class="score">' + wordScore + '/' + total + '</div><div class="desc">测试完成，答对 ' + wordScore + ' 题，共 ' + total + ' 题</div><div class="word-game-actions"><button class="word-game-btn" id="wordRestartBtn">再测一次</button></div></div></div>';
    viewWordGame.innerHTML = html;
    document.getElementById('wordRestartBtn').onclick = startWordGame;
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
    item.uid = item.uid || ('w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
    wb.push(item);
    this.set('wrongbook', wb);
  };
  Store.removeWrongBook = function(idx) {
    var wb = this.getWrongBook();
    if (typeof idx === 'string') {
      for (var i = 0; i < wb.length; i++) { if (wb[i].uid === idx) { wb.splice(i, 1); break; } }
    } else { wb.splice(idx, 1); }
    this.set('wrongbook', wb);
  };
  Store.clearWrongBook = function() { this.set('wrongbook', []); };
  // 错题间隔复习：返回今日到期错题的 UID 数组（兼容历史无 uid 数据）
  Store.getTodayWrongReviews = function() {
    var wb = this.getWrongBook();
    var now = Date.now();
    var result = [];
    for (var i = 0; i < wb.length; i++) {
      var item = wb[i];
      if (!item.nextReviewDate || item.nextReviewDate <= now) result.push(item.uid || i);
    }
    return result;
  };
  // SM-2 自适应间隔复习算法
  // 基于正确率反馈动态调整复习间隔，比固定间隔更高效
  Store.scheduleWrongReview = function(idx, correct) {
    var wb = this.getWrongBook();
    var i = -1;
    if (typeof idx === 'string') {
      for (var j = 0; j < wb.length; j++) { if (wb[j].uid === idx) { i = j; break; } }
    } else { i = idx; }
    if (i < 0 || !wb[i]) return { mastered: false };
    var item = wb[i];

    // SM-2 parameters
    var DEFAULT_EASE = 2.5;
    var MIN_EASE = 1.3;
    var MAX_INTERVAL = 180; // 6 months cap
    var MASTERY_THRESHOLD = 5; // 5 consecutive correct = mastered

    // Initialize SM-2 fields if missing (migrate from old format)
    if (item.smInterval === undefined) {
      item.smInterval = 1;
      item.smRepetition = 0;
      item.smEase = DEFAULT_EASE;
      item.consecutiveCorrect = 0;
      // Migrate old reviewLevel
      if (item.reviewLevel) {
        item.smRepetition = item.reviewLevel;
        var oldIntervals = [1, 3, 7, 14, 30];
        item.smInterval = oldIntervals[Math.min(item.reviewLevel, oldIntervals.length - 1)];
      }
    }

    if (correct) {
      item.consecutiveCorrect = (item.consecutiveCorrect || 0) + 1;
      // Check mastery
      if (item.consecutiveCorrect >= MASTERY_THRESHOLD) {
        wb.splice(i, 1);
        this.set('wrongbook', wb);
        return { mastered: true, nextInterval: 0 };
      }
      // SM-2 interval calculation
      if (item.smRepetition === 0) {
        item.smInterval = 1;
      } else if (item.smRepetition === 1) {
        item.smInterval = 3;
      } else {
        item.smInterval = Math.min(Math.round(item.smInterval * item.smEase), MAX_INTERVAL);
      }
      item.smRepetition++;
      // Increase ease factor slightly for correct answers
      item.smEase = Math.min(item.smEase + 0.1, 3.0);
      item.reviewLevel = Math.min(item.smRepetition, 4); // Backward-compat for UI
    } else {
      // Reset on wrong answer
      item.consecutiveCorrect = 0;
      item.smRepetition = 0;
      item.smInterval = 1;
      // Decrease ease factor (SM-2 formula: EF' = EF - 0.2, min 1.3)
      item.smEase = Math.max(item.smEase - 0.2, MIN_EASE);
      item.reviewLevel = 0;
    }

    item.nextReviewDate = Date.now() + item.smInterval * 86400000;
    item.lastReviewedAt = Date.now();
    this.set('wrongbook', wb);

    // Return interval label for UI
    var intervalLabel;
    if (item.smInterval === 1) intervalLabel = '1 天后';
    else if (item.smInterval < 7) intervalLabel = item.smInterval + ' 天后';
    else if (item.smInterval < 30) intervalLabel = Math.round(item.smInterval / 7) + ' 周后';
    else intervalLabel = Math.round(item.smInterval / 30) + ' 个月后';

    return { mastered: false, nextInterval: item.smInterval, nextIntervalLabel: intervalLabel };
  };
  Store.getStats = function() {
    return this.get('practiceStats', { totalAttempts:0, totalCorrect:0, blank:{attempts:0,correct:0}, match:{attempts:0,correct:0}, pair:{attempts:0,correct:0}, situational:{attempts:0,correct:0} });
  };
  Store.recordPractice = function(type, correct) {
    var s = this.getStats();
    s.totalAttempts++;
    if (correct) s.totalCorrect++;
    if (s[type]) { s[type].attempts++; if (correct) s[type].correct++; }
    this.set('practiceStats', s);
    var dk = this.getDailyKey();
    this.recordDaily(dk, 'attempts', 1);
    if (correct) this.recordDaily(dk, 'correct', 1);
  };

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
    html += '<button class="nav-child' + (exerciseState.type==='blank'?' sel':'') + '" data-ex-type="blank"> 填空默写</button>';
    html += '<button class="nav-child' + (exerciseState.type==='match'?' sel':'') + '" data-ex-type="match">⇄ 上下句对接</button>';
    html += '<button class="nav-child' + (exerciseState.type==='situational'?' sel':'') + '" data-ex-type="situational"> 情境默写</button>';
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
        var typeLabel = exerciseState.type === 'blank' ? '填空默写' : exerciseState.type === 'match' ? '上下句对接' : '情境默写';
        showPlaceholder('选择篇目开始' + typeLabel, typeLabel, '从左侧选择一篇课文');
      };
    });
  }

  function startExercise() {
    if (exerciseState.type === 'blank') startBlankExercise();
    else if (exerciseState.type === 'match') startMatchExercise();
    else if (exerciseState.type === 'pair') startPairExercise();
    else if (exerciseState.type === 'situational') startSituationalExercise();
    renderSidebar();
  }

  /* ===== 练习模式·篇目选择 ===== */
  function renderExArtNav() {
    var html = '';
    html += '<button class="nav-child" id="exBackBtn" style="margin-bottom:4px">← 返回练习类型</button>';
    html += '<div class="sec-label"><span>选择篇目</span></div>';
    html += '<button class="nav-child" data-ex-art="random" style="margin-bottom:8px"> 随机出题</button>';
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
      showPlaceholder('选择练习类型开始', '互动练习', '填空默写 · 上下句对接 · 情境默写');
    };
    navEl.querySelectorAll('[data-ex-art]').forEach(function(btn){
      btn.onclick = function(){
        var artId = btn.getAttribute('data-ex-art');
        if (artId === 'random') artId = null;
        exerciseState.articleId = artId;
        if (exerciseState.type === 'blank') startBlankExercise();
        else if (exerciseState.type === 'match') startMatchExercise();
        else if (exerciseState.type === 'situational') startSituationalExercise();
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
        Store.addWrongBook({ type: 'blank', articleId: q.articleId, articleTitle: q.articleTitle, question: q.question, userAnswer: userAnswer || '（空）', correctAnswer: q.answer, hintUsed: hintUsed, timestamp: Date.now() }); showToast('已加入错题本', 'warn');
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

  function generateSituationalQuestions(articleId) {
    var pool = SITUATIONAL_QUIZ.slice();
    if (articleId && articleId !== 'random') {
      pool = pool.filter(function(q){ return q.articleId === articleId; });
    }
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return pool.slice(0, 10);
  }

  function startSituationalExercise() {
    exerciseState.questions = generateSituationalQuestions(exerciseState.articleId);
    exerciseState.currentIdx = 0;
    exerciseState.answers = [];
    if (exerciseState.questions.length === 0) {
      showPlaceholder('无法生成题目', '情境默写题库为空', '请稍后再试');
      return;
    }
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
    var html = '<div class="exercise-question">' + scenarioHtml + '</div>' +
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
        resultHtml += '<div style="margin-top:8px;padding:10px;background:var(--bg);border-left:3px solid var(--pri);font-size:13px;color:var(--sub);font-family:\'Microsoft YaHei\',sans-serif"><strong> 解析：</strong>' + q.explanation + '</div>';
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
        if (!allCorrect) showToast('已加入错题本', 'warn');
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
        Store.addWrongBook({ type: 'match', articleId: q.articleId, articleTitle: q.articleTitle, question: q.upperSentence, userAnswer: '（已跳过）', correctAnswer: q.correctAnswer, skipped: true, timestamp: Date.now() }); showToast('已跳过，加入错题本', 'warn');
      } else if (correct) {
        resultDiv.innerHTML = '<div class="exercise-result correct">对 正确！</div>';
      } else {
        Store.addWrongBook({ type: 'match', articleId: q.articleId, articleTitle: q.articleTitle, question: q.upperSentence, userAnswer: userAnswer, correctAnswer: q.correctAnswer, timestamp: Date.now() }); showToast('已加入错题本', 'warn');
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
          Store.addWrongBook({ type: 'pair', articleId: pairs[i].articleId, question: pairs[i].title, userAnswer: userAuthor, correctAnswer: pairs[i].author, timestamp: Date.now() }); showToast('已加入错题本', 'warn');
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
      showPlaceholder('选择练习类型开始', '互动练习', '填空默写 · 上下句对接 · 情境默写');
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
        systemMode = 'exercise'; modeIndicatorText.textContent = '练';
        modeBtn1.classList.add('hidden'); modeBtn2.classList.add('hidden');
        searchIn.placeholder = ''; searchIn.classList.add('hidden'); sidebarTab = 'exType';
        renderSidebar();
        showPlaceholder('选择练习类型开始', '互动练习', '填空默写 · 上下句对接 · 情境默写');
      };
      return;
    }
    var todayWrongCount = Store.getTodayWrongReviews().length;
    var html = '';
    if (todayWrongCount > 0) {
      html += '<div style="margin-bottom:16px;padding:16px;background:linear-gradient(135deg,rgba(255,152,0,.15),rgba(255,152,0,.05));border:1px solid var(--warn);border-radius:8px;font-family:\'Microsoft YaHei\',sans-serif">' +
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
    var uid = indices[0];
    var wb = Store.getWrongBook();
    var item = null;
    for (var k = 0; k < wb.length; k++) { if (wb[k].uid === uid || k === uid) { item = wb[k]; break; } }
    if (!item) { showWrongReviewSummary(); return; }
    var totalEstimate = wrongReviewState.totalCount + indices.length;
    artTitle.textContent = '错题重练 (' + (wrongReviewState.totalCount + 1) + '/' + Math.min(wrongReviewState.maxCount, totalEstimate) + ')';
    artAuthor.textContent = '出自：' + (item.articleTitle || '');
    var typeLabel = item.type === 'blank' ? '填空' : item.type === 'match' ? '对接' : item.type === 'situational' ? '情境' : '配对';
    var questionText = (item.question || '').replace(/______/g, '＿＿').replace(/___/g, '＿＿');
    var html = '<div style="margin-bottom:8px;font-size:11px;color:var(--muted-fg);font-family:\'Microsoft YaHei\',sans-serif">' + typeLabel + ' · 连续答对 ' + (item.consecutiveCorrect || 0) + '/5</div>' +
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
      var result = Store.scheduleWrongReview(uid, correct);
      var resultHtml = '';
      if (skipped) {
        resultHtml = '<div class="exercise-result wrong">下 已跳过，1 天后再次进入复习</div>';
      } else if (correct) {
        if (result.mastered) {
          wrongReviewState.masteredCount++;
          resultHtml = '<div class="exercise-result correct">对 答对！连续答对 5 次，已掌握并移出错题本 </div>';
        } else {
          resultHtml = '<div class="exercise-result correct">对 答对！下次复习：' + (result.nextIntervalLabel || '1 天后') + '</div>';
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
      { label: '情境', value: (s.situational ? s.situational.attempts : 0), color: CHART_COLORS.purple }
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
    btnPrev.classList.toggle('disabled', dis);
    btnNext.classList.toggle('disabled', dis);
    pTrack.classList.toggle('disabled', dis);
    speedBtn.classList.toggle('disabled', dis);
    loopBtn.classList.toggle('disabled', dis);
  }

  var saveAudioPos = throttle(function(){
    if(cur && cur.audio && audioEl.duration){ Store.setAudio(cur.id, audioEl.currentTime); }
  }, 1500);

  function loadAudio() {
    audioEl.pause();
    playing = false;
    btnPP.innerHTML = '播';
    if (cur.audio) {
      setAudioDisabled(false);
      audioEl.src = cur.audio;
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
      audioEl.onended = function() { playing = false; btnPP.innerHTML = '播'; };
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
    pTitle.textContent = cur.title + ' - ' + cur.author + (cur.audio ? '' : '（暂无音频）');
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
              if (is.situational) { es.situational = es.situational || {attempts:0,correct:0}; es.situational.attempts += is.situational.attempts||0; es.situational.correct += is.situational.correct||0; }
              localStorage.setItem(key, JSON.stringify(es));
            } else if (key === 'bsw_dailyStats') {
              var existingDS = Store.getDailyStats();
              var importedDS = data[key];
              for (var dKey in importedDS) {
                if (!existingDS[dKey]) {
                  existingDS[dKey] = importedDS[dKey];
                } else {
                  existingDS[dKey].attempts = (existingDS[dKey].attempts||0) + (importedDS[dKey].attempts||0);
                  existingDS[dKey].correct = (existingDS[dKey].correct||0) + (importedDS[dKey].correct||0);
                  existingDS[dKey].studyTime = (existingDS[dKey].studyTime||0) + (importedDS[dKey].studyTime||0);
                }
              }
              localStorage.setItem(key, JSON.stringify(existingDS));
            } else if (key === 'bsw_streak') {
              var es2 = Store.getStreak();
              var is2 = data[key];
              if (is2.days > (es2.days||0)) { localStorage.setItem(key, JSON.stringify(is2)); }
            } else {
              localStorage.setItem(key, JSON.stringify(data[key]));
            }
            count++;
          }
        }
        showToast('已导入 ' + count + ' 项数据', 'success');
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
      var origText = {wrongbook:'错题本',stats:'统计',recite:'已背诵',favs:'收藏',all:'全部'}[type];
      if (_resetConfirm === type) {
        if (type === 'wrongbook') Store.clearWrongBook();
        else if (type === 'stats') Store.set('practiceStats', {totalAttempts:0,totalCorrect:0,blank:{attempts:0,correct:0},match:{attempts:0,correct:0},pair:{attempts:0,correct:0}});
        else if (type === 'recite') { Store.set('recited', []); }
        else if (type === 'favs') Store.set('favs', []);
        else if (type === 'all') { localStorage.clear(); location.reload(); return; }
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
    var on = cur && Store.isRecited(cur.id);
    btn.classList.toggle('on', on);
    btn.textContent = on ? '对 已背诵' : '已背诵';
  }

  function selectArticle(id) {
    var art = findArt(id);
    if (!art) return;
    // 保存当前音频进度再切换
    if (cur && cur.audio && cur.id !== id && audioEl.duration) Store.setAudio(cur.id, audioEl.currentTime);
    cur = art;
    TTS.stop();
    showArticleView();
    artTitle.textContent = cur.title;
    artAuthor.innerHTML = '';
    var authorBtn = document.createElement('button');
    authorBtn.className = 'author-tag-btn';
    authorBtn.type = 'button';
    authorBtn.textContent = cur.author + '  ·  ' + getArticleDifficulty(cur);
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
  // 显示译文按钮
  var transBtn = document.getElementById('transBtn');
  var recitedBtn = document.getElementById('recitedBtn');
  var translationOn = false;
  var artSplit = document.getElementById('artSplit');
  artSplit.classList.add('no-split');

  recitedBtn.onclick = function(){
    if(!cur) return;
    var added = Store.toggleRecited(cur.id);
    updateRecitedBtn();
    if (systemMode === 'learn' && sidebarTab === 'art') renderArticleNav();
    // 立即更新当前目录按钮状态，避免重新渲染延迟
    var navBtn = navEl.querySelector('.sbtn[data-id="' + cur.id + '"]');
    if (navBtn) navBtn.classList.toggle('recited', added);
    showToast(added ? '已标记为已背诵' : '已取消已背诵', added ? 'success' : 'info');
  };

  transBtn.onclick = function() {
    translationOn = !translationOn;
    transBtn.classList.toggle('on', translationOn);
    transBtn.textContent = translationOn ? '隐藏译文' : '显示译文';
    artSplit.classList.toggle('no-split', !translationOn);
    if (translationOn && cur) {
      renderTranslation(cur);
    }
  };

  /* ===== PLAYER ===== */
  btnRW.onclick = function() { if(cur && cur.audio) audioEl.currentTime = Math.max(0, audioEl.currentTime - 5); };
  btnFF.onclick = function() { if(cur && cur.audio) audioEl.currentTime = Math.min(audioEl.duration || 0, audioEl.currentTime + 5); };
  btnPrev.onclick = prevArticle;
  btnNext.onclick = nextArticle;
  btnPP.onclick = function() {
    if (!cur || !cur.audio) return;
    if (audioEl.error) return;
    if (playing) {
      playing = false; btnPP.innerHTML = '播'; audioEl.pause();
    } else {
      TTS.stop();
      playing = true; btnPP.innerHTML = '停';
      var result = audioEl.play();
      if (result && typeof result.catch === 'function') result.catch(function() { playing=false; btnPP.innerHTML='播'; });
    }
  };
  pTrack.onclick = function(e) {
    if (!cur || !cur.audio) return;
    var rect = pTrack.getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (audioEl.duration) audioEl.currentTime = pct * audioEl.duration;
  };

  var SPEEDS = [0.75, 1, 1.25, 1.5];
  function updateSpeedBtn(){ speedBtn.textContent = Store.getSpeed() + 'x'; }
  speedBtn.onclick = function() {
    if (!cur || !cur.audio) return;
    var s = Store.getSpeed();
    var idx = SPEEDS.indexOf(s);
    var next = SPEEDS[(idx + 1) % SPEEDS.length];
    Store.setSpeed(next);
    audioEl.playbackRate = next;
    updateSpeedBtn();
  };
  function updateLoopBtn(){ loopBtn.classList.toggle('loop-on', Store.getLoop()); }
  loopBtn.onclick = function() {
    if (!cur || !cur.audio) return;
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
      var voices = this.synth.getVoices();
      if(voices.length>0){ this.selectVoice(voices); }
      this.synth.onvoiceschanged = function(){
        self.selectVoice(self.synth.getVoices());
      };
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
      this.synth.speak(u);
    },
    pause: function(){
      this.paused = true;
      this.synth.cancel();
      authorTtsBtn.classList.remove('tts-playing');
    },
    resume: function(){
      this.paused = false;
      authorTtsBtn.classList.add('tts-playing');
      this.speakNext();
    },
    stop: function(){
      this.active = false; this.paused = false;
      this.synth.cancel();
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
  function openSidebar(){ sideEl.classList.add('open'); sideOverlay.classList.add('show'); }
  function closeSidebar(){ sideEl.classList.remove('open'); sideOverlay.classList.remove('show'); }
  hamburger.onclick = function(){ if(sideEl.classList.contains('open')) closeSidebar(); else openSidebar(); };
  sideOverlay.onclick = closeSidebar;
  // 点击侧边栏内任意按钮后关闭（移动端）
  sideEl.addEventListener('click', function(e){
    if(window.innerWidth <= 768 && (e.target.classList.contains('sbtn')||e.target.classList.contains('nav-parent')||e.target.classList.contains('nav-child')||e.target.closest('.mode-btn'))){ closeSidebar(); }
  });

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
        systemMode = 'practice'; modeIndicatorText.textContent = '法';
        modeBtn1.textContent = '句式'; modeBtn2.textContent = '词类活用';
        searchIn.placeholder = '搜索句式'; searchIn.classList.remove('hidden'); searchWrap.classList.remove('hidden');
        modeBtn1.classList.remove('hidden'); modeBtn2.classList.remove('hidden');
        sidebarTab = lastState.tab || 'jushi';
      } else if (lastState.mode === 'exercise') {
        systemMode = 'exercise'; modeIndicatorText.textContent = '练';
        modeBtn1.classList.add('hidden'); modeBtn2.classList.add('hidden');
        searchIn.placeholder = ''; searchIn.classList.add('hidden'); searchWrap.classList.add('hidden');
        sidebarTab = lastState.tab || 'exType';
      } else if (lastState.mode === 'word') {
        systemMode = 'word'; modeIndicatorText.textContent = '词';
        modeBtn1.textContent = '虚词'; modeBtn2.textContent = '实词';
        modeBtn1.classList.remove('hidden'); modeBtn2.classList.remove('hidden');
        modeBtn2.classList.add('disabled');
        searchIn.placeholder = ''; searchIn.classList.add('hidden'); searchWrap.classList.add('hidden');
        sidebarTab = lastState.tab || 'word';
      } else {
        systemMode = 'learn'; modeIndicatorText.textContent = '文';
        modeBtn1.textContent = '篇目'; modeBtn2.textContent = '作家';
        searchIn.placeholder = '搜索篇目'; searchIn.classList.remove('hidden'); searchWrap.classList.remove('hidden');
        modeBtn1.classList.remove('hidden'); modeBtn2.classList.remove('hidden');
        sidebarTab = lastState.tab || 'art';
      }
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
  btnPrev.setAttribute('aria-label', '上一篇');
  btnNext.setAttribute('aria-label', '下一篇');
  document.getElementById('fsMinus').setAttribute('aria-label', '缩小字体');
  document.getElementById('fsPlus').setAttribute('aria-label', '放大字体');
  contentArea.setAttribute('tabindex', '-1');

  /* ===== 快捷键面板 + 全局键盘快捷键 ===== */
  var shortcutBtn = document.getElementById('shortcutBtn');
  var shortcutPanel = null;

  // Build shortcut panel dynamically
  if (shortcutBtn) {
    shortcutPanel = document.createElement('div');
    shortcutPanel.className = 'settings-panel hidden';
    shortcutPanel.id = 'shortcutPanel';
    shortcutPanel.innerHTML =
      '<div class="settings-header"><h3>快捷键</h3>' +
      '<button class="icon-btn" id="shortcutClose"></button></div>' +
      '<div class="settings-body" style="font-family:\'Microsoft YaHei\',sans-serif">' +
      '<div class="about-row"><span class="about-label"><kbd>←</kbd> / <kbd>→</kbd></span><span class="about-value">切换篇目</span></div>' +
      '<div class="about-row"><span class="about-label"><kbd>Space</kbd></span><span class="about-value">播放/暂停音频</span></div>' +
      '<div class="about-row"><span class="about-label"><kbd>/</kbd></span><span class="about-value">聚焦搜索框</span></div>' +
      '<div class="about-row"><span class="about-label"><kbd>F</kbd></span><span class="about-value">闪卡模式</span></div>' +
      '<div class="about-row"><span class="about-label"><kbd>T</kbd></span><span class="about-value">切换深色/浅色主题</span></div>' +
      '<div class="about-row"><span class="about-label"><kbd>Esc</kbd></span><span class="about-value">关闭面板</span></div>' +
      '</div>';
    document.body.appendChild(shortcutPanel);

    shortcutBtn.onclick = function() {
      shortcutPanel.classList.toggle('hidden');
    };
    document.getElementById('shortcutClose').onclick = function() {
      shortcutPanel.classList.add('hidden');
    };
  }

  // Global keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    // Don't trigger when typing in input/textarea
    var tag = e.target.tagName;
    var isInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;

    // Esc closes panels (works even in inputs)
    if (e.key === 'Escape') {
      if (shortcutPanel) shortcutPanel.classList.add('hidden');
      var sp = document.getElementById('settingsPanel');
      if (sp) sp.classList.add('hidden');
      return;
    }

    if (isInput) {
      // Only '/' works in inputs (to escape search)
      if (e.key === 'Escape') {
        e.target.blur();
      }
      return;
    }

    switch(e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        prevArticle();
        break;
      case 'ArrowRight':
        e.preventDefault();
        nextArticle();
        break;
      case ' ':
        e.preventDefault();
        if (playing) { pauseAudio(); } else { playAudio(); }
        break;
      case '/':
        e.preventDefault();
        searchIn.focus();
        searchIn.select();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        // Toggle flashcard mode
        if (typeof toggleFlashcard === 'function') toggleFlashcard();
        break;
      case 't':
      case 'T':
        e.preventDefault();
        var newTheme = Store.getTheme() === 'dark' ? 'light' : 'dark';
        Store.setTheme(newTheme);
        applyTheme();
        break;
    }
  });

});
