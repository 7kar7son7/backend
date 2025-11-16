const { XMLParser } = require('fast-xml-parser');
const { DateTime } = require('luxon');
const fs = require('fs');
const xml = fs.readFileSync('../epg-source/guide.xml', 'utf8');
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const parsed = parser.parse(xml);
const ensureArray = (value) => (value == null ? [] : Array.isArray(value) ? value : [value]);
const channelNodes = ensureArray(parsed.tv.channel ?? []);
const programmeNodes = ensureArray(parsed.tv.programme ?? []);
const programmesByChannel = new Map();
const now = DateTime.utc();
const maxTime = now.plus({ hours: 48 });
for (const programme of programmeNodes) {
  const channelId = programme['@_channel'];
  if (!channelId) continue;
  const startTsRaw = programme['@_start'];
  const parseTimestamp = (raw) => {
    if (!raw) return null;
    const trimmed = raw.trim();
    let dt = DateTime.fromFormat(trimmed, 'yyyyLLddHHmmss Z', {
      setZone: true,
    });
    if (!dt.isValid) {
      dt = DateTime.fromFormat(trimmed, 'yyyyLLddHHmmss', { zone: 'UTC' });
    }
    return dt.isValid ? dt.toUTC().toJSDate() : null;
  };
  const startTs = parseTimestamp(startTsRaw);
  if (!startTs) continue;
  const start = DateTime.fromJSDate(startTs).toUTC();
  if (start < now || start > maxTime) {
    continue;
  }
  let list = programmesByChannel.get(channelId);
  if (!list) {
    list = [];
    programmesByChannel.set(channelId, list);
  }
  list.push(start.toISO());
}
const result = {
  channelNodes: channelNodes.length,
  programmeNodes: programmeNodes.length,
  channelsWithFuture: programmesByChannel.size,
};
fs.writeFileSync('tmp-epg-logic.json', JSON.stringify(result, null, 2));
