import pytest
from flask_jwt_extended import create_access_token
from backend.app import create_app
from backend.app.models.user import User

@pytest.fixture
def app():
    app = create_app({
        'TESTING': True,
        'JWT_SECRET_KEY': 'test-secret',
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
    })
    return app

@pytest.fixture
def client(app):
    return app.test_client()

def test_login_valid_credentials(mocker, client):
    # Mock DB session and User
    mock_user = User(username="testuser", password="testpass")
    mock_user.id = 1
    mock_user.is_active = True
    mocker.patch('backend.app.api.auth.db.session.query', return_value=mocker.Mock(
        filter_by=lambda **kwargs: mocker.Mock(first=lambda: mock_user)
    ))
    mocker.patch.object(User, 'check_password', return_value=True)

    response = client.post('/api/auth/login', json={
        "username": "testuser",
        "password": "testpass"
    })
    assert response.status_code == 200
    data = response.get_json()
    assert "access_token" in data
    assert "refresh_token" in data

def test_login_invalid_credentials(mocker, client):
    # Mock DB session to return a user, but password check fails
    mock_user = User(username="testuser", password="testpass")
    mock_user.id = 1
    mock_user.is_active = True
    mocker.patch('backend.app.api.auth.db.session.query', return_value=mocker.Mock(
        filter_by=lambda **kwargs: mocker.Mock(first=lambda: mock_user)
    ))
    mocker.patch.object(User, 'check_password', return_value=False)

    response = client.post('/api/auth/login', json={
        "username": "testuser",
        "password": "wrongpass"
    })
    assert response.status_code == 401
    data = response.get_json()
    assert data["msg"] == "Invalid credentials"

def test_login_inactive_user(mocker, client):
    # Mock DB session to return an inactive user
    mock_user = User(username="testuser", password="testpass")
    mock_user.id = 1
    mock_user.is_active = False
    mocker.patch('backend.app.api.auth.db.session.query', return_value=mocker.Mock(
        filter_by=lambda **kwargs: mocker.Mock(first=lambda: mock_user)
    ))
    mocker.patch.object(User, 'check_password', return_value=True)

    response = client.post('/api/auth/login', json={
        "username": "testuser",
        "password": "testpass"
    })
    assert response.status_code == 403
    data = response.get_json()
    assert data["msg"] == "User account is inactive"

@pytest.mark.parametrize("payload,expected_msg", [
    ({}, "Missing username or password"),
    ({"username": "testuser"}, "Missing username or password"),
    ({"password": "testpass"}, "Missing username or password"),
])
def test_login_missing_fields(client, payload, expected_msg):
    response = client.post('/api/auth/login', json=payload)
    assert response.status_code == 400
    data = response.get_json()
    assert data["msg"] == expected_msg

