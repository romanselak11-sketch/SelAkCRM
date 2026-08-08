from pydantic_settings import BaseSettings, SettingsConfigDict
import sys


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./dev.db"
    jwt_secret: str = "change-me-in-production-use-long-random-secret-32+"
    jwt_expire_hours: int = 12
    web_origin: str = "http://localhost:5173"

    license_trial_days: int = 7
    license_enforce: bool = False

    @property
    def enforce_license(self) -> bool:
        """В frozen exe гейт всегда включён; env LICENSE_ENFORCE его не выключает."""
        if getattr(sys, "frozen", False):
            return True
        return bool(self.license_enforce)


settings = Settings()
