# Getting Started

Welcome to VoxDei — a minimal publishing system that runs entirely from static files
hosted on GitHub Pages. No database, no backend, no build step.

## How It Works

Articles are plain Markdown files stored in `/content/`. An index file, `articles.json`,
lists all articles with their title and a short description. The browser fetches them
on demand and renders them locally.

Everything is cached by the service worker so the site works offline after the first visit.

## Writing an Article

Create a `.md` file in `/content/` and add an entry to `articles.json`:

```json
{
  "id": "my-article",
  "title": "My Article",
  "description": "A short description shown in the preview."
}
```

The file must be named `{id}.md`. Use standard Markdown: headings, bold, code blocks,
links, lists — it all renders. The first `#` heading becomes the article title in the reader.

## Section Links

Every `##` heading in your article automatically becomes a linkable section anchor.
The slug is derived from the heading text: spaces become hyphens, special characters
are stripped, everything is lowercased.

To link directly to a section, use the hash format:

```
/#getting-started/section-links
```

This lets you share deep links to specific parts of a long article.

## Offline Use

After your first visit, all pages and articles are cached locally. If you come back
without an internet connection, everything still works.

The **Refresh** button in the top-right corner downloads fresh content from the server.
If the server is unavailable at the time you click it, your cached content is left
untouched — nothing is lost.

## Navigation

- Click any article thumbnail to open it.
- Click the **back arrow** to return to the article list.
- Use the browser back button or swipe gesture as you normally would.
- Append `/#{id}` to jump directly to an article.
- Append `/#{id}/{section}` to jump to a specific section.
