import { useEffect, useState } from "react";
import { IconButton, MenuItem, Select, TextField, Tooltip, LinearProgress } from "@mui/material";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CornerDownLeft } from "lucide-react";
import type { ColumnSort, TableDataResponse } from "../shared/types";

type Props = {
  data: TableDataResponse | null; page: number; pageSize: number; loading: boolean;
  hidden: Record<string, boolean>; sorts: ColumnSort[];
  onPage: (page: number) => void; onSize: (size: number) => void;
  onSort: (sorts: ColumnSort[]) => void;
};

export const ReadonlyGrid = ({ data, page, pageSize, loading, hidden, sorts, onPage, onSize, onSort }: Props) => {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [jump, setJump] = useState(String(page + 1));
  useEffect(() => setJump(String(page + 1)), [page]);
  const total = data?.rowCount ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const columns = (data?.columns ?? []).filter((column) => hidden[column.name] !== false);
  const jumpNumber = Number(jump);
  const validJump = Number.isInteger(jumpNumber) && jumpNumber >= 1 && jumpNumber <= pages;
  const go = () => { if (validJump && !loading) onPage(jumpNumber - 1); };
  const text = (value: unknown) => value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return <div className="readonly-grid" aria-busy={loading}>
    <div className="grid-progress">{loading && <LinearProgress />}</div>
    <div className="table-scroll">
      <table className="data-table" style={{ width: Math.max(1, columns.reduce((sum, col) => sum + (widths[col.name] ?? 180), 0)) }}>
        <colgroup>{columns.map((col) => <col key={col.name} style={{ width: widths[col.name] ?? 180 }} />)}</colgroup>
        <thead><tr>{columns.map((col) => {
          const priority = sorts.findIndex((sort) => sort.column === col.name);
          const sort = sorts[priority];
          return <th key={col.name} scope="col" aria-sort={sort ? sort.direction === "asc" ? "ascending" : "descending" : "none"}>
            <button className="column-sort" title={`${col.name}${col.description ? `\n${col.description}` : ""}`} onClick={() => onSort([{ column: col.name, direction: sort?.direction === "asc" ? "desc" : "asc" }])}>
              <span className="column-header"><span>{col.name}</span>{col.description && <small className="muted-label">{col.description}</small>}</span>
              {sort && <span className="sort-priority">{sort.direction === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}{priority + 1}</span>}
            </button>
            <span className="column-resizer" role="separator" aria-label={`调整 ${col.name} 列宽`} aria-orientation="vertical" tabIndex={0}
              onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); setWidths((current) => ({ ...current, [col.name]: Math.max(100, (current[col.name] ?? 180) + (event.key === "ArrowRight" ? 20 : -20)) })); } }}
              onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.dataset.x = String(event.clientX); event.currentTarget.dataset.width = String(widths[col.name] ?? 180); }}
              onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) { const width = Number(event.currentTarget.dataset.width) + event.clientX - Number(event.currentTarget.dataset.x); setWidths((current) => ({ ...current, [col.name]: Math.max(100, Math.min(1000, width)) })); } }} />
          </th>;
        })}</tr></thead>
        <tbody>{data?.rows.map((row, index) => <tr key={index}>{columns.map((col) => <td key={col.name} title={text(row[col.name])}>{text(row[col.name])}</td>)}</tr>)}</tbody>
      </table>
      {!loading && !data?.rows.length && <div className="no-rows">没有数据</div>}
      {!columns.length && !!data?.rows.length && <div className="no-rows">没有显示的列</div>}
    </div>
    <div className="grid-pagination">
      <label htmlFor="page-size">每页行数</label>
      <Select id="page-size" size="small" value={pageSize} disabled={loading} inputProps={{ "aria-label": "每页行数" }} onChange={(event) => onSize(Number(event.target.value))}>
        {[50, 100, 200, 500].map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}
      </Select>
      <span>{total ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, total)} / {total}</span>
      <div className="page-buttons">
        <IconButton aria-label="首页" disabled={loading || page === 0} onClick={() => onPage(0)}><ChevronsLeft size={18} /></IconButton>
        <IconButton aria-label="上一页" disabled={loading || page === 0} onClick={() => onPage(page - 1)}><ChevronLeft size={18} /></IconButton>
        <span>{page + 1} / {pages}</span>
        <IconButton aria-label="下一页" disabled={loading || page >= pages - 1} onClick={() => onPage(page + 1)}><ChevronRight size={18} /></IconButton>
        <IconButton aria-label="末页" disabled={loading || page >= pages - 1} onClick={() => onPage(pages - 1)}><ChevronsRight size={18} /></IconButton>
      </div>
      <TextField size="small" type="number" label="页码" value={jump} error={!validJump} disabled={loading} sx={{ width: 92 }} inputProps={{ min: 1, max: pages, step: 1 }} onChange={(event) => setJump(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") go(); }} />
      <Tooltip title="跳转"><span><IconButton aria-label="跳转" disabled={loading || !validJump} onClick={go}><CornerDownLeft size={18} /></IconButton></span></Tooltip>
    </div>
  </div>;
};
