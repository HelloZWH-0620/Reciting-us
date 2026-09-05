#!/usr/bin/env python3
"""v0.38 account.js 补丁：AI 设置一次性迁入用户档案（绑定到对应用户）"""
from pathlib import Path

p = Path(__file__).resolve().parent.parent / "web" / "js" / "account.js"
s = p.read_text(encoding="utf-8")

old = """  function afterLogin(profileMeta, profileObj) {
    // profileMeta: {name, file, username, password, createdAt}
    window.__ACTIVE_PROFILE__ = profileMeta;
    loadProfileIntoLocalStorage(profileObj);
    renderStudyPanel(profileMeta);
  }"""
new = """  function afterLogin(profileMeta, profileObj) {
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
  }"""
assert old in s, "afterLogin anchor"
s = s.replace(old, new)
p.write_text(s, encoding="utf-8")
print("account.js patched OK")
