# 웹캠 점검 결과 2026-11-19

HLS의 최신 상태는 [2026-11-21 재점검](hls-audit-2026-11-21.md)을 참고한다. 아래는 11월 19일 검사 당시의 결과다.

등록된 18개 그룹의 카메라 146개를 대조했다. 새 실시간 영상 21개와 공식 페이지 연결 3개를 추가했다. 기존 카메라 번호는 유지해 즐겨찾기와 주소가 바뀌지 않도록 했다.

검사 시각: 2026-11-19T06:14:17.217Z. HLS는 영상 조각 수신과 재생 목록 갱신, 비발디는 서로 다른 시각의 JPEG 프레임 2개, YouTube는 공개 라이브 상태와 임베드 허용 여부로 확인했다. 외부 위젯은 페이지 응답까지만 확인했다. 검사 이후 제공처 상태는 달라질 수 있다.

## 점검 집계

| 항목 | 개수 |
|---|---:|
| HLS 영상 조각 및 목록 갱신 확인 | 59 |
| 비발디 JPEG 프레임 수신 확인 | 12 |
| YouTube 공개 라이브 및 임베드 허용 확인 | 43 |
| YouTube 라이브, 외부 페이지에서만 재생 허용 | 1 |
| 외부 제공처 위젯 응답 확인 | 2 |
| 종료·비공개·주소 미제공으로 공식 페이지 연결 | 14 |
| 원본 HLS 오류 | 11 |
| 비발디 프레임 미수신 | 4 |

## 리조트별 현황

| 리조트·지역 | 등록 | 라이브 데이터·상태 확인 | 외부 전용·위젯 | 공식 페이지 연결 | 오류·미수신 |
|---|---:|---:|---:|---:|---:|
| 곤지암리조트 | 6 | 5 | 0 | 1 | 0 |
| 지산 포레스트 리조트 | 5 | 2 | 0 | 0 | 3 |
| 엘리시안 강촌 | 1 | 0 | 0 | 1 | 0 |
| 비발디파크 | 16 | 12 | 0 | 0 | 4 |
| 오크밸리 | 5 | 0 | 0 | 0 | 5 |
| 웰리힐리파크 | 6 | 5 | 0 | 0 | 1 |
| 휘닉스 파크 | 7 | 5 | 0 | 0 | 2 |
| 알펜시아 리조트 | 1 | 1 | 0 | 0 | 0 |
| 모나 용평 | 5 | 5 | 0 | 0 | 0 |
| 하이원 리조트 | 18 | 18 | 0 | 0 | 0 |
| 오투리조트 | 8 | 8 | 0 | 0 | 0 |
| 무주 덕유산 리조트 | 11 | 11 | 0 | 0 | 0 |
| 에덴밸리리조트 | 2 | 0 | 2 | 0 | 0 |
| 홋카이도 | 7 | 7 | 0 | 0 | 0 |
| 주부 | 19 | 11 | 0 | 8 | 0 |
| 간토 | 18 | 15 | 0 | 3 | 0 |
| 도호쿠 | 10 | 9 | 0 | 1 | 0 |
| 간사이 | 1 | 0 | 1 | 0 | 0 |

## 오류와 미수신 항목

