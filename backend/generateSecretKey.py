import os
import secrets
secret_key = secrets.token_hex(32)
env_path = os.path.join(os.path.dirname(__file__), ".env")


with open(env_path, "w") as f:
    f.write(f"SECRET_KEY={secret_key}\n")
