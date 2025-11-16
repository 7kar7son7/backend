const fs = require('fs');
const xml = fs.readFileSync('../epg-source/guide.xml', 'utf8');
const regex = /<programme[^>]+start="(\d+) \+0000"/g;
let count = 0;
let future = 0;
const now = Date.now();
let minFuture = null;
let maxFuture = null;
let match;
while ((match = regex.exec(xml))) {
  count += 1;
  const iso = match[1].replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z');
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) continue;
  if (date.getTime() > now) {
    future += 1;
    if (!minFuture || date < minFuture) minFuture = date;
    if (!maxFuture || date > maxFuture) maxFuture = date;
  }
}
console.log({ count, future, minFutureISO: minFuture?.toISOString(), maxFutureISO: maxFuture?.toISOString() });
