"""Container entry point: one async worker, safe shutdown, no request access logs."""

import os

import uvicorn

from ai_service.core.config import get_settings


def main() -> None:
    settings = get_settings()
    missing = [
        name for name, value in (
            ("DATABASE_URL or SUPABASE_DATABASE_URL", settings.DATABASE_URL or settings.SUPABASE_DATABASE_URL),
            ("SUPABASE_URL", settings.SUPABASE_URL),
            ("BEDROCK_API_KEY", settings.BEDROCK_API_KEY),
        ) if not value
    ]
    if missing:
        raise SystemExit("Missing deployment settings: " + ", ".join(missing))
    uvicorn.run(
        "ai_service.main:app", host=settings.HOST, port=settings.PORT,
        workers=1, proxy_headers=True,
        # Only the reverse proxy may reach this container. Override for other hosts.
        forwarded_allow_ips=os.environ.get("FORWARDED_ALLOW_IPS", "127.0.0.1"),
        access_log=False, timeout_keep_alive=5, timeout_graceful_shutdown=100,
    )


if __name__ == "__main__":
    main()
