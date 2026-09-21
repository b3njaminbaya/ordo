import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { dateOnly, fmtDuration, fmtElapsed, localToIso, parseDueDate, toLocalDateInput, toLocalTimeInput } from "../utils/time";
import { errorMessage } from "../api/errors";
import { Modal } from "../components/ui/modal";

describe("time utils", () => {
  it("formats durations", () => {
    expect(fmtDuration(0)).toBe("0m");
    expect(fmtDuration(59 * 60)).toBe("59m");
    expect(fmtDuration(3600)).toBe("1h");
    expect(fmtDuration(3600 + 25 * 60)).toBe("1h 25m");
    expect(fmtElapsed(3725)).toBe("01:02:05");
  });

  it("round-trips local date/time inputs through UTC without drifting", () => {
    const original = new Date(2026, 6, 10, 9, 30);          // local 09:30
    const iso = localToIso(toLocalDateInput(original), toLocalTimeInput(original));
    expect(new Date(iso).getTime()).toBe(original.getTime());
    expect(iso.endsWith("Z")).toBe(true);
  });

  it("never shifts a due date by a day", () => {
    expect(dateOnly("2026-12-31T00:00:00")).toBe("2026-12-31");
    const d = parseDueDate("2026-12-31T00:00:00");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 11, 31]);
    expect(parseDueDate(null)).toBeNull();
  });
});

describe("errorMessage", () => {
  it("prefers the server's message, then the fallback, then a connectivity hint", () => {
    expect(errorMessage({ response: { data: { error: "Nope" } } })).toBe("Nope");
    expect(errorMessage({ response: { data: {} } }, "Fallback")).toBe("Fallback");
    expect(errorMessage(new Error("Network Error"))).toMatch(/can't reach the server/i);
  });
});

afterEach(() => { document.body.style.overflow = ""; });

function Harness({ onClose }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal open={open} onClose={() => { onClose?.(); setOpen(false); }} title="Edit thing">
        <input aria-label="First" />
        <button>Last</button>
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("is a labelled dialog that focuses its first field and restores focus on close", () => {
    render(<Harness />);
    const opener = screen.getByText("Open");
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Edit thing" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("First")).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("keeps Tab inside the dialog", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Open"));
    const last = screen.getByText("Last");
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByLabelText("Close")).toHaveFocus();      // wrapped to the first control
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();                                 // and back to the last
  });

  it("restores page scrolling when closed", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Open"));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.body.style.overflow).toBe("");
  });

  it("gives every dialog a unique title id", () => {
    render(<><Harness /><Harness /></>);
    fireEvent.click(screen.getAllByText("Open")[0]);
    fireEvent.click(screen.getAllByText("Open")[1]);
    const ids = screen.getAllByRole("dialog").map((d) => d.getAttribute("aria-labelledby"));
    expect(new Set(ids).size).toBe(2);
  });
});
