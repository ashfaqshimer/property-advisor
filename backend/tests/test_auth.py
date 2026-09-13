from datetime import UTC, datetime, timedelta

from app.auth import _hash_session_token, hash_password
from app.models.auth import StaffSession, StaffUser


def create_staff(db_session, email="staff@example.com", password="correct horse"):
    user = StaffUser(email=email, password_hash=hash_password(password))
    db_session.add(user)
    db_session.commit()
    return user


def test_login_me_and_logout(client, seeded):
    create_staff(seeded)

    login = client.post(
        "/auth/login",
        json={"email": "staff@example.com", "password": "correct horse"},
    )

    assert login.status_code == 200
    assert login.json()["user"]["email"] == "staff@example.com"
    assert login.json()["user"]["name"] == "root"
    assert client.get("/auth/me").json()["email"] == "staff@example.com"

    assert client.post("/auth/logout").status_code == 204
    assert client.get("/auth/me").status_code == 401


def test_login_rejects_wrong_password(client, seeded):
    create_staff(seeded)

    response = client.post(
        "/auth/login",
        json={"email": "staff@example.com", "password": "wrong"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_expired_session_is_rejected(client, seeded):
    user = create_staff(seeded)
    seeded.add(
        StaffSession(
            user_id=user.id,
            token_hash=_hash_session_token("expired-token"),
            expires_at=datetime.now(UTC) - timedelta(minutes=1),
        )
    )
    seeded.commit()
    client.cookies.set("property_advisor_session", "expired-token")

    assert client.get("/auth/me").status_code == 401