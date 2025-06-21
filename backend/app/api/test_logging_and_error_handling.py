import pytest
from flask import Flask, jsonify
from backend.app import app as flask_app
from backend.app.utils.exceptions import ValidationError, DatabaseError
import structlog
import io
import sys
import json

@pytest.fixture
def client():
    flask_app.config["TESTING"] = True

    # Add test routes for raising exceptions
    @flask_app.route("/test/validation_error")
    def test_validation_error():
        raise ValidationError("Invalid input", code=422)

    @flask_app.route("/test/unhandled_error")
    def test_unhandled_error():
        raise ValueError("Unexpected error")

    @flask_app.route("/test/database_error")
    def test_database_error():
        raise DatabaseError("DB failure", code=5001)

    yield flask_app.test_client()

def capture_logs(func):
    """
    Helper to capture stdout logs during a function call.
    """
    def wrapper(*args, **kwargs):
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
        try:
            result = func(*args, **kwargs)
            output = sys.stdout.getvalue()
        finally:
            sys.stdout = old_stdout
        return result, output
    return wrapper

@capture_logs
def make_request(client, path):
    return client.get(path)

def parse_json_lines(log_output):
    """
    Parse JSON log lines from structlog output.
    """
    logs = []
    for line in log_output.splitlines():
        try:
            logs.append(json.loads(line))
        except Exception:
            continue
    return logs

def test_handled_validation_error(client):
    response, log_output = make_request(client, "/test/validation_error")
    assert response.status_code == 500
    data = response.get_json()
    assert data["error_type"] == "ValidationError"
    assert data["message"] == "Invalid input"
    assert "request_id" in data
    assert data["code"] == 422

    logs = parse_json_lines(log_output)
    # Find the error log
    error_logs = [l for l in logs if l.get("event") == "Unhandled exception"]
    assert error_logs, "No error log found"
    log = error_logs[0]
    assert log["error_type"] == "ValidationError"
    assert log["message"] == "Invalid input"
    assert log["code"] == 422
    assert log["request_id"] == data["request_id"]
    assert log["path"] == "/test/validation_error"
    assert log["level"] == "error"
    assert "stack_trace" in log

def test_unhandled_exception(client):
    response, log_output = make_request(client, "/test/unhandled_error")
    assert response.status_code == 500
    data = response.get_json()
    assert data["error_type"] == "ValueError"
    assert data["message"] == "Unexpected error"
    assert "request_id" in data

    logs = parse_json_lines(log_output)
    error_logs = [l for l in logs if l.get("event") == "Unhandled exception"]
    assert error_logs, "No error log found"
    log = error_logs[0]
    assert log["error_type"] == "ValueError"
    assert log["message"] == "Unexpected error"
    assert log["request_id"] == data["request_id"]
    assert log["path"] == "/test/unhandled_error"
    assert log["level"] == "error"
    assert "stack_trace" in log

def test_custom_exception_logging(client):
    response, log_output = make_request(client, "/test/database_error")
    assert response.status_code == 500
    data = response.get_json()
    assert data["error_type"] == "DatabaseError"
    assert data["message"] == "DB failure"
    assert data["code"] == 5001
    assert "request_id" in data

    logs = parse_json_lines(log_output)
    error_logs = [l for l in logs if l.get("event") == "Unhandled exception"]
    assert error_logs, "No error log found"
    log = error_logs[0]
    assert log["error_type"] == "DatabaseError"
    assert log["message"] == "DB failure"
    assert log["code"] == 5001
    assert log["request_id"] == data["request_id"]
    assert log["path"] == "/test/database_error"
    assert log["level"] == "error"

def test_no_file_logging(client, tmp_path):
    """
    Ensure that logs are not written to files.
    """
    # Make a request that triggers logging
    _, log_output = make_request(client, "/test/unhandled_error")
    # Check that no log files are created in the temp directory
    log_files = list(tmp_path.glob("*.log"))
    assert not log_files, "Log files should not be created; logging is to stdout only"