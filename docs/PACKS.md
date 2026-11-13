# 캐릭터 팩 만들기

캐릭터 · 대사 · 배경 · 배경음은 모두 **팩**에서 읽습니다. 코어 앱에는 넥슨 IP 가 없습니다.

```
app/packs/index.json                 { "packs": ["arona", "<내 팩>"] }
app/packs/<팩>/pack.json             { id, name, version, author, license, chars: ["<캐릭터 id>"] }
app/packs/<팩>/CREDITS.md            작가 · 허락 내역
app/packs/<팩>/bg/*.(svg|png|jpg|webp)
app/packs/<팩>/chara/<id>/chara.json
app/packs/<팩>/chara/<id>/poses/<포즈>/body.png · face/*.png · blink.png · mouth.png
app/packs/<팩>/chara/<id>/voice/*.ogg  (선택)
```

> 팩의 모든 파일은 [ASSETS.md](../ASSETS.md) 에 등록해야 빌드됩니다. 다른 사람의 그림 · 목소리를 쓸 때는 반드시 허락을 받고 `CREDITS.md` 에 남겨 주세요.

## 리그 종류

| `rig` | 그림 | 움직임 |
|---|---|---|
| `"layers"` (아로나 팬 팩) | 파트별 레이어 `back · body · face · hair · ribbon · halo` + `layers.json` (`tools/rig/make_layers.py` 가 만든다) | 머리 회전 · 머리카락/리본 흔들림 · 헤일로 · 셰이더 눈 깜빡임 · 입 모양. 표정은 `faces: {이름: {lid, mouth}}` |
| `"still"` (기본값) | 몸통 + 표정 레이어 (아래) | 화면 휘기 셰이더 숨쉬기 · 흔들림, 레이어 깜빡임 · 립싱크 |

## 그림 레이어 규칙 (rig: "still")

- 한 포즈의 모든 레이어는 **같은 캔버스 크기 · 같은 위치**의 투명 PNG(또는 SVG)입니다.
- `body` 몸통(머리 · 머리카락 · 옷). 얼굴 부분은 비워 두거나 기본 얼굴을 그려도 됩니다.
- `face/<표정>` 표정 레이어 — 눈 · 눈썹 · 입 · 볼 터치. 바꿀 때 0.12초 교차 페이드.
- `blink` 눈 감은 레이어 (선택) — **기본 표정** 위에 덮습니다. 기본 표정의 눈을 피부색으로 가리고 감은 눈을 그려 주세요.
- `mouth` 입 벌린 레이어 (선택) — 말하는 동안 여닫습니다. 어떤 표정 위에도 덮이므로 입 자리를 피부색으로 가리고 벌린 입을 그려 주세요.
- 숨쉬기 · 몸 흔들림 · 고개 기울임은 셰이더가 그림을 부드럽게 휘어 만듭니다. `anchor` 의 `neck`(목 높이) 아래는 몸, 위는 머리로 움직입니다.
- 권장 크기: 세로 1600~2400px. 발끝까지 그리지 않아도 됩니다 (아래쪽이 화면 밖으로 잘림).

## chara.json

```jsonc
{
  "id": "mychara", "name": "내 캐릭터", "affil": "소속 (설정 화면에 표시)",
  "color": "#4a9be8",            // 테마 색 (전환 화면 · 카드)
  "icon": "icon.svg",            // 프로필 (정사각형)
  "face0": "normal",             // 기본 표정
  "breath": 3.6, "sway": 0.6, "bob": 0.45,   // 숨 주기(초) · 흔들림(도) · 숨 높이(%)
  "tap": ["hophop", "jump", "nod"],          // 몸을 눌렀을 때 동작 (hophop · jump · greeting · shake · stiff · nod · wiggle)
  "head": ["nod", "wiggle"],                 // 머리를 눌렀을 때
  "talkEvery": 60,                           // 혼잣말 간격(초)
  "poses": {
    "stand": {
      "dir": "poses/stand/", "w": 600, "h": 900,
      "layers": { "body": "body.svg", "blink": "blink.svg", "mouth": "mouth.svg",
                  "faces": { "normal": "face/normal.svg", "smile": "face/smile.svg" } },
      "anchor": { "head": [0.5, 0.37], "emo": [0.82, 0.15], "neck": 0.57, "cx": 0.5 }   // 그림 안 비율 좌표 (위가 0)
    }
  },
  "bg": { "morning": ["room_day"], "day": ["room_day"], "evening": ["room_day"], "night": ["room_night"] },
  "bgm": { "home": "packs/<팩>/bgm/home.ogg", "work": "packs/<팩>/bgm/work.ogg" },   // 선택
  "moods": { "sleep": { "f": "sleep", "e": "Zzz" } },                               // 선택: 혼자 노는 상태 (대사 묶음 이름과 같게)
  "lines": {
    "in":   [{ "t": "어서 오세요, [USERNAME] 선생님!", "f": "smile", "v": "voice/in_1.ogg" }],
    "talk": [{ "t": "네, 부르셨어요?", "f": "normal" },
             { "t": "자꾸 찌르시면…!", "f": "angry", "only": "workTap", "poke": 4 }],
    "cafe": [{ "t": "흥흥~♪", "f": "smile" }]
  },
  "situ": { "morning": [{ "t": "좋은 아침이에요, {name} 선생님!", "f": "smile", "e": "Twinkle" }] }
}
```

### 대사 필드

| 필드 | 뜻 |
|---|---|
| `t` | 대사. `[USERNAME]` · `{name}` 은 설정의 호칭 |
| `f` | 표정 (팩에 없는 표정이면 기본 표정) |
| `v` | 음성 파일 (캐릭터 폴더 기준 경로) |
| `e` | (상황 대사) 감정 아이콘: Question · Exclaim · Surprise · Heart · Dot · Chat · Respond · Shy · Sweat · Twinkle · Music · Upset · Angry · Sigh · Sad · Tear · Steam · Bulb · Zzz |
| `only` | 그 상황에서만. `workTap` = 업무 화면에서 직접 눌렀을 때 |
| `poke` | 업무 화면에서 연달아 누른 횟수가 이 값일 때 이 대사 |
| `p` / `s` | 여러 음성으로 나뉜 대사 / 한 음성 안에서 말풍선 · 표정이 바뀌는 대사 (`[{t, f, d}]`) |

### 상황 대사 (situ) 키

`dawn` `morning` `noon` `afternoon` `evening` `night` `weekend` `monday` `back_long` `back_day`
`charge_on` `charge_off` (`{n}`) `full` `low` (`{n}`) `app_added` `app_removed` (`{app}`) `updated` `mission_done` (`{title}`) `mission_all`
