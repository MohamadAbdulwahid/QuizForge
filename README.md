# QuizForge
Open-source multiplayer quiz platform with competitive game modes

## Environment Variables

The backend requires the following environment variables to be configured. Copy the `.env.example` file to `.env` and update the values:

```bash
cd backend
cp .env.example .env
```

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_URL` | PostgreSQL database connection URL | `postgresql://user:password@localhost:5432/quizforge` |
