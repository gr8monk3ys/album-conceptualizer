# The Engine is stateless toward the web app

Albums live in the web app's Postgres. Every Engine call that needs an album (zip export, song development, coherence review) carries the Album snapshot in the request, and the Engine derives the Album Bible from it (`album_conceptualizer/models/snapshot.py`). We chose this over syncing albums into the Engine's own stores because a second copy would need its own consistency, ownership and deletion story, and song development and coherence review were already broken by exactly that split: the web app sent a Postgres id the Engine had never seen. The Engine's `album_id` lookup remains only for direct API users of its own album store.

Earlier ADR-style notes live in `docs/developer/architecture-decisions.md`.
