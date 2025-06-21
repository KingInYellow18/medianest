from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)

# Allow CORS for frontend dev servers (adjust origins as needed for production)
CORS(
    app,
    origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "*"
    ],
    supports_credentials=True
)

# Register API Blueprints
from backend.app.api.services import services_bp
app.register_blueprint(services_bp)

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"}), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)