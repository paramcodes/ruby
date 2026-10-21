"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { searchAction, type SearchResult } from "@/app/actions/search";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

import styles from "./search-dialog.module.css";

const DEBOUNCE_MS = 250;
const MAX_QUERY_LENGTH = 200;

// A workspace-wide search triggered from the sidebar or via Cmd+K / Ctrl+K.
// The dialog own-focuses its input, debounces server calls, and renders
// results as links that close the dialog on navigation.
export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);

  // Global shortcut: Cmd+K / Ctrl+K opens the dialog from anywhere.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        handleOpenChange(true);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Reset search state when the dialog opens, and focus the input.
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setQuery("");
      setResults([]);
      setError(null);
      setLoading(false);
      // Radix portals measure after paint, so defer the focus.
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  // Debounced search: each keystroke resets the timer. A request-id guard
  // discards stale results if a newer query has already been issued.
  useEffect(() => {
    if (query.length === 0) {
      return;
    }

    const myRequest = ++requestRef.current;

    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await searchAction(query);

        if (requestRef.current !== myRequest) {
          // A newer query replaced this one; discard the stale result.
          return;
        }

        setLoading(false);

        if (result.ok) {
          setResults(result.results);
        } else if (result.error === "too-long") {
          setError("Search query is too long.");
          setResults([]);
        } else if (result.error === "unauthenticated") {
          setError("Your session has expired. Sign in again to search.");
          setResults([]);
        } else {
          setResults([]);
        }
      } catch {
        if (requestRef.current !== myRequest) {
          return;
        }

        // A rejected request must not leave the dialog stuck on "Searching…".
        setLoading(false);
        setResults([]);
        setError("Search failed. Please try again.");
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [query]);

  // Hide stale results and errors from a previous search while the current
  // query is empty, without calling setState inside the effect above.
  const visibleResults = query.length === 0 ? [] : results;
  const visibleError = query.length === 0 ? null : error;

  const hasNoResults =
    !loading &&
    visibleError === null &&
    visibleResults.length === 0 &&
    query.length > 0;

  function handleSelect(): void {
    setQuery("");
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search pages"
      description="Search your workspace pages by title and content."
      trigger={
        <Button
          aria-label="Search"
          className={styles.trigger}
          size="sm"
          variant="ghost"
        >
          <span aria-hidden="true">Search</span>
        </Button>
      }
    >
      <input
        ref={inputRef}
        aria-autocomplete="list"
        aria-label="Search pages"
        className={styles.searchInput}
        maxLength={MAX_QUERY_LENGTH}
        placeholder="Search pages..."
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {visibleError ? (
        <p className={styles.hint} role="alert">
          {visibleError}
        </p>
      ) : null}

      {loading && visibleResults.length === 0 ? (
        <p className={styles.hint}>Searching…</p>
      ) : null}

      {hasNoResults ? <p className={styles.hint}>No pages found.</p> : null}

      {visibleResults.length > 0 ? (
        <ul className={styles.results}>
          {visibleResults.map((result) => (
            <li className={styles.resultItem} key={result.id}>
              <Link
                className={styles.resultLink}
                href={`/pages/${result.id}`}
                onClick={() => handleSelect()}
              >
                <span
                  className={styles.star}
                  aria-label={result.favorited ? "Favorited" : "Not favorited"}
                >
                  {result.favorited ? "★" : "☆"}
                </span>
                <span className={styles.resultTitle}>{result.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </Dialog>
  );
}
