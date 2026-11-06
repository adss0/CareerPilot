import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildIssuesCsv } from "./issuesCsv";
import { mergeMapping } from "./mappingMemory";
import { MappingStepView } from "./MappingStepView";
import type { ImportPreview } from "./types";
import { validateFile } from "./useImportViewModel";

const preview: ImportPreview = {
  filename: "jobs.xlsx",
  sheets: ["Jobs", "Notes"],
  sheet: "Jobs",
  headers: ["Employer", "Job Title", "E-mail"],
  sample_rows: [["Acme Ltd", "Developer", "jobs@example.com"]],
  total_rows: 3,
  fields: [
    { key: "company", label: "Company", required: true },
    { key: "role", label: "Role", required: true },
    { key: "contact_email", label: "Contact email", required: false },
  ],
  suggested_mapping: { company: "Employer", role: "Job Title", contact_email: "E-mail" },
};

describe("buildIssuesCsv", () => {
  it("escapes quotes and commas and neutralises formulas", () => {
    const csv = buildIssuesCsv([
      {
        row: 4,
        kind: "invalid",
        message: 'Missing "role", so skipped',
        company: "=cmd()",
        role: "",
      },
    ]);
    const [header, line] = csv.split("\r\n");
    expect(header).toBe("Row,Type,Company,Role,Problem");
    expect(line).toBe(`4,invalid,'=cmd(),,"Missing ""role"", so skipped"`);
  });
});

describe("mergeMapping", () => {
  const suggested = { company: "Employer", role: null, contact_email: "E-mail" };

  it("uses saved choices for columns that still exist", () => {
    const saved = { company: "Employer", role: "Job Title", contact_email: null };
    expect(mergeMapping(suggested, saved, preview.headers)).toEqual({
      company: "Employer",
      role: "Job Title",
      contact_email: null,
    });
  });

  it("ignores saved columns that are no longer in the file", () => {
    const saved = { company: "Old Column", role: "Job Title" };
    expect(mergeMapping(suggested, saved, preview.headers).company).toBe("Employer");
  });

  it("returns the suggestions when nothing is saved", () => {
    expect(mergeMapping(suggested, undefined, preview.headers)).toEqual(suggested);
  });
});

describe("validateFile", () => {
  it("accepts spreadsheets and rejects other files", () => {
    expect(validateFile(new File(["a"], "jobs.XLSX"))).toBeNull();
    expect(validateFile(new File(["a"], "notes.pdf"))).toMatch(/xlsx/);
    expect(validateFile(new File([], "jobs.csv"))).toMatch(/empty/);
  });
});

describe("MappingStepView", () => {
  const baseProps = {
    preview,
    mapping: preview.suggested_mapping,
    mappedPreview: { fields: preview.fields, rows: preview.sample_rows },
    missingRequired: [],
    duplicateColumns: [],
    canImport: true,
    isImporting: false,
    isPreviewing: false,
    onChangeSheet: vi.fn(),
    onSetFieldColumn: vi.fn(),
    onImport: vi.fn(),
    onBack: vi.fn(),
  };

  it("shows the guessed columns and imports on click", () => {
    const onImport = vi.fn();
    render(<MappingStepView {...baseProps} onImport={onImport} />);

    expect(screen.getByLabelText(/^Company/)).toHaveValue("Employer");
    expect(screen.getByText("e.g. jobs@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Import 3 rows" }));
    expect(onImport).toHaveBeenCalled();
  });

  it("blocks the import and explains why when a required column is missing", () => {
    render(
      <MappingStepView
        {...baseProps}
        mapping={{ ...preview.suggested_mapping, role: null }}
        missingRequired={["Role"]}
        canImport={false}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a column for: Role.");
    expect(screen.getByRole("button", { name: "Import 3 rows" })).toBeDisabled();
  });

  it("reports column changes", () => {
    const onSetFieldColumn = vi.fn();
    render(<MappingStepView {...baseProps} onSetFieldColumn={onSetFieldColumn} />);
    fireEvent.change(screen.getByLabelText(/^Contact email/), { target: { value: "" } });
    expect(onSetFieldColumn).toHaveBeenCalledWith("contact_email", null);
  });
});
