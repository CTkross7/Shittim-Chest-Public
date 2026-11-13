// 자주 쓰는 앱의 '블루아카 스타일' 아이콘을 만든다.
// 로고 모양: Simple Icons (CC0, npm simple-icons) — 상표는 각 회사 소유. 개인용 팬 테마.
// 사용: node tools/ba_icons.js <simple-icons/icons 폴더> <출력 PNG 폴더>   → 다음에 tools/ba_icons_pack.py 로 webp + data/ba-icons.json
// 앱을 더 넣으려면 APPS 에 한 줄 추가: [simple-icons 이름, 표시 이름, [용도], '패키지·이름 검색어(정규식)']
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const APPS = [
  ['youtube', 'YouTube', ['media'], 'youtube(?!.*music)|유튜브$'], ['youtubemusic', 'YouTube Music', ['media'], 'youtube\\.music|유튜브 뮤직'],
  ['googlechrome', 'Chrome', ['tool'], 'chrome|크롬'], ['kakaotalk', '카카오톡', ['sns'], 'kakao\\.talk|카카오톡'], ['kakao', '카카오', ['sns'], 'kakao(?!\\.talk)'],
  ['discord', 'Discord', ['sns', 'game'], 'discord|디스코드'], ['spotify', 'Spotify', ['media'], 'spotify|스포티파이'], ['steam', 'Steam', ['game'], 'steam|스팀'],
  ['netflix', 'Netflix', ['media'], 'netflix|넷플릭스'], ['instagram', 'Instagram', ['sns', 'photo'], 'instagram|인스타'], ['x', 'X (Twitter)', ['sns'], 'twitter|x\\.android|트위터'],
  ['threads', 'Threads', ['sns'], 'threads|스레드'], ['facebook', 'Facebook', ['sns'], 'facebook\\.katana|페이스북'], ['messenger', 'Messenger', ['sns'], 'facebook\\.orca|메신저'],
  ['telegram', 'Telegram', ['sns'], 'telegram|텔레그램'], ['whatsapp', 'WhatsApp', ['sns'], 'whatsapp'], ['line', 'LINE', ['sns'], 'jp\\.naver\\.line|라인'],
  ['signal', 'Signal', ['sns'], 'signal'], ['viber', 'Viber', ['sns'], 'viber'], ['wechat', 'WeChat', ['sns'], 'tencent\\.mm|wechat'], ['snapchat', 'Snapchat', ['sns', 'photo'], 'snapchat'],
  ['bluesky', 'Bluesky', ['sns'], 'bluesky'], ['mastodon', 'Mastodon', ['sns'], 'mastodon'], ['reddit', 'Reddit', ['sns'], 'reddit'], ['tumblr', 'Tumblr', ['sns'], 'tumblr'],
  ['linkedin', 'LinkedIn', ['sns', 'work'], 'linkedin'], ['pinterest', 'Pinterest', ['photo', 'sns'], 'pinterest'], ['tiktok', 'TikTok', ['media', 'sns'], 'tiktok|musically|틱톡'],
  ['twitch', 'Twitch', ['media', 'game'], 'twitch|트위치'], ['bilibili', 'bilibili', ['media'], 'bilibili'], ['niconico', 'niconico', ['media'], 'niconico|nicovideo'],
  ['soundcloud', 'SoundCloud', ['media'], 'soundcloud'], ['applemusic', 'Apple Music', ['media'], 'apple\\.android\\.music'], ['tidal', 'TIDAL', ['media'], 'tidal'],
  ['shazam', 'Shazam', ['media'], 'shazam'], ['primevideo', 'Prime Video', ['media'], 'avod|primevideo'], ['crunchyroll', 'Crunchyroll', ['media'], 'crunchyroll'],
  ['plex', 'Plex', ['media'], 'plexapp'], ['naver', 'NAVER', ['tool'], 'nhn\\.android\\.search|naver\\.android|네이버$'], ['google', 'Google', ['tool'], 'googlequicksearchbox'],
  ['googlemaps', 'Google 지도', ['travel'], 'google\\.android\\.apps\\.maps|지도'], ['gmail', 'Gmail', ['sns', 'work'], 'gm$|gmail'], ['googledrive', 'Google Drive', ['work'], 'apps\\.docs|drive'],
  ['googlephotos', 'Google 포토', ['photo'], 'apps\\.photos|포토'], ['googleplay', 'Play 스토어', ['shop'], 'vending|play 스토어'], ['googlecalendar', 'Google 캘린더', ['work'], 'calendar|캘린더'],
  ['googlekeep', 'Keep', ['work'], 'keep|메모'], ['googletranslate', 'Google 번역', ['tool'], 'translate|번역'], ['googlemeet', 'Meet', ['sns', 'work'], 'apps\\.(meetings|tachyon)|meet'],
  ['googlenews', 'Google 뉴스', ['work'], 'magazines|news'], ['notion', 'Notion', ['work'], 'notion'], ['slack', 'Slack', ['sns', 'work'], 'slack'], ['zoom', 'Zoom', ['sns', 'work'], 'zoom'],
  ['obsidian', 'Obsidian', ['work'], 'obsidian'], ['evernote', 'Evernote', ['work'], 'evernote'], ['dropbox', 'Dropbox', ['work'], 'dropbox'], ['canva', 'Canva', ['photo', 'work'], 'canva'],
  ['figma', 'Figma', ['work'], 'figma'], ['github', 'GitHub', ['work', 'tool'], 'github'], ['wikipedia', 'Wikipedia', ['work'], 'wikipedia|위키'], ['medium', 'Medium', ['work'], 'medium'],
  ['feedly', 'Feedly', ['work'], 'feedly'], ['duolingo', 'Duolingo', ['work'], 'duolingo|듀오링고'], ['openai', 'ChatGPT', ['tool', 'work'], 'openai|chatgpt'],
  ['claude', 'Claude', ['tool', 'work'], 'anthropic|claude'], ['firefox', 'Firefox', ['tool'], 'firefox|mozilla'], ['opera', 'Opera', ['tool'], 'opera'], ['brave', 'Brave', ['tool'], 'brave'],
  ['vivaldi', 'Vivaldi', ['tool'], 'vivaldi'], ['samsung', 'Samsung', ['tool'], 'samsung members|^samsung$'], ['android', 'Android', ['tool'], '^android$|android system'],
  ['androidstudio', 'Android Studio', ['tool'], 'androidstudio'], ['vscodium', 'VSCodium', ['tool', 'work'], 'vscod'], ['python', 'Python', ['tool', 'work'], 'python|pydroid'],
  ['magisk', 'Magisk', ['tool'], 'magisk'], ['protonvpn', 'Proton VPN', ['tool'], 'protonvpn|proton vpn'], ['protonmail', 'Proton Mail', ['sns'], 'protonmail'], ['proton', 'Proton', ['tool'], 'proton\\.android\\.pass|proton pass|proton drive'],
  ['nordvpn', 'NordVPN', ['tool'], 'nordvpn'], ['epicgames', 'Epic Games', ['game'], 'epicgames'], ['playstation', 'PlayStation', ['game'], 'playstation|scea'],
  ['nintendoswitch', 'Nintendo', ['game'], 'nintendo'], ['roblox', 'Roblox', ['game'], 'roblox'], ['riotgames', 'Riot Games', ['game'], 'riotgames'],
  ['leagueoflegends', 'League of Legends', ['game'], 'leagueoflegends|lol'], ['valorant', 'VALORANT', ['game'], 'valorant'], ['battledotnet', 'Battle.net', ['game'], 'blizzard|battle\\.net'],
  ['ea', 'EA', ['game'], '^com\\.ea\\.'], ['ubisoft', 'Ubisoft', ['game'], 'ubisoft'], ['itchdotio', 'itch.io', ['game'], 'itch'], ['paypal', 'PayPal', ['shop'], 'paypal'],
  ['amazon', 'Amazon', ['shop'], 'amazon\\.mShop|amazon'], ['aliexpress', 'AliExpress', ['shop'], 'aliexpress'], ['ebay', 'eBay', ['shop'], 'ebay'], ['ikea', 'IKEA', ['shop'], 'ikea'],
  ['starbucks', 'Starbucks', ['food'], 'starbucks|스타벅스'], ['uber', 'Uber', ['travel'], 'ubercab|uber'], ['airbnb', 'Airbnb', ['travel'], 'airbnb'],
];

