from .models import DocumentMetadata

def get_document_count():
    count = DocumentMetadata.objects.count()
    return f"There are currently {count} documents in the knowledge base."

def list_documents():
    docs = DocumentMetadata.objects.all()
    if not docs:
        return "No documents are currently stored."

    names = [d.title for d in docs]
    return "Documents in the knowledge base:\n\n" + "\n".join(names)