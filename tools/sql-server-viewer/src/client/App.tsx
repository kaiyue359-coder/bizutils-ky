import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Popover,
  Select,
  TextField,
  Tooltip
} from "@mui/material";
import {
  Columns3,
  Database,
  Filter,
  Grid2X2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X
} from "lucide-react";
import type { ColumnSort, DatabaseNode, TableDataResponse, TableNode } from "../shared/types";
import { ReadonlyGrid } from "./ReadonlyGrid";
import { SortPanel } from "./SortPanel";
import { activateDataSource, fetchDataSources, fetchMetadata, fetchTableData, type DataSource } from "./api";


const Description = ({ text }: { text?: string | null }) =>
  text ? <div className="muted-label">{text}</div> : null;

const NodeText = ({ name, description }: { name: string; description?: string | null }) => (
  <Tooltip
    arrow
    enterDelay={450}
    placement="right"
    title={
      <div className="node-tooltip">
        <strong>{name}</strong>
        {description ? <span>{description}</span> : null}
      </div>
    }
  >
    <span className="node-text">
      <strong>{name}</strong>
      <Description text={description} />
    </span>
  </Tooltip>
);

const operatorLabels: Record<string, string> = { contains: "包含", equals: "等于", startsWith: "开头是", gt: "大于", gte: "大于等于", lt: "小于", lte: "小于等于", isEmpty: "为空" };

