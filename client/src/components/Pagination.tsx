interface Props {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalCount, pageSize, onPageChange }: Props) {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200">
      <p className="text-xs text-slate-500">
        Showing {from}–{to} of {totalCount}
      </p>
      <div className="flex items-center gap-1">
        <button
          id="pagination-prev"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="btn-secondary px-2 py-1 text-xs disabled:opacity-40"
        >
          ← Prev
        </button>
        <span className="text-xs text-slate-500 px-2">
          {currentPage} / {totalPages}
        </span>
        <button
          id="pagination-next"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="btn-secondary px-2 py-1 text-xs disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