function card(pathD, brand) {
  // 96×96: 흰 카드(위 → 아래 하늘색) · 남색 테두리 · 아래 대각선 띠(브랜드 색) · 오른쪽 위 헤일로 · 삼각형 장식 · 남색 로고(하늘색 그림자)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".62" stop-color="#eef8ff"/><stop offset="1" stop-color="#cdeeff"/></linearGradient>
    <clipPath id="c"><rect x="7" y="7" width="82" height="82" rx="20"/></clipPath>
  </defs>
  <rect x="7" y="9" width="82" height="82" rx="20" fill="#16304f" opacity=".22"/>
  <rect x="7" y="7" width="82" height="82" rx="20" fill="url(#bg)"/>
  <g clip-path="url(#c)">
    <path d="M0 74 L96 56 L96 96 L0 96 Z" fill="#${brand}" opacity=".9"/>
    <path d="M0 78 L96 60 L96 63 L0 81 Z" fill="#ffffff" opacity=".85"/>
    <path d="M12 20 l6 -10 l6 10 z" fill="#3dd2f9" opacity=".35"/>
    <path d="M80 70 l4 -7 l4 7 z" fill="#ffffff" opacity=".7"/>
  </g>
  <rect x="7" y="7" width="82" height="82" rx="20" fill="none" stroke="#2b4466" stroke-width="3"/>
  <ellipse cx="73" cy="17" rx="12" ry="4.2" fill="none" stroke="#3dd2f9" stroke-width="2.4" transform="rotate(-14 73 17)"/>
  <g transform="translate(25.5 23) scale(1.875)">
    <path d="${pathD}" fill="#3dd2f9" transform="translate(.9 .9)"/>
    <path d="${pathD}" fill="#2b4466"/>
  </g>
</svg>`;
}

(async () => {
  const [src, out] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 96, height: 96 } });
  const meta = [];
  for (const [slug, name, tags, m] of APPS) {
    const f = path.join(src, slug + '.svg'); if (!fs.existsSync(f)) { console.log('없음', slug); continue; }
    const svg = fs.readFileSync(f, 'utf8');
    const d = (svg.match(/<path d="([^"]+)"/) || [])[1]; if (!d) continue;
    let brand = '2b4466';
    try { const info = JSON.parse(fs.readFileSync(path.join(src, '..', '_data', 'simple-icons.json'), 'utf8')); const it = (info.icons || info).find((x) => (x.slug || '') === slug || x.title.toLowerCase().replace(/[^a-z0-9]/g, '') === slug); if (it) brand = it.hex; } catch (_) { /* 기본 색 */ }
    await p.setContent(`<html><body style="margin:0;background:transparent">${card(d, brand)}</body></html>`);
    await p.screenshot({ path: path.join(out, slug + '.png'), omitBackground: true, clip: { x: 0, y: 0, width: 96, height: 96 } });
    meta.push({ i: slug, n: name, t: tags, m });
  }
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta));
  console.log(meta.length, 'icons');
  await b.close();
})();
