cat > backend/MovAI/asgi.py << 'EOF'
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'MovAI.settings')
application = get_asgi_application()
EOF