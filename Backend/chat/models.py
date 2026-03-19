import uuid

from django.db import models


class ChatSession(models.Model):
    """Tracks individual user chat sessions."""

    session_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Session {self.session_id} ({self.created_at:%Y-%m-%d %H:%M})"


class ChatMessage(models.Model):
    """Stores individual messages within a chat session."""

    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"

    session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(max_length=10, choices=Role.choices)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["timestamp"]

    def __str__(self):
        return f"[{self.role}] {self.content[:50]}"


class DocumentMetadata(models.Model):
    """Tracks ingested documents for the Knowledge Base."""

    source_url = models.URLField(max_length=2048, unique=True)
    title = models.CharField(max_length=512)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Document metadata"
        ordering = ["-last_updated"]

    def __str__(self):
        return self.title



class PromptSuggestion(models.Model):
    text = models.TextField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)