export const App = () => {
  const [databases, setDatabases] = useState<DatabaseNode[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [activeDataSource, setActiveDataSource] = useState<DataSource["id"] | null>(null);
  const [switchingDataSource, setSwitchingDataSource] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(354);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["order_data", "device_management"]));
  const [activeTable, setActiveTable] = useState<TableNode | null>(null);
  const [metadataSearch, setMetadataSearch] = useState("");
  const [dataSearch, setDataSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [sortModel, setSortModel] = useState<ColumnSort[]>([]);
  const [columnVisibilityModel, setColumnVisibilityModel] = useState<Record<string, boolean>>({});
  const [sortAnchor, setSortAnchor] = useState<HTMLButtonElement | null>(null);
  const requestVersion = useRef(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [columnsAnchor, setColumnsAnchor] = useState<HTMLButtonElement | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<HTMLButtonElement | null>(null);
  const [filterColumn, setFilterColumn] = useState("");
  const [filterOperator, setFilterOperator] = useState("contains");
  const [filterValue, setFilterValue] = useState("");
  const [filters, setFilters] = useState<Array<{ column: string; operator: string; value?: string }>>([]);
  const [tableData, setTableData] = useState<TableDataResponse | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMetadata = async (resetTable = false) => {
    setLoadingMetadata(true);
    setError(null);
    try {
      const result = await fetchMetadata();
      setDatabases(result.databases);
      const tables = result.databases.flatMap((database) => database.tables);
      const preferredTable = tables.find((table) => table.name === "order_items") ?? tables[0] ?? null;
      setActiveTable((current) => (resetTable || !current ? preferredTable : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metadata.");
    } finally {
      setLoadingMetadata(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const result = await fetchDataSources();
        setDataSources(result.sources);
        setActiveDataSource(result.activeId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data sources.");
      }
      await loadMetadata(true);
    })();
  }, []);

  const handleDataSourceChange = async (nextId: DataSource["id"]) => {
    if (nextId === activeDataSource) return;
    setSwitchingDataSource(true);
    setError(null);
    try {
      const result = await activateDataSource(nextId);
      setActiveDataSource(result.activeId);
      setActiveTable(null);
      setTableData(null);
      setPage(0);
      setSortModel([]);
      setFilters([]);
      setFilterColumn("");
      setDataSearch("");
      setSearchTerm("");
      setColumnVisibilityModel({});
      await loadMetadata(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch data source.");
    } finally {
      setSwitchingDataSource(false);
    }
  };

  useEffect(() => {
    if (!isResizingSidebar) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const nextWidth = Math.min(Math.max(event.clientX, 280), 620);
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
    };

    document.body.classList.add("is-resizing-sidebar");
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.classList.remove("is-resizing-sidebar");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingSidebar]);

  const loadRows = async () => {
    if (!activeTable) {
      return;
    }
    setLoadingRows(true);
    const version = ++requestVersion.current;
    setError(null);
    try {
      const result = await fetchTableData({
        database: activeTable.database,
        schema: activeTable.schema,
        table: activeTable.name,
        page: page + 1,
        pageSize,
        search: searchTerm,
        sorts: sortModel,
        filters
      });
      if (version !== requestVersion.current) return;
      setTableData(result);
      setPage(result.page - 1);
      setPageSize(result.pageSize);
    } catch (err) {
      if (version !== requestVersion.current) return;
      setError(err instanceof Error ? err.message : "Failed to load table data.");
    } finally {
      if (version === requestVersion.current) setLoadingRows(false);
    }
  };

  useEffect(() => {
    void loadRows();
    return () => { requestVersion.current++; };
  }, [activeTable, page, pageSize, sortModel, filters, searchTerm]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPage(0);
      setSearchTerm(dataSearch);
    }, 280);
    return () => window.clearTimeout(handle);
  }, [dataSearch]);

  const filteredDatabases = useMemo(() => {
    const term = metadataSearch.trim().toLowerCase();
    if (!term) {
      return databases;
    }
    return databases
      .map((database) => ({
        ...database,
        tables: database.tables.filter(
          (table) =>
            table.name.toLowerCase().includes(term) ||
            table.description?.toLowerCase().includes(term) ||
            database.name.toLowerCase().includes(term) ||
            database.description?.toLowerCase().includes(term)
        )
      }))
      .filter((database) => database.name.toLowerCase().includes(term) || database.tables.length > 0);
  }, [databases, metadataSearch]);

  useEffect(() => {
    setFilterColumn((current) => current || tableData?.columns[0]?.name || "");
  }, [tableData]);

  return (
    <div className="app-shell" style={{ gridTemplateColumns: `${sidebarWidth}px 8px minmax(0, 1fr)` }}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Database size={30} />
          </div>
          <div>
            <h1>SQL Server Viewer</h1>
            <span>只读 · 数据浏览</span>
          </div>
        </div>

        <TextField
          className="sidebar-search"
          size="small"
          placeholder="搜索数据库或表..."
          value={metadataSearch}
          onChange={(event) => setMetadataSearch(event.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} />
              </InputAdornment>
            )
          }}
        />

        <div className="tree">
          {loadingMetadata ? (
            <div className="loading-inline">
              <CircularProgress size={18} /> 加载元数据...
            </div>
          ) : (
            filteredDatabases.map((database) => {
              const isOpen = expanded.has(database.name);
              return (
                <div className="tree-section" key={database.name}>
                  <button
                    className="database-node"
                    onClick={() => {
                      setExpanded((current) => {
                        const next = new Set(current);
                        if (next.has(database.name)) {
                          next.delete(database.name);
                        } else {
                          next.add(database.name);
                        }
                        return next;
                      });
                    }}
                  >
                    <span className="chevron">{isOpen ? "⌄" : "›"}</span>
                    <Database size={21} />
                    <NodeText name={database.name} description={database.description} />
                    <span className="count-label">{database.tableCount}</span>
                  </button>

                  {isOpen && (
                    <div className="table-list">
                      {database.tables.map((table) => {
                        const active =
                          activeTable?.database === table.database && activeTable?.schema === table.schema && activeTable?.name === table.name;
                        return (
                          <button
                            key={`${table.database}.${table.schema}.${table.name}`}
                            className={`table-node ${active ? "active" : ""}`}
                            onClick={() => {
                              setActiveTable(table);
                              setPage(0);
                              setSortModel([]);
                              setFilters([]);
                              setFilterColumn("");
                              setColumnVisibilityModel({});
                              setTableData(null);
                              setDataSearch("");
                              setSearchTerm("");
                            }}
                          >
                            <Grid2X2 size={21} />
                            <NodeText name={table.name} description={table.description} />
                            <span className="count-label">{table.rowCountLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      <div
        aria-label="调整左侧导航宽度"
        className="sidebar-resizer"
        role="separator"
        title="拖动调整左侧导航宽度"
        onMouseDown={(event) => {
          event.preventDefault();
          setIsResizingSidebar(true);
        }}
      />

      <main className="content">
        <header className="topbar">
          <div className="breadcrumb">
            <Database size={20} />
            <span>{activeTable?.database ?? "database"}</span>
            <span>›</span>
            <strong>{activeTable?.name ?? "table"}</strong>
          </div>
          <div className="connection-status">
            <Database size={20} />
            <div>
              <Select
                aria-label="切换数据源"
                className="data-source-select"
                disabled={switchingDataSource || dataSources.length < 2}
                size="small"
                value={activeDataSource ?? ""}
                onChange={(event) => void handleDataSourceChange(event.target.value as DataSource["id"])}
              >
                {dataSources.map((source) => (
                  <MenuItem key={source.id} value={source.id}>
                    {source.label}
                  </MenuItem>
                ))}
              </Select>
              <span>{switchingDataSource ? "正在验证连接..." : "只读数据浏览"}</span>
            </div>
            <div className="avatar">U</div>
          </div>
        </header>

        <section className="title-row">
          <Grid2X2 className="title-icon" size={33} />
          <div>
            <h2>{activeTable?.name ?? "请选择表"}</h2>
            <Description text={activeTable?.description ?? tableData?.tableDescription} />
          </div>
        </section>

        <section className="toolbar">
          <TextField
            className="data-search"
            size="small"
            placeholder="搜索数据..."
            value={dataSearch}
            onChange={(event) => setDataSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={19} />
                </InputAdornment>
              )
            }}
          />
          <Tooltip title="字段筛选">
            <Button variant="outlined" startIcon={<Filter size={19} />} onClick={(event) => setFilterAnchor(event.currentTarget)}>
              筛选{filters.length ? ` (${filters.length})` : ""}
            </Button>
          </Tooltip>
          <Tooltip title="多条件排序">
            <Button variant="outlined" startIcon={<SlidersHorizontal size={19} />} onClick={(event) => setSortAnchor(event.currentTarget)}>
              排序{sortModel.length ? ` (${sortModel.length})` : ""}
            </Button>
          </Tooltip>
          <Tooltip title="列显示、隐藏和列宽可在表格内调整">
            <Button variant="outlined" startIcon={<Columns3 size={19} />} onClick={(event) => setColumnsAnchor(event.currentTarget)}>
              列设置
            </Button>
          </Tooltip>
          <Tooltip title="刷新">
            <Button variant="outlined" startIcon={<RefreshCw size={19} />} onClick={() => void loadRows()}>
              刷新
            </Button>
          </Tooltip>
          <Box flex={1} />
          <div className="row-count">共 {tableData?.rowCount.toLocaleString("zh-CN") ?? 0} 行</div>
        </section>

        {error && <div className="error-bar">{error}</div>}

        <section className="grid-panel">
          <ReadonlyGrid key={activeTable ? `${activeTable.database}.${activeTable.schema}.${activeTable.name}` : "empty"}
            data={tableData} page={page} pageSize={pageSize} loading={loadingRows}
            hidden={columnVisibilityModel} sorts={sortModel} onPage={setPage}
            onSize={(size) => { setPageSize(size); setPage(0); }}
            onSort={(sorts) => { setSortModel(sorts); setPage(0); }} />
        </section>

        <Popover
          open={Boolean(filterAnchor)}
          anchorEl={filterAnchor}
          onClose={() => setFilterAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          <div className="popover-panel">
            <div className="filter-summary"><strong>字段筛选 · 全部满足</strong><IconButton title="关闭筛选" aria-label="关闭筛选" onClick={() => setFilterAnchor(null)}><X size={18} /></IconButton></div>
            {filters.map((filter, index) => <div className="filter-summary" key={index}>
              <span>{filter.column} · {operatorLabels[filter.operator]} · {filter.operator === "isEmpty" ? "" : filter.value}</span>
              <IconButton size="small" title="移除条件" aria-label={`删除筛选 ${index + 1}`} onClick={() => { setFilters(filters.filter((_, i) => i !== index)); setPage(0); }}><X size={16} /></IconButton>
            </div>)}
            <Select size="small" value={filterColumn} inputProps={{ "aria-label": "筛选字段" }} onChange={(event) => setFilterColumn(event.target.value)}>
              {tableData?.columns.map((column) => (
                <MenuItem key={column.name} value={column.name}>
                  {column.name}
                </MenuItem>
              ))}
            </Select>
            <Select size="small" value={filterOperator} inputProps={{ "aria-label": "筛选运算符" }} onChange={(event) => setFilterOperator(event.target.value)}>
              <MenuItem value="contains">包含</MenuItem>
              <MenuItem value="equals">等于</MenuItem>
              <MenuItem value="startsWith">开头是</MenuItem>
              <MenuItem value="gt">大于</MenuItem>
              <MenuItem value="gte">大于等于</MenuItem>
              <MenuItem value="lt">小于</MenuItem>
              <MenuItem value="lte">小于等于</MenuItem>
              <MenuItem value="isEmpty">为空</MenuItem>
            </Select>
            <TextField
              size="small"
              placeholder="筛选值"
              value={filterValue}
              disabled={filterOperator === "isEmpty"}
              onChange={(event) => setFilterValue(event.target.value)}
            />
            <div className="popover-actions">
              <Button
                size="small"
                onClick={() => {
                  setFilters([]);
                  setFilterValue("");
                  setPage(0);
                  setFilterAnchor(null);
                }}
              >
                清除
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={!filterColumn || (filterOperator !== "isEmpty" && !filterValue) || filters.length >= 50}
                onClick={() => {
                  if (filterColumn && (filterValue || filterOperator === "isEmpty")) {
                    setFilters([...filters, { column: filterColumn, operator: filterOperator, value: filterValue }]);
                    setFilterValue("");
                    setPage(0);
                  }
                }}
              >
                添加条件
              </Button>
            </div>
          </div>
        </Popover>

        <Popover open={Boolean(sortAnchor)} anchorEl={sortAnchor} onClose={() => setSortAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "left" }}>
          <SortPanel columns={tableData?.columns ?? []} value={sortModel} onApply={(sorts) => { setSortModel(sorts); setPage(0); setSortAnchor(null); }} />
        </Popover>

        <Popover
          open={Boolean(columnsAnchor)}
          anchorEl={columnsAnchor}
          onClose={() => setColumnsAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          <div className="popover-panel column-panel">
            <strong>列设置</strong>
            {tableData?.columns.map((column) => (
              <FormControlLabel
                key={column.name}
                control={
                  <Checkbox
                    checked={columnVisibilityModel[column.name] !== false}
                    onChange={(event) =>
                      setColumnVisibilityModel((current) => ({
                        ...current,
                        [column.name]: event.target.checked
                      }))
                    }
                  />
                }
                label={
                  <span>
                    {column.name}
                    {column.description ? <small>{column.description}</small> : null}
                  </span>
                }
              />
            ))}
          </div>
        </Popover>

        <footer className="footer">
          <span>SQL Server Viewer v0.1.0</span>
          <span>只读模式 · 安全连接 · 数据不落地</span>
        </footer>
      </main>
    </div>
  );
};
