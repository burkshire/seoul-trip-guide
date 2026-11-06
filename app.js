const koreaClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function koreaNow(now = new Date()) {
  const parts = Object.fromEntries(koreaClock.formatToParts(now).map(({ type, value }) => [type, value]));
  const localDay = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day));
  const previous = new Date(localDay.getTime() - 86400000);
  return {
    weekday: (localDay.getUTCDay() + 6) % 7,
    date: localDay.toISOString().slice(0, 10),
    previousDate: previous.toISOString().slice(0, 10),
    minute: +parts.hour * 60 + +parts.minute,
  };
}

function statusAt(store, day, minute) {
  if (store.closed?.includes(day.date)) return { state: 'closed' };
  const today = store.week[day.weekday];
  const yesterday = store.closed?.includes(day.previousDate) ? [] : store.week[(day.weekday + 6) % 7];
  const intervals = (today ?? []).concat((yesterday ?? []).filter(([, end]) => end > 1440)
    .map(([start, end]) => [start - 1440, end - 1440]));
  const active = intervals.filter(([start, end]) => start <= minute && minute < end);
  if (active.length) {
    return {
      state: 'open',
      end: Math.max(...active.map(([, end]) => end)),
      allDay: active.some(([start, end]) => start === 0 && end === 1440),
    };
  }
  return { state: today === null ? 'unknown' : 'closed' };
}

function formatTime(minute) {
  const hours = Math.floor(minute / 60) % 24;
  return [hours, minute % 60].map((part) => String(part).padStart(2, '0')).join(':');
}

const area = $('area');
const time = $('time');
const customTime = $('custom-time');
time.value = '';
const areas = [...new Set(stores.map((store) => store.area))];
for (const name of areas) area.add(new Option(name, name));
for (let minute = 0; minute < 1440; minute += 30) time.add(new Option(formatTime(minute), minute));
time.add(new Option('自选时间…', 'custom'));

function shopRow(store, status, expanded) {
  const row = element('li', '', 'shop');
  const details = element('details');
  details.dataset.id = store.id;
  details.open = expanded.has(String(store.id));
  const summary = element('summary', '', 'row');
  const name = element('span', '', 'name');
  name.append(element('strong', store.name), element('small', store.area));
  const close = element('span', '', 'closing');
  const info = element('div', '', 'shop-info');

  if (status.state === 'open') {
    const closingTime = status.end === 1440 ? '24:00' : formatTime(status.end);
    close.append(element('strong', status.allDay ? '24 小时' : closingTime));
    if (status.end > 1440) close.append(element('small', '次日'));
  } else {
    close.append(element('strong', status.state === 'unknown' ? '待核对' : '未营业'));
  }
  info.append(element('p', store.hours || '攻略未记载完整营业时间。'));
  if (store.location) info.append(element('p', store.location));
  if (store.note) info.append(element('p', store.note));
  summary.append(name, close);
  details.append(summary, info);
  row.append(details);
  return row;
}

let lastView = '';
function refresh() {
  const day = koreaNow();
  time.options[0].textContent = formatTime(day.minute);
  const custom = time.value === 'custom';
  $('custom-field').hidden = !custom;

  if (custom && !customTime.value) return;
  const minute = custom ? customTime.value.split(':').reduce((a, b) => a * 60 + +b, 0)
    : time.value === '' ? day.minute : Number(time.value);

  const view = JSON.stringify([area.value, time.value, day.date, minute]);
  if (lastView === view) return;
  lastView = view;
  const expanded = new Set([...document.querySelectorAll('details[open][data-id]')].map((el) => el.dataset.id));
  const open = [];
  const others = [];
  for (const store of stores) {
    if (area.value && area.value !== store.area) continue;
    const status = statusAt(store, day, minute);
    (status.state === 'open' ? open : others).push({ store, status });
  }
  open.sort((a, b) => a.status.end - b.status.end);
  const unknown = others.filter(({ status }) => status.state === 'unknown').length;
  $('results-title').textContent = time.value === '' ? '营业中' : formatTime(minute) + ' 营业';
  $('count').textContent = open.length + ' 家';
  $('empty').hidden = open.length > 0;
  $('shops').replaceChildren(...open.map(({ store, status }) => shopRow(store, status, expanded)));
  $('other').hidden = others.length === 0;
  $('other-title').textContent = '未营业 ' + (others.length - unknown) + ' 家 · 待核对 ' + unknown + ' 家';
  $('other-shops').replaceChildren(...others.map(({ store, status }) => shopRow(store, status, expanded)));
}
time.addEventListener('change', () => {
  if (time.value === 'custom') {
    if (!customTime.value) customTime.value = formatTime(koreaNow().minute);
    refresh();
    customTime.focus();
  } else refresh();
});
area.addEventListener('change', refresh);
customTime.addEventListener('input', () => { if (customTime.value) refresh(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
window.addEventListener('pageshow', () => {
  time.value = '';
  refresh();
});
refresh();
setInterval(refresh, 5000);
