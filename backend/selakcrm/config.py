from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./dev.db"
    jwt_secret: str = "change-me-in-production-use-long-random-secret-32+"
    jwt_expire_hours: int = 12
    web_origin: str = "http://localhost:5173"


settings = Settings()
