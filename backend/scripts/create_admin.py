"""Create the first staff account interactively.

Usage: uv run python -m scripts.create_admin
"""

import getpass

from sqlalchemy import select

from app.auth import hash_password
from app.db.session import SessionLocal
from app.models.auth import StaffUser


def main() -> None:
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
        db.add(StaffUser(email=email, password_hash=hash_password(password)))
        db.commit()
    print(f"Created staff account for {email}.")


if __name__ == "__main__":
    main()