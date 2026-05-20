import bcrypt
import jwt
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

SECRET_KEY = os.getenv("JWT_SECRET", "cambiame-en-produccion-secret-2024")
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(user_id: str, username: str, nombre: str, roles: list[str]) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "nombre": nombre,
        "roles": roles,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def tiene_rol(user: dict, rol: str) -> bool:
    """Verifica si el usuario tiene un rol específico."""
    roles = user.get("roles", [])
    if isinstance(roles, list):
        return rol in roles
    # Compatibilidad con tokens viejos que tenían un solo string
    return roles == rol


def tiene_cualquier_rol(user: dict, roles_requeridos: list[str]) -> bool:
    """Verifica si el usuario tiene al menos uno de los roles requeridos."""
    return any(tiene_rol(user, r) for r in roles_requeridos)
