const $ = (id) => document.getElementById(id);

function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (className) el.className = className;
  return el;
}

const offlineStatus = $('offline');
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !refreshing) {
      refreshing = true;
      location.reload();
    }
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(async (registration) => {
    const installing = registration.installing;
    if (installing) installing.addEventListener('statechange', () => {
      if (installing.state === 'redundant' && !registration.active) {
        offlineStatus.textContent = '离线准备失败，请联网重新打开。';
      }
    });
    await navigator.serviceWorker.ready;
    offlineStatus.textContent = '✓ 可离线使用';
  }).catch(() => {
    offlineStatus.textContent = '离线准备失败，请联网重新打开。';
  });
} else {
  offlineStatus.textContent = '本地文件预览 · 发布后支持离线缓存';
}
