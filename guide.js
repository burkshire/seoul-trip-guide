const guideInput = $('guide-query');
const guideResults = $('guide-results');
const imageStatus = $('guide-download-status');
const saveImages = $('guide-save-images');
const imageUrl = (name) => new URL('guide-media/' + name, document.baseURI).href;
const imageCacheName = 'korea-guide-media:' + new URL('./', document.baseURI).href + ':v1';
const canSaveImages = 'caches' in window && 'serviceWorker' in navigator && location.protocol !== 'file:';

function normalizeGuide(text) {
  return text.normalize('NFKC').toLowerCase().replaceAll('网咖', '网吧')
    .replace(/[\p{P}\p{S}\s]+/gu, '');
}

function cleanGuideLabel(text) {
  const plain = text.trim().replace(/^\*\*|\*\*$/g, '').trim();
  const dayPrefix = /^(?:[0-9]\uFE0F?\u20E3\uFE0F?\s*)?Day\s+\d+\s*[（(][^）)]*[）)]\s*[:：]\s*/i;
  if (dayPrefix.test(plain)) {
    return plain.replace(dayPrefix, '').replace(/（\d+(?:\s*\+\s*\d+)*）/g, '').trim();
  }
  const unnumbered = plain.replace(/^\d+(?:\.\d+)*\.?\s+(?=\*?[「【])/, '')
    .replace(/^\*+(?=[「【])/, '');
  const countedSection = unnumbered.match(/^【([^】]+)】(?:（\d+）)+$/);
  return countedSection ? countedSection[1] : unnumbered;
}

function cleanGuideBlock(text, title, index) {
  const cleaned = cleanGuideLabel(text);
  if (index !== 0) return cleaned;
  if (cleaned === title) return '';
  const heading = cleaned.match(/^[「【]([^」】]+)[」】](.*)$/);
  if (heading && (heading[1] === title || heading[1].endsWith('｜' + title))) {
    return /[\p{L}\p{N}]/u.test(heading[2]) ? heading[2].trim() : '';
  }
  return cleaned;
}

const guideIndex = guideRecords.map((source) => {
  const title = cleanGuideLabel(source.title);
  const blocks = source.blocks.map(([text, images], index) => [cleanGuideBlock(text, title, index), images]);
  const record = { ...source, title, blocks };
  return {
    record,
    title: normalizeGuide(title),
    area: normalizeGuide(record.area),
    body: normalizeGuide(blocks.map(([text]) => text).join(' ')),
    imageText: normalizeGuide(blocks.flatMap(([, images]) =>
      images.map((image) => guideImageText[image] || '')).join(' ')),
  };
}).filter(({ record }) => record.blocks.some(([text, images]) => text.trim() || images.length) ||
  /[（(][^）)]*(?:休|避开|路演|预约|营业)[^）)]*[）)]/.test(record.title));

function searchGuide(query) {
  const normalized = normalizeGuide(query);
  if (!normalized) return [];
  const shortQuery = normalized.replace(/(?:营业时间|开门时间|关门时间|几点开门|几点关门|怎么去|在哪里|价格)$/, '');
  const terms = query.trim().split(/\s+/u).map(normalizeGuide).filter(Boolean);
  const hits = guideIndex.flatMap(({ record, title, body, imageText, area }) => {
    let rank = 0;
    if (title === normalized) rank = 100;
    else if (title.includes(normalized)) rank = 88;
    else if (shortQuery && title === shortQuery) rank = 84;
    else if (body.includes(normalized)) rank = 62;
    else if (terms.length > 1 && terms.every((term) => title.includes(term) || area.includes(term) || body.includes(term))) rank = 55;
    else if (imageText.includes(normalized)) rank = 35;
    else if (area.includes(normalized)) rank = 25;
    if (rank) return [{ record, rank, related: false }];
    // The guide lists the internet café and the T1 building separately.
    if (record.id === 1712 && shortQuery === 't1网吧') return [{ record, rank: 50, related: true }];
    return [];
  });
  return hits.sort((a, b) => b.rank - a.rank || a.record.id - b.record.id);
}

