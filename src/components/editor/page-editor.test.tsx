import {
  cleanup,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { requestAppNavigation } from "@/components/navigation-guard";

import type { EditorDocument } from "./editor-adapter";
import type { EditorSaveResult, SavePageContent } from "./page-editor";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

vi.mock("./editor-canvas", () => {
  function makeDocument(text: string) {
    return {
      schemaVersion: 1,
      content: [
        {
          id: "paragraph-1",
          type: "paragraph",
          props: {},
          content: [{ type: "text", text, styles: {} }],
          children: []
        }
      ]
    };
  }

  return {
    EditorCanvas: ({
      initialDocument,
      onChange
    }: {
      initialDocument: unknown;
      onChange: (document: EditorDocument) => void;
    }) => (
      <div>
        <output data-testid="editor-document">
          {JSON.stringify(initialDocument)}
        </output>
        <button
          onClick={() =>
            onChange(makeDocument("first draft") as EditorDocument)
          }
          type="button"
        >
          Type first
        </button>
        <button
          onClick={() =>
            onChange(makeDocument("second draft") as EditorDocument)
          }
          type="button"
        >
          Type second
        </button>
      </div>
    )
  };
});

import { PageEditor } from "./page-editor";

afterEach(cleanup);

const initialDocument: EditorDocument = { schemaVersion: 1, content: [] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

function saved(revision: number): EditorSaveResult {
  return {
    status: "saved",
    revision,
    updatedAt: "2026-10-21T12:00:00.000Z"
  };
}

let saveContent: Mock<SavePageContent>;

beforeEach(() => {
  saveContent = vi.fn<SavePageContent>();
  push.mockReset();
});

async function renderEditor(delay = 10) {
  render(
    <PageEditor
      autosaveDelayMs={delay}
      initialDocument={initialDocument}
      initialRevision={0}
      pageId="page-1"
      saveContent={saveContent}
    />
  );

  await screen.findByTestId("editor-document");
}

describe("PageEditor autosave", () => {
  it("debounces changes into one save with the latest document", async () => {
    saveContent.mockResolvedValue(saved(1));
    const user = userEvent.setup();
    await renderEditor(500);

    await user.click(screen.getByRole("button", { name: "Type first" }));
    await user.click(screen.getByRole("button", { name: "Type second" }));

    expect(saveContent).not.toHaveBeenCalled();

    await waitFor(() => expect(saveContent).toHaveBeenCalledTimes(1), {
      timeout: 2_000
    });

    expect(saveContent).toHaveBeenCalledWith(
      "page-1",
      expect.objectContaining({ schemaVersion: 1 }),
      0
    );
    expect(saveContent.mock.calls[0]?.[1]).toHaveProperty(
      "content.0.content.0.text",
      "second draft"
    );

    await waitFor(() =>
      expect(screen.getByTestId("save-status")).toHaveAttribute(
        "data-status",
        "saved"
      )
    );
  });

  it("does not let an older response overwrite newer content", async () => {
    const firstSave = deferred<EditorSaveResult>();
    const secondSave = deferred<EditorSaveResult>();
    saveContent
      .mockReturnValueOnce(firstSave.promise)
      .mockReturnValueOnce(secondSave.promise);

    const user = userEvent.setup();
    await renderEditor(10);

    await user.click(screen.getByRole("button", { name: "Type first" }));
    await waitFor(() => expect(saveContent).toHaveBeenCalledTimes(1));
    expect(saveContent.mock.calls[0]?.[2]).toBe(0);

    await user.click(screen.getByRole("button", { name: "Type second" }));
    expect(saveContent).toHaveBeenCalledTimes(1);

    // Let the second debounce timer fire while the first request is still in
    // flight, so the older response is followed by the latest draft.
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(saveContent).toHaveBeenCalledTimes(1);

    firstSave.resolve(saved(1));

    await waitFor(() => expect(saveContent).toHaveBeenCalledTimes(2));
    expect(saveContent.mock.calls[1]?.[2]).toBe(1);
    expect(saveContent.mock.calls[1]?.[1]).toHaveProperty(
      "content.0.content.0.text",
      "second draft"
    );
    expect(screen.getByTestId("editor-document")).toHaveTextContent(
      "second draft"
    );
    expect(screen.getByTestId("save-status")).toHaveAttribute(
      "data-status",
      "saving"
    );

    secondSave.resolve(saved(2));

    await waitFor(() =>
      expect(screen.getByTestId("save-status")).toHaveAttribute(
        "data-status",
        "saved"
      )
    );
  });

  it("keeps the document and retries after a failed save", async () => {
    saveContent
      .mockResolvedValueOnce({
        status: "failed",
        message: "Network down."
      })
      .mockResolvedValueOnce(saved(1));

    const user = userEvent.setup();
    await renderEditor();

    await user.click(screen.getByRole("button", { name: "Type first" }));

    await waitFor(() =>
      expect(screen.getByTestId("save-status")).toHaveAttribute(
        "data-status",
        "error"
      )
    );
    expect(screen.getByTestId("save-status")).toHaveTextContent(
      "Network down."
    );
    expect(screen.getByTestId("editor-document")).toHaveTextContent(
      "first draft"
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(saveContent).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByTestId("save-status")).toHaveAttribute(
        "data-status",
        "saved"
      )
    );
  });

  it("keeps the local draft and requires confirmation before overwriting a conflict", async () => {
    saveContent
      .mockResolvedValueOnce({ status: "conflict", currentRevision: 4 })
      .mockResolvedValueOnce(saved(5));

    const user = userEvent.setup();
    await renderEditor();

    await user.click(screen.getByRole("button", { name: "Type first" }));

    const conflict = await screen.findByRole("alert");
    expect(conflict).toHaveTextContent("This page changed in another tab.");
    expect(screen.getByTestId("editor-document")).toHaveTextContent(
      "first draft"
    );
    expect(saveContent).toHaveBeenCalledTimes(1);

    await user.click(
      within(conflict).getByRole("button", { name: "Overwrite saved version" })
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Overwrite the saved version?"
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Overwrite saved version" })
    );

    await waitFor(() => expect(saveContent).toHaveBeenCalledTimes(2));
    expect(saveContent.mock.calls[1]?.[2]).toBe(4);
    expect(saveContent.mock.calls[1]?.[1]).toHaveProperty(
      "content.0.content.0.text",
      "first draft"
    );
  });
});

describe("PageEditor dirty navigation", () => {
  it("warns before leaving and can stay or leave explicitly", async () => {
    saveContent.mockResolvedValue(saved(1));
    const user = userEvent.setup();

    render(
      <>
        <a href="/other-page">Other page</a>
        <PageEditor
          autosaveDelayMs={10_000}
          initialDocument={initialDocument}
          initialRevision={0}
          pageId="page-1"
          saveContent={saveContent}
        />
      </>
    );

    await screen.findByTestId("editor-document");
    await user.click(screen.getByRole("button", { name: "Type first" }));

    await user.click(screen.getByRole("link", { name: "Other page" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Leave with unsaved edits?"
    });
    expect(dialog).toHaveTextContent("your unsaved edits will be lost");

    await user.click(
      within(dialog).getByRole("button", { name: "Stay on this page" })
    );
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByRole("link", { name: "Other page" }));
    const secondDialog = await screen.findByRole("dialog", {
      name: "Leave with unsaved edits?"
    });
    await user.click(
      within(secondDialog).getByRole("button", {
        name: "Leave and discard edits"
      })
    );

    expect(push).toHaveBeenCalledWith("/other-page");
  });

  it("warns before programmatic navigation while dirty", async () => {
    saveContent.mockResolvedValue(saved(1));
    const user = userEvent.setup();
    await renderEditor(10_000);

    await user.click(screen.getByRole("button", { name: "Type first" }));

    expect(requestAppNavigation("/created-page")).toBe(false);

    const dialog = await screen.findByRole("dialog", {
      name: "Leave with unsaved edits?"
    });
    expect(dialog).toHaveTextContent("your unsaved edits will be lost");

    await user.click(
      within(dialog).getByRole("button", {
        name: "Leave and discard edits"
      })
    );

    expect(push).toHaveBeenCalledWith("/created-page");
  });

  it("asks the browser to warn on unload while dirty", async () => {
    saveContent.mockResolvedValue(saved(1));
    const user = userEvent.setup();
    await renderEditor(10_000);

    await user.click(screen.getByRole("button", { name: "Type first" }));

    const unload = new Event("beforeunload", { cancelable: true });
    const allowed = window.dispatchEvent(unload);

    expect(allowed).toBe(false);
  });
});
