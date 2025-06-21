from backend.app.models.user import User
from backend.app import db

def test_login_success(client, admin_user):
    resp = client.post('/api/auth/login', json={"username": "testuser", "password": "testpass"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert "access_token" in data
    assert "refresh_token" in data

def test_login_invalid_password(client, admin_user):
    resp = client.post('/api/auth/login', json={"username": "testuser", "password": "wrong"})
    assert resp.status_code == 401


def test_register_new_user(client, admin_user):
    # login admin to get token
    login_resp = client.post('/api/auth/login', json={"username": "testuser", "password": "testpass"})
    access_token = login_resp.get_json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    resp = client.post('/api/auth/register', json={"username": "newuser", "password": "newpass"}, headers=headers)
    assert resp.status_code == 201
    assert db.session.query(User).filter_by(username="newuser").count() == 1


def test_refresh_flow(client, admin_user):
    login_resp = client.post('/api/auth/login', json={"username": "testuser", "password": "testpass"})
    refresh_token = login_resp.get_json()["refresh_token"]

    resp = client.post('/api/auth/refresh', headers={"Authorization": f"Bearer {refresh_token}"})
    assert resp.status_code == 200
    assert "access_token" in resp.get_json()


def test_logout(client, admin_user):
    login_resp = client.post('/api/auth/login', json={"username": "testuser", "password": "testpass"})
    access_token = login_resp.get_json()["access_token"]

    resp = client.post('/api/auth/logout', headers={"Authorization": f"Bearer {access_token}"})
    assert resp.status_code == 200

