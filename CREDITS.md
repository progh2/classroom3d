# CREDITS / LICENSE

## 3D 캐릭터 (VRM) — 모두 CC0 1.0 (퍼블릭 도메인)

### 기본 출연진 (애니메 스타일) — VRoid 공식 CC0 모델

| 파일 | 원본 | 역할 | 제작 | 라이선스 |
|---|---|---|---|---|
| HairSample_Female.vrm | VRoid Studio "HairSample_Female" | 학생 (2·6·9·14번 책상) | VRoidプロジェクト (pixiv) | CC0 1.0 |
| HairSample_Male.vrm | VRoid Studio "HairSample_Male" | 학생 (3·8·11·17번), 교사 (키 1.78 m로 조정) | VRoidプロジェクト (pixiv) | CC0 1.0 |

라이선스 확인 (두 군데 모두 확인):
1. 출처 페이지 — VRoid 공식 도움말 "About the sample models" https://vroid.pixiv.help/hc/en-us/articles/4402614652569
   → "CC0 license models" 항목에 "HairSample_Male ・HairSample_Female" 명시.
2. 파일 메타 (VRM 0.x meta, 두 파일 모두): licenseName = "CC0", author = "VRoidプロジェクト",
   allowedUserName = "Everyone", commercialUssageName = "Allow".
- 다운로드: OpenGameArt "VRoid Studio CC0 Models" https://opengameart.org/content/vroid-studio-cc0-models
  (hairsample_female.zip, hairsample_male.zip)
- 수정 사항: 휴대폰 성능을 위해 내장 텍스처 해상도만 축소 (얼굴 1024, 일반 512, 노멀/스페큘러 256, 썸네일 128 px).
  메시·본은 원본 그대로. 런타임에서 상의/하의 머티리얼 색만 바꿔 인물 구분.
- 사용하지 않은 모델: AvatarSample_A~C 등 VRoid 샘플 중 CC0가 아닌 것, β 샘플(AvatarSample_D~G,
  桜田フミリヤ, 千駄ヶ谷 篠) — 메타 licenseName "Other" → 제외. Seed-san / VRM1_Constraint_Twist_Sample —
  VRM Public License 1.0 → 제외.

### 대체 출연진 (로우폴리) — `?cast=lowpoly` 로 전환

| 파일 | 원본 | 역할 | 제작 | 라이선스 | 다운로드 원본 URL (Arweave) |
|---|---|---|---|---|---|
| Kate.vrm | Avatar 038: Kate (100Avatars R1) | 학생 (2번 책상) | Polygonal Mind | CC0 1.0 | https://arweave.net/1q4IQwLQXJVS0JGSpeXlRdazmZYdwJbmLbTv7o0s5Y8 |
| Kyle.vrm | Avatar 069: Kyle (100Avatars R1) | 학생 (3번) | Polygonal Mind | CC0 1.0 | https://arweave.net/0E5wEEVl5VGCcuGVQylq3dpC3TClLR3JhuhEyhYh7NQ |
| Shiro.vrm | Avatar 058: Shiro (100Avatars R1) | 학생 (6번) | Polygonal Mind | CC0 1.0 | https://arweave.net/7skrWhSd_4mrqe-tiqMfCL746xu8UWghRh1dZm7irzM |
| Pepo.vrm | Avatar 073: Pepo (100Avatars R1) | 학생 (8번) | Polygonal Mind | CC0 1.0 | https://arweave.net/QaH2oH3i77UCBQZKJuYjn12xqe3huxVVYe3cVt5pEH8 |
| Lydia.vrm | Avatar 054: Lydia (100Avatars R1) | 학생 (9번) | Polygonal Mind | CC0 1.0 | https://arweave.net/x48D7v037irPQYG7e0vZLDV1E3x5-KookbP9-vaXvYE |
| Erika.vrm | Avatar 053: Erika (100Avatars R1) | 학생 (11번) | Polygonal Mind | CC0 1.0 | https://arweave.net/GZkfa0SNnrBWluRL_pXpakg7T3K3d4l87__wR4mD3UM |
| Samuela.vrm | Avatar 050: Samuela (100Avatars R1) | 학생 (14번) | Polygonal Mind | CC0 1.0 | https://arweave.net/4VjBzmk3iDQS0-013pUMFpFYbKGNTL4qcQ-PVwADxk4 |
| Rose.vrm | Avatar 057: Rose (100Avatars R1) | 학생 (17번) | Polygonal Mind | CC0 1.0 | https://arweave.net/Ea1KXujzJatQgCFSMzGOzp_UtHqB1pyia--U3AtkMAY |
| Bizdude.vrm | Avatar 102: Bizdude (100Avatars R2) | 교사 (교사용 스탠딩 책상) | Polygonal Mind | CC0 1.0 | https://arweave.net/k-_vw28ADGy2jPwnq02Tc98wC0Ey10Ia3JVYQ8qiaxM |

- 컬렉션: **100Avatars** by Polygonal Mind — https://github.com/PolygonalMind/100Avatars
  ("the avatars are licensed under the CC0 License model" — 개인·비영리·상업 용도 모두 자유)
- 목록·다운로드 링크 출처: Open Source Avatars 레지스트리 (ToxSam)
  https://github.com/ToxSam/open-source-avatars (data/projects.json 에서 100avatars-r1/r2 = "license": "CC0")
  https://www.opensourceavatars.com
- 각 VRM 파일 내부 메타데이터(VRM 0.x meta)도 직접 확인함:
  author = "Polygonal Mind", licenseName = "CC0", allowedUserName = "Everyone", commercialUssageName = "Allow".
- 100Avatars 파일은 원본 그대로 (수정 없음).

## 라이브러리
- three.js r186 (0.186.1) — MIT License — vendor/three/LICENSE — https://github.com/mrdoob/three.js
- @pixiv/three-vrm 3.5.5 — MIT License — vendor/three-vrm/LICENSE — https://github.com/pixiv/three-vrm

## 화면 이미지 (assets/screens/*.png)
- 직접 제작: HTML/CSS 터미널·슬라이드 목업을 헤드리스 Chromium으로 렌더링 (Ubuntu·NanumGothic 글꼴).
  실제 학생 정보 없음 (student01~18, mirim-sw 는 가상 계정·호스트명).

## 도면
- 미림마이스터고등학교 3학년 교실 겸 SW 실습실 환경 개선 — A-101 / E-101 / A-501 / A-601 / A-901 (2026-10-08 검토용 초안) 좌표 사용.

## 단일 HTML 오프라인 빌드 (classroom3d-offline.html)
- 위 three.js·three-vrm(MIT)과 HairSample_Female/Male(CC0), 화면 이미지(직접 제작)를 esbuild(MIT, 빌드 도구로만 사용)로 한 파일에 묶고 base64로 내장.
- 100Avatars 로우폴리 출연진은 용량 때문에 단일 HTML에는 넣지 않음 (site/ 폴더 버전에서 `?cast=lowpoly`).
