from django.contrib import admin

from .models import ChatMessage, ChatSession, DocumentMetadata


class ChatMessageInline(admin.TabularInline):
    model = ChatMessage
    extra = 0
    readonly_fields = ("timestamp",)


@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ("session_id", "created_at", "updated_at")
    readonly_fields = ("session_id", "created_at", "updated_at")
    inlines = [ChatMessageInline]


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ("session", "role", "short_content", "timestamp")
    list_filter = ("role", "timestamp")
    search_fields = ("content",)

    @admin.display(description="Content")
    def short_content(self, obj):
        return obj.content[:80] + "…" if len(obj.content) > 80 else obj.content


@admin.register(DocumentMetadata)
class DocumentMetadataAdmin(admin.ModelAdmin):
    list_display = ("title", "source_url", "last_updated")
    search_fields = ("title", "source_url")
