from django.urls import path

from . import views

app_name = "chat"

urlpatterns = [
    path("chat/", views.chat_page, name="chat_page"),
    path("chat/stream/", views.chat_stream, name="chat_stream"),
    # path("upload/", views.upload_pdf_api, name="upload_pdf"),
    path("upload/", views.upload_pdf_api, name="upload_pdf"),
    path("api/documents/", views.list_documents, name="list_documents"),
    path("api/documents/<int:doc_id>/", views.delete_document, name="delete_document"),
    path("api/models/", views.list_models, name="list_models"),
    path("api/kb-prompts/", views.kb_prompt_suggestions),
    path("api/context-k-config/", views.context_k_config),
]