def test_logout_valid_token(mocker, client):
    # Mock DB session and User for login
    mock_user = User(username="testuser", password="testpass")
    mock_user.id = 1
    mock_user.is_active = True
    mocker.patch('backend.app.api.auth.db.session.query', return_value=mocker.Mock(
        filter_by=lambda **kwargs: mocker.Mock(first=lambda: mock_user)
    ))
    mocker.patch.object(User, 'check_password', return_value=True)

    # Login to get access token
    login_resp = client.post('/api/auth/login', json={
        "username": "testuser",
        "password": "testpass"
    })
    assert login_resp.status_code == 200
    access_token = login_resp.get_json()["access_token"]

    # Logout with valid token
    logout_resp = client.post(
        '/api/auth/logout',
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert logout_resp.status_code == 200
    data = logout_resp.get_json()
    assert data["msg"] == "Successfully logged out"

def test_logout_missing_token(client):
    # No Authorization header
    resp = client.post('/api/auth/logout')
    assert resp.status_code == 401
    data = resp.get_json()
    assert "msg" in data

# ---------------------------
# Registration Endpoint Tests
# ---------------------------

import json

def make_jwt_header(identity, app):
    with app.app_context():
        token = create_access_token(identity=str(identity))
    return {"Authorization": f"Bearer {token}"}

def test_register_admin_success(mocker, client):
    # Mock admin user in DB
    admin_user = User(username="admin", password="adminpass", is_admin=True)
    admin_user.id = 1
    mocker.patch('backend.app.api.auth.db.session.query', side_effect=[
        mocker.Mock(filter_by=lambda **kwargs: mocker.Mock(first=lambda: admin_user)),  # admin lookup
        mocker.Mock(filter_by=lambda **kwargs: mocker.Mock(first=lambda: None)),        # username check
        mocker.Mock(filter_by=lambda **kwargs: mocker.Mock(first=lambda: None)),        # email check
    ])
    mock_session = mocker.Mock()
    mocker.patch('backend.app.api.auth.db.session', mock_session)
    mocker.patch.object(mock_session, 'add')
    mocker.patch.object(mock_session, 'commit')
    mocker.patch.object(User, 'check_password', return_value=True)
    # Simulate JWT identity
    mocker.patch('backend.app.api.auth.get_jwt_identity', return_value=1)

    # Simulate valid JWT
    response = client.post(
        '/api/auth/register',
        json={"username": "newuser", "password": "newpass", "email": "new@user.com"},
        headers=make_jwt_header(1, client.application)
    )
    assert response.status_code == 201
    data = response.get_json()
    assert data["msg"] == "User registered successfully"

def test_register_non_admin_forbidden(mocker, client):
    # Mock non-admin user in DB
    user = User(username="user", password="userpass", is_admin=False)
    user.id = 2
    mocker.patch('backend.app.api.auth.db.session.query', return_value=mocker.Mock(
        filter_by=lambda **kwargs: mocker.Mock(first=lambda: user)
    ))
    mocker.patch('backend.app.api.auth.db.session', mocker.Mock())
    mocker.patch.object(User, 'check_password', return_value=True)
    mocker.patch('backend.app.api.auth.get_jwt_identity', return_value=2)

    response = client.post(
        '/api/auth/register',
        json={"username": "otheruser", "password": "otherpass", "email": "other@user.com"},
        headers=make_jwt_header(2, client.application)
    )
    assert response.status_code == 403
    data = response.get_json()
    assert data["msg"] == "Admin privileges required"

def test_register_duplicate_username(mocker, client):
    # Mock admin user and duplicate username
    admin_user = User(username="admin", password="adminpass", is_admin=True)
    admin_user.id = 1
    existing_user = User(username="existing", password="pass", is_admin=False)
    existing_user.id = 3
    # admin lookup, username exists, email does not
    mocker.patch('backend.app.api.auth.db.session.query', side_effect=[
        mocker.Mock(filter_by=lambda **kwargs: mocker.Mock(first=lambda: admin_user)),   # admin lookup
        mocker.Mock(filter_by=lambda **kwargs: mocker.Mock(first=lambda: existing_user)),# username check
        mocker.Mock(filter_by=lambda **kwargs: mocker.Mock(first=lambda: None)),         # email check
    ])
    mocker.patch('backend.app.api.auth.db.session', mocker.Mock())
    mocker.patch.object(User, 'check_password', return_value=True)
    mocker.patch('backend.app.api.auth.get_jwt_identity', return_value=1)

    response = client.post(
        '/api/auth/register',
        json={"username": "existing", "password": "pass", "email": "unique@user.com"},
        headers=make_jwt_header(1, client.application)
    )
    assert response.status_code == 400
    data = response.get_json()
    assert data["msg"] == "Username already exists"

def test_register_duplicate_email(mocker, client):
    # Mock admin user and duplicate email
    admin_user = User(username="admin", password="adminpass", is_admin=True)
    admin_user.id = 1
    existing_user = User(username="someone", password="pass", is_admin=False, email="dupe@user.com")
    existing_user.id = 4
    # admin lookup, username does not exist, email exists
    mocker.patch('backend.app.api.auth.db.session.query', side_effect=[
        mocker.Mock(filter_by=lambda **kwargs: mocker.Mock(first=lambda: admin_user)),   # admin lookup
        mocker.Mock(filter_by=lambda **kwargs: mocker.Mock(first=lambda: None)),         # username check
        mocker.Mock(filter_by=lambda **kwargs: mocker.Mock(first=lambda: existing_user)),# email check
    ])
    mocker.patch('backend.app.api.auth.db.session', mocker.Mock())
    mocker.patch.object(User, 'check_password', return_value=True)
    mocker.patch('backend.app.api.auth.get_jwt_identity', return_value=1)

    response = client.post(
        '/api/auth/register',
        json={"username": "uniqueuser", "password": "pass", "email": "dupe@user.com"},
        headers=make_jwt_header(1, client.application)
    )
    assert response.status_code == 400
    data = response.get_json()
    assert data["msg"] == "Email already exists"

@pytest.mark.parametrize("payload,expected_msg", [
    ({}, "Missing username or password"),
    ({"username": "nouser"}, "Missing username or password"),
    ({"password": "nopass"}, "Missing username or password"),
])
def test_register_missing_fields(mocker, client, payload, expected_msg):
    # Mock admin user
    admin_user = User(username="admin", password="adminpass", is_admin=True)
    admin_user.id = 1
    mocker.patch('backend.app.api.auth.db.session.query', return_value=mocker.Mock(
        filter_by=lambda **kwargs: mocker.Mock(first=lambda: admin_user)
    ))
    mocker.patch('backend.app.api.auth.db.session', mocker.Mock())
    mocker.patch.object(User, 'check_password', return_value=True)
    mocker.patch('backend.app.api.auth.get_jwt_identity', return_value=1)

    response = client.post(
        '/api/auth/register',
        json=payload,
        headers=make_jwt_header(1, client.application)
    )
    assert response.status_code == 400
    data = response.get_json()
    assert data["msg"] == expected_msg

def test_register_invalid_jwt(client):
    # No Authorization header
    resp = client.post('/api/auth/register', json={
        "username": "user", "password": "pass", "email": "user@x.com"
    })
    assert resp.status_code == 401 or resp.status_code == 422
    data = resp.get_json()
    assert "msg" in data

def test_logout_invalid_token(client):
    # Use an obviously invalid token
    resp = client.post(
        '/api/auth/logout',
        headers={"Authorization": "Bearer invalidtoken"}
    )
    assert resp.status_code == 401
    data = resp.get_json()
    assert "msg" in data

def test_logout_blacklisted_token(mocker, client):
    # Mock DB session and User for login
    mock_user = User(username="testuser", password="testpass")
    mock_user.id = 1
    mock_user.is_active = True
    mocker.patch('backend.app.api.auth.db.session.query', return_value=mocker.Mock(
        filter_by=lambda **kwargs: mocker.Mock(first=lambda: mock_user)
    ))
    mocker.patch.object(User, 'check_password', return_value=True)

    # Login to get access token
    login_resp = client.post('/api/auth/login', json={
        "username": "testuser",
        "password": "testpass"
    })
    assert login_resp.status_code == 200
    access_token = login_resp.get_json()["access_token"]

    # Logout with valid token (blacklists it)
    logout_resp = client.post(
        '/api/auth/logout',
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert logout_resp.status_code == 200

    # Try to logout again with the same (now blacklisted) token
    resp = client.post(
        '/api/auth/logout',
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert resp.status_code == 401
    data = resp.get_json()
    assert "msg" in data
def test_refresh_valid_token(mocker, client):
    """
    Test /api/auth/refresh with a valid refresh token.
    Should return 200 and a new access token.
    """
    # Mock user and login to get refresh token
    mock_user = User(username="testuser", password="testpass")
    mock_user.id = 1
    mock_user.is_active = True
    mocker.patch('backend.app.api.auth.db.session.query', return_value=mocker.Mock(
        filter_by=lambda **kwargs: mocker.Mock(first=lambda: mock_user)
    ))
    mocker.patch.object(User, 'check_password', return_value=True)

    # Login to get refresh token
    login_resp = client.post('/api/auth/login', json={
        "username": "testuser",
        "password": "testpass"
    })
    assert login_resp.status_code == 200
    refresh_token = login_resp.get_json()["refresh_token"]

    # Call refresh endpoint with valid refresh token
    resp = client.post(
        '/api/auth/refresh',
        headers={"Authorization": f"Bearer {refresh_token}"}
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert "access_token" in data
def test_refresh_expired_token(mocker, client):
    """
    Test /api/auth/refresh with an expired refresh token.
    Should return 401 and an error message.
    """
    # Mock user and login to get refresh token
    mock_user = User(username="testuser", password="testpass")
    mock_user.id = 1
    mock_user.is_active = True
    mocker.patch('backend.app.api.auth.db.session.query', return_value=mocker.Mock(
        filter_by=lambda **kwargs: mocker.Mock(first=lambda: mock_user)
    ))
    mocker.patch.object(User, 'check_password', return_value=True)

    # Login to get refresh token
    login_resp = client.post('/api/auth/login', json={
        "username": "testuser",
        "password": "testpass"
    })
    assert login_resp.status_code == 200
    refresh_token = login_resp.get_json()["refresh_token"]

    # Patch decode_token to simulate expired token error
    mocker.patch("flask_jwt_extended.view_decorators.verify_jwt_in_request", side_effect=Exception("Token has expired"))

    resp = client.post(
        '/api/auth/refresh',
        headers={"Authorization": f"Bearer {refresh_token}"}
    )
    assert resp.status_code == 401 or resp.status_code == 422
    data = resp.get_json()
    assert "msg" in data
def test_refresh_invalid_token(client):
    """
    Test /api/auth/refresh with an invalid/malformed refresh token.
    Should return 401 and an error message.
    """
    # Use an obviously invalid token
    resp = client.post(
        '/api/auth/refresh',
        headers={"Authorization": "Bearer invalidtoken"}
    )
    assert resp.status_code == 401 or resp.status_code == 422
    data = resp.get_json()
    assert "msg" in data