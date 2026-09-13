"""Create the first staff account interactively.

Usage: uv run python -m scripts.create_admin
"""

import getpass
import hmac

from sqlalchemy import select

from app.auth import hash_password
from app.config import get_settings
from app.db.session import SessionLocal
from app.models.auth import StaffUser
from app.schemas.auth import StaffRole


def main() -> None:
    configured_secret = get_settings().bootstrap_admin_secret
    if not configured_secret:
        raise SystemExit("BOOTSTRAP_ADMIN_SECRET is not configured.")

    supplied_secret = getpass.getpass("Bootstrap secret: ")
    if not hmac.compare_digest(supplied_secret, configured_secret):
        raise SystemExit("Invalid bootstrap secret.")

    with SessionLocal() as db:
        if db.scalar(select(StaffUser).where(StaffUser.role == StaffRole.ROOT)) is not None:
            raise SystemExit("A root account already exists. Create agents from the admin workspace.")

    email = input("Staff email: ").strip().lower()
    password = getpass.getpass("Password: ")
    confirmation = getpass.getpass("Confirm password: ")
    if not email or not password:
        raise SystemExit("Email and password are required.")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")

    with SessionLocal() as db:
        if db.scalar(select(StaffUser).where(StaffUser.email == email)) is not None:
            raise SystemExit("A staff account with that email already exists.")
        db.add(StaffUser(email=email, password_hash=hash_password(password), role="root"))
        db.commit()
    print(f"Created staff account for {email}.")


if __name__ == "__main__":
    main()