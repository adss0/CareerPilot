import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BackendStatusView } from "./BackendStatusView";

describe("BackendStatusView", () => {
  it("shows online status and backend details", () => {
    render(
      <BackendStatusView
        status="online"
        version="0.1.0"
        aiProvider="gemini"
        isRefreshing={false}
        refresh={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("backend status")).toHaveTextContent("Online");
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
    expect(screen.getByText("gemini")).toBeInTheDocument();
  });

  it("explains how to start the backend when offline", () => {
    render(<BackendStatusView status="offline" isRefreshing={false} refresh={vi.fn()} />);

    expect(screen.getByLabelText("backend status")).toHaveTextContent("Offline");
    expect(screen.getByText(/uvicorn app.main:app/)).toBeInTheDocument();
  });
});