function addGuideImage(parent, name, title, loading = 'lazy') {
  const image = document.createElement('img');
  const status = element('button', '', 'guide-image-status');
  status.type = 'button';
  status.hidden = true;
  image.alt = title + ' · 攻略配图';
  image.loading = loading;
  image.width = 1600;
  image.height = 1600;
  image.dataset.source = imageUrl(name);
  image.src = image.dataset.source;
  image.addEventListener('load', () => {
    image.hidden = false;
    delete image.dataset.failed;
    status.hidden = true;
  });
  image.addEventListener('error', () => {
    image.hidden = true;
    image.dataset.failed = 'true';
    status.textContent = navigator.onLine ? '图片加载失败 · 点击重试' : '图片未缓存 · 联网后重试';
    status.hidden = false;
  });
  status.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    status.textContent = '正在重新加载…';
    image.src = image.dataset.source;
  });
  parent.append(image, status);
}

function retryGuideImages() {
  for (const image of document.querySelectorAll('img[data-failed]')) {
    image.src = image.dataset.source;
  }
}
window.addEventListener('online', retryGuideImages);
window.addEventListener('focus', retryGuideImages);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) retryGuideImages();
});

function guideCard({ record, rank, related }, index, preview = false) {
  const details = element('details', '', 'guide-hit');
  const summary = element('summary');
  const images = record.blocks.flatMap(([, names]) => names);
  let cover;
  if (images.length) {
    cover = element('span', '', 'guide-cover');
    addGuideImage(cover, images[0], record.title, 'eager');
    cover.append(element('span', images.length + ' 张攻略图', 'guide-cover-badge'));
  } else {
    details.classList.add('guide-hit-text');
  }
  const copy = element('span', '', 'guide-card-copy');
  copy.append(element('small', record.area || '首尔旅行', 'guide-card-area'));
  copy.append(element('strong', record.title));
  const hours = record.blocks.find(([text]) => text.startsWith('🕙'))?.[0];
  const excerpt = record.blocks.find(([text]) => text && !text.startsWith('🕙') &&
    !/^[【「]/.test(text) && text.length > 14)?.[0];
  const meta = related ? '相关条目' : rank === 35 ? '匹配图片中的文字' : excerpt || '查看完整攻略与实用信息';
  copy.append(element('span', meta, 'guide-card-excerpt'));
  if (hours) {
    const label = hours.slice('🕙'.length).split('｜')
      .filter((part) => !/^\s*(?:https?:|💳|💰|📍)/.test(part))
      .map((part) => part.trim()).filter(Boolean).join(' · ')
      .replace(/^24h$/i, '24 小时营业');
    copy.append(element('span', label, 'guide-card-hours'));
  }
  copy.append(element('span', '查看完整攻略 ↗', 'guide-card-action'));
  if (cover) summary.append(cover);
  else copy.prepend(element('span', '原攻略未配图', 'guide-text-label'));
  summary.append(copy);
  details.append(summary);
  const fill = () => {
    const content = element('div', '', 'guide-content');
    for (const [text, images] of record.blocks) {
      if (text) {
        if (text.startsWith('🕙')) {
          const hours = text.slice('🕙'.length).trim();
          const label = /^24h$/i.test(hours) ? '24 小时营业' : '营业时间 ' + hours;
          content.append(element('p', label, 'guide-hours'));
        } else if (/^【[^】]+】$/.test(text)) {
          content.append(element('h3', text.slice(1, -1), 'guide-subhead'));
        } else {
          content.append(element('p', text));
        }
      }
      for (const name of images) {
        const link = element('a');
        link.href = imageUrl(name);
        link.target = '_blank';
        link.rel = 'noopener';
        link.setAttribute('aria-label', '打开原攻略图片');
        addGuideImage(link, name, record.title);
        content.append(link);
      }
    }
    details.append(content);
  };
  if (index === 0 && !preview) {
    details.open = true;
    fill();
  } else {
    details.addEventListener('toggle', () => {
      if (details.open) fill();
    }, { once: true });
  }
  return details;
}

