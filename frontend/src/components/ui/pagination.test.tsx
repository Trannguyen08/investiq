import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Pagination, encodeCursor, getPaginationRange } from "./pagination";

describe("Pagination component", () => {
  it("computes standard 7-item windowing range accurately", () => {
    expect(getPaginationRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPaginationRange(1, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 10]);
    expect(getPaginationRange(4, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 10]);
    expect(getPaginationRange(5, 10)).toEqual([1, "ellipsis-start", 4, 5, 6, "ellipsis-end", 10]);
    expect(getPaginationRange(8, 10)).toEqual([1, "ellipsis-start", 6, 7, 8, 9, 10]);
    expect(getPaginationRange(10, 10)).toEqual([1, "ellipsis-start", 6, 7, 8, 9, 10]);
  });

  it("encodes offset cursor matching backend format", () => {
    expect(encodeCursor(0)).toBe("eyJvZmZzZXQiOjB9");
    expect(encodeCursor(15)).toBe("eyJvZmZzZXQiOjE1fQ");
    expect(encodeCursor(30)).toBe("eyJvZmZzZXQiOjMwfQ");
  });

  it("renders button mode with callbacks and range text", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        totalItems={40}
        pageSize={8}
        itemLabel="đợt chi trả"
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByText(/Hiển thị/)).toBeInTheDocument();
    expect(screen.getByText("9 - 16")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText(/đợt chi trả/)).toBeInTheDocument();

    const prevBtn = screen.getByRole("button", { name: "Trang trước" });
    const nextBtn = screen.getByRole("button", { name: "Trang sau →" });
    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(3);

    const page3Btn = screen.getByRole("button", { name: "Trang 3" });
    fireEvent.click(page3Btn);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("renders link mode with accessible URLs and anchor prefetching", () => {
    const getPageUrl = vi.fn((page: number) => `/test?page=${page}#target`);
    render(
      <Pagination
        currentPage={1}
        totalPages={10}
        totalItems={100}
        pageSize={10}
        itemLabel="bài viết"
        getPageUrl={getPageUrl}
      />
    );

    expect(screen.getByText("1 - 10")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();

    const nextLink = screen.getByRole("link", { name: "Trang sau →" });
    expect(nextLink).toHaveAttribute("href", "/test?page=2#target");

    const page2Link = screen.getByRole("link", { name: "Trang 2" });
    expect(page2Link).toHaveAttribute("href", "/test?page=2#target");
  });

  it("renders serializable pageUrlPattern safely for Server Component boundary", () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={10}
        totalItems={100}
        pageSize={10}
        itemLabel="bài viết"
        pageUrlPattern="/news?limit=10&page=[page]"
      />
    );

    const prevLink = screen.getByRole("link", { name: "Trang trước" });
    expect(prevLink).toHaveAttribute("href", "/news?limit=10&page=2");

    const nextLink = screen.getByRole("link", { name: "Trang sau →" });
    expect(nextLink).toHaveAttribute("href", "/news?limit=10&page=4");

    const page5Link = screen.getByRole("link", { name: "Trang 5" });
    expect(page5Link).toHaveAttribute("href", "/news?limit=10&page=5");
  });
});
