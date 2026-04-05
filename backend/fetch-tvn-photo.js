require('dotenv').config({ path: 'f:\\tvapp\\.env' });
const fs = require('fs');
const https = require('https');

const tvnPath = 'f:\\tvapp\\tvn_programs.json';
const data = JSON.parse(fs.readFileSync(tvnPath, 'utf8'));
const programs = (data.data && data.data.programs) ? data.data.programs : [];
const withPhoto = programs.find(p => p.imageUrl && (p.imageUrl.includes('photo') || p.imageUrl.includes('akpa_p3')));
if (!withPhoto) {
  console.error('Brak programu ze zdjęciem w odpowiedzi');
  process.exit(1);
}

let photoUrl = withPhoto.imageUrl;
if (photoUrl.startsWith('/')) photoUrl = 'https://backend.devstudioit.app' + photoUrl;
if (photoUrl.includes('photos/proxy?url=')) {
  photoUrl = decodeURIComponent(photoUrl.split('url=')[1]);
}
console.error('Program:', withPhoto.title, '| Kanał:', withPhoto.channelName);
console.error('AKPA URL:', photoUrl);

const token = process.env.AKPA_API_TOKEN || '';
const opts = { headers: { 'Accept': 'image/*', 'Authorization': 'Bearer ' + token } };
https.get(photoUrl, opts, (res) => {
  if (res.statusCode !== 200) {
    console.error('Status:', res.statusCode);
    res.pipe(process.stderr);
    return;
  }
  const out = fs.createWriteStream('f:\\tvapp\\program_photo_tvn.jpg');
  res.pipe(out);
  out.on('finish', () => console.error('Zapisano: f:\\tvapp\\program_photo_tvn.jpg (' + out.bytesWritten + ' B)'));
}).on('error', e => { console.error(e.message); process.exit(1); });
