import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettingsView } from "./SettingsView";
import type { SettingsViewModel } from "./useSettingsViewModel";

const vm: SettingsViewModel = {
  settings: {
    provider: "gemini",
    model: "gemini-flash-latest",
    request_gap_seconds: 4,
    providers: [
      {
        name: "gemini",
        label: "Google Gemini",
        configured: false,
        model: "gemini-flash-latest",
        default_model: "gemini-flash-latest",
        setup: "Free key from aistudio → GEMINI_API_KEY",
        privacy: "Sends your text to Google.",
      },
      {
        name: "ollama",
        label: "Ollama (on your computer)",
        configured: true,
        model: "llama3.2",
        default_model: "llama3.2",
        setup: "Install Ollama",
        privacy: "Nothing leaves your machine.",
      },
    ],
  },
  isLoading: false,
  error: null,
  provider: "gemini",
  model: "gemini-flash-latest",
  gap: "4",
  isDirty: false,
  isSaving: false,
  isTesting: false,
  testResult: null,
  chooseProvider: vi.fn(),
  setModel: vi.fn(),
  setGap: vi.fn(),
  save: vi.fn(),
  test: vi.fn(),
};

describe("SettingsView", () => {
  it("shows which providers are set up and how to set them up", () => {
    render(<SettingsView {...vm} />);
    expect(screen.getByText("Not set up")).toBeInTheDocument();
    expect(screen.getByText("No key needed")).toBeInTheDocument();
    expect(screen.getByText(/GEMINI_API_KEY/)).toBeInTheDocument();
    expect(screen.getByText("Nothing leaves your machine.")).toBeInTheDocument();
  });

  it("chooses a provider and tests the connection", () => {
    render(<SettingsView {...vm} />);
    fireEvent.click(screen.getByRole("radio", { name: /Ollama/ }));
    expect(vm.chooseProvider).toHaveBeenCalledWith("ollama");
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    expect(vm.test).toHaveBeenCalled();
  });

  it("shows the test result", () => {
    render(
      <SettingsView
        {...vm}
        testResult={{
          ok: false,
          message: "Ollama isn't running.",
          provider: "ollama",
          model: "llama3.2",
        }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Ollama isn't running.");
  });
});
