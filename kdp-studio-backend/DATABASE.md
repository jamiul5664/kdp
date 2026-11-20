# KDP Studio AI — PostgreSQL Database Documentation

All 18 tables use **UUID primary keys** (`UUID`), timezone-aware **timestamps** (`created_at`, `updated_at`), **foreign keys** with cascading deletes, composite **indexes**, **JSONB** payloads for flexible per-page/workflow structures, and strict **`user_id` ownership constraints**.

| # | Table | Purpose & Key Columns |
|---|-------|-----------------------|
| 1 | `users` | Publisher accounts (`id`, `email`, `hashed_password`, `full_name`, `imprint_name`, `is_active`). |
| 2 | `conversations` | AI workspace threads owned by `user_id` with resumable `workflow_state` JSONB. |
| 3 | `messages` | Ordered chat messages with `attachments_json` and interactive `workflow_cards_json`. |
| 4 | `research_jobs` | Search job metadata (`query`, `category`, `target_audience`, `marketplace`, `celery_task_id`, `status`). |
| 5 | `research_sources` | Auditable citations (`connector_name`, `source_url`, `raw_metadata_json`, `collected_at`). |
| 6 | `niches` | Scored opportunities (`keyword`, nullable `search_volume`, `competitor_count`, `demand_score`, `competition_score`, `opportunity_score`, `evidence` JSONB, `confidence`, `source_date`). |
| 7 | `competitors` | Observed catalog listings (`title`, `asin`, `price`, `rating`, `review_count`, `bestseller_rank`, `source_url`, `collected_at`). |
| 8 | `keywords` | Keyword phrases tagged with `is_measured` vs estimated competition and `source_name`. |
| 9 | `book_projects` | Manuscripts (`user_id`, `title`, `subtitle`, `book_type`, `target_audience`, `language`, `trim_width`, `trim_height`, `page_count` [24–828 CHECK], `bleed`, `paper_type`, `status`). |
| 10 | `book_chapters` | Structured chapter outlines (`project_id`, `chapter_number` unique per project, `outline_json`). |
| 11 | `book_pages` | Independent per-page models (`project_id`, `page_number` unique per project, `content_json` JSONB, `image_asset_id`, `page_type`, `status`). |
| 12 | `book_assets` | Stored illustrations & uploads preserving `width_px`, `height_px`, `mime_type`, and `storage_key`. |
| 13 | `book_covers` | 3-panel cover specs (`front_panel_json`, `spine_panel_json`, `back_panel_json`, `calculated_spine_in`, `full_wrap_width_in`, `full_wrap_height_in`). |
| 14 | `approvals` | Mandatory human approval gates (`project_id`, `task_type`, `proposed_data` JSONB, `status`, `approved_at`). |
| 15 | `export_jobs` | Backend-confirmed print artifacts (`artifact_type`, `file_name`, `file_size_bytes`, `status`, `validation_status`, `validation_report_json`). |
| 16 | `ai_generations` | LLM token & cost accounting (`agent_name`, `provider`, `model_name`, `prompt_tokens`, `completion_tokens`, `estimated_cost_usd`). |
| 17 | `user_settings` | Per-user defaults (`theme`, `default_marketplace`, `default_trim_size`, `scoring_weights_json`). |
| 18 | `audit_logs` | Immutable security and workflow action trail (`user_id`, `action`, `entity_type`, `entity_id`, `metadata_json`). |
