from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    cors_origins: str = Field(default="http://localhost:3000,http://127.0.0.1:3000", alias="CORS_ORIGINS")
    database_url: str = Field(
        default="postgresql+psycopg://postgres:your_password@db.your-project-ref.supabase.co:5432/postgres?sslmode=require",
        alias="DATABASE_URL",
    )
    upload_dir: str = Field(default="./uploads", alias="UPLOAD_DIR")
    model_key: str = Field(default="", alias="MODEL_KEY")
    model_name: str = Field(default="claude-haiku-4-5", alias="MODEL_NAME")
    auth_provider: str = Field(default="supabase", alias="AUTH_PROVIDER")
    jwt_secret_key: str = Field(default="change-me-in-production", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=30, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=7, alias="REFRESH_TOKEN_EXPIRE_DAYS")
    supabase_jwt_secret: str = Field(default="", alias="SUPABASE_JWT_SECRET")
    supabase_jwt_audience: str = Field(default="authenticated", alias="SUPABASE_JWT_AUDIENCE")
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_anon_key: str = Field(default="", alias="SUPABASE_ANON_KEY")
    supabase_auth_timeout_seconds: int = Field(default=15, alias="SUPABASE_AUTH_TIMEOUT_SECONDS")

    @field_validator("cors_origins")
    @classmethod
    def validate_cors_origins(cls, value: str) -> str:
        if not value.strip():
            return "http://localhost:3000,http://127.0.0.1:3000"
        return value

    @model_validator(mode="after")
    def validate_auth_provider_requirements(self) -> "Settings":
        provider = self.auth_provider.strip().lower()
        if provider not in {"local", "supabase"}:
            raise ValueError("AUTH_PROVIDER must be either 'local' or 'supabase'.")

        if provider == "supabase":
            if not self.supabase_url.strip():
                raise ValueError("SUPABASE_URL is required when AUTH_PROVIDER=supabase.")
            if not self.supabase_anon_key.strip():
                raise ValueError("SUPABASE_ANON_KEY is required when AUTH_PROVIDER=supabase.")
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def sqlalchemy_database_url(self) -> str:
        url = self.database_url.strip()
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://") :]
        elif url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://") :]

        if "supabase.co" in url and "sslmode=" not in url:
            separator = "&" if "?" in url else "?"
            url = f"{url}{separator}sslmode=require"
        return url

    @property
    def supabase_jwt_issuer(self) -> str:
        if self.supabase_url.strip():
            return f"{self.supabase_url.rstrip('/')}/auth/v1"
        return ""


settings = Settings()