let guideHits = [];
let visibleHits = 0;
function showGuideHits() {
  const batch = guideHits.slice(visibleHits, visibleHits + 8);
  guideResults.append(...batch.map((hit, i) => guideCard(hit, visibleHits + i)));
  visibleHits += batch.length;
  $('guide-more').hidden = visibleHits >= guideHits.length;
}

function submitGuide(value) {
  const query = value.trim();
  if (!query) return;
  guideInput.value = query;
  $('guide-summary').hidden = true;
  $('guide-results-title').textContent = '「' + query + '」的攻略';
  guideHits = searchGuide(query);
  visibleHits = 0;
  guideResults.replaceChildren();
  $('guide-result-count').textContent = guideHits.length + ' 个条目';
  $('guide-summary').hidden = guideHits.length > 0;
  $('guide-summary').textContent = '攻略里没找到「' + query + '」。试试店名、商圈或更短的关键词。';
  for (const button of document.querySelectorAll('[data-query]')) {
    button.setAttribute('aria-pressed', button.dataset.query === query ? 'true' : 'false');
  }
  showGuideHits();
}

$('guide-search').addEventListener('submit', (event) => {
  event.preventDefault();
  submitGuide(guideInput.value);
});
$('guide-more').addEventListener('click', showGuideHits);

let savingImages = false;
$('guide-download').hidden = !canSaveImages;
async function updateImageStatus() {
  if (!canSaveImages || savingImages) return;
  try {
    const cache = await caches.open(imageCacheName);
    const count = (await cache.keys()).length;
    saveImages.disabled = count === guideImages.length;
    imageStatus.textContent = saveImages.disabled ? '✓ 全部攻略图片已离线保存'
      : '约 56 MB，已保存 ' + count + '/' + guideImages.length + ' 张';
  } catch {
    imageStatus.textContent = '此浏览器无法保存图片到离线。';
  }
}

saveImages.addEventListener('click', async () => {
  if (savingImages) return;
  savingImages = true;
  saveImages.disabled = true;
  let done = 0;
  let failed = 0;
  try {
    const cache = await caches.open(imageCacheName);
    for (let i = 0; i < guideImages.length; i += 8) {
      const urls = guideImages.slice(i, i + 8).map(imageUrl);
      const batch = await Promise.allSettled(urls.map(async (url) => {
        if (!await cache.match(url)) await cache.add(url);
      }));
      done += batch.filter((result) => result.status === 'fulfilled').length;
      failed += batch.filter((result) => result.status === 'rejected').length;
      imageStatus.textContent = '已保存 ' + done + '/' + guideImages.length + ' 张';
      if (failed && !navigator.onLine) break;
    }
    retryGuideImages();
    if (done === guideImages.length) imageStatus.textContent = '✓ 全部攻略图片已离线保存';
    else imageStatus.textContent = '已保存 ' + done + ' 张，本次未完成。联网后可以继续。';
  } catch {
    imageStatus.textContent = '无法完成离线保存，请检查网络和浏览器可用空间。';
  } finally {
    savingImages = false;
    saveImages.disabled = done === guideImages.length;
  }
});

updateImageStatus();

for (const button of document.querySelectorAll('[data-query]')) {
  button.addEventListener('click', () => submitGuide(button.dataset.query));
}
const featuredIds = [4136, 1973, 2110, 1378, 647, 3340];
const featured = featuredIds.map((id) => guideIndex.find(({ record }) => record.id === id)).filter(Boolean);
guideResults.append(...featured.map(({ record }, index) =>
  guideCard({ record, rank: 0, related: false }, index, true)));
document.documentElement.dataset.guideReady = 'true';
for (const control of document.querySelectorAll('#guide-search input, #guide-search button, [data-query]')) {
  control.disabled = false;
}
if ($('guide-load-state')) $('guide-load-state').hidden = true;
if ($('guide-load-retry')) $('guide-load-retry').hidden = true;
$('guide-result-count').textContent = featured.length + ' 个条目';
