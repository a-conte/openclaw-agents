# MemoClaw API Reference

HTTP endpoint documentation for direct API access. Most agents should use the CLI instead (see SKILL.md).

### Store a memory

```
POST /v1/store
```

```json
{
  "content": "User prefers dark mode and minimal notifications",
  "metadata": {"tags": ["preferences", "ui"]},
  "importance": 0.8,
  "namespace": "project-alpha",
  "memory_type": "preference",
  "expires_at": "2026-06-01T00:00:00Z",
  "immutable": false
}
```

Fields:
- `content` (required): Max 8192 characters
- `metadata.tags`: Array of strings, max 10
- `importance`: Float 0-1 (default: 0.5)
- `namespace`: default: "default"
- `memory_type`: correction|preference|decision|project|observation|general
- `pinned`: Boolean - exempt from decay
- `immutable`: Boolean - cannot be updated or deleted

### Store batch

```
POST /v1/store/batch
```

Max 100 memories per batch.

### Recall memories

```
POST /v1/recall
```

```json
{
  "query": "what are the user's editor preferences?",
  "limit": 5,
  "min_similarity": 0.7,
  "namespace": "project-alpha",
  "filters": {
    "tags": ["preferences"],
    "after": "2025-01-01",
    "memory_type": "preference"
  }
}
```

### List memories

```
GET /v1/memories?limit=20&offset=0&namespace=project-alpha
```

### Update memory

```
PATCH /v1/memories/{id}
```

### Get single memory

```
GET /v1/memories/{id}
```

### Delete memory

```
DELETE /v1/memories/{id}
```

### Bulk delete

```
POST /v1/memories/bulk-delete
```

### Ingest

```
POST /v1/ingest
```

Extract + dedup + relate from raw text or conversation messages.

### Extract facts

```
POST /v1/memories/extract
```

### Consolidate

```
POST /v1/memories/consolidate
```

### Suggested

```
GET /v1/suggested?limit=5&category=stale
```

Categories: stale, fresh, hot, decaying

### Memory relations

```
POST /v1/memories/:id/relations
GET /v1/memories/:id/relations
DELETE /v1/memories/:id/relations/:relationId
```

Relation types: related_to, derived_from, contradicts, supersedes, supports

### Context

```
POST /v1/context
```

Build LLM-ready context block from memories.

### Search (full-text)

```
POST /v1/search
```

Free BM25 keyword search.

### Core memories

```
GET /v1/core-memories?limit=10
```

Free. Returns highest importance + pinned memories.

### Export

```
GET /v1/export?format=json&namespace=default
```

Formats: json, csv, markdown

### Namespaces

```
GET /v1/namespaces
```

### Stats

```
GET /v1/stats
```

### Count

```
GET /v1/memories/count?namespace=default
```

### Import

```
POST /v1/import
```

### History

```
GET /v1/memories/{id}/history
```

### Graph

```
GET /v1/memories/{id}/graph?depth=2&limit=50
```
