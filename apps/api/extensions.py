"""
Shared extension objects — initialized with the app in app.py via init_app().
Import from here in blueprints to avoid circular imports.
"""
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=[])
