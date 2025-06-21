import os
import sys
import pytest

# Ensure project root is on the path so ``backend`` can be imported when
# running tests from other directories.
sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
)

from backend.app import create_app, db
from backend.app.models.user import User

@pytest.fixture
def app():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "test-secret",
    })

    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def admin_user(app):
    user = User(username="testuser", password="testpass", email="test@example.com", is_admin=True)
    db.session.add(user)
    db.session.commit()
    return user
