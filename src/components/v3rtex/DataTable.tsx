import { useMemo, useState, type ReactNode } from "react";
import { ArrowDownUp, ArrowDown, ArrowUp, Search } from "lucide-react";
import { EmptyState } from "./ui";

export type Column<T> = {
  /** Stable id; also used as the sort-selector option value. */
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** If provided, this column is sortable (selector + clickable header). */
  sortValue?: (row: T) => string | number | null | undefined;
  /** Text contributed by this column to the free-text search. */
  searchText?: (row: T) => string;
  headerClassName?: string;
  cellClassName?: string;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => string | number;
  searchPlaceholder?: string;
  emptyTitle?: string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  /** Extra controls rendered in the toolbar (e.g. dropdown filters). */
  extraControls?: ReactNode;
  /** Max table body height (scrolls). e.g. "400px" or "60vh". */
  maxHeight?: string;
  initialSort?: { columnId: string; dir: "asc" | "desc" };
};

function compare(a: string | number | null | undefined, b: string | number | null | undefined): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

export function DataTable<T>({
  columns, rows, rowKey, searchPlaceholder = "Search…", emptyTitle = "No rows to display.",
  onRowClick, rowClassName, extraControls, maxHeight = "60vh", initialSort,
}: Props<T>) {
  const [q, setQ] = useState("");
  const sortableCols = columns.filter((c) => c.sortValue);
  const [sortId, setSortId] = useState<string>(initialSort?.columnId ?? "");
  const [dir, setDir] = useState<"asc" | "desc">(initialSort?.dir ?? "asc");

  const searchCols = columns.filter((c) => c.searchText);

  const processed = useMemo(() => {
    let out = rows;
    if (q.trim() && searchCols.length) {
      const needle = q.toLowerCase();
      out = out.filter((row) => searchCols.some((c) => (c.searchText!(row) ?? "").toLowerCase().includes(needle)));
    }
    const sortCol = columns.find((c) => c.id === sortId);
    if (sortCol?.sortValue) {
      out = [...out].sort((a, b) => {
        const r = compare(sortCol.sortValue!(a), sortCol.sortValue!(b));
        return dir === "asc" ? r : -r;
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sortId, dir, columns]);

  const toggleSort = (id: string) => {
    if (sortId === id) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortId(id); setDir("asc"); }
  };

  return (
    <div>
      <div className="flex gap-2 items-center flex-wrap mb-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]"
          />
        </div>
        {sortableCols.length > 0 && (
          <div className="flex items-center gap-1">
            <select
              value={sortId}
              onChange={(e) => { setSortId(e.target.value); if (!e.target.value) setDir("asc"); }}
              className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]"
              title="Sort by"
            >
              <option value="">Sort: none</option>
              {sortableCols.map((c) => (
                <option key={c.id} value={c.id}>Sort: {typeof c.header === "string" ? c.header : c.id}</option>
              ))}
            </select>
            <button
              onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}
              disabled={!sortId}
              title={dir === "asc" ? "Ascending" : "Descending"}
              className="p-1.5 border border-border rounded bg-[var(--surface)] hover:bg-muted disabled:opacity-40"
            >
              {!sortId ? <ArrowDownUp size={13} /> : dir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
            </button>
          </div>
        )}
        {extraControls}
        <div className="text-xs text-muted-foreground mono tabular-nums whitespace-nowrap">{processed.length} / {rows.length}</div>
      </div>

      {processed.length === 0 ? (
        <EmptyState title={emptyTitle} />
      ) : (
        <div className="overflow-auto border border-border rounded-lg" style={{ maxHeight }}>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border sticky top-0 bg-[var(--surface)] z-10">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.id}
                    onClick={c.sortValue ? () => toggleSort(c.id) : undefined}
                    className={`p-3 text-left font-medium ${c.sortValue ? "cursor-pointer select-none hover:text-foreground" : ""} ${c.headerClassName ?? ""}`}
                  >
                    {c.header}
                    {c.sortValue && sortId === c.id ? <span className="opacity-60 ml-1">{dir === "asc" ? "↑" : "↓"}</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {processed.map((row, i) => (
                <tr
                  key={rowKey(row, i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-border last:border-0 hover:bg-muted/50 ${onRowClick ? "cursor-pointer" : ""} ${rowClassName?.(row) ?? ""}`}
                >
                  {columns.map((c) => (
                    <td key={c.id} className={`p-3 ${c.cellClassName ?? ""}`}>{c.cell(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
