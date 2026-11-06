/* Small progressive enhancement; the source HTML already contains every guide. */
(function () {
  var doc = document, root = doc.documentElement;
  var query = '', limit = 6, complete = false, timer = 0, observer, lastQuery = '';
  function get(id) { return doc.getElementById(id); }
  window.addEventListener('error',function(event) {
    if(event.target!==window)return;
    if(observer)observer.disconnect();
    root.classList.remove('guide-enhanced');
    entries().forEach(function(node){node.hidden=false;});
    if(get('guide-search'))get('guide-search').hidden=true;
    if(get('guide-load-state'))get('guide-load-state').hidden=true;
  });
  function norm(value) {
    var text = String(value || '');
    if (text.normalize) text = text.normalize('NFKC');
    return text.toLowerCase().replace(/网咖/g, '网吧')
      .replace(/[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~，。！？、：；（）【】「」『』《》“”‘’·…—]/g, '');
  }
  function entries() { return Array.prototype.slice.call(doc.querySelectorAll('.guide-hit')); }
  function render() {
    var all = entries(), key = norm(query), terms = query.split(/\s+/), hits = [];
    var shortKey = key.replace(/(?:营业时间|开门时间|关门时间|几点开门|几点关门|怎么去|在哪里|价格)$/, '');
    all.forEach(function (node) {
      var title = norm(node.getAttribute('data-title'));
      var area = norm(node.getAttribute('data-area'));
      var body = norm(node.textContent), ocr = node.getAttribute('data-ocr') || '', score = 0;
      if (!key) score = node.getAttribute('data-featured') === '1' ? 100 : 0;
      else if (title === key) score = 100;
      else if (title.indexOf(key) !== -1) score = 88;
      else if (shortKey && title === shortKey) score = 84;
      else if (body.indexOf(key) !== -1) score = 62;
      else if (terms.length > 1 && terms.every(function (term) {
        term = norm(term); return !term || (title + area + body).indexOf(term) !== -1;
      })) score = 55;
      else if (ocr.indexOf(key) !== -1) score = 35;
      else if (area.indexOf(key) !== -1) score = 25;
      if (key === 't1网吧' && node.getAttribute('data-id') === '1712') score = 50;
      if (score) hits.push({node:node,score:score});
      node.hidden = true;
    });
    hits.sort(function (a,b) { var field=key?'data-id':'data-sequence';return b.score-a.score || Number(a.node.getAttribute(field))-Number(b.node.getAttribute(field)); });
    hits.forEach(function (hit,i) { hit.node.style.order=i; hit.node.hidden=i>=limit; });
    if (get('guide-result-count')) get('guide-result-count').textContent=hits.length+' 个条目';
    if (get('guide-results-title')) get('guide-results-title').textContent=query?'「'+query+'」的攻略':'攻略里的店与去处';
    if (get('guide-summary')) {
      get('guide-summary').hidden=!!hits.length || !complete;
      get('guide-summary').textContent='攻略里没找到「'+query+'」。试试店名、商圈或更短的关键词。';
    }
    if (get('guide-more')) get('guide-more').hidden=limit>=hits.length;
    if (query && hits.length && (query!==lastQuery || !get('guide-results').querySelector('details[open]:not([hidden])'))) {
      all.forEach(function (node) { node.open=false; });
      hits[0].node.open=true;
    }
    lastQuery=query;
    root.setAttribute('data-guide-ready','true');
    if(get('guide-load-state'))get('guide-load-state').hidden=complete||!query||!!hits.length;
  }
  function schedule() { window.clearTimeout(timer); timer=window.setTimeout(render,40); }
  function search(value) {
    query=String(value||'').replace(/^\s+|\s+$/g,'');
    limit=8;
    if(get('guide-query')) get('guide-query').value=query;
    render();
  }
  doc.addEventListener('submit',function(event) {
    if(event.target.id==='guide-search') {event.preventDefault();search(get('guide-query').value);}
  });
  doc.addEventListener('click',function(event) {
    var target=event.target;
    while(target && target!==doc && !target.getAttribute('data-query') && target.id!=='guide-more') target=target.parentElement;
    if(!target || target===doc) return;
    if(target.id==='guide-more') {event.preventDefault();limit+=8;render();}
    else {event.preventDefault();search(target.getAttribute('data-query'));}
  });
  root.classList.add('guide-enhanced');
  if(get('guide-search'))get('guide-search').hidden=false;
  function start() {
    var holder=get('guide-results');
    if(!holder) return window.setTimeout(start,10);
    if(window.MutationObserver) {
      observer=new MutationObserver(schedule);
      observer.observe(holder,{childList:true,subtree:true});
    }
    render();
  }
  window.Guide23={finish:function() {
    complete=true;if(observer)observer.disconnect();render();startOffline();
  }};
  start();
  function startOffline() {
    var status=get('offline');
    try {
      if(!('serviceWorker' in navigator)) {status.textContent='可在线浏览全部攻略';return;}
      status.textContent='正在准备离线使用…';
      var controlled=!!navigator.serviceWorker.controller,reloading=false;
      navigator.serviceWorker.addEventListener('controllerchange',function() {
        if(controlled&&!reloading){reloading=true;location.reload();}
      });
      navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(function() {
        return navigator.serviceWorker.ready;
      }).then(function(){status.textContent='✓ 可离线使用';},function(){status.textContent='可在线浏览 · 离线保存暂不可用';});
    } catch(error) {status.textContent='可在线浏览 · 离线保存暂不可用';}
    try {
      if(!window.caches)return;
      var button=get('guide-save-images'),progress=get('guide-download-status');
      var cacheName='korea-guide-media:'+new URL('./',document.baseURI).href+':v1';
      get('guide-download').hidden=false;
      button.addEventListener('click',function() {
        button.disabled=true;
        caches.open(cacheName).then(function(cache) {
          var index=1,done=0;
          function batch() {
            var tasks=[];
            for(var n=0;n<8&&index<=745;n++,index++) (function(number) {
              var name=('000'+number).slice(-3)+'.webp';
              var url=new URL('guide-media/'+name,document.baseURI).href;
              tasks.push(cache.match(url).then(function(saved){return saved||cache.add(url);}).then(function(){done++;},function(){}));
            })(index);
            return Promise.all(tasks).then(function() {
              progress.textContent='已保存 '+done+'/745 张';
              if(index<=745&&navigator.onLine)return batch();
              progress.textContent=done===745?'✓ 全部攻略图片已离线保存':'已保存 '+done+' 张，联网后可继续保存。';
              button.disabled=done===745;
            });
          }
          return batch();
        }).catch(function(){progress.textContent='暂时无法保存图片，请稍后重试。';button.disabled=false;});
      });
    } catch(error) { /* Browsing and search do not depend on browser storage. */ }
  }
})();