| 리조트 | 카메라 | 확인 결과 |
|---|---|---|
| 지산 포레스트 리조트 | [레몬 탑승장](https://ski.atik.kr/#jisan/0) | playlist HTTP 404 |
| 지산 포레스트 리조트 | [블루 탑승장](https://ski.atik.kr/#jisan/3) | playlist HTTP 404 |
| 지산 포레스트 리조트 | [실버 탑승장](https://ski.atik.kr/#jisan/4) | playlist HTTP 404 |
| 비발디파크 | [슬로프 전경](https://ski.atik.kr/#vivaldi/0) | 42초 동안 JPEG 프레임 미수신 |
| 비발디파크 | [클래식](https://ski.atik.kr/#vivaldi/8) | 42초 동안 JPEG 프레임 미수신 |
| 비발디파크 | [펑키 상단](https://ski.atik.kr/#vivaldi/10) | 42초 동안 JPEG 프레임 미수신 |
| 비발디파크 | [스키월드 정상](https://ski.atik.kr/#vivaldi/13) | 42초 동안 JPEG 프레임 미수신 |
| 오크밸리 | [스노우파크 옥탑](https://ski.atik.kr/#oakvalley/0) | playlist HTTP 502 |
| 오크밸리 | [I 슬로프 전경](https://ski.atik.kr/#oakvalley/1) | playlist HTTP 502 |
| 오크밸리 | [G 슬로프 전경](https://ski.atik.kr/#oakvalley/2) | playlist HTTP 502 |
| 오크밸리 | [F 슬로프 전경](https://ski.atik.kr/#oakvalley/3) | playlist HTTP 502 |
| 오크밸리 | [플라워 정상](https://ski.atik.kr/#oakvalley/4) | playlist HTTP 502 |
| 웰리힐리파크 | [정상 광장](https://ski.atik.kr/#wellihilli/3) | playlist HTTP 404 |
| 휘닉스 파크 | [도도](https://ski.atik.kr/#phoenix/1) | media HTTP 502 |
| 휘닉스 파크 | [펭귄](https://ski.atik.kr/#phoenix/4) | media HTTP 502 |

비발디는 H.264/H.265 연속 서브스트림을 서버에서 카메라당 한 번 JPEG로 변환해 재즈 상단·테크노 상단·테크노 하단·펑키 하단 4개를 복구했다. 남은 전경·클래식·정상은 제공처가 연결을 닫으며, 펑키 상단은 응답 또는 영상이 도착하지 않았다. 이 4개는 장비·채널 상태 추가 확인이 필요하다. 확인된 공개 원본을 임의의 다른 카메라로 대체하지 않았다. 지산 공식 페이지는 시즌 준비 안내를 표시하며, 오크밸리는 원본 CDN이 HTTP·HTTPS 모두 502를 반환한다. 휘닉스 도도·펭귄은 목록이 갱신되지만 목록에 선언된 영상 파일이 원본에서 404를 반환한다.

## 추가 항목

| 리조트·지역 | 추가 카메라 | 형태 |
|---|---|---|
| 곤지암리조트 | [하늬](https://ski.atik.kr/#konjiam/5) | 공식 페이지 연결 |
| 홋카이도 | [키로로 24시간 적설계](https://ski.atik.kr/#hokkaido/4) | 실시간 영상 |
| 홋카이도 | [키로로 아사리 정상](https://ski.atik.kr/#hokkaido/5) | 실시간 영상 |
| 홋카이도 | [키로로 나가미네 제2구역](https://ski.atik.kr/#hokkaido/6) | 실시간 영상 |
| 주부 | [하쿠바 하포네 구로비시 1678m](https://ski.atik.kr/#chubu/16) | 실시간 영상 |
| 주부 | [야치호코겐 제1 / 아니카 방면](https://ski.atik.kr/#chubu/17) | 실시간 영상 |
| 주부 | [야치호코겐 스키장 전경 (공식 페이지)](https://ski.atik.kr/#chubu/18) | 공식 페이지 연결 |
| 간토 | [마루누마코겐 천공 테라스 2000m](https://ski.atik.kr/#kanto/7) | 실시간 영상 |
| 간토 | [마루누마코겐 입구](https://ski.atik.kr/#kanto/8) | 실시간 영상 |
| 간토 | [마루누마코겐 트리 어드벤처](https://ski.atik.kr/#kanto/9) | 실시간 영상 |
| 간토 | [마루누마코겐 닛코시라네산](https://ski.atik.kr/#kanto/10) | 실시간 영상 |
| 간토 | [마루누마코겐 돈판 레스토랑](https://ski.atik.kr/#kanto/11) | 실시간 영상 |
| 간토 | [오제이와쿠라 곤돌라 하부역](https://ski.atik.kr/#kanto/12) | 실시간 영상 |
| 간토 | [오제이와쿠라 곤돌라 정상역](https://ski.atik.kr/#kanto/13) | 실시간 영상 |
| 간토 | [오제이와쿠라 니시야마 / 호른 레스토랑](https://ski.atik.kr/#kanto/14) | 실시간 영상 |
| 간토 | [구사쓰 온센 텐구야마 정상](https://ski.atik.kr/#kanto/15) | 실시간 영상 |
| 간토 | [구사쓰 온센 국도292호 입구](https://ski.atik.kr/#kanto/16) | 실시간 영상 |
| 간토 | [구사쓰 온센 국도292호 (공식 페이지)](https://ski.atik.kr/#kanto/17) | 공식 페이지 연결 |
| 도호쿠 | [자오 로프웨이 주차장](https://ski.atik.kr/#tohoku/4) | 실시간 영상 |
| 도호쿠 | [자오 선라이즈 슬로프](https://ski.atik.kr/#tohoku/5) | 실시간 영상 |
| 도호쿠 | [자오 주효코겐역](https://ski.atik.kr/#tohoku/6) | 실시간 영상 |
| 도호쿠 | [자오 오모리 주차장](https://ski.atik.kr/#tohoku/7) | 실시간 영상 |
| 도호쿠 | [자오 중앙 로프웨이 제1주차장](https://ski.atik.kr/#tohoku/8) | 실시간 영상 |
| 도호쿠 | [자오 우와노다이 제1주차장](https://ski.atik.kr/#tohoku/9) | 실시간 영상 |

## 수정 내용

- 곤지암은 원본 HTTPS 인증서의 도메인 불일치로 HTTP 원본을 HTTPS 프록시로 연결한다. 기존 5개는 HTTPS 페이지에서 실제 브라우저 재생을 확인했다.
- HTTPS CDN과 외부 서비스는 직접 재생한다. 용평·웰리힐리·지산·오크밸리가 해당한다. HTTP 전용 CDN과 직접 운영 원본은 필요한 HTTPS 중계를 사용한다.
- 동시 다운로드는 16건, 대기열은 64건으로 제한한다. 이전의 동시 8건 초과 시 즉시 실패하는 경로를 없앴다.
- 비발디는 JPEG를 그대로 전달하고 H.264/H.265 장비는 FFmpeg 9.0.2로 한 번만 변환한다. 연속 서브스트림과 수신 속도 제어를 사용하며, 변환 결과는 초당 최대 1프레임·가로 최대 1280px로 모든 시청자가 공유한다.
- 휘닉스 공식 API의 변경 주소, 오크밸리 재생 목록 경로와 명칭, 비발디 클래식의 장비 번호를 정정했다.
- 종료된 YouTube 주소는 공식 페이지 또는 새 공개 라이브로 교체했다. 공식 페이지의 플레이어 ID와 운영 채널의 라이브 제목으로 주소를 갱신한다. 과거 녹화물을 라이브 대신 선택하지 않는다.
- 예전 주소를 저장한 즐겨찾기도 최신 카메라 주소와 재생 방식을 사용한다.
- 사이트, 공유 메타데이터, 사이트맵을 HTTPS로 전환했다. 기존 인증서와 다른 사이트 설정을 보존했다.
- 배포 미리보기는 임의의 로컬 포트를 사용하고 렌더링 직후 서버를 닫는다.

## 공개 원본 확인 경로

- [곤지암](https://www.konjiamresort.co.kr/ski/liveCam.dev)
- [지산](https://www.jisanresort.co.kr/m/ski/slopes/webcam.asp)
- [비발디](https://mice.sonohotelsresorts.com/daemyung.vp.utill.09_02_02_01.ds/dmparse.dm?areaType=S)
- [오크밸리](https://oakvalley.co.kr/ski/introduction/realtime)
- [웰리힐리](https://www.wellihillipark.com/home/customer/webcam)
- [휘닉스 공식 API](https://phoenixhnr.co.kr/api/guide/operation/sketchMovie/pyeongchang)
- [용평](https://www.yongpyong.co.kr/kor/guide/realTimeNews/ypResortWebcam.do)
- [무주](https://www.mdysresort.com/guide/webcam.asp)
- [키로로](https://www.kiroro.co.jp/livecamera/)
- [오제이와쿠라](https://www.oze-iwakura.co.jp/ski/slopeguide/live/)
- [마루누마](https://www.marunuma.jp/winter/live/)
- [쿠사츠](https://www.932-onsen.com/common/live/)

## 영상 미등록 지도 항목

서울리조트, 스타힐 리조트, 베어스타운 리조트, 양지파인리조트, 수안보 이글밸리 스키리조트, 알프스리조트, 정선 알파인 경기장, 마식령 스키장, 양덕온천문화휴양지는 영상 주소가 등록되지 않은 위치·날씨용 지도 항목이다. 위 146개 영상 검사 수에는 포함하지 않았다.

## 배포 검증

Node 릴레이 테스트 25개, 제공처 갱신 테스트 7개, NGINX 마이그레이션 테스트 1개를 통과했다. 정적 사이트 빌드·배포도 성공했다. 비발디 재즈 상단은 실제 HTTPS 브라우저에서 640×480 영상 수신을 확인했다. HTTP 페이지 요청은 HTTPS로 301 이동하며, 기존 HTTP 릴레이는 구버전 플레이어 호환을 위해 유지한다.

## 재점검

```sh
node .github/scripts/audit_webcams.mjs --output /tmp/webcam-audit.json
```

비발디 검사는 별도 수신 결과를 `--socket-metadata`로, 이미 검증한 YouTube 결과는 `--youtube-metadata`에 JSON 파일 목록으로 제공할 수 있다. 파일을 제공하지 않은 비발디 항목은 미검사로 표시한다. YouTube 재검사에는 `yt-dlp`가 필요하다. [전체 개별 결과](webcam-audit-2026-11-19.json)에 시각과 주소, 영상 수신·갱신 결과를 기록했다.
