# from django.apps import AppConfig


# import logging
# import threading
# from django.apps import AppConfig

# logger = logging.getLogger(__name__)

# class ChatConfig(AppConfig):
#     default_auto_field = "django.db.models.BigAutoField"
#     name = "chat"

#     def ready(self):
#         # Offload language model loading to a background thread at startup
#         # so the Django server process doesn't block while PyTorch spins up.
#         def _preload_ai_models():
#             try:
#                 from .rag_service import _get_embeddings
#                 _get_embeddings()
#                 logger.info("Successfully pre-loaded HuggingFace Embeddings model into memory.")
#             except Exception as exc:
#                 logger.error("Failed to pre-load AI models: %s", exc)

#         threading.Thread(target=_preload_ai_models, daemon=True).start()


# chat/apps.py
from django.apps import AppConfig

class ChatConfig(AppConfig):
    name = "chat"

    def ready(self):
        # Pre-warm the embedding model at startup (sync-safe here,
        # ready() runs before the ASGI event loop starts)
        try:
            from .rag_service import get_embeddings   # ← was _get_embeddings
            get_embeddings()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Failed to pre-load AI models: %s", e)
