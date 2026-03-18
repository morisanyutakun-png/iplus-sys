# iPlus Sys

教育支援アプリ。生徒の教材進捗管理・定着度入力・自動印刷キューを統合管理する。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| Frontend | Next.js 16 / React 19 / TypeScript / Tailwind CSS / Shadcn/ui |
| Backend | FastAPI / SQLAlchemy (async) / Pydantic |
| Database | PostgreSQL (asyncpg) |

## ローカル開発

```bash
# Backend
cd backend
cp .env.example .env   # DATABASE_URL 等を設定
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL を設定
npm install
npm run dev
```

---

## デプロイ

### 1. Database — Neon

1. [neon.tech](https://neon.tech) でプロジェクトを作成
2. ダッシュボードから接続文字列を取得:
   ```
   postgresql+asyncpg://<user>:<password>@<host>/<dbname>?sslmode=require
   ```
3. テーブルはアプリ起動時に自動作成される（`Base.metadata.create_all`）

### 2. Backend — Koyeb

1. [koyeb.com](https://app.koyeb.com) でアカウント作成
2. **Create Service** → **Docker** を選択
3. GitHub リポジトリを接続し、以下を設定:

| 設定 | 値 |
|------|-----|
| Dockerfile path | `backend/Dockerfile` |
| Work directory | `backend` |
| Port | `8000` |

4. 環境変数を設定:

| 変数名 | 値 |
|--------|-----|
| `DATABASE_URL` | Neon の接続文字列 |
| `CORS_ORIGINS` | `["https://<your-app>.vercel.app"]` |
| `ENVIRONMENT` | `production` |
| `MATERIALS_BASE_DIRS` | `[]` (クラウドでは不要) |

5. デプロイ実行 → `https://<service>.koyeb.app` でアクセス可能になる

### 3. Frontend — Vercel

1. [vercel.com](https://vercel.com) でアカウント作成
2. **Add New Project** → GitHub リポジトリをインポート
3. 以下を設定:

| 設定 | 値 |
|------|-----|
| Framework Preset | Next.js |
| Root Directory | `frontend` |

4. 環境変数を設定:

| 変数名 | 値 |
|--------|-----|
| `NEXT_PUBLIC_API_URL` | `https://<service>.koyeb.app` |

5. デプロイ実行

### デプロイ後の確認

```bash
# Backend ヘルスチェック
curl https://<service>.koyeb.app/ping
# => {"status":"ok"}

# Frontend
# ブラウザで https://<your-app>.vercel.app を開く
```

## 環境変数一覧

### Backend (`backend/.env`)

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `DATABASE_URL` | PostgreSQL 接続文字列 | `postgresql+asyncpg://iplus:iplus@localhost:5432/iplus` |
| `CORS_ORIGINS` | 許可オリジン (JSON配列) | `["*"]` |
| `ENVIRONMENT` | `development` / `production` | `development` |
| `PRINTER_NAME` | プリンタ名 | `Kyocera_TASKalfa_4054ci_J_` |
| `MATERIALS_BASE_DIRS` | 教材PDF格納ディレクトリ (JSON配列) | `["/Volumes/JukuShare"]` |

### Frontend (`frontend/.env.local`)

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `NEXT_PUBLIC_API_URL` | Backend API の URL | `http://localhost:8000` |
