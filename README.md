# 감자서버 보안 인증 Discord 봇

Minecraft 계정과 Discord 사용자를 SQLite에 연결해 관리하는 인증 봇입니다.

## 설정 및 실행

Node.js 22.5 이상이 필요합니다. 의존성을 설치하고 환경변수 파일을 만듭니다.

```bash
npm install
cp .env.example .env
```

`.env`에 Discord 봇 토큰, 서버 ID와 역할 ID를 입력한 뒤 실행합니다.

```bash
npm start
```

봇이 시작되면 지정한 서버에 슬래시 명령어가 자동 등록됩니다. Discord Developer Portal의 Bot 설정에서 **Server Members Intent**를 활성화해야 합니다. 봇에는 역할 관리 권한이 있어야 하며, 봇 역할은 인증 역할과 미인증 역할보다 위에 있어야 합니다.

## 슬래시 명령어

- `/인증 닉네임`: Minecraft 계정을 인증합니다.
- `/수동등록 사용자 닉네임`: 관리자가 사용자를 수동 등록합니다.
- `/인증조회 [사용자] [uuid]`: 관리자가 저장된 인증 정보를 조회합니다.
- `/전송 내용`: 관리자가 현재 채널에 봇 메시지를 전송합니다.

관리자 명령은 `ADMIN_ROLE_ID` 역할 또는 Discord의 관리자 권한을 가진 사용자만 실행할 수 있습니다.

## 데이터 저장과 이전

인증 정보는 기본적으로 `user-data.sqlite`의 `users` 테이블에 저장됩니다. Minecraft UUID와 Discord ID는 각각 중복될 수 없습니다. 최초 인증 일시와 마지막 인증 일시는 UTC ISO 형식으로 기록되고 화면에는 한국 시간으로 표시됩니다.

시작할 때 기존 `user-data.json`이 있으면 유효한 Minecraft UUID와 Discord 숫자 ID가 들어 있는 행만 자동 이전합니다. 이전된 JSON은 자동 삭제하지 않습니다.
