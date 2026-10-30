import { useState } from "react";
import { Button, IconButton, MenuItem, Select } from "@mui/material";
import { ArrowUp, Plus, X } from "lucide-react";
import type { ColumnMeta, ColumnSort } from "../shared/types";

export const SortPanel = ({ columns, value, onApply }: { columns: ColumnMeta[]; value: ColumnSort[]; onApply: (value: ColumnSort[]) => void }) => {
  const [draft, setDraft] = useState(value);
  const available = columns.filter((col) => !draft.some((sort) => sort.column === col.name));
  return <div className="popover-panel query-panel">
    <strong>多条件排序</strong>
    {draft.map((sort, index) => <div className="query-rule" key={index}>
      <span>{index + 1}</span>
      <Select size="small" value={sort.column} inputProps={{ "aria-label": `排序字段 ${index + 1}` }} onChange={(event) => setDraft(draft.map((item, i) => i === index ? { ...item, column: event.target.value } : item))}>
        {columns.filter((col) => col.name === sort.column || available.includes(col)).map((col) => <MenuItem key={col.name} value={col.name}>{col.name}</MenuItem>)}
      </Select>
      <Select size="small" value={sort.direction} inputProps={{ "aria-label": `排序方向 ${index + 1}` }} onChange={(event) => setDraft(draft.map((item, i) => i === index ? { ...item, direction: event.target.value as "asc" | "desc" } : item))}>
        <MenuItem value="asc">升序</MenuItem><MenuItem value="desc">降序</MenuItem>
      </Select>
      <IconButton title="提高优先级" aria-label={`提高排序 ${index + 1} 优先级`} disabled={index === 0} onClick={() => { const next = [...draft]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; setDraft(next); }}><ArrowUp size={18} /></IconButton>
      <IconButton title="删除条件" aria-label={`删除排序 ${index + 1}`} onClick={() => setDraft(draft.filter((_, i) => i !== index))}><X size={18} /></IconButton>
    </div>)}
    <Button startIcon={<Plus size={16} />} disabled={!available.length || draft.length >= 20} onClick={() => setDraft([...draft, { column: available[0].name, direction: "asc" }])}>添加排序</Button>
    <div className="popover-actions"><Button onClick={() => setDraft([])}>清除</Button><Button variant="contained" onClick={() => onApply(draft)}>应用</Button></div>
  </div>;
};
