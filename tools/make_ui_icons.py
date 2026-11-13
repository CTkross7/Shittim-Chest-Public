#!/usr/bin/env python3
"""UI 아이콘 세트 (자체 제작 SVG) — app/assets/ui/<이름>.svg

원작 게임의 UI 아이콘 대신 쓰는 단순한 선 아이콘이다. 이름은 코드가 쓰는 이름 그대로.
    python3 tools/make_ui_icons.py
"""
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'app', 'assets', 'ui')
C = '#2f7ad8'    # 선 색

# 24×24 격자 기준 선(stroke) 그림
G = {
    'settings': '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/><circle cx="12" cy="12" r="6.6"/>',
    'gear': '<circle cx="12" cy="12" r="3"/><path d="M12 3l1.6 2.6 3-.6.6 3 2.6 1.6-1.4 2.4 1.4 2.4-2.6 1.6-.6 3-3-.6L12 21l-1.6-2.6-3 .6-.6-3L4.2 14.4 5.6 12 4.2 9.6l2.6-1.6.6-3 3 .6z"/>',
    'mission': '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 3.5h6v2.5H9z"/><path d="M8.5 11l2 2 4-4M8.5 16.5h7"/>',
    'task': '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    'check': '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.7 2.7L16.3 9.4"/>',
    'notice': '<path d="M4 10v4h3l7 4V6L7 10z"/><path d="M17 9.5a4 4 0 0 1 0 5"/>',
    'notice2': '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    'schedule': '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2"/>',
    'mail': '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
    'mail2': '<path d="M3 9l9-5.5L21 9v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19z"/><path d="M3.5 9.5l8.5 6 8.5-6"/>',
    'chat': '<path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    'menu': '<path d="M4 7h16M4 12h16M4 17h16"/>',
    'search': '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    'notes': '<path d="M5 3.5h10l4 4v13H5z"/><path d="M15 3.5v4h4M8 11h8M8 14.5h8M8 18h5"/>',
    'book': '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v13"/>',
    'codex': '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M9 3.5v17M12 8h4M12 11h4"/>',
    'gallery': '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="9.5" r="1.8"/><path d="M4 17l5-5 4 4 3-3 4 4"/>',
    'tablet': '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M10.5 18.5h3"/><path d="M8.5 7.5h7M8.5 10.5h7M8.5 13.5h4"/>',
    'shop': '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/><path d="M5 11v9h14v-9M10 20v-5h4v5"/>',
    'store24': '<path d="M4 9l1.5-5h13L20 9v11H4z"/><path d="M4 9h16"/><text x="12" y="17.5" font-size="7" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="#2f7ad8" stroke="none">24</text>',
    'bag': '<path d="M5 8h14l-1 12.5H6z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
    'wallet': '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 9.5h18"/><rect x="14.5" y="12" width="4.5" height="3.5" rx="1"/><path d="M6 6l9-2.5 1 2.5"/>',
    'tag': '<path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5z"/><circle cx="8" cy="8.5" r="1.6"/>',
    'gift': '<rect x="3.5" y="9" width="17" height="4" rx="1"/><path d="M5 13v7.5h14V13M12 9v11.5"/><path d="M12 9c-2-4-6-4-6-1.5S10 9 12 9c2 0 6 1 6-1.5S14 5 12 9z"/>',
    'cafe': '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M7 3.5c-1 1.5 1 2 0 3.5M11 3.5c-1 1.5 1 2 0 3.5"/>',
    'house': '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5M10 20v-6h4v6"/>',
    'office': '<rect x="4" y="3.5" width="16" height="17" rx="1.5"/><path d="M8 7.5h2M14 7.5h2M8 11h2M14 11h2M8 14.5h2M14 14.5h2M10.5 20.5v-3h3v3"/>',
    'tower': '<path d="M12 2.5v3M8.5 21L12 5.5 15.5 21M9.7 15.5h4.6M10.6 11h2.8"/><path d="M6 21h12"/>',
    'student': '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/>',
    'stars': '<path d="M12 3.5l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 15.8l-5 2.9 1.2-5.6L4 9.3l5.6-.6z"/>',
    'cloud': '<path d="M7 18.5a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6-1.5A4.5 4.5 0 0 1 17 18.5z"/>',
    'shield': '<path d="M12 3l7.5 3v6c0 4.5-3.2 7.6-7.5 9-4.3-1.4-7.5-4.5-7.5-9V6z"/><path d="M8.7 12.2l2.3 2.3 4.3-4.6"/>',
    'sword': '<path d="M19.5 4.5L9 15l-1.5-1.5L18 3h1.5z"/><path d="M6 12.5l5.5 5.5M5 19l2.5-2.5M4 17.5L6.5 20"/>',
    'question': '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1.1 1-1.1 1.8v.6"/><circle cx="12" cy="17" r=".6" fill="#2f7ad8"/>',
    # 앱 마크: 상자 + 반짝임 (자체 디자인)
    'shittim': '<path d="M3.5 9.5L12 5l8.5 4.5v9L12 23l-8.5-4.5z" transform="translate(0 -1.5)"/><path d="M3.5 8L12 12.5 20.5 8M12 12.5V21.5"/><path d="M18.5 2.5v3M17 4h3"/>',
}

# 자원 아이콘 (타일 없이 색 아이콘)
RES = {
    'AP': '<path d="M13.5 2L5 13.5h6L9.5 22 19 9.5h-6z" fill="#ffd34d" stroke="#d99a00" stroke-width="1.4" stroke-linejoin="round"/>',
    'Gold': '<circle cx="12" cy="12" r="8.5" fill="#ffd34d" stroke="#d99a00" stroke-width="1.4"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#e6a800" stroke-width="1.3"/>',
    'Pyroxene': '<path d="M12 2.5l7.5 7-7.5 12-7.5-12z" fill="#7fd3ff" stroke="#2f7ad8" stroke-width="1.3" stroke-linejoin="round"/><path d="M4.5 9.5h15M12 2.5L9 9.5l3 12 3-12z" fill="none" stroke="#2f7ad8" stroke-width="1" stroke-linejoin="round"/>',
}


def tile(glyph):
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">'
            '<defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3f0fd"/></linearGradient></defs>'
            '<rect x="4" y="4" width="88" height="88" rx="22" fill="url(#t)" stroke="#bcd8f5" stroke-width="2"/>'
            f'<g transform="translate(18 18) scale(2.5)" fill="none" stroke="{C}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{glyph}</g></svg>\n')


def plain(body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24">{body}</svg>\n'


def main():
    os.makedirs(OUT, exist_ok=True)
    for k, v in G.items():
        open(os.path.join(OUT, k + '.svg'), 'w').write(tile(v))
    for k, v in RES.items():
        open(os.path.join(OUT, k + '.svg'), 'w').write(plain(v))
    print(len(G) + len(RES), 'icons')


if __name__ == '__main__':
    main()
