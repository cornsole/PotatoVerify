# 감자서버 보안 인증 디스코드 봇

## 설정

의존성을 설치하고 환경변수 파일을 만듭니다.

```bash
npm install
cp .env.example .env
```

`.env`의 `DISCORD_TOKEN`에 Discord 봇 토큰을 입력한 뒤 실행합니다.

```dotenv
DISCORD_TOKEN=your_discord_bot_token
```

```bash
npm start
```

`.env`는 Git에서 제외되므로 커밋하지 않습니다.

## 기존 `data.json`에서 마이그레이션

기존 `data.json`이 아래 형식이라면:

```json
{
  "token": "기존_봇_토큰"
}
```

토큰 값을 `.env`의 `DISCORD_TOKEN`으로 옮기고, 정상 실행을 확인한 다음
`data.json`을 삭제합니다. 자세한 서버 적용 순서는 배포 안내를 따르세요.
