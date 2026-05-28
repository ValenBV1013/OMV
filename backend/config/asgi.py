"""
ASGI config for config project.

Expone el application de Django + Channels para WebSockets.
"""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

django_asgi_app = get_asgi_application()

# Importar después de Django setup para evitar circular imports
from channels.routing import ProtocolTypeRouter, URLRouter
from MovAI.routing import websocket_urlpatterns

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": URLRouter(websocket_urlpatterns),
    }
)
